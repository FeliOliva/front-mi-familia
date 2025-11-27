import React, { useEffect, useState } from "react";
import { api } from "../../services/api";
import { PrinterOutlined } from "@ant-design/icons";
import { Tooltip, Modal, Button, Input } from "antd";

const CierreCajaGeneral = () => {
  const [cajas, setCajas] = useState([]);
  const [montosContados, setMontosContados] = useState({});
  const [loading, setLoading] = useState(false);
  const [totalesEntregas, setTotalesEntregas] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [notification, setNotification] = useState(null);
  const [detalleMetodos, setDetalleMetodos] = useState([]);
  const [detalleModalVisible, setDetalleModalVisible] = useState(false);
  const [cierreSeleccionado, setCierreSeleccionado] = useState(null);

  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [cierreEditando, setCierreEditando] = useState(null);
  const [montoEditando, setMontoEditando] = useState("");

  useEffect(() => {
    api("api/caja", "GET").then((data) => setCajas(data));
    api("api/entregas/totales-dia-caja", "GET").then((data) =>
      setTotalesEntregas(data)
    );
    api("api/cierres-caja", "GET").then((data) => setCierres(data));
  }, []);
  // NUEVA VERSIÓN
  const verDetalleMetodos = async (cierre) => {
    try {
      const data = await api(
        `api/cierre-caja/${cierre.id}/detalle-ventas`,
        "GET"
      );
      setDetalleMetodos(data);
      setCierreSeleccionado(cierre);
      setDetalleModalVisible(true);
    } catch (error) {
      console.error("Error cargando detalle de métodos:", error);
    }
  };

  const showNotification = (type, message, description) => {
    setNotification({ type, message, description });
    setTimeout(() => setNotification(null), 4000);
  };
  const abrirModalEditar = (cierre) => {
    setCierreEditando(cierre);
    // Uso ingresoLimpio si existe, si no, totalPagado como fallback
    const valorInicial = cierre.ingresoLimpio ?? cierre.totalPagado ?? 0;
    setMontoEditando(String(valorInicial));
    setModalEditarVisible(true);
  };

  const cerrarModalEditar = () => {
    setModalEditarVisible(false);
    setCierreEditando(null);
    setMontoEditando("");
  };

  const guardarMontoEditado = async () => {
    if (!cierreEditando) return;

    const montoNum = parseFloat(String(montoEditando).replace(",", "."));

    if (Number.isNaN(montoNum) || montoNum < 0) {
      showNotification(
        "error",
        "Monto inválido",
        "Ingresá un monto contado válido (número positivo)."
      );
      return;
    }

    try {
      await api(
        `api/cierre-caja/${cierreEditando.id}`,
        "PATCH",
        JSON.stringify({
          ingresoLimpio: montoNum,
          estado: 1,
        })
      );

      showNotification(
        "success",
        "Monto actualizado",
        "El cierre fue actualizado."
      );

      const data = await api("api/cierres-caja", "GET");
      setCierres(data);
      cerrarModalEditar();
    } catch (error) {
      console.error("Error actualizando monto contado:", error);
      showNotification(
        "error",
        "Error",
        "No se pudo actualizar el monto contado"
      );
    }
  };

  const handleInputChange = (cajaId, value) => {
    setMontosContados((prev) => ({ ...prev, [cajaId]: value }));
  };

  const getTotalSistema = (cajaId) => {
    const encontrado = totalesEntregas.find((t) => t.cajaId === cajaId);
    console.log("Total sistema", encontrado);
    return encontrado ? encontrado.totalEntregado : 0;
  };
  const getTotalEfectivo = (cajaId) => {
    const encontrado = totalesEntregas.find((t) => t.cajaId === cajaId);
    return encontrado ? encontrado.totalEfectivo : 0;
  };
  const getTotalCuentaCorriente = (cajaId) => {
    const encontrado = totalesEntregas.find((t) => t.cajaId === cajaId);
    return encontrado ? encontrado.totalCuentaCorriente || 0 : 0;
  };
  const getMetodosPagoPorCaja = (cajaId) => {
    const encontrado = totalesEntregas.find((t) => t.cajaId === cajaId);
    // soporta ambas formas: metodosPago (futuro) o metodospago (actual)
    return encontrado?.metodosPago || encontrado?.metodospago || [];
  };

  const handleCerrarCaja = async (caja) => {
    setLoading(true);

    const contado = montosContados[caja.id] || 0;
    const totalSistema = getTotalSistema(caja.id); // totalEntregado del día
    const efectivo = getTotalEfectivo(caja.id); // totalEfectivo del día
    const totalCC = getTotalCuentaCorriente(caja.id);
    const diferencia = contado - efectivo; // solo para mostrar en UI
    const metodosPago = getMetodosPagoPorCaja(caja.id);

    try {
      await api(
        "api/cierre-caja",
        "POST",
        JSON.stringify({
          cajaId: caja.id,
          usuarioId: parseInt(sessionStorage.getItem("usuarioId")),
          // Total de entregas (lo que trajo el repartidor)
          totalVentas: totalSistema,
          // Total cobrado por sistema (todas las entregas, cualquier método)
          totalPagado: totalSistema,
          // Total en cuenta corriente que vino de esa caja ese día
          totalCuentaCorriente: totalCC,
          // Total cobrado en EFECTIVO según entregas
          totalEfectivo: efectivo,
          // Efectivo contado físicamente por el admin
          ingresoLimpio: contado,
          // 1 = cierre definitivo
          estado: 1,
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

      // refrescar
      const nuevosCierres = await api("api/cierres-caja", "GET");
      setCierres(nuevosCierres);
      const nuevasCajas = await api("api/caja", "GET");
      setCajas(nuevasCajas);
      const nuevosTotales = await api("api/entregas/totales-dia-caja", "GET");
      setTotalesEntregas(nuevosTotales);

      setMontosContados((prev) => ({ ...prev, [caja.id]: 0 }));
    } catch (error) {
      showNotification("error", "Error al cerrar caja", error.message);
    }
    setLoading(false);
  };
  // Agrupa registros [{metodoPago, nroVenta, monto}] por método
  const agruparPorMetodoYVenta = (items = []) => {
    const map = {};

    (items || []).forEach((r) => {
      if (!r) return;
      const metodo = r.metodoPago || "SIN MÉTODO";
      const monto = Number(r.monto || 0);

      if (!map[metodo]) {
        map[metodo] = {
          metodo,
          total: 0,
          ventas: [],
        };
      }

      map[metodo].total += monto;
      map[metodo].ventas.push({
        ventaId: r.ventaId,
        nroVenta: r.nroVenta,
        negocioNombre: r.negocioNombre || null,
        monto,
      });
    });

    return Object.values(map);
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
        <p><strong>Total Ventas:</strong> $${cierre.totalVentas?.toLocaleString(
          "es-AR"
        )}</p>
        <p><strong>Total Pagado:</strong> $${cierre.totalPagado?.toLocaleString(
          "es-AR"
        )}</p>
        <p><strong>Total en Efectivo:</strong> $${cierre.totalEfectivo?.toLocaleString(
          "es-AR"
        )}</p>
        <p><strong>Total Cuenta Corriente:</strong> $${cierre.totalCuentaCorriente?.toLocaleString(
          "es-AR"
        )}</p>
        <p><strong>Efectivo Contado:</strong> $${cierre.ingresoLimpio?.toLocaleString(
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
  // Agrupa los métodos de pago por nombre y suma los totales
  const agruparMetodos = (items = []) => {
    const acc = {};
    items.forEach((m) => {
      const nombre = m.metodoPago || m.nombre;
      if (!nombre) return;

      const monto = Number(m.total || 0);
      if (!acc[nombre]) {
        acc[nombre] = { nombre, total: 0 };
      }
      acc[nombre].total += monto;
    });
    return Object.values(acc);
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
                  Total Entregado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Efectivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Otros
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Cuenta Corriente
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cajas
                .filter((caja) => caja.id != 1)
                .map((caja) => {
                  const totales =
                    totalesEntregas.find((t) => t.cajaId === caja.id) || {};
                  return (
                    <tr key={caja.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {caja.nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(totales.totalEntregado || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(totales.totalEfectivo || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(totales.totalOtros || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(totales.totalCuentaCorriente || 0)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Vista Mobile */}
        <div className="lg:hidden">
          {cajas
            .filter((caja) => caja.id != 1)
            .map((caja) => {
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
                  <Tooltip title="Total de ventas o total cobrado del día según cómo se generó el cierre">
                    <span className="cursor-help">Total Ventas</span>
                  </Tooltip>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip title="Total registrado como pagado en el cierre (puede ser total cobrado por sistema o el contado, según el origen)">
                    <span className="cursor-help">Total Cobrado</span>
                  </Tooltip>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip title="Total enviado a cuenta corriente en este cierre">
                    <span className="cursor-help">Total Cuenta Corriente</span>
                  </Tooltip>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip title="Total cobrado en efectivo según el sistema">
                    <span className="cursor-help">Total Efectivo</span>
                  </Tooltip>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip title="Monto contado físicamente al cierre (totalPagado en tu modelo actual)">
                    <span className="cursor-help">Contado</span>
                  </Tooltip>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip title="Diferencia entre el contado y lo que indica el sistema">
                    <span className="cursor-help">Diferencia</span>
                  </Tooltip>
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
                  {/* Columna imprimir */}
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
                          ? "Solo se puede imprimir si la caja está cerrada"
                          : "Imprimir cierre"
                      }
                    >
                      <PrinterOutlined />
                    </button>
                  </td>

                  {/* Fecha */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(cierre.fecha)}
                  </td>

                  {/* Usuario */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cierre.usuario?.usuario}
                  </td>

                  {/* Caja */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cierre.caja?.nombre}
                  </td>

                  <td>{formatCurrency(cierre.totalVentas)}</td>
                  <td>{formatCurrency(cierre.totalPagado)}</td>
                  <td>{formatCurrency(cierre.totalCuentaCorriente)}</td>
                  <td>{formatCurrency(cierre.totalEfectivo)}</td>
                  <td>{formatCurrency(cierre.ingresoLimpio)}</td>
                  <td>
                    {formatCurrency(
                      (cierre.ingresoLimpio || 0) - (cierre.totalEfectivo || 0)
                    )}
                  </td>

                  {/* Estado */}
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
                      onClick={() => verDetalleMetodos(cierre)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm"
                    >
                      Ver detalles
                    </button>
                  </td>

                  {/* Editar Contado */}
                  <td className="px-2 py-4 whitespace-nowrap">
                    <button
                      onClick={() => abrirModalEditar(cierre)}
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
                    onClick={() => verDetalleMetodos(cierre)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm"
                  >
                    Ver detalles
                  </button>

                  <button
                    onClick={() => abrirModalEditar(cierre)}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm"
                  >
                    Editar Contado
                  </button>
                </div>
              </div>
            </div>
          ))}
          <Modal
            open={modalEditarVisible}
            onCancel={cerrarModalEditar}
            title={
              cierreEditando
                ? `Editar contado - ${cierreEditando.caja?.nombre || "Caja"}`
                : "Editar contado"
            }
            footer={[
              <Button key="cancel" onClick={cerrarModalEditar}>
                Cancelar
              </Button>,
              <Button key="save" type="primary" onClick={guardarMontoEditado}>
                Guardar
              </Button>,
            ]}
          >
            <p className="mb-2 text-sm text-gray-600">
              Ingresá el monto contado físicamente para esta caja.
            </p>
            <Input
              value={montoEditando}
              onChange={(e) => setMontoEditando(e.target.value)}
              prefix="$"
              type="number"
              min="0"
            />
          </Modal>
          <Modal
            open={detalleModalVisible}
            onCancel={() => setDetalleModalVisible(false)}
            footer={[
              <Button key="close" onClick={() => setDetalleModalVisible(false)}>
                Cerrar
              </Button>,
            ]}
            title={
              cierreSeleccionado
                ? `Métodos de pago - ${
                    cierreSeleccionado.caja?.nombre || "Caja"
                  } (${formatDate(cierreSeleccionado.fecha)})`
                : "Métodos de pago"
            }
          >
            {detalleMetodos.length === 0 ? (
              <p className="text-sm text-gray-500">
                No hay métodos de pago registrados para este cierre.
              </p>
            ) : (
              (() => {
                const grupos = agruparPorMetodoYVenta(detalleMetodos);

                return (
                  <div className="space-y-6">
                    {grupos.map((g) => (
                      <div key={g.metodo}>
                        {/* Método centrado arriba */}
                        <div className="text-center font-semibold mb-2">
                          {g.metodo}
                        </div>

                        {/* Tabla solo con Negocio / Venta / Monto */}
                        <table className="min-w-full border border-gray-200 text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">
                                Negocio
                              </th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">
                                Venta
                              </th>
                              <th className="px-4 py-2 text-right font-medium text-gray-600">
                                Monto
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.ventas.map((v, idx) => (
                              <tr key={g.metodo + "-" + (v.ventaId || idx)}>
                                <td className="px-4 py-2 border-t border-gray-200">
                                  {v.negocioNombre || "SIN NEGOCIO"}
                                </td>
                                <td className="px-4 py-2 border-t border-gray-200">
                                  {v.nroVenta
                                    ? `Venta #${v.nroVenta}`
                                    : v.ventaId
                                    ? `Venta ID ${v.ventaId}`
                                    : "Venta"}
                                </td>
                                <td className="px-4 py-2 border-t border-gray-200 text-right">
                                  ${v.monto.toLocaleString("es-AR")}
                                </td>
                              </tr>
                            ))}

                            {/* Fila de total al final */}
                            <tr className="bg-gray-50">
                              <td
                                className="px-4 py-2 border-t border-gray-300 font-semibold"
                                colSpan={2}
                              >
                                Total
                              </td>
                              <td className="px-4 py-2 border-t border-gray-300 text-right font-semibold">
                                ${g.total.toLocaleString("es-AR")}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default CierreCajaGeneral;
