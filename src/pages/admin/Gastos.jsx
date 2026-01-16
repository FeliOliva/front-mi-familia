import React, { useEffect, useState } from "react";
import {
  Table,
  message,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  Card,
  Empty,
} from "antd";
import { api } from "../../services/api";
import { EditOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";

const Gastos = () => {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingGasto, setEditingGasto] = useState(null);

  const [form] = Form.useForm();

  const fetchGastos = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", pageSize);

      const data = await api(`api/gastos?${params.toString()}`);
      setGastos(data.gastos || []);
      setTotal(data.total || 0);
      setCurrentPage(page);
    } catch (error) {
      message.error(error.message || "Error al cargar los gastos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGastos();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleAdd = () => {
    setIsEditing(false);
    setEditingGasto(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (gasto) => {
    setIsEditing(true);
    setEditingGasto(gasto);
    form.setFieldsValue({
      motivo: (gasto.motivo || "").toUpperCase(),
      monto: gasto.monto,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api(`api/gastos/${id}`, "DELETE");
      message.success("Gasto eliminado correctamente");
      fetchGastos(currentPage);
    } catch (error) {
      message.error(error.message || "Error al eliminar el gasto");
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const montoNum = parseFloat(values.monto);
      
      if (isNaN(montoNum) || montoNum <= 0) {
        message.error("El monto debe ser un número válido mayor a 0");
        return;
      }

      const cajaId = Number(localStorage.getItem("cajaId"));
      if (!cajaId) {
        message.error("No se pudo identificar la caja");
        return;
      }

      const motivoUpper = String(values.motivo || "").toUpperCase();

      if (isEditing) {
        await api(`api/gastos/${editingGasto.id}`, "PUT", {
          motivo: motivoUpper,
          monto: montoNum,
        });
        message.success("Gasto actualizado correctamente");
      } else {
        await api("api/gastos", "POST", {
          motivo: motivoUpper,
          monto: montoNum,
          cajaId,
        });
        message.success("Gasto agregado correctamente");
      }

      setModalVisible(false);
      form.resetFields();
      fetchGastos(currentPage);
    } catch (error) {
      message.error(error.message || "Error al guardar el gasto");
    }
  };

  const formatCurrency = (value) => {
    return `$${value?.toLocaleString("es-AR") || 0}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString("es-AR");
  };

  const columns = [
    {
      title: "Motivo",
      dataIndex: "motivo",
      key: "motivo",
    },
    {
      title: "Usuario",
      dataIndex: "usuario",
      key: "usuario",
      render: (usuario) => usuario?.usuario || "-",
    },
    {
      title: "Monto",
      dataIndex: "monto",
      key: "monto",
      align: "right",
      render: (monto) => formatCurrency(monto),
    },
    {
      title: "Fecha",
      dataIndex: "fechaCreacion",
      key: "fechaCreacion",
      render: (date) => formatDate(date),
      responsive: ["md"],
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Editar
          </Button>
          <Popconfirm
            title="¿Estás seguro de eliminar este gasto?"
            onConfirm={() => handleDelete(record.id)}
            okText="Sí"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Eliminar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Gastos</h1>
          <p className="text-sm text-gray-500">
            Registrá y controlá los gastos del día
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          block={isMobile}
        >
          Agregar Gasto
        </Button>
      </div>

      {!loading && gastos.length === 0 ? (
        <Card>
          <Empty description="No hay gastos registrados" />
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {gastos.map((gasto) => (
            <Card key={gasto.id} className="shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">Motivo</p>
                  <p className="font-medium text-gray-900">{gasto.motivo}</p>
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Usuario:</span>{" "}
                    {gasto.usuario?.usuario || "-"}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Fecha:</span>{" "}
                    {formatDate(gasto.fechaCreacion)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Monto</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(gasto.monto)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  type="default"
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => handleEdit(gasto)}
                  block
                >
                  Editar
                </Button>
                <Popconfirm
                  title="¿Eliminar este gasto?"
                  onConfirm={() => handleDelete(gasto.id)}
                  okText="Sí"
                  cancelText="No"
                >
                  <Button danger icon={<DeleteOutlined />} size="small" block>
                    Eliminar
                  </Button>
                </Popconfirm>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={gastos}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 900 }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            onChange: (page) => fetchGastos(page),
            showSizeChanger: false,
            showTotal: (total) => `Total: ${total} gastos`,
          }}
        />
      )}

      <Modal
        title={isEditing ? "Editar Gasto" : "Agregar Gasto"}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        okText="Guardar"
        cancelText="Cancelar"
        width={isMobile ? "95%" : 520}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="motivo"
            label="Motivo"
            rules={[{ required: true, message: "Ingresá el motivo del gasto" }]}
          >
            <Input placeholder="Ej: Compra de materiales" />
          </Form.Item>

          <Form.Item
            name="monto"
            label="Monto"
            rules={[
              { required: true, message: "Ingresá el monto" },
              {
                validator: (_, value) => {
                  const num = parseFloat(value);
                  if (!value) {
                    return Promise.reject(new Error("Ingresá el monto"));
                  }
                  if (isNaN(num) || num <= 0) {
                    return Promise.reject(
                      new Error("El monto debe ser mayor a 0")
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 5000"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Gastos;
