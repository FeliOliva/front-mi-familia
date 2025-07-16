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
  const [form] = Form.useForm();
  const [registrarNuevaMedida, setRegistrarNuevaMedida] = useState(false);
  const [nombreNuevaMedida, setNombreNuevaMedida] = useState("");
  const [tiposUnidades, setTiposUnidades] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const fetchProductos = async (page = 1) => {
    setLoading(true);
    try {
      const data = await api(`api/products?page=${page}&limit=${pageSize}`);
      setProductos(data.products);
      setTotal(data.total || data.products?.length || 0);
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
    fetchProductos(currentPage);
  }, [currentPage]);

  const toggleProductos = async (id, estado) => {
    try {
      const nuevoEstado = estado === 1 ? 0 : 1;
      const metodo = estado === 1 ? "DELETE" : "POST";
      await api(`api/products/${id}`, metodo);
      message.success(
        `Producto ${nuevoEstado === 1 ? "activado" : "desactivado"
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

  const onFinish = async (values) => {
    const token = sessionStorage.getItem("token");
    let rol_usuario = 0;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      rol_usuario = payload.rol || 0;
    } catch (e) {
      message.warning("No se pudo leer el rol del token.");
    }

    let tipoUnidadId = values.tipoUnidadId;

    // Si se registra una nueva medida, primero la creamos y usamos su id
    if (registrarNuevaMedida) {
      if (!nombreNuevaMedida) {
        message.error("Debe ingresar el nombre de la nueva medida.");
        return;
      }
      try {
        const nuevaUnidad = await api("api/tiposUnidades", "POST", { tipo: nombreNuevaMedida });
        tipoUnidadId = nuevaUnidad.id;
        // Actualiza la lista de unidades para futuras altas
        fetchTiposUnidades();
      } catch (error) {
        message.error("Error al registrar la nueva medida.");
        return;
      }
    }

    const body = {
      ...values,
      tipoUnidadId,
      precioInicial: values.precio,
      rol_usuario,
    };

    try {
      await api("api/products", "POST", body);
      message.success("Producto agregado correctamente");
      form.resetFields();
      setModalVisible(false);
      fetchProductos(currentPage);
    } catch (error) {
      message.error(error.message || "Error al agregar producto.");
    }
  };

  const columns = [
    {
      title: "Nombre",
      dataIndex: "nombre",
      key: "nombre",
    },
    {
      title: "Unidad",
      key: "tipoUnidad",
      render: (_, record) => record.tipoUnidad?.tipo || "-",
    },
    {
      title: "Precio",
      render: (_, record) => {
        const precio = record.precioInicial || 0;
        return (
          <span>
            {precio.toLocaleString("es-CL", {
              style: "currency",
              currency: "CLP",
            })}
          </span>
        );
      },
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (text, record) => (
        <Space size="middle">
          {record.estado === 1 ? (
            <Button
              danger
              type="primary"
              size="small"
              style={{ backgroundColor: "white", borderColor: "#ff4d4f", color: "#ff4d4f" }}
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
      {/* Tarjeta de acciones y filtros */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">Productos</h2>
          <Button type="primary" onClick={() => setModalVisible(true)}>
            Agregar Producto
          </Button>
        </div>
        <div className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-2">
          <Input
            placeholder="Buscar por nombre"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: 300, marginRight: 10 }}
          />
          <Button
            type={filtroEstado === "todos" ? "primary" : "default"}
            onClick={() => setFiltroEstado("todos")}
          >
            Todos
          </Button>
          <Button
            type={filtroEstado === "activos" ? "primary" : "default"}
            onClick={() => setFiltroEstado("activos")}
          >
            Activos
          </Button>
          <Button
            type={filtroEstado === "inactivos" ? "primary" : "default"}
            onClick={() => setFiltroEstado("inactivos")}
          >
            Inactivos
          </Button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Listado de Productos</h2>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <Table
            dataSource={productosFiltrados}
            columns={columns}
            loading={loading}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              onChange: (page) => fetchProductos(page),
              responsive: true,
              position: ["bottomCenter"],
              size: "small",
            }}
            size="small"
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>

      {/* Modal para agregar producto */}
      <Modal
        title="Agregar producto"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
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
            <Input placeholder="Ej: Manzana Moño Azul" />
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
              placeholder="Ej: 20000"
            />
          </Form.Item>

          <Form.Item>
            <Checkbox
              checked={registrarNuevaMedida}
              onChange={e => setRegistrarNuevaMedida(e.target.checked)}
            >
              Registrar nueva medida
            </Checkbox>
          </Form.Item>

          {registrarNuevaMedida ? (
            <Form.Item
              label="Nombre de la nueva medida"
              required
              validateStatus={nombreNuevaMedida ? "success" : "error"}
              help={!nombreNuevaMedida && "Ingrese el nombre de la nueva medida"}
            >
              <Input
                value={nombreNuevaMedida}
                onChange={e => setNombreNuevaMedida(e.target.value)}
                placeholder="Ej: Cajón, Pack, etc."
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="tipoUnidadId"
              label="Unidad de medida"
              rules={[{ required: true, message: "Seleccione una unidad" }]}
            >
              <Select placeholder="Selecciona una unidad">
                {tiposUnidades.map((unidad) => (
                  <Option key={unidad.id} value={unidad.id}>
                    {unidad.tipo}
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
