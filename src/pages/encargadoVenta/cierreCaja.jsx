import React, { useEffect, useState } from "react";
import { Button, Input, Spin, Alert, Table, notification } from "antd";

import { api } from "../../services/api";

const CierreCajaEncargado = () => {
  const [caja, setCaja] = useState(null);
  const [totalSistema, setTotalSistema] = useState(0);
  const [montoContado, setMontoContado] = useState("");
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [metodosPago, setMetodosPago] = useState([]);

  const cajaId = Number(sessionStorage.getItem("cajaId"));
  const usuarioId = Number(sessionStorage.getItem("usuarioId"));

  const fetchData = async () => {
    setLoading(true);
    try {
      // Info de la caja
      const cajaRes = await api(`api/caja/${cajaId}`, "GET");
      setCaja(cajaRes);

      // Total sistema y métodos de pago
      const totales = await api("api/entregas/totales-dia-caja");
      const totalCaja = totales.find((t) => t.cajaId === cajaId);
      setTotalSistema(totalCaja?.totalEntregado || 0);
      setMetodosPago(totalCaja?.metodosPago || []);

      // Historial de cierres
      setLoadingHistorial(true);
      const cierresRes = await api("api/cierres-caja");
      setCierres(
        cierresRes.filter(
          (c) => c.cajaId === cajaId && c.usuarioId === usuarioId
        )
      );
      setLoadingHistorial(false);
    } catch (err) {
      notification.error({
        message: "Error",
        description: "No se pudieron cargar los datos de la caja.",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [cajaId, usuarioId]);
  const totalEfectivo = metodosPago
    .filter((m) => m.nombre.toLowerCase() === "efectivo")
    .reduce((acc, m) => acc + m.total, 0);

  const handleCerrarCaja = async () => {
    setLoading(true);
    console.log("Datos para cierre:", {
      cajaId,
      totalSistema,
      totalEfectivo,
      metodosPago,
      usuarioId,
    });
    try {
      await api("api/cierre-caja", "POST", {
        cajaId,
        totalVentas: totalSistema,
        totalEfectivo: totalEfectivo,
        totalPagado: totalSistema, // Usa el total del sistema como contado
        ingresoLimpio: 0, // Diferencia siempre 0
        metodosPago: metodosPago.map((m) => ({
          nombre: m.nombre,
          total: m.total,
        })),
        estado: 0,
      });
      notification.success({
        message: "Cierre realizado",
        description: "El cierre de caja se guardó correctamente.",
      });
      setCaja(null);
      setTotalSistema(0);
      await fetchData();
    } catch (err) {
      notification.error({
        message: "Error",
        description: "No se pudo realizar el cierre de caja.",
      });
    }
    setLoading(false);
  };
  // Columnas para el historial
  const columns = [
    {
      title: "Fecha",
      dataIndex: "fecha",
      key: "fecha",
      render: (fecha) => new Date(fecha).toLocaleString("es-AR"),
    },
    {
      title: "Total sistema",
      dataIndex: "totalVentas",
      key: "totalVentas",
      render: (v) => `$${v}`,
    },
    {
      title: "Contado",
      dataIndex: "totalPagado",
      key: "totalPagado",
      render: (v) => `$${v}`,
    },
    {
      title: "Diferencia",
      dataIndex: "ingresoLimpio",
      key: "ingresoLimpio",
      render: (v) => (
        <span style={{ color: v === 0 ? "green" : "red" }}>${v}</span>
      ),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (estado) =>
        estado === "pendiente" ? (
          <span style={{ color: "#faad14" }}>Pendiente</span>
        ) : (
          <span style={{ color: "#52c41a" }}>Cerrado</span>
        ),
    },
  ];

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Cierre de Caja</h2>
      {loading ? (
        <Spin />
      ) : (
        <>
          <div className="mb-2">
            <strong>Caja:</strong> {caja?.nombre || "-"}
          </div>
          <div className="mb-2">
            <strong>Total sistema:</strong> $
            {totalSistema?.toLocaleString() || 0}
          </div>
          <div className="mb-2">
            <h3 className="font-semibold mb-2">Detalle por método de pago:</h3>
            <ul style={{ paddingLeft: 0, listStyle: "none" }}>
              {metodosPago.length === 0 && <li>No hay datos</li>}
              {metodosPago.map((m) => (
                <li
                  key={m.nombre}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span className="capitalize">{m.nombre}</span>
                  <span style={{ fontWeight: "bold" }}>
                    ${m.total?.toLocaleString("es-AR")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Button
            type="primary"
            onClick={handleCerrarCaja}
            loading={loading}
            block
          >
            Cerrar Caja
          </Button>
        </>
      )}

      <h3 className="text-xl font-semibold mt-8 mb-2">Historial de Cierres</h3>
      <Table
        columns={columns}
        dataSource={cierres}
        rowKey="id"
        loading={loadingHistorial}
        pagination={{ pageSize: 5 }}
        size="small"
      />
    </div>
  );
};

export default CierreCajaEncargado;
