import React, { useEffect, useState } from "react";
import {
  Table,
  message,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Checkbox,
} from "antd";
import { api } from "../../services/api";

const { Option } = Select;

const Productos = () => {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [form] = Form.useForm();
  const [registrarNuevaMedida, setRegistrarNuevaMedida] = useState(false);
  const [nombreNuevaMedida, setNombreNuevaMedida] = useState("");
  const [tiposUnidades, setTiposUnidades] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const fetchProductos = async (page = 1, q = "", estado = filtroEstado) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", pageSize);
      if (q) params.set("q", q);
      if (estado && estado !== "todos") params.set("estado", estado); // "activos" | "inactivos"

      const data = await api(`api/products?${params.toString()}`);
      // normalizá unidad si querés mostrarla siempre
      const products = (data.products || []).map((p) => ({
        ...p,
        tipoUnidad: p.tipoUnidad || p.tipounidad || null,
      }));

      setProductos(products);
      setTotal(data.total || products.length || 0);
      setCurrentPage(page);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTiposUnidades = async () => {
    try {
      const data = await api("api/tiposUnidades");
      setTiposUnidades(data);
    } catch (error) {
      message.error("Error al cargar unidades");
    }
  };

  useEffect(() => {
    if (modalVisible) {
      fetchTiposUnidades();
      setRegistrarNuevaMedida(false);
      setNombreNuevaMedida("");
    }
  }, [modalVisible]);

  useEffect(() => {
    fetchProductos(currentPage, debouncedQ, filtroEstado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedQ, filtroEstado]);

  const toggleProductos = async (id, estado) => {
    try {
      const nuevoEstado = estado === 1 ? 0 : 1;
      const metodo = estado === 1 ? "DELETE" : "POST";
      await api(`api/products/${id}`, metodo);
      message.success(
        `Producto ${
          nuevoEstado === 1 ? "activado" : "desactivado"
        } correctamente.`
      );
      setProductos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, estado: nuevoEstado } : p))
      );
    } catch (error) {
      message.error(
        error.message || "Error al cambiar el estado del producto."
      );
    }
  };

  // Abrir modal en modo "agregar"
  const openAddModal = () => {
    setIsEditing(false);
    setEditingProduct(null);
    form.resetFields();
    setModalVisible(true);
  };

  // Abrir modal en modo "editar"
  const openEditModal = (record) => {
    setIsEditing(true);
    setEditingProduct(record);
    setModalVisible(true);
    form.setFieldsValue({
      nombre: record.nombre,
      precio: record.precio ?? 0, // ← precio actual
      tipoUnidadId: record.tipoUnidadId ?? record.tipoUnidad?.id,
    });
  };

  const onFinish = async (values) => {
    // rol (si lo necesitás para auditoría)
    const token = sessionStorage.getItem("token");
    let rol_usuario = 0;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      rol_usuario = payload.rol || 0;
    } catch {}

    let tipoUnidadId = values.tipoUnidadId;

    // crear nueva unidad si corresponde
    if (registrarNuevaMedida) {
      if (!nombreNuevaMedida) {
        message.error("Debe ingresar el nombre de la nueva medida.");
        return;
      }
      try {
        const nuevaUnidad = await api("api/tiposUnidades", "POST", {
          tipo: nombreNuevaMedida,
        });
        tipoUnidadId = nuevaUnidad.id;
        fetchTiposUnidades();
      } catch (error) {
        message.error("Error al registrar la nueva medida.");
        return;
      }
    }

    // payload usando SOLO 'precio'
    const body = {
      nombre: values.nombre,
      precio: values.precio, // ← este es el que importa
      tipoUnidadId,
      rol_usuario,
    };

    try {
      // dentro de onFinish, después del await api( ... PUT ... )
      if (isEditing && editingProduct) {
        await api(`api/products/${editingProduct.id}`, "PUT", body);

        // si cambió la unidad o se creó una nueva, recargo todo
        const prevUnidadId =
          editingProduct.tipoUnidadId ?? editingProduct.tipoUnidad?.id ?? null;
        const unidadCambio = prevUnidadId !== (tipoUnidadId ?? null);

        if (registrarNuevaMedida || unidadCambio) {
          await fetchProductos(currentPage); // ← recarga desde el back
        } else {
          // si NO cambió la unidad, puedo hacer update optimista solo del precio/nombre
          setProductos((prev) =>
            prev.map((p) =>
              p.id === editingProduct.id
                ? { ...p, nombre: body.nombre, precio: body.precio }
                : p
            )
          );
        }

        message.success("Producto actualizado correctamente");
        form.resetFields();
        setModalVisible(false);
        setIsEditing(false);
        setEditingProduct(null);
      } else {
        // AGREGAR
        await api("api/products", "POST", body);
        message.success("Producto agregado correctamente");
        fetchProductos(currentPage);
      }
      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      setEditingProduct(null);
    } catch (error) {
      message.error(
        error.message ||
          (isEditing
            ? "Error al actualizar producto."
            : "Error al agregar producto.")
      );
    }
  };

  const columns = [
    { title: "Nombre", dataIndex: "nombre", key: "nombre" },
    {
      title: "Unidad",
      key: "tipoUnidad",
      render: (_, record) =>
        record.tipoUnidad?.tipo || record.tipounidad?.tipo || "-",
    },
    {
      title: "Precio",
      key: "precio",
      render: (_, record) => (
        <span>
          {(record.precio ?? 0).toLocaleString("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 0,
          })}
        </span>
      ),
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_, record) => (
        <Space size="middle">
          <Button size="small" onClick={() => openEditModal(record)}>
            Editar
          </Button>
          {record.estado === 1 ? (
            <Button
              danger
              type="primary"
              size="small"
              style={{
                backgroundColor: "white",
                borderColor: "#ff4d4f",
                color: "#ff4d4f",
              }}
              onClick={() => toggleProductos(record.id, record.estado)}
            >
              Desactivar
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              onClick={() => toggleProductos(record.id, record.estado)}
            >
              Activar
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const productosFiltrados = productos
    .filter((p) => {
      if (filtroEstado === "activos") return p.estado === 1;
      if (filtroEstado === "inactivos") return p.estado === 0;
      return true;
    })
    .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header acciones */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">
            Productos
          </h2>
          <Button type="primary" onClick={openAddModal}>
            Agregar Producto
          </Button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          <Input
            placeholder="Buscar por nombre"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full md:max-w-xs"
            allowClear
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type={filtroEstado === "todos" ? "primary" : "default"}
              onClick={() => {
                setFiltroEstado("todos");
                setCurrentPage(1);
              }}
              className="flex-1 sm:flex-none"
            >
              Todos
            </Button>
            <Button
              type={filtroEstado === "activos" ? "primary" : "default"}
              onClick={() => {
                setFiltroEstado("activos");
                setCurrentPage(1);
              }}
              className="flex-1 sm:flex-none"
            >
              Activos
            </Button>
            <Button
              type={filtroEstado === "inactivos" ? "primary" : "default"}
              onClick={() => {
                setFiltroEstado("inactivos");
                setCurrentPage(1);
              }}
              className="flex-1 sm:flex-none"
            >
              Inactivos
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Listado de Productos
          </h2>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <Table
            dataSource={productos}
            columns={columns}
            loading={loading}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              onChange: (page) =>
                fetchProductos(page, debouncedQ, filtroEstado),
              responsive: true,
              position: ["bottomCenter"],
              size: "small",
            }}
            size="small"
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>

      {/* Modal agregar/editar */}
      <Modal
        title={isEditing ? "Editar producto" : "Agregar producto"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setIsEditing(false);
          setEditingProduct(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item
            name="nombre"
            label="Nombre"
            rules={[{ required: true, message: "Ingrese un nombre" }]}
          >
            <Input placeholder="Ej: Acelga" />
          </Form.Item>

          <Form.Item
            name="precio"
            label="Precio"
            rules={[{ required: true, message: "Ingrese un precio" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              step={100}
              placeholder="Ej: 2000"
            />
          </Form.Item>

          <Form.Item>
            <Checkbox
              checked={registrarNuevaMedida}
              onChange={(e) => setRegistrarNuevaMedida(e.target.checked)}
            >
              Registrar nueva medida
            </Checkbox>
          </Form.Item>

          {registrarNuevaMedida ? (
            <Form.Item
              label="Nombre de la nueva medida"
              required
              validateStatus={nombreNuevaMedida ? "success" : "error"}
              help={
                !nombreNuevaMedida && "Ingrese el nombre de la nueva medida"
              }
            >
              <Input
                value={nombreNuevaMedida}
                onChange={(e) => setNombreNuevaMedida(e.target.value)}
                placeholder="Ej: Unidad, Kg, Pack..."
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="tipoUnidadId"
              label="Unidad de medida"
              rules={[{ required: true, message: "Seleccione una unidad" }]}
            >
              <Select placeholder="Selecciona una unidad" allowClear>
                {tiposUnidades.map((u) => (
                  <Option key={u.id} value={u.id}>
                    {u.tipo}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default Productos;
