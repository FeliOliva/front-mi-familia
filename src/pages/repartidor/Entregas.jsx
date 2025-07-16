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
  ]);
  const initialized = useRef(false);

  const [confirmEntregaVisible, setConfirmEntregaVisible] = useState(false);
  const [entregaAEntregar, setEntregaAEntregar] = useState(null);

  const [modalCierreVisible, setModalCierreVisible] = useState(false);
  const [cajaInfo, setCajaInfo] = useState(null);
  const [cierreLoading, setCierreLoading] = useState(false);
  const [montoContado, setMontoContado] = useState("");
  const [cierreNotification, setCierreNotification] = useState(null);
  const [detalleMetodos, setDetalleMetodos] = useState([]);
  const [mostrarDetalleId, setMostrarDetalleId] = useState(null);
  const [totalesEntregas, setTotalesEntregas] = useState([]);

  // Configurar WebSocket
useEffect(() => {
  if (initialized.current) return;
  initialized.current = true;
  const cajaId = sessionStorage.getItem("cajaId");
  if (!cajaId) {
    console.error("No hay cajaId en sessionStorage");
    return;
  }

  // Crear conexión WebSocket
  const ws = new WebSocket(`ws://localhost:3001?cajaId=${cajaId}`);
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
            // Transformar los datos para que coincidan con el formato esperado
            const nuevasVentas = mensaje.data.map((venta) => ({
              id: venta.id,
              tipo: "Venta",
              numero: venta.nroVenta,
              monto: venta.total,
              monto_pagado: venta.totalPagado,
              resto_pendiente: venta.restoPendiente,
              metodo_pago: venta.estadoPago === 1 ? null : "EFECTIVO", // 1 = pendiente
              estado: venta.estadoPago,
              fechaCreacion: venta.fechaCreacion,
              negocio: {
                id: venta.negocio?.id || venta.negocioId,
                nombre: venta.negocio?.nombre || `Negocio #${venta.negocioId}`,
              },
              detalles: venta.detalles.map((detalle) => ({
                id: detalle.id,
                cantidad: detalle.cantidad,
                precio: detalle.precio,
                subTotal: detalle.subTotal,
                producto: {
                  id: detalle.productoId,
                  nombre: `${
                    detalle.nombreProducto || detalle.producto?.nombre
                  }`,
                },
              })),
            }));

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
          // Si es una nueva venta, la agregamos a la lista y mostramos notificación
          if (mensaje.data) {
            const nuevaVenta = {
              id: mensaje.data.id,
              tipo: "Venta",
              numero: mensaje.data.nroVenta,
              monto: mensaje.data.total,
              monto_pagado: mensaje.data.totalPagado,
              resto_pendiente: mensaje.data.restoPendiente,
              metodo_pago: mensaje.data.estadoPago === 1 ? null : "EFECTIVO",
              estado: mensaje.data.estadoPago,
              fechaCreacion: mensaje.data.fechaCreacion,
              negocio: {
                id: mensaje.data.negocio?.id || mensaje.data.negocioId,
                nombre:
                  mensaje.data.negocio?.nombre ||
                  `Negocio #${mensaje.data.negocioId}`,
              },
              detalles: mensaje.data.detalles.map((detalle) => ({
                id: detalle.id,
                cantidad: detalle.cantidad,
                precio: detalle.precio,
                subTotal: detalle.subTotal,
                producto: {
                  id: detalle.productoId,
                  nombre: `${
                    detalle.nombreProducto || detalle.producto?.nombre
                  }`,
                },
              })),
            };

            // Añadir la nueva venta a la lista
            setEntregas((prevEntregas) => [nuevaVenta, ...prevEntregas]);

            // Aplicar el filtro actual a las entregas actualizadas
            const updatedEntregas = [nuevaVenta, ...entregas];
            applyFilter(estadoFiltro, updatedEntregas);

            // Marcar la venta como nueva
            setNewVentasIds((prevIds) => [...prevIds, nuevaVenta.id]);

            // Mostrar notificación
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

  const verDetalleMetodos = async (cierreId) => {
    const data = await api(
      `api/cierre-caja/${cierreId}/detalle-metodos`,
      "GET"
    );
    setDetalleMetodos(data);
    setMostrarDetalleId(cierreId);
  };

  const getMetodosPagoPorCaja = (cajaId) => {
    // Debes tener los totales de entregas por método de pago en tu estado o calcularlos aquí
    const encontrado = totalesEntregas.find((t) => t.cajaId === cajaId);
    return encontrado?.metodosPago || [];
  };

  const handleAbrirCierreCaja = async () => {
    setCierreLoading(true);
    const cajaId = sessionStorage.getItem("cajaId");
    try {
      // Trae info de la caja y el total entregado del día
      const [caja, totales] = await Promise.all([
        api(`api/caja/${cajaId}`, "GET"),
        api("api/entregas/totales-dia-caja", "GET"),
      ]);
      const totalSistema =
        totales.find((t) => t.cajaId === Number(cajaId))?.totalEntregado || 0;
      setCajaInfo({
        ...caja,
        totalSistema,
      });
      setTotalesEntregas(totales); // <--- AGREGA ESTA LÍNEA
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
    setCierreLoading(true);

    const metodosPago = getMetodosPagoPorCaja(cajaInfo.id) || [];

    const totalEfectivo = metodosPago
      .filter((m) => m.nombre.toLowerCase() === "efectivo")
      .reduce((acc, m) => acc + (m.total || 0), 0); 

    const payload = {
      cajaId: cajaInfo.id,
      totalVentas: cajaInfo.totalSistema,
      totalEfectivo: totalEfectivo,
      totalPagado: cajaInfo.totalSistema,
      ingresoLimpio: 0,
      estado: 0,
      metodosPago: metodosPago.map((m) => ({
        nombre: m.nombre,
        total: m.total,
      })),
    };

    // Mostramos los datos por consola antes de enviarlos
    console.log("Datos para cierre:", payload);

    try {
      await api("api/cierre-caja", "POST", payload);

      setCierreNotification({
        type: "success",
        message: "Cierre realizado correctamente",
      });

      setModalCierreVisible(false);

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
    }

    setCierreLoading(false);
  };

  // Efecto para aplicar el filtro cuando cambia el estado del filtro o las entregas
  useEffect(() => {
    applyFilter(estadoFiltro);
  }, [estadoFiltro, entregas]);

  // EntregaCuentaCorriente
  const handleEntregarCuentaCorriente = (entrega) => {
    setEntregaAEntregar(entrega);
    setConfirmEntregaVisible(true);
  };

  // Confirmar entrega

  const handleConfirmEntregar = async () => {
    if (!entregaAEntregar) return;
    const updatedEntregas = entregas.map((item) =>
      item.id === entregaAEntregar.id ? { ...item, estado: 6 } : item
    );
    const paymentData = {
      venta_id: entregaAEntregar.id,
      estado: 6, // Estado 6 para entregada
    };
    setEntregas(updatedEntregas);
    setConfirmEntregaVisible(false);
    setEntregaAEntregar(null);
    //entregas/cambiarEstado
    const response = await api(
      `api/entregas/cambiarEstado?venta_id=${
        entregaAEntregar.id
      }&estado=6&caja_id=${sessionStorage.getItem("cajaId")}`,
      "POST"
    );

    console.log(response);
    notification.success({
      message: "Pedido entregado",
      description: "El pedido fue marcado como entregado.",
    });
  };

  // Cancelar entrega

  const handleCancelEntregar = () => {
    setConfirmEntregaVisible(false);
    setEntregaAEntregar(null);
  };

  // Ver detalles de la entrega

  const handleViewDetails = (entrega) => {
    setSelectedEntrega(entrega);
    setDetailsModalVisible(true);
  };

  // Cerrar modal de detalles
  const handleCloseDetailsModal = () => {
    setDetailsModalVisible(false);
    setSelectedEntrega(null);
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

      const cajaId = sessionStorage.getItem("cajaId");
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

      // Actualizar la lista de entregas
      const updatedEntregas = entregas.map((item) => {
        if (item.id === selectedEntrega.id) {
          // Calcular el monto pagado total y resto pendiente
          const montoPagado = payLater
            ? 0
            : parseFloat(paymentAmount) + (item.monto_pagado || 0);
          const restoPendiente = Math.max(0, item.monto - montoPagado);

          // Determinar el nuevo estado
          let nuevoEstado;
          if (payLater) {
            nuevoEstado = 3; // Pago otro día
          } else if (restoPendiente > 0) {
            nuevoEstado = 5; // Pago parcial
          } else {
            nuevoEstado = 2; // Cobrada completamente
          }

          return {
            ...item,
            metodo_pago: payLater ? "PENDIENTE_OTRO_DIA" : paymentMethod,
            estado: nuevoEstado,
            monto_pagado: montoPagado,
            resto_pendiente: restoPendiente,
          };
        }
        return item;
      });

      setEntregas(updatedEntregas);

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

  // Renderizado condicional basado en estado de carga
  if (loading) {
    return (
      <div className="flex justify-center items-center h-80">
        <Loading />
      </div>
    );
  }

  // Verificar si hay entregas para mostrar
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
            Entregas Pendientes
          </h1>
          <Button
            type="primary"
            onClick={handleAbrirCierreCaja}
            className="mb-4 "
          >
            Cerrar Caja
          </Button>
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
          {[...filteredEntregas]
            .sort((a, b) => {
              const fechaA = new Date(a.fechaCreacion);
              const fechaB = new Date(b.fechaCreacion);
              return orden === "desc" ? fechaB - fechaA : fechaA - fechaB;
            })
            .map((entrega) => (
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
                      {entrega.estado === 4 && (
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => handleEntregarCuentaCorriente(entrega)}
                        >
                          Entregar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
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
                  onChange={setPaymentMethod}
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
              {(getMetodosPagoPorCaja(cajaInfo.id) || []).map((m) => (
                <li
                  key={m.nombre}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span className="capitalize">{m.nombre}</span>
                  <span style={{ fontWeight: "bold" }}>
                    ${m.total.toLocaleString("es-AR")}
                  </span>
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
    </div>
  );
};

export default Entregas;
