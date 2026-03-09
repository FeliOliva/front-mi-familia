import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  message,
  Modal,
  Button,
  Select,
  Input,
  Form,
  Switch,
  Space,
  Checkbox,
  Alert,
  Tooltip,
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
  CreditCardOutlined,
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
  } catch {}
};

const clearCartDraft = () => {
  try {
    localStorage.removeItem(CART_KEY);
  } catch {}
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
  if (U === "KG" || U === "CAJ" || U === "CAJON") return 0.1;
  return 1; // UNIDAD, BOLSA
};
const getMinByUnidad = () => 0.1;

// convierte "35.000,58" o "35000,58" o "35000.58" -> 35000.58
const parseMontoFlexible = (valor) => {
  if (valor == null || valor === "") return 0;
  if (typeof valor === "number") return Number(valor.toFixed(2));
  let v = String(valor).replace(/\s|\$/g, "");
  if (v.includes(",") && v.includes(".")) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else if (v.includes(",")) {
    v = v.replace(",", ".");
  }
  v = v.replace(/[^0-9.-]/g, "");
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Number(n.toFixed(2));
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
  const detalles = Array.isArray(venta.detalles)
    ? venta.detalles
    : Array.isArray(venta.detalleventa)
      ? venta.detalleventa
      : [];
  const formatCantidadConUnidad = (d) => {
    if (d.cantidadConUnidad) return String(d.cantidadConUnidad);
    const unidad =
      d.tipoUnidad ||
      d._unidad ||
      d.producto?.tipoUnidad?.tipo ||
      d.producto?.tipounidad?.tipo;
    const cantidadTxt = Number(d.cantidad || 0).toLocaleString("es-AR", {
      maximumFractionDigits: 2,
    });
    return unidad ? `${cantidadTxt} ${getUnidadAbbr(unidad)}` : cantidadTxt;
  };
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
  let saldoAnterior = null;
  let saldoActual = null;
  const esCuentaCorriente =
    venta.negocio?.esCuentaCorriente ||
    venta.esCuentaCorriente ||
    venta.estadoPago === 4 ||
    false;
  try {
    const negocioId = venta.negocioId || venta.negocio?.id;
    if (negocioId && esCuentaCorriente) {
      const startDate = dayjs("2000-01-01").format("YYYY-MM-DD");
      const endDate = dayjs(venta.fechaCreacion).format("YYYY-MM-DD");
      const [transaccionesRaw, saldoInicialRes] = await Promise.all([
        api(
          `api/resumenCuenta/negocio/${negocioId}?startDate=${startDate}&endDate=${endDate}`,
        ),
        api(`api/saldos-iniciales/${negocioId}`).catch(() => null),
      ]);
      const transacciones = Array.isArray(transaccionesRaw)
        ? transaccionesRaw
        : [];
      const fechaVentaMs = venta.fechaCreacion
        ? new Date(venta.fechaCreacion).getTime()
        : null;
      const transaccionesHastaVenta =
        fechaVentaMs != null
          ? transacciones.filter((t) => {
              const ft = t.fecha || t.fechaCreacion || t.fecha_creacion;
              if (!ft) return true;
              const ftMs = new Date(ft).getTime();
              return Number.isNaN(ftMs) ? true : ftMs <= fechaVentaMs;
            })
          : transacciones;
      const montoSaldoIni = saldoInicialRes?.monto || 0;
      const totalVentas = transaccionesHastaVenta
        .filter((t) => t.tipo === "Venta")
        .reduce(
          (acc, t) =>
            acc + Number(t.total_con_descuento ?? t.total ?? t.monto ?? 0),
          0,
        );
      const totalCreditos = transaccionesHastaVenta
        .filter((t) => t.tipo === "Entrega" || t.tipo === "Nota de Crédito")
        .reduce(
          (acc, t) =>
            acc + Number(t.monto ?? t.total ?? t.total_con_descuento ?? 0),
          0,
        );
      const saldoActualRaw = montoSaldoIni + totalVentas - totalCreditos;
      const ventaIncluida = transaccionesHastaVenta.some((t) => {
        if (t.tipo !== "Venta") return false;
        const idT = t.id || t.ventaId;
        return (
          (venta.id && Number(idT) === Number(venta.id)) ||
          (venta.nroVenta && t.nroVenta === venta.nroVenta)
        );
      });
      const totalVenta = Number(venta.total || 0);
      if (ventaIncluida) {
        saldoActual = saldoActualRaw;
        saldoAnterior = saldoActualRaw - totalVenta;
      } else {
        saldoAnterior = saldoActualRaw;
        saldoActual = saldoAnterior + totalVenta;
      }
    }
  } catch {}
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
    // Observación en negrita debajo de la dirección
    if (venta.observacion) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const obsTexto = String(venta.observacion);
      const obsLineas = doc.splitTextToSize(obsTexto, 70);
      doc.text(obsLineas, 6, y);
      y += obsLineas.length * 4.2;
      doc.setFont("helvetica", "normal");
    }
  }

  // Línea
  doc.setLineWidth(0.2);
  doc.line(4, y, 76, y);
  y += 2.5;

  // Tabla productos — usa cantidadConUnidad si está
  const productosData = detalles.map((d) => {
    const cant = formatCantidadConUnidad(d);
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
  y += 6;
  if (saldoAnterior != null && saldoActual != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Saldo anterior: $${nf.format(saldoAnterior)}`, 6, y);
    y += 4.2;
    doc.text(`Este comprob.: $${nf.format(venta.total || 0)}`, 6, y);
    y += 4.2;
    doc.setFont("helvetica", "bold");
    doc.text(`Saldo actual: $${nf.format(saldoActual)}`, 6, y);
    y += 6;
    doc.setFont("helvetica", "normal");
  } else {
    y += 6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(" ", 6, y + bufferFinal);

  doc.save(`venta-${venta.nroVenta}.pdf`);
};

const Ventas = () => {
  const navigate = useNavigate();
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
  const [observacion, setObservacion] = useState("");
  const observacionRef = useRef("");
  const [metodosPago, setMetodosPago] = useState([]);
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [pagoVenta, setPagoVenta] = useState(null);
  const [pagoModo, setPagoModo] = useState("venta"); // "venta" | "cc"
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState(null);
  const [pagoLoading, setPagoLoading] = useState(false);
  const [pagoOtroDia, setPagoOtroDia] = useState(false);
  const [pagoError, setPagoError] = useState("");

  // Búsqueda de ventas por nroVenta
  const [busquedaVenta, setBusquedaVenta] = useState("");
  const [debouncedBusqueda, setDebouncedBusqueda] = useState("");
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  // Estados para mostrar detalles de venta
  const [detalleModalVisible, setDetalleModalVisible] = useState(false);
  const [detalleVenta, setDetalleVenta] = useState(null);
  const [modalTitle, setModalTitle] = useState("");
  const [detalleModo, setDetalleModo] = useState("detalle"); // "detalle" | "pagos"
  const [pagosVenta, setPagosVenta] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);
  const [editPagoModalVisible, setEditPagoModalVisible] = useState(false);
  const [pagoEditando, setPagoEditando] = useState(null);
  const [editPagoMonto, setEditPagoMonto] = useState("");
  const [editPagoMetodo, setEditPagoMetodo] = useState(null);
  const [editPagoLoading, setEditPagoLoading] = useState(false);
  const [saldoCliente, setSaldoCliente] = useState(null);
  const [saldoLoading, setSaldoLoading] = useState(false);
  const [modalCierreVisible, setModalCierreVisible] = useState(false);
  const [cajaInfo, setCajaInfo] = useState(null);
  const [cierreLoading, setCierreLoading] = useState(false);
  const [cierreNotification, setCierreNotification] = useState(null);
  const [totalesEntregas, setTotalesEntregas] = useState([]);
  const [gastosDelDia, setGastosDelDia] = useState([]);
  const [cierrePendiente, setCierrePendiente] = useState(false);
  const [detalleMetodo, setDetalleMetodo] = useState(null);

  // Estado para controlar si mostrar la lista de productos
  const [showProductList, setShowProductList] = useState(false);

  const [hasInputFocus, setHasInputFocus] = useState(false);

  // estados nuevos: cache de productos
  const [todosLosProductos, setTodosLosProductos] = useState([]);
  const [productosCargados, setProductosCargados] = useState(false);
  const [productosVendidosMap, setProductosVendidosMap] = useState({});

  // Negocio actual y flag de si permite editar precios
  const negocioActual = negocios.find(
    (n) => Number(n.id) === Number(selectedNegocio),
  );
  const negocioEsEditable = !!negocioActual?.esEditable;

  const cartEffectInitialized = useRef(false);
  const inputBuscadorRef = useRef(null);
  const inputCantidadRef = useRef(null);
  const selectNegocioRef = useRef(null);
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
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
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
    const fetchProductosVendidos = async () => {
      try {
        const endDate = dayjs().format("YYYY-MM-DD");
        const startDate = dayjs().subtract(90, "day").format("YYYY-MM-DD");
        const data = await api(
          `api/estadisticas/productos-vendidos?startDate=${startDate}&endDate=${endDate}`,
        );
        const list = data?.productosVendidos || [];
        const map = {};
        list.forEach((item) => {
          if (!item?.productoId) return;
          map[item.productoId] = Number(item.cantidadTotal || 0);
        });
        setProductosVendidosMap(map);
      } catch (err) {
        setProductosVendidosMap({});
      }
    };
    if (productosCargados) {
      fetchProductosVendidos();
    }
  }, [productosCargados]);

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
    const timer = setTimeout(
      () => setDebouncedBusqueda(busquedaVenta.trim()),
      300,
    );
    return () => clearTimeout(timer);
  }, [busquedaVenta]);

  const fetchVentas = async (page = 1, q = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", pageSize);
      if (q) params.set("q", q);
      if (!mostrarHistorico) {
        const hoy = dayjs().format("YYYY-MM-DD");
        params.set("startDate", hoy);
        params.set("endDate", hoy);
        params.set("includePendientes", "1");
      }

      const { ventas, total } = await api(`api/ventas?${params.toString()}`);
      console.log("ventas ", ventas);

      // Cargar la información de los negocios y cajas para todas las ventas
      const ventasConInfo = await Promise.all(
        ventas.map(async (venta) => {
          try {
            // Obtener información del negocio para cada venta
            const negociosData = await api("api/getAllNegocios");
            const negocio = negociosData.negocios.find(
              (n) => n.id === venta.negocioId,
            );

            // Obtener información de la caja para cada venta
            const cajasData = await api("api/caja");
            const caja = (cajasData.cajas || cajasData)?.find(
              (c) => c.id === venta.cajaId,
            );
            return {
              ...venta,
              // Preservar la información del negocio del backend (incluye dirección)
              negocio:
                venta.negocio ||
                (negocio
                  ? { nombre: negocio.nombre, direccion: negocio.direccion }
                  : undefined),
              negocioNombre: negocio
                ? negocio.nombre
                : venta.negocio?.nombre || "Desconocido",
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
        }),
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
  }, [currentPage, debouncedBusqueda, mostrarHistorico]);

  useEffect(() => {
    cargarNegocios();
    cargarCajas();
  }, []);

  useEffect(() => {
    const fetchMetodosPago = async () => {
      try {
        const res = await api("api/metodosPago");
        setMetodosPago(res || []);
      } catch (err) {
        message.error("Error al cargar métodos de pago");
      }
    };
    fetchMetodosPago();
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
    const palabras = terminoNormalizado
      .split(/\s+/)
      .filter((p) => p.length > 0);

    const filtrados = todosLosProductos
      .filter((p) => {
        const nombreNormalizado = normalizarTexto(p.nombre);
        // Verificar que todas las palabras del término estén en el nombre (sin acentos)
        return palabras.every((palabra) => nombreNormalizado.includes(palabra));
      })
      .sort((a, b) => {
        const scoreA = productosVendidosMap[a.id] || 0;
        const scoreB = productosVendidosMap[b.id] || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
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
        if (
          !selectedNegocio ||
          !selectedCaja ||
          productosSeleccionados.length === 0
        ) {
          message.warning(
            "Completá negocio, caja y agregá al menos un producto",
          );
          return;
        }

        // Calcular total aquí para evitar problemas de orden
        const totalVenta = productosSeleccionados.reduce(
          (acc, p) => acc + p.precio * p.cantidad,
          0,
        );

        // Mostrar confirmación
        Modal.confirm({
          title: "¿Finalizar venta?",
          content: (
            <div>
              <p>
                <strong>Negocio:</strong>{" "}
                {negocios.find((n) => n.id === selectedNegocio)?.nombre}
              </p>
              <p>
                <strong>Productos:</strong> {productosSeleccionados.length}
              </p>
              <p>
                <strong>Total:</strong> ${totalVenta.toLocaleString("es-AR")}
              </p>
            </div>
          ),
          okText: "Sí",
          cancelText: "Cancelar",
          autoFocusButton: "ok",
          onOk: () => {
            guardarVenta();
          },
          okButtonProps: { loading: isSaving, disabled: isSaving },
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    modalVisible,
    selectedNegocio,
    selectedCaja,
    productosSeleccionados,
    negocios,
    isSaving,
  ]);

  // Atajo F4 para abrir nueva venta
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F4") {
        e.preventDefault();
        if (modalVisible) return;
        setModalVisible(true);
        setObservacion("");
        observacionRef.current = "";
        if (!ventaEditando && productosSeleccionados.length === 0) {
          const draft = readCartDraft();
          if (Array.isArray(draft) && draft.length) {
            setProductosSeleccionados(draft.map(normalizeDraftItem));
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalVisible, ventaEditando, productosSeleccionados.length]);

  // Al abrir el modal, enfocar el select de Negocio
  useEffect(() => {
    if (!modalVisible) return;
    const t = setTimeout(() => {
      selectNegocioRef.current?.focus?.();
    }, 200);
    return () => clearTimeout(t);
  }, [modalVisible]);

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
          : p,
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
      (nuevos[index].cantidad + incremento).toFixed(2),
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
    0,
  );

  const generarNumeroVentaAleatorio = () => {
    const numeroAleatorio = Math.floor(10000 + Math.random() * 90000);
    return `V${numeroAleatorio}`;
  };

  const guardarVenta = async () => {
    if (isSaving) return;
    if (
      !selectedNegocio ||
      !selectedCaja ||
      productosSeleccionados.length === 0
    ) {
      message.warning(
        "Debe completar todos los campos (negocio, caja y productos)",
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
      const textoObservacion = observacionRef.current ?? observacion ?? "";
      const observacionFinal =
        textoObservacion !== "" && String(textoObservacion).trim() !== ""
          ? String(textoObservacion).trim().toUpperCase()
          : null;
      const payloadBase = {
        nroVenta,
        negocioId: parseInt(selectedNegocio),
        cajaId: parseInt(selectedCaja),
        detalles,
        observacion: observacionFinal,
      };

      if (ventaEditando) {
        // 🔹 EDITAR VENTA
        await api(`api/ventas/${ventaEditando.id}`, "PUT", payloadBase);
        message.success("Venta editada con éxito");
      } else {
        // 🔹 CREAR VENTA
        const ventaCreada = await api("api/ventas", "POST", {
          ...payloadBase,
          rol_usuario: rolUsuario,
          usuarioId,
        });
        message.success("Venta guardada con éxito");
        try {
          const negocio = negocios.find(
            (n) => Number(n.id) === Number(selectedNegocio),
          );
          const detallesParaPDF = productosSeleccionados.map((p) => ({
            ...p,
            producto: { nombre: p.nombre },
            cantidadConUnidad: `${Number(p.cantidad || 0).toLocaleString(
              "es-AR",
              {
                maximumFractionDigits: 2,
              },
            )} ${getUnidadAbbr(p.tipoUnidad || p._unidad || "UNIDAD")}`,
          }));
          const ventaParaPDF = {
            ...ventaCreada,
            detalles: detallesParaPDF,
            negocio,
            negocioNombre: negocio?.nombre,
            observacion: observacionFinal,
          };
          await generarPDF(ventaParaPDF);
        } catch (errPdf) {
          console.warn("No se pudo generar el PDF automático:", errPdf);
        }
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
      const obsInicial = venta.observacion || "";
      setObservacion(obsInicial);
      observacionRef.current = obsInicial;

      const detalles = venta.detalles || [];

      const productosInfo = await Promise.all(
        detalles.map(async (detalle) => {
          const producto = await api(`api/products/${detalle.productoId}`);
          return {
            ...producto,
            cantidad: detalle.cantidad,
            precio: detalle.precio,
          };
        }),
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
  const cargarPagosVenta = async (ventaId) => {
    if (!ventaId) return;
    try {
      setLoadingPagos(true);
      const data = await api(`api/entregas/venta/${ventaId}`, "GET");
      setPagosVenta(
        (data || []).map((e) => ({
          id: e.id,
          monto: e.monto,
          metodo: e.metodopago?.nombre || "SIN MÉTODO",
          metodoId: e.metodoPagoId,
          fecha: e.fechaCreacion,
        })),
      );
    } catch (err) {
      console.error("Error cargando pagos de la venta:", err);
      setPagosVenta([]);
    } finally {
      setLoadingPagos(false);
    }
  };

  const calcularSaldoCliente = async (negocioId) => {
    if (!negocioId) return null;
    try {
      setSaldoLoading(true);
      const startDate = dayjs("2000-01-01").format("YYYY-MM-DD");
      const endDate = dayjs().format("YYYY-MM-DD");
      const [transaccionesRaw, saldoInicialRes] = await Promise.all([
        api(
          `api/resumenCuenta/negocio/${negocioId}?startDate=${startDate}&endDate=${endDate}`,
        ),
        api(`api/saldos-iniciales/${negocioId}`).catch(() => null),
      ]);
      const transacciones = Array.isArray(transaccionesRaw)
        ? transaccionesRaw
        : [];
      const montoSaldoIni = saldoInicialRes?.monto || 0;
      const totalVentas = transacciones
        .filter((t) => t.tipo === "Venta")
        .reduce(
          (acc, t) =>
            acc + Number(t.total_con_descuento ?? t.total ?? t.monto ?? 0),
          0,
        );
      const totalCreditos = transacciones
        .filter((t) => t.tipo === "Entrega" || t.tipo === "Nota de Crédito")
        .reduce(
          (acc, t) =>
            acc + Number(t.monto ?? t.total ?? t.total_con_descuento ?? 0),
          0,
        );
      return montoSaldoIni + totalVentas - totalCreditos;
    } catch (err) {
      return null;
    } finally {
      setSaldoLoading(false);
    }
  };

  const openDetalleVenta = async (venta) => {
    if (!venta) return;
    setDetalleVenta(venta);
    setModalTitle("Detalle de Venta");
    setDetalleModo("detalle");
    setDetalleModalVisible(true);
    await cargarPagosVenta(venta.id);
  };

  const openPagosVenta = async (venta) => {
    if (!venta) return;
    setDetalleVenta(venta);
    setModalTitle("Pagos de la venta");
    setDetalleModo("pagos");
    setDetalleModalVisible(true);
    await cargarPagosVenta(venta.id);
  };

  const handleCerrarDetalleModal = () => {
    setDetalleModalVisible(false);
    setDetalleVenta(null);
    setDetalleModo("detalle");
    setPagosVenta([]);
  };

  // Ver detalle de venta
  const handleVerDetalle = (record) => {
    openDetalleVenta(record);
  };

  const openPagoModal = async (record, modo = "venta") => {
    setPagoVenta(record);
    setPagoModo(modo);
    setPagoMetodo(null);
    setPagoOtroDia(false);
    setPagoError("");
    const pendiente =
      record.restoPendiente ??
      Math.max(0, Number(record.total || 0) - Number(record.totalPagado || 0));
    setPagoMonto(pendiente > 0 ? String(pendiente) : "");
    if (modo === "cc") {
      const saldo = await calcularSaldoCliente(
        record.negocioId || record.negocio?.id,
      );
      setSaldoCliente(saldo);
    } else {
      setSaldoCliente(null);
    }
    setPagoModalOpen(true);
  };

  const handleCerrarPagoModal = () => {
    setPagoModalOpen(false);
    setPagoVenta(null);
    setPagoMonto("");
    setPagoMetodo(null);
    setSaldoCliente(null);
    setPagoOtroDia(false);
    setPagoError("");
  };

  const handleConfirmarPago = async () => {
    if (!pagoVenta) return;
    if (!pagoOtroDia && (!pagoMonto || !pagoMetodo)) {
      message.warning("Completa todos los campos para agregar el pago");
      return;
    }
    const montoNum = pagoOtroDia ? 0 : parseMontoFlexible(pagoMonto);
    if (!pagoOtroDia && montoNum <= 0) {
      return message.error("Ingresá un monto válido");
    }

    // validar no superar pendiente si es pago de venta
    if (!pagoOtroDia && pagoModo === "venta") {
      const pendiente =
        pagoVenta.restoPendiente ??
        Math.max(
          0,
          Number(pagoVenta.total || 0) - Number(pagoVenta.totalPagado || 0),
        );
      if (montoNum - pendiente > 1e-6) {
        return message.error(
          `El monto no puede superar el pendiente ($${pendiente})`,
        );
      }
    }

    setPagoLoading(true);
    try {
      setPagoError("");
      const cajaId = Number(
        pagoVenta.cajaId ?? localStorage.getItem("cajaId") ?? 0,
      );
      const negocioId = Number(
        pagoVenta.negocioId ?? pagoVenta.negocio?.id ?? 0,
      );
      const payload = {
        monto: montoNum,
        metodoPagoId: pagoOtroDia ? null : Number(pagoMetodo),
        negocioId,
        cajaId: cajaId || undefined,
        pagoOtroDia: !!pagoOtroDia,
      };
      if (pagoModo === "venta") {
        payload.ventaId = Number(pagoVenta.id);
      }
      await api("api/entregas", "POST", payload);
      message.success("Pago registrado correctamente");
      const ventaActual = pagoVenta;
      handleCerrarPagoModal();
      await fetchVentas(currentPage, debouncedBusqueda);
      if (pagoModo === "cc") {
        openPagosVenta(ventaActual);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Error al registrar el pago";
      setPagoError(msg);
      message.error(msg);
    } finally {
      setPagoLoading(false);
    }
  };

  const handleEditarPago = (pago) => {
    setPagoEditando(pago);
    setEditPagoMonto(String(pago.monto ?? ""));
    setEditPagoMetodo(pago.metodoId || null);
    setEditPagoModalVisible(true);
  };

  const handleGuardarEdicionPago = async () => {
    if (!pagoEditando) return;
    const montoNum = parseMontoFlexible(editPagoMonto);
    if (!montoNum || montoNum <= 0) {
      message.error("El monto debe ser un número válido mayor a 0");
      return;
    }
    setEditPagoLoading(true);
    try {
      await api(`api/entregas/${pagoEditando.id}`, "PUT", {
        monto: montoNum,
        metodoPagoId: editPagoMetodo || null,
      });
      message.success("Pago actualizado correctamente");
      setEditPagoModalVisible(false);
      setPagoEditando(null);
      setEditPagoMonto("");
      setEditPagoMetodo(null);
      await cargarPagosVenta(detalleVenta?.id);
      await fetchVentas(currentPage, debouncedBusqueda);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Error al actualizar el pago";
      message.error(msg);
    } finally {
      setEditPagoLoading(false);
    }
  };

  const agruparMetodos = (lista = []) => {
    const map = {};
    lista.forEach((m) => {
      if (!m) return;
      const nombre = m.nombre || "DESCONOCIDO";
      const total = Number(m.total || 0);
      if (!map[nombre]) {
        map[nombre] = { nombre, total: 0, detalles: [] };
      }
      map[nombre].total += total;
      map[nombre].detalles.push(total);
    });
    return Object.values(map);
  };

  const getTotalesCaja = (cajaId) =>
    totalesEntregas.find((t) => Number(t.cajaId) === Number(cajaId)) || null;

  const getMetodosPagoPorCaja = (cajaId) => {
    const t = getTotalesCaja(cajaId);
    return t?.metodospago || t?.metodosPago || [];
  };

  const hayDatosParaCerrar = () => {
    const cajaId = Number(localStorage.getItem("cajaId"));
    if (!cajaId) return false;
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
      console.error("Error cargando totales de entregas (ventas):", err);
    }
  };

  const handleAbrirCierreCaja = async () => {
    setCierreLoading(true);
    const cajaId = localStorage.getItem("cajaId");
    const usuarioId = localStorage.getItem("usuarioId");
    if (!cajaId) {
      setCierreNotification({
        type: "error",
        message: "No se encontró la caja activa",
      });
      setCierreLoading(false);
      return;
    }
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
      const resumenCaja =
        totalesEntregas.find((t) => Number(t.cajaId) === cajaId) || {};
      const totalEntregado = Number(resumenCaja.totalEntregado || 0);
      const totalEfectivo = Number(resumenCaja.totalEfectivo || 0);
      const totalGastos = gastosDelDia.reduce(
        (acc, g) => acc + (g.monto || 0),
        0,
      );
      const efectivoNeto = Math.max(0, totalEfectivo - totalGastos);
      const totalCuentaCorriente = Number(
        resumenCaja.totalCuentaCorriente || 0,
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
        ingresoLimpio: 0,
        estado: 0,
        metodoPago: metodosPago.map((m) => ({
          nombre: m.nombre,
          total: m.total,
        })),
      };

      await api("api/cierre-caja", "POST", payload);
      setCierrePendiente(true);
      setCierreNotification({
        type: "success",
        message: "Cierre generado correctamente (pendiente de admin)",
      });
      setModalCierreVisible(false);
      message.success("Caja cerrada (pendiente)");
    } catch (err) {
      console.error("Error al cerrar la caja (ventas):", err);
      setCierreNotification({
        type: "error",
        message: "No se pudo cerrar la caja",
      });
      message.error("Error al cerrar caja");
    } finally {
      setCierreLoading(false);
    }
  };

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
          0,
        );
        const finDelDia = new Date(
          hoy.getFullYear(),
          hoy.getMonth(),
          hoy.getDate(),
          23,
          59,
          59,
          999,
        );
        const cierrePend = cierres.find((c) => {
          const fecha = new Date(c.fecha);
          return (
            Number(c.cajaId) === cajaId &&
            c.estado === 0 &&
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

  const detalleContent = detalleVenta ? (
    <div className="text-sm">
      {detalleModo === "detalle" && (
        <>
          <p>
            <strong>Nro Venta:</strong> {detalleVenta.nroVenta}
          </p>
          <p>
            <strong>Negocio:</strong> {detalleVenta.negocioNombre}
          </p>
          <p>
            <strong>Dirección:</strong> {detalleVenta.negocio?.direccion || "-"}
          </p>
          {detalleVenta.observacion && (
            <p className="font-bold">{detalleVenta.observacion}</p>
          )}
          <p>
            <strong>Caja:</strong> {detalleVenta.cajaNombre || "No especificada"}
          </p>
          <p>
            <strong>Total:</strong> ${String(detalleVenta.total ?? 0)}
          </p>
          <p>
            <strong>Fecha:</strong>{" "}
            {dayjs(detalleVenta.fechaCreacion).format("DD/MM/YYYY")}
          </p>

          <Divider>Productos</Divider>
          <ul className="list-disc pl-5">
            {(detalleVenta.detalles || []).map((d) => (
              <li key={d.id} className="mb-1">
                {d.producto?.nombre || "Producto"} -{" "}
                {d.cantidadConUnidad || d.cantidad} x ${String(d.precio ?? 0)} = $
                {String(Number(d.precio || 0) * Number(d.cantidad || 0))}
              </li>
            ))}
          </ul>
        </>
      )}

      <Divider>Pagos realizados</Divider>
      {loadingPagos ? (
        <div>Cargando pagos...</div>
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
              actions={
                detalleModo === "pagos"
                  ? [
                      <Button
                        key="edit"
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEditarPago(pago)}
                        size="small"
                      >
                        Editar
                      </Button>,
                    ]
                  : undefined
              }
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
                <div className="font-semibold">${String(pago.monto ?? 0)}</div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  ) : null;

  const pendientePagoVenta =
    pagoVenta?.restoPendiente ??
    (pagoVenta
      ? Math.max(
          0,
          Number(pagoVenta.total || 0) - Number(pagoVenta.totalPagado || 0),
        )
      : null);

  const columns = [
    {
      title: "Nro. Venta",
      dataIndex: "nroVenta",
      key: "nroVenta",
      render: (nro, record) => {
        const esCuentaCorriente = record.estadoPago === 4;
        const color = esCuentaCorriente ? "#3b82f6" : "#f59e0b";
        const bg = esCuentaCorriente
          ? "linear-gradient(90deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.06) 60%, rgba(59,130,246,0) 100%)"
          : "linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.06) 60%, rgba(245,158,11,0) 100%)";
        return (
          <span
            style={{
              display: "inline-block",
              paddingLeft: 8,
              paddingRight: 8,
              borderRadius: 2,
              lineHeight: "20px",
              background: bg,
            }}
          >
            {nro}
          </span>
        );
      },
    },
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
      title: "Pago",
      key: "pago",
      width: 120,
      align: "center",
      render: (_, record) => {
        if (isMobile) return null;
        const esPagoVenta =
          record.estadoPago === 1 ||
          record.estadoPago === 3 ||
          record.estadoPago === 5;
        const esPagoCerrado = record.estadoPago === 2;
        const esPagoCC = record.estadoPago === 4;
        if (esPagoVenta) {
          const label =
            record.estadoPago === 3 ? "Pago otro día" : "Agregar pago";
          return (
            <Button
              size="small"
              icon={<CreditCardOutlined />}
              onClick={() => openPagoModal(record, "venta")}
            >
              {label}
            </Button>
          );
        }
        if (esPagoCerrado) {
          return (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openPagosVenta(record)}
            >
              Ver pago
            </Button>
          );
        }
        if (esPagoCC) {
          const negocioId = record.negocioId || record.negocio?.id;
          return (
            <Button
              size="small"
              icon={<CreditCardOutlined />}
              onClick={() => {
                if (!negocioId) return;
                navigate(`/resumenes?negocioId=${negocioId}`);
              }}
            >
              Ver C.C.
            </Button>
          );
        }
        return "-";
      },
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
    if (isMobile) return;
    if (e.key === "Enter" && productoPreseleccionado) {
      e.preventDefault();
      agregarProducto(productoPreseleccionado);
    }
  };

  // Manejar teclas en el buscador: flechas para navegar, Enter/Tab para seleccionar
  const handleBuscadorKeyDown = (e) => {
    if (isMobile && (e.key === "Tab" || e.key === "Enter")) return;
    // Tab: si hay productos disponibles, preseleccionar y pasar a cantidad
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
          prev < productosDisponibles.length - 1 ? prev + 1 : prev,
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
          backgroundColor: isResaltado
            ? "#bae7ff"
            : isPreseleccionado
              ? "#e6f7ff"
              : "transparent",
          border: isResaltado ? "1px solid #1890ff" : "none",
          transition: "background-color 0.15s",
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
          title={
            <span style={{ fontWeight: isResaltado ? "bold" : "normal" }}>
              {item.nombre}
            </span>
          }
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
              min={getMinByUnidad()}
              step={getStepByUnidad(
                item._unidad || item.tipoUnidad || "UNIDAD",
              )}
              precision={2}
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
    setObservacion("");
    observacionRef.current = "";
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
              setObservacion("");
              observacionRef.current = "";
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
            placeholder="Buscar por nombre de negocio o número de venta"
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
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Histórico:</span>
              <Switch
                checked={mostrarHistorico}
                onChange={(value) => {
                  setMostrarHistorico(value);
                  setCurrentPage(1);
                }}
              />
              {!mostrarHistorico && (
                <span className="text-gray-500 text-sm">
                  Mostrando ventas de hoy ({dayjs().format("DD/MM/YYYY")})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Listado de Ventas
            </h2>
            <Tooltip
              title={
                cierrePendiente
                  ? "Ya existe un cierre pendiente para esta caja."
                  : !hayDatosParaCerrar()
                    ? "No hay entregas ni saldo de cuenta corriente para cerrar."
                    : ""
              }
            >
              <Button
                type="primary"
                size="small"
                onClick={handleAbrirCierreCaja}
                disabled={cierrePendiente || !hayDatosParaCerrar()}
                loading={cierreLoading}
              >
                Cerrar Caja
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <Table
            dataSource={ventasFiltradas}
            columns={columns}
            loading={loading}
            rowKey="id"
            onRow={(record) => {
              const esCC = record.estadoPago === 4;
              let base = "rgba(0,0,0,0)";
              if (!esCC && (record.estadoPago === 1 || record.estadoPago === 3)) {
                base = "rgba(250,173,20,0.26)";
              } else if (!esCC) {
                base = "rgba(82,196,26,0.24)";
              }
              const secondary = base.includes("0.26")
                ? base.replace("0.26", "0.14")
                : base.replace("0.24", "0.12");
              const bg = `linear-gradient(90deg, ${base} 0%, ${secondary} 85%, rgba(0,0,0,0) 100%)`;
              return { style: { background: bg } };
            }}
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
          <span
            key="hint"
            style={{
              float: "left",
              color: "#888",
              fontSize: 12,
              lineHeight: "32px",
            }}
          >
            💡{" "}
            <kbd
              style={{
                background: "#f0f0f0",
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid #d9d9d9",
              }}
            >
              F2
            </kbd>{" "}
            para finalizar rápido ·{" "}
            <kbd
              style={{
                background: "#f0f0f0",
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid #d9d9d9",
              }}
            >
              F4
            </kbd>{" "}
            nueva venta
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
                    ref={selectNegocioRef}
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
              <Col span={24}>
                <Form.Item
                  label="Observación (opcional)"
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea
                    placeholder="Escribí una observación"
                    value={observacion}
                    onChange={(e) => {
                      const v = e.target.value;
                      setObservacion(v);
                      observacionRef.current = v;
                    }}
                    autoSize={{ minRows: 2, maxRows: 4 }}
                  />
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
                      if (
                        productoPreseleccionado &&
                        nuevoValor !== productoPreseleccionado.nombre
                      ) {
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
                  {productoPreseleccionado && !isMobile && (
                    <div
                      style={{ fontSize: 11, color: "#1890ff", marginTop: 2 }}
                    >
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
              {isMobile && (
                <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                  <Col span={24}>
                    <Button
                      type="primary"
                      block
                      onClick={() =>
                        productoPreseleccionado &&
                        agregarProducto(productoPreseleccionado)
                      }
                      disabled={
                        !productoPreseleccionado || !cantidad || cantidad <= 0
                      }
                    >
                      Agregar
                    </Button>
                  </Col>
                </Row>
              )}

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

      <Modal
        title={
          pagoModo === "cc" ? "Agregar pago a cuenta corriente" : "Agregar pago"
        }
        open={pagoModalOpen}
        onCancel={handleCerrarPagoModal}
        onOk={handleConfirmarPago}
        okText="Registrar pago"
        confirmLoading={pagoLoading}
      >
        {pagoError && (
          <Alert
            message={pagoError}
            type="error"
            showIcon
            className="mb-3"
          />
        )}
        {pagoVenta && (
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            <strong>Pendiente de la venta:</strong>{" "}
            {pendientePagoVenta != null ? `$${pendientePagoVenta}` : "-"}
          </div>
        )}
        {pagoModo === "cc" && (
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            <strong>Saldo total del cliente:</strong>{" "}
            {saldoLoading
              ? "Cargando..."
              : saldoCliente != null
                ? `$${saldoCliente}`
                : "-"}
          </div>
        )}
        <Form layout="vertical">
          {pagoModo === "venta" && (
            <Form.Item label="Pagar otro día" className="mb-2">
              <Checkbox
                checked={pagoOtroDia}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setPagoOtroDia(checked);
                  if (checked) {
                    setPagoMonto("");
                    setPagoMetodo(null);
                  } else if (pendientePagoVenta != null) {
                    setPagoMonto(String(pendientePagoVenta));
                  }
                }}
                disabled={
                  pagoVenta?.estadoPago === 3 || pagoVenta?.estadoPago === 5
                }
              >
                Marcar para pago en otra fecha
              </Checkbox>
            </Form.Item>
          )}
          <Form.Item label="Monto">
            <InputNumber
              value={pagoMonto}
              onChange={(val) => setPagoMonto(val)}
              style={{ width: "100%" }}
              min={0}
              step={1}
              precision={0}
              disabled={pagoOtroDia}
            />
          </Form.Item>
          <Form.Item label="Método de pago">
            <Select
              placeholder="Seleccionar método de pago"
              value={pagoMetodo}
              onChange={setPagoMetodo}
              allowClear
              disabled={pagoOtroDia}
            >
              {metodosPago.map((m) => (
                <Select.Option key={m.id} value={m.id}>
                  {m.nombre}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {!isMobile ? (
        <Modal
          open={detalleModalVisible}
          onCancel={handleCerrarDetalleModal}
          footer={null}
          title={modalTitle}
          width={600}
        >
          {detalleContent}
        </Modal>
      ) : (
        <Drawer
          open={detalleModalVisible}
          onClose={handleCerrarDetalleModal}
          title={modalTitle}
          placement="bottom"
          height="70%"
        >
          {detalleContent}
        </Drawer>
      )}

      <Modal
        title="Editar pago"
        open={editPagoModalVisible}
        onCancel={() => {
          setEditPagoModalVisible(false);
          setPagoEditando(null);
          setEditPagoMonto("");
          setEditPagoMetodo(null);
        }}
        onOk={handleGuardarEdicionPago}
        okText="Guardar cambios"
        confirmLoading={editPagoLoading}
      >
        <Form layout="vertical">
          <Form.Item label="Monto">
            <Input
              value={editPagoMonto}
              onChange={(e) => setEditPagoMonto(e.target.value)}
              inputMode="decimal"
            />
          </Form.Item>
          <Form.Item label="Método de pago">
            <Select
              placeholder="Seleccionar método de pago"
              value={editPagoMetodo}
              onChange={setEditPagoMetodo}
              allowClear
            >
              {metodosPago.map((m) => (
                <Select.Option key={m.id} value={m.id}>
                  {m.nombre}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
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
          >
            Confirmar Cierre
          </Button>,
        ]}
        width={isMobile ? "95%" : 600}
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        {cajaInfo ? (
          <div>
            <p>
              <strong>Caja:</strong> {cajaInfo.nombre}
            </p>
            <p>
              <strong>Total sistema (entregado):</strong>{" "}
              ${Number(cajaInfo.totalSistema || 0).toLocaleString("es-AR")}
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
                      -${Number(g.monto || 0).toLocaleString("es-AR")}
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
                    -$
                    {Number(
                      gastosDelDia.reduce((acc, g) => acc + (g.monto || 0), 0),
                    ).toLocaleString("es-AR")}
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
                      <span>${Number(m.total || 0).toLocaleString("es-AR")}</span>
                    </div>
                    <Button
                      size="small"
                      type="link"
                      onClick={() => setDetalleMetodo(m)}
                    >
                      Ver detalles
                    </Button>
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : (
          <div>Cargando...</div>
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
              <li key={idx}>
                ${Number(valor).toLocaleString("es-AR")}
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay detalles para este método.</p>
        )}
      </Modal>
    </div>
  );
};

export default Ventas;
