import React, { useEffect, useState } from "react";
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
  Drawer,
  Card,
  Badge,
  Divider,
  Avatar,
  Empty,
  Tag,
  InputNumber,
  Row,
  Col,
  Checkbox,
} from "antd";
import { api } from "../../services/api";
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ShoppingCartOutlined,
  SearchOutlined,
  PlusOutlined,
  MinusOutlined,
  ShopOutlined,
  PrinterOutlined,
  BankOutlined,
  SolutionOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const { Option } = Select;

// Hook personalizado para detectar si la pantalla es móvil
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

const generarPDF = async (record) => {
  try {
    const venta = await api(`api/ventas/${record.id}`);

    const detalleHTML = document.createElement("div");
    detalleHTML.style.padding = "20px";
    detalleHTML.style.fontSize = "30px";
    detalleHTML.innerHTML = `
      <h2>Detalle de Venta</h2>
      <p><strong>Nro Venta:</strong> ${venta.nroVenta}</p>
      <p><strong>Negocio:</strong> ${record.negocioNombre}</p>
      <p><strong>Caja:</strong> ${record.cajaNombre || "No especificada"}</p>
      <p><strong>Total:</strong> $${venta.total.toLocaleString("es-AR")}</p>
      <p><strong>Fecha:</strong> ${dayjs(venta.fechaCreacion).format(
      "DD/MM/YYYY"
    )}</p>
      <p><strong>Productos:</strong></p>
      <ul>
        ${venta.detalles
        .map(
          (d) =>
            `<li>${d.producto?.nombre || "Producto"} - ${d.cantidad
            } u. x $${d.precio.toLocaleString("es-AR")} = $${(
              d.precio * d.cantidad
            ).toLocaleString("es-AR")}</li>`
        )
        .join("")}
      </ul>
    `;

    document.body.appendChild(detalleHTML);

    const canvas = await html2canvas(detalleHTML, {
      scale: 2, // Mejorar calidad de la imagen
      width: 800, // Ancho máximo
      height: 1200, // Alto máximo
    });

    const imgData = canvas.toDataURL("image/png");

    // Crear el PDF con el tamaño A4
    const pdf = new jsPDF("p", "pt", "a4");

    // Ajustar imagen al tamaño A4
    const pdfWidth = 595.28; // Ancho A4 en puntos
    const pdfHeight = 841.89; // Alto A4 en puntos

    const imgProps = pdf.getImageProperties(imgData);
    const aspectRatio = imgProps.width / imgProps.height;

    // Escalar la imagen para ajustarse a la página A4
    let scaledWidth = pdfWidth;
    let scaledHeight = pdfWidth / aspectRatio;

    // Si la altura escalada excede el tamaño A4, ajustamos la altura
    if (scaledHeight > pdfHeight) {
      scaledHeight = pdfHeight;
      scaledWidth = pdfHeight * aspectRatio;
    }

    // Calcular la posición para centrar la imagen
    const marginX = (pdfWidth - scaledWidth) / 2;
    const marginY = (pdfHeight - scaledHeight) / 2;

    // Agregar la imagen centrada
    pdf.addImage(imgData, "PNG", marginX, marginY, scaledWidth, scaledHeight);

    // Guardar el PDF
    pdf.save(`venta-${venta.nroVenta}.pdf`);

    document.body.removeChild(detalleHTML);
  } catch (error) {
    message.error("Error al generar el PDF: " + error.message);
  }
};

