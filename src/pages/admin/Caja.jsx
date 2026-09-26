import React, { useEffect, useState, useMemo } from "react";
import { api } from "../../services/api";
import { PrinterOutlined } from "@ant-design/icons";
import { Tooltip, Modal, Button, Input, Pagination, Select } from "antd";
import ModalFooter from "../../components/ModalFooter";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const CierreCajaGeneral = () => {
  const [cajas, setCajas] = useState([]);
  const [totalesEntregas, setTotalesEntregas] = useState([]);
  const [gastosDelDia, setGastosDelDia] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [notification, setNotification] = useState(null);
  const [detalleMetodos, setDetalleMetodos] = useState([]);
  const [ajustesDetalle, setAjustesDetalle] = useState([]);
  const [detalleModalVisible, setDetalleModalVisible] = useState(false);
  const [cierreSeleccionado, setCierreSeleccionado] = useState(null);

  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [cierreEditando, setCierreEditando] = useState(null);
  const [montoEditando, setMontoEditando] = useState("");
  const [modalAjusteVisible, setModalAjusteVisible] = useState(false);
  const [cierreAjustando, setCierreAjustando] = useState(null);
  const [negociosAjuste, setNegociosAjuste] = useState([]);
  const [ajusteForm, setAjusteForm] = useState({
    negocioId: undefined,
    ventaId: "",
    monto: "",
    metodoPago: "EFECTIVO",
    fechaOperacion: "",
    motivo: "",
  });
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 6;

  useEffect(() => {
    api("api/caja", "GET").then((data) => setCajas(data));
    api("api/entregas/totales-dia-caja", "GET").then((data) =>
      setTotalesEntregas(data)
    );
    api("api/gastos/dia?todos=1", "GET").then((data) =>
      setGastosDelDia(data || [])
    );
    api("api/cierres-caja", "GET").then((data) => setCierres(data));
  }, []);
  // NUEVA VERSIÓN
  const verDetalleMetodos = async (cierre) => {
    try {
      const [data, ajustes] = await Promise.all([
        api(`api/cierre-caja/${cierre.id}/detalle-ventas`, "GET"),
        api(`api/cierre-caja/${cierre.id}/ajustes`, "GET"),
      ]);
      setDetalleMetodos(data);
      setAjustesDetalle(ajustes || []);
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

  const abrirModalAjuste = async (cierre) => {
    try {
      const data = await api("api/getAllNegocios", "GET");
      setNegociosAjuste(Array.isArray(data) ? data : data?.negocios || []);
    } catch (error) {
      console.error("Error cargando negocios para el ajuste:", error);
      showNotification("error", "Error", "No se pudieron cargar los negocios");
      return;
    }

    const fechaCierre = new Date(cierre.fecha);
    const fechaLocal = [
      fechaCierre.getFullYear(),
      String(fechaCierre.getMonth() + 1).padStart(2, "0"),
      String(fechaCierre.getDate()).padStart(2, "0"),
    ].join("-");

    setCierreAjustando(cierre);
    setAjusteForm({
      negocioId: undefined,
      ventaId: "",
      monto: "",
      metodoPago: "EFECTIVO",
      fechaOperacion: fechaLocal,
      motivo: "",
    });
    setModalAjusteVisible(true);
  };

  const cerrarModalAjuste = () => {
    setModalAjusteVisible(false);
    setCierreAjustando(null);
  };

  const guardarAjuste = async () => {
    if (!cierreAjustando) return;
    const monto = Number(ajusteForm.monto);
    if (!ajusteForm.negocioId || !ajusteForm.fechaOperacion || !ajusteForm.motivo.trim()) {
      showNotification("error", "Datos incompletos", "Completá negocio, fecha y motivo.");
      return;
    }
    if (!Number.isInteger(monto) || monto <= 0) {
      showNotification("error", "Monto inválido", "Ingresá un monto entero mayor a cero.");
      return;
    }

    try {
      await api(
        `api/cierre-caja/${cierreAjustando.id}/ajustes`,
        "POST",
        JSON.stringify({
          negocioId: ajusteForm.negocioId,
          ventaId: ajusteForm.ventaId ? Number(ajusteForm.ventaId) : undefined,
          monto,
          metodoPago: ajusteForm.metodoPago,
          fechaOperacion: ajusteForm.fechaOperacion,
          motivo: ajusteForm.motivo,
        })
      );
      showNotification("success", "Ajuste registrado", "El cierre muestra ahora el total ajustado.");
      setCierres(await api("api/cierres-caja", "GET"));
      cerrarModalAjuste();
    } catch (error) {
      console.error("Error registrando ajuste de cierre:", error);
      showNotification("error", "Error", error.message || "No se pudo registrar el ajuste");
    }
  };

  const valorCierre = (cierre, campo) =>
    cierre?.[`${campo}Ajustado`] ?? cierre?.[campo] ?? 0;

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
      setPaginaActual(1); // Volver a la primera página después de editar
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

  const getGastosUsuarioPorCaja = (cajaId) =>
    gastosDelDia.filter((g) => Number(g.cajaId) === Number(cajaId));
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

  const agruparPorOrigenYMetodo = (items = []) => {
    const origenes = {
      VENTA_DEL_DIA: { nombre: "Ventas del día", metodos: {} },
      PAGO_CUENTA_CORRIENTE: { nombre: "Pago cuenta corriente", metodos: {} },
    };

    (items || []).forEach((r) => {
      if (!r) return;
      const origen =
        r.origenCobro === "PAGO_CUENTA_CORRIENTE"
          ? "PAGO_CUENTA_CORRIENTE"
          : "VENTA_DEL_DIA";
      const metodo = r.metodoPago || "SIN MÉTODO";
      const monto = Number(r.monto || 0);

      if (!origenes[origen].metodos[metodo]) {
        origenes[origen].metodos[metodo] = { metodo, total: 0 };
      }
      origenes[origen].metodos[metodo].total += monto;
    });

    return {
      VENTA_DEL_DIA: {
        nombre: origenes.VENTA_DEL_DIA.nombre,
        metodos: Object.values(origenes.VENTA_DEL_DIA.metodos),
      },
      PAGO_CUENTA_CORRIENTE: {
        nombre: origenes.PAGO_CUENTA_CORRIENTE.nombre,
        metodos: Object.values(origenes.PAGO_CUENTA_CORRIENTE.metodos),
      },
    };
  };

  const capitalize = (str) =>
    str && typeof str === "string"
      ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
      : "";

  const handleImprimirCierre = async (cierre) => {
    // Obtener los detalles completos de ventas del endpoint
    let detallesVentas = [];
    try {
      detallesVentas = await api(
        `api/cierre-caja/${cierre.id}/detalle-ventas`,
        "GET"
      );
    } catch (e) {
      console.error("Error obteniendo detalles de ventas:", e);
      detallesVentas = [];
    }

    // Agrupar por método de pago
    const grupos = agruparPorMetodoYVenta(detallesVentas);

    // Calcular diferencia
    const diferencia =
      (cierre.ingresoLimpio || 0) - valorCierre(cierre, "totalEfectivo");

    // Calcular total general
    const totalGeneral = grupos.reduce((acc, g) => acc + g.total, 0);

    // Formatear fecha
    const fechaFormateada = new Date(cierre.fecha).toLocaleString("es-AR");
    const fechaCorta = new Date(cierre.fecha).toLocaleDateString("es-AR");

    // Crear PDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Encabezado
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("VERDULERÍA MI FAMILIA", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(14);
    doc.text("CIERRE DE CAJA", pageWidth / 2, y, { align: "center" });
    y += 10;

    // Línea decorativa
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(1);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;

    // Info del cierre
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Caja: ${cierre.caja?.nombre || "-"}`, 14, y);
    doc.text(`Estado: ${cierre.estado === 0 ? "Abierta" : "Cerrada"}`, pageWidth - 14, y, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.text(`Usuario: ${cierre.usuario?.usuario || "-"}`, 14, y);
    doc.text(`Fecha: ${fechaFormateada}`, pageWidth - 14, y, { align: "right" });
    y += 10;

    // Tabla de resumen financiero
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN FINANCIERO", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");

    const contentWidth = pageWidth - 28;
    const colWidthConcepto = Math.round(contentWidth * 0.62);
    const colWidthMonto = contentWidth - colWidthConcepto;

    const resumenData = [
      ["Total Ventas", `$${valorCierre(cierre, "totalVentas").toLocaleString("es-AR")}`],
      ["Total Cobrado", `$${valorCierre(cierre, "totalPagado").toLocaleString("es-AR")}`],
      ["Ventas a cuenta corriente", `$${(cierre.totalCuentaCorriente || 0).toLocaleString("es-AR")}`],
      ["Total Efectivo (Sistema)", `$${valorCierre(cierre, "totalEfectivo").toLocaleString("es-AR")}`],
      ["Gastos", `-$${(cierre.totalGastos || 0).toLocaleString("es-AR")}`],
      ["Efectivo Contado", `$${(cierre.ingresoLimpio || 0).toLocaleString("es-AR")}`],
      ["Diferencia", `${diferencia >= 0 ? "+" : ""}$${diferencia.toLocaleString("es-AR")}`],
    ];

    autoTable(doc, {
      head: [["Concepto", "Monto"]],
      body: resumenData,
      startY: y,
      theme: "grid",
      margin: { left: 14, right: 14 },
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 3.5,
        lineColor: [229, 231, 235],
        lineWidth: 0.2,
      },
      headStyles: {
        fontStyle: "bold",
        fillColor: [59, 130, 246],
        textColor: 255,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: colWidthConcepto },
        1: { cellWidth: colWidthMonto, halign: "right" },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (data) => {
        // Colorear la diferencia según sea positiva o negativa
        if (
          data.column.index === 1 &&
          Array.isArray(data.row.raw) &&
          data.row.raw[0] === "Diferencia"
        ) {
          data.cell.styles.textColor = diferencia >= 0 ? [22, 163, 74] : [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    y = doc.lastAutoTable.finalY + 10;

    const gruposPorOrigen = agruparPorOrigenYMetodo(detallesVentas);
    const origenRows = [];
    ["VENTA_DEL_DIA", "PAGO_CUENTA_CORRIENTE"].forEach((key) => {
      const origen = gruposPorOrigen[key];
      const metodos = origen?.metodos || [];
      if (metodos.length === 0) {
        origenRows.push([origen.nombre, "-", "$0"]);
        return;
      }
      let subtotal = 0;
      metodos.forEach((m) => {
        subtotal += m.total;
        origenRows.push([
          origen.nombre,
          m.metodo,
          `$${m.total.toLocaleString("es-AR")}`,
        ]);
      });
      origenRows.push([
        { content: `Subtotal ${origen.nombre}`, colSpan: 2, styles: { fontStyle: "bold" } },
        { content: `$${subtotal.toLocaleString("es-AR")}`, styles: { fontStyle: "bold" } },
      ]);
    });

    autoTable(doc, {
      head: [["Origen", "Método de pago", "Monto"]],
      body: origenRows,
      startY: y,
      theme: "grid",
      margin: { left: 14, right: 14 },
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2,
      },
      headStyles: {
        fontStyle: "bold",
        fillColor: [229, 231, 235],
        textColor: [55, 65, 81],
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 65 },
        2: { cellWidth: 40, halign: "right" },
      },
    });

    y = doc.lastAutoTable.finalY + 12;

    // Detalle por método de pago
    if (grupos.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DETALLE DE VENTAS POR MÉTODO DE PAGO", 14, y);
      y += 8;

      grupos.forEach((g) => {
        // Verificar si necesitamos nueva página
        if (y > 250) {
          doc.addPage();
          y = 15;
        }

        // Título del método
        doc.setFillColor(243, 244, 246);
        doc.rect(14, y - 4, pageWidth - 28, 7, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(55, 65, 81);
        doc.text(capitalize(g.metodo), 18, y);
        doc.setTextColor(0, 0, 0);
        y += 6;

        // Tabla de ventas por método
        const ventasData = g.ventas.map((v) => [
          v.negocioNombre || "SIN NEGOCIO",
          v.nroVenta ? `#${v.nroVenta}` : v.ventaId ? `ID ${v.ventaId}` : "-",
          `$${v.monto.toLocaleString("es-AR")}`,
        ]);

        // Agregar fila de subtotal
        ventasData.push([
          { content: `Subtotal ${capitalize(g.metodo)}`, colSpan: 2, styles: { fontStyle: "bold" } },
          { content: `$${g.total.toLocaleString("es-AR")}`, styles: { fontStyle: "bold" } },
        ]);

        autoTable(doc, {
          head: [["Negocio", "Nro. Venta", "Monto"]],
          body: ventasData,
          startY: y,
          theme: "grid",
          margin: { left: 14, right: 14 },
          styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 2,
          },
          headStyles: {
            fontStyle: "bold",
            fillColor: [229, 231, 235],
            textColor: [55, 65, 81],
          },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 50, halign: "center" },
            2: { cellWidth: 40, halign: "right" },
          },
        });

        y = doc.lastAutoTable.finalY + 8;
      });

      // Resumen final de totales
      if (y > 240) {
        doc.addPage();
        y = 15;
      }

      doc.setFillColor(30, 64, 175);
      doc.rect(14, y, pageWidth - 28, 10 + grupos.length * 6 + 10, "F");

      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("RESUMEN DE TOTALES POR MÉTODO", 18, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      grupos.forEach((g) => {
        doc.text(capitalize(g.metodo), 18, y);
        doc.text(`$${g.total.toLocaleString("es-AR")}`, pageWidth - 18, y, { align: "right" });
        y += 5;
      });

      // Línea separadora
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(18, y, pageWidth - 18, y);
      y += 5;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL GENERAL", 18, y);
      doc.text(`$${totalGeneral.toLocaleString("es-AR")}`, pageWidth - 18, y, { align: "right" });

      doc.setTextColor(0, 0, 0);
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Documento generado el ${new Date().toLocaleString("es-AR")} | Sistema de Gestión Mi Familia`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    // Guardar PDF
    const nombreArchivo = `cierre-caja-${cierre.caja?.nombre?.replace(/\s+/g, "-") || "caja"}-${fechaCorta.replace(/\//g, "-")}.pdf`;
    doc.save(nombreArchivo);
  };
  const formatCurrency = (value) => `$${value?.toLocaleString() || 0}`;
  const formatExpenseCurrency = (value) => {
    const amount = Number(value) || 0;
    return amount > 0 ? `-$${amount.toLocaleString()}` : "$0";
  };
  const formatSignedCurrency = (value) => {
    const amount = Number(value) || 0;
    return amount < 0
      ? `-$${Math.abs(amount).toLocaleString()}`
      : `$${amount.toLocaleString()}`;
  };
  const formatDate = (date) => new Date(date).toLocaleString();

  // Ordenar cierres por fecha descendente (más recientes primero) y paginar
  const cierresOrdenados = useMemo(() => {
    // Eliminar duplicados por ID antes de ordenar
    const cierresUnicos = Array.from(
      new Map(cierres.map((c) => [c.id, c])).values()
    );
    return cierresUnicos.sort((a, b) => {
      const fechaA = new Date(a.fecha);
      const fechaB = new Date(b.fecha);
      return fechaB - fechaA; // Orden descendente
    });
  }, [cierres]);

  const cierresPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    return cierresOrdenados.slice(inicio, fin);
  }, [cierresOrdenados, paginaActual]);

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
                  Ventas a cuenta corriente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gastos del día
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cajas
                .filter((caja) => caja.id != 1)
                .map((caja) => {
                  const totales =
                    totalesEntregas.find((t) => t.cajaId === caja.id) || {};
                  const gastosCaja = getGastosUsuarioPorCaja(caja.id);
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
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {gastosCaja.length === 0 ? (
                          <span className="text-gray-400">Sin gastos</span>
                        ) : (
                          <div className="space-y-1">
                            {gastosCaja.map((g) => (
                              <div key={g.id} className="flex justify-between gap-2">
                                <span className="truncate">{g.motivo}</span>
                                <span className={g.monto > 0 ? "text-red-600" : "text-gray-500"}>
                                  {g.monto > 0 ? "-" : ""}{formatCurrency(g.monto)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
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
              const totales =
                totalesEntregas.find((t) => t.cajaId === caja.id) || {};

              return (
                <div
                  key={caja.id}
                  className="p-4 border-b border-gray-200 last:border-b-0"
                >
                  <div className="space-y-3">
                    <div className="font-medium text-gray-900 text-lg border-b pb-2">
                      {caja.nombre}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Total Entregado</span>
                        <div className="font-medium text-gray-900">
                          {formatCurrency(totales.totalEntregado || 0)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Total Efectivo</span>
                        <div className="font-medium text-gray-900">
                          {formatCurrency(totales.totalEfectivo || 0)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Total Otros</span>
                        <div className="font-medium text-gray-900">
                          {formatCurrency(totales.totalOtros || 0)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Ventas a cuenta corriente</span>
                        <div className="font-medium text-gray-900">
                          {formatCurrency(totales.totalCuentaCorriente || 0)}
                        </div>
                      </div>
                    <div className="col-span-2">
                      <span className="text-gray-500 block">Gastos del día</span>
                      {getGastosUsuarioPorCaja(caja.id).length === 0 ? (
                        <div className="text-gray-400 text-sm">Sin gastos</div>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {getGastosUsuarioPorCaja(caja.id).map((g) => (
                            <div
                              key={g.id}
                              className="flex justify-between text-sm"
                            >
                              <span className="truncate">{g.motivo}</span>
                              <span className={g.monto > 0 ? "text-red-600" : "text-gray-500"}>
                                {g.monto > 0 ? "-" : ""}{formatCurrency(g.monto)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </div>
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
                    <span className="cursor-help">Ventas a cuenta corriente</span>
                  </Tooltip>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip title="Total cobrado en efectivo según el sistema (descontado)">
                    <span className="cursor-help">Total Efectivo</span>
                  </Tooltip>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip title="Total efectivo bruto (sin descontar gastos)">
                    <span className="cursor-help">Efectivo Bruto</span>
                  </Tooltip>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip title="Total de gastos del día (descuenta del efectivo)">
                    <span className="cursor-help">Gastos</span>
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
              {cierresPaginados.map((cierre) => (
                <tr key={cierre.id}>
                  {/* Columna imprimir */}
                  <td className="px-2 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleImprimirCierre(cierre)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded-md text-sm"
                      title="Imprimir cierre"
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

                  <td>{formatCurrency(valorCierre(cierre, "totalVentas"))}</td>
                  <td>{formatCurrency(valorCierre(cierre, "totalPagado"))}</td>
                  <td>{formatCurrency(cierre.totalCuentaCorriente)}</td>
                  <td>{formatCurrency(valorCierre(cierre, "totalEfectivo"))}</td>
                  <td>{formatCurrency(valorCierre(cierre, "totalEfectivoBruto"))}</td>
                  <td className={cierre.totalGastos > 0 ? "text-red-600" : "text-gray-700"}>
                    {formatExpenseCurrency(cierre.totalGastos)}
                  </td>
                  <td>{formatCurrency(cierre.ingresoLimpio)}</td>
                  <td>
                    {formatSignedCurrency(
                      (cierre.ingresoLimpio || 0) -
                      valorCierre(cierre, "totalEfectivo")
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
                    {cierre.ajusteTotal > 0 && (
                      <div className="text-xs text-blue-700 mb-1">
                        Ajustes: {formatCurrency(cierre.ajusteTotal)}
                      </div>
                    )}
                    <button
                      onClick={() => abrirModalEditar(cierre)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
                    >
                      Editar Contado
                    </button>
                    {cierre.estado === 1 && (
                      <button
                        onClick={() => abrirModalAjuste(cierre)}
                        className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
                      >
                        Ajuste posterior
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación Desktop */}
        {cierresOrdenados.length > itemsPorPagina && (
          <div className="hidden lg:flex px-6 py-4 border-t border-gray-200 justify-center">
            <Pagination
              current={paginaActual}
              total={cierresOrdenados.length}
              pageSize={itemsPorPagina}
              onChange={(page) => setPaginaActual(page)}
              showSizeChanger={false}
              showTotal={(total, range) =>
                `${range[0]}-${range[1]} de ${total} cierres`
              }
            />
          </div>
        )}

        {/* Vista Mobile */}
        <div className="lg:hidden">
          {cierresPaginados.map((cierre) => {
            const diferencia =
              (cierre.ingresoLimpio || 0) -
              valorCierre(cierre, "totalEfectivo");

            return (
              <div
                key={cierre.id}
                className="p-4 border-b border-gray-200 last:border-b-0"
              >
                <div className="space-y-3">
                  {/* Header con caja, fecha y estado */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900 text-lg">
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

                  {/* Usuario */}
                  <div className="text-sm">
                    <span className="text-gray-500">Usuario:</span>
                    <span className="font-medium ml-1">
                      {cierre.usuario?.usuario}
                    </span>
                  </div>

                  {/* Grid con todos los datos financieros */}
                  <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-lg">
                    <div>
                      <span className="text-gray-500 block">Total Ventas</span>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(valorCierre(cierre, "totalVentas"))}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Total Cobrado</span>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(valorCierre(cierre, "totalPagado"))}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block">
                        Ventas a cuenta corriente
                      </span>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(cierre.totalCuentaCorriente)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Total Efectivo</span>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(valorCierre(cierre, "totalEfectivo"))}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Efectivo Bruto</span>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(valorCierre(cierre, "totalEfectivoBruto"))}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Gastos</span>
                      <div className={`font-medium ${cierre.totalGastos > 0 ? "text-red-600" : "text-gray-700"}`}>
                        {formatExpenseCurrency(cierre.totalGastos)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Contado</span>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(cierre.ingresoLimpio)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Diferencia</span>
                      <div
                        className={`font-medium ${
                          diferencia >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatSignedCurrency(diferencia)}
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex flex-col gap-2">
                    {cierre.ajusteTotal > 0 && (
                      <div className="text-xs text-blue-700 text-center">
                        Ajustes: {formatCurrency(cierre.ajusteTotal)}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleImprimirCierre(cierre)}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2"
                        title="Imprimir cierre"
                      >
                        <PrinterOutlined /> Imprimir
                      </button>
                      <button
                        onClick={() => verDetalleMetodos(cierre)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm"
                      >
                        Ver detalles
                      </button>
                    </div>

                    <button
                      onClick={() => abrirModalEditar(cierre)}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Editar Contado
                    </button>
                    {cierre.estado === 1 && (
                      <button
                        onClick={() => abrirModalAjuste(cierre)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Ajuste posterior
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginación Mobile */}
        {cierresOrdenados.length > itemsPorPagina && (
          <div className="lg:hidden px-4 py-4 border-t border-gray-200 flex justify-center">
            <Pagination
              current={paginaActual}
              total={cierresOrdenados.length}
              pageSize={itemsPorPagina}
              onChange={(page) => setPaginaActual(page)}
              showSizeChanger={false}
              showTotal={(total, range) =>
                `${range[0]}-${range[1]} de ${total}`
              }
              size="small"
            />
          </div>
        )}
      </div>

      {/* Modales (fuera de las vistas condicionales para que funcionen en ambas) */}
      <Modal
        open={modalAjusteVisible}
        onCancel={cerrarModalAjuste}
        title={
          cierreAjustando
            ? `Registrar ajuste - ${cierreAjustando.caja?.nombre || "Caja"}`
            : "Registrar ajuste"
        }
        footer={
          <ModalFooter>
            <Button onClick={cerrarModalAjuste}>Cancelar</Button>
            <Button type="primary" onClick={guardarAjuste}>
              Registrar ajuste
            </Button>
          </ModalFooter>
        }
      >
        <p className="mb-3 text-sm text-gray-600">
          Esta opción registra un pago omitido sin reabrir ni modificar el cierre original.
        </p>
        <label className="block mb-1 text-sm font-medium">Negocio</label>
        <Select
          className="w-full mb-3"
          placeholder="Seleccioná el negocio"
          value={ajusteForm.negocioId}
          onChange={(value) => setAjusteForm((prev) => ({ ...prev, negocioId: value }))}
          showSearch
          optionFilterProp="label"
          options={negociosAjuste.map((negocio) => ({
            value: negocio.id,
            label: negocio.nombre,
          }))}
        />
        <label className="block mb-1 text-sm font-medium">Venta (opcional)</label>
        <Input
          className="mb-3"
          type="number"
          min="1"
          value={ajusteForm.ventaId}
          onChange={(e) => setAjusteForm((prev) => ({ ...prev, ventaId: e.target.value }))}
          placeholder="ID de venta"
        />
        <label className="block mb-1 text-sm font-medium">Monto</label>
        <Input
          className="mb-3"
          type="number"
          min="1"
          value={ajusteForm.monto}
          onChange={(e) => setAjusteForm((prev) => ({ ...prev, monto: e.target.value }))}
          placeholder="Monto del pago omitido"
        />
        <label className="block mb-1 text-sm font-medium">Método de pago</label>
        <Select
          className="w-full mb-3"
          value={ajusteForm.metodoPago}
          onChange={(value) => setAjusteForm((prev) => ({ ...prev, metodoPago: value }))}
          options={[
            { value: "EFECTIVO", label: "Efectivo" },
            { value: "TRANSFERENCIA/QR", label: "Transferencia / QR" },
            { value: "TARJETA DEBITO", label: "Tarjeta débito" },
            { value: "TARJETA CREDITO", label: "Tarjeta crédito" },
            { value: "CHEQUE", label: "Cheque" },
          ]}
        />
        <label className="block mb-1 text-sm font-medium">Fecha real del pago</label>
        <Input
          className="mb-3"
          type="date"
          value={ajusteForm.fechaOperacion}
          onChange={(e) => setAjusteForm((prev) => ({ ...prev, fechaOperacion: e.target.value }))}
        />
        <label className="block mb-1 text-sm font-medium">Motivo</label>
        <Input.TextArea
          rows={3}
          value={ajusteForm.motivo}
          onChange={(e) => setAjusteForm((prev) => ({ ...prev, motivo: e.target.value }))}
          placeholder="Ej.: Pago recibido ayer; el repartidor se quedó sin batería"
        />
      </Modal>

      <Modal
        open={modalEditarVisible}
        onCancel={cerrarModalEditar}
        title={
          cierreEditando
            ? `Editar contado - ${cierreEditando.caja?.nombre || "Caja"}`
            : "Editar contado"
        }
        footer={
          <ModalFooter>
            <Button key="cancel" onClick={cerrarModalEditar}>
              Cancelar
            </Button>
            <Button key="save" type="primary" onClick={guardarMontoEditado}>
              Guardar
            </Button>
          </ModalFooter>
        }
      >
        <p className="mb-2 text-sm text-gray-600">
          Ingresá el monto contado físicamente para esta caja.
        </p>
        <Input
          value={montoEditando}
          onChange={(e) => setMontoEditando(e.target.value)}
          prefix="$"
          type="number"
          inputMode="decimal"
          min="0"
        />
      </Modal>

      <Modal
        open={detalleModalVisible}
        onCancel={() => setDetalleModalVisible(false)}
        footer={
          <ModalFooter>
            <Button key="close" onClick={() => setDetalleModalVisible(false)}>
              Cerrar
            </Button>
          </ModalFooter>
        }
        title={
          cierreSeleccionado
            ? `Métodos de pago - ${
                cierreSeleccionado.caja?.nombre || "Caja"
              } (${formatDate(cierreSeleccionado.fecha)})`
            : "Métodos de pago"
        }
      >
        {cierreSeleccionado && (
          <div className="mb-3 text-sm text-gray-700">
            <span className="font-semibold">Gastos del cierre:</span>{" "}
            <span className={cierreSeleccionado.totalGastos > 0 ? "text-red-600" : "text-gray-700"}>
              {formatExpenseCurrency(cierreSeleccionado.totalGastos)}
            </span>
          </div>
        )}
        {ajustesDetalle.length > 0 && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="font-semibold text-blue-900 mb-2">
              Ajustes posteriores
            </div>
            <div className="space-y-2 text-sm">
              {ajustesDetalle.map((ajuste) => (
                <div key={ajuste.id} className="border-b border-blue-100 pb-2 last:border-b-0 last:pb-0">
                  <div className="flex justify-between gap-3">
                    <span>
                      {ajuste.negocio?.nombre || "Sin negocio"} · {ajuste.metodoPago}
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(ajuste.monto)}
                    </span>
                  </div>
                  <div className="text-xs text-blue-800">
                    Pago: {new Date(ajuste.fechaOperacion).toLocaleDateString("es-AR")} · {ajuste.motivo}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {detalleMetodos.length > 0 && (() => {
          const gruposPorOrigen = agruparPorOrigenYMetodo(detalleMetodos);
          return (
            <div className="mb-4 space-y-3">
              {["VENTA_DEL_DIA", "PAGO_CUENTA_CORRIENTE"].map((key) => {
                const origen = gruposPorOrigen[key];
                const metodos = origen?.metodos || [];
                const subtotal = metodos.reduce((acc, m) => acc + (m.total || 0), 0);
                return (
                  <div key={key} className="bg-gray-50 border border-gray-200 rounded-md p-3">
                    <div className="font-semibold text-gray-800 mb-2">{origen.nombre}</div>
                    {metodos.length === 0 ? (
                      <div className="text-sm text-gray-500">Sin cobros</div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        {metodos.map((m) => (
                          <div key={`${key}-${m.metodo}`} className="flex justify-between">
                            <span>{m.metodo}</span>
                            <span className="font-medium">{formatCurrency(m.total)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
                          <span>Subtotal</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
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
  );
};

export default CierreCajaGeneral;
