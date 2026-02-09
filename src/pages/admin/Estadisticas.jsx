import React, { useEffect, useState } from "react";
import {
  Card,
  DatePicker,
  Table,
  message,
  Spin,
  Row,
  Col,
  Statistic,
  Divider,
  Button,
  Modal,
  Radio,
} from "antd";
import {
  DollarOutlined,
  WalletOutlined,
  CreditCardOutlined,
  PrinterOutlined,
  TeamOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const defaultStart = dayjs("2025-12-01");
const defaultEnd = dayjs();

const formatMoneda = (value) =>
  `$${Number(value || 0).toLocaleString("es-AR")}`;

const getImageAsDataUrl = (url) =>
  new Promise((resolve, reject) => {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });

const prepararTransacciones = (raw) => {
  const base = (raw || []).map((item) => {
    const fecha = item.fecha || item.fechaCreacion || new Date().toISOString();
    const montoBase = Math.abs(Number(
      item.total_con_descuento ?? item.total ?? item.monto ?? 0
    ));
    let tipo = item.tipo;
    if (!tipo) {
      if (item.esSaldoInicial || item.saldoInicial) tipo = "Saldo Inicial";
      else if (item.entregaId || item.metodoPagoId !== undefined) tipo = "Entrega";
      else if (item.notaCreditoId || item.motivo !== undefined) tipo = "Nota de Crédito";
      else if (item.ventaId || item.nroVenta !== undefined || item.detalleventa !== undefined) tipo = "Venta";
      else tipo = "Entrega";
    }
    const esSumaDeuda = tipo === "Venta" || tipo === "Saldo Inicial" || item.esSaldoInicial;
    const signo = esSumaDeuda ? +1 : -1;
    const idFinal = item.id || item.ventaId || item.entregaId || item.notaCreditoId;
    let numero = item.numero;
    if (!numero) {
      if (tipo === "Venta") numero = item.nroVenta || item.numero || null;
      else if (tipo === "Entrega") numero = item.nroEntrega || item.numero || null;
      else if (tipo === "Nota de Crédito") numero = item.nroNotaCredito || item.numero || null;
    }
    return {
      ...item,
      tipo,
      id: idFinal,
      ventaId: tipo === "Venta" ? (item.ventaId || item.id) : item.ventaId,
      fecha,
      numero,
      __montoOriginal: montoBase,
      __montoFirmado: signo * montoBase,
      uniqueId: `${tipo}-${idFinal}`,
    };
  });
  const ordenadasPorFecha = base.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const ordenadasAscendente = [...ordenadasPorFecha].reverse();
  let saldo = 0;
  const conSaldoAscendente = ordenadasAscendente.map((it) => {
    saldo += it.__montoFirmado;
    return {
      ...it,
      saldo_restante: saldo,
      monto_formateado: it.__montoOriginal.toLocaleString("es-AR"),
    };
  });
  return conSaldoAscendente.reverse();
};

const generarPdfResumen = async ({
  nombreCliente,
  transacciones,
  saldoInicial,
  fechaInicio,
  fechaFin,
  saldoPendiente,
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 16;

  try {
    const logoUrl = `${window.location.origin}/logoverdu.png`;
    const logoDataUrl = await getImageAsDataUrl(logoUrl);
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", pageWidth - 50, y - 16, 38, 38);
  } catch (e) {}

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(`Resumen del cliente ${nombreCliente || "-"}`, pageWidth / 2, y + 10, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  if (fechaInicio && fechaFin) {
    doc.text(
      `Período: ${dayjs(fechaInicio).format("DD-MM-YYYY")} a ${dayjs(fechaFin).format("DD-MM-YYYY")}`,
      pageWidth / 2,
      y + 18,
      { align: "center" }
    );
  }

  doc.setDrawColor(220);
  doc.line(14, y + 22, pageWidth - 14, y + 22);
  doc.setTextColor(0);
  y += 30;

  const tableData = transacciones.map((item) => {
    const tipoAbrev = item.tipo === "Nota de Crédito" ? "N.C." : item.tipo;
    const signo = item.tipo === "Venta" ? "" : "-";
    const detalle = item.esSaldoInicial ? "Saldo Inicial" : tipoAbrev;
    const obsMotivo =
      item.tipo === "Venta"
        ? (item.observacion && String(item.observacion).trim()) || "-"
        : item.tipo === "Nota de Crédito"
          ? (item.motivo && String(item.motivo).trim()) || "-"
          : "-";
    return [
      dayjs(item.fecha).format("DD/MM/YY"),
      detalle,
      item.numero || "-",
      obsMotivo,
      `${signo}$${item.monto_formateado}`,
      `$${item.saldo_restante?.toLocaleString("es-AR") || "0"}`,
    ];
  });

  autoTable(doc, {
    head: [["Fecha", "Detalle", "Nro", "Obs. / Motivo", "Monto", "Saldo"]],
    body: tableData,
    startY: y,
    theme: "striped",
    margin: { left: 14, right: 14 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: [225, 225, 225], textColor: 40, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 44, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  let ry = doc.lastAutoTable.finalY + 12;
  if (ry + 60 > pageHeight - 20) {
    doc.addPage();
    ry = 20;
  }
  doc.setDrawColor(200);
  doc.line(14, ry - 6, pageWidth - 14, ry - 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen de cuenta", pageWidth / 2, ry, { align: "center" });
  ry += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const blockWidth = 70;
  const leftX = pageWidth / 2 - blockWidth / 2;
  const rightX = pageWidth / 2 + blockWidth / 2;
  const montoSaldoIni = saldoInicial?.monto || 0;
  const totalVentas = transacciones
    .filter((t) => t.tipo === "Venta")
    .reduce((acc, t) => acc + Number(t.total_con_descuento ?? t.total ?? t.monto ?? 0), 0);
  const totalEntregas = transacciones
    .filter((t) => t.tipo === "Entrega")
    .reduce((acc, t) => acc + Number(t.monto ?? 0), 0);
  const totalNC = transacciones
    .filter((t) => t.tipo === "Nota de Crédito")
    .reduce((acc, t) => acc + Number(t.monto ?? 0), 0);

  const row = (label, value) => {
    doc.text(label, leftX, ry);
    doc.text(value, rightX, ry, { align: "right" });
    ry += 6;
  };
  row("Saldo inicial", `$${montoSaldoIni.toLocaleString("es-AR")}`);
  row("Ventas", `+$${totalVentas.toLocaleString("es-AR")}`);
  row("Pagos", `-$${totalEntregas.toLocaleString("es-AR")}`);
  row("Notas de crédito", `-$${totalNC.toLocaleString("es-AR")}`);
  ry += 6;
  doc.setFillColor(238, 248, 240);
  doc.roundedRect(14, ry, pageWidth - 28, 14, 2, 2, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Saldo pendiente", pageWidth / 2 - 35, ry + 9);
  doc.text(`$${saldoPendiente.toLocaleString("es-AR")}`, pageWidth / 2 + 35, ry + 9, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont("helvetica", "normal");
  doc.text("Verdulería Mi Familia · Documento informativo", pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.setTextColor(0);

  const nombreArchivo = `resumen-${String(nombreCliente || "cuenta").replace(/\s+/g, "-")}-${dayjs().format("DDMMYYYY")}.pdf`;
  doc.save(nombreArchivo);
};

const generarPdfResumenGeneral = async ({
  todosNegocios,
  consumidorFinal,
  fechaInicio,
  fechaFin,
  totalVentas,
  totalEntregas,
  totalNotasCredito,
  totalSaldoInicial,
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 16;

  try {
    const logoUrl = `${window.location.origin}/logoverdu.png`;
    const logoDataUrl = await getImageAsDataUrl(logoUrl);
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", pageWidth - 50, y - 16, 38, 38);
  } catch (e) {}

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Resumen general de cuentas", pageWidth / 2, y + 10, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  if (fechaInicio && fechaFin) {
    doc.text(
      `Período: ${dayjs(fechaInicio).format("DD-MM-YYYY")} a ${dayjs(fechaFin).format("DD-MM-YYYY")}`,
      pageWidth / 2,
      y + 18,
      { align: "center" }
    );
  }
  doc.setDrawColor(220);
  doc.line(14, y + 22, pageWidth - 14, y + 22);
  doc.setTextColor(0);
  y += 28;

  const fmt = (value) => `$${Number(value || 0).toLocaleString("es-AR")}`;
  const filas = (todosNegocios || []).map((n) => {
    const saldoInicial = Number(n.saldoInicial || 0);
    const ventas = Number(n.totalCompras || 0);
    const pagos = Number(n.totalPagos || 0);
    const nc = Number(n.totalNC || 0);
    const saldo = ventas + saldoInicial - (pagos + nc);
    return [
      String(n.nombre || "-").trim(),
      fmt(saldoInicial),
      fmt(ventas),
      fmt(pagos),
      fmt(nc),
      fmt(saldo),
    ];
  });
  if (consumidorFinal) {
    const saldoInicial = Number(consumidorFinal.saldoInicial || 0);
    const v = Number(consumidorFinal.totalCompras || 0);
    const p = Number(consumidorFinal.totalPagos || 0);
    const nc = Number(consumidorFinal.totalNC || 0);
    filas.push([
      "Consumidor Final",
      fmt(saldoInicial),
      fmt(v),
      fmt(p),
      fmt(nc),
      fmt(v + saldoInicial - p - nc),
    ]);
  }
  const totalVentasConSaldo = (totalVentas || 0) + (totalSaldoInicial || 0);
  const totalSaldo = totalVentasConSaldo - (totalEntregas || 0) - (totalNotasCredito || 0);
  filas.push([
    "TOTAL",
    fmt(totalSaldoInicial),
    fmt(totalVentas),
    fmt(totalEntregas),
    fmt(totalNotasCredito),
    fmt(totalSaldo),
  ]);

  autoTable(doc, {
    head: [["Cliente", "Saldo inicial", "Ventas", "Pagos", "N.C.", "Saldo"]],
    body: filas,
    startY: y,
    theme: "striped",
    margin: { left: 14, right: 14 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: [225, 225, 225], textColor: 40, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 46, halign: "left" },
      1: { cellWidth: 26, halign: "right" },
      2: { cellWidth: 26, halign: "right" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index === filas.length - 1) {
        d.cell.styles.fillColor = [220, 235, 255];
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont("helvetica", "normal");
  doc.text("Verdulería Mi Familia · Documento informativo", pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.setTextColor(0);

  const nombreArchivo = `resumen-general-cuentas-${dayjs().format("DDMMYYYY")}.pdf`;
  doc.save(nombreArchivo);
};

const generarPdfDiarioClientes = async ({
  todosNegocios,
  fechaInicio,
  fechaFin,
  totalVentas,
  totalEntregas,
  totalNotasCredito,
  totalSaldoInicial,
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 16;

  try {
    const logoUrl = `${window.location.origin}/logoverdu.png`;
    const logoDataUrl = await getImageAsDataUrl(logoUrl);
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", pageWidth - 50, y - 16, 38, 38);
  } catch (e) {}

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Diario de ventas por cliente", pageWidth / 2, y + 10, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  if (fechaInicio && fechaFin) {
    doc.text(
      `Período: ${dayjs(fechaInicio).format("DD-MM-YYYY")} a ${dayjs(fechaFin).format("DD-MM-YYYY")}`,
      pageWidth / 2,
      y + 18,
      { align: "center" }
    );
  }
  doc.setDrawColor(220);
  doc.line(14, y + 22, pageWidth - 14, y + 22);
  doc.setTextColor(0);
  y += 28;

  const fmt = (value) => `$${Number(value || 0).toLocaleString("es-AR")}`;
  const filas = (todosNegocios || []).map((n) => {
    const saldoInicial = Number(n.saldoInicial || 0);
    const ventas = Number(n.totalCompras || 0);
    const pagos = Number(n.totalPagos || 0);
    const nc = Number(n.totalNC || 0);
    const saldo = ventas + saldoInicial - (pagos + nc);
    return [
      String(n.nombre || "-").trim(),
      fmt(saldoInicial),
      fmt(ventas),
      fmt(pagos),
      fmt(nc),
      fmt(saldo),
    ];
  });

  const totalVentasConSaldo = (totalVentas || 0) + (totalSaldoInicial || 0);
  const totalSaldo = totalVentasConSaldo - (totalEntregas || 0) - (totalNotasCredito || 0);
  filas.push([
    "TOTAL",
    fmt(totalSaldoInicial),
    fmt(totalVentas),
    fmt(totalEntregas),
    fmt(totalNotasCredito),
    fmt(totalSaldo),
  ]);

  autoTable(doc, {
    head: [["Cliente", "Saldo inicial", "Ventas", "Pagos", "N.C.", "Saldo"]],
    body: filas,
    startY: y,
    theme: "striped",
    margin: { left: 14, right: 14 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: [225, 225, 225], textColor: 40, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 46, halign: "left" },
      1: { cellWidth: 26, halign: "right" },
      2: { cellWidth: 26, halign: "right" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index === filas.length - 1) {
        d.cell.styles.fillColor = [220, 235, 255];
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont("helvetica", "normal");
  doc.text("Verdulería Mi Familia · Documento informativo", pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.setTextColor(0);

  const nombreArchivo = `diario-ventas-clientes-${dayjs().format("DDMMYYYY")}.pdf`;
  doc.save(nombreArchivo);
};

const Estadisticas = () => {
  const [rango, setRango] = useState([defaultStart, defaultEnd]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [printingId, setPrintingId] = useState(null);
  const [printingGeneral, setPrintingGeneral] = useState(false);
  const [printingDiario, setPrintingDiario] = useState(false);
  const [diarioModalOpen, setDiarioModalOpen] = useState(false);
  const [diarioPreset, setDiarioPreset] = useState("hoy");
  const [diarioRango, setDiarioRango] = useState([dayjs(), dayjs()]);

  const cargarEstadisticas = async () => {
    if (!rango[0] || !rango[1]) return;
    setLoading(true);
    try {
      const startDate = rango[0].format("YYYY-MM-DD");
      const endDate = rango[1].format("YYYY-MM-DD");
      const res = await api(
        `api/estadisticas?startDate=${startDate}&endDate=${endDate}`
      );
      const idsNegocios = (res.todosNegocios || [])
        .map((n) => n.negocioId)
        .filter(Boolean);
      let saldoMap = new Map();
      if (idsNegocios.length > 0) {
        const saldos = await Promise.all(
          idsNegocios.map((id) =>
            api(`api/saldos-iniciales/${id}`).catch(() => null)
          )
        );
        saldoMap = new Map(
          idsNegocios.map((id, idx) => [
            id,
            Number(saldos[idx]?.monto || 0),
          ])
        );
      }
      const todosNegocios = (res.todosNegocios || []).map((n) => ({
        ...n,
        saldoInicial: Number(saldoMap.get(n.negocioId) || 0),
      }));
      const totalSaldoInicial = todosNegocios.reduce(
        (acc, n) => acc + Number(n.saldoInicial || 0),
        0
      );
      const totalVentasConSaldo =
        Number(res.totalVentas || 0) + Number(totalSaldoInicial || 0);
      const consumidorFinal = res.consumidorFinal
        ? { ...res.consumidorFinal, saldoInicial: 0 }
        : null;
      setData({
        ...res,
        todosNegocios,
        consumidorFinal,
        totalSaldoInicial,
        totalVentasConSaldo,
        diferenciaVentasMenosPagosNC:
          totalVentasConSaldo -
          (Number(res.totalEntregas || 0) + Number(res.totalNotasCredito || 0)),
        diferenciaConsiderandoGastos:
          totalVentasConSaldo -
          (Number(res.totalEntregas || 0) + Number(res.totalNotasCredito || 0)) -
          Number(res.totalGastos || 0),
      });
    } catch (error) {
      message.error(error.message || "Error al cargar estadísticas");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstadisticas();
  }, [rango]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleImprimirResumenCliente = async (record) => {
    if (!rango[0] || !rango[1]) {
      message.warning("Seleccioná un rango de fechas");
      return;
    }
    setPrintingId(record.negocioId);
    const startDate = rango[0].format("YYYY-MM-DD");
    const endDate = rango[1].format("YYYY-MM-DD");
    try {
      const [raw, saldoInicialRes] = await Promise.all([
        api(`api/resumenCuenta/negocio/${record.negocioId}?startDate=${startDate}&endDate=${endDate}`),
        api(`api/saldos-iniciales/${record.negocioId}`).catch(() => null),
      ]);
      const transacciones = prepararTransacciones(raw);
      if (transacciones.length === 0) {
        message.warning("No hay movimientos para imprimir para este cliente en el período");
        return;
      }
      const montoSaldoIni = saldoInicialRes?.monto || 0;
      const totalVentas = transacciones
        .filter((t) => t.tipo === "Venta")
        .reduce((acc, t) => acc + Number(t.total_con_descuento ?? t.total ?? t.monto ?? 0), 0);
      const totalEntregas = transacciones
        .filter((t) => t.tipo === "Entrega")
        .reduce((acc, t) => acc + Number(t.monto ?? 0), 0);
      const totalNC = transacciones
        .filter((t) => t.tipo === "Nota de Crédito")
        .reduce((acc, t) => acc + Number(t.monto ?? 0), 0);
      const saldoPendiente = montoSaldoIni + totalVentas - totalEntregas - totalNC;

      await generarPdfResumen({
        nombreCliente: record.nombre,
        transacciones,
        saldoInicial: saldoInicialRes,
        fechaInicio: rango[0],
        fechaFin: rango[1],
        saldoPendiente,
      });
      message.success("PDF generado correctamente");
    } catch (err) {
      message.error(err?.message || "Error al generar el PDF");
    } finally {
      setPrintingId(null);
    }
  };

  const handleImprimirGeneral = async () => {
    if (!data) return;
    if ((!data.todosNegocios || data.todosNegocios.length === 0) && !data.consumidorFinal) {
      message.warning("No hay datos de clientes para imprimir");
      return;
    }
    setPrintingGeneral(true);
    try {
      await generarPdfResumenGeneral({
        todosNegocios: data.todosNegocios,
        consumidorFinal: data.consumidorFinal,
        fechaInicio: rango[0],
        fechaFin: rango[1],
        totalVentas: data.totalVentas,
        totalEntregas: data.totalEntregas,
        totalNotasCredito: data.totalNotasCredito,
        totalSaldoInicial: data.totalSaldoInicial,
      });
      message.success("PDF generado correctamente");
    } catch (err) {
      message.error(err?.message || "Error al generar el PDF");
    } finally {
      setPrintingGeneral(false);
    }
  };

  const resolverRangoDiario = () => {
    const hoy = dayjs();
    switch (diarioPreset) {
      case "hoy":
        return [hoy.startOf("day"), hoy.endOf("day")];
      case "semana":
        return [hoy.subtract(6, "day").startOf("day"), hoy.endOf("day")];
      case "mes":
        return [hoy.startOf("month"), hoy.endOf("day")];
      case "cuatrimestre":
        return [hoy.subtract(3, "month").startOf("month"), hoy.endOf("day")];
      case "personalizado":
        return [
          diarioRango?.[0]?.startOf("day") || hoy.startOf("day"),
          diarioRango?.[1]?.endOf("day") || hoy.endOf("day"),
        ];
      default:
        return [hoy.startOf("day"), hoy.endOf("day")];
    }
  };

  const handleGenerarDiario = async () => {
    const [start, end] = resolverRangoDiario();
    if (!start || !end) {
      message.warning("Seleccioná un rango válido");
      return;
    }
    setPrintingDiario(true);
    try {
      const startDate = start.format("YYYY-MM-DD");
      const endDate = end.format("YYYY-MM-DD");
      const res = await api(`api/estadisticas?startDate=${startDate}&endDate=${endDate}`);
      const todosConSaldo = await Promise.all(
        (res.todosNegocios || []).map(async (n) => {
          try {
            const saldoRes = await api(`api/saldos-iniciales/${n.negocioId}`).catch(() => null);
            const fechaSaldo = saldoRes?.fechaCreacion ? dayjs(saldoRes.fechaCreacion) : null;
            const enRango =
              fechaSaldo &&
              (fechaSaldo.isSame(start, "day") ||
                (fechaSaldo.isAfter(start) && fechaSaldo.isBefore(end)) ||
                fechaSaldo.isSame(end, "day"));
            return { ...n, saldoInicial: enRango ? Number(saldoRes?.monto || 0) : 0 };
          } catch {
            return { ...n, saldoInicial: 0 };
          }
        })
      );
      const soloConCompras = todosConSaldo.filter((n) => Number(n.totalCompras || 0) > 0);
      if (soloConCompras.length === 0) {
        message.warning("No hay ventas en el período seleccionado");
        return;
      }
      const totalSaldoInicial = soloConCompras.reduce((acc, n) => acc + Number(n.saldoInicial || 0), 0);
      const totalVentas = soloConCompras.reduce((acc, n) => acc + Number(n.totalCompras || 0), 0);
      const totalEntregas = soloConCompras.reduce((acc, n) => acc + Number(n.totalPagos || 0), 0);
      const totalNotasCredito = soloConCompras.reduce((acc, n) => acc + Number(n.totalNC || 0), 0);

      await generarPdfDiarioClientes({
        todosNegocios: soloConCompras,
        fechaInicio: start,
        fechaFin: end,
        totalVentas,
        totalEntregas,
        totalNotasCredito,
        totalSaldoInicial,
      });
      message.success("PDF generado correctamente");
      setDiarioModalOpen(false);
    } catch (err) {
      message.error(err?.message || "Error al generar el PDF");
    } finally {
      setPrintingDiario(false);
    }
  };

  const columnsClientes = [
    {
      title: "Cliente",
      dataIndex: "nombre",
      key: "nombre",
      ellipsis: true,
      width: 160,
      minWidth: 140,
    },
    {
      title: "Saldo inicial",
      dataIndex: "saldoInicial",
      key: "saldoInicial",
      width: 100,
      align: "right",
      render: (v) => formatMoneda(v),
    },
    {
      title: "Ventas",
      dataIndex: "totalCompras",
      key: "totalCompras",
      width: 95,
      align: "right",
      render: (v) => formatMoneda(v),
    },
    {
      title: "Pagos",
      dataIndex: "totalPagos",
      key: "totalPagos",
      width: 95,
      align: "right",
      render: (v) => formatMoneda(v),
    },
    {
      title: "N.C.",
      dataIndex: "totalNC",
      key: "totalNC",
      width: 85,
      align: "right",
      render: (v) => formatMoneda(v),
    },
    {
      title: "Saldo",
      key: "saldo",
      width: 95,
      align: "right",
      render: (_, record) => {
        const ventas = Number(record.totalCompras || 0);
        const saldoInicial = Number(record.saldoInicial || 0);
        const pagos = Number(record.totalPagos || 0);
        const nc = Number(record.totalNC || 0);
        const saldo = ventas + saldoInicial - (pagos + nc);
        return (
          <span style={{ color: saldo >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
            {formatMoneda(saldo)}
          </span>
        );
      },
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 90,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<PrinterOutlined />}
          onClick={() => handleImprimirResumenCliente(record)}
          loading={printingId === record.negocioId}
          title="Imprimir resumen de cuenta"
        />
      ),
    },
  ];

  if (loading && !data) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[300px]">
        <Spin size="large" tip="Cargando estadísticas..." />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">Estadísticas</h1>
        <p className="text-sm text-gray-500 mb-4">
          Resumen por período. Seleccioná el rango de fechas.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker.RangePicker
            value={rango}
            onChange={(dates) => dates && setRango(dates)}
            format="DD/MM/YYYY"
            allowClear={false}
          />
          {data && (
            <>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={handleImprimirGeneral}
                loading={printingGeneral}
              >
                Imprimir general
              </Button>
              <Button
                onClick={() => setDiarioModalOpen(true)}
                icon={<PrinterOutlined />}
              >
                Diario por cliente
              </Button>
            </>
          )}
        </div>
      </div>

      {!data && !loading && (
        <Card>
          <p className="text-gray-500">No hay datos para mostrar.</p>
        </Card>
      )}

      {data && (
        <>
          {/* Totales: ventas, pagos+NC, gastos, clientes, productos */}
          <Row gutter={[16, 16]} className="mb-4">
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Total ventas + saldo inicial"
                  value={data.totalVentasConSaldo ?? data.totalVentas}
                  prefix={<DollarOutlined />}
                  formatter={(v) => formatMoneda(v)}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Saldo inicial (clientes)"
                  value={data.totalSaldoInicial ?? 0}
                  prefix={<DollarOutlined />}
                  formatter={(v) => formatMoneda(v)}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Pagos + Notas de crédito"
                  value={data.sumPagosYNotasCredito}
                  prefix={<WalletOutlined />}
                  formatter={(v) => formatMoneda(v)}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Gastos (período)"
                  value={data.totalGastos}
                  prefix={<CreditCardOutlined />}
                  formatter={(v) => formatMoneda(v)}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Total clientes (período)"
                  value={data.totalClientes ?? 0}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Total productos (catálogo)"
                  value={data.totalProductos ?? 0}
                  prefix={<AppstoreOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {data.consumidorFinal != null && (
            <Card title="Consumidor Final (ventas sueltas)" className="mb-4" size="small">
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <span><strong>Ventas:</strong> {formatMoneda(data.consumidorFinal.totalCompras)}</span>
                <span><strong>Pagos:</strong> {formatMoneda(data.consumidorFinal.totalPagos)}</span>
                <span><strong>N.C.:</strong> {formatMoneda(data.consumidorFinal.totalNC)}</span>
              </div>
            </Card>
          )}

          {/* Tabla a la izquierda (tamaño reducido), cards a la derecha una debajo de otra */}
          <Row gutter={[16, 16]} wrap>
            <Col xs={24} lg={14}>
              <Card title="Clientes (por ventas)" className="mb-4" bodyStyle={{ padding: isMobile ? 12 : 16 }}>
                {data.todosNegocios?.length > 0 ? (
                  <Table
                    columns={columnsClientes}
                    dataSource={data.todosNegocios}
                    rowKey="negocioId"
                    size="small"
                    style={{ fontSize: 12 }}
                    scroll={{ x: 620, y: 320 }}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (t) => `Total: ${t} clientes`,
                      pageSizeOptions: ["10", "20", "50"],
                      size: "small",
                    }}
                  />
                ) : (
                  <p className="text-gray-500 text-sm">No hay ventas de clientes en el período.</p>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Card title="Notas de crédito y totales" size="small">
                  <div style={{ fontSize: 14 }}>
                    <p className="flex justify-between py-1" style={{ marginBottom: 4, alignItems: "center" }}>
                      <span>Total notas de crédito</span>
                      <span style={{ fontWeight: 600 }}>{formatMoneda(data.totalNotasCredito)}</span>
                    </p>
                    <Divider className="my-1" />
                    <p className="flex justify-between py-1" style={{ marginBottom: 4, alignItems: "center" }}>
                      <span>Suma pagos + notas de crédito</span>
                      <span style={{ fontWeight: 600 }}>{formatMoneda(data.sumPagosYNotasCredito)}</span>
                    </p>
                    <Divider className="my-1" />
                    <p className="flex justify-between py-1" style={{ marginBottom: 4, alignItems: "center" }}>
                      <span>Ventas + saldo inicial − (pagos + NC)</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: (data.diferenciaVentasMenosPagosNC ?? 0) >= 0 ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {formatMoneda(data.diferenciaVentasMenosPagosNC)}
                      </span>
                    </p>
                    <p className="flex justify-between py-1" style={{ alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>Ventas + saldo inicial − (pagos + NC) − gastos</span>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: (data.diferenciaConsiderandoGastos ?? 0) >= 0 ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {formatMoneda(data.diferenciaConsiderandoGastos)}
                      </span>
                    </p>
                  </div>
                </Card>
                <Card size="small" title="Pagos (entregas) por método">
                  {data.entregasPorMetodo?.length > 0 ? (
                    <ul className="list-none p-0 m-0" style={{ fontSize: 13 }}>
                      {data.entregasPorMetodo.map((m) => (
                        <li
                          key={m.metodoPagoId}
                          className="flex justify-between py-1 border-b border-gray-100 last:border-0"
                        >
                          <span>{m.metodoPagoNombre}</span>
                          <span>{formatMoneda(m.total)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm">No hay entregas en el período.</p>
                  )}
                  <Divider className="my-2" />
                  <p className="flex justify-between font-medium" style={{ fontSize: 13 }}>
                    <span>Total entregas</span>
                    <span>{formatMoneda(data.totalEntregas)}</span>
                  </p>
                </Card>
              </div>
            </Col>
          </Row>
        </>
      )}

      <Modal
        title="Diario de ventas por cliente"
        open={diarioModalOpen}
        onCancel={() => setDiarioModalOpen(false)}
        onOk={handleGenerarDiario}
        okText="Generar PDF"
        confirmLoading={printingDiario}
      >
        <Radio.Group
          value={diarioPreset}
          onChange={(e) => setDiarioPreset(e.target.value)}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <Radio value="hoy">Hoy</Radio>
          <Radio value="semana">Últimos 7 días</Radio>
          <Radio value="mes">Mes actual</Radio>
          <Radio value="cuatrimestre">Último cuatrimestre</Radio>
          <Radio value="personalizado">Rango personalizado</Radio>
        </Radio.Group>
        {diarioPreset === "personalizado" && (
          <div style={{ marginTop: 12 }}>
            <DatePicker.RangePicker
              value={diarioRango}
              onChange={(dates) => dates && setDiarioRango(dates)}
              format="DD/MM/YYYY"
              allowClear={false}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Estadisticas;
