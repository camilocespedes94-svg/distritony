# Contrato de datos del catálogo

Este documento es el contrato entre **la fuente de datos** (hoy el Excel maestro), **el
generador** que la lee (`scripts/excel-to-json.ps1`, en la carpeta de desarrollo), y
**`data/productos.json`**, el único archivo que el frontend consume. Mientras ese contrato se
respete, la fuente de datos es intercambiable — Excel, Google Sheets, Airtable o una base de
datos real — sin tocar `index.html`, `styles.css`, `script.js` ni `cart.js`.

> **Regla de fondo:** `data/productos.json` es un **artefacto generado**. Nadie lo edita a
> mano. Se regenera desde la fuente cada vez que hay cambios que publicar.

---

## El recorrido de un campo

```
Excel maestro (columnas VIGENTE, PVENTA, CODIGO-SKU, CHECADO_EN...)
        │
        │  scripts/excel-to-json.ps1
        │  · filtra VIGENTE = SI
        │  · fusiona colisiones de id por SKU mas reciente
        │  · valida (SKU duplicado, categoria, precio...)
        ▼
data/productos.json (desarrollo)
        │
        │  sync-web.ps1  — copia + valida antes de publicar
        ▼
data/productos.json (publicado)   ← lo único que script.js conoce
        │
        ▼
El navegador → catálogo + carrito → WhatsApp
```

La migración a Google Sheets como fuente operativa está **diseñada, no implementada**: el
archivo de propuesta ya existe (ver Fase 2 del proyecto), pero el generador que realmente
corre hoy sigue leyendo el Excel. Este documento describe el contrato **tal como funciona
ahora mismo**, y señala explícitamente lo que sigue siendo una propuesta a futuro.

---

## Campos de un producto

