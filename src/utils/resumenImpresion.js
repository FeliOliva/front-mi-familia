const tiposMovimiento = {
  Venta: { etiqueta: "Ventas", signo: "+" },
  Entrega: { etiqueta: "Pagos", signo: "-" },
  "Nota de Crédito": { etiqueta: "Notas de crédito", signo: "-" },
};

export const prepararResumenImpresion = (transacciones, filtroTipo) => {
  const esCompleto = !tiposMovimiento[filtroTipo];
  const movimientos = (transacciones || []).filter(
    (item) => tiposMovimiento[item.tipo] && (esCompleto || item.tipo === filtroTipo)
  );
  const totales = Object.fromEntries(
    Object.keys(tiposMovimiento).map((tipo) => [
      tipo,
      movimientos
        .filter((item) => item.tipo === tipo)
        .reduce((suma, item) => suma + Number(item.__montoOriginal ?? item.monto ?? 0), 0),
    ])
  );

  return {
    esCompleto,
    movimientos,
    totales,
    etiqueta: esCompleto ? "Resumen de cuenta" : tiposMovimiento[filtroTipo].etiqueta,
    signo: esCompleto ? "" : tiposMovimiento[filtroTipo].signo,
    totalSeleccionado: esCompleto ? null : totales[filtroTipo],
  };
};
