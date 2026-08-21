#!/usr/bin/env node
// Compara data/productos.json (publicado) contra un archivo generado de
// prueba, e imprime un resumen legible. No modifica ningún archivo.
import { readFile } from "node:fs/promises";

const actual = JSON.parse(await readFile("data/productos.json", "utf-8"));
const prueba = JSON.parse(
  await readFile(process.argv[2] || "data/productos.sheets-test.json", "utf-8")
);

const idsActual = new Set(actual.productos.map((p) => p.id));
const idsPrueba = new Set(prueba.productos.map((p) => p.id));
const nuevos = [...idsPrueba].filter((id) => !idsActual.has(id));
const perdidos = [...idsActual].filter((id) => !idsPrueba.has(id));
const agotados = prueba.productos
  .filter((p) => p.disponibilidad === "no_disponible")
  .map((p) => p.id);

console.log("Publicado actualmente:", actual.productos.length, "productos");
console.log("Generado desde Sheets:", prueba.productos.length, "productos");
console.log("IDs nuevos (no estaban antes):", nuevos.length ? nuevos.join(", ") : "(ninguno)");
console.log("IDs que desaparecerían:", perdidos.length ? perdidos.join(", ") : "(ninguno)");
console.log("Marcados no_disponible en la prueba:", agotados.join(", ") || "(ninguno)");
