/* =========================================================
   DISTRITONY — Catálogo digital
   Fuente de datos: data/productos.json (generado desde Excel)
   ========================================================= */

/* ---------------------------------------------------------
   CONFIGURACIÓN — edita aquí lo que cambie con frecuencia
   --------------------------------------------------------- */
const CONFIG = {
  whatsappNumber: "573202370384", // Colombia +57 320 237 0384, formato E.164 sin '+' para wa.me
  negocio: "Distritony",
  mensajeGenerico: "Hola, quisiera más información sobre el catálogo de Distritony.",
  rutaDatos: "data/productos.json",
};

function buildWhatsappUrl(mensaje) {
  const texto = encodeURIComponent(mensaje);
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${texto}`;
}

/* ---------------------------------------------------------
   ESTADO
   --------------------------------------------------------- */
const PAGE_SIZE = 30;
let visibleCount = PAGE_SIZE;

let TODOS_LOS_PRODUCTOS = [];
let CATEGORIAS = [];
let MARCAS = [];
/* Icono y color de cada categoría. Viven en data/productos.json (meta.categorias)
   para que crear una categoría sea editar solo los datos, sin tocar HTML ni CSS. */
let CAT_META = {};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheEls();
  wireStaticButtons();
  wireMenu();
  document.getElementById("footerYear").textContent = new Date().getFullYear();

  try {
    const res = await fetch(CONFIG.rutaDatos, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    TODOS_LOS_PRODUCTOS = data.productos || [];
    CAT_META = (data.meta && data.meta.categorias) || {};
  } catch (err) {
    console.error("No se pudo cargar productos.json", err);
    els.emptyState.hidden = false;
    els.emptyState.textContent = "No se pudo cargar el catálogo de productos. Intenta recargar la página.";
    return;
  }

  CATEGORIAS = [...new Set(TODOS_LOS_PRODUCTOS.map((p) => p.categoria).filter(Boolean))].sort();
  MARCAS = [...new Set(TODOS_LOS_PRODUCTOS.map((p) => p.marca).filter(Boolean))].sort();

  buildFilterOptions();
  buildQuicknav();
  buildHeroStats();
  wireFilterEvents();
  render();

  // El carrito (cart.js) resuelve nombre/presentación/precio contra este mismo
  // array, así que siempre refleja el Excel vigente, no una copia congelada.
  // (`Cart` es un `const` de nivel superior de cart.js: existe como binding
  // global pero no como propiedad de `window`, por eso se usa `typeof`.)
  if (typeof Cart !== "undefined") {
    Cart.onChange(syncAllCardStates); // tarjeta ↔ carrito: única fuente de verdad
    Cart.setCatalog(TODOS_LOS_PRODUCTOS); // dispara un primer sync (carrito restaurado del localStorage)
  }
}

function cacheEls() {
  els.grid = document.getElementById("productGrid");
  els.emptyState = document.getElementById("emptyState");
  els.resultsInfo = document.getElementById("resultsInfo");
  els.searchInput = document.getElementById("searchInput");
  els.categoriaFilter = document.getElementById("categoriaFilter");
  els.marcaFilter = document.getElementById("marcaFilter");
  els.quicknav = document.getElementById("catQuicknav");
  els.template = document.getElementById("productCardTemplate");
  els.clearFiltersBtn = document.getElementById("clearFiltersBtn");
  els.heroStats = document.getElementById("heroStats");
}

/* ---------------------------------------------------------
   BOTONES WHATSAPP ESTÁTICOS
   --------------------------------------------------------- */
function wireStaticButtons() {
  const url = buildWhatsappUrl(CONFIG.mensajeGenerico);
  ["navWhatsappBtn", "heroWhatsappBtn", "footerWhatsappBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = url;
  });
}

function wireMenu() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

/* ---------------------------------------------------------
   FILTROS / BÚSQUEDA
   --------------------------------------------------------- */
function buildFilterOptions() {
  for (const cat of CATEGORIAS) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = `${cat} (${TODOS_LOS_PRODUCTOS.filter((p) => p.categoria === cat).length})`;
    els.categoriaFilter.appendChild(opt);
  }
  for (const marca of MARCAS) {
    const opt = document.createElement("option");
    opt.value = marca;
    opt.textContent = marca;
    els.marcaFilter.appendChild(opt);
  }
}

/* Presentación de una categoría, siempre desde los datos.
   Una categoría nueva sin entrada propia hereda "_default" en vez de romperse. */
function catMeta(cat) {
  const def = CAT_META._default || {};
  const m = CAT_META[cat] || {};
  return { icono: m.icono || def.icono || "📦", color: m.color || def.color || "#7A5540" };
}

function buildQuicknav() {
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.innerHTML = `<span class="cat-icon">🛍️</span> Todas (${TODOS_LOS_PRODUCTOS.length})`;
  allBtn.dataset.cat = "";
  allBtn.classList.add("active");
  els.quicknav.appendChild(allBtn);

  for (const cat of CATEGORIAS) {
    const btn = document.createElement("button");
    btn.type = "button";
    const count = TODOS_LOS_PRODUCTOS.filter((p) => p.categoria === cat).length;
    const icon = catMeta(cat).icono;
    btn.innerHTML = `<span class="cat-icon">${icon}</span> ${cat} (${count})`;
    btn.dataset.cat = cat;
    els.quicknav.appendChild(btn);
  }

  els.quicknav.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    els.quicknav.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    els.categoriaFilter.value = btn.dataset.cat;
    visibleCount = PAGE_SIZE;
    render();
    document.getElementById("catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function buildHeroStats() {
  const stats = [
    { n: TODOS_LOS_PRODUCTOS.length, label: "productos" },
    { n: CATEGORIAS.length, label: "categorías" },
    { n: MARCAS.length, label: "marcas" },
  ];
  els.heroStats.innerHTML = stats
    .map((s) => `<div class="hero-stat"><strong class="hero-stat-n">${s.n}</strong><span class="hero-stat-label">${s.label}</span></div>`)
    .join("");
}

function wireFilterEvents() {
  els.searchInput.addEventListener("input", debounce(() => { visibleCount = PAGE_SIZE; render(); }, 150));
  els.categoriaFilter.addEventListener("change", () => {
    visibleCount = PAGE_SIZE;
    syncQuicknavWithSelect();
    render();
  });
  els.marcaFilter.addEventListener("change", () => { visibleCount = PAGE_SIZE; render(); });
  els.clearFiltersBtn?.addEventListener("click", () => {
    els.searchInput.value = "";
    els.categoriaFilter.value = "";
    els.marcaFilter.value = "";
    visibleCount = PAGE_SIZE;
    syncQuicknavWithSelect();
    render();
  });
}

function syncQuicknavWithSelect() {
  const val = els.categoriaFilter.value;
  els.quicknav.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b.dataset.cat === val);
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ---------------------------------------------------------
   RENDER
   --------------------------------------------------------- */
/* Minúsculas y sin tildes: así "tajin" encuentra "Tajín",
   "maracuya" encuentra "Maracuyá" y "lokino" encuentra "Lokiño". */
function sinTildes(str) {
  return (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function getFiltered() {
  const q = sinTildes(els.searchInput.value.trim());
  const cat = els.categoriaFilter.value;
  const marca = els.marcaFilter.value;

  return TODOS_LOS_PRODUCTOS.filter((p) => {
    if (cat && p.categoria !== cat) return false;
    if (marca && p.marca !== marca) return false;
    if (q) {
      const haystack = sinTildes(
        [p.nombreCompleto, p.marca, p.producto, p.variante, p.categoria, p.descripcion]
          .filter(Boolean)
          .join(" ")
      );
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  const list = getFiltered();
  els.grid.innerHTML = "";

  if (list.length === 0) {
    els.emptyState.hidden = false;
    els.resultsInfo.textContent = "";
    return;
  }
  els.emptyState.hidden = true;

  const showing = Math.min(visibleCount, list.length);
  const plural = (n) => `${n} producto${n === 1 ? "" : "s"}`;
  els.resultsInfo.textContent = showing < list.length
    ? `Mostrando ${showing} de ${plural(list.length)}`
    : `${plural(list.length)} encontrado${list.length === 1 ? "" : "s"}`;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < showing; i++) frag.appendChild(renderCard(list[i]));
  els.grid.appendChild(frag);

  // Botón "Ver más": solo aparece cuando hay productos ocultos
  if (showing < list.length) {
    const remaining = list.length - showing;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "load-more-btn";
    btn.textContent = `Ver ${Math.min(PAGE_SIZE, remaining)} más`;
    btn.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      render();
    });
    els.grid.appendChild(btn);
  }
}

function renderCard(p) {
  const node = els.template.content.cloneNode(true);
  const card = node.querySelector(".product-card");

  const img = node.querySelector(".card-img");
  const placeholder = node.querySelector(".card-img-placeholder");
  if (p.imagen) {
    img.src = p.imagen;
    img.alt = p.nombreCompleto;
    img.hidden = false;
    placeholder.style.display = "none";
    img.addEventListener("error", () => {
      img.hidden = true;
      placeholder.style.display = "flex";
    });
  } else {
    img.hidden = true;
    placeholder.style.display = "flex";
  }

  const badge = node.querySelector(".card-cat-badge");
  badge.textContent = p.categoria || "";
  if (p.categoria) badge.style.background = catMeta(p.categoria).color;

  if (p.imagen && p.imagenEstado === "revisar") {
    const revisar = document.createElement("span");
    revisar.className = "card-revisar-badge";
    revisar.textContent = "Foto por confirmar";
    card.querySelector(".card-media").appendChild(revisar);
  }

  const noDisponible = p.disponibilidad === "no_disponible";
  card.classList.toggle("is-unavailable", noDisponible);
  node.querySelector(".card-unavailable-badge").hidden = !noDisponible;

  node.querySelector(".card-brand").textContent = p.marca || "";
  node.querySelector(".card-title").textContent = p.nombreCompleto || p.producto || "";
  node.querySelector(".card-desc").textContent = p.descripcion || "";

  // Precio numérico (para el carrito) vs. precio formateado (para mostrar):
  // Cart.formatPrecio() es la única función que decide cómo se ve un precio
  // en pantalla, para que el catálogo y el carrito nunca queden distintos.
  const priceEl = node.querySelector(".card-price");
  const precioNum = typeof Cart !== "undefined" ? Cart.parsePrecio(p.precio) : null;
  if (precioNum != null) {
    priceEl.textContent = Cart.formatPrecio(precioNum);
    priceEl.hidden = false;
  } else {
    priceEl.hidden = true;
  }

  const specs = node.querySelector(".card-specs");
  const specItems = [];
  if (p.presentacion) specItems.push(p.presentacion);
  if (p.peso) specItems.push(p.peso);
  if (p.unidades) specItems.push(`${p.unidades} und/empaque`);
  specs.innerHTML = specItems.map((s) => `<span class="spec">${escapeHtml(s)}</span>`).join("");

  card.dataset.id = p.id;
  // No disponible: se guarda en la tarjeta (no solo en `p`) para que
  // applyCardState() pueda leerlo también cuando la llama syncAllCardStates(),
  // que solo tiene el nodo del DOM, no el producto original.
  card.dataset.disponible = noDisponible ? "no" : "si";

  // La tarjeta y el carrito comparten la misma fuente de verdad (Cart.getQty):
  // agregar/± aquí llama directo al carrito, y applyCardState() es la única
  // función que dibuja el estado, tanto al crear la tarjeta como cuando el
  // carrito cambia desde cualquier otro lado (panel, otra tarjeta, recarga).
  const orderBtn = node.querySelector(".card-order-btn");
  const qtyMinus = node.querySelector(".qty-minus");
  const qtyPlus = node.querySelector(".qty-plus");

  orderBtn.addEventListener("click", () => {
    if (card.dataset.disponible === "no") return; // por si el disabled se pudo evadir
    Cart.add(p.id);
    flashJustAdded(card);
  });
  qtyPlus.addEventListener("click", () => Cart.setQty(p.id, Cart.getQty(p.id) + 1));
  qtyMinus.addEventListener("click", () => {
    const next = Cart.getQty(p.id) - 1;
    if (next < 1) Cart.remove(p.id); // en la tarjeta, llegar a 0 sí elimina el producto
    else Cart.setQty(p.id, next);
  });

  applyCardState(card, typeof Cart !== "undefined" ? Cart.getQty(p.id) : 0);
  return node;
}

// Dibuja el estado "fuera del pedido" (botón rojo), "en el pedido" (✓ + stepper)
// o "no disponible" (botón deshabilitado) de una tarjeta ya insertada en el
// DOM. Única función que decide esta UI.
function applyCardState(card, qty) {
  const addBtn = card.querySelector(".card-order-btn");
  const inCart = card.querySelector(".card-in-cart");
  if (!addBtn || !inCart) return;

  if (card.dataset.disponible === "no") {
    addBtn.hidden = false;
    addBtn.disabled = true;
    addBtn.querySelector(".card-order-label").textContent = "Agotado";
    inCart.hidden = true;
    return;
  }

  const enPedido = qty > 0;
  addBtn.hidden = enPedido;
  inCart.hidden = !enPedido;
  if (enPedido) inCart.querySelector(".qty-value").textContent = String(qty);
}

// Sincroniza TODAS las tarjetas visibles con el estado actual del carrito.
// Se suscribe una sola vez a Cart.onChange, así que reacciona sin importar
// si el cambio vino de una tarjeta, del panel del carrito o de "Vaciar pedido".
function syncAllCardStates() {
  if (typeof Cart === "undefined") return;
  els.grid.querySelectorAll(".product-card").forEach((card) => {
    applyCardState(card, Cart.getQty(card.dataset.id));
  });
}

// Confirmación breve (300–500ms) al agregar; el estado persistente ya quedó
// dibujado por applyCardState antes de que corra esta animación.
function flashJustAdded(card) {
  const inCart = card.querySelector(".card-in-cart");
  if (!inCart) return;
  inCart.classList.remove("just-added"); // reinicia la animación si se hace doble clic rápido
  void inCart.offsetWidth; // fuerza reflow para reiniciar la animación CSS
  inCart.classList.add("just-added");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
