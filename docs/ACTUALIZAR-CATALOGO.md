# Cómo actualizar el catálogo

Esta guía es para quien administra los productos del día a día — no hace falta saber
programar ni usar GitHub. Todo se hace desde una sola hoja de cálculo de Google.

## La hoja

**[Abrir la hoja de Google Sheets](https://docs.google.com/spreadsheets/d/1OfyPTnynDU5mpnpP6P1URUIH7J5YH0FVRTwMEwZFzdU/edit)**

Tiene 4 pestañas abajo:

- **Productos** — la que vas a usar casi siempre. Un producto por fila.
- **Categorias** — la lista de categorías del catálogo, con su ícono y color.
- **Configuracion** — datos generales del negocio (WhatsApp, dirección, etc.).
- **Instrucciones** — un resumen de estas mismas reglas, dentro de la propia hoja.

Todo lo que edites aquí se publica en la página web — automáticamente dos veces al día, o de
inmediato si no quieres esperar (ver [Publicar ya mismo](#publicar-ya-mismo)).

## Modificar un producto que ya existe

Busca la fila (`Ctrl+F` / `Cmd+F` para buscar por nombre) y edita la celda que necesites:
nombre, descripción, precio, categoría, marca, imagen. Guarda solo — Google Sheets guarda
automáticamente, no hay botón de "guardar".

**Una columna que nunca se toca a mano: `ID` (columna A).** Se genera sola al crear el
producto y después queda fija para siempre, aunque cambie el nombre. Si la borras o la
cambias, ese producto pierde su foto y los clientes que ya lo tenían en su carrito lo pierden
sin aviso.

## Agregar un producto nuevo

1. Ve a la pestaña **Productos** y agrega una fila al final de la lista.
2. Deja la columna **ID** vacía — no la llenes tú.
3. Llena **Categoría** (elige una de la lista desplegable — no puedes escribir una que no
   exista en la pestaña Categorias), **Marca**, **Nombre**, **Descripción**, **Precio de
   venta**.
4. Si tienes la foto, súbela a la carpeta de imágenes del proyecto con el nombre exacto que
   vas a escribir en la columna **Imagen (archivo)** — pregúntale a quien administra el sitio
   cómo subirla si no tienes acceso directo. Si no tienes la foto todavía, deja esa columna
   vacía: el catálogo muestra "Imagen próximamente" hasta que la agregues.
5. Activo debe quedar en **SI**.

Como el sistema que publica el catálogo solo tiene permiso de **lectura** sobre esta hoja (no
puede escribirte de vuelta), tu producto nuevo aparecerá en el catálogo sin problema, pero **el
ID que le corresponde no se escribe solo en la columna A.** Si necesitas que quede
completamente estable de aquí en adelante (para que nunca pierda su foto ni su lugar en
carritos guardados), pide que alguien con acceso al código copie el ID sugerido a la hoja —
aparece en el registro de la publicación (ver [Qué hacer si algo falla](#qué-hacer-si-algo-falla)) la primera vez que ese producto se publica.

## Sacar un producto — dos formas distintas, para dos situaciones distintas

| Quieres que el producto... | Qué hacer (columna) | Qué ve el cliente |
|---|---|---|
| **Deje de existir** — se descontinuó, ya no se distribuye | `Activo` → `NO` | Desaparece por completo del catálogo |
| **Se agote temporalmente**, pero sigue siendo un producto real | `Agotado` → escribe la palabra `Agotado` | Sigue viendo la tarjeta, con su foto y su precio, pero con una franja roja "Agotado" y sin poder agregarlo al pedido |
| **Vuelva a estar disponible** | `Agotado` → deja la celda vacía | Vuelve a comprarse normalmente |
| **Vuelva a estar activo** tras haberlo descontinuado | `Activo` → `SI` | Reaparece en el catálogo |

No confundas los dos casos: `Activo = NO` es para lo que ya no se vende nunca más.
`Agotado` es para lo que hoy no hay en bodega pero se va a reponer — el cliente lo sigue
viendo, solo no lo puede comprar mientras tanto.

## Cambiar un precio

Edita la columna **Precio de venta**. Ese número es el que ve el cliente en el catálogo, en
su carrito y en el mensaje de WhatsApp — no hay que tocar nada más.

## Las filas en rojo

Si una fila se ve resaltada en rojo, tiene un error: un SKU repetido, un ID repetido, o le
falta un dato obligatorio (categoría o precio). **Esa fila no se va a publicar** hasta que se
corrija — el resto del catálogo sigue publicándose normal, esa fila simplemente se ignora
hasta que quede bien.

## Cómo se publica

**No tienes que hacer nada especial.** El catálogo se actualiza solo, automáticamente, **dos
veces al día: 11:00 a. m. y 4:00 p. m.** (hora Colombia). Cualquier cambio que hayas hecho en
la hoja antes de esas horas queda publicado en el sitio unos minutos después.

### Publicar ya mismo

Si no quieres esperar a la próxima corrida automática:

1. Entra a [github.com/camilocespedes94-svg/distritony/actions/workflows/publicar-catalogo.yml](https://github.com/camilocespedes94-svg/distritony/actions/workflows/publicar-catalogo.yml)
2. Botón **Run workflow** (arriba a la derecha) → de nuevo **Run workflow** en el cuadro que
   aparece.
3. Espera medio minuto y recarga la página — verás un ✓ verde si quedó publicado.

## Qué hacer si algo falla

Si ves una **✗ roja** en vez de un ✓ verde en esa misma página de Actions:

1. Haz clic sobre esa corrida fallida.
2. Haz clic en el paso que dice "Generar catálogo" — ahí aparece, en español, exactamente qué
   fila y qué columna tiene el problema (ej. *"Producto 'X' no tiene precio de venta"*).
3. Corrige esa celda en la hoja.
4. Vuelve a intentar publicar ya mismo (pasos de arriba), o espera a la próxima corrida
   automática.

**Nada se rompe mientras tanto.** Si la publicación falla, el sitio se queda exactamente como
estaba antes — nunca publica algo a medias ni con errores. Un catálogo con una fila mala en la
hoja simplemente no se actualiza hasta que se corrija esa fila; no borra ni daña lo que ya
estaba publicado.

Si algo no tiene sentido con este procedimiento, escribe a Camilo o a Claude Code contando qué
pasó.
