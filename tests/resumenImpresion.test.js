import test from "node:test";
import assert from "node:assert/strict";
import { prepararResumenImpresion } from "../src/utils/resumenImpresion.js";

const transacciones = [
  { tipo: "Venta", __montoOriginal: 120 },
  { tipo: "Entrega", __montoOriginal: 35 },
  { tipo: "Nota de Crédito", __montoOriginal: 15 },
  { tipo: "Venta", __montoOriginal: 80 },
  { tipo: "Saldo Inicial", __montoOriginal: 500 },
];

test("cada impresión por tipo incluye solo sus movimientos y su total", () => {
  for (const [tipo, cantidad, total] of [
    ["Venta", 2, 200],
    ["Entrega", 1, 35],
    ["Nota de Crédito", 1, 15],
  ]) {
    const resumen = prepararResumenImpresion(transacciones, tipo);
    assert.equal(resumen.esCompleto, false);
    assert.equal(resumen.movimientos.length, cantidad);
    assert.ok(resumen.movimientos.every((item) => item.tipo === tipo));
    assert.equal(resumen.totalSeleccionado, total);
  }
});

test("Todos reúne los tres tipos con totales independientes y sin duplicar saldo inicial", () => {
  const resumen = prepararResumenImpresion(transacciones, "todos");
  assert.equal(resumen.esCompleto, true);
  assert.equal(resumen.movimientos.length, 4);
  assert.deepEqual(resumen.totales, {
    Venta: 200,
    Entrega: 35,
    "Nota de Crédito": 15,
  });
});
