import React, { useEffect, useState, useRef } from "react";
import {
  Table,
  message,
  Modal,
  Button,
  Select,
  Input,
  Form,
  Space,
  List,
  Card,
  Badge,
  Divider,
  Avatar,
  Empty,
  Tag,
  InputNumber,
  Row,
  Col,
  Tooltip,
} from "antd";
import { api } from "../../services/api";
import {
  DeleteOutlined,
  ShoppingCartOutlined,
  SearchOutlined,
  PlusOutlined,
  MinusOutlined,
  FileTextOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { Option } = Select;

// Constantes para unidades preferidas por defecto (CAJON, BOLSA)
const UNIDADES_PREFERIDAS = ["CAJON", "BOLSA"];

const getUnidad = (prod) =>
  prod?.tipounidad?.tipo || prod?.tipoUnidad?.tipo || "UNIDAD";

const getUnidadAbbr = (u) => {
  // Manejar si u es un objeto con propiedad tipo o un string
  const unidadStr = typeof u === "object" ? (u?.tipo || "") : (u || "");
  const U = String(unidadStr).toUpperCase();
  if (U === "UNIDAD") return "UN";
  if (U === "KG") return "KG";
  if (U === "CAJON") return "CAJ";
  if (U === "BOLSA") return "BOL";
  return U || "UN";
};

const getStepByUnidad = (u) => {
  // Manejar si u es un objeto con propiedad tipo o un string
  const unidadStr = typeof u === "object" ? (u?.tipo || "") : (u || "");
  const U = String(unidadStr).toUpperCase();
  if (U === "KG") return 0.1;
  return 1;
};

// Hook para detectar móvil
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  return isMobile;
};

// Generar PDF del pedido
const generarPDF = (pedido) => {
  const detalles = Array.isArray(pedido.detallepedido) ? pedido.detallepedido : [];

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Formato fecha
  const toISODate = (v) => {
    if (!v) return "";
    const s = typeof v === "string" ? v : new Date(v).toISOString();
    return s.slice(0, 10);
  };
  const isoDate = toISODate(pedido.fechaCreacion);
  const [yyyy, mm, dd] = isoDate ? isoDate.split("-") : ["", "", ""];
  const fechaSolo = isoDate ? `${dd}/${mm}/${yyyy}` : "";

  // Encabezado centrado
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("VERDULERIA MI FAMILIA", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(12);
  doc.text("PEDIDO", pageWidth / 2, y, { align: "center" });
  y += 10;

  // Info del pedido centrada
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`N° Pedido: ${pedido.nroPedido || pedido.id}`, pageWidth / 2, y, { align: "center" });
  y += 5;
  if (fechaSolo) {
    doc.text(`Fecha: ${fechaSolo}`, pageWidth / 2, y, { align: "center" });
    y += 5;
  }
  doc.text(`Total de productos: ${detalles.length}`, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Tabla productos
  const productosData = detalles.map((d, index) => {
    const unidad = d.tipounidad?.tipo || d.tipoUnidad?.tipo || "UNIDAD";
    const cant = `${d.cantidad} ${getUnidadAbbr(unidad)}`;
    return [index + 1, d.producto?.nombre || "Producto", cant];
  });

  autoTable(doc, {
    head: [["#", "PRODUCTO", "CANTIDAD"]],
    body: productosData,
    startY: y,
    theme: "striped",
    margin: { left: 40, right: 40 },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2,
      halign: "left",
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [114, 46, 209],
      textColor: 255,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 30, halign: "center" },
    },
    alternateRowStyles: {
      fillColor: [249, 240, 255],
    },
  });

  doc.save(`pedido-${pedido.nroPedido || pedido.id}.pdf`);
};

