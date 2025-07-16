import React, { useEffect, useState } from "react";
import { api } from "../../services/api";
import { PrinterOutlined } from "@ant-design/icons";

const CierreCajaGeneral = () => {
  const [cajas, setCajas] = useState([]);
  const [montosContados, setMontosContados] = useState({});
  const [loading, setLoading] = useState(false);
  const [totalesEntregas, setTotalesEntregas] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [notification, setNotification] = useState(null);
  const [detalleMetodos, setDetalleMetodos] = useState([]);
  const [mostrarDetalleId, setMostrarDetalleId] = useState(null);

  useEffect(() => {
    api("api/caja", "GET").then((data) => setCajas(data));
    api("api/entregas/totales-dia-caja", "GET").then((data) =>
      setTotalesEntregas(data)
    );
    api("api/cierres-caja", "GET").then((data) => setCierres(data));
  }, []);
  const verDetalleMetodos = async (cierreId) => {
    const data = await api(
      `api/cierre-caja/${cierreId}/detalle-metodos`,
      "GET"
    );
    setDetalleMetodos(data);
    setMostrarDetalleId(cierreId);
  };
  const showNotification = (type, message, description) => {
    setNotification({ type, message, description });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleInputChange = (cajaId, value) => {
    setMontosContados((prev) => ({ ...prev, [cajaId]: value }));
  };

  const getTotalSistema = (cajaId) => {
    const encontrado = totalesEntregas.find((t) => t.cajaId === cajaId);
    return encontrado ? encontrado.totalEntregado : 0;
  };
  const getTotalEfectivo = (cajaId) => {
    const encontrado = totalesEntregas.find((t) => t.cajaId === cajaId);
    return encontrado ? encontrado.totalEfectivo : 0;
  };
  const getMetodosPagoPorCaja = (cajaId) => {
    const encontrado = totalesEntregas.find((t) => t.cajaId === cajaId);
    return encontrado?.metodosPago || [];
  };

  const handleCerrarCaja = async (caja) => {
    setLoading(true);
    const contado = montosContados[caja.id] || 0;
    const totalSistema = getTotalSistema(caja.id);
    const efectivo = getTotalEfectivo(caja.id);
    const diferencia = contado - efectivo;
    const metodosPago = getMetodosPagoPorCaja(caja.id);
    try {
      await api(
        "api/cierre-caja",
        "POST",
        JSON.stringify({
          cajaId: caja.id,
          usuarioId: parseInt(sessionStorage.getItem("usuarioId")),
          totalVentas: totalSistema,
          totalPagado: contado,
          ingresoLimpio: diferencia,
          totalEfectivo: efectivo,
          estado: 1, // 1 para cerrado 0 para pendiente
          metodosPago: metodosPago.map((m) => ({
            nombre: m.nombre,
            total: m.total,
          })),
        })
      );

      showNotification(
        "success",
        "Cierre realizado",
        `Cierre de caja ${caja.nombre} guardado. Diferencia: $${diferencia}`
      );

      // Refrescar datos
      const nuevosCierres = await api("api/cierres-caja", "GET");
      setCierres(nuevosCierres);
      const nuevasCajas = await api("api/caja", "GET");
      setCajas(nuevasCajas);
      // --- AGREGAR ESTA LÍNEA PARA ACTUALIZAR SISTEMA Y DIFERENCIA ---
      const nuevosTotales = await api("api/entregas/totales-dia-caja", "GET");
      setTotalesEntregas(nuevosTotales);
      // ---------------------------------------------------------------
      setMontosContados((prev) => ({ ...prev, [caja.id]: 0 }));
    } catch (error) {
      showNotification("error", "Error al cerrar caja", error.message);
    }
    setLoading(false);
  };

  const capitalize = (str) =>
    str && typeof str === "string"
      ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
      : "";

  const handleImprimirCierre = async (cierre) => {
    let metodosPago = cierre.metodosPago;
    // Si no viene el detalle, lo traemos por API
    if (!metodosPago || metodosPago.length === 0) {
      try {
        metodosPago = await api(
          `api/cierre-caja/${cierre.id}/detalle-metodos`,
          "GET"
        );
      } catch (e) {
        metodosPago = [];
      }
    }

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
    <html>
      <head>
        <title>Cierre de Caja</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h2 { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        </style>
      </head>
      <body>
        <h2>Cierre de Caja</h2>
        <p><strong>Fecha:</strong> ${new Date(cierre.fecha).toLocaleString(
          "es-AR"
        )}</p>
        <p><strong>Caja:</strong> ${cierre.caja?.nombre || "-"}</p>
        <p><strong>Usuario:</strong> ${cierre.usuario?.usuario || "-"}</p>
        <p><strong>Total Sistema:</strong> $${cierre.totalVentas?.toLocaleString(
          "es-AR"
        )}</p>
        <p><strong>Total Efectivo:</strong> $${cierre.totalEfectivo?.toLocaleString(
          "es-AR"
        )}</p>
        <p><strong>Contado:</strong> $${cierre.totalPagado?.toLocaleString(
          "es-AR"
        )}</p>
        <p><strong>Diferencia:</strong> $${cierre.ingresoLimpio?.toLocaleString(
          "es-AR"
        )}</p>
        <p><strong>Estado:</strong> ${
          cierre.estado === 0 ? "Abierta" : "Cerrada"
        }</p>
        <h3>Detalle de Métodos de Pago</h3>
        <table>
          <thead>
            <tr>
              <th>Método</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${(metodosPago || [])
              .map(
                (m) => `
              <tr >
                <td>${capitalize(m.metodoPago || m.nombre)}</td>
                <td>$${(m.total || 0).toLocaleString("es-AR")}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `);
    printWindow.document.close();
    printWindow.print();
  };

  const formatCurrency = (value) => `$${value?.toLocaleString() || 0}`;
  const formatDate = (date) => new Date(date).toLocaleString();
  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
            notification.type === "success"
              ? "bg-green-100 border-green-500 text-green-800"
              : "bg-red-100 border-red-500 text-red-800"
          } border-l-4`}
        >
          <h4 className="font-semibold">{notification.message}</h4>
          <p className="text-sm">{notification.description}</p>
        </div>
      )}

      {/* Cierre de Cajas */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Cierre de Caja General
          </h2>
        </div>

        {/* Vista Desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Caja
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Sistema
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Efectivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diferencia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cajas.map((caja) => {
                const contado = montosContados[caja.id] || 0;
                const sistema = getTotalSistema(caja.id);
                const efectivo = getTotalEfectivo(caja.id);
                const diferencia = contado - efectivo;

                return (
                  <tr key={caja.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {caja.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(sistema)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(efectivo)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={montosContados[caja.id] || ""}
                        onChange={(e) =>
                          handleInputChange(
                            caja.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(diferencia)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleCerrarCaja(caja)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        {loading ? "Cerrando..." : "Cerrar Caja"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {mostrarDetalleId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
                <h3 className="text-lg font-semibold mb-4">
                  Detalle de Métodos de Pago
                </h3>
                <ul className="space-y-2">
                  {detalleMetodos.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span className="capitalize">{m.metodoPago}</span>
                      <span className="font-semibold">
                        ${m.total.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setMostrarDetalleId(null)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
                <div className="mt-6 text-right">
                  <button
                    onClick={() => setMostrarDetalleId(null)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vista Mobile */}
        <div className="lg:hidden">
          {cajas.map((caja) => {
            const contado = montosContados[caja.id] || 0;
            const sistema = getTotalSistema(caja.id);
            const diferencia = contado - sistema;

            return (
              <div
                key={caja.id}
                className="p-4 border-b border-gray-200 last:border-b-0"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">
                      {caja.nombre}
                    </span>
                    <span className="text-sm text-gray-500">
                      Sistema: {formatCurrency(sistema)}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-600 min-w-0">
                        Contado:
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={montosContados[caja.id] || ""}
                        onChange={(e) =>
                          handleInputChange(
                            caja.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>

                    <div className="text-sm">
                      <span className="text-gray-600">Diferencia: </span>
                      <span
                        className={`font-medium ${
                          diferencia >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(diferencia)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCerrarCaja(caja)}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {loading ? "Cerrando..." : "Cerrar Caja"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historial de Cierres */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Historial de Cierres de Caja
          </h2>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Caja
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Sistema
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Efectivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diferencia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detalles
                </th>
                <th className="px-9 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cierres.map((cierre) => (
                <tr key={cierre.id}>
                  <td className="px-2 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleImprimirCierre(cierre)}
                      disabled={cierre.estado !== 2}
                      className={`bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded-md text-sm ${
                        cierre.estado !== 2
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      title={
                        cierre.estado !== 2
                          ? "Solo se puede imprimir si la caja esta cerrada"
                          : "Imprimir cierre"
                      }
                    >
                      <PrinterOutlined />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(cierre.fecha)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cierre.usuario?.usuario}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cierre.caja?.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(cierre.totalVentas)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(cierre.totalEfectivo)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(cierre.totalPagado)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(cierre.ingresoLimpio)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        cierre.estado === 0
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {cierre.estado === 0 ? "Abierta" : "Cerrada"}
                    </span>
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap">
                    <button
                      onClick={() => verDetalleMetodos(cierre.id)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 rounded-md text-sm"
                    >
                      Ver detalles
                    </button>
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap">
                    <button
                      onClick={() => {
                        const nuevoMonto = prompt(
                          "Ingrese el nuevo monto contado:",
                          cierre.totalEfectivo
                        );
                        if (nuevoMonto !== null) {
                          api(
                            `api/cierre-caja/${cierre.id}`,
                            "PATCH",
                            JSON.stringify({
                              totalPagado: parseFloat(nuevoMonto),
                              estado: 1, // 1 para cerrado
                            })
                          )
                            .then(() => {
                              showNotification(
                                "success",
                                "Monto actualizado",
                                "El cierre fue actualizado."
                              );
                              api("api/cierres-caja", "GET").then((data) =>
                                setCierres(data)
                              );
                            })
                            .catch(() =>
                              showNotification(
                                "error",
                                "Error",
                                "No se pudo actualizar el monto contado"
                              )
                            );
                        }
                      }}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
                    >
                      Editar Contado
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Vista Mobile */}
        <div className="lg:hidden">
          {cierres.map((cierre) => (
            <div
              key={cierre.id}
              className="p-4 border-b border-gray-200 last:border-b-0"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {cierre.caja?.nombre}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(cierre.fecha)}
                    </div>
                  </div>
                  <span
                    className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                      cierre.estado === 0
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {cierre.estado === 0 ? "Abierta" : "Cerrada"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Usuario:</span>
                    <div className="font-medium">{cierre.usuario?.usuario}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Sistema:</span>
                    <div className="font-medium">
                      {formatCurrency(cierre.totalVentas)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Efectivo:</span>
                    <div className="font-medium">
                      {formatCurrency(cierre.totalEfectivo)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Contado:</span>
                    <div className="font-medium">
                      {formatCurrency(cierre.totalPagado)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Diferencia:</span>
                    <div
                      className={`font-medium ${
                        cierre.ingresoLimpio >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(cierre.ingresoLimpio)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => verDetalleMetodos(cierre.id)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm"
                  >
                    Ver detalles
                  </button>

                  <button
                    onClick={() => {
                      const nuevoMonto = prompt(
                        "Nuevo monto contado:",
                        cierre.totalPagado
                      );
                      if (nuevoMonto !== null) {
                        api(
                          `api/cierre-caja/${cierre.id}`,
                          "PATCH",
                          JSON.stringify({
                            totalPagado: parseFloat(nuevoMonto),
                            estado: 1,
                          })
                        )
                          .then(() => {
                            showNotification(
                              "success",
                              "Monto actualizado",
                              "El cierre fue actualizado."
                            );
                            api("api/cierres-caja", "GET").then((data) =>
                              setCierres(data)
                            );
                          })
                          .catch(() =>
                            showNotification(
                              "error",
                              "Error",
                              "No se pudo actualizar el monto contado"
                            )
                          );
                      }
                    }}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm"
                  >
                    Editar Contado
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CierreCajaGeneral;
