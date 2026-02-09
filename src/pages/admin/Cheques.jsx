import React, { useEffect, useState } from "react";
import {
  Table,
  message,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Popconfirm,
  Card,
  Empty,
  DatePicker,
  Tag,
} from "antd";
import { api } from "../../services/api";
import { EditOutlined, DeleteOutlined, CheckCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const Cheques = () => {
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [negocios, setNegocios] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCheque, setEditingCheque] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form] = Form.useForm();

  const fetchCheques = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      const data = await api(`api/cheques?${params.toString()}`);
      setCheques(data.cheques || []);
      setTotal(data.total || 0);
      setCurrentPage(data.currentPage || page);
    } catch (error) {
      message.error(error.message || "Error al cargar los cheques");
    } finally {
      setLoading(false);
    }
  };

  const fetchNegocios = async () => {
    try {
      const data = await api("api/getAllNegocios");
      const list = Array.isArray(data) ? data : data?.negocios || [];
      setNegocios(list);
    } catch (error) {
      message.error(error.message || "Error al cargar negocios");
    }
  };

  useEffect(() => {
    fetchCheques();
    fetchNegocios();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const formatCurrency = (value) =>
    `$${Number(value || 0).toLocaleString("es-AR")}`;

  const formatDate = (dateStr) =>
    dateStr ? dayjs(dateStr).format("DD/MM/YYYY") : "-";

  const handleEdit = (cheque) => {
    setEditingCheque(cheque);
    form.setFieldsValue({
      banco: cheque.banco || "",
      nroCheque: cheque.nroCheque || "",
      fechaEmision: cheque.fechaEmision ? dayjs(cheque.fechaEmision) : null,
      fechaCobro: cheque.fechaCobro ? dayjs(cheque.fechaCobro) : null,
      monto: cheque.monto != null ? Number(cheque.monto) : undefined,
      negocioId: cheque.negocioId != null ? cheque.negocioId : undefined,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!editingCheque) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api(`api/cheques/${editingCheque.id}`, "PUT", {
        banco: String(values.banco || "").trim(),
        nroCheque: String(values.nroCheque || "").trim(),
        fechaEmision: dayjs(values.fechaEmision).format("DD/MM/YYYY"),
        fechaCobro: dayjs(values.fechaCobro).format("DD/MM/YYYY"),
        monto: Number(values.monto),
        negocioId: Number(values.negocioId),
      });
      message.success("Cheque actualizado correctamente");
      setModalVisible(false);
      form.resetFields();
      setEditingCheque(null);
      fetchCheques(currentPage);
    } catch (error) {
      message.error(error.message || "Error al guardar el cheque");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api(`api/cheques/${id}`, "DELETE");
      message.success("Cheque eliminado correctamente");
      fetchCheques(currentPage);
    } catch (error) {
      message.error(error.message || "Error al eliminar el cheque");
    }
  };

  const handleReactivar = async (id) => {
    try {
      await api(`api/cheques/${id}`, "POST");
      message.success("Cheque reactivado correctamente");
      fetchCheques(currentPage);
    } catch (error) {
      message.error(error.message || "Error al reactivar el cheque");
    }
  };

  const columns = [
    {
      title: "Nº Cheque",
      dataIndex: "nroCheque",
      key: "nroCheque",
      width: 120,
      ellipsis: true,
    },
    {
      title: "Banco",
      dataIndex: "banco",
      key: "banco",
      width: 120,
      ellipsis: true,
    },
    {
      title: "F. Emisión",
      dataIndex: "fechaEmision",
      key: "fechaEmision",
      width: 110,
      render: (v) => formatDate(v),
    },
    {
      title: "F. Cobro",
      dataIndex: "fechaCobro",
      key: "fechaCobro",
      width: 110,
      render: (v) => formatDate(v),
    },
    {
      title: "Monto",
      dataIndex: "monto",
      key: "monto",
      width: 110,
      align: "right",
      render: (v) => formatCurrency(v),
    },
    {
      title: "Negocio",
      key: "negocio",
      width: 160,
      ellipsis: true,
      render: (_, r) => r.negocio?.nombre ?? "-",
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      width: 100,
      render: (estado) =>
        estado === 1 ? (
          <Tag color="green">Activo</Tag>
        ) : (
          <Tag color="default">Inactivo</Tag>
        ),
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 180,
      fixed: "right",
      render: (_, record) => (
        <Space wrap>
          {record.estado === 1 ? (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                Editar
              </Button>
              <Popconfirm
                title="¿Eliminar este cheque?"
                onConfirm={() => handleDelete(record.id)}
                okText="Sí"
                cancelText="No"
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  Eliminar
                </Button>
              </Popconfirm>
            </>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleReactivar(record.id)}
            >
              Reactivar
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Solo mostrar cheques activos en la tabla por defecto; opcionalmente podés mostrar todos y filtrar por estado
  const dataSource = cheques;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Cheques</h1>
          <p className="text-sm text-gray-500">
            Consultá y editá los cheques registrados en el sistema
          </p>
        </div>
      </div>

      {!loading && dataSource.length === 0 ? (
        <Card>
          <Empty description="No hay cheques registrados" />
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {dataSource.map((c) => (
            <Card key={c.id} className="shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500">Nº Cheque</p>
                    <p className="font-medium">{c.nroCheque}</p>
                  </div>
                  <Tag color={c.estado === 1 ? "green" : "default"}>
                    {c.estado === 1 ? "Activo" : "Inactivo"}
                  </Tag>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Banco / Negocio</p>
                  <p className="text-gray-900">{c.banco} – {c.negocio?.nombre ?? "-"}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <span>Emisión: {formatDate(c.fechaEmision)}</span>
                  <span>Cobro: {formatDate(c.fechaCobro)}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Monto</p>
                  <p className="text-lg font-semibold">{formatCurrency(c.monto)}</p>
                </div>
                <div className="flex gap-2 mt-2">
                  {c.estado === 1 ? (
                    <>
                      <Button
                        type="default"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(c)}
                        block
                      >
                        Editar
                      </Button>
                      <Popconfirm
                        title="¿Eliminar este cheque?"
                        onConfirm={() => handleDelete(c.id)}
                        okText="Sí"
                        cancelText="No"
                      >
                        <Button danger size="small" icon={<DeleteOutlined />} block>
                          Eliminar
                        </Button>
                      </Popconfirm>
                    </>
                  ) : (
                    <Button
                      type="default"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleReactivar(c.id)}
                      block
                    >
                      Reactivar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 900 }}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            onChange: (page) => fetchCheques(page),
            showSizeChanger: false,
            showTotal: (t) => `Total: ${t} cheques`,
          }}
        />
      )}

      <Modal
        title="Editar cheque"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingCheque(null);
        }}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={saving}
        width={isMobile ? "95%" : 480}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="banco"
            label="Banco"
            rules={[{ required: true, message: "Ingresá el banco" }]}
          >
            <Input placeholder="Ej: Nación" />
          </Form.Item>
          <Form.Item
            name="nroCheque"
            label="Número de cheque"
            rules={[{ required: true, message: "Ingresá el número de cheque" }]}
          >
            <Input placeholder="Ej: 0213145123" />
          </Form.Item>
          <Form.Item
            name="fechaEmision"
            label="Fecha de emisión"
            rules={[{ required: true, message: "Seleccioná la fecha de emisión" }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="fechaCobro"
            label="Fecha de cobro"
            rules={[{ required: true, message: "Seleccioná la fecha de cobro" }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="monto"
            label="Monto"
            rules={[
              { required: true, message: "Ingresá el monto" },
              {
                validator: (_, value) => {
                  const n = Number(value);
                  if (value == null || value === "") return Promise.reject(new Error("Ingresá el monto"));
                  if (isNaN(n) || n <= 0) return Promise.reject(new Error("El monto debe ser mayor a 0"));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              min={0.01}
              step={1}
              style={{ width: "100%" }}
              placeholder="Monto"
            />
          </Form.Item>
          <Form.Item
            name="negocioId"
            label="Negocio"
            rules={[{ required: true, message: "Seleccioná un negocio" }]}
          >
            <Select
              placeholder="Seleccionar negocio"
              allowClear={false}
              showSearch
              optionFilterProp="label"
              options={negocios.map((n) => ({ value: n.id, label: n.nombre }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Cheques;
