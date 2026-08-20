/* =========================================================
   DISTRITONY — Carrito / pedido acumulativo
   Módulo independiente de la lógica de presentación del catálogo
   (script.js). Solo conoce:
     - el catálogo vigente, inyectado vía Cart.setCatalog(lista)
     - su propia UI (botón flotante + panel), definida en index.html
   Guarda únicamente {id, cantidad} en localStorage — nunca precio
   ni nombre — para que si el Excel cambia (precio, nombre,
   presentación), el carrito siempre muestre el dato vigente.
   Reutiliza CONFIG y buildWhatsappUrl de script.js (cargado antes).
   ========================================================= */

const Cart = (function () {
  const STORAGE_ITEMS = "distritony_cart_items_v1";

  let items = loadItems(); // { [productoId]: cantidad }
  let catalogo = []; // referencia al array de productos vigente (script.js)
  const listeners = [];

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_ITEMS);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function persistItems() {
    try {
      localStorage.setItem(STORAGE_ITEMS, JSON.stringify(items));
    } catch {
      /* localStorage no disponible (modo privado, cuota, etc.): el carrito sigue
         funcionando en memoria para la sesión actual, solo no sobrevive un recargo */
    }
  }

  function findProduct(id) {
    return catalogo.find((p) => p.id === id) || null;
  }

  // Si el Excel se actualiza y un producto ya no existe, se retira solo del carrito
  function pruneMissing() {
    if (!catalogo.length) return;
    let changed = false;
    for (const id of Object.keys(items)) {
      if (!findProduct(id)) {
        delete items[id];
        changed = true;
      }
    }
    if (changed) persistItems();
  }

  function notify() {
    const summary = { count: getCount(), lines: getLines() };
    listeners.forEach((fn) => fn(summary));
  }

  function setCatalog(lista) {
    catalogo = Array.isArray(lista) ? lista : [];
    pruneMissing();
    notify();
  }

  function add(id, cantidad = 1) {
    if (!findProduct(id)) return; // producto desconocido, no se agrega
    items[id] = (items[id] || 0) + cantidad;
    persistItems();
    notify();
    const p = findProduct(id);
    showToast(`${p.nombreCompleto} agregado a tu pedido`);
  }

  function setQty(id, cantidad) {
    if (!(id in items)) return;
    items[id] = Math.max(1, Math.floor(Number(cantidad) || 1));
    persistItems();
    notify();
  }

  function getQty(id) {
    return items[id] || 0;
  }

  function remove(id) {
    delete items[id];
    persistItems();
    notify();
  }

  function clear() {
    items = {};
    persistItems();
    notify();
  }

  function getCount() {
    return Object.values(items).reduce((sum, n) => sum + n, 0);
  }

  // Cada línea se resuelve contra el catálogo vigente en el momento de leerla,
  // así siempre refleja nombre/presentación/precio actuales del Excel.
  function getLines() {
    return Object.entries(items)
      .map(([id, cantidad]) => {
        const p = findProduct(id);
        if (!p) return null;
        const precioUnit = parsePrecio(p.precio);
        return {
          id,
          cantidad,
          producto: p,
          precioUnit,
          subtotal: precioUnit != null ? precioUnit * cantidad : null,
        };
      })
      .filter(Boolean);
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  // Acepta número, "10000", "$10.000" (miles con punto, estilo CO) o "10.000,50".
  // No inventa el precio: si no se puede interpretar con confianza, devuelve null.
  function parsePrecio(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
    const limpio = String(valor).trim().replace(/[^\d.,]/g, "");
    if (!limpio) return null;
    let normalizado = limpio;
    if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) normalizado = limpio.replace(/\./g, "");
    else if (/^\d{1,3}(,\d{3})+$/.test(limpio)) normalizado = limpio.replace(/,/g, "");
    else if (/^\d+,\d{1,2}$/.test(limpio)) normalizado = limpio.replace(",", ".");
    const n = parseFloat(normalizado);
    return Number.isFinite(n) ? n : null;
  }

  function formatPrecio(n) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(n);
  }

  function buildMensaje(cliente) {
    const lines = getLines();
    if (!lines.length) return "";

    const partes = ["¡Hola Distritony! Quiero realizar el siguiente pedido:", ""];

    for (const l of lines) {
      const nombre = l.producto.nombreCompleto;
      const pres = l.producto.presentacion ? ` — ${l.producto.presentacion}` : "";
      partes.push(`• ${nombre}${pres} — Cantidad: ${l.cantidad}`);
    }

    if (cliente && (cliente.nombre || cliente.notas)) {
      partes.push("");
      if (cliente.nombre) partes.push(`Nombre: ${cliente.nombre}`);
      if (cliente.notas) partes.push(`Observaciones: ${cliente.notas}`);
    }

    partes.push("");
    partes.push("Quedo atento a la confirmación del pedido.");
    partes.push("¡Gracias!");
    return partes.join("\n");
  }

  // ---- confirmación visual al agregar ----
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("cartToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  return {
    add,
    setQty,
    getQty,
    remove,
    clear,
    getCount,
    getLines,
    setCatalog,
    onChange,
    buildMensaje,
    parsePrecio,
    formatPrecio,
  };
})();

