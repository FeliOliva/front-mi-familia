import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Typography,
  Checkbox,
} from "antd";
import { useParams } from "react-router-dom";
import { api } from "../../services/api";

const { Title } = Typography;

const Negocios = () => {
  const { id } = useParams();
  const [negocios, setNegocios] = useState([]);
  const [clienteNombre, setClienteNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // NUEVO: estados para búsqueda y filtro de estado
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos"); // "todos", "activos", "inactivos"

  const fetchNegocios = async () => {
    try {
      const data = await api(`api/getAllNegocios`);
      setNegocios(data.negocios);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNegocios();
  }, []);

  const handleAddNegocio = async (values) => {
    try {
      const rol = sessionStorage.getItem("rol");
      await api("api/negocio", "POST", {
        ...values,
        clienteId: parseInt(id),
        rol_usuario: parseInt(rol),
      });
      message.success("Negocio agregado exitosamente");
      setModalVisible(false);
      form.resetFields();
      fetchNegocios(); // Recargar negocios
    } catch (error) {
      message.error(error.message);
    }
  };
  const handleDeshabilitar = async (id) => {
    try {
      await api(`api/negocio/${id}/deshabilitar`, "PUT");
      message.success("Negocio deshabilitado");
      fetchNegocios();
    } catch (error) {
      message.error("Error al deshabilitar el negocio");
    }
  };

  const handleHabilitar = async (id) => {
    try {
      await api(`api/negocio/${id}/habilitar`, "PUT");
      message.success("Negocio habilitado");
      fetchNegocios();
    } catch (error) {
      message.error("Error al habilitar el negocio");
    }
  };

  // FILTRO Y BÚSQUEDA
  const negociosFiltrados = negocios
    .filter((n) => {
      if (filtroEstado === "activos") return n.estado === 1;
      if (filtroEstado === "inactivos") return n.estado === 0;
      return true;
    })
    .filter(
      (n) =>
        n.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        n.direccion.toLowerCase().includes(busqueda.toLowerCase())
    );

  const negociosOrdenados = [...negociosFiltrados].sort((a, b) => {
    if (a.estado !== b.estado) {
      return b.estado - a.estado; // Activos (1) primero, inactivos (0) después
    }
    return new Date(b.fechaCreacion) - new Date(a.fechaCreacion);
  });


  const columns = [
    {
      title: "Nombre",
      dataIndex: "nombre",
      key: "nombre",
    },
    {
      title: "Dirección",
      dataIndex: "direccion",
      key: "direccion",
    },
    {
      title: "Cuenta Corriente",
      dataIndex: "esCuentaCorriente",
      key: "esCuentaCorriente",
      render: (value) => (value ? "Sí" : "No"),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (value) =>
        value === 1 ? (
          <span style={{ color: "green" }}>Activo</span>
        ) : (
          <span style={{ color: "red" }}>Inactivo</span>
        ),
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_, record) =>
        record.estado === 1 ? (
          <Button
            danger
            size="small"
            onClick={() => handleDeshabilitar(record.id)}
          >
            Deshabilitar
          </Button>
        ) : (
          <Button
            type="primary"
            size="small"
            onClick={() => handleHabilitar(record.id)}
          >
            Habilitar
          </Button>
        ),
    },
  ];

const negociosPaginados = negociosOrdenados.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
);

return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Tarjeta de acciones y filtros */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">Negocios</h2>
          <Button type="primary" onClick={() => setModalVisible(true)}>
            Agregar Negocio
          </Button>
        </div>
        <div className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-2">
          <Input
            placeholder="Buscar por nombre o dirección"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: 250 }}
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
          <h2 className="text-lg font-semibold text-gray-900">Listado de Negocios</h2>
        </div>
        <div className="overflow-x-auto px-4 py-4">
          <Table
            dataSource={negociosPaginados}
            columns={columns}
            loading={loading}
            rowKey="id"
            size="small"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: negociosOrdenados.length,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              },
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "50"],
              position: ["bottomCenter"],
            }}
          />
        </div>
      </div>

      <Modal
        title="Agregar Nuevo Negocio"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText="Agregar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={handleAddNegocio}>
          <Form.Item
            name="nombre"
            label="Nombre del negocio"
            rules={[{ required: true, message: "Ingrese un nombre" }]}
          >
            <Input placeholder="Nombre del negocio" />
          </Form.Item>
          <Form.Item
            name="direccion"
            label="Dirección"
            rules={[{ required: true, message: "Ingrese una dirección" }]}
          >
            <Input placeholder="Dirección del negocio" />
          </Form.Item>
          <Form.Item
            name="esCuentaCorriente"
            valuePropName="checked"
            initialValue={false}
          >
            <Checkbox>Registrar como cuenta corriente</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Negocios;
