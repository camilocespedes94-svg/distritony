# Arquitectura

Documento técnico para quien vaya a tocar el pipeline (no el catálogo en sí — para eso está
[`ACTUALIZAR-CATALOGO.md`](ACTUALIZAR-CATALOGO.md)). Complementa a
[`data/esquema.md`](../data/esquema.md), que documenta el contrato de campos; este archivo
documenta cómo se mueven los datos entre sistemas y por qué está armado así.

## El recorrido completo

```
Persona de tienda
      │  edita
      ▼
Google Sheets (Productos / Categorias / Configuracion)
      │
      │  GitHub Actions — publicar-catalogo.yml
      │  (manual o automático 11am/4pm hora Bogotá)
      │
      │  scripts/sheets-to-json.mjs
      │    · lee Sheets vía API (cuenta de servicio, SOLO LECTURA)
      │    · filtra Activo = SI
      │    · valida (ver más abajo)
      │    · si hay error: aborta, no escribe nada
      ▼
data/productos.json   ← artefacto generado, commit automático solo si cambió algo real
      │
      │  git push (bot, con permiso de escritura del repo)
      ▼
GitHub → GitHub Pages (reconstruye solo)
      │
      ▼
El navegador → script.js (catálogo) → cart.js (carrito) → WhatsApp
```

Cada flecha es una frontera de responsabilidad — nada del lado derecho conoce los detalles del
lado izquierdo. El frontend (`script.js`, `cart.js`) no sabe que existe Google Sheets; solo
sabe leer `data/productos.json`. Si el día de mañana la fuente cambia otra vez (Airtable, un
API del punto de venta), lo único que hay que reescribir es `scripts/sheets-to-json.mjs` — el
contrato de `data/productos.json`, documentado en `esquema.md`, no cambia.

## Los dos workflows de GitHub Actions

| | `prueba-sheets.yml` | `publicar-catalogo.yml` |
|---|---|---|
| Dispara | Solo manual | Manual, o automático 11am/4pm Bogotá |
| Escribe | `data/productos.sheets-test.json` (nunca el real) | `data/productos.json` |
| Hace commit/push | **Nunca** | Solo si el generador no encontró errores **y** el resultado cambió de verdad |
| Para qué sirve | Probar el generador contra la hoja real sin ningún riesgo — útil después de tocar `sheets-to-json.mjs` | La publicación real |

`prueba-sheets.yml` existe porque antes de confiar el `git push` automático a un cambio en el
generador, conviene poder correrlo contra los datos reales sin que exista ninguna manera de que
toque producción, ni siquiera por accidente.

## Validaciones del generador (`scripts/sheets-to-json.mjs`)

Todas viven en una sola pasada; si cualquiera de las marcadas **aborta** falla, no se escribe
absolutamente nada — ni el archivo de prueba ni el real.

| Validación | Efecto |
|---|---|
| SKU repetido entre productos activos distintos | Aborta |
| ID repetido | Aborta |
| Categoría vacía, o sin ícono/color en la pestaña Categorias | Aborta |
| Precio ausente, no numérico, o negativo, en un producto activo | Aborta |
| El catálogo caería más del 10% en número de productos | Aborta |
| Una categoría existente se quedaría sin ningún producto | Aborta |
| SKU vacío | Advertencia (no bloquea) |
| Imagen declarada pero el archivo no existe en `images/productos/` | Advertencia |
| Estado de imagen con un valor desconocido | Advertencia |
| Producto sin ID en la hoja | Advertencia — genera un ID candidato y lo reporta, pero no lo escribe de vuelta (ver más abajo) |

El umbral del 10% y la protección de categorías-en-cero existen por el mismo motivo que en el
generador anterior basado en Excel: una fila vacía por accidente en la hoja no debe poder
tumbar buena parte del catálogo sin que nadie se dé cuenta.

## Por qué la cuenta de servicio es de solo lectura

`GOOGLE_SERVICE_ACCOUNT_KEY` (secreto de GitHub) solo tiene el scope
`spreadsheets.readonly`. Es la opción de menor privilegio posible: si esa credencial se
filtrara, quien la tenga puede leer la hoja pero no puede modificarla ni borrarla.

La consecuencia directa es la fila de la tabla de arriba sobre "producto sin ID": el
generador **no puede** escribir un ID nuevo de vuelta en la columna A, porque no tiene permiso
de escritura sobre la hoja. Si en el futuro se decide que vale la pena automatizar eso, hay que
subir la cuenta de servicio a permiso de Editor — una decisión de seguridad explícita, no algo
para hacer sin pensarlo.

## Por qué `VIGENTE`/`Activo` no es un campo publicado, pero `disponibilidad`/`Agotado` sí

Ver la sección dedicada en [`esquema.md`](../data/esquema.md#vigente-vs-disponibilidad). En
resumen: la sola presencia de un producto en `productos.json` ya significa que está activo,
así que un campo `activo: true` en todos los productos sería redundante. `disponibilidad` sí
se publica porque el catálogo necesita mostrar el producto (foto, precio) aunque no se pueda
comprar — un caso que `Activo` no puede expresar por sí solo.

## Por qué la fecha de `meta.ultima_actualizacion` no siempre avanza

El generador compara los productos y categorías recién leídos contra los ya publicados
(`data/productos.json` en el checkout). Si son iguales, conserva la fecha anterior en vez de
poner la de hoy. Sin esto, cada corrida —incluidas las dos automáticas diarias— produciría un
commit "vacío" (mismo contenido, fecha distinta), y la salvaguarda "publicar solo si hay
cambios" de `publicar-catalogo.yml` dejaría de tener sentido.

## Excel: retirado como fuente operativa

Hasta el 2026-08-21 el catálogo se generaba desde un Excel maestro local
(`scripts/excel-to-json.ps1`, en la carpeta de desarrollo — nunca en este repositorio público).
Ese script sigue existiendo como referencia histórica, pero **no corre en producción**: la
fuente operativa real es Google Sheets. `meta.fuente` en `productos.json` lo refleja
directamente (dice `"Google Sheets"`).

## Qué NO se construyó a propósito

Por instrucción explícita del proyecto: sin React/Vue/framework alguno en el frontend, sin
base de datos real, sin API propia sirviendo productos, sin Apps Script como capa de lectura
para el navegador (el navegador solo conoce `data/productos.json` estático), sin panel
administrativo, sin login, sin checkout. El objetivo fue resolver **quién puede editar el
catálogo y cómo se publica**, no construir una plataforma de comercio electrónico.