| Campo | Tipo | Obligatorio | Público | Estable | Regla |
|---|---|---|---|---|---|
| `id` | texto | Sí | Sí | **Sí — nunca cambia** | Slug generado la primera vez que el producto aparece (marca-producto-variante). Después de creado no se regenera aunque el nombre cambie: el generador lo trae del `productos.json` anterior. Ver [Estabilidad del `id`](#estabilidad-del-id). |
| `categoria` | texto | Sí | Sí | No | Debe tener una entrada en `meta.categorias` (icono + color) — si no la tiene, el generador **aborta** en vez de publicar una categoría sin estilo. |
| `marca` | texto | Sí | Sí | No | Texto libre. |
| `producto`, `variante`, `nombreCompleto` | texto | Sí | Sí | No | `nombreCompleto \|\| producto` es lo que pinta `script.js` en el título de la tarjeta. `variante` casi nunca se usa hoy (queda como texto libre o `null`). |
| `descripcion` | texto | Sí | Sí | No | Lo que aparece bajo el nombre en la tarjeta. |
| `presentacion` | texto | No | Sí | No | Ej. `"Paquete x4"`. Vacío → `null`. |
| `unidades` | número o texto | No | Sí | No | Vacío → `null`. |
| `peso` | texto | No | Sí | No | Ej. `"400 g"`. Vacío → `null`. |
| `sku` | texto | Recomendado | Sí | No | Código de barras del punto de venta (columna `CODIGO-SKU`). No es información comercial sensible — se publica. Ver [Sobre el SKU](#sobre-el-sku). |
| `precio` | número | Sí, si el producto está vigente | **Sí, desde 2026-08-21** | No | Precio de venta (columna `PVENTA`). El catálogo, el carrito y el mensaje de WhatsApp lo muestran. El generador **aborta** si un producto vigente no tiene un precio numérico ≥ 0. |
| `disponibilidad` | `"disponible"` / `"no_disponible"` | Sí | Sí | No, pero se preserva | Ver [VIGENTE vs. disponibilidad](#vigente-vs-disponibilidad). |
| `imagen` | texto | No | Sí | No | Ruta relativa dentro de `images/productos/`, o una URL completa el día que las imágenes vivan en otro sitio. Es una referencia libre — el código no asume que el nombre del archivo coincide con el `id`. |
| `imagenEstado` | `verificada` / `pendiente` / `revisar` | Sí | Sí | No | Sin imagen → `imagenEstado: "pendiente"`, `imagen: null`, y la tarjeta muestra "Imagen próximamente". |

`VIGENTE` **no es un campo publicado.** Ver la sección siguiente.

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
| **`NO` / `no_disponible`** | El producto **desaparece** por completo del catálogo | El producto **sigue visible**, con precio, pero con una franja "No disponible" y el botón deshabilitado |
| **Dónde vive** | Columna `VIGENTE` del Excel — nunca llega a `productos.json` | Campo `disponibilidad` de `productos.json` |
| **Quién lo controla hoy** | El Excel maestro | El propio catálogo (no existe columna en el Excel para esto) |

**`VIGENTE` no se publica como campo** porque no hace falta: el generador simplemente omite
del JSON cualquier fila que no tenga `VIGENTE = SI`. La sola presencia de un producto en
`productos.json` ya significa "vigente". Esto es una decisión técnica deliberada — añadir un
campo `vigente: true` a todos los productos sería información redundante, ya que nunca podría
valer `false` (esos productos simplemente no estarían ahí).

**`disponibilidad` sí se publica**, porque a diferencia de `VIGENTE`, el catálogo necesita
mostrar el producto igual — con su precio, con su foto — y solo impedir la compra. Es un dato
que hoy **no existe en ninguna columna del Excel**: se creó directamente en el catálogo,
siguiendo el mismo patrón ya usado para `categoria` — el catálogo manda, y el generador lo
preserva entre regeneraciones. Un producto nuevo nace `"disponible"` por defecto (es el valor
seguro: no bloquea nada que antes funcionara).

---

## `meta`

| Campo | Quién lo escribe | Regla |
|---|---|---|
| `meta.fuente` | El generador | Nombre del archivo Excel usado en esa corrida. |
| `meta.ultima_actualizacion` | El generador / `sync-web.ps1` | Fecha de la corrida, formato `yyyy-mm-dd`. |
| `meta.total_productos` | El generador | Conteo de productos publicados (los `VIGENTE = SI`). |
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

El SKU identifica el producto en el punto de venta. No se considera información sensible — es
un código de barras, no un precio — así que viaja tal cual hasta `productos.json` y queda
público.

Cuando dos filas del Excel representan el mismo producto con distinto código de barras (el
mismo producto re-registrado con un empaque o proveedor distinto), el generador se queda con
**el SKU más reciente** (columna `CHECADO_EN`) y fusiona ambas filas en un solo producto de
catálogo. El generador **aborta** si, en cambio, el mismo SKU aparece en dos productos
(`id`) distintos — eso es un error de datos, no una fusión legítima, y no se decide solo.

---

## Precios: de dónde vienen y dónde se muestran

El precio se lee de la columna `PVENTA` del Excel. Desde el 2026-08-21 es un dato **público**:

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

Si el Excel se reemplaza por Google Sheets, Airtable o el API del punto de venta, lo único que
debe cambiar es **el generador** — el programa que lee la fuente y produce
`data/productos.json` respetando esta tabla. El frontend no sabe ni necesita saber de dónde
salió el archivo, y eso incluye `disponibilidad`: como no viene de ninguna columna hoy, un
generador nuevo solo necesita seguir preservándola entre corridas, igual que `categoria`.

## Historial de cambios de este contrato

- **2026-08-21** — `precio` pasa a ser público (antes se eliminaba al publicar). Se agrega
  `disponibilidad` (`"disponible"` / `"no_disponible"`), independiente de `VIGENTE`. Se
  documenta por qué `VIGENTE` no es un campo publicado.
- **2026-08-21** (temprano) — versión inicial, escrita como propuesta para una futura fuente
  en Google Sheets. El precio todavía no era público en esa versión.
