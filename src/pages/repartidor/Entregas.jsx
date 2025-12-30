import React, { useEffect, useState, useRef } from "react";
import {
  Card,
  Button,
  Spin,
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
  InputNumber,
  Select,
  Tooltip,
  DatePicker,
  message,
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
  EditOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";
import Loading from "../../components/Loading";

const Entregas = () => {
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
  const [newVentasIds, setNewVentasIds] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [form] = Form.useForm();
  const [wsConnected, setWsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [orden, setOrden] = useState("desc");
  const [metodoPagos, setMetodoPagos] = useState([
    { id: 1, nombre: "EFECTIVO" },
    { id: 2, nombre: "TRANSFERENCIA/QR" },
    { id: 3, nombre: "TARJETA DEBITO" },
    { id: 4, nombre: "TARJETA CREDITO" },
    { id: 5, nombre: "CHEQUE" },
  ]);
  const initialized = useRef(false);
  const wsBase = import.meta.env.VITE_WS_URL || "ws://localhost:3002";
  const [confirmEntregaVisible, setConfirmEntregaVisible] = useState(false);
  const [entregaAEntregar, setEntregaAEntregar] = useState(null);

  const [modalCierreVisible, setModalCierreVisible] = useState(false);
  const [cajaInfo, setCajaInfo] = useState(null);
  const [cierreLoading, setCierreLoading] = useState(false);
  const [cierreNotification, setCierreNotification] = useState(null);
  const [totalesEntregas, setTotalesEntregas] = useState([]);
  const [cierrePendiente, setCierrePendiente] = useState(false);

  const [pagosVenta, setPagosVenta] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);

  const [detalleMetodo, setDetalleMetodo] = useState(null);
  const [ventasEspeciales, setVentasEspeciales] = useState([]);

  // Estados para editar entrega
  const [editEntregaModalVisible, setEditEntregaModalVisible] = useState(false);
  const [entregaEditando, setEntregaEditando] = useState(null);
  const [editMontoEntrega, setEditMontoEntrega] = useState(null);
  const [editMetodoPagoEntrega, setEditMetodoPagoEntrega] = useState(null);
  const [editEntregaLoading, setEditEntregaLoading] = useState(false);

  const [ccEntregadas, setCcEntregadas] = useState(() => {
    try {
      const raw = localStorage.getItem("ccEntregadas");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  // Normaliza la venta que viene del WebSocket / API al shape que usa el front
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
    negocio: {
      id: venta.negocio?.id || venta.negocioId,
      nombre: venta.negocio?.nombre || `Negocio #${venta.negocioId}`,
    },
    detalles: (venta.detalles || venta.detalleventa || []).map((detalle) => ({
      id: detalle.id,
      cantidad: detalle.cantidad,
      precio: detalle.precio,
      subTotal: detalle.subTotal,
      producto: {
        id: detalle.productoId,
        nombre:
          detalle.nombreProducto || detalle.nombre || detalle.producto?.nombre,
      },
    })),
    entregadaCuentaCorriente: !!ccEntregadasMap[venta.id],
    fueAplazadaOParcial: venta.fueAplazadaOParcial ?? false,
  });

  // ===== CHEQUE =====
  const [chequeForm] = Form.useForm();

  const esCheque = React.useMemo(() => {
    const metodo = metodoPagos.find(
      (m) => m.nombre?.toUpperCase() === paymentMethod
    );
    return metodo?.nombre?.toUpperCase() === "CHEQUE";
  }, [paymentMethod, metodoPagos]);

  const actualizarVentasEspeciales = (venta) => {
    if (venta.fueAplazadaOParcial) {
      setVentasEspeciales((prev) => {
        const existe = prev.some((v) => v.id === venta.id);
        if (!existe) return [...prev, venta];
        return prev.map((v) => (v.id === venta.id ? venta : v));
      });
    } else {
      setVentasEspeciales((prev) => prev.filter((v) => v.id !== venta.id));
    }
  };

  const refrescarTotalesCaja = async () => {
    const cajaId = localStorage.getItem("cajaId");
    if (!cajaId) return;

    try {
      const totales = await api("api/entregas/totales-dia-caja", "GET");
      setTotalesEntregas(totales);
    } catch (err) {
      console.error("Error cargando totales de entregas:", err);
    }
  };
  const hayDatosParaCerrar = () => {
    const cajaId = Number(localStorage.getItem("cajaId"));
    const resumen = totalesEntregas.find((t) => Number(t.cajaId) === cajaId);

    if (!resumen) return false;

    const totalEntregado = Number(resumen.totalEntregado || 0);
    const totalCC = Number(resumen.totalCuentaCorriente || 0);

    return totalEntregado > 0 || totalCC > 0;
  };

  // Agrupa por método y acumula los importes como "detalles"
  const agruparMetodosConDetalles = (lista = []) => {
    const acc = {};
    (lista || []).forEach((m) => {
      if (!m) return;
      const nombre = m.nombre || "DESCONOCIDO";
      const monto = Number(m.total || 0);
      if (!acc[nombre]) {
        acc[nombre] = { nombre, total: 0, detalles: [] };
      }
      acc[nombre].total += monto;
      acc[nombre].detalles.push(monto);
    });
    return Object.values(acc);
  };

  // Configurar WebSocket
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
          if (mensaje.data && mensaje.data.length > 0) {
            const nuevasVentas = mensaje.data.map((venta) =>
              normalizarVentaWS(venta, ccEntregadas)
            );

            nuevasVentas.forEach(actualizarVentasEspeciales);

            setEntregas(nuevasVentas);
            setFilteredEntregas(nuevasVentas);
            setLoading(false);
          } else {
            setEntregas([]);
            setFilteredEntregas([]);
            setLoading(false);
          }
        } else if (mensaje.tipo === "nueva-venta") {
          if (mensaje.data) {
            const nuevaVenta = normalizarVentaWS(mensaje.data, ccEntregadas);

            setEntregas((prevEntregas) => [nuevaVenta, ...prevEntregas]);

            const updatedEntregas = [nuevaVenta, ...entregas];
            applyFilter(estadoFiltro, updatedEntregas);

            actualizarVentasEspeciales(nuevaVenta);

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
        } else if (mensaje.tipo === "venta-actualizada") {
          // Normalizamos lo que viene del backend
          const ventaActualizada = normalizarVentaWS(
            mensaje.data,
            ccEntregadas
          );

          setEntregas((prev) => {
            const next = prev.map((v) => {
              if (v.id !== ventaActualizada.id) return v;

              return {
                ...v,
                ...ventaActualizada,
                // 👇 NO pisar nunca una CC ya marcada como entregada
                entregadaCuentaCorriente:
                  v.entregadaCuentaCorriente ||
                  ventaActualizada.entregadaCuentaCorriente,
              };
            });

            applyFilter(estadoFiltro, next);
            return next;
          });

          actualizarVentasEspeciales(ventaActualizada);

          setSelectedEntrega((prevSel) =>
            prevSel && prevSel.id === ventaActualizada.id
              ? {
                  ...prevSel,
                  ...ventaActualizada,
                  entregadaCuentaCorriente:
                    prevSel.entregadaCuentaCorriente ||
                    ventaActualizada.entregadaCuentaCorriente,
                }
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

  // Función para aplicar filtro por estado
  const applyFilter = (estado, entregasList = entregas) => {
    if (estado === "todos") {
      setFilteredEntregas(entregasList);
    } else {
      const estadoNum = parseInt(estado);
      setFilteredEntregas(
        entregasList.filter((entrega) => entrega.estado === estadoNum)
      );
    }
  };

  // CAJA
  const getTotalesCaja = (cajaId) =>
    totalesEntregas.find((t) => Number(t.cajaId) === Number(cajaId)) || null;

  const getMetodosPagoPorCaja = (cajaId) => {
    const t = getTotalesCaja(cajaId);
    return t?.metodospago || []; // 👈 usa 'metodospago' (como lo devuelve tu API)
  };

  const handleAbrirCierreCaja = async () => {
    setCierreLoading(true);
    const cajaId = localStorage.getItem("cajaId");
    try {
      const [caja, totales] = await Promise.all([
        api(`api/caja/${cajaId}`, "GET"),
        api("api/entregas/totales-dia-caja", "GET"),
      ]);
      const totalSistema =
        totales.find((t) => t.cajaId === Number(cajaId))?.totalEntregado || 0;

      setCajaInfo({ ...caja, totalSistema });
      setTotalesEntregas(totales); // 👈 necesario para el cierre
      setModalCierreVisible(true);
    } catch (err) {
      setCierreNotification({
        type: "error",
        message: "No se pudo cargar la caja",
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

      // 3) Resumen de ENTREGAS reales del día para esta caja (ya respeta el último cierre)
      const resumenCaja =
        totalesEntregas.find((t) => Number(t.cajaId) === cajaId) || {};

      const totalEntregado = Number(resumenCaja.totalEntregado || 0);
      const totalEfectivo = Number(resumenCaja.totalEfectivo || 0);
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
        totalEfectivo,
        ingresoLimpio: 0, // el repartidor no cuenta efectivo
        estado: 0, // cierre preliminar
        metodoPago: metodosPago.map((m) => ({
          nombre: m.nombre,
          total: m.total,
        })),
      };

      console.log("Datos para cierre (repartidor):", payload);

      await api("api/cierre-caja", "POST", payload);
      setCierrePendiente(true);
      setCierreNotification({
        type: "success",
        message: "Cierre realizado correctamente",
      });

      setModalCierreVisible(false);
      setVentasEspeciales([]);

      notification.success({
        message: "Caja cerrada",
        description: "El cierre de caja se realizó correctamente.",
        placement: "topRight",
      });
    } catch (err) {
      console.error("Error al cerrar la caja:", err);

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

  // Efecto para aplicar el filtro cuando cambia el estado del filtro o las entregas
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

  // EntregaCuentaCorriente
  const handleEntregarCuentaCorriente = (entrega) => {
    setEntregaAEntregar(entrega);
    setConfirmEntregaVisible(true);
  };

  // Confirmar entrega

  const handleConfirmEntregar = async () => {
    if (!entregaAEntregar) return;

    const ventaId = entregaAEntregar.id;

    // 1) Actualizo el estado local: marco esta CC como entregada
    setEntregas((prev) =>
      prev.map((item) =>
        item.id === ventaId ? { ...item, entregadaCuentaCorriente: true } : item
      )
    );

    setCcEntregadas((prev) => {
      const next = { ...prev, [ventaId]: true };
      localStorage.setItem("ccEntregadas", JSON.stringify(next));
      return next;
    });

    setConfirmEntregaVisible(false);
    setEntregaAEntregar(null);

    // 2) Llamada a la API (si querés seguir registrando el evento,
    //    pero sin cambiar el estado real de la venta)
    await api(
      `api/entregas/cambiarEstado?venta_id=${ventaId}&estado=4&caja_id=${localStorage.getItem(
        "cajaId"
      )}`,
      "POST"
    );
    await refrescarTotalesCaja();
    notification.success({
      message: "Pedido marcado en Cuenta Corriente",
      description:
        "La venta quedó registrada como entregada en cuenta corriente.",
    });
  };

  // Cancelar entrega
  const handleCancelEntregar = () => {
    setConfirmEntregaVisible(false);
    setEntregaAEntregar(null);
  };

  // Ver detalles de la entrega

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
          metodoId: e.metodoPagoId,
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

  // Abrir modal de edición de entrega
  const handleEditarEntrega = (pago) => {
    setEntregaEditando(pago);
    setEditMontoEntrega(pago.monto);
    setEditMetodoPagoEntrega(pago.metodoId || null);
    setEditEntregaModalVisible(true);
  };

  // Guardar edición de entrega
  const handleGuardarEdicionEntrega = async () => {
    if (!entregaEditando || !editMontoEntrega) {
      message.error("El monto es requerido");
      return;
    }

    setEditEntregaLoading(true);
    try {
      await api(`api/entregas/${entregaEditando.id}`, "PUT", {
        monto: editMontoEntrega,
        metodoPagoId: editMetodoPagoEntrega || null,
      });

      message.success("Entrega actualizada correctamente");

      // Actualizar la lista de pagos
      const data = await api(`api/entregas/venta/${selectedEntrega.id}`, "GET");
      setPagosVenta(
        (data || []).map((e) => ({
          id: e.id,
          monto: e.monto,
          metodo: e.metodopago?.nombre || "SIN MÉTODO",
          metodoId: e.metodoPagoId,
          fecha: e.fechaCreacion,
        }))
      );

      // Refrescar totales de caja
      await refrescarTotalesCaja();

      // Cerrar modal
      setEditEntregaModalVisible(false);
      setEntregaEditando(null);
      setEditMontoEntrega(null);
      setEditMetodoPagoEntrega(null);
    } catch (error) {
      console.error("Error al actualizar la entrega:", error);
      message.error(
        error.message || "Error al actualizar la entrega. Verifique que no esté en un cierre de caja cerrado."
      );
    } finally {
      setEditEntregaLoading(false);
    }
  };

  // Cerrar modal de detalles
  const handleCloseDetailsModal = () => {
    setDetailsModalVisible(false);
    setSelectedEntrega(null);
    setPagosVenta([]);
  };

  // Abrir modal de pago
  const handleOpenPaymentModal = (entrega) => {
    setSelectedEntrega(entrega);

    // CAMBIO 1: Para estado 5 (pago parcial), establecer el placeholder como el resto pendiente
    if (entrega.estado === 5) {
      setPaymentAmount(entrega.resto_pendiente.toString());
    } else {
      setPaymentAmount(entrega.monto.toString());
    }

    // CAMBIO 2: Si la venta tiene estado 3 (PAGO OTRO DÍA), no permitir marcar "Pagar otro día" nuevamente
    setPayLater(false);

    setPaymentError("");
    setPaymentMethod("EFECTIVO");
    setPaymentModalVisible(true);
  };

  // Cerrar modal de pago
  const handleClosePaymentModal = () => {
    setPaymentModalVisible(false);
    form.resetFields();
    chequeForm.resetFields();
  };

  // Pagar otro día
  const handlePayLaterChange = (e) => {
    setPayLater(e.target.checked);
    if (e.target.checked) {
      setPaymentAmount("");
    }
  };

  const handleSubmitPayment = async () => {
    try {
      setProcessingPayment(true);
      setPaymentError("");

      if (
        !payLater &&
        (!paymentAmount ||
          isNaN(parseFloat(paymentAmount)) ||
          parseFloat(paymentAmount) <= 0)
      ) {
        setPaymentError("Por favor ingrese un monto válido");
        setProcessingPayment(false);
        return;
      }
      // --- Si el método es CHEQUE ---
      if (!payLater && esCheque) {
        // Validar campos del formulario
        const values = await chequeForm.validateFields();

        const montoCheque = parseFloat(paymentAmount);

        // Guardar cheque
        await api("api/cheques", "POST", {
          banco: values.banco,
          nroCheque: values.nroCheque,
          fechaEmision: values.fechaEmision.format("DD/MM/YYYY"),
          fechaCobro: values.fechaCobro.format("DD/MM/YYYY"),
          monto: montoCheque,
          negocioId: selectedEntrega.negocio?.id,
          ventaId: selectedEntrega.id,
        });

        // Registrar entrega asociada al cheque
        await api("api/entregas", "POST", {
          monto: montoCheque,
          metodoPagoId: metodoPagos.find((m) => m.nombre === "CHEQUE")?.id,
          cajaId: Number(localStorage.getItem("cajaId")),
          negocioId: selectedEntrega.negocio?.id,
          ventaId: selectedEntrega.id,
          pagoOtroDia: false,
        });

        message.success("Cheque y entrega registrados correctamente");
        chequeForm.resetFields();

        // cerrar modales
        setPaymentModalVisible(false);
        setDetailsModalVisible(false);
        setSelectedEntrega(null);
        setProcessingPayment(false);

        // refrescar totales
        await refrescarTotalesCaja();
        return;
      }

      const cajaId = localStorage.getItem("cajaId");
      if (!cajaId) {
        setPaymentError("No se encontró el ID de la caja activa");
        setProcessingPayment(false);
        return;
      }

      // Obtener el ID del método de pago
      const selectedMethodId =
        metodoPagos.find((metodo) => metodo.nombre === paymentMethod)?.id || 1;

      // Verificar si el pago es parcial
      const isParcial =
        !payLater &&
        parseFloat(paymentAmount) < selectedEntrega.monto &&
        parseFloat(paymentAmount) > 0;

      // Crear el objeto de datos para la API
      const paymentData = {
        monto: payLater ? 0 : parseFloat(paymentAmount),
        metodoPagoId: payLater ? null : selectedMethodId,
        cajaId: parseInt(cajaId),
        negocioId: selectedEntrega.negocio?.id || 1,
        ventaId: selectedEntrega.id,
        pagoOtroDia: payLater,
      };

      console.log("Enviando datos de pago:", paymentData);

      // Llamar a la API para registrar la entrega
      const response = await api(
        "api/entregas",
        "POST",
        JSON.stringify(paymentData)
      );
      console.log("Respuesta de la API:", response);

      // Eliminar el ID de la venta de newVentasIds cuando se procesa el pago
      if (newVentasIds.includes(selectedEntrega.id)) {
        setNewVentasIds((prevIds) =>
          prevIds.filter((id) => id !== selectedEntrega.id)
        );
      }

      setPaymentModalVisible(false);
      setDetailsModalVisible(false);
      setSelectedEntrega(null);

      // Mensaje de éxito
      let notificationMessage = "";
      let notificationDescription = "";

      if (payLater) {
        notificationMessage = "Pago aplazado";
        notificationDescription = "Entrega marcada para pago en otro día";
      } else if (isParcial) {
        notificationMessage = "Pago parcial procesado";
        notificationDescription = `Entrega cobrada parcialmente por ${formatMoney(
          parseFloat(paymentAmount)
        )}`;
      } else {
        notificationMessage = "Pago procesado";
        notificationDescription = `Entrega cobrada con éxito por ${formatMoney(
          parseFloat(paymentAmount)
        )}`;
      }
      await refrescarTotalesCaja();

      notification.success({
        message: notificationMessage,
        description: notificationDescription,
        icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
      });
      setProcessingPayment(false);
    } catch (error) {
      let msg = "Error al procesar el pago. Intente nuevamente.";
      if (error?.response && error.response.data?.message) {
        msg = error.response.data.message;
      } else if (error?.message) {
        msg = error.message;
      }
      setPaymentError(msg);
      notification.error({
        message: "Error al procesar el pago",
        description: msg,
      });
      setProcessingPayment(false); // <-- Agrega esta línea aquí
    }
  };

  const formatMoney = (amount) => {
    return `$${Number(amount).toLocaleString()}`;
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
          <Tag icon={<CalendarOutlined />} color="processing">
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
  const visibles = React.useMemo(() => {
    const map = new Map();
    [...entregas, ...ventasEspeciales].forEach((v) => map.set(v.id, v));
    return Array.from(map.values());
  }, [entregas, ventasEspeciales]);

  // Renderizado condicional basado en estado de carga
  if (loading) {
    return (
      <div className="flex justify-center items-center h-80">
        <Loading />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-lg mx-auto py-2 px-4">
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-blue-700 text-center mb-6">
            Entregas Pendientes
          </h1>
          <Tooltip
            title={
              !hayDatosParaCerrar()
                ? "No hay entregas ni cuenta corriente para cerrar."
                : ""
            }
          >
            <Button
              type="primary"
              onClick={handleAbrirCierreCaja}
              disabled={cierrePendiente || !hayDatosParaCerrar()}
            >
              Cerrar Caja
            </Button>
          </Tooltip>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <Select
              value={estadoFiltro}
              onChange={setEstadoFiltro}
              style={{ width: 110 }}
              placeholder="Filtrar por estado"
              suffixIcon={<FilterOutlined />}
            >
              <Select.Option value="todos">Todos</Select.Option>
              <Select.Option value="1">Pendiente</Select.Option>
              <Select.Option value="2">Cobrado</Select.Option>
              <Select.Option value="3">Aplazado</Select.Option>
              <Select.Option value="5">Pago parcial</Select.Option>
            </Select>
            <Select
              value={orden}
              onChange={setOrden}
              style={{ width: 175, marginRight: 8 }}
              placeholder="Ordenar"
            >
              <Select.Option value="desc">Más reciente primero</Select.Option>
              <Select.Option value="asc">Más antigua primero</Select.Option>
            </Select>
          </div>
          {wsConnected ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Conectado
            </Tag>
          ) : (
            <Tag color="error" icon={<ClockCircleOutlined />}>
              Desconectado
            </Tag>
          )}
        </div>
        <div className="space-y-4">
          {(() => {
            const filtradas = [...visibles]
              .filter(
                (entrega) =>
                  estadoFiltro === "todos" || entrega.estado == estadoFiltro
              )
              .sort((a, b) => {
                const fechaA = new Date(a.fechaCreacion);
                const fechaB = new Date(b.fechaCreacion);
                return orden === "desc" ? fechaB - fechaA : fechaA - fechaB;
              });

            if (filtradas.length === 0) {
              return <Empty description="No hay entregas para mostrar" />;
            }

            return filtradas.map((entrega) => (
              <Card
                key={entrega.id}
                className="shadow-md rounded-lg border-l-4 hover:shadow-lg transition-shadow"
                style={{
                  borderLeftColor: entrega.metodo_pago ? "#10b981" : "#f59e0b",
                }}
              >
                {/* Mejora del layout para mayor responsividad */}
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

                    <div>
                      {entrega.tipo === "Venta" && getEstadoTag(entrega.estado)}
                    </div>
                  </div>

                  {/* Botones en una nueva fila para mejor responsividad */}
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
            ));
          })()}
        </div>
      </div>
      {/* Modal para mostrar los detalles */}
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
                          "Producto sin nombre"}
                      </div>
                      <div className="text-gray-600">
                        {item.cantidad} x {formatMoney(item.precio)}
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
                  <List.Item
                    key={pago.id}
                    actions={[
                      <Button
                        key="edit"
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEditarEntrega(pago)}
                        size="small"
                      >
                        Editar
                      </Button>,
                    ]}
                  >
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

      {/* Modal de confirmación para entregar cuenta corriente */}
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

      {/* Modal para procesar el pago */}
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
        <Form form={form} layout="vertical" className="mt-4">
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
            <Form.Item label="Monto pagado" className="mb-2">
              <Input
                prefix={<DollarOutlined />}
                readOnly
                value={formatMoney(selectedEntrega?.monto_pagado || 0)}
              />
            </Form.Item>
          )}

          {selectedEntrega?.estado === 5 && (
            <Form.Item label="Monto pendiente" className="mb-4">
              <Input
                prefix={<DollarOutlined />}
                readOnly
                value={formatMoney(selectedEntrega?.resto_pendiente || 0)}
                style={{ color: "#f59e0b", fontWeight: "bold" }}
              />
            </Form.Item>
          )}

          <Form.Item label="Pagar otro día" className="mb-4">
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
              <Form.Item label="Método de pago" className="mb-4">
                <Select
                  value={paymentMethod}
                  onChange={(value) => {
                    setPaymentMethod(value);

                    const metodo = metodoPagos.find((m) => m.nombre === value);
                    const esCh = metodo?.nombre?.toUpperCase() === "CHEQUE";

                    if (esCh && selectedEntrega) {
                      const pendiente =
                        selectedEntrega.resto_pendiente ??
                        Math.max(
                          0,
                          selectedEntrega.monto -
                            (selectedEntrega.monto_pagado || 0)
                        );
                      setPaymentAmount(String(pendiente));
                    }
                  }}
                  disabled={payLater}
                  className="w-full"
                  placeholder="Seleccione un método de pago"
                >
                  {metodoPagos.map((metodo) => (
                    <Select.Option key={metodo.id} value={metodo.nombre}>
                      {metodo.nombre}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label={
                  selectedEntrega?.estado === 5
                    ? "Monto a pagar ahora"
                    : "Monto recibido"
                }
                className="mb-4"
                tooltip={
                  payLater
                    ? "Desactive 'Pagar otro día' para ingresar un monto"
                    : selectedEntrega?.estado === 5
                    ? `Monto pendiente: ${formatMoney(
                        selectedEntrega?.resto_pendiente || 0
                      )}`
                    : ""
                }
              >
                <Input
                  prefix={<DollarOutlined />}
                  placeholder={
                    selectedEntrega?.estado === 5
                      ? `Ingrese el monto a pagar (Pendiente: ${formatMoney(
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
              rules={[{ required: true, message: "Ingresá el nro. de cheque" }]}
            >
              <Input placeholder="Ej: 012345678" inputMode="numeric" />
            </Form.Item>

            <Form.Item
              name="fechaEmision"
              label="Fecha de emisión"
              rules={[
                { required: true, message: "Seleccioná la fecha de emisión" },
              ]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              name="fechaCobro"
              label="Fecha de cobro"
              rules={[
                { required: true, message: "Seleccioná la fecha de cobro" },
              ]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Form>
        )}
      </Modal>
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
            // Ya no es necesario deshabilitar por montoContado
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
              <strong>Total sistema:</strong> $
              {cajaInfo.totalSistema?.toLocaleString() || 0}
            </p>
            {/* Detalle de métodos de pago */}
            <Divider>Detalle por método de pago</Divider>
            <ul style={{ paddingLeft: 0, listStyle: "none" }}>
              {agruparMetodosConDetalles(
                getMetodosPagoPorCaja(cajaInfo.id) || []
              ).map((m) => (
                <li
                  key={m.nombre}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <span className="capitalize">{m.nombre}</span>
                  <span style={{ fontWeight: "bold" }}>
                    ${m.total.toLocaleString("es-AR")}
                  </span>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setDetalleMetodo(m)}
                    style={{ paddingLeft: 8 }}
                  >
                    Ver detalles
                  </Button>
                </li>
              ))}
            </ul>
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
      <Modal
        open={!!detalleMetodo}
        title={
          detalleMetodo
            ? `Detalle de ${detalleMetodo.nombre}`
            : "Detalle de método de pago"
        }
        onCancel={() => setDetalleMetodo(null)}
        footer={null}
      >
        {detalleMetodo &&
        detalleMetodo.detalles &&
        detalleMetodo.detalles.length ? (
          <ul style={{ paddingLeft: 16 }}>
            {detalleMetodo.detalles.map((valor, idx) => (
              <li key={idx}>${Number(valor).toLocaleString("es-AR")}</li>
            ))}
          </ul>
        ) : (
          <p>No hay detalles para este método.</p>
        )}
      </Modal>

      {/* Modal de edición de entrega */}
      <Modal
        title="Editar Entrega"
        open={editEntregaModalVisible}
        onOk={handleGuardarEdicionEntrega}
        onCancel={() => {
          setEditEntregaModalVisible(false);
          setEntregaEditando(null);
          setEditMontoEntrega(null);
          setEditMetodoPagoEntrega(null);
        }}
        confirmLoading={editEntregaLoading}
        okText="Guardar"
        cancelText="Cancelar"
      >
        {entregaEditando && (
          <div className="space-y-4">
            <div>
              <p>
                <strong>Fecha:</strong>{" "}
                {entregaEditando.fecha
                  ? new Date(entregaEditando.fecha).toLocaleString("es-AR")
                  : "-"}
              </p>
            </div>
            <div>
              <label>Monto</label>
              <InputNumber
                value={editMontoEntrega ?? 0}
                onChange={(value) => setEditMontoEntrega(value)}
                formatter={(value) =>
                  `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                }
                parser={(value) => value?.replace(/\$\s?|(\.)/g, "")}
                min={0}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label>Método de Pago</label>
              <Select
                value={editMetodoPagoEntrega}
                onChange={setEditMetodoPagoEntrega}
                placeholder="Seleccionar método de pago"
                style={{ width: "100%" }}
                allowClear
              >
                {metodoPagos.map((metodo) => (
                  <Select.Option key={metodo.id} value={metodo.id}>
                    {metodo.nombre}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Entregas;
