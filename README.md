# Catálogo digital Distritony

Catálogo público de **Distritony** — dulcería, confitería y galletería en Villanueva,
Casanare. El cliente navega el portafolio, arma su pedido y lo envía por WhatsApp.

**Sitio publicado:** https://camilocespedes94-svg.github.io/distritony/

No es una tienda en línea: no cobra ni procesa pagos, aunque desde el 2026-08-21 sí **muestra
precios de venta** en el catálogo, el carrito y el mensaje de WhatsApp — siempre marcados como
estimados. El pedido llega como un mensaje de WhatsApp que el negocio confirma y, si algo
cambió, ajusta.

---

## Cómo está hecho

HTML, CSS y JavaScript estándar. **Sin framework, sin build, sin dependencias.** Se abre con
doble clic o se sube tal cual a cualquier hosting.

```
distritony/
├── index.html              Estructura de la página + SVG del logo
├── styles.css              Identidad visual completa
├── script.js               Carga los datos, arma las tarjetas, filtros y búsqueda
├── cart.js                 Carrito y mensaje de WhatsApp
├── manifest.webmanifest    Permite instalarlo como app en el móvil
├── CLAUDE.md               Reglas permanentes del proyecto
├── data/
│   ├── productos.json      ← EL CATÁLOGO PUBLICADO. Generado — nunca se edita a mano.
│   └── esquema.md          Qué significa cada campo, cuál es obligatorio, cuál es público
├── scripts/
│   └── sheets-to-json.mjs  El generador: lee Google Sheets, valida, produce productos.json
├── .github/workflows/      Publicación automática (ver docs/ARQUITECTURA.md)
├── docs/
│   ├── ACTUALIZAR-CATALOGO.md   Cómo editar productos — para quien administra la tienda
│   └── ARQUITECTURA.md          Cómo funciona el pipeline — para quien toque el código
├── images/
│   ├── productos/          184 fotos de producto
│   └── marcas/             9 logos del muro de marcas
└── assets/
    ├── og-distritony.png   Vista previa al compartir el enlace
    └── logo/               Ícono de la app
```

## La regla que sostiene todo

