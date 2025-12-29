import React, { useEffect, useState, useRef } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Typography,
  Checkbox,
  Space,
} from "antd";
import { useParams } from "react-router-dom";
import { api } from "../../services/api";
import {
  EditOutlined,
  StopOutlined,
  CheckOutlined,
} from "@ant-design/icons";

const { Title } = Typography;

// Hook para detectar móvil
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
};

const Negocios = () => {
  const isMobile = useIsMobile();
  const { id } = useParams();

  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal + form (add/edit como en Productos)
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNegocio, setEditingNegocio] = useState(null);
  const [form] = Form.useForm();
  const inputNombreRef = useRef(null);

  // paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // búsqueda + filtro (igual patrón)
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos"); // todos | activos | inactivos

  const fetchNegocios = async () => {
    try {
      const data = await api(`api/getAllNegocios`);
      setNegocios(data.negocios || []);
    } catch (error) {
      message.error(error.message || "Error al cargar negocios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNegocios();
  }, []);

  // AutoFocus en el input de nombre al abrir el modal
  useEffect(() => {
    if (modalVisible) {
      setTimeout(() => {
        inputNombreRef.current?.focus();
        inputNombreRef.current?.select();
      }, 100);
    }
  }, [modalVisible]);

  // F2 para guardar rápido
  useEffect(() => {
    if (!modalVisible) return;
    const handleKeyDown = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        Modal.confirm({
          title: isEditing ? "¿Confirmar edición de negocio?" : "¿Confirmar registro de negocio?",
          content: (
            <div>
              <p><strong>Nombre:</strong> {form.getFieldValue("nombre")}</p>
              <p><strong>Dirección:</strong> {form.getFieldValue("direccion") || "-"}</p>
            </div>
          ),
          okText: "Sí",
          cancelText: "Cancelar",
          autoFocusButton: "ok",
          onOk: () => form.submit(),
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalVisible, isEditing, form]);

  // === Crear / Editar (igual que Productos) ===
  const openAddModal = () => {
    setIsEditing(false);
    setEditingNegocio(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEditModal = (record) => {
    setIsEditing(true);
    setEditingNegocio(record);
    setModalVisible(true);
    form.setFieldsValue({
      nombre: record.nombre,
      direccion: record.direccion,
      esCuentaCorriente: !!record.esCuentaCorriente,
      esEditable: !!record.esEditable,
    });
  };

  const onFinish = async (values) => {
    try {
      if (isEditing && editingNegocio) {
        // EDITAR (PUT)
        await api(`api/negocio/${editingNegocio.id}`, "PUT", {
          nombre: values.nombre,
          direccion: values.direccion,
          esCuentaCorriente: values.esCuentaCorriente,
          esEditable: values.esEditable,
        });

        message.success("Negocio actualizado correctamente");
        // refresco optimista simple (como Productos) o recargo lista:
        setNegocios((prev) =>
          prev.map((n) =>
            n.id === editingNegocio.id
              ? {
                  ...n,
                  nombre: values.nombre,
                  direccion: values.direccion,
                  esCuentaCorriente: values.esCuentaCorriente,
                  esEditable: values.esEditable,
                }
              : n
          )
        );
      } else {
        // CREAR (POST)
        const rol_usuario = parseInt(localStorage.getItem("rol") || "0", 10);
        await api("api/negocio", "POST", {
          ...values,
          clienteId: parseInt(id),
          rol_usuario,
        });
        message.success("Negocio agregado exitosamente");
        fetchNegocios();
      }

      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      setEditingNegocio(null);
    } catch (error) {
      message.error(error.message || "Error al guardar el negocio");
    }
  };

  // === Activar / Desactivar (mismo patrón de Productos: botones con texto) ===
  const handleDeshabilitar = async (negocioId) => {
    try {
      await api(`api/negocio/${negocioId}/deshabilitar`, "PUT");
      message.success("Negocio deshabilitado");
      setNegocios((prev) =>
        prev.map((n) => (n.id === negocioId ? { ...n, estado: 0 } : n))
      );
    } catch (error) {
      message.error("Error al deshabilitar el negocio");
    }
  };

  const handleHabilitar = async (negocioId) => {
    try {
      await api(`api/negocio/${negocioId}/habilitar`, "PUT");
      message.success("Negocio habilitado");
      setNegocios((prev) =>
        prev.map((n) => (n.id === negocioId ? { ...n, estado: 1 } : n))
      );
    } catch (error) {
      message.error("Error al habilitar el negocio");
    }
  };

  // FILTRO + búsqueda + orden (igual patrón)
  const negociosFiltrados = negocios
    .filter((n) => {
      if (filtroEstado === "activos") return n.estado === 1;
      if (filtroEstado === "inactivos") return n.estado === 0;
      return true;
    })
    .filter((n) => {
      const q = busqueda.toLowerCase();
      return (
        (n.nombre || "").toLowerCase().includes(q) ||
        (n.direccion || "").toLowerCase().includes(q)
      );
    });

  const negociosOrdenados = [...negociosFiltrados].sort((a, b) => {
    if (a.estado !== b.estado) return b.estado - a.estado; // activos primero
    return new Date(b.fechaCreacion) - new Date(a.fechaCreacion);
  });

  const negociosPaginados = negociosOrdenados.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // === Columnas: mismas reglas que en Productos (sin columna Estado) ===
  const columns = [
    { title: "Nombre", dataIndex: "nombre", key: "nombre" },
    { title: "Dirección", dataIndex: "direccion", key: "direccion" },
    {
      title: "Cuenta Corriente",
      dataIndex: "esCuentaCorriente",
      key: "esCuentaCorriente",
      render: (v) => (v ? "Sí" : "No"),
    },
    {
      title: "Cuent Editable",
      dataIndex: "esEditable",
      key: "esEditable",
      render: (v) => (v ? "Sí" : "No"),
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_, record) => (
        <Space size={isMobile ? "small" : "middle"}>
          <Button 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            {!isMobile && "Editar"}
          </Button>
          {record.estado === 1 ? (
            <Button
              danger
              type="primary"
              size="small"
              icon={<StopOutlined />}
              style={{
                backgroundColor: "white",
                borderColor: "#ff4d4f",
                color: "#ff4d4f",
              }}
              onClick={() => handleDeshabilitar(record.id)}
            >
              {!isMobile && "Deshabilitar"}
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleHabilitar(record.id)}
            >
              {!isMobile && "Habilitar"}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header acciones y filtros (igual estilo que Productos) */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">
            Negocios
          </h2>
          <Button type="primary" onClick={openAddModal}>
            Agregar Negocio
          </Button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          <Input
            placeholder="Buscar por nombre o dirección"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full md:max-w-xs"
            allowClear
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type={filtroEstado === "todos" ? "primary" : "default"}
              onClick={() => setFiltroEstado("todos")}
              className="flex-1 sm:flex-none"
            >
              Todos
            </Button>
            <Button
              type={filtroEstado === "activos" ? "primary" : "default"}
              onClick={() => setFiltroEstado("activos")}
              className="flex-1 sm:flex-none"
            >
              Activos
            </Button>
            <Button
              type={filtroEstado === "inactivos" ? "primary" : "default"}
              onClick={() => setFiltroEstado("inactivos")}
              className="flex-1 sm:flex-none"
            >
              Inactivos
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla — mismo patrón que Productos */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Listado de Negocios
          </h2>
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
              responsive: true,
            }}
            scroll={{ x: "max-content" }} // ← igual que Productos
          />
        </div>
      </div>

      {/* Modal agregar/editar — mismo modal para ambos flujos */}
      <Modal
        title={isEditing ? "Editar Negocio" : "Agregar Nuevo Negocio"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setIsEditing(false);
          setEditingNegocio(null);
          form.resetFields();
        }}
        footer={[
          <span key="f2-hint" style={{ float: "left", color: "#888", fontSize: "0.85em" }}>
            💡 Presioná F2 para guardar rápido
          </span>,
          <Button key="cancelar" onClick={() => {
            setModalVisible(false);
            setIsEditing(false);
            setEditingNegocio(null);
            form.resetFields();
          }}>
            Cancelar
          </Button>,
          <Button key="guardar" type="primary" onClick={() => form.submit()}>
            Guardar
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="nombre"
            label="Nombre del negocio"
            rules={[{ required: true, message: "Ingrese un nombre" }]}
          >
            <Input ref={inputNombreRef} placeholder="Nombre del negocio" />
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
          <Form.Item
            name="esEditable"
            valuePropName="checked"
            initialValue={false}
          >
            <Checkbox>Registrar como cuenta editable</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Negocios;
