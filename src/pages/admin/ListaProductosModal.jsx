import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Checkbox,
  Radio,
  Select,
  Input,
  Table,
  Button,
  Divider,
  Space,
  Tag,
  message,
} from "antd";
import { FilePdfOutlined } from "@ant-design/icons";
import { api } from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { Option } = Select;

// Etiqueta amigable de la unidad
const getUnidadTipo = (p) =>
  p?.tipoUnidad?.tipo || p?.tipounidad?.tipo || "";
const formatUnidad = (p) => {
  const U = getUnidadTipo(p).toUpperCase();
  if (U === "UNIDAD") return "Unidad (u)";
  if (U === "KG") return "Kg";
  if (U === "CAJON") return "Cajón";
  if (U === "BOLSA") return "Bolsa";
  if (!U) return "-";
  return U.charAt(0) + U.slice(1).toLowerCase();
};

const normalizar = (t) =>
  (t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Columnas disponibles para la lista
const COLUMNAS = [
  { key: "codigo", label: "Código", header: "CÓD.", width: 16, align: "center" },
  { key: "nombre", label: "Nombre", header: "PRODUCTO", width: "auto", align: "left" },
  { key: "unidad", label: "Unidad", header: "UNIDAD", width: 30, align: "center" },
  { key: "precio", label: "Precio", header: "PRECIO", width: 32, align: "right" },
  {
    key: "precioInicial",
    label: "Precio inicial",
    header: "P. INICIAL",
    width: 32,
    align: "right",
  },
];

const valorColumna = (p, key) => {
  switch (key) {
    case "codigo":
      return String(p.id ?? "");
    case "nombre":
      return p.nombre || "-";
    case "unidad":
      return formatUnidad(p);
    case "precio":
      return `$${Number(p.precio || 0).toLocaleString("es-AR")}`;
    case "precioInicial":
      return `$${Number(p.precioInicial ?? p.precio ?? 0).toLocaleString("es-AR")}`;
    default:
      return "";
  }
};

const ListaProductosModal = ({ open, onClose }) => {
  const [todos, setTodos] = useState([]);
  const [tiposUnidades, setTiposUnidades] = useState([]);
  const [loading, setLoading] = useState(false);

  // Configuración
  const [titulo, setTitulo] = useState("Lista de Productos");
  const [columnas, setColumnas] = useState(["nombre", "unidad", "precio"]);
  const [modo, setModo] = useState("filtrados"); // "filtrados" | "seleccionados"
  const [filtroEstado, setFiltroEstado] = useState("activos");
  const [filtroUnidades, setFiltroUnidades] = useState([]); // ids; vacío = todas
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState([]); // ids
  const [orden, setOrden] = useState("nombre");

  useEffect(() => {
    if (!open) return;
    const cargar = async () => {
      setLoading(true);
      try {
        const [prodRes, uniRes] = await Promise.all([
          api("api/getAllProducts"),
          api("api/tiposUnidades"),
        ]);
        const productos = (prodRes.products || []).map((p) => ({
          ...p,
          tipoUnidad: p.tipoUnidad || p.tipounidad || null,
          _tipoUnidadId:
            p.tipoUnidadId || p.tipoUnidad?.id || p.tipounidad?.id || null,
        }));
        setTodos(productos);
        setTiposUnidades(Array.isArray(uniRes) ? uniRes : uniRes?.tiposUnidades || []);
      } catch (err) {
        message.error("Error al cargar productos: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [open]);

  const productosResultado = useMemo(() => {
    let lista = [...todos];

    if (modo === "seleccionados") {
      const set = new Set(seleccionados);
      lista = lista.filter((p) => set.has(p.id));
    } else {
      if (filtroEstado === "activos") lista = lista.filter((p) => p.estado === 1);
      else if (filtroEstado === "inactivos")
        lista = lista.filter((p) => p.estado === 0);

      if (filtroUnidades.length > 0) {
        const set = new Set(filtroUnidades);
        lista = lista.filter((p) => set.has(p._tipoUnidadId));
      }

      const q = normalizar(busqueda.trim());
      if (q.length > 0) {
        lista = lista.filter((p) => normalizar(p.nombre).includes(q));
      }
    }

    lista.sort((a, b) => {
      if (orden === "precioAsc") return (a.precio || 0) - (b.precio || 0);
      if (orden === "precioDesc") return (b.precio || 0) - (a.precio || 0);
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    });

    return lista;
  }, [todos, modo, seleccionados, filtroEstado, filtroUnidades, busqueda, orden]);

  const columnasOrdenadas = COLUMNAS.filter((c) => columnas.includes(c.key));

  const previewColumns = columnasOrdenadas.map((c) => ({
    title: c.label,
    key: c.key,
    align: c.align === "right" ? "right" : c.align === "center" ? "center" : "left",
    render: (_, p) => valorColumna(p, c.key),
  }));

  const generarPDF = () => {
    if (columnasOrdenadas.length === 0) {
      message.warning("Elegí al menos una columna");
      return;
    }
    if (productosResultado.length === 0) {
      message.warning("No hay productos que coincidan con los filtros");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 18;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("VERDULERIA MI FAMILIA", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(12);
    doc.text(titulo || "Lista de Productos", pageWidth / 2, y, {
      align: "center",
    });
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90);
    doc.text(
      `Fecha: ${new Date().toLocaleDateString("es-AR")}  ·  ${productosResultado.length} productos`,
      pageWidth / 2,
      y,
      { align: "center" }
    );
    doc.setTextColor(0);
    y += 8;

    const head = [columnasOrdenadas.map((c) => c.header)];
    const body = productosResultado.map((p) =>
      columnasOrdenadas.map((c) => valorColumna(p, c.key))
    );

    const columnStyles = {};
    columnasOrdenadas.forEach((c, i) => {
      columnStyles[i] = {
        halign: c.align,
        ...(typeof c.width === "number" ? { cellWidth: c.width } : {}),
      };
    });

    autoTable(doc, {
      head,
      body,
      startY: y,
      theme: "striped",
      margin: { left: 16, right: 16 },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
      headStyles: {
        fontStyle: "bold",
        fillColor: [22, 119, 255],
        textColor: 255,
        halign: "center",
      },
      columnStyles,
      alternateRowStyles: { fillColor: [244, 248, 255] },
    });

    let ry = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text(
      "Lista informativa · Precios sujetos a modificación sin previo aviso",
      pageWidth / 2,
      ry,
      { align: "center" }
    );

    const slug = (titulo || "lista-productos")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    doc.save(`${slug || "lista-productos"}.pdf`);
    message.success("PDF generado correctamente");
  };

  return (
    <Modal
      title="Generar lista de productos"
      open={open}
      onCancel={onClose}
      width={820}
      styles={{ body: { maxHeight: "72vh", overflowY: "auto" } }}
      footer={[
        <span
          key="count"
          style={{ float: "left", color: "#888", lineHeight: "32px" }}
        >
          {productosResultado.length} producto
          {productosResultado.length === 1 ? "" : "s"} en la lista
        </span>,
        <Button key="cerrar" onClick={onClose}>
          Cerrar
        </Button>,
        <Button
          key="pdf"
          type="primary"
          icon={<FilePdfOutlined />}
          onClick={generarPDF}
        >
          Descargar PDF
        </Button>,
      ]}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título de la lista
          </label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Lista de precios mayorista"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Columnas a mostrar
          </label>
          <Checkbox.Group
            value={columnas}
            onChange={setColumnas}
            options={COLUMNAS.map((c) => ({ label: c.label, value: c.key }))}
          />
        </div>

        <Divider style={{ margin: "8px 0" }} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Qué productos incluir
          </label>
          <Radio.Group
            value={modo}
            onChange={(e) => setModo(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="filtrados">Según filtros</Radio.Button>
            <Radio.Button value="seleccionados">Elegir productos</Radio.Button>
          </Radio.Group>
        </div>

        {modo === "filtrados" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <Radio.Group
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <Radio value="activos">Activos</Radio>
                  <Radio value="inactivos">Inactivos</Radio>
                  <Radio value="todos">Todos</Radio>
                </Radio.Group>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div style={{ flex: 1 }}>
                <label className="block text-xs text-gray-500 mb-1">
                  Filtrar por unidad
                </label>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Todas las unidades"
                  value={filtroUnidades}
                  onChange={setFiltroUnidades}
                  style={{ width: "100%" }}
                  optionFilterProp="children"
                >
                  {tiposUnidades.map((u) => (
                    <Option key={u.id} value={u.id}>
                      {u.tipo}
                    </Option>
                  ))}
                </Select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="block text-xs text-gray-500 mb-1">
                  Buscar por nombre
                </label>
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Filtrar por nombre"
                  allowClear
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Seleccioná los productos
            </label>
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="Buscar y agregar productos"
              value={seleccionados}
              onChange={setSeleccionados}
              style={{ width: "100%" }}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label?.toLowerCase() ?? "").includes(input.toLowerCase())
              }
              maxTagCount="responsive"
            >
              {todos.map((p) => (
                <Option key={p.id} value={p.id} label={p.nombre}>
                  {p.nombre}{" "}
                  <Tag color="blue" style={{ marginLeft: 4 }}>
                    {formatUnidad(p)}
                  </Tag>
                </Option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-1">Ordenar por</label>
          <Select value={orden} onChange={setOrden} style={{ width: 220 }}>
            <Option value="nombre">Nombre (A-Z)</Option>
            <Option value="precioAsc">Precio (menor a mayor)</Option>
            <Option value="precioDesc">Precio (mayor a menor)</Option>
          </Select>
        </div>

        <Divider style={{ margin: "8px 0" }} />

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Vista previa
            </span>
            <Space>
              {columnasOrdenadas.length === 0 && (
                <Tag color="orange">Elegí al menos una columna</Tag>
              )}
            </Space>
          </div>
          <Table
            dataSource={productosResultado}
            columns={previewColumns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 8, size: "small" }}
            scroll={{ x: "max-content" }}
            locale={{ emptyText: "No hay productos que coincidan" }}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ListaProductosModal;