const Pedidos = () => {
  const isMobile = useIsMobile();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Productos
  const [todosLosProductos, setTodosLosProductos] = useState([]);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [productosCargados, setProductosCargados] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Tipos de unidades
  const [tiposUnidades, setTiposUnidades] = useState([]);

  // Búsqueda
  const [productoBuscado, setProductoBuscado] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [unidadFiltro, setUnidadFiltro] = useState("preferidas"); // "preferidas", "todas", o id específico
  const [showProductList, setShowProductList] = useState(false);
  const [hasInputFocus, setHasInputFocus] = useState(false);

  // Guardar/Editar
  const [isSaving, setIsSaving] = useState(false);
  const [pedidoEditando, setPedidoEditando] = useState(null);

  // Detalle modal
  const [detalleModalVisible, setDetalleModalVisible] = useState(false);
  const [detallePedido, setDetallePedido] = useState(null);

  // Verificar si el usuario es admin (usuarioId = 1)
  const usuarioId = parseInt(sessionStorage.getItem("usuarioId"));
  const isAdminUser = usuarioId === 1;

  // Si no es admin, mostrar mensaje
  if (!isAdminUser) {
    return (
      <div className="p-4 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <CloseCircleOutlined style={{ fontSize: 48, color: "#ff4d4f" }} />
          <h2 className="text-xl font-semibold mt-4">Acceso Denegado</h2>
          <p className="text-gray-500 mt-2">
            Solo el administrador puede acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  // Cargar tipos de unidades
  const cargarTiposUnidades = async () => {
    try {
      const data = await api("api/tiposUnidades");
      // Manejar tanto array directo como objeto
      const unidadesArray = Array.isArray(data)
        ? data
        : (data?.tiposUnidades || data?.unidades || []);
      setTiposUnidades(unidadesArray);
    } catch (error) {
      console.error("Error cargando tipos de unidades:", error);
    }
  };

  // Cargar productos
  const cargarProductos = async () => {
    if (productosCargados) return;

    try {
      setLoadingProducts(true);
      const res = await api("api/getAllProducts");
      const productosRaw = res.products || [];

      const activosOrdenados = productosRaw
        .filter((p) => p.estado === 1)
        .sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
        )
        .map((p) => ({
          ...p,
          _unidad: getUnidad(p),
          _tipoUnidadId: p.tipoUnidadId || p.tipoUnidad?.id || p.tipounidad?.id,
        }));

      setTodosLosProductos(activosOrdenados);
      setProductosCargados(true);
    } catch (err) {
      message.error("Error al cargar productos: " + err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Cargar pedidos
  const fetchPedidos = async () => {
    try {
      setLoading(true);
      const data = await api("api/pedidos");
      // Manejar tanto array directo como objeto { pedidos: [...] }
      const pedidosArray = Array.isArray(data)
        ? data
        : (data?.pedidos || []);
      console.log("pedidos", pedidosArray);
      setPedidos(pedidosArray);
    } catch (error) {
      message.error("Error al obtener pedidos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
    cargarTiposUnidades();
  }, []);

  // Filtrar productos según búsqueda y unidad
  const buscarProductos = () => {
    if (!productosCargados) return;

    const termino = productoBuscado.trim().toLowerCase();

    let filtrados = [...todosLosProductos];

    // Filtrar por unidad
    if (unidadFiltro === "preferidas") {
      filtrados = filtrados.filter((p) => {
        const unidadStr = typeof p._unidad === "object"
          ? (p._unidad?.tipo || "")
          : (p._unidad || "");
        return UNIDADES_PREFERIDAS.includes(String(unidadStr).toUpperCase());
      });
    } else if (unidadFiltro !== "todas") {
      const unidadId = parseInt(unidadFiltro);
      filtrados = filtrados.filter((p) => p._tipoUnidadId === unidadId);
    }

    // Filtrar por término de búsqueda
    if (termino.length >= 2) {
      filtrados = filtrados.filter((p) =>
        p.nombre.toLowerCase().includes(termino)
      );
    }

    setProductosDisponibles(filtrados.slice(0, 50));
    setShowProductList(filtrados.length > 0);
  };

  useEffect(() => {
    if (!hasInputFocus && !showProductList) return;
    if (!productosCargados) return;

    const handler = setTimeout(() => {
      buscarProductos();
    }, 200);

    return () => clearTimeout(handler);
  }, [productoBuscado, hasInputFocus, productosCargados, unidadFiltro]);

  // Agregar producto a la lista
  const agregarProducto = (producto) => {
    if (!cantidad || cantidad <= 0) {
      message.warning("La cantidad debe ser mayor a 0");
      return;
    }

    const yaExiste = productosSeleccionados.some((p) => p.id === producto.id);
    if (yaExiste) {
      const nuevos = productosSeleccionados.map((p) =>
        p.id === producto.id
          ? { ...p, cantidad: p.cantidad + parseFloat(cantidad) }
          : p
      );
      setProductosSeleccionados(nuevos);
      message.success(`Se actualizó la cantidad de ${producto.nombre}`);
    } else {
      const unidad = producto._unidad || getUnidad(producto);
      setProductosSeleccionados([
        ...productosSeleccionados,
        {
          ...producto,
          cantidad: parseFloat(cantidad),
          tipoUnidad: unidad,
          tipoUnidadId: producto._tipoUnidadId,
          _unidad: unidad,
        },
      ]);
      message.success(`${producto.nombre} agregado al pedido`);
    }

    setProductoBuscado("");
    setCantidad(1);
    setProductosDisponibles([]);
    setShowProductList(false);
  };

  // Modificar cantidad
  const modificarCantidad = (index, incremento) => {
    const nuevos = [...productosSeleccionados];
    const nuevaCantidad = parseFloat(
      (nuevos[index].cantidad + incremento).toFixed(2)
    );

    if (nuevaCantidad <= 0) {
      eliminarProducto(index);
      return;
    }

    nuevos[index].cantidad = nuevaCantidad;
    setProductosSeleccionados(nuevos);
  };

  const actualizarCantidad = (index, nuevaCantidad) => {
    if (nuevaCantidad <= 0) {
      eliminarProducto(index);
      return;
    }

    const nuevos = [...productosSeleccionados];
    nuevos[index].cantidad = parseFloat(nuevaCantidad);
    setProductosSeleccionados(nuevos);
  };

  const eliminarProducto = (index) => {
    const nuevos = [...productosSeleccionados];
    nuevos.splice(index, 1);
    setProductosSeleccionados(nuevos);
  };

  // Guardar pedido
  const guardarPedido = async () => {
    if (productosSeleccionados.length === 0) {
      message.warning("Debe agregar al menos un producto al pedido");
      return;
    }

    setIsSaving(true);

    try {
      const detalles = productosSeleccionados.map((producto) => ({
        productoId: parseInt(producto.id),
        cantidad: producto.cantidad,
        tipoUnidadId: producto.tipoUnidadId || producto._tipoUnidadId,
      }));

      if (pedidoEditando) {
        // Editar pedido existente
        await api(`api/pedidos/${pedidoEditando.id}`, "PUT", { detalles });
        message.success("Pedido actualizado con éxito");
      } else {
        // Crear nuevo pedido
        await api("api/pedidos", "POST", { detalles });
        message.success("Pedido creado con éxito");
      }

      setModalVisible(false);
      setPedidoEditando(null);
      setProductosSeleccionados([]);
      fetchPedidos();
    } catch (err) {
      message.error("Error al guardar pedido: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Editar pedido
  const editarPedido = async (pedido) => {
    try {
      // Cargar productos si no están cargados
      if (!productosCargados) {
        await cargarProductos();
      }

      // Usar los detalles del pedido que ya tenemos o obtenerlos
      const detalles = pedido.detallepedido || [];

      const productosInfo = detalles.map((detalle) => {
        const productoBase = todosLosProductos.find(
          (p) => p.id === detalle.productoId
        );
        const unidad = detalle.tipounidad?.tipo || detalle.tipoUnidad?.tipo || getUnidad(productoBase);
        return {
          id: detalle.productoId,
          nombre: detalle.producto?.nombre || productoBase?.nombre || "Producto",
          cantidad: parseFloat(detalle.cantidad),
          tipoUnidadId: detalle.tipoUnidadId,
          tipoUnidad: unidad,
          _unidad: unidad,
          _tipoUnidadId: detalle.tipoUnidadId,
        };
      });

      setProductosSeleccionados(productosInfo);
      setPedidoEditando(pedido);
      setModalVisible(true);
    } catch (error) {
      message.error("Error al cargar datos del pedido: " + error.message);
    }
  };

  // Eliminar pedido
  const eliminarPedido = async (id) => {
    try {
      await api(`api/pedidos/${id}`, "DELETE");
      message.success("Pedido eliminado correctamente");
      fetchPedidos();
    } catch (error) {
      message.error("Error al eliminar el pedido: " + error.message);
    }
  };

  // Ver detalle
  const handleVerDetalle = (pedido) => {
    setDetallePedido(pedido);
    setDetalleModalVisible(true);
  };

  // Columnas de la tabla
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 60,
    },
    {
      title: "Nro. Pedido",
      dataIndex: "nroPedido",
      key: "nroPedido",
    },
    {
      title: "Productos",
      key: "productos",
      render: (_, record) => (
        <span>{record.detallepedido?.length || 0} productos</span>
      ),
    },
    {
      title: "Fecha",
      dataIndex: "fechaCreacion",
      key: "fechaCreacion",
      render: (fecha) =>
        fecha ? dayjs(fecha).format("DD/MM/YYYY HH:mm") : "-",
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="Ver detalle">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleVerDetalle(record)}
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => editarPedido(record)}
            />
          </Tooltip>
          <Tooltip title="Generar PDF">
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              onClick={() => generarPDF(record)}
            />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: "¿Eliminar pedido?",
                  content: "Esta acción eliminará el pedido permanentemente.",
                  okText: "Sí, eliminar",
                  okType: "danger",
                  cancelText: "No",
                  onOk: () => eliminarPedido(record.id),
                });
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Renderizar item de producto en búsqueda
  const renderProductItem = (item) => (
    <List.Item
      key={item.id}
      style={{ cursor: "pointer", padding: "8px 12px" }}
      onClick={() => agregarProducto(item)}
    >
      <List.Item.Meta
        avatar={
          <Avatar
            icon={<ShoppingCartOutlined />}
            style={{ backgroundColor: "#722ed1" }}
          />
        }
        title={item.nombre}
        description={
          <Tag color="purple">{getUnidadAbbr(item._unidad)}</Tag>
        }
      />
      <Button
        type="primary"
        size="small"
        className={isMobile ? "max-w-16" : ""}
        icon={<PlusOutlined />}
        style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
      >
        {!isMobile && "Agregar"}
      </Button>
    </List.Item>
  );

  // Renderizar item en carrito
  const renderCartItem = (item, index) => (
    <List.Item key={`${item.id}-${index}`} style={{ padding: "12px" }}>
      <div style={{ width: "100%" }}>
        <div
          style={{
            fontWeight: "bold",
            marginBottom: "6px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ wordBreak: "break-word" }}>{item.nombre}</div>
          <Button
            danger
            size="small"
            onClick={() => eliminarProducto(index)}
            icon={<DeleteOutlined />}
          >
            Eliminar
          </Button>
        </div>

        <div
          style={{
            color: "#666",
            marginBottom: "6px",
          }}
        >
          <Tag color="purple">
            {getUnidadAbbr(item.tipoUnidad || item._unidad || "UNIDAD")}
          </Tag>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <Button
              size="small"
              icon={<MinusOutlined />}
              onClick={() =>
                modificarCantidad(
                  index,
                  -getStepByUnidad(item._unidad || item.tipoUnidad)
                )
              }
            />
            <InputNumber
              min={getStepByUnidad(item._unidad || item.tipoUnidad || "UNIDAD")}
              step={getStepByUnidad(item._unidad || item.tipoUnidad || "UNIDAD")}
              precision={
                String(
                  typeof (item._unidad || item.tipoUnidad) === "object"
                    ? (item._unidad?.tipo || item.tipoUnidad?.tipo || "UNIDAD")
                    : (item._unidad || item.tipoUnidad || "UNIDAD")
                ).toUpperCase() === "KG"
                  ? 2
                  : 0
              }
              value={item.cantidad}
              onChange={(value) => actualizarCantidad(index, value)}
              size={isMobile ? "middle" : "large"}
              style={{ width: "80px", margin: "0 4px" }}
            />
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() =>
                modificarCantidad(
                  index,
                  getStepByUnidad(item._unidad || item.tipoUnidad)
                )
              }
            />
          </div>
        </div>
      </div>
    </List.Item>
  );

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header con botón de nuevo pedido */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">
            <FileTextOutlined style={{ marginRight: 8 }} />
            Pedidos
          </h2>
          <Button
            type="primary"
            onClick={() => {
              setPedidoEditando(null);
              setProductosSeleccionados([]);
              setModalVisible(true);
              cargarProductos();
            }}
            icon={<PlusOutlined />}
            style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
          >
            Nuevo Pedido
          </Button>
        </div>
      </div>

      {/* Tabla de pedidos */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Listado de Pedidos
          </h2>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <Table
            dataSource={pedidos}
            columns={columns}
            loading={loading}
            rowKey="id"
            pagination={{
              pageSize: 10,
              responsive: true,
              position: ["bottomCenter"],
              size: "small",
            }}
            size="small"
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>

      {/* Modal de nuevo/editar pedido */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center" }}>
            <FileTextOutlined
              style={{ fontSize: 20, marginRight: 8, color: "#722ed1" }}
            />
            <span>{pedidoEditando ? "Editar Pedido" : "Nuevo Pedido"}</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setPedidoEditando(null);
          setProductosSeleccionados([]);
        }}
        footer={[
          <Button key="cancelar" onClick={() => setModalVisible(false)}>
            Cancelar
          </Button>,
          <Button
            key="guardar"
            type="primary"
            onClick={guardarPedido}
            loading={isSaving}
            icon={<CheckCircleOutlined />}
            style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
          >
            {pedidoEditando ? "Actualizar" : "Guardar Pedido"}
          </Button>,
        ]}
        width={isMobile ? "95%" : "800px"}
        style={{ maxWidth: "800px", top: isMobile ? 20 : 100 }}
        styles={{
          body: {
            padding: "12px",
            maxHeight: isMobile ? "80vh" : "auto",
            overflowY: "auto",
          },
        }}
      >
        <Form layout="vertical">
          {/* Sección de búsqueda de productos */}
          <div
            style={{
              background: "#f9f0ff",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "12px",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: "12px",
                fontSize: isMobile ? 16 : 18,
                display: "flex",
                alignItems: "center",
                color: "#722ed1",
              }}
            >
              <ShoppingCartOutlined style={{ marginRight: 8 }} />
              Agregar Productos
            </h3>

            <Form.Item
              label="Filtrar por tipo de unidad"
              style={{ marginBottom: 12 }}
            >
              <Select
                value={unidadFiltro}
                onChange={(val) => {
                  setUnidadFiltro(val);
                  if (productosCargados) {
                    setTimeout(buscarProductos, 100);
                  }
                }}
                style={{ width: "100%" }}
              >
                <Option value="preferidas">
                  Preferidas (Cajón, Bolsa)
                </Option>
                <Option value="todas">Todas las unidades</Option>
                {tiposUnidades.map((u) => (
                  <Option key={u.id} value={u.id.toString()}>
                    {u.tipo}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Buscar y Agregar Productos"
              style={{ marginBottom: 8 }}
            >
              <Row gutter={[8, 8]}>
                <Col span={isMobile ? 24 : 16}>
                  <Input
                    placeholder="Buscar producto (mínimo 2 letras)"
                    value={productoBuscado}
                    onChange={(e) => setProductoBuscado(e.target.value)}
                    onFocus={async () => {
                      setHasInputFocus(true);
                      await cargarProductos();
                      buscarProductos();
                    }}
                    prefix={<SearchOutlined style={{ color: "#722ed1" }} />}
                    style={{ width: "100%" }}
                    size={isMobile ? "middle" : "large"}
                    allowClear
                  />
                </Col>
                <Col span={isMobile ? 12 : 4}>
                  <InputNumber
                    min={0.1}
                    step={0.1}
                    precision={2}
                    value={cantidad}
                    onChange={(value) => setCantidad(value)}
                    addonBefore="Cant."
                    style={{ width: "100%" }}
                    size={isMobile ? "middle" : "large"}
                  />
                </Col>
                <Col span={isMobile ? 12 : 4}>
                  <Button
                    style={{ width: "100%" }}
                    onClick={() => {
                      setProductoBuscado("");
                      cargarProductos().then(() => {
                        buscarProductos();
                        setShowProductList(true);
                      });
                    }}
                  >
                    Ver todos
                  </Button>
                </Col>
              </Row>

              {showProductList && (
                <Card
                  size="small"
                  style={{
                    marginTop: 8,
                    maxHeight: 200,
                    overflow: "auto",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                  styles={{ body: { padding: 0 } }}
                >
                  <List
                    dataSource={productosDisponibles}
                    renderItem={renderProductItem}
                    loading={loadingProducts}
                    locale={{
                      emptyText: (
                        <Empty description="No se encontraron productos con este filtro" />
                      ),
                    }}
                    size="small"
                  />
                </Card>
              )}
            </Form.Item>
          </div>

          {/* Sección de productos seleccionados */}
          <div
            style={{
              background: "#f7f7f7",
              padding: "12px",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: isMobile ? 16 : 18,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <FileTextOutlined style={{ marginRight: 8 }} />
                Lista del Pedido
              </h3>
              <Badge
                count={productosSeleccionados.length}
                style={{
                  backgroundColor: productosSeleccionados.length
                    ? "#722ed1"
                    : "#d9d9d9",
                }}
              />
            </div>

            {productosSeleccionados.length > 0 ? (
              <Card
                size="small"
                style={{
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  maxHeight: isMobile ? 250 : 300,
                  overflow: "auto",
                }}
                styles={{ body: { padding: 0 } }}
              >
                <List
                  dataSource={productosSeleccionados}
                  renderItem={renderCartItem}
                  size="small"
                />
              </Card>
            ) : (
              <Empty
                description="No hay productos en el pedido"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}

            {productosSeleccionados.length > 0 && (
              <>
                <Divider style={{ margin: "12px 0 8px 0" }} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    background: "#f9f0ff",
                    padding: "10px",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      color: "#722ed1",
                    }}
                  >
                    Total: {productosSeleccionados.length} productos
                  </div>
                </div>
              </>
            )}
          </div>
        </Form>
      </Modal>

      {/* Modal de detalle */}
      <Modal
        title="Detalle del Pedido"
        open={detalleModalVisible}
        onCancel={() => setDetalleModalVisible(false)}
        footer={[
          <Button key="pdf" icon={<FilePdfOutlined />} onClick={() => detallePedido && generarPDF(detallePedido)}>
            Generar PDF
          </Button>,
          <Button key="cerrar" type="primary" onClick={() => setDetalleModalVisible(false)}>
            Cerrar
          </Button>,
        ]}
        width={isMobile ? "95%" : 600}
      >
{detallePedido && (
          <div className="text-sm">
            <p>
              <strong>Nro. Pedido:</strong> {detallePedido.nroPedido || detallePedido.id}
            </p>
            <p>
              <strong>Fecha:</strong>{" "}
              {detallePedido.fechaCreacion
                ? dayjs(detallePedido.fechaCreacion).format("DD/MM/YYYY HH:mm")
                : "-"}
            </p>

            <Divider />

            <p>
              <strong>Productos:</strong>
            </p>
            <List
              size="small"
              bordered
              dataSource={detallePedido.detallepedido || []}
              renderItem={(d) => (
                <List.Item>
                  <span style={{ fontWeight: 500 }}>
                    {d.producto?.nombre || "Producto"}
                  </span>
                  <span style={{ marginLeft: "auto" }}>
                    {d.cantidad}{" "}
                    <Tag color="purple">
                      {getUnidadAbbr(d.tipounidad?.tipo || d.tipoUnidad?.tipo || "UNIDAD")}
                    </Tag>
                  </span>
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Pedidos;

