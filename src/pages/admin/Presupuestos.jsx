import React, { useEffect, useState, useRef } from "react";
import {
  Table,
  message,
  Modal,
  Drawer,
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
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  SolutionOutlined,
  ShopOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { Option } = Select;

const kbdStyle = {
  background: "#f0f0f0",
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid #d9d9d9",
};

const getUnidad = (prod) =>
  prod?.tipounidad?.tipo || prod?.tipoUnidad?.tipo || "UNIDAD";

const getUnidadAbbr = (u) => {
  const unidadStr = typeof u === "object" ? u?.tipo || "" : u || "";
  const U = String(unidadStr).toUpperCase();
  if (U === "UNIDAD") return "UN";
  if (U === "KG") return "KG";
  if (U === "CAJON") return "CAJ";
  if (U === "BOLSA") return "BOL";
  return U || "UN";
};

const getStepByUnidad = (u) => {
  const unidadStr = typeof u === "object" ? u?.tipo || "" : u || "";
  const U = String(unidadStr).toUpperCase();
  if (U === "KG") return 0.1;
  return 0.5;
};

const normalizarTexto = (texto) => {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);
  return isMobile;
};

// Generar PDF del presupuesto (rotulado como documento sin validez fiscal)
const generarPDF = (presupuesto) => {
  const detalles = Array.isArray(presupuesto.detallepresupuesto)
    ? presupuesto.detallepresupuesto
    : [];

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const isoDate = presupuesto.fechaCreacion
    ? new Date(presupuesto.fechaCreacion).toISOString().slice(0, 10)
    : "";
  const [yyyy, mm, dd] = isoDate ? isoDate.split("-") : ["", "", ""];
  const fechaSolo = isoDate ? `${dd}/${mm}/${yyyy}` : "";

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("VERDULERIA MI FAMILIA", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(12);
  doc.text("PRESUPUESTO", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `N° Presupuesto: ${presupuesto.nroPresupuesto || presupuesto.id}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 5;
  if (presupuesto.negocio?.nombre) {
    doc.text(`Cliente: ${presupuesto.negocio.nombre}`, pageWidth / 2, y, {
      align: "center",
    });
    y += 5;
  }
  if (fechaSolo) {
    doc.text(`Fecha: ${fechaSolo}`, pageWidth / 2, y, { align: "center" });
    y += 5;
  }
  y += 5;

  const productosData = detalles.map((d, index) => {
    const unidad = d.tipounidad?.tipo || d.tipoUnidad?.tipo || "UNIDAD";
    const cant = `${d.cantidad} ${getUnidadAbbr(unidad)}`;
    const precio = `$${Number(d.precio || 0).toLocaleString("es-AR")}`;
    const subtotal = `$${Number(
      d.subTotal ?? Number(d.precio || 0) * Number(d.cantidad || 0)
    ).toLocaleString("es-AR")}`;
    return [index + 1, d.producto?.nombre || "Producto", cant, precio, subtotal];
  });

  autoTable(doc, {
    head: [["#", "PRODUCTO", "CANT.", "PRECIO", "SUBTOTAL"]],
    body: productosData,
    startY: y,
    theme: "striped",
    margin: { left: 20, right: 20 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2, halign: "left" },
    headStyles: {
      fontStyle: "bold",
      fillColor: [114, 46, 209],
      textColor: 255,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 24, halign: "center" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
    },
    alternateRowStyles: { fillColor: [249, 240, 255] },
  });

  let ry = doc.lastAutoTable.finalY + 10;
  const total = detalles.reduce(
    (sum, d) =>
      sum +
      Number(d.subTotal ?? Number(d.precio || 0) * Number(d.cantidad || 0)),
    0
  );
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(
    `TOTAL: $${total.toLocaleString("es-AR")}`,
    pageWidth - 20,
    ry,
    { align: "right" }
  );

  ry += 12;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text(
    "Presupuesto sin validez fiscal · Precios sujetos a modificación",
    pageWidth / 2,
    ry,
    { align: "center" }
  );

  doc.save(`presupuesto-${presupuesto.nroPresupuesto || presupuesto.id}.pdf`);
};

const Presupuestos = () => {
  const isMobile = useIsMobile();
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Catálogo
  const [todosLosProductos, setTodosLosProductos] = useState([]);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [productosCargados, setProductosCargados] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [negocios, setNegocios] = useState([]);
  const [cajas, setCajas] = useState([]);

  // Cabecera del presupuesto
  const [negocioSeleccionado, setNegocioSeleccionado] = useState(null);
  const [observacion, setObservacion] = useState("");

  // Búsqueda
  const [productoBuscado, setProductoBuscado] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [showProductList, setShowProductList] = useState(false);
  const [hasInputFocus, setHasInputFocus] = useState(false);
  const [productoPreseleccionado, setProductoPreseleccionado] = useState(null);
  const [indiceLista, setIndiceLista] = useState(-1);
  const inputBuscadorRef = useRef(null);
  const inputCantidadRef = useRef(null);

  // Guardar/editar
  const [isSaving, setIsSaving] = useState(false);
  const [presupuestoEditando, setPresupuestoEditando] = useState(null);

  // Detalle
  const [detalleModalVisible, setDetalleModalVisible] = useState(false);
  const [detallePresupuesto, setDetallePresupuesto] = useState(null);

  // Convertir a venta
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertPresupuesto, setConvertPresupuesto] = useState(null);
  const [convertNegocio, setConvertNegocio] = useState(null);
  const [convertCaja, setConvertCaja] = useState(null);
  const [converting, setConverting] = useState(false);

  const total = productosSeleccionados.reduce(
    (acc, p) => acc + Number(p.precio || 0) * Number(p.cantidad || 0),
    0
  );

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

  const cargarNegocios = async () => {
    try {
      const res = await api("api/getAllNegocios");
      setNegocios(res.negocios || []);
    } catch (err) {
      message.error("Error al cargar negocios: " + err.message);
    }
  };

  const cargarCajas = async () => {
    try {
      const res = await api("api/caja");
      setCajas(Array.isArray(res) ? res : res?.cajas || []);
    } catch {
      // cajas solo se usan al convertir; error no crítico al iniciar
    }
  };

  const fetchPresupuestos = async () => {
    try {
      setLoading(true);
      const data = await api("api/presupuestos");
      const arr = Array.isArray(data) ? data : data?.presupuestos || [];
      setPresupuestos(arr);
    } catch (error) {
      message.error("Error al obtener presupuestos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresupuestos();
    cargarNegocios();
    cargarCajas();
  }, []);

  // Búsqueda de productos
  const buscarProductos = () => {
    if (!productosCargados) return;
    const t = normalizarTexto(productoBuscado.trim());
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
    setIndiceLista(-1);
  };

  useEffect(() => {
    if (!hasInputFocus) return;
    if (!productosCargados) return;
    const handler = setTimeout(() => buscarProductos(), 200);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoBuscado, hasInputFocus, productosCargados]);

  // Scroll automático al elemento resaltado con flechas
  useEffect(() => {
    if (indiceLista >= 0) {
      const elemento = document.getElementById(`presu-producto-item-${indiceLista}`);
      if (elemento) {
        elemento.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [indiceLista]);

  // Atajo F2: guardar presupuesto (modal abierto)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!modalVisible) return;
      if (e.key === "F2") {
        e.preventDefault();
        if (productosSeleccionados.length === 0) {
          message.warning("Agregá al menos un producto");
          return;
        }
        const totalPresu = productosSeleccionados.reduce(
          (acc, p) => acc + Number(p.precio || 0) * Number(p.cantidad || 0),
          0
        );
        const negocioNombre =
          negocios.find((n) => n.id === negocioSeleccionado)?.nombre || "Sin cliente";
        Modal.confirm({
          title: presupuestoEditando
            ? "¿Actualizar presupuesto?"
            : "¿Guardar presupuesto?",
          content: (
            <div>
              <p>
                <strong>Cliente:</strong> {negocioNombre}
              </p>
              <p>
                <strong>Productos:</strong> {productosSeleccionados.length}
              </p>
              <p>
                <strong>Total:</strong> ${totalPresu.toLocaleString("es-AR")}
              </p>
            </div>
          ),
          okText: "Sí",
          cancelText: "Cancelar",
          autoFocusButton: "ok",
          onOk: () => guardarPresupuesto(),
          okButtonProps: { loading: isSaving, disabled: isSaving },
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modalVisible,
    productosSeleccionados,
    negocioSeleccionado,
    negocios,
    isSaving,
    presupuestoEditando,
    observacion,
  ]);

  // Atajo F4: abrir nuevo presupuesto (modal cerrado)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F4") {
        e.preventDefault();
        if (modalVisible) return;
        abrirNuevo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible]);

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
            : p
        )
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
          tipoUnidadId: producto._tipoUnidadId,
          _unidad: unidad,
        },
      ]);
      message.success(`${producto.nombre} agregado`);
    }
    setProductoBuscado("");
    setCantidad(1);
    setProductosDisponibles([]);
    setShowProductList(false);
    setProductoPreseleccionado(null);
    setIndiceLista(-1);
    setTimeout(() => inputBuscadorRef.current?.focus(), 100);
  };

  // Seleccionar producto y mover el foco al input de cantidad
  const seleccionarProducto = (item) => {
    setProductoPreseleccionado(item);
    setShowProductList(false);
    setProductoBuscado(item.nombre);
    setTimeout(() => {
      inputCantidadRef.current?.focus();
      inputCantidadRef.current?.select?.();
    }, 50);
  };

  // Enter en Cantidad: agregar el producto preseleccionado
  const handleCantidadKeyDown = (e) => {
    if (isMobile) return;
    if (e.key === "Enter" && productoPreseleccionado) {
      e.preventDefault();
      agregarProducto(productoPreseleccionado);
    }
  };

  // Teclas en el buscador: flechas para navegar, Enter/Tab para seleccionar, Esc para cerrar
  const handleBuscadorKeyDown = (e) => {
    if (isMobile && (e.key === "Tab" || e.key === "Enter")) return;
    if (
      e.key === "Tab" &&
      !e.shiftKey &&
      showProductList &&
      productosDisponibles.length > 0
    ) {
      e.preventDefault();
      const indiceAUsar = indiceLista >= 0 ? indiceLista : 0;
      if (productosDisponibles[indiceAUsar]) {
        seleccionarProducto(productosDisponibles[indiceAUsar]);
      }
      return;
    }

    if (!showProductList || productosDisponibles.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setIndiceLista((prev) =>
          prev < productosDisponibles.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setIndiceLista((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter": {
        e.preventDefault();
        const indiceAUsar = indiceLista >= 0 ? indiceLista : 0;
        if (productosDisponibles[indiceAUsar]) {
          seleccionarProducto(productosDisponibles[indiceAUsar]);
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        setShowProductList(false);
        setIndiceLista(-1);
        break;
      default:
        break;
    }
  };

  const modificarCantidad = (index, incremento) => {
    setProductosSeleccionados((prev) => {
      const nuevos = [...prev];
      const nuevaCantidad = parseFloat(
        (nuevos[index].cantidad + incremento).toFixed(2)
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

  const abrirNuevo = () => {
    setPresupuestoEditando(null);
    setProductosSeleccionados([]);
    setNegocioSeleccionado(null);
    setObservacion("");
    setModalVisible(true);
    cargarProductos();
  };

  const cerrarModal = () => {
    setModalVisible(false);
    setPresupuestoEditando(null);
    setProductosSeleccionados([]);
    setNegocioSeleccionado(null);
    setObservacion("");
    setProductoBuscado("");
    setProductosDisponibles([]);
    setShowProductList(false);
    setProductoPreseleccionado(null);
    setIndiceLista(-1);
  };

  const guardarPresupuesto = async () => {
    if (productosSeleccionados.length === 0) {
      message.warning("Debe agregar al menos un producto");
      return;
    }
    setIsSaving(true);
    try {
      const detalles = productosSeleccionados.map((p) => ({
        productoId: parseInt(p.id),
        cantidad: Number(p.cantidad),
        precio: Number(p.precio) || 0,
        tipoUnidadId: p.tipoUnidadId || p._tipoUnidadId || null,
      }));

      const payload = {
        detalles,
        negocioId: negocioSeleccionado || null,
        observacion: observacion?.trim() ? observacion.trim() : null,
      };

      if (presupuestoEditando) {
        await api(`api/presupuestos/${presupuestoEditando.id}`, "PUT", payload);
        message.success("Presupuesto actualizado con éxito");
      } else {
        await api("api/presupuestos", "POST", payload);
        message.success("Presupuesto creado con éxito");
      }
      cerrarModal();
      fetchPresupuestos();
    } catch (err) {
      message.error("Error al guardar presupuesto: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const editarPresupuesto = async (presupuesto) => {
    try {
      if (!productosCargados) await cargarProductos();
      const full = await api(`api/presupuestos/${presupuesto.id}`);
      const detalles = full.detallepresupuesto || [];
      const carrito = detalles.map((d) => {
        const unidad = d.tipounidad?.tipo || "UNIDAD";
        return {
          id: d.productoId,
          nombre: d.producto?.nombre || "Producto",
          precio: Number(d.precio) || 0,
          cantidad: Number(d.cantidad) || 0,
          tipoUnidad: unidad,
          tipoUnidadId: d.tipoUnidadId,
          _unidad: unidad,
        };
      });
      setPresupuestoEditando(full);
      setProductosSeleccionados(carrito);
      setNegocioSeleccionado(full.negocioId || null);
      setObservacion(full.observacion || "");
      setModalVisible(true);
    } catch (err) {
      message.error("Error al cargar el presupuesto: " + err.message);
    }
  };

  const eliminarPresupuesto = (presupuesto) => {
    Modal.confirm({
      title: `¿Eliminar el presupuesto ${presupuesto.nroPresupuesto || ""}?`,
      okText: "Sí, eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await api(`api/presupuestos/${presupuesto.id}`, "DELETE");
          message.success("Presupuesto eliminado correctamente");
          fetchPresupuestos();
        } catch (err) {
          message.error("Error al eliminar: " + err.message);
        }
      },
    });
  };

  const verDetalle = async (presupuesto) => {
    try {
      const full = await api(`api/presupuestos/${presupuesto.id}`);
      setDetallePresupuesto(full);
      setDetalleModalVisible(true);
    } catch (err) {
      message.error("Error al cargar el detalle: " + err.message);
    }
  };

  const abrirConvertir = (presupuesto) => {
    setConvertPresupuesto(presupuesto);
    setConvertNegocio(presupuesto.negocioId || null);
    setConvertCaja(null);
    setConvertOpen(true);
  };

  const confirmarConvertir = async () => {
    if (!convertPresupuesto) return;
    if (!convertNegocio) {
      message.warning("Elegí un negocio para la venta");
      return;
    }
    if (!convertCaja) {
      message.warning("Elegí una caja para la venta");
      return;
    }
    setConverting(true);
    try {
      const usuarioId = parseInt(localStorage.getItem("usuarioId")) || undefined;
      await api(
        `api/presupuestos/${convertPresupuesto.id}/convertir-venta`,
        "POST",
        {
          negocioId: convertNegocio,
          cajaId: convertCaja,
          usuarioId,
        }
      );
      message.success("Presupuesto convertido en venta correctamente");
      setConvertOpen(false);
      setConvertPresupuesto(null);
      fetchPresupuestos();
    } catch (err) {
      message.error(
        "No se pudo convertir: " + (err.message || "Error desconocido")
      );
    } finally {
      setConverting(false);
    }
  };

  const columns = [
    {
      title: "N°",
      dataIndex: "nroPresupuesto",
      render: (v, r) => v || r.id,
    },
    {
      title: "Cliente",
      dataIndex: ["negocio", "nombre"],
      render: (_, r) => r.negocio?.nombre || <span style={{ color: "#999" }}>Sin cliente</span>,
      responsive: ["sm"],
    },
    {
      title: "Fecha",
      dataIndex: "fechaCreacion",
      render: (f) => dayjs(f).format("DD/MM/YYYY"),
    },
    {
      title: "Items",
      dataIndex: "detallepresupuesto",
      render: (d) => (Array.isArray(d) ? d.length : 0),
      responsive: ["md"],
    },
    {
      title: "Total",
      dataIndex: "total",
      render: (t) => `$${Number(t || 0).toLocaleString("es-AR")}`,
    },
    {
      title: "Estado",
      dataIndex: "ventaId",
      render: (ventaId) =>
        ventaId ? (
          <Tag color="green">Convertido</Tag>
        ) : (
          <Tag color="blue">Presupuesto</Tag>
        ),
      responsive: ["sm"],
    },
    {
      title: "Acciones",
      render: (_, record) => (
        <div className="flex gap-1">
          <Tooltip title="Ver detalle">
            <Button
              icon={<EyeOutlined />}
              onClick={() => verDetalle(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button
              icon={<EditOutlined />}
              onClick={() => editarPresupuesto(record)}
              size="small"
              disabled={!!record.ventaId}
            />
          </Tooltip>
          <Tooltip title="Descargar PDF">
            <Button
              icon={<FilePdfOutlined />}
              onClick={async () => {
                try {
                  const full = await api(`api/presupuestos/${record.id}`);
                  generarPDF(full);
                } catch (err) {
                  message.error("Error al generar PDF: " + err.message);
                }
              }}
              size="small"
            />
          </Tooltip>
          <Tooltip title={record.ventaId ? "Ya convertido" : "Convertir a venta"}>
            <Button
              icon={<SwapOutlined />}
              onClick={() => abrirConvertir(record)}
              size="small"
              type="primary"
              ghost
              disabled={!!record.ventaId}
            />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => eliminarPresupuesto(record)}
              size="small"
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const renderProductItem = (item, index) => {
    const isResaltado = index === indiceLista;
    const isPreseleccionado = productoPreseleccionado?.id === item.id;
    return (
      <List.Item
        key={item.id}
        id={`presu-producto-item-${index}`}
        style={{
          cursor: "pointer",
          padding: "8px 12px",
          backgroundColor: isResaltado
            ? "#efdbff"
            : isPreseleccionado
            ? "#f9f0ff"
            : "transparent",
          border: isResaltado ? "1px solid #722ed1" : "none",
          transition: "background-color 0.15s",
        }}
        onClick={() =>
          isMobile ? agregarProducto(item) : seleccionarProducto(item)
        }
        onMouseEnter={() => setIndiceLista(index)}
      >
        <List.Item.Meta
          avatar={
            <Avatar
              icon={<ShoppingCartOutlined />}
              style={{ backgroundColor: isResaltado ? "#722ed1" : "#9254de" }}
            />
          }
          title={
            <span style={{ fontWeight: isResaltado ? "bold" : "normal" }}>
              {item.nombre}
            </span>
          }
          description={
            <Space>
              <Tag color="purple">{getUnidadAbbr(item._unidad)}</Tag>
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
  };

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
              min={0.1}
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
          <div style={{ fontWeight: "bold", color: "#722ed1" }}>
            $
            {(
              Number(item.precio || 0) * Number(item.cantidad || 0)
            ).toLocaleString("es-AR")}
          </div>
        </div>
      </div>
    </List.Item>
  );

  const contenidoModal = (
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
            <Form.Item label="Cliente (opcional)" style={{ marginBottom: 0 }}>
              <Select
                showSearch
                allowClear
                placeholder="Buscar y seleccionar negocio"
                value={negocioSeleccionado}
                onChange={(val) => setNegocioSeleccionado(val ?? null)}
                style={{ width: "100%" }}
                suffixIcon={<ShopOutlined />}
                optionFilterProp="label"
                filterOption={(input, option) =>
                  (option?.label?.toLowerCase() ?? "").includes(
                    input.toLowerCase()
                  )
                }
              >
                {negocios
                  .filter((n) => n.estado === 1)
                  .map((n) => (
                    <Option key={n.id} value={n.id} label={n.nombre}>
                      {n.esCuentaCorriente && (
                        <span style={{ color: "#faad14", marginRight: 6 }}>
                          <SolutionOutlined />
                        </span>
                      )}
                      {n.nombre}
                    </Option>
                  ))}
              </Select>
            </Form.Item>
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

      <div
        style={{
          background: "#f9f0ff",
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
                onFocus={async () => {
                  setHasInputFocus(true);
                  await cargarProductos();
                  if (productoPreseleccionado && inputBuscadorRef.current) {
                    inputBuscadorRef.current.select?.();
                  }
                }}
                onChange={(e) => {
                  const nuevoValor = e.target.value;
                  if (
                    productoPreseleccionado &&
                    nuevoValor !== productoPreseleccionado.nombre
                  ) {
                    setProductoPreseleccionado(null);
                  }
                  setProductoBuscado(nuevoValor);
                }}
                onKeyDown={handleBuscadorKeyDown}
                prefix={<SearchOutlined style={{ color: "#722ed1" }} />}
                size={isMobile ? "middle" : "large"}
                allowClear
              />
            </Col>
            <Col span={isMobile ? 24 : 6}>
              <InputNumber
                ref={inputCantidadRef}
                min={0.1}
                step={0.5}
                precision={2}
                value={cantidad}
                onChange={(value) => setCantidad(value)}
                onKeyDown={handleCantidadKeyDown}
                addonBefore="Cant."
                style={{ width: "100%" }}
                size={isMobile ? "middle" : "large"}
              />
              {productoPreseleccionado && !isMobile && (
                <div style={{ fontSize: 11, color: "#722ed1", marginTop: 2 }}>
                  ↵ Enter para agregar
                </div>
              )}
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
                  emptyText: <Empty description="No se encontraron productos" />,
                }}
                size="small"
              />
            </Card>
          )}
        </Form.Item>
      </div>

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
            Productos del presupuesto
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
                background: "#f9f0ff",
                padding: 10,
                borderRadius: 6,
              }}
            >
              <div
                style={{ fontSize: 16, fontWeight: "bold", color: "#722ed1" }}
              >
                Total: ${total.toLocaleString("es-AR")}
              </div>
            </div>
          </>
        ) : (
          <Empty
            description="No hay productos en el presupuesto"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    </Form>
  );

  const tituloModal = (
    <div style={{ display: "flex", alignItems: "center" }}>
      <ShoppingCartOutlined
        style={{ fontSize: 20, marginRight: 8, color: "#722ed1" }}
      />
      <span>{presupuestoEditando ? "Editar Presupuesto" : "Nuevo Presupuesto"}</span>
    </div>
  );

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">
            Presupuestos
          </h2>
          <Button type="primary" onClick={abrirNuevo} icon={<PlusOutlined />}>
            Nuevo Presupuesto
          </Button>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <Table
            dataSource={presupuestos}
            columns={columns}
            loading={loading}
            rowKey="id"
            size={isMobile ? "small" : "middle"}
            scroll={{ x: "max-content" }}
            pagination={{ pageSize: isMobile ? 8 : 10, size: "small" }}
            locale={{ emptyText: "No hay presupuestos" }}
          />
        </div>
      </div>

      {/* Modal crear/editar */}
      {isMobile ? (
        <Drawer
          title={tituloModal}
          open={modalVisible}
          onClose={cerrarModal}
          placement="bottom"
          height="92%"
          styles={{ body: { paddingBottom: 80 } }}
          extra={
            <Button type="primary" onClick={guardarPresupuesto} loading={isSaving}>
              {presupuestoEditando ? "Actualizar" : "Guardar"}
            </Button>
          }
        >
          {contenidoModal}
        </Drawer>
      ) : (
        <Modal
          title={tituloModal}
          open={modalVisible}
          onCancel={cerrarModal}
          width="800px"
          style={{ maxWidth: "800px", top: 60 }}
          styles={{ body: { padding: 12, maxHeight: "70vh", overflowY: "auto" } }}
          footer={[
            <span
              key="hint"
              style={{
                float: "left",
                color: "#888",
                fontSize: 12,
                lineHeight: "32px",
              }}
            >
              💡 <kbd style={kbdStyle}>F2</kbd> guardar · <kbd style={kbdStyle}>F4</kbd> nuevo · <kbd style={kbdStyle}>↑↓</kbd>/<kbd style={kbdStyle}>Enter</kbd> productos
            </span>,
            <Button key="cancelar" onClick={cerrarModal} disabled={isSaving}>
              Cancelar
            </Button>,
            <Button
              key="guardar"
              type="primary"
              onClick={guardarPresupuesto}
              loading={isSaving}
              icon={<ShoppingCartOutlined />}
            >
              {presupuestoEditando ? "Actualizar" : "Guardar"}
            </Button>,
          ]}
        >
          {contenidoModal}
        </Modal>
      )}

      {/* Modal detalle */}
      <Modal
        title={`Detalle ${detallePresupuesto?.nroPresupuesto || ""}`}
        open={detalleModalVisible}
        onCancel={() => setDetalleModalVisible(false)}
        footer={[
          <Button
            key="pdf"
            icon={<FilePdfOutlined />}
            onClick={() => detallePresupuesto && generarPDF(detallePresupuesto)}
          >
            Descargar PDF
          </Button>,
          <Button key="cerrar" onClick={() => setDetalleModalVisible(false)}>
            Cerrar
          </Button>,
        ]}
        width={isMobile ? "95%" : 600}
      >
        {detallePresupuesto && (
          <div className="text-sm">
            <p>
              <strong>Cliente:</strong>{" "}
              {detallePresupuesto.negocio?.nombre || "Sin cliente"}
            </p>
            <p>
              <strong>Fecha:</strong>{" "}
              {dayjs(detallePresupuesto.fechaCreacion).format("DD/MM/YYYY")}
            </p>
            {detallePresupuesto.observacion && (
              <p>
                <strong>Observación:</strong> {detallePresupuesto.observacion}
              </p>
            )}
            <Divider style={{ margin: "8px 0" }} />
            <ul className="list-disc pl-5">
              {(detallePresupuesto.detallepresupuesto || []).map((d) => (
                <li key={d.id} className="mb-1">
                  {d.producto?.nombre || "Producto"} — {Number(d.cantidad)}{" "}
                  {getUnidadAbbr(d.tipounidad?.tipo)} x $
                  {Number(d.precio || 0).toLocaleString("es-AR")} = $
                  {Number(
                    d.subTotal ?? Number(d.precio || 0) * Number(d.cantidad || 0)
                  ).toLocaleString("es-AR")}
                </li>
              ))}
            </ul>
            <Divider style={{ margin: "8px 0" }} />
            <p style={{ textAlign: "right", fontWeight: "bold", fontSize: 16 }}>
              Total: ${Number(detallePresupuesto.total || 0).toLocaleString("es-AR")}
            </p>
          </div>
        )}
      </Modal>

      {/* Modal convertir a venta */}
      <Modal
        title="Convertir presupuesto en venta"
        open={convertOpen}
        onCancel={() => setConvertOpen(false)}
        onOk={confirmarConvertir}
        okText="Convertir a venta"
        confirmLoading={converting}
      >
        <p style={{ marginBottom: 12, color: "#555" }}>
          Se creará una venta real con los productos del presupuesto{" "}
          <strong>{convertPresupuesto?.nroPresupuesto}</strong>. El presupuesto
          quedará marcado como convertido.
        </p>
        <Form layout="vertical">
          <Form.Item label="Cliente / Negocio" required>
            <Select
              showSearch
              placeholder="Seleccionar negocio"
              value={convertNegocio}
              onChange={(v) => setConvertNegocio(v)}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label?.toLowerCase() ?? "").includes(
                  input.toLowerCase()
                )
              }
            >
              {negocios
                .filter((n) => n.estado === 1)
                .map((n) => (
                  <Option key={n.id} value={n.id} label={n.nombre}>
                    {n.nombre}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item label="Caja" required>
            <Select
              placeholder="Seleccionar caja"
              value={convertCaja}
              onChange={(v) => setConvertCaja(v)}
            >
              {cajas
                .filter((c) => Number(c.id) !== 1)
                .map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.nombre}
                  </Option>
                ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Presupuestos;
