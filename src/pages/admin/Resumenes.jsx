import React, { useEffect, useState } from "react";
import {
  Select,
  DatePicker,
  Button,
  Table,
  message,
  Modal,
  InputNumber,
  Drawer,
  Input,
  Form,
} from "antd";
import dayjs from "dayjs";
import { api } from "../../services/api";
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  PlusOutlined,
  PrinterOutlined,
  CreditCardOutlined,
  MenuOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { Option } = Select;
const { RangePicker } = DatePicker;

// convierte "35.000,58" o "35000,58" o "35000.58" -> 35000.58 (Number con 2 decimales)
const parseMontoFlexible = (valor) => {
  if (valor == null || valor === "") return 0;
  // si viene como número, normalizar a 2 decimales
  if (typeof valor === "number") return Number(valor.toFixed(2));

  // string: quitar $ y espacios
  let v = String(valor).replace(/\s|\$/g, "");

  // si tiene coma y punto, asumimos coma = decimales (formato es-AR)
  // ej: 35.000,58 -> quitar miles (.) y cambiar coma por punto
  if (v.includes(",") && v.includes(".")) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else {
    // si solo tiene coma, cambiar por punto
    if (v.includes(",")) v = v.replace(",", ".");
  }
  // quitar cualquier cosa no numérica (excepto el punto decimal y signo menos)
  v = v.replace(/[^0-9.-]/g, "");
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Number(n.toFixed(2));
};