const Ventas = () => {
  const isMobile = useIsMobile();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [negocios, setNegocios] = useState([]);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [selectedNegocio, setSelectedNegocio] = useState(null);
  const [productoBuscado, setProductoBuscado] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [ventaEditando, setVentaEditando] = useState(null);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(8);
  const [totalVentas, setTotalVentas] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Para la caja
  const [cajas, setCajas] = useState([]);
  const [selectedCaja, setSelectedCaja] = useState(null);
  const [loadingCajas, setLoadingCajas] = useState(false);
  const [filtroCaja, setFiltroCaja] = useState("todas");

  // Estados para mostrar detalles de venta
  const [detalleModalVisible, setDetalleModalVisible] = useState(false);
  const [detalleVenta, setDetalleVenta] = useState(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState(null);

  // Estado para controlar si mostrar la lista de productos
  const [showProductList, setShowProductList] = useState(false);

  // Cargar negocios
  const cargarNegocios = async () => {
    try {
      const response = await api("api/getAllNegocios");
      setNegocios(response.negocios || []);
      console.log("negocios", response.negocios);
    } catch (error) {
      message.error("Error al cargar negocios: " + error.message);
    }
  };

  // Cargar cajas
  const cargarCajas = async () => {
    try {
      setLoadingCajas(true);
      const response = await api("api/caja");
      setCajas(response);
      console.log("cajas", response);

      // Si hay una caja guardada en sessionStorage, seleccionarla
      const cajaGuardada = sessionStorage.getItem("cajaId");
      if (cajaGuardada) {
        setSelectedCaja(parseInt(cajaGuardada));
      } else if (response.cajas && response.cajas.length > 0) {
        // Si no hay caja guardada pero hay cajas disponibles, seleccionar la primera
        setSelectedCaja(response.cajas[0]?.id);
      }
    } catch (error) {
      message.error("Error al cargar cajas: " + error.message);
    } finally {
      setLoadingCajas(false);
    }
  };

  const fetchVentas = async (page = 1) => {
    try {
      setLoading(true);
      const { ventas, total } = await api(
        `api/ventas?page=${page}&limit=${pageSize}`
      );
      console.log("ventas ", ventas);

      // Cargar la información de los negocios y cajas para todas las ventas
      const ventasConInfo = await Promise.all(
        ventas.map(async (venta) => {
          try {
            // Obtener información del negocio para cada venta
            const negociosData = await api("api/getAllNegocios");
            const negocio = negociosData.negocios.find(
              (n) => n.id === venta.negocioId
            );

            // Obtener información de la caja para cada venta
            const cajasData = await api("api/caja");
            const caja = (cajasData.cajas || cajasData)?.find(
              (c) => c.id === venta.cajaId
            );
            return {
              ...venta,
              negocioNombre: negocio ? negocio.nombre : "Desconocido",
              cajaNombre: caja ? caja.nombre : "No especificada",
            };
          } catch (error) {
            return {
              ...venta,
              negocioNombre: "Desconocido",
              cajaNombre: "No especificada",
            };
          }
        })
      );

      setVentas(ventasConInfo);
      setTotalVentas(total || ventas.length);
      setCurrentPage(page);
    } catch (error) {
      message.error("Error al obtener ventas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentas(currentPage);
    cargarNegocios();
    cargarCajas();
  }, [currentPage]);

  const buscarProductos = async () => {
    try {
      setLoadingProducts(true);
      const res = await api("api/getAllProducts");
      const productos = res.products || [];
      // Filtrar en el frontend por coincidencia de nombre
      const filtrados = productos.filter(
        (producto) =>
          producto.estado === 1 &&
          producto.nombre.toLowerCase().includes(productoBuscado.toLowerCase())
      );

      setProductosDisponibles(filtrados);
      setShowProductList(filtrados.length > 0);
    } catch (err) {
      message.error("Error al buscar productos: " + err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (productoBuscado.trim().length >= 2) {
      buscarProductos();
    } else {
      setProductosDisponibles([]);
      setShowProductList(false);
    }
  }, [productoBuscado]);

  const agregarProducto = (producto) => {
    if (!cantidad || cantidad <= 0) {
      message.warning("La cantidad debe ser mayor a 0");
      return;
    }

    const yaExiste = productosSeleccionados.some((p) => p.id === producto.id);
    if (yaExiste) {
      // Actualizar la cantidad si ya existe
      const nuevos = productosSeleccionados.map((p) =>
        p.id === producto.id
          ? { ...p, cantidad: p.cantidad + parseInt(cantidad) }
          : p
      );
      setProductosSeleccionados(nuevos);
      message.success(`Se actualizó la cantidad de ${producto.nombre}`);
    } else {
      setProductosSeleccionados([
        ...productosSeleccionados,
        {
          ...producto,
          cantidad: parseInt(cantidad),
          tipoUnidad: producto.tipoUnidad?.tipo || "Unidad",
        },
      ]);
      message.success(`${producto.nombre} agregado al carrito`);
    }

    setProductoBuscado("");
    setCantidad(1);
    setUnidadSeleccionada("");
    setProductosDisponibles([]);
    setShowProductList(false);
  };

  const modificarCantidad = (index, incremento) => {
    const nuevos = [...productosSeleccionados];
    const nuevaCantidad = nuevos[index].cantidad + incremento;

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
    nuevos[index].cantidad = nuevaCantidad;
    setProductosSeleccionados(nuevos);
  };

  const eliminarProducto = (index) => {
    const nuevos = [...productosSeleccionados];
    nuevos.splice(index, 1);
    setProductosSeleccionados(nuevos);
  };

  const total = productosSeleccionados.reduce(
    (acc, p) => acc + p.precio * p.cantidad,
    0
  );

  const generarNumeroVentaAleatorio = () => {
    const numeroAleatorio = Math.floor(10000 + Math.random() * 90000);
    return `V${numeroAleatorio}`;
  };

  const guardarVenta = async () => {
    if (
      !selectedNegocio ||
      !selectedCaja ||
      productosSeleccionados.length === 0
    ) {
      message.warning(
        "Debe completar todos los campos (negocio, caja y productos)"
      );
      return;
    }

    setIsSaving(true);

    try {
      const nroVenta = ventaEditando
        ? ventaEditando.nroVenta
        : generarNumeroVentaAleatorio();

      const detalles = productosSeleccionados.map((producto) => ({
        precio: producto.precio,
        cantidad: producto.cantidad,
        productoId: parseInt(producto.id),
      }));

      const usuarioId = parseInt(sessionStorage.getItem("usuarioId"));

      const rolUsuario = parseInt(sessionStorage.getItem("rol") || "0");

      const ventaData = {
        id: ventaEditando?.id,
        nroVenta,
        negocioId: parseInt(selectedNegocio),
        cajaId: parseInt(selectedCaja),
        rol_usuario: rolUsuario,
        usuarioId,
        detalles,
      };

      // Guardar la caja seleccionada en sessionStorage
      sessionStorage.setItem("cajaId", selectedCaja.toString());

      await api("api/ventas", "POST", ventaData);

      message.success(
        ventaEditando ? "Venta editada con éxito" : "Venta guardada con éxito"
      );

      setModalVisible(false);
      setVentaEditando(null);
      setProductosSeleccionados([]);
      setSelectedNegocio(null);

      fetchVentas(currentPage); // Recargar ventas
    } catch (err) {
      message.error("Error al guardar venta: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const editarVenta = async (venta) => {
    try {
      // Cargar negocios y cajas si aún no se han cargado
      if (negocios.length === 0) {
        await cargarNegocios();
      }
      if (cajas.length === 0) {
        await cargarCajas();
      }

      setSelectedNegocio(venta.negocioId);
      setSelectedCaja(venta.cajaId || null);

      // 1. Obtener detalles de productos
      const detalles = venta.detalles || [];

      // 2. Pedir la info de cada producto por su id
      const productosInfo = await Promise.all(
        detalles.map(async (detalle) => {
          const producto = await api(`api/products/${detalle.productoId}`);
          return {
            ...producto,
            cantidad: detalle.cantidad,
            precio: detalle.precio,
          };
        })
      );

      // 3. Setear productos seleccionados
      setProductosSeleccionados(productosInfo);

      // Guardar la venta que se está editando
      setVentaEditando(venta);
      setModalVisible(true);
    } catch (error) {
      message.error("Error al cargar los datos de la venta: " + error.message);
    }
  };

  const eliminarVenta = async (id, cajaId) => {
    console.log("eliminarVenta", id, cajaId);
    try {
      await api(`api/ventas/${id}?cajaId=${cajaId}`, "DELETE");
      message.success("Venta eliminada correctamente");
      setVentas((prev) => prev.filter((venta) => venta.id !== id));
    } catch (error) {
      message.error("Error al eliminar la venta: " + error.message);
    }
  };

  // Ver detalle de venta
  const handleVerDetalle = async (record) => {
    try {
      const venta = await api(`api/ventas/${record.id}`);

      setDetalleVenta(venta);
      setModalTitle("Detalle de Venta");
      setModalContent(
        <div className="text-sm">
          <p>
            <strong>Nro Venta:</strong> {venta.nroVenta}
          </p>
          <p>
            <strong>Negocio:</strong> {record.negocioNombre}
          </p>
          <p>
            <strong>Caja:</strong> {record.cajaNombre || "No especificada"}
          </p>
          <p>
            <strong>Total:</strong> ${venta.total.toLocaleString("es-AR")}
          </p>
          <p>
            <strong>Fecha:</strong>{" "}
            {dayjs(venta.fechaCreacion).format("DD/MM/YYYY")}
          </p>
          <p>
            <strong>Productos:</strong>
          </p>
          <ul className="list-disc pl-5">
            {venta.detalles.map((d) => (
              <li key={d.id} className="mb-1">
                {d.producto?.nombre || "Producto"} - {d.cantidad} u. x $
                {d.precio.toLocaleString("es-AR")} = $
                {(d.precio * d.cantidad).toLocaleString("es-AR")}
              </li>
            ))}
          </ul>
        </div>
      );

      setDetalleModalVisible(true);
    } catch (error) {
      message.error(
        "Error al cargar los detalles de la venta: " + error.message
      );
    }
  };

  const columns = [
    {
      title: "Nro. Venta",
      dataIndex: "nroVenta",
      key: "nroVenta",
    },
    {
      title: "Negocio",
      dataIndex: "negocioNombre",
      key: "negocioNombre",
      responsive: ["sm"],
    },
    {
      title: "Caja",
      dataIndex: "cajaNombre",
      key: "cajaNombre",
      responsive: ["md"],
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (total) => `$${total.toLocaleString("es-AR")}`,
    },
    {
      title: "Fecha",
      dataIndex: "fechaCreacion",
      key: "fechaCreacion",
      responsive: ["md"],
      render: (fecha) => dayjs(fecha).format("DD/MM/YYYY"),
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (text, record) => (
        <Space size="small">
          <Button
            size={isMobile ? "small" : "middle"}
            icon={<EyeOutlined />}
            onClick={() => handleVerDetalle(record)}
          >
            {!isMobile && "Ver"}
          </Button>
          <Button
            size={isMobile ? "small" : "middle"}
            icon={<EditOutlined />}
            onClick={() => editarVenta(record)}
          >
            {!isMobile && "Editar"}
          </Button>
          <Button
            size={isMobile ? "small" : "middle"}
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: "¿Estás seguro?",
                content: "Esta acción eliminará la venta permanentemente.",
                okText: "Sí, eliminar",
                okType: "danger",
                cancelText: "Cancelar",
                onOk: () => eliminarVenta(record.id, record.cajaId),
              });
            }}
          >
            {!isMobile && "Eliminar"}
          </Button>
          <Button
            size={isMobile ? "small" : "middle"}
            icon={<PrinterOutlined />}
            onClick={() => generarPDF(record)}
          >
            {!isMobile && "Imprimir"}
          </Button>
        </Space>
      ),
    },
  ];

  // Renderizado de cada producto en la lista de búsqueda
  const renderProductItem = (item) => (
    <List.Item
      key={item.id}
      style={{ cursor: "pointer", padding: "8px 12px" }}
      onClick={() => {
        setUnidadSeleccionada(item.tipoUnidad?.tipo || "Unidad");
        agregarProducto(item);
      }}
    >
      <List.Item.Meta
        avatar={
          <Avatar
            icon={<ShoppingCartOutlined />}
            style={{ backgroundColor: "#1890ff" }}
          />
        }
        title={item.nombre}
        description={
          <Space>
            <Tag color="blue">{item.tipoUnidad?.tipo || "Unidad"}</Tag>
            <Tag color="green">${item.precio.toLocaleString("es-AR")}</Tag>
          </Space>
        }
      />
      <Button type="primary" size="small" icon={<PlusOutlined />}>
        Agregar
      </Button>
    </List.Item>
  );

  // Renderizado de cada producto en el carrito
  const renderCartItem = (item, index) => (
    <List.Item key={item.id} style={{ padding: "12px" }}>
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

        <div style={{ color: "#666", marginBottom: "6px" }}>
          {item.tipoUnidad || "Unidad"} - ${item.precio.toLocaleString("es-AR")}{" "}
          c/u
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
              onClick={() => modificarCantidad(index, -1)}
            />
            <InputNumber
              min={1}
              value={item.cantidad}
              onChange={(value) => actualizarCantidad(index, value)}
              size="small"
              style={{ width: "60px", margin: "0 4px" }}
            />
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => modificarCantidad(index, 1)}
            />
          </div>
          <div style={{ fontWeight: "bold", color: "#1890ff" }}>
            ${(item.precio * item.cantidad).toLocaleString("es-AR")}
          </div>
        </div>
      </div>
    </List.Item>
  );

  const ventasFiltradas =
    filtroCaja === "todas"
      ? ventas
      : ventas.filter((venta) => String(venta.cajaId) === String(filtroCaja));

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Tarjeta de acciones y filtros */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">Ventas</h2>
          <Button
            type="primary"
            onClick={() => setModalVisible(true)}
            icon={<PlusOutlined />}
          >
            Registrar Venta
          </Button>
        </div>
        <div className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-2">
          <span>Filtrar por caja:</span>
          <Select
            value={filtroCaja}
            onChange={setFiltroCaja}
            style={{ width: 200 }}
            allowClear={false}
          >
            <Option value="todas">Todas las cajas</Option>
            {cajas.map((caja) => (
              <Option key={caja.id} value={caja.id}>
                {caja.nombre}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Listado de Ventas</h2>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <Table
            dataSource={ventasFiltradas}
            columns={columns}
            loading={loading}
            rowKey="id"
            style={{ marginTop: 20 }}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalVentas,
              onChange: (page) => setCurrentPage(page),
              position: ["bottomCenter"],
              size: isMobile ? "small" : "default",
              responsive: true,
            }}
            size="small"
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>

      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center" }}>
            <ShoppingCartOutlined
              style={{ fontSize: 20, marginRight: 8, color: "#1890ff" }}
            />
            <span>{ventaEditando ? "Editar Venta" : "Nueva Venta"}</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setVentaEditando(null);
          setProductosSeleccionados([]);
          setSelectedNegocio(null);
          // setEsVentaCuentaCorriente(false); // limpiar
        }}
        footer={[
          <Button key="cancelar" onClick={() => setModalVisible(false)}>
            Cancelar
          </Button>,
          <Button
            key="guardar"
            type="primary"
            onClick={guardarVenta}
            loading={isSaving}
            icon={<ShoppingCartOutlined />}
          >
            {ventaEditando ? "Actualizar" : "Finalizar"}
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
          <div
            style={{
              background: "#f5f5f5",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "12px",
            }}
          >
            <Row gutter={[16, 16]}>
              <Col span={isMobile ? 24 : 12}>
                <Form.Item label="Negocio" style={{ marginBottom: 0 }}>
                  <Select
                    showSearch
                    placeholder="Buscar y seleccionar negocio"
                    value={selectedNegocio}
                    onChange={(val) => setSelectedNegocio(val)}
                    disabled={!negocios.length}
                    style={{ width: "100%" }}
                    size={isMobile ? "middle" : "large"}
                    suffixIcon={<ShopOutlined />}
                    optionFilterProp="label"
                    filterOption={(input, option) =>
                      option?.label?.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {negocios
                      .filter((negocio) => negocio.estado === 1)
                      .map((negocio) => (
                        <Option
                          key={negocio.id}
                          value={negocio.id}
                          label={negocio.nombre}
                        >
                          {negocio.esCuentaCorriente && (
                            <span style={{ color: "#faad14", marginRight: 6 }}>
                              <SolutionOutlined />
                            </span>
                          )}
                          {negocio.nombre}
                        </Option>
                      ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={isMobile ? 24 : 12}>
                <Form.Item label="Caja" style={{ marginBottom: 0 }}>
                  <Select
                    placeholder="Seleccionar caja"
                    value={selectedCaja}
                    onChange={(val) => {
                      setSelectedCaja(val);
                      sessionStorage.setItem("cajaId", val.toString());
                    }}
                    disabled={!cajas.length || loadingCajas}
                    style={{ width: "100%" }}
                    size={isMobile ? "middle" : "large"}
                    suffixIcon={<BankOutlined />}
                    loading={loadingCajas}
                  >
                    {cajas.map((caja) => (
                      <Option key={caja.id} value={caja.id}>
                        {caja.nombre}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Sección de Agregar Productos */}
          <div
            style={{
              background: "#f6f9ff",
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
              }}
            >
              <ShoppingCartOutlined style={{ marginRight: 8 }} />
              Agregar Productos
            </h3>

            <Form.Item
              label="Buscar y Agregar Productos"
              style={{ marginBottom: 8 }}
            >
              <Row gutter={[8, 8]}>
                <Col span={isMobile ? 16 : 18}>
                  <Input
                    placeholder="Buscar producto"
                    value={productoBuscado}
                    onChange={(e) => setProductoBuscado(e.target.value)}
                    prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
                    style={{ width: "100%" }}
                    size={isMobile ? "middle" : "large"}
                  />
                </Col>
                <Col span={isMobile ? 8 : 6}>
                  <InputNumber
                    min={1}
                    value={cantidad}
                    onChange={(value) => setCantidad(value)}
                    addonBefore="Cant."
                    style={{ width: "100%" }}
                    size={isMobile ? "middle" : "large"}
                  />
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
                        <Empty description="No se encontraron productos" />
                      ),
                    }}
                    size="small"
                  />
                </Card>
              )}
            </Form.Item>
          </div>

          {/* Sección de Carrito de Productos */}
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
                <ShoppingCartOutlined style={{ marginRight: 8 }} />
                Carrito de Productos
              </h3>
              <Badge
                count={productosSeleccionados.length}
                style={{
                  backgroundColor: productosSeleccionados.length
                    ? "#1890ff"
                    : "#d9d9d9",
                }}
              />
            </div>

            {productosSeleccionados.length > 0 ? (
              <>
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

                <Divider style={{ margin: "12px 0 8px 0" }} />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    background: "#e6f7ff",
                    padding: "10px",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      color: "#1890ff",
                    }}
                  >
                    Total: ${total.toLocaleString("es-AR")}
                  </div>
                </div>
              </>
            ) : (
              <Empty
                description="No hay productos en el carrito"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </Form>
      </Modal>

      {!isMobile ? (
        <Modal
          open={detalleModalVisible}
          onCancel={() => setDetalleModalVisible(false)}
          footer={null}
          title={modalTitle}
          width={600}
        >
          {modalContent}
        </Modal>
      ) : (
        <Drawer
          open={detalleModalVisible}
          onClose={() => setDetalleModalVisible(false)}
          title={modalTitle}
          placement="bottom"
          height="70%"
        >
          {modalContent}
        </Drawer>
      )}
    </div>
  );
};

export default Ventas;
