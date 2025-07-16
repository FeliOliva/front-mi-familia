import React, { useEffect, useState } from "react";
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    Checkbox,
    InputNumber,
    Tag,
    Alert,
    message,
} from "antd";
import { DollarOutlined } from "@ant-design/icons";
import { api } from "../../services/api";

const { Option } = Select;

const metodoPagos = [
    { id: 1, nombre: "EFECTIVO" },
    { id: 2, nombre: "TRANSFERENCIA/QR" },
    { id: 3, nombre: "TARJETA DEBITO" },
    { id: 4, nombre: "TARJETA CREDITO" },
];

const EntregasEncargado = () => {
    const [ventas, setVentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
    const [payLater, setPayLater] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentError, setPaymentError] = useState("");
    const [processingPayment, setProcessingPayment] = useState(false);

    const userId = Number(sessionStorage.getItem("usuarioId"));
    const rol = Number(sessionStorage.getItem("rol"));

    // Cargar ventas al iniciar
    useEffect(() => {
        const fetchVentas = async () => {
            setLoading(true);
            try {
                const data = await api("api/ventas");
                let ventasFiltradas = data.ventas || data;

                // Si el usuario es rol 3, filtra solo sus ventas
                if (rol === 3) {
                    ventasFiltradas = ventasFiltradas.filter((v) => v.usuarioId === userId);
                }

                // Normaliza los datos para la tabla
                const ventasNormalizadas = ventasFiltradas.map((v) => ({
                    ...v,
                    negocioNombre: v.negocio?.nombre || "",
                    cajaNombre: v.caja?.nombre || "",
                }));

                setVentas(ventasNormalizadas);
            } catch (err) {
                message.error("Error al cargar ventas: " + err.message);
            } finally {
                setLoading(false);
            }
        };
        if (userId) fetchVentas();
    }, [userId, rol]);

    // WebSocket para actualizaciones en tiempo real
    useEffect(() => {
        const cajaId = sessionStorage.getItem("cajaId");
        if (!cajaId) return;

        const ws = new window.WebSocket(`ws://localhost:3001?cajaId=${cajaId}`);

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log("Mensaje recibido del WebSocket:", msg);
            if (msg.tipo === "venta-actualizada" ||
                msg.tipo === "venta-pagada" ||
                msg.tipo === "venta-aplazada" ||
                msg.tipo === "venta-pagada-parcialmente") {
                setVentas((ventasPrevias) =>
                    ventasPrevias.map((v) =>
                        v.id === msg.data.id
                            ? {
                                ...v,
                                ...msg.data,
                                negocioNombre: msg.data.negocio?.nombre ?? v.negocioNombre ?? "",
                                cajaNombre: msg.data.caja?.nombre ?? v.cajaNombre ?? "",
                                restoPendiente: msg.data.restoPendiente, // <-- agrega esto
                            }
                            : v
                    )
                );
                if (msg.tipo === "nueva-venta") {
                    // Solo agregar si corresponde al usuario actual (rol 3)
                    if (rol !== 3 || msg.data.usuarioId === userId) {
                        const nuevaVenta = {
                            ...msg.data,
                            negocioNombre: msg.data.negocio?.nombre || "",
                            cajaNombre: msg.data.caja?.nombre || "",
                        };
                        setVentas((ventasPrevias) => [...ventasPrevias, nuevaVenta]);
                    }
                }
                // Si el modal está abierto y la venta seleccionada es la actualizada, actualízala
                setVentaSeleccionada((ventaSel) =>
                    ventaSel && ventaSel.id === msg.data.id
                        ? {
                            ...ventaSel,
                            ...msg.data,
                            negocioNombre: msg.data.negocio?.nombre || "",
                            cajaNombre: msg.data.caja?.nombre || "",
                        }
                        : ventaSel
                );
            }
            // Puedes agregar más handlers para otros tipos de mensajes si lo necesitas
        };

        return () => {
            ws.close();
        };
    }, []);

    // Abrir modal de cobro
    const handleCobrar = (venta) => {
        setVentaSeleccionada(venta);
        setPayLater(false);
        setPaymentMethod("EFECTIVO");
        setPaymentAmount(venta.total - (venta.totalPagado || 0));
        setPaymentError("");
        setModalVisible(true);
    };

    // Procesar cobro
    const handleSubmitPayment = async () => {
        setProcessingPayment(true);
        setPaymentError("");
        try {
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
            const cajaId = ventaSeleccionada.cajaId;
            const negocioId = ventaSeleccionada.negocioId;
            const ventaId = ventaSeleccionada.id;
            const selectedMethodId =
                metodoPagos.find((m) => m.nombre === paymentMethod)?.id || 1;

            const paymentData = {
                monto: payLater ? 0 : parseFloat(paymentAmount),
                metodoPagoId: payLater ? null : selectedMethodId,
                cajaId,
                negocioId,
                ventaId,
                pagoOtroDia: payLater,
            };

            await api("api/entregas", "POST", JSON.stringify(paymentData));
            message.success("Entrega registrada correctamente");
            setModalVisible(false);
            setVentaSeleccionada(null);
            // No recargues ventas aquí, el WebSocket lo hará automáticamente
        } catch (error) {
            let msg = "Error al registrar la entrega";
            if (error?.response && error.response.data?.message) {
                msg = error.response.data.message;
            } else if (error?.message) {
                msg = error.message;
            }
            setPaymentError(msg);
            message.error(msg);
        } finally {
            setProcessingPayment(false);
        }
    };

    const columns = [
        { title: "Nro Venta", dataIndex: "nroVenta", key: "nroVenta" },
        { title: "Negocio", dataIndex: "negocioNombre", key: "negocioNombre" },
        { title: "Caja", dataIndex: "cajaNombre", key: "cajaNombre" },
        {
            title: "Total",
            dataIndex: "total",
            key: "total",
            render: (total) => `$${total.toLocaleString("es-AR")}`,
        },
        {
            title: "Pagado",
            dataIndex: "totalPagado",
            key: "totalPagado",
            render: (pagado) => `$${(pagado || 0).toLocaleString("es-AR")}`,
        },
        {
            title: "Estado",
            dataIndex: "estadoPago",
            key: "estadoPago",
            render: (estado) =>
                estado === 2 ? (
                    <Tag color="green">COBRADA</Tag>
                ) : estado === 3 ? (
                    <Tag color="orange">PAGO OTRO DÍA</Tag>
                ) : estado === 5 ? (
                    <Tag color="gold">PAGO PARCIAL</Tag>
                ) : (
                    <Tag color="red">PENDIENTE</Tag>
                ),
        },
        {
            title: "Acción",
            key: "accion",
            render: (_, record) => (
                <Button
                    type="primary"
                    onClick={() => handleCobrar(record)}
                    disabled={
                        record.estadoPago === 2 ||
                        record.cajaNombre?.toLowerCase() === "repartidor" ||
                        record.usuarioId !== userId // Solo puede cobrar sus propias ventas
                    }
                >
                    Cobrar
                </Button>
            ),
        },
    ];

    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="bg-white rounded-lg shadow-md mb-6">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Entregas (Ventas propias)</h2>
                </div>
                <div className="overflow-x-auto px-4 py-4">
                    <Table
                        dataSource={ventas}
                        columns={columns}
                        loading={loading}
                        rowKey="id"
                        size="small"
                        scroll={{ x: "max-content" }}
                    />
                </div>
            </div>

            {/* Modal de cobro */}
            <Modal
                title="Cobrar Venta"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={[
                    <Button key="cancelar" onClick={() => setModalVisible(false)}>
                        Cancelar
                    </Button>,
                    <Button
                        key="cobrar"
                        type="primary"
                        loading={processingPayment}
                        onClick={handleSubmitPayment}
                    >
                        {payLater ? "Guardar" : "Cobrar"}
                    </Button>,
                ]}
            >
                {paymentError && (
                    <Alert message={paymentError} type="error" showIcon className="mb-4" />
                )}
                {ventaSeleccionada && (
                    <Form layout="vertical" className="mt-4">
                        <Form.Item label="Monto total">
                            <Input
                                prefix={<DollarOutlined />}
                                readOnly
                                value={`$${ventaSeleccionada.total.toLocaleString("es-AR")}`}
                            />
                        </Form.Item>
                        <Form.Item label="Pagado">
                            <Input
                                prefix={<DollarOutlined />}
                                readOnly
                                value={`$${(ventaSeleccionada.totalPagado || 0).toLocaleString("es-AR")}`}
                            />
                        </Form.Item>
                        <Form.Item label="Monto pendiente">
                            <Input
                                prefix={<DollarOutlined />}
                                readOnly
                                value={`$${(
                                    ventaSeleccionada.total -
                                    (ventaSeleccionada.totalPagado || 0)
                                ).toLocaleString("es-AR")}`}
                                style={{ color: "#f59e0b", fontWeight: "bold" }}
                            />
                        </Form.Item>
                        <Form.Item label="Pagar otro día">
                            <Checkbox
                                checked={payLater}
                                onChange={(e) => {
                                    setPayLater(e.target.checked);
                                    if (e.target.checked) setPaymentAmount("");
                                    else
                                        setPaymentAmount(
                                            ventaSeleccionada.total -
                                            (ventaSeleccionada.totalPagado || 0)
                                        );
                                }}
                                disabled={ventaSeleccionada.estadoPago === 3}
                            >
                                Marcar para pago en otra fecha
                            </Checkbox>
                        </Form.Item>
                        {!payLater && (
                            <>
                                <Form.Item label="Método de pago">
                                    <Select
                                        value={paymentMethod}
                                        onChange={setPaymentMethod}
                                        disabled={payLater}
                                        className="w-full"
                                    >
                                        {metodoPagos.map((metodo) => (
                                            <Option key={metodo.id} value={metodo.nombre}>
                                                {metodo.nombre}
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                                <Form.Item label="Monto recibido">
                                    <InputNumber
                                        min={1}
                                        value={paymentAmount}
                                        onChange={setPaymentAmount}
                                        disabled={payLater}
                                        style={{ width: "100%" }}
                                    />
                                </Form.Item>
                            </>
                        )}
                    </Form>
                )}
            </Modal>
        </div>
    );
};

export default EntregasEncargado;