// formatter/parser para InputNumber (visual lindo + admite coma/punto)
const formatMoneyAR = (value) => {
  if (value == null || value === "") return "";
  const n = parseMontoFlexible(value);
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
const parseFromInputNumber = (v) => parseMontoFlexible(v);

const prepararTransacciones = (raw) => {
  const base = (raw || []).map((item) => {
    const fecha = item.fecha || item.fechaCreacion || new Date().toISOString();
    // Usar valor absoluto por si el backend envía con signo
    const montoBase = Math.abs(Number(
      item.total_con_descuento ?? item.total ?? item.monto ?? 0
    ));
    
    // Inferir el tipo si no viene en el item
    let tipo = item.tipo;
    if (!tipo) {
      if (item.esSaldoInicial || item.saldoInicial) {
        tipo = "Saldo Inicial";
      } else if (item.entregaId || item.metodoPagoId !== undefined) {
        tipo = "Entrega";
      } else if (item.notaCreditoId || item.motivo !== undefined) {
        tipo = "Nota de Crédito";
      } else if (item.ventaId || item.nroVenta !== undefined || item.detalleventa !== undefined) {
        tipo = "Venta";
      } else {
        // Default: intentar inferir por campos presentes
        tipo = "Entrega"; // Asumir entrega si no hay otros indicadores
      }
    }
    
    // Saldo Inicial y Ventas SUMAN (deuda), Entregas y NC RESTAN (pagos)
    const esSumaDeuda = tipo === "Venta" || tipo === "Saldo Inicial" || item.esSaldoInicial;
    const signo = esSumaDeuda ? +1 : -1;
    
    // Asegurar que los IDs se preserven correctamente
    const idFinal = item.id || item.ventaId || item.entregaId || item.notaCreditoId;
    
    // Asegurar que el campo numero esté presente
    let numero = item.numero;
    if (!numero) {
      if (tipo === "Venta") {
        numero = item.nroVenta || item.numero || null;
      } else if (tipo === "Entrega") {
        numero = item.nroEntrega || item.numero || null;
      } else if (tipo === "Nota de Crédito") {
        numero = item.nroNotaCredito || item.numero || null;
      }
    }
    
    return {
      ...item,
      tipo, // Asegurar que siempre haya un tipo
      id: idFinal, // Asegurar que siempre haya un id
      ventaId: tipo === "Venta" ? (item.ventaId || item.id) : item.ventaId, // Preservar ventaId para ventas
      fecha,
      numero, // Asegurar que el campo numero esté presente
      __montoOriginal: montoBase, // para mostrar (siempre positivo)
      __montoFirmado: signo * montoBase, // para acumular saldo
      uniqueId: `${tipo}-${idFinal}`,
    };
  });

  // Ordenar todas las transacciones por fecha descendente (más nuevo a más antiguo)
  const ordenadasPorFecha = base.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Calcular el saldo acumulado desde la más antigua hacia la más nueva
  // Primero invertimos el orden para calcular el saldo correctamente
  const ordenadasAscendente = [...ordenadasPorFecha].reverse();
  let saldo = 0;
  const conSaldoAscendente = ordenadasAscendente.map((it) => {
    saldo += it.__montoFirmado;
    return {
      ...it,
      saldo_restante: saldo,
      monto_formateado: it.__montoOriginal.toLocaleString("es-AR"),
    };
  });

  // Retornar en orden descendente (más nuevo primero)
  return conSaldoAscendente.reverse();
};

const VentasPorNegocio = () => {
  // Obtener rol del usuario (1 = encargado de ventas)
  const userRole = Number(localStorage.getItem("rol"));
  const isEncargadoVentas = userRole === 1;

  const [negocios, setNegocios] = useState([]);
  const [negocioSeleccionado, setNegocioSeleccionado] = useState(null);
  const [fechaInicio, setFechaInicio] = useState(dayjs("2025-12-01"));
  const [fechaFin, setFechaFin] = useState(dayjs());
  const [transacciones, setTransacciones] = useState([]);
  const [hasBuscado, setHasBuscado] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState(null);
  const [modalContent, setModalContent] = useState(null);
  const [modalTitle, setModalTitle] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [editMonto, setEditMonto] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [actionDrawerVisible, setActionDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isAddPagoOpen, setIsAddPagoOpen] = useState(false);
  const [nuevoMonto, setNuevoMonto] = useState(null);
  const [nuevoMetodoPago, setNuevoMetodoPago] = useState(null);
  const [loadingPago, setLoadingPago] = useState(false);
  const [metodosPago, setMetodosPago] = useState([]);
  const [isAddNotaCreditoOpen, setIsAddNotaCreditoOpen] = useState(false);
  const [motivoNotaCredito, setMotivoNotaCredito] = useState("");
  const [montoNotaCredito, setMontoNotaCredito] = useState(null);
  const [loadingNotaCredito, setLoadingNotaCredito] = useState(false);
  const [montoWarning, setMontoWarning] = useState("");
  const [chequeModalOpen, setChequeModalOpen] = useState(false);
  const [savingCheque, setSavingCheque] = useState(false);
  const [chequeForm] = Form.useForm();
  const esCheque =
    !!nuevoMetodoPago &&
    metodosPago
      .find((m) => String(m.id) === String(nuevoMetodoPago))
      ?.nombre?.toUpperCase() === "CHEQUE";

  // Estados para Saldo Inicial
  const [saldoInicial, setSaldoInicial] = useState(null);
  const [isAddSaldoInicialOpen, setIsAddSaldoInicialOpen] = useState(false);
  const [montoSaldoInicial, setMontoSaldoInicial] = useState(null);
  const [descripcionSaldoInicial, setDescripcionSaldoInicial] = useState("");
  const [loadingSaldoInicial, setLoadingSaldoInicial] = useState(false);

  // Detectar el ancho de la pantalla
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Determinar el tipo de pantalla
  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth < 1024;
  const isDesktop = screenWidth >= 1024;

  useEffect(() => {
    const fetchNegocios = async () => {
      try {
        const res = await api("api/getAllNegocios");
        setNegocios(res.negocios || []);
      } catch (err) {
        message.error("Error al cargar negocios");
      }
    };
    fetchNegocios();
  }, []);

  useEffect(() => {
    const fetchMetodosPago = async () => {
      try {
        const res = await api("api/metodosPago");
        console.log("Metodos pagos", res);
        setMetodosPago(res);
      } catch (err) {
        message.error("Error al cargar métodos de pago");
      }
    };
    fetchMetodosPago();
  }, []);

  // Obtener saldo inicial cuando cambia el negocio seleccionado
  const fetchSaldoInicial = async (negocioId) => {
    if (!negocioId) {
      setSaldoInicial(null);
      return;
    }
    try {
      const res = await api(`api/saldos-iniciales/${negocioId}`);
      setSaldoInicial(res); // puede ser null si no existe
    } catch (err) {
      console.error("Error al obtener saldo inicial:", err);
      setSaldoInicial(null);
    }
  };

  useEffect(() => {
    if (negocioSeleccionado) {
      fetchSaldoInicial(negocioSeleccionado);
    } else {
      setSaldoInicial(null);
    }
  }, [negocioSeleccionado]);

  // Guardar o actualizar saldo inicial
  const handleGuardarSaldoInicial = async () => {
    if (!negocioSeleccionado) {
      message.warning("Seleccioná un negocio primero");
      return;
    }
    if (!montoSaldoInicial && montoSaldoInicial !== 0) {
      message.warning("Ingresá un monto para el saldo inicial");
      return;
    }

    setLoadingSaldoInicial(true);
    try {
      if (saldoInicial) {
        // Actualizar existente
        const res = await api(`api/saldos-iniciales/${saldoInicial.id}`, "PUT", {
          monto: montoSaldoInicial,
          descripcion: descripcionSaldoInicial || null,
        });
        setSaldoInicial(res);
        message.success("Saldo inicial actualizado correctamente");
      } else {
        // Crear nuevo
        const res = await api("api/saldos-iniciales", "POST", {
          negocioId: negocioSeleccionado,
          monto: montoSaldoInicial,
          descripcion: descripcionSaldoInicial || null,
        });
        setSaldoInicial(res);
        message.success("Saldo inicial registrado correctamente");
      }
      setIsAddSaldoInicialOpen(false);
      setMontoSaldoInicial(null);
      setDescripcionSaldoInicial("");
      // Refrescar transacciones si ya se buscó
      if (hasBuscado) {
        obtenerResumen();
      }
    } catch (err) {
      const msg = err?.message || "Error al guardar el saldo inicial";
      message.error(msg);
    } finally {
      setLoadingSaldoInicial(false);
    }
  };

  // Abrir modal de saldo inicial (para crear o editar)
  const openSaldoInicialModal = () => {
    if (saldoInicial) {
      setMontoSaldoInicial(saldoInicial.monto);
      setDescripcionSaldoInicial(saldoInicial.descripcion || "");
    } else {
      setMontoSaldoInicial(null);
      setDescripcionSaldoInicial("");
    }
    setIsAddSaldoInicialOpen(true);
  };

  const handleEditar = async (record) => {
    try {
      let res;
      const idFinal = record.ventaId || record.id;
      
      if (record.tipo === "Venta") {
        if (!idFinal) {
          message.error("No se pudo identificar la venta para editar");
          return;
        }
        res = await api(`api/ventas/${idFinal}`);
        setEditingRecord(res);
        setEditMonto(res.total);
      } else if (record.tipo === "Entrega") {
        if (!record.id) {
          message.error("No se pudo identificar la entrega para editar");
          return;
        }
        res = await api(`api/entregas/${record.id}`);
        setEditingRecord(res);
        setEditMonto(res.monto);
      } else if (record.tipo === "Nota de Crédito") {
        if (!record.id) {
          message.error("No se pudo identificar la nota de crédito para editar");
          return;
        }
        res = await api(`api/notasCredito/${record.id}`);
        setEditingRecord(res);
        setEditMonto(res.monto);
      } else if (record.tipo === "Saldo Inicial" || record.esSaldoInicial) {
        // Para saldo inicial, abrir el modal específico
        openSaldoInicialModal();
        setActionDrawerVisible(false);
        return;
      } else {
        message.error("Tipo de registro no soportado para edición");
        return;
      }
      setIsEditModalOpen(true);
      setActionDrawerVisible(false);
    } catch (err) {
      console.error("Error al obtener el registro para editar:", err);
      message.error(`Error al obtener el registro para editar: ${err.message || "Error desconocido"}`);
    }
  };
  const guardarEdicion = async () => {
    try {
      if (editingRecord.tipo === "Venta") {
        await api(`api/ventas/${editingRecord.id}`, "POST", {
          total: editMonto,
        });
      } else if (editingRecord.tipo === "Entrega") {
        await api(`api/entregas/${editingRecord.id}`, "PUT", {
          monto: editMonto,
        });
      } else if (editingRecord.tipo === "Nota de Crédito") {
        await api(`api/notasCredito/${editingRecord.id}`, "PUT", {
          monto: editMonto,
        });
      }
      message.success("Registro actualizado correctamente");
      setIsEditModalOpen(false);
      obtenerResumen();
    } catch (err) {
      message.error("Error al actualizar el registro");
    }
  };

  const handleEliminar = async (id, tipo, record = null) => {
    // Para saldo inicial, usar el id del saldoInicial del estado
    const esSaldoIni = tipo === "Saldo Inicial" || record?.esSaldoInicial;
    
    // Para ventas, usar ventaId si existe
    const idFinal = tipo === "Venta" ? (record?.ventaId || id) : id;
    
    Modal.confirm({
      title: esSaldoIni 
        ? "¿Estás seguro que querés eliminar el Saldo Inicial?" 
        : "¿Estás seguro que querés eliminar esta " + tipo + "?",
      content: esSaldoIni 
        ? "Esto eliminará permanentemente el saldo inicial del cliente." 
        : undefined,
      okText: "Sí, eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          if (tipo === "Venta") {
            if (!idFinal) {
              message.error("No se pudo identificar la venta para eliminar");
              return;
            }
            await api(`api/ventas/${idFinal}`, "DELETE");
            message.success("Venta eliminada correctamente");
          } else if (tipo === "Entrega") {
            if (!id) {
              message.error("No se pudo identificar la entrega para eliminar");
              return;
            }
            await api(`api/entregas/${id}`, "DELETE");
            message.success("Entrega eliminada correctamente");
          } else if (tipo === "Nota de Crédito") {
            if (!id) {
              message.error("No se pudo identificar la nota de crédito para eliminar");
              return;
            }
            await api(`api/notasCredito/${id}`, "DELETE");
            message.success("Nota de crédito eliminada correctamente");
          } else if (esSaldoIni) {
            // Usar el id del saldo inicial del estado
            const saldoId = saldoInicial?.id || id;
            await api(`api/saldos-iniciales/${saldoId}`, "DELETE");
            setSaldoInicial(null);
            message.success("Saldo inicial eliminado correctamente");
          } else {
            message.error("Tipo de registro no soportado para eliminación");
            return;
          }
          obtenerResumen();
          setActionDrawerVisible(false);
        } catch (err) {
          message.error("Error al eliminar el registro");
        }
      },
    });
  };

  const handleAgregarPago = async () => {
    if (!negocioSeleccionado || !nuevoMonto || !nuevoMetodoPago) {
      message.warning("Completa todos los campos para agregar el pago");
      return;
    }

    const montoNum = parseMontoFlexible(nuevoMonto);
    if (montoNum <= 0) return message.error("Ingresá un monto válido");

    setLoadingPago(true);
    try {
      const cajaId = parseInt(localStorage.getItem("cajaId") || "0", 10);
      await api("api/entregas", "POST", {
        monto: montoNum,
        metodoPagoId: Number(nuevoMetodoPago),
        negocioId: Number(negocioSeleccionado),
        cajaId: cajaId || undefined,
      });
      message.success("Pago registrado correctamente");
      setIsAddPagoOpen(false);
      setNuevoMonto(null);
      setNuevoMetodoPago(null);
      obtenerResumen();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Error al registrar el pago";
      message.error(msg);
    } finally {
      setLoadingPago(false);
    }
  };

  const handleAgregarNotaCredito = async () => {
    if (!negocioSeleccionado || !motivoNotaCredito || !montoNotaCredito) {
      message.warning(
        "Completa todos los campos para agregar la nota de crédito"
      );
      return;
    }
    setLoadingNotaCredito(true);
    try {
      await api("api/notasCredito", "POST", {
        motivo: motivoNotaCredito,
        monto: montoNotaCredito,
        negocioId: negocioSeleccionado,
      });
      message.success("Nota de crédito registrada correctamente");
      setIsAddNotaCreditoOpen(false);
      setMotivoNotaCredito("");
      setMontoNotaCredito(null);
      obtenerResumen();
    } catch (err) {
      message.error("Error al registrar la nota de crédito");
    } finally {
      setLoadingNotaCredito(false);
    }
  };

  const handleVerDetalle = async (record) => {
    const { tipo, id, ventaId } = record;
    // Usar ventaId si existe, sino id
    const ventaIdFinal = ventaId || id;
    
    try {
      if (tipo === "Nota de Crédito") {
        if (!id) {
          message.error("No se pudo identificar la nota de crédito");
          return;
        }
        const res = await api(`api/notasCredito/${id}`);
        const nota = res;
        setModalTitle("Detalle de Nota de Crédito");
        setModalContent(
          <div className="text-sm">
            <p>
              <strong>Motivo:</strong> {nota.motivo}
            </p>
            <p>
              <strong>Monto:</strong> ${nota.monto.toLocaleString("es-AR")}
            </p>
            <p>
              <strong>Fecha:</strong>{" "}
              {dayjs(nota.fechaCreacion).format("DD/MM/YYYY")}
            </p>
          </div>
        );
      } else if (tipo === "Venta") {
        if (!ventaIdFinal) {
          message.error("No se pudo identificar la venta. ID faltante.");
          console.error("Record sin ID:", record);
          return;
        }
        const res = await api(`api/ventas/${ventaIdFinal}`);
        const venta = res;

        if (!venta || !venta.detalles || venta.detalles.length === 0) {
          message.warning("La venta no tiene detalles disponibles");
          return;
        }

        setDetalleSeleccionado(venta.detalles);
        setModalTitle("Detalle de Venta");
        setModalContent(
          <div className="text-sm">
            <p>
              <strong>Total:</strong> ${(venta.total || 0).toLocaleString("es-AR")}
            </p>
            <p>
              <strong>Fecha:</strong>{" "}
              {dayjs(venta.fechaCreacion || venta.fecha).format("DD/MM/YYYY")}
            </p>
            <p>
              <strong>Productos:</strong>
            </p>
            <ul className="list-disc pl-5">
              {venta.detalles.map((d) => (
                <li key={d.id || d.productoId} className="mb-1">
                  {d.producto?.nombre || d.nombreProducto || "Producto sin nombre"} - {d.cantidad} u. x $
                  {d.precio.toLocaleString("es-AR")} = $
                  {(d.subTotal || d.precio * d.cantidad).toLocaleString("es-AR")}
                </li>
              ))}
            </ul>
          </div>
        );
      } else if (tipo === "Saldo Inicial" || record.esSaldoInicial) {
        setModalTitle("Detalle de Saldo Inicial");
        setModalContent(
          <div className="text-sm">
            <p>
              <strong>Monto:</strong> ${(record.monto || 0).toLocaleString("es-AR")}
            </p>
            <p>
              <strong>Fecha:</strong> {dayjs(record.fecha).format("DD/MM/YYYY")}
            </p>
            {record.descripcion && (
              <p>
                <strong>Descripción:</strong> {record.descripcion}
              </p>
            )}
            <p className="mt-2 text-gray-500 text-xs">
              Este es el saldo que tenía el cliente antes de usar el sistema.
            </p>
          </div>
        );
      } else {
        setModalTitle("Entrega");
        setModalContent(
          <div className="text-sm">
            <p>
              <strong>Monto:</strong> ${(record.monto || 0).toLocaleString("es-AR")}
            </p>
            <p>
              <strong>Fecha:</strong> {dayjs(record.fecha).format("DD/MM/YYYY")}
            </p>
            <p>
              <strong>Método de pago:</strong> {record.metodo_pago || "-"}
            </p>
          </div>
        );
      }
      setModalVisible(true);
      setActionDrawerVisible(false);
    } catch (err) {
      console.error("Error al obtener detalles:", err);
      message.error(`No se pudieron obtener los detalles: ${err.message || "Error desconocido"}`);
    }
  };

  const handleBuscarTransacciones = async () => {
    if (!negocioSeleccionado) {
      message.warning("Seleccioná un negocio");
      return;
    }
    
    // Si no hay fechas, usar fechas por defecto (último mes hasta hoy)
    let fechaInicioFinal = fechaInicio;
    let fechaFinFinal = fechaFin;
    
    if (!fechaInicioFinal || !fechaFinFinal) {
      fechaInicioFinal = dayjs().subtract(1, "month");
      fechaFinFinal = dayjs();
      setFechaInicio(fechaInicioFinal);
      setFechaFin(fechaFinFinal);
    }

    const startDate = dayjs(fechaInicioFinal).format("YYYY-MM-DD");
    const endDate = dayjs(fechaFinFinal).format("YYYY-MM-DD");

    try {
      const res = await api(
        `api/resumenCuenta/negocio/${negocioSeleccionado}?startDate=${startDate}&endDate=${endDate}`
      );
      const transaccionesPreparadas = prepararTransacciones(res);
      setTransacciones(transaccionesPreparadas);
      setHasBuscado(true);
      setFilterDrawerVisible(false);
    } catch (error) {
      console.error("Error al cargar las transacciones:", error);
      message.error("Error al cargar las transacciones: " + (error.message || "Error desconocido"));
    }
  };

  // Función para actualizar tanto fechaInicio como fechaFin cuando se usa RangePicker
  const handleRangePickerChange = (dates) => {
    if (dates && dates.length === 2) {
      setFechaInicio(dates[0]);
      setFechaFin(dates[1]);
    } else {
      setFechaInicio(null);
      setFechaFin(null);
    }
  };

  // Obtener resumen (función para refrescar después de cambios)
  const obtenerResumen = () => {
    // Si no se ha buscado antes, hacer la búsqueda inicial
    if (!hasBuscado && (!fechaInicio || !fechaFin)) {
      // Usar fechas por defecto si no están definidas
      const fechaInicioDefault = fechaInicio || dayjs().subtract(1, "month");
      const fechaFinDefault = fechaFin || dayjs();
      setFechaInicio(fechaInicioDefault);
      setFechaFin(fechaFinDefault);
    }
    handleBuscarTransacciones();
  };

  // Definir columnas según el tamaño de pantalla
  const getColumns = () => {
    if (isMobile) {
      return [
        {
          title: "Tipo",
          dataIndex: "tipo",
          width: "25%",
        },
        {
          title: "Fecha",
          dataIndex: "fecha",
          width: "25%",
          render: (fecha) => dayjs(fecha).format("DD/MM/YYYY"),
        },
        {
          title: "Total",
          dataIndex: "monto_formateado",
          width: "25%",
          render: (monto) => `$${monto}`,
        },
        {
          title: "",
          width: "25%",
          render: (_, record) => (
            <Button
              icon={<MoreOutlined />}
              onClick={() => {
                setSelectedRecord(record);
                setActionDrawerVisible(true);
              }}
              size="small"
            />
          ),
        },
      ];
    } else if (isTablet) {
      return [
        {
          title: "Tipo",
          dataIndex: "tipo",
        },
        {
          title: "Fecha",
          dataIndex: "fecha",
          render: (fecha) => dayjs(fecha).format("DD/MM/YYYY"),
        },
        {
          title: "Total",
          dataIndex: "monto_formateado",
          render: (monto) => `$${monto}`,
        },
        {
          title: "Saldo",
          dataIndex: "saldo_restante",
          render: (saldo) => {
            if (saldo === null || saldo === undefined) return "-";
            const color = saldo > 0 ? "#cf1322" : saldo < 0 ? "#389e0d" : "#666";
            const texto = saldo >= 0 
              ? `$${saldo.toLocaleString("es-AR")}` 
              : `-$${Math.abs(saldo).toLocaleString("es-AR")}`;
            return <span style={{ color, fontWeight: 500 }}>{texto}</span>;
          },
        },
        {
          title: "Acciones",
          render: (_, record) => (
            <div className="flex gap-1">
              <Button
                icon={<EyeOutlined />}
                onClick={() => handleVerDetalle(record)}
                size="small"
              />
              <Button
                icon={<EditOutlined />}
                onClick={() => handleEditar(record)}
                size="small"
                disabled={record.tipo === "Nota de Crédito"}
              />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleEliminar(record.id, record.tipo, record)}
                size="small"
              />
            </div>
          ),
        },
      ];
    } else {
      return [
        {
          title: "Tipo",
          dataIndex: "tipo",
        },
        {
          title: "Fecha",
          dataIndex: "fecha",
          render: (fecha) => dayjs(fecha).format("DD/MM/YYYY"),
        },
        {
          title: "Número",
          dataIndex: "numero",
          render: (numero) => numero || "-",
        },
        {
          title: "Total",
          dataIndex: "monto_formateado",
          render: (monto) => `$${monto}`,
        },
        {
          title: "Método de pago",
          dataIndex: "metodo_pago",
          render: (m) => m || "-",
        },
        {
          title: "Saldo restante",
          dataIndex: "saldo_restante",
          render: (saldo) => {
            if (saldo === null || saldo === undefined) return "-";
            const color = saldo > 0 ? "#cf1322" : saldo < 0 ? "#389e0d" : "#666";
            const texto = saldo >= 0 
              ? `$${saldo.toLocaleString("es-AR")}` 
              : `-$${Math.abs(saldo).toLocaleString("es-AR")}`;
            return <span style={{ color, fontWeight: 500 }}>{texto}</span>;
          },
        },
        {
          title: "Acciones",
          render: (_, record) => (
            <div className="flex gap-2">
              <Button
                icon={<EyeOutlined />}
                onClick={() => handleVerDetalle(record)}
              />
              <Button
                icon={<EditOutlined />}
                onClick={() => handleEditar(record)}
                disabled={record.tipo === "Nota de Crédito"}
              />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleEliminar(record.id, record.tipo, record)}
              />
            </div>
          ),
        },
      ];
    }
  };

  const handleImprimirResumen = () => {
    if (!negocioSeleccionado) {
      message.warning("Seleccioná un negocio primero");
      return;
    }
    if (transacciones.length === 0) {
      message.warning("No hay movimientos para imprimir");
      return;
    }

    const negocio = negocios.find((n) => n.id === negocioSeleccionado);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Encabezado
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("VERDULERÍA MI FAMILIA", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Resumen de Cuenta Corriente", pageWidth / 2, y, { align: "center" });
    y += 10;

    // Info del negocio y período
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Cliente: ${negocio?.nombre || "-"}`, 14, y);
    y += 5;
    
    doc.setFont("helvetica", "normal");
    if (fechaInicio && fechaFin) {
      doc.text(
        `Período: ${dayjs(fechaInicio).format("DD/MM/YYYY")} - ${dayjs(fechaFin).format("DD/MM/YYYY")}`,
        14,
        y
      );
      y += 5;
    }
    doc.text(`Fecha de emisión: ${dayjs().format("DD/MM/YYYY HH:mm")}`, 14, y);
    y += 8;

    // Las transacciones ya vienen ordenadas por fecha de manera cronológica
    const transaccionesOrdenadas = [...transacciones];

    // Calcular totales
    const totalVentas = transacciones
      .filter((t) => t.tipo === "Venta")
      .reduce((acc, t) => acc + Number(t.total_con_descuento ?? t.total ?? t.monto ?? 0), 0);
    const totalEntregas = transacciones
      .filter((t) => t.tipo === "Entrega")
      .reduce((acc, t) => acc + Number(t.monto ?? 0), 0);
    const totalNC = transacciones
      .filter((t) => t.tipo === "Nota de Crédito")
      .reduce((acc, t) => acc + Number(t.monto ?? 0), 0);

    // Tabla de movimientos
    const tableData = transaccionesOrdenadas.map((item) => {
      const tipoAbrev = item.tipo === "Nota de Crédito" ? "N.C." : item.tipo;
      const signo = item.tipo === "Venta" ? "" : "-";
      return [
        dayjs(item.fecha).format("DD/MM/YY"),
        tipoAbrev,
        item.numero || "-",
        `${signo}$${item.monto_formateado}`,
        `$${item.saldo_restante?.toLocaleString("es-AR") || "0"}`,
      ];
    });

    autoTable(doc, {
      head: [["Fecha", "Tipo", "Nro", "Monto", "Saldo"]],
      body: tableData,
      startY: y,
      theme: "striped",
      margin: { left: 14, right: 14 },
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2,
      },
      headStyles: {
        fontStyle: "bold",
        fillColor: [76, 175, 80],
        textColor: 255,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 22, halign: "center" },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 35, halign: "right" },
        4: { cellWidth: 35, halign: "right" },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    // Resumen final
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFillColor(240, 240, 240);
    doc.rect(14, finalY - 2, pageWidth - 28, 28, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN", 18, finalY + 4);

    doc.setFont("helvetica", "normal");
    doc.text(`Total Ventas:`, 18, finalY + 10);
    doc.text(`$${totalVentas.toLocaleString("es-AR")}`, pageWidth - 18, finalY + 10, { align: "right" });

    doc.text(`Total Entregas:`, 18, finalY + 16);
    doc.text(`-$${totalEntregas.toLocaleString("es-AR")}`, pageWidth - 18, finalY + 16, { align: "right" });

    if (totalNC > 0) {
      doc.text(`Notas de Crédito:`, 18, finalY + 22);
      doc.text(`-$${totalNC.toLocaleString("es-AR")}`, pageWidth - 18, finalY + 22, { align: "right" });
    }

    // Saldo pendiente destacado
    const saldoY = totalNC > 0 ? finalY + 32 : finalY + 28;
    doc.setFillColor(76, 175, 80);
    doc.rect(14, saldoY - 2, pageWidth - 28, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("SALDO PENDIENTE:", 18, saldoY + 4);
    doc.text(`$${saldoPendiente.toLocaleString("es-AR")}`, pageWidth - 18, saldoY + 4, { align: "right" });

    // Resetear color
    doc.setTextColor(0, 0, 0);

    // Pie de página
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Verdulería Mi Familia - Documento generado automáticamente", pageWidth / 2, pageHeight - 10, {
      align: "center",
    });

    // Guardar PDF
    const nombreArchivo = `resumen-${negocio?.nombre?.replace(/\s+/g, "-") || "cuenta"}-${dayjs().format("DDMMYYYY")}.pdf`;
    doc.save(nombreArchivo);
    message.success("PDF generado correctamente");
  };

  // Cálculo del saldo: (saldoInicial + ventas) - (pagos + notasCredito)
  // Positivo = cliente DEBE | Negativo = cliente tiene SALDO A FAVOR
  const saldoPendiente = React.useMemo(() => {
    const montoSaldoIni = saldoInicial?.monto || 0;

    if (!Array.isArray(transacciones)) return montoSaldoIni;

    const totalVentas = transacciones
      .filter((t) => t.tipo === "Venta")
      .reduce(
        (acc, t) =>
          acc + Number(t.total_con_descuento ?? t.total ?? t.monto ?? 0),
        0
      );

    const totalCreditos = transacciones
      .filter((t) => t.tipo === "Entrega" || t.tipo === "Nota de Crédito")
      .reduce(
        (acc, t) =>
          acc + Number(t.monto ?? t.total ?? t.total_con_descuento ?? 0),
        0
      );

    // Fórmula: (saldoInicial + ventas) - (pagos + notasCredito)
    // Puede ser negativo si el cliente pagó de más (saldo a favor)
    return montoSaldoIni + totalVentas - totalCreditos;
  }, [transacciones, saldoInicial]);

  // Renderizado principal
  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Resumen por Negocio
          </h2>
        </div>
        <div className="px-4 py-4 space-y-4">
          {/* Primera fila: Filtros principales */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 md:gap-4 items-start sm:items-center">
            {isMobile ? (
              <>
                <Select
                  style={{ width: "100%", maxWidth: 350 }}
                  placeholder="Selecciona un negocio"
                  onChange={(value) => {
                    setNegocioSeleccionado(value);
                    setHasBuscado(false);
                    setTransacciones([]);
                  }}
                  value={negocioSeleccionado}
                  className="mb-2"
                >
                  {negocios
                    .filter((n) => n.estado === 1 && n.esCuentaCorriente)
                    .map((n) => (
                      <Option key={n.id} value={n.id}>
                        {n.nombre}
                      </Option>
                    ))}
                </Select>
                <div className="flex gap-2 w-full mb-2">
                  <DatePicker
                    value={fechaInicio}
                    onChange={(date) => setFechaInicio(date)}
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    placeholder="Fecha inicial"
                  />
                  <DatePicker
                    value={fechaFin}
                    onChange={(date) => setFechaFin(date)}
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    placeholder="Fecha final"
                    disabledDate={(current) =>
                      fechaInicio && current < fechaInicio
                    }
                  />
                </div>
                <div className="flex gap-2 w-full mb-2">
                  <Button
                    type="primary"
                    onClick={handleBuscarTransacciones}
                    className="flex-1"
                  >
                    Buscar Movimientos
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Select
                  style={{ width: "100%", maxWidth: 350 }}
                  placeholder="Selecciona un negocio"
                  onChange={(value) => {
                    setNegocioSeleccionado(value);
                    setHasBuscado(false);
                    setTransacciones([]);
                  }}
                  value={negocioSeleccionado}
                >
                  {negocios
                    .filter((n) => n.estado === 1 && n.esCuentaCorriente)
                    .map((n) => (
                      <Option key={n.id} value={n.id}>
                        {n.nombre}
                      </Option>
                    ))}
                </Select>
                <RangePicker
                  onChange={handleRangePickerChange}
                  value={[fechaInicio, fechaFin]}
                  style={{ width: "100%", maxWidth: 350 }}
                  format="DD/MM/YYYY"
                />
                <Button type="primary" onClick={handleBuscarTransacciones}>
                  Buscar Movimientos
                </Button>
              </>
            )}
          </div>

          {/* Segunda fila: Botones de acción - Solo se muestran después de buscar */}
          {hasBuscado && (
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-2 border-t border-gray-200">
              {negocioSeleccionado && (
                <Button
                  icon={<DollarOutlined />}
                  onClick={openSaldoInicialModal}
                  type={saldoInicial ? "default" : "primary"}
                  style={saldoInicial ? { borderColor: "#52c41a", color: "#52c41a" } : {}}
                >
                  {saldoInicial ? "Editar Saldo Inicial" : "Agregar Saldo Inicial"}
                </Button>
              )}
              <Button
                icon={<CreditCardOutlined />}
                onClick={() => setIsAddPagoOpen(true)}
                type="primary"
              >
                Agregar Pago
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => setIsAddNotaCreditoOpen(true)}
                type="primary"
              >
                Agregar Nota de Crédito
              </Button>
              <Button
                icon={<PrinterOutlined />}
                onClick={handleImprimirResumen}
                type="primary"
              >
                Imprimir
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Botón de filtro para móviles */}
      {isMobile && (
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium">Ventas por Negocio</h3>
          <Button
            icon={<MenuOutlined />}
            onClick={() => setFilterDrawerVisible(true)}
            type="primary"
          >
            Acciones
          </Button>
        </div>
      )}

      {/* Resumen de Saldo */}
      {hasBuscado && negocioSeleccionado && (
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Saldo Inicial */}
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo Inicial</p>
                <p className="text-lg font-bold text-gray-700">
                  ${(saldoInicial?.monto || 0).toLocaleString("es-AR")}
                </p>
              </div>
              {/* Total Ventas */}
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 uppercase tracking-wide">Ventas</p>
                <p className="text-lg font-bold text-blue-700">
                  +${transacciones
                    .filter((t) => t.tipo === "Venta")
                    .reduce((acc, t) => acc + Number(t.total_con_descuento ?? t.total ?? t.monto ?? 0), 0)
                    .toLocaleString("es-AR")}
                </p>
              </div>
              {/* Total Pagos + NC */}
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 uppercase tracking-wide">Pagos + N.C.</p>
                <p className="text-lg font-bold text-green-700">
                  -${transacciones
                    .filter((t) => t.tipo === "Entrega" || t.tipo === "Nota de Crédito")
                    .reduce((acc, t) => acc + Number(t.monto ?? t.total ?? 0), 0)
                    .toLocaleString("es-AR")}
                </p>
              </div>
              {/* Saldo Pendiente */}
              <div className={`rounded-lg p-3 text-center ${saldoPendiente > 0 ? "bg-red-50" : saldoPendiente < 0 ? "bg-green-50" : "bg-gray-50"}`}>
                <p className={`text-xs uppercase tracking-wide ${saldoPendiente > 0 ? "text-red-600" : saldoPendiente < 0 ? "text-green-600" : "text-gray-600"}`}>
                  {saldoPendiente > 0 ? "Deuda" : saldoPendiente < 0 ? "Saldo a Favor" : "Saldado"}
                </p>
                <p className={`text-xl font-bold ${saldoPendiente > 0 ? "text-red-700" : saldoPendiente < 0 ? "text-green-700" : "text-gray-700"}`}>
                  {saldoPendiente >= 0 
                    ? `$${saldoPendiente.toLocaleString("es-AR")}`
                    : `-$${Math.abs(saldoPendiente).toLocaleString("es-AR")}`
                  }
                </p>
                {saldoPendiente < 0 && (
                  <p className="text-xs text-green-600 mt-1">El cliente pagó de más</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de transacciones */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Movimientos</h2>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <Table
            dataSource={transacciones}
            columns={getColumns()}
            rowKey={(record) => `${record.tipo}-${record.id}`}
            pagination={{
              pageSize: isMobile ? 5 : 10,
              size: isMobile ? "small" : "default",
              simple: isMobile,
            }}
            size={isMobile || isTablet ? "small" : "middle"}
            scroll={{ x: isMobile ? 480 : isTablet ? 650 : 950 }}
            locale={{ emptyText: "No hay datos disponibles" }}
          />
        </div>
      </div>

      {/* Modal para ver detalles */}
      {!isMobile ? (
        <Modal
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
          title={modalTitle}
          width={isMobile ? "95%" : isTablet ? "80%" : 600}
        >
          {modalContent}
        </Modal>
      ) : (
        <Drawer
          open={modalVisible}
          onClose={() => setModalVisible(false)}
          title={modalTitle}
          placement="bottom"
          height="70%"
        >
          {modalContent}
        </Drawer>
      )}

      {/* Modal para editar venta */}
      {!isMobile ? (
        <Modal
          title="Editar"
          open={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          onOk={guardarEdicion}
          okText="Guardar"
          width={isMobile ? "95%" : isTablet ? "80%" : 500}
        >
          <div className="space-y-4">
            <p>
              <strong>Numero:</strong>{" "}
              {editingRecord?.nroVenta ||
                editingRecord?.nroEntrega ||
                editingRecord?.nroNotaCredito ||
                "-"}
            </p>
            <p>
              <strong>Fecha:</strong>{" "}
              {dayjs(editingRecord?.fechaCreacion).format("DD/MM/YYYY")}
            </p>
            <InputNumber
              value={editMonto ?? 0}
              onChange={(value) => setEditMonto(value)}
              formatter={(value) =>
                `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
              }
              parser={(value) => value?.replace(/\$\s?|(\.)/g, "")}
              min={0}
              style={{ width: "100%" }}
            />
          </div>
        </Modal>
      ) : (
        <Drawer
          title="Editar monto de venta"
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          placement="bottom"
          height="50%"
          extra={
            <Button type="primary" onClick={guardarEdicion}>
              Guardar
            </Button>
          }
        >
          <div className="space-y-4">
            <p>
              <strong>Nro Venta:</strong> {editingRecord?.nroVenta}
            </p>
            <p>
              <strong>Fecha:</strong>{" "}
              {dayjs(editingRecord?.fechaCreacion).format("DD/MM/YYYY")}
            </p>
            <InputNumber
              value={editMonto ?? 0}
              onChange={(value) => setEditMonto(value)}
              formatter={(value) =>
                `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
              }
              parser={(value) => value?.replace(/\$\s?|(\.)/g, "")}
              min={0}
              style={{ width: "100%" }}
            />
          </div>
        </Drawer>
      )}

      <Modal
        title="Agregar Entrega"
        open={isAddPagoOpen}
        onCancel={() => setIsAddPagoOpen(false)}
        onOk={async () => {
          if (esCheque) {
            try {
              setLoadingPago(true);
              const values = await chequeForm.validateFields();

              const cajaId = parseInt(
                localStorage.getItem("cajaId") || "0",
                10
              );
              if (!cajaId) {
                message.error("Caja no encontrada");
                setLoadingPago(false);
                return;
              }
              if (!negocioSeleccionado) {
                message.error("Seleccioná un negocio");
                setLoadingPago(false);
                return;
              }

              const montoNum = parseMontoFlexible(nuevoMonto);
              if (montoNum <= 0) {
                message.error("Ingresá un monto válido");
                setLoadingPago(false);
                return;
              }

              // 1) Registrar CHEQUE (usa centavos si tu backend espera Decimal)
              await api("api/cheques", "POST", {
                banco: values.banco,
                nroCheque: values.nroCheque,
                fechaEmision: dayjs(values.fechaEmision).format("DD/MM/YYYY"),
                fechaCobro: dayjs(values.fechaCobro).format("DD/MM/YYYY"),
                monto: montoNum, // <--- centavos admitidos
                negocioId: Number(negocioSeleccionado),
              });

              // 2) Registrar ENTREGA con método CHEQUE
              await api("api/entregas", "POST", {
                monto: montoNum,
                metodoPagoId: Number(nuevoMetodoPago),
                negocioId: Number(negocioSeleccionado),
                cajaId,
              });

              message.success("Cheque y pago registrados");
              chequeForm.resetFields();
              setNuevoMetodoPago(null);
              setNuevoMonto(null);
              setIsAddPagoOpen(false); // <-- cierra el modal
              obtenerResumen();
            } catch (err) {
              const msg =
                err?.response?.data?.message ||
                err?.message ||
                "No se pudo registrar el cheque";
              message.error(msg);
            } finally {
              setLoadingPago(false);
            }
            return;
          }
          // si NO es cheque, usa tu flujo normal:
          handleAgregarPago();
        }}
        okText="Registrar"
        confirmLoading={loadingPago}
      >
        <div className="space-y-4">
          <div>
            <label>Monto</label>
            <InputNumber
              value={nuevoMonto}
              onChange={(raw) => {
                const value = parseFromInputNumber(raw);
                if (!Number.isFinite(value)) return;

                // Mostrar info si supera el saldo, pero permitir ingresar
                if (saldoPendiente > 0 && value > saldoPendiente) {
                  const saldoAFavor = value - saldoPendiente;
                  setMontoWarning(
                    `El monto supera la deuda. Generará un saldo a favor de $${saldoAFavor.toLocaleString("es-AR")}`
                  );
                } else {
                  setMontoWarning("");
                }
                setNuevoMonto(value);
              }}
              stringMode
              step={0.01}
              min={0.01}
              style={{ width: "100%" }}
              placeholder="Monto"
              formatter={formatMoneyAR}
              parser={parseFromInputNumber}
            />
            {montoWarning && (
              <div style={{ color: "#1890ff", marginTop: 4, fontSize: 12 }}>
                ℹ️ {montoWarning}
              </div>
            )}
          </div>
          <div>
            <label>Método de pago</label>
            <Select
              value={nuevoMetodoPago}
              onChange={setNuevoMetodoPago}
              placeholder="Selecciona método de pago"
              style={{ width: "100%" }}
            >
              {metodosPago.map((m) => (
                <Option key={m.id} value={m.id}>
                  {m.nombre}
                </Option>
              ))}
            </Select>
          </div>
        </div>
        {/* Campos adicionales SOLO si el método es CHEQUE */}
        {esCheque && (
          <Form layout="vertical" form={chequeForm} className="mt-2">
            <Form.Item
              name="banco"
              label="Banco"
              rules={[{ required: true, message: "Ingresá el banco" }]}
            >
              <Input placeholder="Ej: Nación" />
            </Form.Item>
            <Form.Item
              name="nroCheque"
              label="Número de cheque"
              rules={[
                { required: true, message: "Ingresá el número de cheque" },
              ]}
            >
              <Input placeholder="Ej: 0213145123" />
            </Form.Item>
            <Form.Item
              name="fechaEmision"
              label="Fecha de emisión"
              rules={[
                { required: true, message: "Seleccioná la fecha de emisión" },
              ]}
              initialValue={dayjs()}
            >
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item
              name="fechaCobro"
              label="Fecha de cobro"
              rules={[
                { required: true, message: "Seleccioná la fecha de cobro" },
              ]}
              initialValue={dayjs().add(7, "day")}
            >
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="Agregar Nota de Crédito"
        open={isAddNotaCreditoOpen}
        onCancel={() => setIsAddNotaCreditoOpen(false)}
        onOk={handleAgregarNotaCredito}
        okText="Registrar"
        confirmLoading={loadingNotaCredito}
      >
        <div className="space-y-4">
          <div>
            <label>Motivo</label>
            <Input
              type="text"
              className="ant-input"
              value={motivoNotaCredito}
              onChange={(e) => setMotivoNotaCredito(e.target.value)}
              placeholder="Motivo de la nota de crédito"
            />
          </div>
          <div>
            <label>Monto</label>
            <InputNumber
              value={montoNotaCredito}
              onChange={setMontoNotaCredito}
              min={1}
              style={{ width: "100%" }}
              placeholder="Monto"
            />
          </div>
        </div>
      </Modal>

      {/* Modal para Saldo Inicial */}
      <Modal
        title={saldoInicial ? "Editar Saldo Inicial" : "Agregar Saldo Inicial"}
        open={isAddSaldoInicialOpen}
        onCancel={() => {
          setIsAddSaldoInicialOpen(false);
          setMontoSaldoInicial(null);
          setDescripcionSaldoInicial("");
        }}
        onOk={handleGuardarSaldoInicial}
        okText={saldoInicial ? "Actualizar" : "Guardar"}
        confirmLoading={loadingSaldoInicial}
      >
        <div className="space-y-4">
          {saldoInicial && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700">
                <strong>Nota:</strong> Este negocio ya tiene un saldo inicial registrado.
                Podés editar el monto si es necesario.
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto del saldo inicial
            </label>
            <InputNumber
              value={montoSaldoInicial}
              onChange={setMontoSaldoInicial}
              min={0}
              style={{ width: "100%" }}
              placeholder="Ej: 150000"
              formatter={(value) =>
                `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
              }
              parser={(value) => value?.replace(/\$\s?|(\.)/g, "")}
            />
            <p className="text-xs text-gray-500 mt-1">
              Ingresá la deuda que tenía el cliente antes de usar el sistema
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <Input.TextArea
              value={descripcionSaldoInicial}
              onChange={(e) => setDescripcionSaldoInicial(e.target.value)}
              placeholder="Ej: Deuda acumulada antes del 01/12/2024"
              rows={2}
            />
          </div>
        </div>
      </Modal>

      {/* Drawer para filtros en móvil - Ahora con DatePicker individuales */}
      <Drawer
        title="Acciones"
        placement="bottom"
        onClose={() => setFilterDrawerVisible(false)}
        open={filterDrawerVisible}
        height="70%"
      >
        {hasBuscado ? (
          <div className="space-y-2">
            {negocioSeleccionado && (
              <Button
                icon={<DollarOutlined />}
                onClick={() => {
                  openSaldoInicialModal();
                  setFilterDrawerVisible(false);
                }}
                type={saldoInicial ? "default" : "primary"}
                style={
                  saldoInicial
                    ? { width: "100%", borderColor: "#52c41a", color: "#52c41a" }
                    : { width: "100%" }
                }
              >
                {saldoInicial ? "Editar Saldo Inicial" : "Agregar Saldo Inicial"}
              </Button>
            )}
            <Button
              icon={<CreditCardOutlined />}
              onClick={() => {
                setIsAddPagoOpen(true);
                setFilterDrawerVisible(false);
              }}
              type="primary"
              style={{ width: "100%" }}
            >
              Agregar Pago
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                setIsAddNotaCreditoOpen(true);
                setFilterDrawerVisible(false);
              }}
              type="primary"
              style={{ width: "100%" }}
            >
              Agregar Nota de Crédito
            </Button>
            <Button
              icon={<PrinterOutlined />}
              onClick={handleImprimirResumen}
              type="primary"
              style={{ width: "100%" }}
            >
              Imprimir
            </Button>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p>Realizá una búsqueda de movimientos para ver las acciones disponibles</p>
          </div>
        )}
      </Drawer>

      {/* Drawer para acciones en móvil */}
      <Drawer
        title="Acciones"
        placement="bottom"
        onClose={() => setActionDrawerVisible(false)}
        open={actionDrawerVisible}
        height="50%"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="bg-gray-100 p-3 rounded">
              <p>
                <strong>Tipo:</strong> {selectedRecord.tipo}
              </p>
              <p>
                <strong>Fecha:</strong>{" "}
                {dayjs(selectedRecord.fecha).format("DD/MM/YYYY")}
              </p>
              <p>
                <strong>Total:</strong> ${selectedRecord.monto_formateado}
              </p>
              <p>
                <strong>Saldo:</strong>{" "}
                <span style={{ 
                  color: selectedRecord.saldo_restante > 0 ? "#cf1322" : selectedRecord.saldo_restante < 0 ? "#389e0d" : "#666",
                  fontWeight: 500 
                }}>
                  {selectedRecord.saldo_restante >= 0 
                    ? `$${(selectedRecord.saldo_restante || 0).toLocaleString("es-AR")}`
                    : `-$${Math.abs(selectedRecord.saldo_restante).toLocaleString("es-AR")}`
                  }
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <Button
                type="primary"
                icon={<EyeOutlined />}
                onClick={() => handleVerDetalle(selectedRecord)}
                style={{ width: "100%" }}
              >
                Ver detalle
              </Button>

              <Button
                icon={<EditOutlined />}
                onClick={() => handleEditar(selectedRecord)}
                style={{ width: "100%" }}
                disabled={selectedRecord?.tipo === "Nota de Crédito"}
              >
                Editar
              </Button>

              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() =>
                  handleEliminar(selectedRecord.id, selectedRecord.tipo, selectedRecord)
                }
                style={{ width: "100%" }}
              >
                Eliminar {selectedRecord?.tipo?.toLowerCase()}
              </Button>
            </div>
          </div>
        )}
      </Drawer>

    </div>
  );
};

export default VentasPorNegocio;
