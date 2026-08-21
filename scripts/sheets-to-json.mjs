#!/usr/bin/env node
/**
 * Genera data/productos.json a partir del Google Sheets operativo.
 *
 * QUE HACE
 *   - Lee las pestañas Productos y Categorias de la hoja (vía la API de
 *     Google Sheets, autenticado con una cuenta de servicio de solo lectura).
 *   - Filtra a solo los productos con Activo = SI (igual que VIGENTE en el
 *     generador anterior basado en Excel): Activo nunca se publica como
 *     campo, la sola presencia del producto en el JSON ya significa que
 *     está activo.
 *   - Traduce Agotado (columna D) a "disponibilidad": vacío -> "disponible",
 *     cualquier otro valor -> "no_disponible".
 *   - Preserva meta.categorias._default del productos.json anterior (la
 *     hoja Categorias no define una entrada por defecto).
 *   - Valida antes de escribir nada. Si hay errores, no se toca el archivo
 *     de salida.
 *
 * SALVAGUARDAS (igual que scripts/excel-to-json.ps1 en desarrollo)
 *   - Aborta si un SKU se repite en dos productos activos distintos.
 *   - Aborta si un ID se repite.
 *   - Aborta si una categoría no tiene su icono/color en meta.categorias.
 *   - Aborta si un producto activo no tiene precio numérico >= 0.
 *   - Aborta si el catálogo caería más del umbral (10% por defecto) o si
 *     una categoría existente se quedaría en cero productos.
 *   - Advierte (no aborta) si una imagen declarada no existe en
 *     images/productos/, o si un SKU está vacío.
 *
 * ID ESTABLE
 *   El ID (columna A) no se genera ni se reescribe en la hoja: esta cuenta
 *   de servicio solo tiene permiso de LECTURA. Si una fila nueva llega con
 *   ID vacío, el generador calcula un id candidato y lo reporta como
 *   advertencia para que una persona lo copie a mano en la columna A -- así
 *   queda estable de verdad, en vez de regenerarse en cada corrida.
 *
 * VARIABLES DE ENTORNO
 *   GOOGLE_SERVICE_ACCOUNT_KEY  JSON completo de la cuenta de servicio (secreto).
 *   SPREADSHEET_ID              Id de la hoja (no es secreto, ver abajo).
 *   OUTPUT_PATH                 Ruta de salida. Default: data/productos.json
 */

import { JWT } from "google-auth-library";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1OfyPTnynDU5mpnpP6P1URUIH7J5YH0FVRTwMEwZFzdU";
const OUTPUT_PATH = process.env.OUTPUT_PATH || "data/productos.json";
// El catálogo publicado actual: la base contra la que se compara para
// detectar caídas masivas y categorías perdidas. Siempre es el archivo
// real, incluso cuando OUTPUT_PATH apunta a un archivo de prueba aparte.
const ANTERIOR_PATH = process.env.ANTERIOR_PATH || "data/productos.json";
const IMAGENES_DIR = "images/productos";
const UMBRAL_CAIDA_PCT = 0.10;

const ESTADOS_IMAGEN_VALIDOS = new Set(["verificada", "pendiente", "revisar"]);

// Quita los acentos (tildes) sin depender de un rango unicode escrito a mano
// en una regex, para no arriesgar un carácter mal copiado: separa cada letra
// de su marca diacrítica (NFD) y descarta los caracteres marcados como
// "combining mark" (categoría Unicode Mn), dejando solo la letra base.
function quitarAcentos(texto) {
  return [...texto.normalize("NFD")]
    .filter((c) => !/\p{Mn}/u.test(c))
    .join("");
}

function slugify(texto) {
  return quitarAcentos(texto.toString())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function leerCuentaDeServicio() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "Falta la variable GOOGLE_SERVICE_ACCOUNT_KEY (secreto de GitHub Actions)."
    );
  }
  return JSON.parse(raw);
}

