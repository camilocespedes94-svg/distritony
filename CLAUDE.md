# Reglas permanentes de este proyecto

Catálogo digital de Distritony (dulcería/confitería/galletería, Villanueva, Casanare).
Frontend estático sin build ni framework, publicado en GitHub Pages. Contexto completo en
[`README.md`](README.md), contrato de datos en [`data/esquema.md`](data/esquema.md),
arquitectura del pipeline en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Reglas que no admiten excepción

- **`data/productos.json` es un artefacto generado. Nunca se edita a mano**, ni siquiera para
  pruebas rápidas — lo sobreescribe la próxima corrida automática (11am/4pm hora Bogotá) y el
  cambio manual se pierde sin aviso. La fuente real para editar productos es
  [la hoja de Google Sheets](https://docs.google.com/spreadsheets/d/1OfyPTnynDU5mpnpP6P1URUIH7J5YH0FVRTwMEwZFzdU/edit).
- **Nunca escribir productos, precios ni categorías directamente en HTML/CSS/JS.** El frontend
  solo consume `data/productos.json` vía `fetch`. Si algo hardcodeado en `script.js` parece un
  dato de producto, es un bug, no una función.
- **No cambiar el `id` de un producto existente sin una migración explícita.** Rompe el enlace
  con su imagen y con los carritos que los clientes ya tengan guardados en su navegador.
- **Los precios SÍ son públicos** desde 2026-08-21 (decisión de negocio explícita, documentada
  en `esquema.md`). No los ocultes ni los tomes por accidentalmente sensibles — lo que sí sigue
  siendo privado es todo lo demás de la carpeta de desarrollo (`pdvdata.fdb`, el Excel maestro
  con costos/proveedores/inventario): esa carpeta nunca debe llegar a este repositorio.
- **Nunca poner `GOOGLE_SERVICE_ACCOUNT_KEY` (ni ninguna credencial) en código, commits, o
  mensajes de log.** Vive únicamente como secreto de GitHub Actions.
- **No mezclar `VIGENTE`/`Activo` (decide si el producto existe en el catálogo) con
  `disponibilidad`/`Agotado` (decide si se puede comprar, existiendo).** Son conceptos
  independientes — ver `esquema.md`.

## Cómo validar antes de publicar un cambio al generador

Si tocas `scripts/sheets-to-json.mjs` o su validación, **no lo pruebes contra producción
directamente.** Corre el workflow manual `prueba-sheets.yml` (Actions → "Prueba - generar
catálogo desde Sheets" → Run workflow) — lee la hoja real pero escribe a
`data/productos.sheets-test.json`, nunca hace commit ni push. Revisa el log y el artefacto
generado antes de tocar `publicar-catalogo.yml` o mergear a `main`.

## Cómo se publica

Automático, dos veces al día, vía `.github/workflows/publicar-catalogo.yml`. También se puede
disparar manualmente desde la pestaña Actions. Ese workflow hace `git push` directo a `main`
usando el `GITHUB_TOKEN` por defecto — necesita permiso de escritura habilitado en
`Settings → Actions → General → Workflow permissions`.

## Riesgos conocidos / decisiones deliberadas

- La cuenta de servicio de Google solo tiene permiso de **lectura** sobre la hoja (mínimo
  privilegio). Consecuencia: el generador no puede escribir IDs nuevos de vuelta en la
  columna A cuando alguien agrega un producto sin ID — solo lo reporta como advertencia. Ver
  `docs/ARQUITECTURA.md`.
- El Excel maestro (`scripts/excel-to-json.ps1`, en la carpeta de desarrollo, nunca en este
  repo) quedó retirado como fuente operativa el 2026-08-21. Sigue existiendo como referencia
  histórica pero no corre en producción.
- `meta.ultima_actualizacion` en `productos.json` solo avanza si los productos o categorías
  cambiaron de verdad — si tocas esa lógica, revisa que no vuelva a producir commits vacíos en
  cada corrida programada.

## Antes de un cambio estructural grande

Sigue el patrón ya establecido en este proyecto: inspecciona antes de modificar, explica el
riesgo antes de un cambio irreversible, prefiere cambios pequeños y verificables, corre
`prueba-sheets.yml` antes de tocar producción, revisa `git diff` antes de cada commit, y pide
confirmación explícita antes de cualquier `git push` a `main`.
