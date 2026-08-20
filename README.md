# Catálogo digital Distritony

Catálogo público de **Distritony** — dulcería, confitería y galletería en Villanueva,
Casanare. El cliente navega el portafolio, arma su pedido y lo envía por WhatsApp.

**Sitio publicado:** https://camilocespedes94-svg.github.io/distritony/

No es una tienda en línea: no cobra, no procesa pagos y **no muestra precios**. El pedido
llega como un mensaje de WhatsApp que el negocio cotiza y confirma.

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
├── data/
│   └── productos.json      ← LA BASE DE DATOS. Todo sale de aquí.
├── images/
│   ├── productos/          184 fotos de producto
│   └── marcas/             9 logos del muro de marcas
└── assets/
    ├── og-distritony.png   Vista previa al compartir el enlace
    └── logo/               Ícono de la app
```

## La regla que sostiene todo

> **`data/productos.json` es la única fuente de verdad.**
> Agregar un producto, cambiar una descripción, crear una categoría o poner una imagen se
> hace editando ese archivo. **Nunca se toca el HTML.**

No hay un solo producto escrito dentro de `index.html`. La página tiene **una** plantilla
(`<template id="productCardTemplate">`) que `script.js` clona una vez por producto. Las
categorías y las marcas se deducen solas de los datos.

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

### Agregar o modificar un producto

Editar `data/productos.json`. Cada producto es un bloque como este:

```json
{
  "id": "trolli-tortu-x100",
  "categoria": "Gomas",
  "marca": "Aldor",
  "producto": "Trolli Tortu X100",
  "nombreCompleto": "Trolli Tortu X100",
  "presentacion": null,
  "descripcion": "Gomitas Trolli en forma de tortuga, bolsa por 100 unidades.",
  "imagen": "images/productos/trolli-tortu-x100.jpg",
  "imagenEstado": "ok"
}
```

- **`id`** debe ser único y en minúsculas con guiones. Es lo que enlaza el producto con su
  imagen y con el carrito guardado en el navegador. **No lo cambies** en un producto que ya
  existe: los clientes que lo tengan en su carrito lo perderían.
- **`imagen`** es la ruta relativa al archivo. Si no hay foto, poner `null` y la tarjeta
  muestra el marcador "Imagen próximamente".
- **Nunca agregues un campo `precio`.** Este catálogo es público.

### Agregar una imagen

1. Guardarla en `images/productos/` con el mismo nombre que el `id` del producto.
2. Apuntar el campo `imagen` a esa ruta.

Dos detalles que importan:

- **Mayúsculas y minúsculas cuentan.** Tu computador no distingue entre `Foto.JPG` y
  `foto.jpg`, pero el servidor de GitHub sí. Si no coinciden exactamente, la imagen no
  aparece una vez publicada. Usa siempre minúsculas.
- Un tamaño de unos **600 × 600 px** es más que suficiente; las tarjetas se ven a ~270 px.

### Crear una categoría

Basta con dos cosas dentro de `data/productos.json`:

1. Poner el nombre nuevo en el campo `categoria` de los productos que le corresponden.
2. Registrar su ícono y su color en `meta.categorias`:

```json
"meta": {
  "categorias": {
    "Bebidas": { "icono": "🥤", "color": "#1E6F8C" }
  }
}
```

El menú, el filtro, los contadores y el color de la etiqueta aparecen solos. Si olvidas el
paso 2 la categoría igual funciona: hereda el ícono y color de `_default`.

El color va detrás de texto blanco, así que conviene que sea oscuro — busca al menos 4,5:1
de contraste.

---

## Publicar los cambios

El sitio se actualiza solo al subir los cambios a GitHub. Tres comandos:

```bash
git add -A
git commit -m "Actualiza catálogo: agrega productos de temporada"
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

---

## Qué NO tocar

| Archivo | Por qué |
|---|---|
| `.nojekyll` | Sin él, GitHub Pages procesa el sitio con Jekyll y puede ignorar archivos |
| `index.html` | Solo para cambiar textos fijos. Los productos **nunca** van aquí |
| El campo `id` de un producto existente | Rompe el enlace con su imagen y con los carritos ya guardados |
| Los 9 logos de `images/marcas/` | Están fijos en el HTML; cambiarlos es una decisión de marketing, no de catálogo |

Y una regla que no admite excepción:

> **Nunca subas a este repositorio la carpeta de trabajo `Distritony-Catalogo`.**
> Contiene los precios y `pdvdata.fdb`, la base de datos del punto de venta. El repositorio
> es público y **git conserva el historial**: borrar un archivo después no lo elimina de
> verdad. El `.gitignore` bloquea los patrones más peligrosos, pero la protección real es no
> mezclar las carpetas.

---

## Más adelante: dominio propio

El sitio usa rutas relativas, así que conectar un dominio comprado no exige rehacer nada:
se agrega un archivo `CNAME` con el dominio, se apunta el DNS a GitHub y se activa en
*Settings → Pages*. Lo único que habría que actualizar son las URL absolutas de las
etiquetas Open Graph en `index.html`.
