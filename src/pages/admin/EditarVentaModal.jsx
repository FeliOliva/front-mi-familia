import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Drawer,
  Form,
  Input,
  InputNumber,
  Button,
  Row,
  Col,
  Card,
  List,
  Badge,
  Divider,
  Empty,
  Avatar,
  Space,
  Tag,
  message,
} from "antd";
import {
  ShoppingCartOutlined,
  SearchOutlined,
  PlusOutlined,
  MinusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";

/* ===== Helpers de unidad (mismos criterios que la pantalla de Ventas) ===== */
const getUnidad = (prod) =>
  prod?.tipounidad?.tipo || prod?.tipoUnidad?.tipo || "UNIDAD";
const getUnidadAbbr = (u) => {
  const U = (u || "").toUpperCase();
  if (U === "UNIDAD") return "UN";
  if (U === "KG") return "KG";
  if (U === "CAJON") return "CAJ";
  if (U === "BOLSA") return "BOL";
  return U || "UN";
};
const getStepByUnidad = (u) => {
  const U = (u || "").toUpperCase();
  if (U === "KG" || U === "CAJ" || U === "CAJON") return 0.1;
  return 1; // UNIDAD, BOLSA
};
const getMinByUnidad = () => 0.1;

const normalizarTexto = (texto) => {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
};

/**
 * Modal de edición de los productos/componentes de una venta.
 * Es el mismo flujo de edición de la sección Ventas, pero embebido para
 * poder usarlo desde el Resumen de cuenta sin salir de la pantalla.
 * Al guardar, el backend recalcula el total según los productos.
 */
const EditarVentaModal = ({
  open,
  ventaId,
  negocios = [],
  isMobile = false,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [venta, setVenta] = useState(null);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [observacion, setObservacion] = useState("");

  // Búsqueda de productos
  const [todosLosProductos, setTodosLosProductos] = useState([]);
  const [productoBuscado, setProductoBuscado] = useState("");
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [showProductList, setShowProductList] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const inputBuscadorRef = useRef(null);

  const negocioActual = negocios.find(
    (n) => Number(n.id) === Number(venta?.negocioId),
  );
  const negocioEsEditable = !!negocioActual?.esEditable;

  const total = productosSeleccionados.reduce(
    (acc, p) => acc + Number(p.precio || 0) * Number(p.cantidad || 0),
    0,
  );

  // Cargar la venta y el catálogo de productos al abrir
  useEffect(() => {
    if (!open || !ventaId) return;

    let cancelado = false;
    const cargar = async () => {
      setLoading(true);
      try {
        const [ventaRes, productosRes] = await Promise.all([
          api(`api/ventas/${ventaId}`),
          api("api/getAllProducts"),
        ]);
        if (cancelado) return;

        const catalogo = (productosRes.products || [])
          .filter((p) => p.estado === 1)
          .map((p) => ({ ...p, _unidad: getUnidad(p) }))
          .sort((a, b) =>
            a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
          );
        setTodosLosProductos(catalogo);

        const detalles = ventaRes.detalleventa || ventaRes.detalles || [];
        const carrito = detalles.map((d) => {
          const prod = catalogo.find((p) => p.id === d.productoId);
          const unidad = prod?._unidad || getUnidad(d.producto) || "UNIDAD";
          return {
            id: d.productoId,
            nombre: prod?.nombre || d.producto?.nombre || "Producto",
            precio: Number(d.precio) || 0,
            cantidad: Number(d.cantidad) || 0,
            tipoUnidad: unidad,
            _unidad: unidad,
          };
        });

        setVenta(ventaRes);
        setProductosSeleccionados(carrito);
        setObservacion(ventaRes.observacion || "");
      } catch (err) {
        if (!cancelado) {
          message.error(
            "Error al cargar la venta: " + (err.message || "Error desconocido"),
          );
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    cargar();
    return () => {
      cancelado = true;
    };
  }, [open, ventaId]);

  // Limpiar estado al cerrar
  const resetear = () => {
    setVenta(null);
    setProductosSeleccionados([]);
    setObservacion("");
    setProductoBuscado("");
    setProductosDisponibles([]);
    setShowProductList(false);
    setCantidad(1);
  };

  const handleCerrar = () => {
    resetear();
    onClose?.();
  };

  // Búsqueda en el catálogo (mínimo 2 letras)
  const buscarProductos = (termino) => {
    const t = normalizarTexto((termino ?? "").trim());
    if (t.length < 2) {
      setProductosDisponibles([]);
      setShowProductList(false);
      return;
    }
    const palabras = t.split(/\s+/).filter(Boolean);
    const filtrados = todosLosProductos
      .filter((p) => {
        const nombre = normalizarTexto(p.nombre);
        return palabras.every((palabra) => nombre.includes(palabra));
      })
      .slice(0, 50);
    setProductosDisponibles(filtrados);
    setShowProductList(filtrados.length > 0);
  };

  const agregarProducto = (producto) => {
    if (!cantidad || cantidad <= 0) {
      message.warning("La cantidad debe ser mayor a 0");
      return;
    }
    const yaExiste = productosSeleccionados.some((p) => p.id === producto.id);
    if (yaExiste) {
      setProductosSeleccionados((prev) =>
        prev.map((p) =>
          p.id === producto.id
            ? { ...p, cantidad: p.cantidad + parseFloat(cantidad) }
            : p,
        ),
      );
      message.success(`Se actualizó la cantidad de ${producto.nombre}`);
    } else {
      const unidad = producto._unidad || getUnidad(producto);
      setProductosSeleccionados((prev) => [
        ...prev,
        {
          id: producto.id,
          nombre: producto.nombre,
          precio: Number(producto.precio) || 0,
          cantidad: parseFloat(cantidad),
          tipoUnidad: unidad,
          _unidad: unidad,
        },
      ]);
      message.success(`${producto.nombre} agregado`);
    }
    setProductoBuscado("");
    setCantidad(1);
    setProductosDisponibles([]);
    setShowProductList(false);
    setTimeout(() => inputBuscadorRef.current?.focus(), 100);
  };

  const modificarCantidad = (index, incremento) => {
    setProductosSeleccionados((prev) => {
      const nuevos = [...prev];
      const nuevaCantidad = parseFloat(
        (nuevos[index].cantidad + incremento).toFixed(2),
      );
      if (nuevaCantidad <= 0) {
        nuevos.splice(index, 1);
        return nuevos;
      }
      nuevos[index] = { ...nuevos[index], cantidad: nuevaCantidad };
      return nuevos;
    });
  };

  const actualizarCantidad = (index, nuevaCantidad) => {
    setProductosSeleccionados((prev) => {
      const nuevos = [...prev];
      if (!nuevaCantidad || nuevaCantidad <= 0) {
        nuevos.splice(index, 1);
        return nuevos;
      }
      nuevos[index] = { ...nuevos[index], cantidad: parseFloat(nuevaCantidad) };
      return nuevos;
    });
  };

  const actualizarPrecio = (index, nuevoPrecio) => {
    const precioNum = Number(nuevoPrecio);
    if (isNaN(precioNum) || precioNum < 0) return;
    setProductosSeleccionados((prev) => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], precio: precioNum };
      return nuevos;
    });
  };

  const eliminarProducto = (index) => {
    setProductosSeleccionados((prev) => {
      const nuevos = [...prev];
      nuevos.splice(index, 1);
      return nuevos;
    });
  };

  const guardar = async () => {
    if (!venta) return;
    if (productosSeleccionados.length === 0) {
      message.warning("La venta debe tener al menos un producto");
      return;
    }
    setSaving(true);
    try {
      const detalles = productosSeleccionados.map((p) => ({
        precio: Number(p.precio) || 0,
        cantidad: Number(p.cantidad) || 0,
        productoId: parseInt(p.id),
      }));

      const obsTrim = observacion != null ? String(observacion).trim() : "";
      const observacionFinal = obsTrim !== "" ? obsTrim.toUpperCase() : null;

      await api(`api/ventas/${venta.id}`, "PUT", {
        nroVenta: venta.nroVenta,
        negocioId: venta.negocioId != null ? parseInt(venta.negocioId) : undefined,
        cajaId: venta.cajaId != null ? parseInt(venta.cajaId) : undefined,
        detalles,
        observacion: observacionFinal,
      });

      message.success("Venta actualizada correctamente");
      resetear();
      onSaved?.();
      onClose?.();
    } catch (err) {
      message.error(
        "Error al actualizar la venta: " + (err.message || "Error desconocido"),
      );
    } finally {
      setSaving(false);
    }
  };

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
            style={{ backgroundColor: "#69c0ff" }}
          />
        }
        title={item.nombre}
        description={
          <Space>
            <Tag color="blue">{getUnidadAbbr(item._unidad)}</Tag>
            <Tag color="green">
              ${Number(item.precio || 0).toLocaleString("es-AR")}
            </Tag>
          </Space>
        }
      />
      <Button type="primary" size="small" icon={<PlusOutlined />}>
        {!isMobile && "Agregar"}
      </Button>
    </List.Item>
  );

  const renderCartItem = (item, index) => (
    <List.Item key={item.id} style={{ padding: "12px" }}>
      <div style={{ width: "100%" }}>
        <div
          style={{
            fontWeight: "bold",
            marginBottom: 6,
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
            marginBottom: 6,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span>{item.tipoUnidad || item._unidad || "UNIDAD"}</span>
          {negocioEsEditable ? (
            <>
              <span>Precio:</span>
              <InputNumber
                min={0}
                step={10}
                value={item.precio}
                onChange={(value) => actualizarPrecio(index, value)}
                size={isMobile ? "small" : "middle"}
                formatter={(val) =>
                  val != null ? `$ ${Number(val).toLocaleString("es-AR")}` : ""
                }
                parser={(val) => (val || "").replace(/[^\d]/g, "")}
                style={{ width: isMobile ? 110 : 130 }}
              />
            </>
          ) : (
            <span>- ${Number(item.precio || 0).toLocaleString("es-AR")} c/u</span>
          )}
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
              onClick={() => modificarCantidad(index, -0.5)}
            />
            <InputNumber
              min={getMinByUnidad()}
              step={getStepByUnidad(item._unidad || item.tipoUnidad || "UNIDAD")}
              precision={2}
              value={item.cantidad}
              onChange={(value) => actualizarCantidad(index, value)}
              size={isMobile ? "middle" : "large"}
              style={{ width: 80, margin: "0 4px" }}
            />
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => modificarCantidad(index, 0.5)}
            />
          </div>
          <div style={{ fontWeight: "bold", color: "#1890ff" }}>
            $
            {(Number(item.precio || 0) * Number(item.cantidad || 0)).toLocaleString(
              "es-AR",
            )}
          </div>
        </div>
      </div>
    </List.Item>
  );

  const contenido = (
    <Form layout="vertical">
      <div
        style={{
          background: "#f5f5f5",
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Row gutter={[12, 8]}>
          <Col span={24}>
            <div style={{ fontSize: 13, color: "#555" }}>
              <strong>N° Venta:</strong> {venta?.nroVenta || "-"}
              {venta?.negocio?.nombre ? `  ·  ${venta.negocio.nombre}` : ""}
            </div>
          </Col>
          <Col span={24}>
            <Form.Item label="Observación (opcional)" style={{ marginBottom: 0 }}>
              <Input.TextArea
                placeholder="Escribí una observación"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
            </Form.Item>
          </Col>
        </Row>
      </div>

      {/* Buscar / agregar productos */}
      <div
        style={{
          background: "#f6f9ff",
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Form.Item label="Buscar y agregar productos" style={{ marginBottom: 8 }}>
          <Row gutter={[8, 8]}>
            <Col span={isMobile ? 24 : 18}>
              <Input
                ref={inputBuscadorRef}
                placeholder="Buscar producto (mínimo 2 letras)"
                value={productoBuscado}
                onChange={(e) => {
                  setProductoBuscado(e.target.value);
                  buscarProductos(e.target.value);
                }}
                prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
                size={isMobile ? "middle" : "large"}
                allowClear
              />
            </Col>
            <Col span={isMobile ? 24 : 6}>
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
                locale={{
                  emptyText: <Empty description="No se encontraron productos" />,
                }}
                size="small"
              />
            </Card>
          )}
        </Form.Item>
      </div>

      {/* Carrito */}
      <div style={{ background: "#f7f7f7", padding: 12, borderRadius: 8 }}>
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
            Productos de la venta
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
                padding: 10,
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: "bold", color: "#1890ff" }}>
                Total: ${total.toLocaleString("es-AR")}
              </div>
            </div>
          </>
        ) : (
          <Empty
            description="No hay productos en la venta"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    </Form>
  );

  const titulo = (
    <div style={{ display: "flex", alignItems: "center" }}>
      <ShoppingCartOutlined
        style={{ fontSize: 20, marginRight: 8, color: "#1890ff" }}
      />
      <span>Editar Venta</span>
    </div>
  );

  const footerBtns = [
    <Button key="cancelar" onClick={handleCerrar} disabled={saving}>
      Cancelar
    </Button>,
    <Button
      key="guardar"
      type="primary"
      onClick={guardar}
      loading={saving}
      disabled={loading}
      icon={<ShoppingCartOutlined />}
    >
      Actualizar
    </Button>,
  ];

  if (isMobile) {
    return (
      <Drawer
        title={titulo}
        open={open}
        onClose={handleCerrar}
        placement="bottom"
        height="90%"
        styles={{ body: { paddingBottom: 80 } }}
        extra={
          <Button
            type="primary"
            onClick={guardar}
            loading={saving}
            disabled={loading}
          >
            Actualizar
          </Button>
        }
      >
        {contenido}
      </Drawer>
    );
  }

  return (
    <Modal
      title={titulo}
      open={open}
      onCancel={handleCerrar}
      footer={footerBtns}
      width="800px"
      style={{ maxWidth: "800px", top: 60 }}
      styles={{ body: { padding: 12, maxHeight: "70vh", overflowY: "auto" } }}
      confirmLoading={saving}
    >
      {contenido}
    </Modal>
  );
};

export default EditarVentaModal;
