const tiposMovimiento = {
  Venta: { etiqueta: "Ventas", signo: "+" },
  Entrega: { etiqueta: "Pagos", signo: "-" },
  "Nota de Crédito": { etiqueta: "Notas de crédito", signo: "-" },
};

export const prepararResumenImpresion = (transacciones, filtroTipo, busquedaActiva = false) => {
  const esCompleto = filtroTipo === "todos" && !busquedaActiva;
  const movimientos = (transacciones || []).filter(
    (item) => tiposMovimiento[item.tipo] && (!tiposMovimiento[filtroTipo] || item.tipo === filtroTipo)
  );
  const totales = Object.fromEntries(
    Object.keys(tiposMovimiento).map((tipo) => [
      tipo,
      movimientos
        .filter((item) => item.tipo === tipo)
        .reduce((suma, item) => suma + Number(item.__montoOriginal ?? item.monto ?? 0), 0),
    ])
  );
  const tiposVisibles = Object.keys(tiposMovimiento).filter(
    (tipo) => movimientos.some((item) => item.tipo === tipo)
  );
  const tipoUnico = tiposMovimiento[filtroTipo]
    ? filtroTipo
    : busquedaActiva && tiposVisibles.length === 1 ? tiposVisibles[0] : null;
  const tiposParaTotal = esCompleto
    ? Object.keys(tiposMovimiento)
    : tipoUnico ? [tipoUnico] : tiposVisibles;

  return {
    esCompleto,
    movimientos,
    totales,
    etiqueta: esCompleto
      ? "Resumen de cuenta"
      : tipoUnico ? tiposMovimiento[tipoUnico].etiqueta : "Movimientos filtrados",
    filasTotales: tiposParaTotal.map((tipo) => ({
      tipo,
      etiqueta: tiposMovimiento[tipo].etiqueta,
      signo: tiposMovimiento[tipo].signo,
      total: totales[tipo],
    })),
  };
};
