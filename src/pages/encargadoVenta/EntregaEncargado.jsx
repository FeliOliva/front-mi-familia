import React, { useEffect, useState, useRef } from "react";
import {
  Card,
  Button,
  Tag,
  Empty,
  Modal,
  List,
  Divider,
  Input,
  Checkbox,
  Form,
  Alert,
  notification,
  Badge,
  Select,
  Spin,
  DatePicker,
  message,
  Tooltip,
} from "antd";
import {
  ShoppingCartOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CalendarOutlined,
  ReloadOutlined,
  FilterOutlined,
  SolutionOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";
import dayjs from "dayjs";

const EntregasEncargado = () => {
  // ====== Estado base ======
  const [entregas, setEntregas] = useState([]);
  const [filteredEntregas, setFilteredEntregas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedEntrega, setSelectedEntrega] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [payLater, setPayLater] = useState(false);

  const [modalCierreVisible, setModalCierreVisible] = useState(false);
  const [cajaInfo, setCajaInfo] = useState(null);
  const [cierreLoading, setCierreLoading] = useState(false);
  const [cierreNotification, setCierreNotification] = useState(null);
  const [totalesEntregas, setTotalesEntregas] = useState([]);
  const [gastosDelDia, setGastosDelDia] = useState([]);

  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [orden, setOrden] = useState("desc");
  const [wsConnected, setWsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [newVentasIds, setNewVentasIds] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [cierrePendiente, setCierrePendiente] = useState(false);

  const [pagosVenta, setPagosVenta] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);

  const [ventasRecienActualizadas, setVentasRecienActualizadas] = useState({});

  const [detalleMetodo, setDetalleMetodo] = useState(null);

  const wsBase = import.meta.env.VITE_WS_URL || "ws://localhost:3002";
  const [chequeForm] = Form.useForm();
  const esCheque = React.useMemo(() => {
    const m = metodosPago.find((x) => String(x.id) === String(paymentMethod));
    return m?.nombre?.toUpperCase() === "CHEQUE";
  }, [metodosPago, paymentMethod]);

  const initialized = useRef(false);

  const userId = Number(localStorage.getItem("usuarioId"));
  const rol = Number(localStorage.getItem("rol"));

  // ====== Cuenta Corriente (mismo flujo que repartidor) ======
  const [confirmEntregaVisible, setConfirmEntregaVisible] = useState(false);
  const [entregaAEntregar, setEntregaAEntregar] = useState(null);
  const [ccEntregadas, setCcEntregadas] = useState(() => {
    try {
      const raw = localStorage.getItem("ccEntregadas");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const handleEntregarCuentaCorriente = (entrega) => {
    setEntregaAEntregar(entrega);
    setConfirmEntregaVisible(true);
  };
  const hayDatosParaCerrar = () => {
    const cajaId = Number(localStorage.getItem("cajaId"));
    const resumen = totalesEntregas.find((t) => Number(t.cajaId) === cajaId);

    if (!resumen) return false;

    const totalEntregado = Number(resumen.totalEntregado || 0);
    const totalCC = Number(resumen.totalCuentaCorriente || 0);

    return totalEntregado > 0 || totalCC > 0;
  };
  const refrescarTotalesCaja = async () => {
    const cajaId = localStorage.getItem("cajaId");
    if (!cajaId) return;

    try {
      const totales = await api("api/entregas/totales-dia-caja", "GET");
      setTotalesEntregas(totales);
    } catch (err) {
      console.error("Error cargando totales de entregas (encargado):", err);
    }
  };
  const handleConfirmEntregar = async () => {
    if (!entregaAEntregar) return;

    const estadoObjetivo = 4; // Cuenta Corriente
    const ventaId = entregaAEntregar.id;

    // 1) Actualización optimista en la lista de entregas
    setEntregas((prev) =>
      prev.map((item) =>
        item.id === ventaId
          ? {
              ...item,
              estado: estadoObjetivo,
              entregadaCuentaCorriente: true, // 👈 importante para ocultar el botón
            }
          : item
      )
    );

    // 2) Guardar en localStorage qué CC ya fue entregada
    setCcEntregadas((prev) => {
      const next = { ...prev, [ventaId]: true };
      localStorage.setItem("ccEntregadas", JSON.stringify(next));
      return next;
    });

    setConfirmEntregaVisible(false);
    setEntregaAEntregar(null);

    // 3) Registrar en backend (manteniendo estado 4)
    await api(
      `api/entregas/cambiarEstado?venta_id=${ventaId}&estado=${estadoObjetivo}&caja_id=${localStorage.getItem(
        "cajaId"
      )}`,
      "POST"
    );
    await refrescarTotalesCaja();
    notification.success({
      message: "Pedido marcado en Cuenta Corriente",
      description: "La venta quedó en estado de cuenta corriente.",
    });
  };

  const handleCancelEntregar = () => {
    setConfirmEntregaVisible(false);
    setEntregaAEntregar(null);
  };

  // ====== Utilidades ======
  const formatMoney = (amount) =>
    `$${Number(amount || 0).toLocaleString("es-AR")}`;

  const parseMontoFlexible = (valor) => {
    if (valor == null || valor === "") return 0;
    if (typeof valor === "number") return Number(valor.toFixed(2));
    let v = String(valor).replace(/\s|\$/g, "");
    if (v.includes(",") && v.includes("."))
      v = v.replace(/\./g, "").replace(",", ".");
    else if (v.includes(",")) v = v.replace(",", ".");
    v = v.replace(/[^0-9.-]/g, "");
    const n = Number(v);
    if (Number.isNaN(n)) return 0;
    return Number(n.toFixed(2));
  };
  const agruparMetodos = (lista) => {
    const map = {};
    lista.forEach((m) => {
      const nombre = m.nombre;
      if (!map[nombre]) {
        map[nombre] = { nombre, total: 0, detalles: [] };
      }
      map[nombre].total += Number(m.total || 0);
      map[nombre].detalles.push(m.total);
    });
    return Object.values(map);
  };

  const getTotalesCaja = (cajaId) =>
    totalesEntregas.find((t) => Number(t.cajaId) === Number(cajaId)) || null;

  const getMetodosPagoPorCaja = (cajaId) => {
    const t = getTotalesCaja(cajaId);
    return t?.metodospago || t?.metodosPago || [];
  };

  // ====== Cierre de Caja (igual lógica que repartidor) ======
  const handleAbrirCierreCaja = async () => {
    setCierreLoading(true);
    const cajaId = localStorage.getItem("cajaId");
    const usuarioId = localStorage.getItem("usuarioId");

    try {
      const [caja, totales, gastos] = await Promise.all([
        api(`api/caja/${cajaId}`, "GET"),
        api("api/entregas/totales-dia-caja", "GET"),
        usuarioId
          ? api(`api/gastos/dia?usuarioId=${usuarioId}&cajaId=${cajaId}`, "GET")
          : Promise.resolve([]),
      ]);

      const totalSistema =
        totales.find((t) => Number(t.cajaId) === Number(cajaId))
          ?.totalEntregado || 0;
      setCajaInfo({ ...caja, totalSistema });
      setTotalesEntregas(totales);
      setGastosDelDia(gastos || []);
      setModalCierreVisible(true);
    } catch (err) {
      setCierreNotification({
        type: "error",
        message: "No se pudo cargar la información de la caja",
      });
    }
    setCierreLoading(false);
  };

  const handleCerrarCaja = async () => {
    if (!cajaInfo) return;
    setCierreLoading(true);

    try {
      const usuarioId = Number(localStorage.getItem("usuarioId"));
      const cajaId = Number(cajaInfo.id);

      // 3) Resumen de entregas reales del día para esa caja
      const resumenCaja =
        totalesEntregas.find((t) => Number(t.cajaId) === cajaId) || {};

      const totalEntregado = Number(resumenCaja.totalEntregado || 0);
      const totalEfectivo = Number(resumenCaja.totalEfectivo || 0);
      const totalGastos = gastosDelDia.reduce(
        (acc, g) => acc + (g.monto || 0),
        0
      );
      const efectivoNeto = Math.max(0, totalEfectivo - totalGastos);
      const totalCuentaCorriente = Number(
        resumenCaja.totalCuentaCorriente || 0
      );
      const totalVentas = totalEntregado + totalCuentaCorriente;
      const metodosPago =
        resumenCaja.metodospago || resumenCaja.metodosPago || [];
      const totalPagado = totalEntregado;

      const payload = {
        usuarioId,
        cajaId,
        totalVentas,
        totalPagado,
        totalCuentaCorriente,
        totalEfectivo: efectivoNeto,
        totalEfectivoBruto: totalEfectivo,
        totalGastos,
        ingresoLimpio: 0, // el encargado tampoco cuenta efectivo
        estado: 0, // pendiente
        metodoPago: metodosPago.map((m) => ({
          nombre: m.nombre,
          total: m.total,
        })),
      };

      console.log("Datos para cierre (encargado):", payload);

      await api("api/cierre-caja", "POST", payload);
      setCierrePendiente(true);
      setCierreNotification({
        type: "success",
        message: "Cierre generado correctamente (pendiente de admin)",
      });
      setModalCierreVisible(false);

      notification.success({
        message: "Caja cerrada (pendiente)",
        description:
          "El cierre de caja fue generado. El administrador debe contar el efectivo y finalizarlo.",
        placement: "topRight",
      });
    } catch (err) {
      console.error("Error al cerrar la caja (encargado):", err);
      setCierreNotification({
        type: "error",
        message: "No se pudo cerrar la caja",
      });

      notification.error({
        message: "Error al cerrar caja",
        description: "Ocurrió un error al intentar cerrar la caja.",
        placement: "topRight",
      });
    } finally {
      setCierreLoading(false);
    }
  };

  // ====== Métodos de pago ======
  useEffect(() => {
    const fetchMetodosPago = async () => {
      try {
        const res = await api("api/metodosPago");
        setMetodosPago(res || []);
        const efectivo = (res || []).find(
          (m) => m.nombre?.toUpperCase() === "EFECTIVO"
        );
        setPaymentMethod(efectivo ? efectivo.id : res?.[0]?.id ?? null);
      } catch {
        setMetodosPago([
          { id: 1, nombre: "EFECTIVO" },
          { id: 2, nombre: "TRANSFERENCIA/QR" },
          { id: 3, nombre: "TARJETA DEBITO" },
          { id: 4, nombre: "TARJETA CREDITO" },
          { id: 6, nombre: "CHEQUE" },
        ]);
        setPaymentMethod(1);
      }
    };
    fetchMetodosPago();
  }, []);

  // ====== Actualizar pago local ======
  const aplicarPagoLocal = (venta, montoNum, payLaterFlag) => {
    setEntregas((prev) => {
      const next = prev.map((item) => {
        if (item.id !== venta.id) return item;

        const pagadoAnterior = Number(item.monto_pagado || 0);
        const total = Number(item.monto || 0);
        const pagadoNuevoSinRedondeo = payLaterFlag
          ? pagadoAnterior
          : pagadoAnterior + Number(montoNum || 0);
        const pagadoNuevo = Number(pagadoNuevoSinRedondeo.toFixed(2));
        const restoSinRedondeo = total - pagadoNuevo;
        const resto = Number(Math.max(0, restoSinRedondeo).toFixed(2));

        let nuevoEstado;
        if (payLaterFlag) nuevoEstado = 3;
        else if (resto > 0) nuevoEstado = 5;
        else nuevoEstado = 2;

        return {
          ...item,
          monto_pagado: pagadoNuevo,
          resto_pendiente: resto,
          estado: nuevoEstado,
          metodo_pago: payLaterFlag ? "PENDIENTE_OTRO_DIA" : item.metodo_pago,
        };
      });
      return next;
    });

    setNewVentasIds?.((prev) => prev.filter((id) => id !== venta.id));
    applyFilter(estadoFiltro);
  };

  const getEstadoTag = (estado) => {
    switch (estado) {
      case 1:
        return (
          <Tag icon={<ClockCircleOutlined />} color="warning">
            PENDIENTE
          </Tag>
        );
      case 2:
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            COBRADA
          </Tag>
        );
      case 3:
        return (
          <Tag icon={<CalendarOutlined />} color="warning">
            PAGO OTRO DÍA
          </Tag>
        );
      case 4:
        return (
          <Tag icon={<SolutionOutlined />} color="success">
            CUENTA CORRIENTE
          </Tag>
        );
      case 5:
        return (
          <Tag icon={<DollarOutlined />} color="orange">
            PAGO PARCIAL
          </Tag>
        );
      case 6:
        return (
          <Tag icon={<CheckCircleOutlined />} color="blue">
            ENTREGADA
          </Tag>
        );
      default:
        return (
          <Tag icon={<ClockCircleOutlined />} color="default">
            DESCONOCIDO
          </Tag>
        );
    }
  };

  // ====== Carga inicial de ventas ======
  // useEffect(() => {
  //   const cargarVentasIniciales = async () => {
  //     setLoading(true);
  //     try {
  //       const cajaIdActual = Number(localStorage.getItem("cajaId"));
  //       const userId = Number(localStorage.getItem("usuarioId"));
  //       if (!Number.isFinite(cajaIdActual)) {
  //         notification.error({ message: "Caja no seleccionada" });
  //         setLoading(false);
  //         return;
  //       }

  //       const data = await api("api/ventas");
  //       let ventasFiltradas = data.ventas || data;
  //       ventasFiltradas = (ventasFiltradas || []).filter(
  //         (v) =>
  //           Number(v.cajaId) === cajaIdActual && Number(v.usuarioId) === userId
  //       );

  //       const normalizadas = (ventasFiltradas || []).map((v) => ({
  //         id: v.id,
  //         tipo: "Venta",
  //         numero: v.nroVenta,
  //         monto: v.total,
  //         monto_pagado: v.totalPagado || 0,
  //         resto_pendiente:
  //           v.restoPendiente ??
  //           Math.max(0, (v.total || 0) - (v.totalPagado || 0)),
  //         metodo_pago: v.estadoPago === 1 ? null : "EFECTIVO",
  //         estado: v.estadoPago,
  //         fechaCreacion: v.fechaCreacion,
  //         usuarioId: v.usuarioId,
  //         cajaId: Number(v.cajaId),
  //         negocio: { id: v.negocioId, nombre: v.negocio?.nombre || "" },
  //         detalles: (v.detalles || []).map((d) => ({
  //           id: d.id,
  //           cantidad: d.cantidad,
  //           precio: d.precio,
  //           subTotal: d.subTotal ?? Number(d.cantidad) * Number(d.precio),
  //           producto: {
  //             id: d.productoId,
  //             nombre: d.nombreProducto || d.producto?.nombre || "Producto",
  //           },
  //         })),
  //         entregadaCuentaCorriente: !!ccEntregadas[v.id],
  //       }));

  //       setEntregas(normalizadas);
  //       setFilteredEntregas(normalizadas);
  //     } catch (err) {
  //       notification.error({
  //         message: "Error cargando ventas",
  //         description: err.message || "Intente nuevamente",
  //       });
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   if (userId) cargarVentasIniciales();
  // }, [userId, rol]);
  // Normaliza la venta que viene por WebSocket
  const normalizarVentaWS = (venta, ccEntregadasMap = {}) => ({
    id: venta.id,
    tipo: "Venta",
    numero: venta.nroVenta,
    monto: venta.total,
    monto_pagado: venta.totalPagado || 0,
    resto_pendiente:
      venta.restoPendiente ??
      Math.max(0, (venta.total || 0) - (venta.totalPagado || 0)),
    metodo_pago: venta.estadoPago === 1 ? null : "EFECTIVO", // 1 = pendiente
    estado: venta.estadoPago,
    fechaCreacion: venta.fechaCreacion,
    usuarioId: venta.usuarioId,
    cajaId: Number(venta.cajaId),
    negocio: {
      id: venta.negocio?.id || venta.negocioId,
      nombre: venta.negocio?.nombre || `Negocio #${venta.negocioId}`,
    },
    detalles: (venta.detalles || []).map((detalle) => ({
      id: detalle.id,
      cantidad: detalle.cantidad,
      precio: detalle.precio,
      subTotal: detalle.subTotal,
      producto: {
        id: detalle.productoId,
        // en el siguiente punto corregimos nombre/unidad
        nombre:
          detalle.nombreProducto || detalle.nombre || detalle.producto?.nombre,
      },
      unidad: detalle.unidad || detalle.producto?.unidad || null,
    })),
    entregadaCuentaCorriente: !!ccEntregadasMap[venta.id],
  });

  // ====== WebSocket ======
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const cajaId = localStorage.getItem("cajaId");
    if (!cajaId) {
      console.error("No hay cajaId en localStorage");
      return;
    }

    // Crear conexión WebSocket
    const ws = new WebSocket(`${wsBase}/?cajaId=${cajaId}`);
    setSocket(ws);

    // Evento de conexión establecida
    ws.onopen = () => {
      console.log("Conexión WebSocket establecida");
      setWsConnected(true);
    };

    // Evento de error de conexión
    ws.onerror = (error) => {
      console.error("Error en la conexión WebSocket:", error);
      setWsConnected(false);
    };

    // Evento de cierre de conexión
    ws.onclose = () => {
      console.log("Conexión WebSocket cerrada");
      setWsConnected(false);
    };

    // Evento de recepción de mensaje
    ws.onmessage = (event) => {
      try {
        const mensaje = JSON.parse(event.data);
        console.log("Mensaje WebSocket recibido:", mensaje);

        // Procesamos el mensaje según su tipo
        if (mensaje.tipo === "ventas-iniciales") {
          // Si es la carga inicial de ventas, actualizamos el estado
          if (mensaje.data && mensaje.data.length > 0) {
            const nuevasVentas = mensaje.data.map((venta) =>
              normalizarVentaWS(venta, ccEntregadas)
            );
            // Actualizamos la lista de entregas con los datos del WebSocket
            setEntregas(nuevasVentas);
            setFilteredEntregas(nuevasVentas);
            // Cambiamos el estado de carga
            setLoading(false);
          } else {
            // Si no hay ventas iniciales, simplemente quitamos el estado de carga
            setLoading(false);
          }
        } else if (mensaje.tipo === "nueva-venta") {
          if (mensaje.data) {
            const nuevaVenta = normalizarVentaWS(mensaje.data, ccEntregadas);

            setEntregas((prevEntregas) => {
              const next = [nuevaVenta, ...prevEntregas];
              applyFilter(estadoFiltro, next);
              return next;
            });

            setNewVentasIds((prevIds) => [...prevIds, nuevaVenta.id]);

            notification.open({
              message: "Nueva venta registrada",
              description: `Se ha registrado una nueva venta #${
                nuevaVenta.numero
              } por ${formatMoney(nuevaVenta.monto)}`,
              icon: <ShoppingCartOutlined style={{ color: "#1890ff" }} />,
              placement: "topRight",
              duration: 5,
            });
          }
        } else if (mensaje.tipo === "venta-eliminada") {
          const idEliminado = mensaje.data?.id;
          if (idEliminado) {
            setEntregas((prevEntregas) =>
              prevEntregas.filter(
                (venta) => venta.id.toString() !== idEliminado.toString()
              )
            );

            // Actualizar las entregas filtradas también
            setFilteredEntregas((prevFilteredEntregas) =>
              prevFilteredEntregas.filter(
                (venta) => venta.id.toString() !== idEliminado.toString()
              )
            );

            // Eliminar de la lista de nuevas ventas si estaba allí
            setNewVentasIds((prevIds) =>
              prevIds.filter((id) => id.toString() !== idEliminado.toString())
            );

            notification.warning({
              message: "Venta eliminada",
              description: `Se ha eliminado la venta con ID #${idEliminado}`,
              icon: <ReloadOutlined style={{ color: "#faad14" }} />,
              placement: "topRight",
              duration: 5,
            });
          }
        } else if (mensaje.tipo === "venta-actualizada") {
          const ventaActualizada = normalizeVentaWS(mensaje.data, ccEntregadas);

          setEntregas((prev) => {
            const next = prev.map((v) =>
              v.id === ventaActualizada.id ? { ...v, ...ventaActualizada } : v
            );
            applyFilter(estadoFiltro, next);
            return next;
          });

          // si justo esta venta está abierta en un modal → actualizar también:
          setSelectedEntrega((prevSel) =>
            prevSel && prevSel.id === ventaActualizada.id
              ? { ...prevSel, ...ventaActualizada }
              : prevSel
          );
        }
      } catch (error) {
        console.error("Error al procesar mensaje WebSocket:", error);
      }
    };

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []); // Este efecto solo se ejecuta una vez al montar el componente

  // ====== Filtros ======
  const applyFilter = (estado, list = entregas) => {
    if (estado === "todos") {
      setFilteredEntregas(list);
    } else {
      const num = parseInt(estado, 10);
      setFilteredEntregas(list.filter((e) => e.estado === num));
    }
  };

  useEffect(() => {
    applyFilter(estadoFiltro);
  }, [estadoFiltro, entregas]);

  useEffect(() => {
    refrescarTotalesCaja();
  }, []);

  useEffect(() => {
    const verificarCierrePendiente = async () => {
      const cajaId = Number(localStorage.getItem("cajaId"));
      if (!cajaId) return;

      try {
        const cierres = await api("api/cierres-caja", "GET");

        const hoy = new Date();
        const inicioDelDia = new Date(
          hoy.getFullYear(),
          hoy.getMonth(),
          hoy.getDate(),
          0,
          0,
          0,
          0
        );
        const finDelDia = new Date(
          hoy.getFullYear(),
          hoy.getMonth(),
          hoy.getDate(),
          23,
          59,
          59,
          999
        );

        const cierrePend = cierres.find((c) => {
          const fecha = new Date(c.fecha);
          return (
            Number(c.cajaId) === cajaId &&
            c.estado === 0 && // pendiente
            fecha >= inicioDelDia &&
            fecha <= finDelDia
          );
        });

        setCierrePendiente(!!cierrePend);
      } catch (e) {
        console.error("Error verificando cierre pendiente:", e);
      }
    };

    verificarCierrePendiente();
  }, []);

  // ====== Detalles ======
  const handleViewDetails = async (entrega) => {
    setSelectedEntrega(entrega);
    setDetailsModalVisible(true);

    try {
      setLoadingPagos(true);
      const data = await api(`api/entregas/venta/${entrega.id}`, "GET");
      setPagosVenta(
        (data || []).map((e) => ({
          id: e.id,
          monto: e.monto,
          metodo: e.metodopago?.nombre || "SIN MÉTODO",
          fecha: e.fechaCreacion,
        }))
      );
    } catch (err) {
      console.error("Error cargando pagos de la venta:", err);
      setPagosVenta([]);
    } finally {
      setLoadingPagos(false);
    }
  };

  const handleCloseDetailsModal = () => {
    setDetailsModalVisible(false);
    setSelectedEntrega(null);
    setPagosVenta([]);
  };

  // ====== Cobro ======
  const handleOpenPaymentModal = (entrega) => {
    setSelectedEntrega(entrega);
    const base =
      entrega.estado === 5
        ? entrega.resto_pendiente ??
          Math.max(0, (entrega.monto || 0) - (entrega.monto_pagado || 0))
        : entrega.monto || 0;
    setPaymentAmount(String(base));
    setPayLater(false);
    const efectivo = metodosPago.find(
      (m) => m.nombre?.toUpperCase() === "EFECTIVO"
    );
    if (efectivo) setPaymentMethod(efectivo.id);
    setPaymentError("");
    setPaymentModalVisible(true);
  };

  const handleClosePaymentModal = () => {
    setPaymentModalVisible(false);
  };

  const handlePayLaterChange = (e) => {
    setPayLater(e.target.checked);
    if (e.target.checked) setPaymentAmount("");
  };

  const handleSubmitPayment = async () => {
    try {
      setProcessingPayment(true);
      setPaymentError("");

      if (!payLater) {
        const montoNum = parseMontoFlexible(paymentAmount);
        if (!montoNum || montoNum <= 0) {
          setPaymentError("Por favor ingrese un monto válido");
          setProcessingPayment(false);
          return;
        }
        const ventaEnLista =
          entregas.find((e) => e.id === selectedEntrega.id) || selectedEntrega;
        const pendiente = Math.max(
          0,
          Number(
            ventaEnLista.resto_pendiente ??
              Number(ventaEnLista.monto || 0) -
                Number(ventaEnLista.monto_pagado || 0)
          )
        );
        if (montoNum - pendiente > 1e-6) {
          setPaymentError(
            `El monto no puede superar el pendiente ($${pendiente.toLocaleString(
              "es-AR"
            )})`
          );
          setProcessingPayment(false);
          return;
        }
      }

      const cajaId = Number(
        selectedEntrega.cajaId ?? localStorage.getItem("cajaId") ?? 0
      );
      const negocioId = Number(
        selectedEntrega.negocioId ?? selectedEntrega.negocio?.id ?? 0
      );
      const ventaId = Number(selectedEntrega.id);

      if (!cajaId || !ventaId) {
        setPaymentError("Faltan datos de caja o venta");
        setProcessingPayment(false);
        return;
      }

      if (!payLater && esCheque) {
        const values = await chequeForm.validateFields();
        const montoNum = parseMontoFlexible(paymentAmount);

        await api("api/cheques", "POST", {
          banco: values.banco,
          nroCheque: values.nroCheque,
          fechaEmision: dayjs(values.fechaEmision).format("DD/MM/YYYY"),
          fechaCobro: dayjs(values.fechaCobro).format("DD/MM/YYYY"),
          monto: montoNum,
          negocioId,
          ventaId,
        });

        const response = await api("api/entregas", "POST", {
          monto: montoNum,
          metodoPagoId: Number(paymentMethod),
          cajaId,
          negocioId,
          ventaId,
          pagoOtroDia: false,
        });
        console.log("Respuesta de addEntrega", response);
        message.success("Cheque y pago registrados");
        aplicarPagoLocal(selectedEntrega, montoNum, false);
        setPaymentModalVisible(false);
        setDetailsModalVisible(false);
        setSelectedEntrega(null);
        chequeForm.resetFields();
        setProcessingPayment(false);
        return;
      }

      const montoNum = payLater ? 0 : parseMontoFlexible(paymentAmount);
      await api("api/entregas", "POST", {
        monto: montoNum,
        metodoPagoId: payLater ? null : Number(paymentMethod),
        cajaId,
        negocioId,
        ventaId,
        pagoOtroDia: !!payLater,
      });

      message.success(
        payLater ? "Entrega registrada (pago otro día)" : "Entrega cobrada"
      );
      aplicarPagoLocal(selectedEntrega, montoNum, !!payLater);
      setVentasRecienActualizadas((prev) => ({
        ...prev,
        [selectedEntrega.id]: Date.now(),
      }));
      await refrescarTotalesCaja();
      setPaymentModalVisible(false);
      setDetailsModalVisible(false);
      setSelectedEntrega(null);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Error al procesar el pago";
      setPaymentError(msg);
      message.error(msg);
    } finally {
      setProcessingPayment(false);
    }
  };

  // ====== Render ======
  if (loading) {
    return (
      <div className="flex justify-center items-center h-80">
        <Spin />
      </div>
    );
  }

  if (!entregas || entregas.length === 0) {
    return (
      <div className="flex justify-center items-center h-80">
        <Empty description="No hay entregas para mostrar" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-lg mx-auto py-2 px-4">
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-blue-700 text-center mb-6">
            Entregas (Ventas propias)
          </h1>
        </div>
        <Tooltip
          title={
            cierrePendiente
              ? "Ya existe un cierre pendiente para esta caja. Debe ser finalizado por un administrador antes de generar otro."
              : !hayDatosParaCerrar()
              ? "No hay entregas ni saldo de cuenta corriente para cerrar."
              : ""
          }
        >
          <Button
            type="primary"
            onClick={handleAbrirCierreCaja}
            disabled={cierrePendiente || !hayDatosParaCerrar()}
            style={{ marginBottom: 10 }}
          >
            Cerrar Caja
          </Button>
        </Tooltip>

        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <Select
              value={estadoFiltro}
              onChange={setEstadoFiltro}
              style={{ width: 140 }}
              placeholder="Filtrar por estado"
              suffixIcon={<FilterOutlined />}
            >
              <Select.Option value="todos">Todos</Select.Option>
              <Select.Option value="1">Pendiente</Select.Option>
              <Select.Option value="2">Cobrado</Select.Option>
              <Select.Option value="3">Aplazado</Select.Option>
              <Select.Option value="4">Cta. Corriente</Select.Option>
              <Select.Option value="5">Pago parcial</Select.Option>
            </Select>

            <Select
              value={orden}
              onChange={setOrden}
              style={{ width: 175 }}
              placeholder="Ordenar"
            >
              <Select.Option value="desc">Más reciente primero</Select.Option>
              <Select.Option value="asc">Más antigua primero</Select.Option>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          {[...filteredEntregas]
            .sort((a, b) => {
              const A = new Date(a.fechaCreacion);
              const B = new Date(b.fechaCreacion);
              return orden === "desc" ? B - A : A - B;
            })
            .map((entrega) => (
              <Card
                key={entrega.id}
                className="shadow-md rounded-lg border-l-4 hover:shadow-lg transition-shadow"
                style={{
                  borderLeftColor: 
                    entrega.estado === 3 
                      ? "#f59e0b" // Mismo color que pendientes
                      : entrega.metodo_pago 
                        ? "#10b981" 
                        : "#f59e0b",
                }}
              >
                <div className="flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <FileTextOutlined className="text-blue-600" />
                        <span className="font-semibold">
                          {entrega.tipo} #{entrega.numero}
                        </span>
                        {newVentasIds.includes(entrega.id) && (
                          <Badge count="Nuevo" color="#1890ff" />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <ShopOutlined className="text-gray-600" />
                        <span>{entrega.negocio?.nombre || "N/A"}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <CalendarOutlined />
                        <span>
                          {entrega.fechaCreacion
                            ? new Date(entrega.fechaCreacion).toLocaleString(
                                "es-AR"
                              )
                            : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <CreditCardOutlined className="text-green-600" />
                        <span className="font-medium">
                          {formatMoney(entrega.monto)}
                        </span>
                        {entrega.estado === 5 && entrega.monto_pagado > 0 && (
                          <span className="text-sm text-orange-500">
                            (Pagado: {formatMoney(entrega.monto_pagado)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div>{getEstadoTag(entrega.estado)}</div>
                  </div>

                  <div className="flex justify-end mt-2">
                    <div className="flex gap-2">
                      <Button
                        type="default"
                        size="small"
                        onClick={() => handleViewDetails(entrega)}
                      >
                        Ver Detalles
                      </Button>

                      {(entrega.estado === 1 ||
                        entrega.estado === 3 ||
                        entrega.estado === 5) && (
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => handleOpenPaymentModal(entrega)}
                          disabled={entrega.usuarioId !== userId}
                        >
                          {entrega.estado === 5 ? "Completar Pago" : "Cobrar"}
                        </Button>
                      )}

                      {entrega.estado === 4 &&
                        !entrega.entregadaCuentaCorriente && (
                          <Button
                            type="primary"
                            size="small"
                            onClick={() =>
                              handleEntregarCuentaCorriente(entrega)
                            }
                          >
                            Entregar
                          </Button>
                        )}
                      {entrega.estado === 4 &&
                        entrega.entregadaCuentaCorriente && (
                          <Tag icon={<CheckCircleOutlined />} color="blue">
                            ENTREGADA
                          </Tag>
                        )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      </div>

      {/* Modal Detalles */}
      <Modal
        title={
          selectedEntrega
            ? `Detalles de ${selectedEntrega.tipo} #${selectedEntrega.numero}`
            : "Detalles"
        }
        open={detailsModalVisible}
        onCancel={handleCloseDetailsModal}
        footer={[
          <Button key="back" onClick={handleCloseDetailsModal}>
            Cerrar
          </Button>,
          selectedEntrega &&
            (selectedEntrega.estado === 1 ||
              selectedEntrega.estado === 3 ||
              selectedEntrega.estado === 5) && (
              <Button
                key="cobrar"
                type="primary"
                onClick={() => {
                  handleCloseDetailsModal();
                  handleOpenPaymentModal(selectedEntrega);
                }}
                disabled={selectedEntrega.usuarioId !== userId}
              >
                {selectedEntrega.estado === 5
                  ? "Completar Pago"
                  : "Cobrar Entrega"}
              </Button>
            ),
        ]}
        width={600}
      >
        {selectedEntrega && (
          <div>
            <div className="flex justify-between mb-4">
              <div>
                <p>
                  <strong>Negocio:</strong>{" "}
                  {selectedEntrega.negocio?.nombre || "N/A"}
                </p>
                <p>
                  <strong>Tipo:</strong> {selectedEntrega.tipo}
                </p>
                <p>
                  <strong>Número:</strong> {selectedEntrega.numero}
                </p>
                <p>
                  <strong>Fecha:</strong>{" "}
                  {selectedEntrega.fechaCreacion
                    ? new Date(selectedEntrega.fechaCreacion).toLocaleString(
                        "es-AR"
                      )
                    : ""}
                </p>
              </div>
              <div>
                <p>
                  <strong>Estado:</strong>{" "}
                  {selectedEntrega.estado === 5
                    ? "PAGO PARCIAL"
                    : selectedEntrega.estado === 3
                    ? "PAGO OTRO DÍA"
                    : selectedEntrega.estado === 2
                    ? "COBRADA"
                    : "PENDIENTE"}
                </p>
                {selectedEntrega.metodo_pago &&
                  selectedEntrega.estado !== 3 && (
                    <p>
                      <strong>Método de pago:</strong>{" "}
                      {selectedEntrega.metodo_pago}
                    </p>
                  )}
                <p className="text-xl font-bold text-green-600">
                  {formatMoney(selectedEntrega.monto)}
                </p>
                {selectedEntrega.monto_pagado > 0 &&
                  selectedEntrega.resto_pendiente > 0 && (
                    <p className="text-sm text-green-500">
                      Pagado: {formatMoney(selectedEntrega.monto_pagado)}
                    </p>
                  )}
                {selectedEntrega.resto_pendiente > 0 && (
                  <p className="text-sm text-orange-500">
                    Pendiente: {formatMoney(selectedEntrega.resto_pendiente)}
                  </p>
                )}
              </div>
            </div>

            <Divider>Productos</Divider>

            <List
              dataSource={selectedEntrega.detalles || []}
              renderItem={(item) => (
                <List.Item key={item.id} className="border-b">
                  <div className="flex w-full justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.nombreProducto ||
                          item.producto?.nombre ||
                          "Producto"}
                      </div>
                      <div className="text-gray-600">
                        {item.cantidad}{" "}
                        {item.unidad ?? item.producto?.unidad ?? ""} x{" "}
                        {formatMoney(item.precio)}{" "}
                      </div>
                    </div>
                    <div className="font-semibold">
                      {formatMoney(item.subTotal)}
                    </div>
                  </div>
                </List.Item>
              )}
              footer={
                <div className="flex justify-end mt-4">
                  <div className="text-lg font-bold">
                    Total: {formatMoney(selectedEntrega.monto)}
                  </div>
                </div>
              }
            />
            <Divider>Pagos realizados</Divider>

            {loadingPagos ? (
              <Spin />
            ) : pagosVenta.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No hay pagos registrados para esta venta.
              </p>
            ) : (
              <List
                dataSource={pagosVenta}
                renderItem={(pago) => (
                  <List.Item key={pago.id}>
                    <div className="flex w-full justify-between">
                      <div>
                        <div className="font-medium">{pago.metodo}</div>
                        <div className="text-gray-500 text-xs">
                          {pago.fecha
                            ? new Date(pago.fecha).toLocaleString("es-AR")
                            : ""}
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatMoney(pago.monto)}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        )}
      </Modal>

      {/* Modal de confirmación Cuenta Corriente */}
      <Modal
        open={confirmEntregaVisible}
        onCancel={handleCancelEntregar}
        onOk={handleConfirmEntregar}
        okText="Sí, entregar"
        cancelText="Cancelar"
        title={
          <span>
            <ExclamationCircleOutlined
              style={{ color: "#faad14", marginRight: 8 }}
            />
            ¿Desea entregar el pedido?
          </span>
        }
      >
        <p>¿Desea entregar el pedido?</p>
      </Modal>

      {/* Modal de Pago */}
      <Modal
        title={
          selectedEntrega?.estado === 5 ? "Completar Pago" : "Cobrar Entrega"
        }
        open={paymentModalVisible}
        onCancel={handleClosePaymentModal}
        footer={[
          <Button key="back" onClick={handleClosePaymentModal}>
            Cancelar
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={processingPayment}
            onClick={handleSubmitPayment}
          >
            {payLater ? "Guardar" : "Cobrar"}
          </Button>,
        ]}
      >
        <Form layout="vertical" className="mt-2">
          {paymentError && (
            <Alert
              message={paymentError}
              type="error"
              showIcon
              className="mb-4"
            />
          )}

          <Form.Item label="Monto total" className="mb-2">
            <Input
              prefix={<DollarOutlined />}
              readOnly
              value={formatMoney(selectedEntrega?.monto || 0)}
            />
          </Form.Item>

          {selectedEntrega?.estado === 5 && (
            <>
              <Form.Item label="Monto pagado" className="mb-2">
                <Input
                  prefix={<DollarOutlined />}
                  readOnly
                  value={formatMoney(selectedEntrega?.monto_pagado || 0)}
                />
              </Form.Item>
              <Form.Item label="Monto pendiente" className="mb-2">
                <Input
                  prefix={<DollarOutlined />}
                  readOnly
                  value={formatMoney(selectedEntrega?.resto_pendiente || 0)}
                  style={{ color: "#f59e0b", fontWeight: "bold" }}
                />
              </Form.Item>
            </>
          )}

          <Form.Item label="Pagar otro día" className="mb-3">
            <Checkbox
              checked={payLater}
              onChange={handlePayLaterChange}
              disabled={
                selectedEntrega?.estado === 3 || selectedEntrega?.estado === 5
              }
            >
              Marcar para pago en otra fecha
            </Checkbox>
          </Form.Item>

          {!payLater && (
            <>
              <Form.Item label="Método de pago">
                <Select
                  value={paymentMethod}
                  onChange={(id) => {
                    setPaymentMethod(id);
                    const elegido = metodosPago.find(
                      (m) => String(m.id) === String(id)
                    );
                    const esChequeLocal =
                      elegido?.nombre?.toUpperCase() === "CHEQUE";
                    if (
                      !Number(paymentAmount) &&
                      esChequeLocal &&
                      selectedEntrega
                    ) {
                      const pendiente =
                        selectedEntrega.resto_pendiente ??
                        Math.max(
                          0,
                          (selectedEntrega.monto || 0) -
                            (selectedEntrega.monto_pagado || 0)
                        );
                      setPaymentAmount(String(pendiente));
                    }
                  }}
                  disabled={payLater}
                  className="w-full"
                  placeholder="Seleccione un método de pago"
                >
                  {metodosPago.map((m) => (
                    <Select.Option key={m.id} value={m.id}>
                      {m.nombre}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {!payLater && esCheque && (
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
                      {
                        required: true,
                        message: "Ingresá el número de cheque",
                      },
                    ]}
                  >
                    <Input placeholder="Ej: 0213145123" inputMode="numeric" />
                  </Form.Item>
                  <Form.Item
                    name="fechaEmision"
                    label="Fecha de emisión"
                    rules={[
                      {
                        required: true,
                        message: "Seleccioná la fecha de emisión",
                      },
                    ]}
                    initialValue={dayjs()}
                  >
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                  <Form.Item
                    name="fechaCobro"
                    label="Fecha de cobro"
                    rules={[
                      {
                        required: true,
                        message: "Seleccioná la fecha de cobro",
                      },
                    ]}
                    initialValue={dayjs().add(7, "day")}
                  >
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Form>
              )}

              <Form.Item
                label={
                  selectedEntrega?.estado === 5
                    ? "Monto a pagar ahora"
                    : "Monto recibido"
                }
                className="mb-4"
                tooltip={
                  selectedEntrega?.estado === 5
                    ? `Pendiente: ${formatMoney(
                        selectedEntrega?.resto_pendiente || 0
                      )}`
                    : ""
                }
              >
                <Input
                  prefix={<DollarOutlined />}
                  placeholder={
                    selectedEntrega?.estado === 5
                      ? `Ingrese el monto (Pendiente: ${formatMoney(
                          selectedEntrega?.resto_pendiente || 0
                        )})`
                      : "Ingrese el monto recibido"
                  }
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  disabled={payLater}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Modal Cierre de Caja */}
      <Modal
        title="Cierre de Caja"
        open={modalCierreVisible}
        onCancel={() => setModalCierreVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalCierreVisible(false)}>
            Cancelar
          </Button>,
          <Button
            key="cerrar"
            type="primary"
            loading={cierreLoading}
            onClick={handleCerrarCaja}
          >
            Confirmar Cierre
          </Button>,
        ]}
      >
        {cajaInfo ? (
          <div>
            <p>
              <strong>Caja:</strong> {cajaInfo.nombre}
            </p>
            <p>
              <strong>Total sistema (entregado):</strong>{" "}
              {formatMoney(cajaInfo.totalSistema || 0)}
            </p>

            <Divider>Gastos del día</Divider>
            {gastosDelDia.length === 0 ? (
              <p className="text-sm text-gray-500">Sin gastos registrados.</p>
            ) : (
              <ul style={{ paddingLeft: 0, listStyle: "none" }}>
                {gastosDelDia.map((g) => (
                  <li
                    key={g.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span className="capitalize">{g.motivo}</span>
                    <span style={{ fontWeight: "bold", color: "#dc2626" }}>
                      -{formatMoney(g.monto)}
                    </span>
                  </li>
                ))}
                <li
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 6,
                    fontWeight: "bold",
                  }}
                >
                  <span>Total gastos</span>
                  <span style={{ color: "#dc2626" }}>
                    -{formatMoney(
                      gastosDelDia.reduce((acc, g) => acc + (g.monto || 0), 0)
                    )}
                  </span>
                </li>
              </ul>
            )}

            <Divider>Detalle por método de pago</Divider>
            <ul style={{ paddingLeft: 0, listStyle: "none" }}>
              {agruparMetodos(getMetodosPagoPorCaja(cajaInfo.id) || []).map(
                (m) => (
                  <li key={m.nombre} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: "bold",
                      }}
                    >
                      <span>{m.nombre}</span>
                      <span>${m.total.toLocaleString("es-AR")}</span>
                    </div>

                    <Button
                      size="small"
                      type="link"
                      onClick={() => setDetalleMetodo(m)}
                    >
                      Ver detalles
                    </Button>
                  </li>
                )
              )}
            </ul>
            <Modal
              open={!!detalleMetodo}
              title={`Detalle de ${detalleMetodo?.nombre}`}
              onCancel={() => setDetalleMetodo(null)}
              footer={null}
            >
              <ul>
                {detalleMetodo?.detalles.map((d, i) => (
                  <li key={i}>${Number(d).toLocaleString("es-AR")}</li>
                ))}
              </ul>
            </Modal>
          </div>
        ) : (
          <Spin />
        )}
        {cierreNotification && (
          <Alert
            message={cierreNotification.message}
            type={cierreNotification.type}
            showIcon
            className="mt-2"
          />
        )}
      </Modal>
    </div>
  );
};

export default EntregasEncargado;