async function obtenerCliente() {
  const credenciales = await leerCuentaDeServicio();
  const cliente = new JWT({
    email: credenciales.client_email,
    key: credenciales.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  await cliente.authorize();
  return cliente;
}

async function leerRango(cliente, hoja) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(
    hoja
  )}?majorDimension=ROWS`;
  const respuesta = await cliente.request({ url });
  return respuesta.data.values || [];
}

function filasAObjetos(filas) {
  const [encabezado, ...resto] = filas;
  return resto
    .filter((fila) => fila.some((celda) => (celda ?? "").toString().trim() !== ""))
    .map((fila) => {
      const obj = {};
      encabezado.forEach((clave, i) => {
        obj[clave] = (fila[i] ?? "").toString().trim();
      });
      return obj;
    });
}

function numeroONull(texto) {
  if (texto === "" || texto == null) return null;
  const n = Number(texto.toString().replace(/[$.\s]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

async function existeImagen(nombreArchivo) {
  try {
    await access(path.join(IMAGENES_DIR, nombreArchivo));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const errores = [];
  const advertencias = [];

  console.log(`Leyendo hoja ${SPREADSHEET_ID}...`);
  const cliente = await obtenerCliente();
  const [filasProductos, filasCategorias] = await Promise.all([
    leerRango(cliente, "Productos!A:N"),
    leerRango(cliente, "Categorias!A:C"),
  ]);

  const productosCrudos = filasAObjetos(filasProductos);
  const categoriasCrudas = filasAObjetos(filasCategorias);
  console.log(
    `${productosCrudos.length} filas de producto, ${categoriasCrudas.length} categorías leídas.`
  );

  // --- meta.categorias: nombre -> {icono, color}, mas _default preservado ---
  const categoriasSheet = {};
  for (const c of categoriasCrudas) {
    if (!c.Nombre) continue;
    categoriasSheet[c.Nombre] = { icono: c.Icono || "📦", color: c.Color || "#7A5540" };
  }

  let anterior = null;
  try {
    anterior = JSON.parse(await readFile(ANTERIOR_PATH, "utf-8"));
  } catch {
    advertencias.push(
      `No se encontró un ${ANTERIOR_PATH} anterior que preservar (¿primera corrida?).`
    );
  }

  const metaCategorias = { ...categoriasSheet };
  if (anterior?.meta?.categorias?._default) {
    metaCategorias._default = anterior.meta.categorias._default;
  } else if (!metaCategorias._default) {
    metaCategorias._default = { icono: "📦", color: "#7A5540" };
    advertencias.push(
      "No había _default previo que preservar; se usó un valor por defecto (📦 / #7A5540)."
    );
  }

  // --- filtrar activos y traducir cada fila ---
  const activos = productosCrudos.filter((p) => (p.Activo || "").toUpperCase() === "SI");
  console.log(`${activos.length} de ${productosCrudos.length} productos están Activo = SI.`);

  const productos = [];

  for (const fila of activos) {
    const nombre = fila.Nombre || "";
    let id = fila.ID;
    if (!id) {
      const candidato = slugify(`${fila.Marca}-${nombre}`);
      advertencias.push(
        `Producto "${nombre}" no tiene ID en la hoja. ID candidato: "${candidato}" — ` +
          `cópialo a la columna A para que quede estable. Esta corrida NO lo escribe en la hoja.`
      );
      id = candidato;
    }

    if (!fila.Categoria) {
      errores.push(`Producto "${nombre}" (id ${id}) no tiene categoría.`);
    } else if (!metaCategorias[fila.Categoria]) {
      errores.push(
        `Categoría "${fila.Categoria}" del producto "${nombre}" (id ${id}) no existe en la pestaña Categorias.`
      );
    }

    const precio = numeroONull(fila["Precio de venta"]);
    if (precio == null) {
      errores.push(`Producto "${nombre}" (id ${id}) no tiene precio de venta.`);
    } else if (Number.isNaN(precio)) {
      errores.push(`Producto "${nombre}" (id ${id}) tiene un precio no numérico: "${fila["Precio de venta"]}".`);
    } else if (precio < 0) {
      errores.push(`Producto "${nombre}" (id ${id}) tiene precio negativo: ${precio}.`);
    }

    if (!fila.SKU) {
      advertencias.push(`Producto "${nombre}" (id ${id}) no tiene SKU.`);
    }

    const estadoImagen = (fila["Estado de imagen"] || "pendiente").toLowerCase();
    if (!ESTADOS_IMAGEN_VALIDOS.has(estadoImagen)) {
      advertencias.push(
        `Producto "${nombre}" (id ${id}) tiene un Estado de imagen desconocido: "${fila["Estado de imagen"]}".`
      );
    }

    let imagen = null;
    if (fila["Imagen (archivo)"]) {
      const archivo = fila["Imagen (archivo)"];
      if (!(await existeImagen(archivo))) {
        advertencias.push(
          `Producto "${nombre}" (id ${id}) declara la imagen "${archivo}" pero no existe en ${IMAGENES_DIR}/.`
        );
      }
      imagen = `${IMAGENES_DIR}/${archivo}`;
    }

    productos.push({
      id,
      categoria: fila.Categoria || null,
      marca: fila.Marca || null,
      producto: nombre || null,
      variante: null,
      nombreCompleto: nombre || null,
      presentacion: fila.Presentacion || null,
      unidades: fila["Unidades por empaque"] || null,
      peso: fila["Peso aproximado"] || null,
      descripcion: fila.Descripcion || null,
      sku: fila.SKU || null,
      precio: Number.isFinite(precio) ? precio : null,
      disponibilidad: (fila.Agotado || "").trim() ? "no_disponible" : "disponible",
      imagen,
      imagenEstado: ESTADOS_IMAGEN_VALIDOS.has(estadoImagen) ? estadoImagen : "pendiente",
    });
  }

  // --- ID duplicado ---
  const conteoIds = {};
  for (const p of productos) conteoIds[p.id] = (conteoIds[p.id] || 0) + 1;
  for (const [id, n] of Object.entries(conteoIds)) {
    if (n > 1) errores.push(`El id "${id}" aparece repetido en ${n} productos activos.`);
  }

  // --- SKU duplicado entre productos distintos ---
  const skuPorId = {};
  for (const p of productos) {
    if (!p.sku) continue;
    if (!skuPorId[p.sku]) skuPorId[p.sku] = [];
    skuPorId[p.sku].push(p.id);
  }
  for (const [sku, ids] of Object.entries(skuPorId)) {
    const idsUnicos = [...new Set(ids)];
    if (idsUnicos.length > 1) {
      errores.push(`El SKU "${sku}" aparece en productos distintos: ${idsUnicos.join(", ")}.`);
    }
  }

  // --- caída masiva y categorías que quedarían en cero ---
  if (anterior?.productos?.length) {
    const prevCount = anterior.productos.length;
    const newCount = productos.length;
    const caidaPct = (prevCount - newCount) / prevCount;
    if (caidaPct > UMBRAL_CAIDA_PCT) {
      errores.push(
        `El catálogo pasaría de ${prevCount} a ${newCount} productos ` +
          `(caída del ${(caidaPct * 100).toFixed(1)}%, umbral ${UMBRAL_CAIDA_PCT * 100}%).`
      );
    }
    const catsAntes = new Set(anterior.productos.map((p) => p.categoria));
    const catsAhora = new Set(productos.map((p) => p.categoria));
    for (const cat of catsAntes) {
      if (!catsAhora.has(cat)) {
        errores.push(`La categoría "${cat}" se quedaría sin ningún producto.`);
      }
    }
  }

  // --- reporte ---
  if (advertencias.length) {
    console.log(`\n${advertencias.length} advertencia(s):`);
    advertencias.forEach((a) => console.log(`  ADVERTENCIA: ${a}`));
  }

  if (errores.length) {
    console.log(`\n${errores.length} error(es) — ABORTADO, no se escribió ${OUTPUT_PATH}:`);
    errores.forEach((e) => console.log(`  ERROR: ${e}`));
    process.exitCode = 1;
    return;
  }

  // La fecha solo avanza si algo realmente cambió. Si se estampara la
  // fecha de hoy en cada corrida, el archivo se vería "distinto" todos
  // los días aunque ningún producto haya cambiado, y el workflow de
  // publicación haría un commit vacío a diario — justo lo que la
  // salvaguarda "publicar solo si hay cambios" existe para evitar.
  const sinCambiosDeFondo =
    JSON.stringify(productos) === JSON.stringify(anterior?.productos ?? null) &&
    JSON.stringify(metaCategorias) === JSON.stringify(anterior?.meta?.categorias ?? null);

  const salida = {
    meta: {
      fuente: "Google Sheets",
      ultima_actualizacion: sinCambiosDeFondo
        ? anterior.meta.ultima_actualizacion
        : new Date().toISOString().slice(0, 10),
      total_productos: productos.length,
      categorias: metaCategorias,
    },
    productos,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(salida, null, 2), "utf-8");
  console.log(
    sinCambiosDeFondo
      ? `\nOK: sin cambios de fondo; ${OUTPUT_PATH} queda igual (misma fecha).`
      : `\nOK: ${productos.length} productos escritos en ${OUTPUT_PATH}.`
  );
}

main().catch((err) => {
  console.error("ERROR FATAL:", err.message);
  process.exitCode = 1;
});
