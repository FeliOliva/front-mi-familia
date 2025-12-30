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
} from "antd";
import { api } from "../../services/api";
import {
  DeleteOutlined,
  ShoppingCartOutlined,
  SearchOutlined,
  PlusOutlined,
  MinusOutlined,
  ShopOutlined,
  BankOutlined,
  SolutionOutlined,
  EyeOutlined,
  EditOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
const CART_KEY = "mf_cart_venta_v1";

const readCartDraft = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCartDraft = (items = []) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch { }
};

const clearCartDraft = () => {
  try {
    localStorage.removeItem(CART_KEY);
  } catch { }
};
const normalizeDraftItem = (p) => ({
  id: p.id,
  nombre: p.nombre,
  precio: Number(p.precio) || 0,
  cantidad: Number(p.cantidad) || 0,
  tipoUnidad: p.tipoUnidad || p._unidad || "UNIDAD",
  _unidad: p.tipoUnidad || p._unidad || "UNIDAD",
});

const { Option } = Select;
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
  if (U === "KG") return 0.1;
  return 1; // UNIDAD, CAJON, BOLSA
};

// Función para normalizar texto sin acentos
const normalizarTexto = (texto) => {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

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
const generarPDF = async (venta) => {
  const detalles = Array.isArray(venta.detalles) ? venta.detalles : [];
  const n = detalles.length;
  const altoBase = 70,
    altoPorFila = 6,
    bufferFinal = 35;
  const altoPagina = Math.max(200, altoBase + n * altoPorFila + bufferFinal);

  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: [80, altoPagina],
  });
  const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
  let y = 8;
  // ✅ toma String ISO o Date y se queda con YYYY-MM-DD
  const toISODate = (v) => {
    if (!v) return "";
    const s = typeof v === "string" ? v : new Date(v).toISOString();
    // s: "2025-10-09T18:28:01.609Z" -> nos quedamos con "2025-10-09"
    return s.slice(0, 10);
  };
  // Formato DD/MM/YYYY
  const isoDate = toISODate(venta.fechaCreacion); // "2025-10-09"
  const [yyyy, mm, dd] = isoDate ? isoDate.split("-") : ["", "", ""];
  const fechaSolo = isoDate ? `${dd}/${mm}/${yyyy}` : "";

  // Encabezado
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("VERDULERIA MI FAMILIA", 40, y, { align: "center" });
  y += 5;
  doc.setFontSize(10);
  doc.text("TICKET DE VENTA", 40, y, { align: "center" });
  y += 6;

  // Info
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const fechaVenta = new Date(venta.fechaCreacion).toLocaleString("es-AR");
  doc.text(`N° Venta: ${venta.nroVenta}`, 6, y);
  y += 4.2;
  if (fechaSolo) {
    doc.text(`Fecha: ${fechaSolo}`, 6, y);
    y += 4.2;
  }
  if (venta.negocio?.nombre || venta.negocioNombre) {
    doc.setFont("helvetica", "bold");
    doc.text(String(venta.negocio?.nombre ?? venta.negocioNombre), 6, y);
    y += 4.2;
    doc.setFont("helvetica", "normal");
    // Agregar dirección del negocio si existe
    if (venta.negocio?.direccion) {
      doc.setFontSize(8);
      doc.text(String(venta.negocio.direccion), 6, y);
      y += 4.2;
    }
  }

  // Línea
  doc.setLineWidth(0.2);
  doc.line(4, y, 76, y);
  y += 2.5;

  // Tabla productos — usa cantidadConUnidad si está
  const productosData = detalles.map((d) => {
    const cant = d.cantidadConUnidad ?? String(d.cantidad ?? "");
    const subtotal = `$${nf.format((d.precio || 0) * Number(d.cantidad || 0))}`;
    return [d.producto?.nombre || "Producto", cant, subtotal];
  });

  autoTable(doc, {
    head: [["PRODUCTO", "CANT.", "SUBTOTAL"]],

    body: productosData,
    startY: y,
    theme: "plain",
    margin: { left: 4, right: 4 },
    tableWidth: 72,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 0.8,
      lineHeight: 0.95,
      overflow: "linebreak",
    },
    headStyles: { fontStyle: "bold", textColor: 20 },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 16 },
      2: { cellWidth: 20, halign: "right" },
    },
  });

  y = doc.lastAutoTable.finalY + 3;

  // Total + buffer
  doc.line(4, y, 76, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TOTAL: $${nf.format(venta.total || 0)}`, 76 - 4, y, {
    align: "right",
  });
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(" ", 6, y + bufferFinal);

  doc.save(`venta-${venta.nroVenta}.pdf`);
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

  // Búsqueda de ventas por nroVenta
  const [busquedaVenta, setBusquedaVenta] = useState("");
  const [debouncedBusqueda, setDebouncedBusqueda] = useState("");

  // Estados para mostrar detalles de venta
  const [detalleModalVisible, setDetalleModalVisible] = useState(false);
  const [detalleVenta, setDetalleVenta] = useState(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState(null);

  // Estado para controlar si mostrar la lista de productos
  const [showProductList, setShowProductList] = useState(false);

  const [hasInputFocus, setHasInputFocus] = useState(false);

  // estados nuevos: cache de productos
  const [todosLosProductos, setTodosLosProductos] = useState([]);
  const [productosCargados, setProductosCargados] = useState(false);

  // Negocio actual y flag de si permite editar precios
  const negocioActual = negocios.find(
    (n) => Number(n.id) === Number(selectedNegocio)
  );
  const negocioEsEditable = !!negocioActual?.esEditable;

  const cartEffectInitialized = useRef(false);
  const inputBuscadorRef = useRef(null);
  const inputCantidadRef = useRef(null);
  const [productoPreseleccionado, setProductoPreseleccionado] = useState(null);
  const [indiceLista, setIndiceLista] = useState(-1); // índice del producto resaltado en la lista
  const cargarProductos = async () => {
    if (productosCargados) return; // ya están en memoria

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
        }));

      setTodosLosProductos(activosOrdenados);
      setProductosCargados(true);
    } catch (err) {
      message.error("Error al cargar productos: " + err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    // Primera vez: no tocamos localStorage
    if (!cartEffectInitialized.current) {
      cartEffectInitialized.current = true;
      return;
    }
    if (!modalVisible || ventaEditando) return;
    const compact = (productosSeleccionados || []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio: Number(p.precio) || 0,
      cantidad: Number(p.cantidad) || 0,
      tipoUnidad: p.tipoUnidad || p._unidad || getUnidad(p),
    }));

    if (compact.length > 0) {
      writeCartDraft(compact);
    } else {
      // si vaciás el carrito, borramos el borrador
      clearCartDraft();
    }
  }, [productosSeleccionados, ventaEditando, modalVisible]);

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
      // No auto-seleccionar ninguna caja - el usuario debe elegirla manualmente
    } catch (error) {
      message.error("Error al cargar cajas: " + error.message);
    } finally {
      setLoadingCajas(false);
    }
  };

  // Debounce para búsqueda de ventas
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedBusqueda(busquedaVenta.trim()), 300);
    return () => clearTimeout(timer);
  }, [busquedaVenta]);

  const fetchVentas = async (page = 1, q = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", pageSize);
      if (q) params.set("q", q);

      const { ventas, total } = await api(`api/ventas?${params.toString()}`);
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
              // Preservar la información del negocio del backend (incluye dirección)
              negocio: venta.negocio || (negocio ? { nombre: negocio.nombre, direccion: negocio.direccion } : undefined),
              negocioNombre: negocio ? negocio.nombre : (venta.negocio?.nombre || "Desconocido"),
              cajaNombre: caja ? caja.nombre : "No especificada",
            };
          } catch (error) {
            return {
              ...venta,
              // Preservar la información del negocio del backend si está disponible
              negocio: venta.negocio,
              negocioNombre: venta.negocio?.nombre || "Desconocido",
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
    fetchVentas(currentPage, debouncedBusqueda);
  }, [currentPage, debouncedBusqueda]);

  useEffect(() => {
    cargarNegocios();
    cargarCajas();
  }, []);

  const buscarProductos = () => {
    if (!productosCargados) return;

    const termino = productoBuscado.trim();
    const terminoNormalizado = normalizarTexto(termino);

    // ⚡ NO mostrar nada si no hay texto
    if (terminoNormalizado === "") {
      setProductosDisponibles([]);
      setShowProductList(false);
      return;
    }

    // no buscar hasta tener al menos 2 letras
    if (terminoNormalizado.length < 2) {
      setProductosDisponibles([]);
      setShowProductList(false);
      return;
    }

    // Búsqueda más flexible: dividir en palabras y buscar que todas estén presentes
    const palabras = terminoNormalizado.split(/\s+/).filter(p => p.length > 0);

    const filtrados = todosLosProductos
      .filter((p) => {
        const nombreNormalizado = normalizarTexto(p.nombre);
        // Verificar que todas las palabras del término estén en el nombre (sin acentos)
        return palabras.every(palabra => nombreNormalizado.includes(palabra));
      })
      .slice(0, 50); // máximo 50 mostrados

    setProductosDisponibles(filtrados);
    setShowProductList(filtrados.length > 0);
    setIndiceLista(-1); // Resetear índice al buscar
  };

  useEffect(() => {
    if (!hasInputFocus) return;
    if (!productosCargados) return;

    const handler = setTimeout(() => {
      buscarProductos();
    }, 200); // un poco más ágil

    return () => clearTimeout(handler);
  }, [productoBuscado, hasInputFocus, productosCargados]);

  // Scroll automático al elemento resaltado con flechas
  useEffect(() => {
    if (indiceLista >= 0) {
      const elemento = document.getElementById(`producto-item-${indiceLista}`);
      if (elemento) {
        elemento.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [indiceLista]);

  // Atajo F2 para finalizar venta
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Solo si el modal de venta está abierto
      if (!modalVisible) return;

      if (e.key === "F2") {
        e.preventDefault();

        // Validar que haya datos para guardar
        if (!selectedNegocio || !selectedCaja || productosSeleccionados.length === 0) {
          message.warning("Completá negocio, caja y agregá al menos un producto");
          return;
        }

        // Calcular total aquí para evitar problemas de orden
        const totalVenta = productosSeleccionados.reduce(
          (acc, p) => acc + p.precio * p.cantidad,
          0
        );

        // Mostrar confirmación
        Modal.confirm({
          title: "¿Finalizar venta?",
          content: (
            <div>
              <p><strong>Negocio:</strong> {negocios.find(n => n.id === selectedNegocio)?.nombre}</p>
              <p><strong>Productos:</strong> {productosSeleccionados.length}</p>
              <p><strong>Total:</strong> ${totalVenta.toLocaleString("es-AR")}</p>
            </div>
          ),
          okText: "Sí",
          cancelText: "Cancelar",
          autoFocusButton: "ok",
          onOk: () => {
            guardarVenta();
          },
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalVisible, selectedNegocio, selectedCaja, productosSeleccionados, negocios]);

  const agregarProducto = (producto, volverAlBuscador = true) => {
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
          tipoUnidad: unidad, // << guarda string de unidad
          _unidad: unidad, // << mantiene normalizada
        },
      ]);
      message.success(`${producto.nombre} agregado al carrito`);
    }

    setProductoBuscado("");
    setCantidad(1);
    setUnidadSeleccionada("");
    setProductosDisponibles([]);
    setShowProductList(false);
    setProductoPreseleccionado(null);

    // Volver el foco al buscador de productos
    if (volverAlBuscador) {
      setTimeout(() => {
        inputBuscadorRef.current?.focus();
      }, 100);
    }
  };

  const modificarCantidad = (index, incremento) => {
    const nuevos = [...productosSeleccionados];
    const nuevaCantidad = parseFloat(
      (nuevos[index].cantidad + incremento).toFixed(2)
    ); // Redondear a 2 decimales

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
    nuevos[index].cantidad = parseFloat(nuevaCantidad); // Usar parseFloat
    setProductosSeleccionados(nuevos);
  };
  const eliminarProducto = (index) => {
    const nuevos = [...productosSeleccionados];
    nuevos.splice(index, 1);
    setProductosSeleccionados(nuevos);
  };

  const actualizarPrecio = (index, nuevoPrecio) => {
    const precioNum = Number(nuevoPrecio);
    if (isNaN(precioNum) || precioNum <= 0) return;

    const nuevos = [...productosSeleccionados];
    nuevos[index].precio = precioNum;
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

      const usuarioId = parseInt(localStorage.getItem("usuarioId"));
      const rolUsuario = parseInt(localStorage.getItem("rol") || "0");

      // Payload base, común a crear y editar
      const payloadBase = {
        nroVenta,
        negocioId: parseInt(selectedNegocio),
        cajaId: parseInt(selectedCaja),
        detalles,
      };

      if (ventaEditando) {
        // 🔹 EDITAR VENTA
        await api(`api/ventas/${ventaEditando.id}`, "PUT", payloadBase);
        message.success("Venta editada con éxito");
      } else {
        // 🔹 CREAR VENTA
        await api("api/ventas", "POST", {
          ...payloadBase,
          rol_usuario: rolUsuario,
          usuarioId,
        });
        message.success("Venta guardada con éxito");
      }

      // limpiar estado local
      clearCartDraft();
      setModalVisible(false);
      setVentaEditando(null);
      setProductosSeleccionados([]);
      setSelectedNegocio(null);

      // Recargar lista
      fetchVentas(currentPage, debouncedBusqueda);
    } catch (err) {
      message.error("Error al guardar venta: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const editarVenta = async (venta) => {
    try {
      if (negocios.length === 0) {
        await cargarNegocios();
      }
      if (cajas.length === 0) {
        await cargarCajas();
      }

      setSelectedNegocio(venta.negocioId || venta.negocio?.id);
      setSelectedCaja(venta.cajaId || null);

      const detalles = venta.detalles || [];

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

      // Primero marcamos que estamos editando
      setVentaEditando(venta);
      // Después cargamos los productos: el efecto ya verá ventaEditando = true
      setProductosSeleccionados(productosInfo);
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
  const handleVerDetalle = (record) => {
    const venta = record; // ya tiene cantidadConUnidad

    setModalTitle("Detalle de Venta");
    setModalContent(
      <div className="text-sm">
        <p>
          <strong>Nro Venta:</strong> {venta.nroVenta}
        </p>
        <p>
          <strong>Negocio:</strong> {venta.negocioNombre}
        </p>
        <p>
          <strong>Caja:</strong> {venta.cajaNombre || "No especificada"}
        </p>
        <p>
          <strong>Total:</strong> ${Number(venta.total).toLocaleString("es-AR")}
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
              {d.producto?.nombre || "Producto"} - {d.cantidadConUnidad} x $
              {Number(d.precio).toLocaleString("es-AR")} = $
              {(Number(d.precio) * Number(d.cantidad || 0)).toLocaleString(
                "es-AR"
              )}
            </li>
          ))}
        </ul>
      </div>
    );

    setDetalleModalVisible(true);
  };

  const columns = [
    { title: "Nro. Venta", dataIndex: "nroVenta", key: "nroVenta" },
    { title: "Negocio", dataIndex: "negocioNombre", key: "negocioNombre" },
    { title: "Caja", dataIndex: "cajaNombre", key: "cajaNombre" },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (total) =>
        (Number(total) || 0).toLocaleString("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        }),
    },
    {
      title: "Fecha",
      dataIndex: "fechaCreacion",
      key: "fechaCreacion",
      render: (fecha) => dayjs(fecha).format("DD/MM/YYYY"),
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_, record) => (
        <Space size={isMobile ? "small" : "middle"}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleVerDetalle(record)}
          >
            {!isMobile && "Ver"}
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => editarVenta(record)}
          >
            {!isMobile && "Editar"}
          </Button>
          <Button
            size="small"
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
            size="small"
            icon={<PrinterOutlined />}
            onClick={async () => {
              try {
                await generarPDF(record);
              } catch (error) {
                message.error("No se pudo generar el PDF: " + error.message);
              }
            }}
          >
            {!isMobile && "Imprimir"}
          </Button>
        </Space>
      ),
    },
  ];

  // Seleccionar producto y mover foco a cantidad
  const seleccionarProducto = (item) => {
    setProductoPreseleccionado(item);
    setUnidadSeleccionada(item._unidad);
    setShowProductList(false);
    setProductoBuscado(item.nombre);
    // Mover foco al input de cantidad
    setTimeout(() => {
      inputCantidadRef.current?.focus();
      inputCantidadRef.current?.select();
    }, 50);
  };

  // Agregar producto preseleccionado con Enter
  const handleCantidadKeyDown = (e) => {
    if (e.key === "Enter" && productoPreseleccionado) {
      e.preventDefault();
      agregarProducto(productoPreseleccionado);
    }
  };

  // Manejar teclas en el buscador: flechas para navegar, Enter/Tab para seleccionar
  const handleBuscadorKeyDown = (e) => {
    // Tab: si hay productos disponibles, preseleccionar y pasar a cantidad
    if (e.key === "Tab" && !e.shiftKey && showProductList && productosDisponibles.length > 0) {
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
      case "Enter":
        e.preventDefault();
        // Si hay un índice seleccionado, usar ese; sino usar el primero
        const indiceAUsar = indiceLista >= 0 ? indiceLista : 0;
        if (productosDisponibles[indiceAUsar]) {
          seleccionarProducto(productosDisponibles[indiceAUsar]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowProductList(false);
        setIndiceLista(-1);
        break;
      default:
        break;
    }
  };

  // Renderizado de cada producto en la lista de búsqueda
  const renderProductItem = (item, index) => {
    const isResaltado = index === indiceLista;
    const isPreseleccionado = productoPreseleccionado?.id === item.id;

    return (
      <List.Item
        key={item.id}
        id={`producto-item-${index}`}
        style={{
          cursor: "pointer",
          padding: "8px 12px",
          backgroundColor: isResaltado ? "#bae7ff" : isPreseleccionado ? "#e6f7ff" : "transparent",
          border: isResaltado ? "1px solid #1890ff" : "none",
          transition: "background-color 0.15s"
        }}
        onClick={() => seleccionarProducto(item)}
        onMouseEnter={() => setIndiceLista(index)}
      >
        <List.Item.Meta
          avatar={
            <Avatar
              icon={<ShoppingCartOutlined />}
              style={{ backgroundColor: isResaltado ? "#1890ff" : "#69c0ff" }}
            />
          }
          title={<span style={{ fontWeight: isResaltado ? "bold" : "normal" }}>{item.nombre}</span>}
          description={
            <Space>
              <Tag color="blue">{getUnidadAbbr(item._unidad)}</Tag>{" "}
              <Tag color="green">${item.precio.toLocaleString("es-AR")}</Tag>
            </Space>
          }
        />
        <Button
          type="primary"
          size="small"
          className={isMobile ? "max-w-16" : ""}
          icon={<PlusOutlined />}
        >
          {!isMobile && "Agregar"}
        </Button>
      </List.Item>
    );
  };

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

        <div
          style={{
            color: "#666",
            marginBottom: "6px",
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
            <span>- ${item.precio.toLocaleString("es-AR")} c/u</span>
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
              onClick={() => modificarCantidad(index, -0.5)} // Cambiar incremento
            />
            <InputNumber
              min={getStepByUnidad(item._unidad || item.tipoUnidad || "UNIDAD")}
              step={getStepByUnidad(
                item._unidad || item.tipoUnidad || "UNIDAD"
              )}
              precision={
                (item._unidad || item.tipoUnidad || "UNIDAD").toUpperCase() ===
                  "KG"
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
              onClick={() => modificarCantidad(index, 0.5)} // Cambiar incremento
            />
          </div>
          <div style={{ fontWeight: "bold", color: "#1890ff" }}>
            ${(item.precio * item.cantidad).toLocaleString("es-AR")}
          </div>
        </div>
      </div>
    </List.Item>
  );
  const handleCerrarModal = () => {
    if (ventaEditando) {
      setProductosSeleccionados([]);
    }
    setModalVisible(false);
    setVentaEditando(null);
  };
  const ventasFiltradas =
    filtroCaja === "todas"
      ? ventas
      : ventas.filter((venta) => String(venta.cajaId) === String(filtroCaja));

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Tarjeta de acciones y filtros */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">
            Ventas
          </h2>
          <Button
            type="primary"
            onClick={() => {
              setModalVisible(true);
              // si NO es edición de venta, carga el borrador si existe
              if (!ventaEditando && productosSeleccionados.length === 0) {
                const draft = readCartDraft();
                if (Array.isArray(draft) && draft.length) {
                  setProductosSeleccionados(draft.map(normalizeDraftItem));
                }
              }
            }}
            icon={<PlusOutlined />}
          >
            Registrar Venta
          </Button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          <Input
            placeholder="Buscar por número de venta"
            value={busquedaVenta}
            onChange={(e) => {
              setBusquedaVenta(e.target.value);
              setCurrentPage(1);
            }}
            prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
            className="w-full md:max-w-xs"
            allowClear
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-600">Filtrar por caja:</span>
            <Select
              value={filtroCaja}
              onChange={setFiltroCaja}
              style={{ width: 200 }}
              allowClear={false}
            >
              <Option value="todas">Todas las cajas</Option>
              {cajas
                .filter((caja) => Number(caja.id) !== 1) // Ocultar caja de Lucas (id 1)
                .map((caja) => (
                  <Option key={caja.id} value={caja.id}>
                    {caja.nombre}
                  </Option>
                ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Listado de Ventas
          </h2>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <Table
            dataSource={ventasFiltradas}
            columns={columns}
            loading={loading}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalVentas,
              onChange: (page) => setCurrentPage(page),
              responsive: true,
              position: ["bottomCenter"],
              size: "small",
            }}
            size="small"
            scroll={{ x: "max-content" }}
            style={{ marginTop: 20 }}
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
        onCancel={handleCerrarModal}
        footer={[
          <span key="hint" style={{ float: "left", color: "#888", fontSize: 12, lineHeight: "32px" }}>
            💡 Presioná <kbd style={{ background: "#f0f0f0", padding: "2px 6px", borderRadius: 4, border: "1px solid #d9d9d9" }}>F2</kbd> para finalizar rápido
          </span>,
          <Button key="cancelar" onClick={handleCerrarModal}>
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
                    }}
                    disabled={!cajas.length || loadingCajas}
                    style={{ width: "100%" }}
                    size={isMobile ? "middle" : "large"}
                    suffixIcon={<BankOutlined />}
                    loading={loadingCajas}
                  >
                    {cajas
                      .filter((caja) => Number(caja.id) !== 1) // ⬅️ oculta la caja id 0
                      .map((caja) => (
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
                <Col span={isMobile ? 22 : 18}>
                  <Input
                    ref={inputBuscadorRef}
                    placeholder="Buscar producto (mínimo 2 letras) + Enter"
                    value={productoBuscado}
                    onChange={(e) => {
                      const nuevoValor = e.target.value;
                      // Si había un producto preseleccionado y el usuario escribe algo diferente, limpiar
                      if (productoPreseleccionado && nuevoValor !== productoPreseleccionado.nombre) {
                        setProductoPreseleccionado(null);
                      }
                      setProductoBuscado(nuevoValor);
                    }}
                    onFocus={async () => {
                      setHasInputFocus(true);
                      await cargarProductos();
                      // Si hay un producto preseleccionado, seleccionar todo el texto para reemplazar fácil
                      if (productoPreseleccionado && inputBuscadorRef.current) {
                        inputBuscadorRef.current.select();
                      }
                    }}
                    onKeyDown={handleBuscadorKeyDown}
                    prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
                    style={{ width: "100%" }}
                    size={isMobile ? "middle" : "large"}
                    allowClear
                  />
                </Col>
                <Col span={isMobile ? 14 : 6}>
                  <InputNumber
                    ref={inputCantidadRef}
                    min={0.1}
                    step={0.1}
                    precision={2}
                    value={cantidad}
                    onChange={(value) => setCantidad(value)}
                    onKeyDown={handleCantidadKeyDown}
                    addonBefore="Cant."
                    style={{ width: "100%" }}
                    size={isMobile ? "middle" : "large"}
                  />
                  {productoPreseleccionado && (
                    <div style={{ fontSize: 11, color: "#1890ff", marginTop: 2 }}>
                      ↵ Enter para agregar
                    </div>
                  )}
                </Col>
                <Col span={isMobile ? 10 : 4}>
                  <Button
                    style={{ width: "100%" }}
                    onClick={() => {
                      setProductoBuscado("");
                      cargarProductos().then(() => {
                        setProductosDisponibles(todosLosProductos);
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
