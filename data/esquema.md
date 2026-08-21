# Contrato de datos del catálogo

Este documento es el contrato entre **la fuente de datos** (hoy [Google
Sheets](https://docs.google.com/spreadsheets/d/1OfyPTnynDU5mpnpP6P1URUIH7J5YH0FVRTwMEwZFzdU/edit)),
**el generador** que la lee (`scripts/sheets-to-json.mjs`, corre en GitHub Actions), y
**`data/productos.json`**, el único archivo que el frontend consume. Mientras ese contrato se
respete, la fuente de datos es intercambiable — Sheets, Airtable o una base de datos real —
sin tocar `index.html`, `styles.css`, `script.js` ni `cart.js`.

> **Regla de fondo:** `data/productos.json` es un **artefacto generado**. Nadie lo edita a
> mano. Se regenera desde la fuente cada vez que hay cambios que publicar.

---

## El recorrido de un campo

```
Google Sheets (pestañas Productos, Categorias, Configuracion)
        │
        │  GitHub Actions — publicar-catalogo.yml (manual o 11am/4pm hora Bogotá)
        │  scripts/sheets-to-json.mjs
        │    · lee vía API, cuenta de servicio de SOLO LECTURA
        │    · filtra Activo = SI
        │    · valida (SKU duplicado, categoria, precio, caída masiva...)
        ▼
data/productos.json   ← lo único que script.js conoce. Commit automático solo si cambió algo
        │
        ▼
El navegador → catálogo + carrito → WhatsApp
```

Hasta el 2026-08-21 la fuente operativa era un Excel maestro local
(`scripts/excel-to-json.ps1`, en la carpeta de desarrollo, nunca en este repositorio). Ese
script sigue existiendo como referencia histórica pero **no corre en producción** — quedó
retirado el día del corte a Sheets. El detalle completo del pipeline, los dos workflows de
GitHub Actions y las validaciones está en
[`docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md).

---

## Campos de un producto

| Campo | Tipo | Obligatorio | Público | Estable | Regla |
|---|---|---|---|---|---|
| `id` | texto | Sí | Sí | **Sí — nunca cambia** | Columna A de la hoja. Slug generado la primera vez que el producto aparece (marca-producto-variante); después de creado no se regenera aunque el nombre cambie. La cuenta de servicio del generador es de solo lectura, así que no lo escribe de vuelta en la hoja — si una fila llega con ID vacío, el generador calcula uno y lo reporta como advertencia para copiarlo a mano. Ver [Estabilidad del `id`](#estabilidad-del-id). |
| `categoria` | texto | Sí | Sí | No | Debe tener una entrada en `meta.categorias` (icono + color) — si no la tiene, el generador **aborta** en vez de publicar una categoría sin estilo. |
| `marca` | texto | Sí | Sí | No | Texto libre. |
| `producto`, `variante`, `nombreCompleto` | texto | Sí | Sí | No | `nombreCompleto \|\| producto` es lo que pinta `script.js` en el título de la tarjeta. `variante` casi nunca se usa hoy (queda como texto libre o `null`). |
| `descripcion` | texto | Sí | Sí | No | Lo que aparece bajo el nombre en la tarjeta. |
| `presentacion` | texto | No | Sí | No | Ej. `"Paquete x4"`. Vacío → `null`. |
| `unidades` | número o texto | No | Sí | No | Vacío → `null`. |
| `peso` | texto | No | Sí | No | Ej. `"400 g"`. Vacío → `null`. |
| `sku` | texto | Recomendado | Sí | No | Código de barras del producto (columna `SKU` de la hoja). No es información comercial sensible — se publica. Ver [Sobre el SKU](#sobre-el-sku). |
| `precio` | número | Sí, si el producto está activo | **Sí, desde 2026-08-21** | No | Columna `Precio de venta` de la hoja. El catálogo, el carrito y el mensaje de WhatsApp lo muestran. El generador **aborta** si un producto activo no tiene un precio numérico ≥ 0. |
| `disponibilidad` | `"disponible"` / `"no_disponible"` | Sí | Sí | No, pero se preserva | Ver [VIGENTE vs. disponibilidad](#vigente-vs-disponibilidad). |
| `imagen` | texto | No | Sí | No | Ruta relativa dentro de `images/productos/`, o una URL completa el día que las imágenes vivan en otro sitio. Es una referencia libre — el código no asume que el nombre del archivo coincide con el `id`. |
| `imagenEstado` | `verificada` / `pendiente` / `revisar` | Sí | Sí | No | Sin imagen → `imagenEstado: "pendiente"`, `imagen: null`, y la tarjeta muestra "Imagen próximamente". |

`VIGENTE`/`Activo` **no es un campo publicado.** Ver la sección siguiente.

### Ejemplo — un producto real

```json
{
  "id": "piazza-x24",
  "categoria": "Confitería",
  "marca": "Colombina",
  "producto": "Piazza X24",
  "variante": null,
  "nombreCompleto": "Piazza X24",
  "presentacion": null,
  "unidades": null,
  "peso": null,
  "descripcion": "Caramelo duro Piazza en variedad de sabores de frutas, bolsa por 24 unidades.",
  "sku": "7702011201225",
  "precio": 11700,
  "disponibilidad": "disponible",
  "imagen": "images/productos/piazza-x24.jpg",
  "imagenEstado": "verificada"
}
```

---

## VIGENTE vs. disponibilidad

Son dos conceptos distintos y no deben mezclarse:

| | VIGENTE | disponibilidad |
|---|---|---|
| **Qué decide** | Si el producto existe en el catálogo | Si ese producto, existiendo, se puede agregar al pedido |
| **`NO` / `no_disponible`** | El producto **desaparece** por completo del catálogo | El producto **sigue visible**, con precio, pero con una franja "Agotado" y el botón deshabilitado |
| **Dónde vive** | Columna `Activo` de la hoja — nunca llega a `productos.json` | Columna `Agotado` de la hoja → campo `disponibilidad` de `productos.json` |
| **Quién lo controla** | Quien edita la hoja | Quien edita la hoja |

**`Activo`/`VIGENTE` no se publica como campo** porque no hace falta: el generador simplemente
omite del JSON cualquier fila que no tenga `Activo = SI`. La sola presencia de un producto en
`productos.json` ya significa "activo". Esto es una decisión técnica deliberada — añadir un
campo `activo: true` a todos los productos sería información redundante, ya que nunca podría
valer `false` (esos productos simplemente no estarían ahí).

**`disponibilidad` sí se publica**, porque a diferencia de `Activo`, el catálogo necesita
mostrar el producto igual — con su precio, con su foto — y solo impedir la compra. Un producto
nuevo nace `"disponible"` por defecto (es el valor seguro: no bloquea nada que antes
funcionara).

---

## `meta`

| Campo | Quién lo escribe | Regla |
|---|---|---|
| `meta.fuente` | El generador | `"Google Sheets"`. |
| `meta.ultima_actualizacion` | El generador | Fecha de la última corrida que cambió algo de verdad (formato `yyyy-mm-dd`) — si productos y categorías salieron idénticos a lo ya publicado, conserva la fecha anterior en vez de avanzarla, para no generar un commit vacío. |
| `meta.total_productos` | El generador | Conteo de productos publicados (los `Activo = SI`). |
| `meta.categorias` | **Nadie las sobrescribe** | Icono y color de cada categoría. El generador la **preserva tal cual** del `productos.json` anterior — nunca la reescribe, nunca la borra. Es configuración visual, no un dato que salga de la fuente de productos. |

---

## Estabilidad del `id`

El `id` es la única pieza de este contrato que el carrito y las imágenes conocen. Cambiarlo
para un producto que ya existe:

- rompe el enlace con su fotografía en `images/productos/`,
- hace que los clientes que ya lo tienen en el carrito (guardado en su navegador) lo pierdan
  sin aviso.

Por eso el `id` se calcula **una sola vez**, al crear la fila, y después queda fijo aunque el
nombre cambie. Los 206 productos publicados conservan exactamente el `id` que ya tenían.

## Sobre el SKU

El SKU identifica el producto comercialmente. No se considera información sensible — es un
código de barras, no un precio — así que viaja tal cual hasta `productos.json` y queda
público.

En la hoja, cada fila de Productos es ya un producto de catálogo (a diferencia del Excel
original, donde a veces dos filas del punto de venta representaban el mismo producto con
distinto código y había que fusionarlas). El generador **aborta** si el mismo SKU aparece en
dos productos (`id`) distintos — eso es un error de datos que hay que corregir en la hoja, no
algo que el generador decida por su cuenta.

---

## Precios: de dónde vienen y dónde se muestran

El precio se lee de la columna `Precio de venta` de la hoja. Desde el 2026-08-21 es un dato
**público**:

- **Catálogo**: cada tarjeta muestra el precio (`Cart.formatPrecio`, formato `es-CO` / COP).
- **Carrito**: cada línea muestra precio unitario y subtotal; el pie del carrito muestra el
  total, calculado siempre sobre los valores numéricos (`precioUnit × cantidad`), nunca sobre
  el texto ya formateado en pantalla.
- **WhatsApp**: el mensaje incluye precio unitario y subtotal por producto, más un
  `TOTAL ESTIMADO`, seguido siempre de la nota *"los precios son estimados y pueden variar al
  momento de confirmar el pedido"*.

`cart.js` guarda en `localStorage` únicamente `{ id: cantidad }` — nunca el precio. Cada vez
que se abre el carrito, el precio se resuelve contra el `productos.json` vigente en ese
momento, así que si el precio cambia en una publicación posterior, el cliente siempre ve el
precio actual, no uno congelado en el momento en que agregó el producto.

## `data/negocio.json` (propuesto, no creado todavía)

Sacar de `script.js` el número de WhatsApp, la dirección, el enlace de Maps y el lema a un
archivo de configuración plano sigue siendo una mejora pendiente, sin relación con precios o
disponibilidad. No se ha hecho.

---

## Qué implica cambiar de fuente el día de mañana

Ya pasó una vez: el 2026-08-21 la fuente operativa cambió de un Excel maestro local a Google
Sheets, y lo único que cambió fue el generador (`scripts/excel-to-json.ps1` →
`scripts/sheets-to-json.mjs`) — el frontend no se tocó. Si mañana la fuente vuelve a cambiar
(Airtable, el API del punto de venta), la expectativa es la misma: solo se reescribe el
generador, respetando esta tabla. El frontend no sabe ni necesita saber de dónde salió el
archivo, y eso incluye `disponibilidad`: como no viene de ninguna columna de la fuente, un
generador nuevo solo necesita seguir preservándola entre corridas, igual que `categoria`.

## Historial de cambios de este contrato

- **2026-08-21** (tarde) — la fuente operativa pasa de Excel a Google Sheets
  (`scripts/sheets-to-json.mjs`, publicado automáticamente vía GitHub Actions dos veces al
  día). `meta.fuente` ahora dice `"Google Sheets"`. Verificado en producción sin pérdida de
  datos: mismos 206 productos, mismos precios, misma disponibilidad.
- **2026-08-21** — `precio` pasa a ser público (antes se eliminaba al publicar). Se agrega
  `disponibilidad` (`"disponible"` / `"no_disponible"`), independiente de `VIGENTE`/`Activo`.
  Se documenta por qué `VIGENTE`/`Activo` no es un campo publicado.
- **2026-08-21** (temprano) — versión inicial, escrita como propuesta para una futura fuente
  en Google Sheets. El precio todavía no era público en esa versión.
