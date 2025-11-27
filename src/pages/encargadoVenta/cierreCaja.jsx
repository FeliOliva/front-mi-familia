import React, { useEffect, useState } from "react";
import { Button, Input, Spin, Alert, Table, notification } from "antd";

import { api } from "../../services/api";

const CierreCajaEncargado = () => {
  const [caja, setCaja] = useState(null);
  const [totalSistema, setTotalSistema] = useState(0); // total cobrado hoy
  const [totalCuentaCorriente, setTotalCuentaCorriente] = useState(0);
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

      // Totales del día por caja (mismo endpoint que usa el repartidor)
      const totales = await api("api/entregas/totales-dia-caja", "GET");
      const totalCaja =
        totales.find((t) => Number(t.cajaId) === Number(cajaId)) || {};

      // En este contexto:
      // totalEntregado = TODO lo cobrado hoy (cualquier método)
      // totalCuentaCorriente = ventas en estado 4 (CC)
      setTotalSistema(Number(totalCaja.totalEntregado || 0));
      setTotalCuentaCorriente(Number(totalCaja.totalCuentaCorriente || 0));

      // Puede venir metodosPago o metodospago según tu API
      setMetodosPago(totalCaja.metodosPago || totalCaja.metodospago || []);

      // Historial de cierres de esta caja + usuario
      setLoadingHistorial(true);
      const cierresRes = await api("api/cierres-caja", "GET");
      setCierres(
        cierresRes.filter(
          (c) => c.cajaId === cajaId && c.usuarioId === usuarioId
        )
      );
      setLoadingHistorial(false);
    } catch (err) {
      console.error(err);
      notification.error({
        message: "Error",
        description: "No se pudieron cargar los datos de la caja.",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [cajaId, usuarioId]);
  // Total de EFECTIVO según detalle de métodos
  const totalEfectivo = metodosPago
    .filter((m) => (m.nombre || "").toLowerCase() === "efectivo")
    .reduce((acc, m) => acc + Number(m.total || 0), 0);

  const handleCerrarCaja = async () => {
    setLoading(true);

    try {
      // totalVentas = todo lo vendido hoy = cobrado + cuenta corriente
      const totalVentas =
        Number(totalSistema || 0) + Number(totalCuentaCorriente || 0);

      // totalPagado = todo lo cobrado (cualquier método)
      const totalPagado = Number(totalSistema || 0);

      const payload = {
        usuarioId,
        cajaId,
        totalVentas,
        totalPagado,
        totalCuentaCorriente,
        totalEfectivo,
        ingresoLimpio: 0, // el encargado no cuenta billetes acá
        estado: 0, // igual que repartidor: pendiente / abierto
        // IMPORTANTE: usar el mismo nombre de propiedad que en Entregas.jsx
        metodoPago: metodosPago.map((m) => ({
          nombre: m.nombre,
          total: Number(m.total || 0),
        })),
      };

      console.log("Datos cierre encargado:", payload);

      await api("api/cierre-caja", "POST", payload);

      notification.success({
        message: "Cierre realizado",
        description: "El cierre de caja se guardó correctamente.",
      });

      await fetchData();
    } catch (err) {
      console.error(err);
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
      title: "Cobrado (sistema)",
      dataIndex: "totalPagado",
      key: "totalPagado",
      render: (v) => `$${v}`,
    },
    {
      title: "Cuenta Corriente",
      dataIndex: "totalCuentaCorriente",
      key: "totalCuentaCorriente",
      render: (v) => `$${v}`,
    },
    {
      title: "Diferencia",
      dataIndex: "ingresoLimpio",
      key: "ingresoLimpio",
      render: (v) => (
        <span style={{ color: Number(v) === 0 ? "green" : "red" }}>${v}</span>
      ),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (estado) =>
        Number(estado) === 0 ? (
          <span style={{ color: "#faad14" }}>Pendiente</span>
        ) : (
          <span style={{ color: "#52c41a" }}>Cerrado</span>
        ),
    },
  ];

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Cierre de Caja (Encargado)</h2>
      {loading ? (
        <Spin />
      ) : (
        <>
          <div className="mb-2">
            <strong>Caja:</strong> {caja?.nombre || "-"}
          </div>
          <div className="mb-2">
            <strong>Total cobrado (sistema):</strong> $
            {totalSistema?.toLocaleString("es-AR") || 0}
          </div>
          <div className="mb-2">
            <strong>Total en Cuenta Corriente:</strong> $
            {totalCuentaCorriente?.toLocaleString("es-AR") || 0}
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
                    ${Number(m.total || 0).toLocaleString("es-AR")}
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