/* ---------------------------------------------------------
   UI del carrito: botón flotante + panel lateral/bottom-sheet
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", initCartUI);

function initCartUI() {
  const fab = document.getElementById("cartFab");
  const badge = document.getElementById("cartCount");
  const overlay = document.getElementById("cartOverlay");
  const panel = document.getElementById("cartPanel");
  const closeBtn = document.getElementById("cartCloseBtn");
  const itemsBox = document.getElementById("cartItemsBox");
  const emptyBox = document.getElementById("cartEmpty");
  const emptyBtn = document.getElementById("cartEmptyBtn");
  const footerBox = document.getElementById("cartFooterBox");
  const totalBox = document.getElementById("cartTotalBox");
  const template = document.getElementById("cartItemTemplate");
  const nombreInput = document.getElementById("cartNombre");
  const notasInput = document.getElementById("cartNotas");
  const sendBtn = document.getElementById("cartSendBtn");
  const clearBtn = document.getElementById("cartClearBtn");

  if (!fab || !panel || !template) return;
  const headerCartBtn   = document.getElementById("headerCartBtn");
  const headerCartCount = document.getElementById("headerCartCount");
  if (headerCartBtn) headerCartBtn.addEventListener("click", openPanel);

  const STORAGE_CLIENTE = "distritony_cart_cliente_v1";
  restoreCliente();

  function restoreCliente() {
    try {
      const raw = localStorage.getItem(STORAGE_CLIENTE);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (c.nombre) nombreInput.value = c.nombre;
      if (c.notas) notasInput.value = c.notas;
    } catch {
      /* sin datos de cliente guardados */
    }
  }

  function persistCliente() {
    try {
      localStorage.setItem(
        STORAGE_CLIENTE,
        JSON.stringify({ nombre: nombreInput.value.trim(), notas: notasInput.value.trim() })
      );
    } catch {
      /* no crítico: el pedido en sí no depende de esto */
    }
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
  const persistClienteDebounced = debounce(persistCliente, 300);
  nombreInput.addEventListener("input", persistClienteDebounced);
  notasInput.addEventListener("input", persistClienteDebounced);

  function openPanel() {
    overlay.hidden = false;
    requestAnimationFrame(() => {
      panel.classList.add("open");
      overlay.classList.add("show");
    });
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("cart-open-lock");
  }

  function closePanel() {
    panel.classList.remove("open");
    overlay.classList.remove("show");
    panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cart-open-lock");
    resetClearBtn(); // no dejar "¿Seguro?" pendiente si el usuario cierra sin confirmar
    setTimeout(() => {
      overlay.hidden = true;
    }, 250);
  }

  fab.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);
  emptyBtn.addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("open")) closePanel();
  });

  itemsBox.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    const row = e.target.closest(".cart-item");
    if (!btn || !row) return;
    const id = row.dataset.id;

    if (btn.classList.contains("qty-plus")) {
      Cart.setQty(id, Cart.getQty(id) + 1);
    } else if (btn.classList.contains("qty-minus")) {
      // La cantidad nunca baja de 1 con el stepper; para quitar el producto
      // del pedido existe el botón "Eliminar" explícito.
      const next = Cart.getQty(id) - 1;
      if (next >= 1) Cart.setQty(id, next);
    } else if (btn.classList.contains("cart-item-remove")) {
      Cart.remove(id);
    }
  });

  // Confirmación "toca de nuevo" en vez de window.confirm(): los navegadores
  // embebidos (el de WhatsApp/Instagram, donde se abre este catálogo la
  // mayoría de las veces) suelen bloquear o ignorar los diálogos nativos del
  // navegador, lo que hacía que el botón pareciera no responder.
  const TEXTO_VACIAR = clearBtn.textContent;
  let confirmTimer = null;

  function resetClearBtn() {
    clearTimeout(confirmTimer);
    confirmTimer = null;
    clearBtn.textContent = TEXTO_VACIAR;
    clearBtn.classList.remove("confirming");
  }

  clearBtn.addEventListener("click", () => {
    if (Cart.getCount() === 0) return;
    if (confirmTimer) {
      resetClearBtn();
      Cart.clear();
      return;
    }
    clearBtn.textContent = "¿Seguro? Toca de nuevo";
    clearBtn.classList.add("confirming");
    confirmTimer = setTimeout(resetClearBtn, 3000);
  });

  sendBtn.addEventListener("click", () => {
    persistCliente();
    const mensaje = Cart.buildMensaje({
      nombre: nombreInput.value.trim(),
      notas: notasInput.value.trim(),
    });
    if (!mensaje) return;
    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank", "noopener");
    // El carrito se conserva a propósito: el cliente puede volver del chat de
    // WhatsApp y seguir viendo/editando su pedido. "Vaciar pedido" lo limpia.
  });

  function renderPanel(summary) {
    badge.textContent = String(summary.count);
    badge.classList.toggle("cart-badge-empty", summary.count === 0);
    if (headerCartCount) headerCartCount.textContent = String(summary.count);
    fab.setAttribute("aria-label", `Mi pedido, ${summary.count} producto${summary.count === 1 ? "" : "s"}`);

    itemsBox.innerHTML = "";

    if (!summary.lines.length) {
      emptyBox.hidden = false;
      footerBox.hidden = true;
      return;
    }
    emptyBox.hidden = true;
    footerBox.hidden = false;

    const frag = document.createDocumentFragment();
    for (const line of summary.lines) {
      const node = template.content.cloneNode(true);
      const row = node.querySelector(".cart-item");
      row.dataset.id = line.id;
      node.querySelector(".cart-item-name").textContent = line.producto.nombreCompleto;
      node.querySelector(".cart-item-pres").textContent = line.producto.presentacion || "";
      node.querySelector(".qty-value").textContent = String(line.cantidad);
      node.querySelector(".qty-minus").disabled = line.cantidad <= 1;
      node.querySelector(".cart-item-price").hidden = true;
      frag.appendChild(node);
    }
    itemsBox.appendChild(frag);

    totalBox.hidden = true;
  }

  Cart.onChange(renderPanel);
  renderPanel({ count: Cart.getCount(), lines: Cart.getLines() });
}