> **`data/productos.json` es el contrato entre los datos y la página — pero ya no es donde se
> edita.** Es un archivo **generado** automáticamente desde
> [Google Sheets](https://docs.google.com/spreadsheets/d/1OfyPTnynDU5mpnpP6P1URUIH7J5YH0FVRTwMEwZFzdU/edit)
> dos veces al día. Agregar un producto, cambiar un precio o marcarlo agotado se hace en esa
> hoja — nunca editando `productos.json` directamente (se sobreescribe solo) ni tocando el
> HTML.

No hay un solo producto escrito dentro de `index.html`. La página tiene **una** plantilla
(`<template id="productCardTemplate">`) que `script.js` clona una vez por producto. Las
categorías y las marcas se deducen solas de los datos.

**Para editar el catálogo del día a día, la guía es [`docs/ACTUALIZAR-CATALOGO.md`](docs/ACTUALIZAR-CATALOGO.md)** —
escrita para quien administra la tienda, sin necesitar GitHub ni saber programar. Lo que sigue
en este README es la referencia técnica del *formato* de los datos, útil para quien toque el
generador o el frontend.

---

## Cómo trabajar con el catálogo

### Ver el sitio en tu computador

Como `script.js` carga el JSON con `fetch`, **no basta con abrir `index.html` con doble
clic**: el navegador bloquea esa lectura en archivos locales. Hay que levantar un servidor.

Con Python:

```bash
python -m http.server 8000
```

Y abrir <http://localhost:8000>.

### Cómo se ve un producto en el JSON generado

Esto es la *referencia del formato*, no una instrucción de edición — para agregar o modificar
un producto de verdad, edita [la hoja de Sheets](docs/ACTUALIZAR-CATALOGO.md), no este archivo.
Cada producto, ya generado, es un bloque como este:

```json
{
  "id": "trolli-tortu-x100",
  "categoria": "Gomas",
  "marca": "Aldor",
  "producto": "Trolli Tortu X100",
  "nombreCompleto": "Trolli Tortu X100",
  "presentacion": null,
  "descripcion": "Gomitas Trolli en forma de tortuga, bolsa por 100 unidades.",
  "sku": "7702011000606",
  "precio": 9500,
  "disponibilidad": "disponible",
  "imagen": "images/productos/trolli-tortu-x100.jpg",
  "imagenEstado": "verificada"
}
```

- **`id`** debe ser único y en minúsculas con guiones. Es lo que enlaza el producto con su
  imagen y con el carrito guardado en el navegador. **No lo cambies** en un producto que ya
  existe: los clientes que lo tengan en su carrito lo perderían.
- **`imagen`** es la ruta relativa al archivo. Si no hay foto, poner `null` y la tarjeta
  muestra el marcador "Imagen próximamente".
- **`precio`** es un número (sin puntos, comas ni símbolo de moneda) y es obligatorio: el
  catálogo, el carrito y el mensaje de WhatsApp lo usan para calcular subtotales y el total.
  Es el precio de venta real, no el de costo.
- El detalle completo de cada campo — cuál es obligatorio, cuál es público, cuál nunca cambia
  — está en [`data/esquema.md`](data/esquema.md).

### Vigente y disponibilidad — no son lo mismo

Dos formas distintas de "sacar" un producto, para dos situaciones distintas:

| Quiero que el producto... | Qué hacer | Qué ve el cliente |
|---|---|---|
| **Deje de existir** en el catálogo (se descontinuó, ya no se distribuye) | Columna `Activo` → `NO` en la hoja | Desaparece por completo |
| **Se agote temporalmente**, pero siga siendo un producto real | Columna `Agotado` → escribe `Agotado` en la hoja | Sigue viendo la tarjeta, con su foto y su precio, pero con una franja roja **"Agotado"** y sin poder agregarlo al pedido |
| **Vuelva a estar en venta** | Columna `Agotado` → deja la celda vacía | Vuelve a comprarse normalmente |

No confundas los dos casos: `Activo = NO` es para lo que ya no se vende nunca más; `Agotado`
es para lo que hoy no hay en bodega pero se va a reponer. Si un cliente ya tenía ese producto
en su carrito cuando se marca `Agotado`, el carrito lo detecta solo, lo retira y le avisa — no
puede llegar a enviarse en un pedido por WhatsApp. Paso a paso completo en
[`docs/ACTUALIZAR-CATALOGO.md`](docs/ACTUALIZAR-CATALOGO.md).

### Cambiar un precio

Columna **Precio de venta** en la hoja. El catálogo, el carrito y el mensaje de WhatsApp
siempre calculan a partir de ese número.

### Agregar una imagen

Las fotos siguen viviendo en este repositorio, no en la hoja — Sheets solo guarda el *nombre*
del archivo (columna **Imagen (archivo)**):

1. Sube el archivo a `images/productos/` (requiere acceso al repositorio de GitHub).
2. Escribe ese nombre exacto en la columna Imagen (archivo) de la fila del producto.

Dos detalles que importan:

- **Mayúsculas y minúsculas cuentan.** Tu computador no distingue entre `Foto.JPG` y
  `foto.jpg`, pero el servidor de GitHub sí. Si no coinciden exactamente, la imagen no
  aparece una vez publicada. Usa siempre minúsculas.
- Un tamaño de unos **600 × 600 px** es más que suficiente; las tarjetas se ven a ~270 px.

### Crear una categoría

En la pestaña **Categorias** de la hoja, agrega una fila con el nombre, el ícono y el color
(formato `#RRGGBB`). El generador la recoge sola la próxima vez que publique — el menú, el
filtro, los contadores y el color de la etiqueta aparecen sin tocar código. Una categoría sin
esa configuración hace que el generador **aborte la publicación** en vez de mostrar una
etiqueta sin estilo, así que este paso no es opcional.

El color va detrás de texto blanco, así que conviene que sea oscuro — busca al menos 4,5:1
de contraste.

---

## Publicar los cambios

Hay dos cosas distintas que "publicar" puede significar aquí:

- **Cambios al catálogo** (productos, precios, categorías, disponibilidad) — se editan en
  [Google Sheets](https://docs.google.com/spreadsheets/d/1OfyPTnynDU5mpnpP6P1URUIH7J5YH0FVRTwMEwZFzdU/edit)
  y se publican solos, automáticamente, dos veces al día. Guía completa (sin git, sin
  terminal) en [`docs/ACTUALIZAR-CATALOGO.md`](docs/ACTUALIZAR-CATALOGO.md).
- **Cambios al código del sitio** (HTML, CSS, JS, o al generador en `scripts/`) — esos sí se
  publican con git, de la forma normal:

```bash
git add -A
git commit -m "Ajusta el diseño de la tarjeta de producto"
git push
```

GitHub Pages reconstruye el sitio en aproximadamente un minuto. Después conviene recargar
con `Ctrl + Shift + R` para saltarse la caché del navegador.

Si algo sale mal, se puede volver a la versión anterior:

```bash
git log --oneline        # ver el historial
git revert <código>      # deshacer un cambio concreto
git push
```

Esto **no** deshace cambios de catálogo — esos viven en Sheets, no en el historial de git.
Para revertir un cambio de catálogo, corrígelo directamente en la hoja.

---

## Qué NO tocar

| Archivo | Por qué |
|---|---|
| `.nojekyll` | Sin él, GitHub Pages procesa el sitio con Jekyll y puede ignorar archivos |
| `index.html` | Solo para cambiar textos fijos. Los productos **nunca** van aquí |
| `data/productos.json` a mano | Es un archivo generado — la próxima publicación automática lo sobreescribe. Edita la hoja de Sheets, no este archivo |
| El campo `id` de un producto existente (en la hoja o en el JSON) | Rompe el enlace con su imagen y con los carritos ya guardados |
| Los 9 logos de `images/marcas/` | Están fijos en el HTML; cambiarlos es una decisión de marketing, no de catálogo |

Y una regla que no admite excepción:

> **Nunca subas a este repositorio la carpeta de trabajo `Distritony-Catalogo`.**
> Contiene `pdvdata.fdb` — la base de datos completa del punto de venta — y el Excel maestro
> con columnas internas (costos, proveedores, inventario) que van mucho más allá de lo que el
> catálogo necesita publicar. El precio de venta sí es público desde el 2026-08-21, pero eso
> no cambia esta regla: el repositorio es público y **git conserva el historial** — borrar un
> archivo después no lo elimina de verdad. El `.gitignore` bloquea los patrones más
> peligrosos, pero la protección real es no mezclar las carpetas.

---

## Más adelante: dominio propio

El sitio usa rutas relativas, así que conectar un dominio comprado no exige rehacer nada:
se agrega un archivo `CNAME` con el dominio, se apunta el DNS a GitHub y se activa en
*Settings → Pages*. Lo único que habría que actualizar son las URL absolutas de las
etiquetas Open Graph en `index.html`.
