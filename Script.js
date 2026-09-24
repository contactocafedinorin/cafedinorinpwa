/* CAFÉ DINORÍN - Lógica completa
   Vanilla JS, sin dependencias de pago.
   PWA + carrito + checkout + inventario localStorage + WhatsApp
*/

// ========== CONFIGURACIÓN PRINCIPAL (EDITABLE) ==========
const CONFIG_DEFAULT = {
  marca: {
    nombre: "CAFÉ DINORÍN",
    slogan: "El sabor que se queda en casa",
    origen: "Altas Montañas de Veracruz, México"
  },
  // [PENDIENTE] Reemplaza con tu número real en formato 521 + 10 dígitos. Ej: 5212281234567
  whatsapp: "[PENDIENTE - Ej: 5212281234567]",
  // [PENDIENTE] Datos para transferencia
  banco: "[PENDIENTE - Ej: BBVA Bancomer - CLABE 012345678901234567 - Titular: Jonathan Díaz]",
  emailContacto: "[PENDIENTE - Ej: hola@cafedino rin.com]",
  envios: {
    xalapa: { id: "xalapa", nombre: "Xalapa, Veracruz", costo: 0 },
    martinez: { id: "martinez", nombre: "Martínez de la Torre, Veracruz", costo: 0 },
    veracruz: { id: "veracruz", nombre: "Veracruz, Veracruz", costo: 0 },
    otros: { id: "otros", nombre: "Otros estados de México (envío nacional)", costo: 0 }
  },
  productos: [
    {
      id: "cafe-500g",
      nombre: "Café DINORÍN Molido",
      presentacion: "500 gramos",
      precio: 150,
      stock: 50,
      activo: true,
      imagen: "images/cafe-500g.png",
      descripcion: "Molido medio, ideal para cafetera eléctrica, prensa francesa y moka."
    },
    {
      id: "cafe-1kg",
      nombre: "Café DINORÍN Molido",
      presentacion: "1 kilogramo (2 bolsas de 500 g)",
      precio: 300,
      stock: 30,
      activo: true,
      imagen: "images/cafe-1kg.png",
      descripcion: "2 bolsas de 500 g para conservar aroma. Rinde aprox. 60 tazas."
    }
  ]
};

// ========== STORAGE HELPERS ==========
const LS_KEYS = {
  inventory: "dinorin_inventory_v1",
  envios: "dinorin_envios_v1",
  contacto: "dinorin_contacto_v1",
  carrito: "dinorin_carrito_v1",
  pedidos: "dinorin_pedidos_v1"
};

function loadConfig() {
  // Inventario
  let inventory;
  try { inventory = JSON.parse(localStorage.getItem(LS_KEYS.inventory)); } catch(e){}
  if (!inventory || !Array.isArray(inventory)) {
    inventory = CONFIG_DEFAULT.productos;
  }

  // Envíos
  let envios;
  try { envios = JSON.parse(localStorage.getItem(LS_KEYS.envios)); } catch(e){}
  if (!envios) envios = CONFIG_DEFAULT.envios;

  // Contacto
  let contacto;
  try { contacto = JSON.parse(localStorage.getItem(LS_KEYS.contacto)); } catch(e){}
  if (!contacto) contacto = { whatsapp: CONFIG_DEFAULT.whatsapp, banco: CONFIG_DEFAULT.banco, email: CONFIG_DEFAULT.emailContacto };

  // Merge precios y stock sobre defaults si faltan
  const mergedProducts = CONFIG_DEFAULT.productos.map(pDefault => {
    const stored = inventory.find(p => p.id === pDefault.id);
    if (!stored) return pDefault;
    return { ...pDefault, ...stored };
  });

  return {
    productos: mergedProducts,
    envios,
    contacto
  };
}

function saveInventory(productos) {
  localStorage.setItem(LS_KEYS.inventory, JSON.stringify(productos));
}
function saveEnvios(envios) {
  localStorage.setItem(LS_KEYS.envios, JSON.stringify(envios));
}
function saveContacto(contacto) {
  localStorage.setItem(LS_KEYS.contacto, JSON.stringify(contacto));
}

// ========== CARRITO ==========
function loadCart() {
  try { return JSON.parse(localStorage.getItem(LS_KEYS.carrito)) || []; } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(LS_KEYS.carrito, JSON.stringify(cart));
  updateCartBadge();
}

let CART = loadCart();
let STATE = loadConfig();
let selectedShippingId = localStorage.getItem("dinorin_shipping_selected") || "xalapa";
let currentOrder = null;
let deferredPrompt = null;

function getProductById(id) {
  return STATE.productos.find(p => p.id === id);
}

function updateCartBadge() {
  const count = CART.reduce((s,i)=>s+i.qty,0);
  const el = document.getElementById("cartCount");
  if (el) el.textContent = count;
}

// ========== RENDER PRODUCTOS ==========
function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const activos = STATE.productos.filter(p=>p.activo);

  if (activos.length === 0) {
    grid.innerHTML = `<p class="muted">No hay productos activos por el momento. Actívalos desde el panel de configuración.</p>`;
    return;
  }

  activos.forEach(p => {
    const inCart = CART.find(c=>c.id===p.id);
    const qtyInCart = inCart ? inCart.qty : 0;
    const disponible = p.stock - qtyInCart;
    const agotado = p.stock <= 0;
    
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-media">
        <img src="${p.imagen}" alt="${p.nombre} ${p.presentacion}" loading="lazy" onerror="this.src='images/cafe-500g.png'"/>
        <span class="product-badge">${agotado ? "AGOTADO" : "TUESTE SEMANAL"}</span>
      </div>
      <div class="product-body">
        <h3 class="product-title">${p.nombre}</h3>
        <div class="product-pres">${p.presentacion}</div>
        <p class="small muted">${p.descripcion}</p>
        <div class="product-price">$${p.precio} MXN</div>
        <div class="product-stock ${disponible <= 3 && disponible >0 ? 'low' : ''} ${agotado ? 'out' : ''}">
          ${agotado ? 'Sin existencias' : disponible <= 3 ? `¡Quedan ${disponible}!` : `Existencias: ${disponible} disponibles`}
        </div>
        <div class="product-actions">
          ${!agotado ? `
            ${qtyInCart === 0 ? 
              `<button class="btn btn-primary btn-full" onclick="addToCart('${p.id}')">Agregar al carrito</button>` :
              `<div class="qty-control" style="width:100%;justify-content:space-between">
                <button onclick="updateQty('${p.id}', -1)">−</button>
                <span><strong>${qtyInCart}</strong> en carrito</span>
                <button onclick="updateQty('${p.id}', 1)">+</button>
              </div>`
            }
          ` : `<button class="btn btn-ghost btn-full" disabled>Agotado</button>`}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ========== CART ACTIONS ==========
function addToCart(id, qty=1) {
  const prod = getProductById(id);
  if (!prod || !prod.activo || prod.stock <=0) return;
  const existing = CART.find(c=>c.id===id);
  const currentQty = existing ? existing.qty : 0;
  if (currentQty + qty > prod.stock) {
    alert(`Solo quedan ${prod.stock - currentQty} piezas disponibles de ${prod.presentacion}`);
    return;
  }
  if (existing) existing.qty += qty;
  else CART.push({ id, qty });
  saveCart(CART);
  renderProducts();
  renderCart();
  openCart();
}

function updateQty(id, delta) {
  const prod = getProductById(id);
  const item = CART.find(c=>c.id===id);
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <=0) {
    CART = CART.filter(c=>c.id!==id);
  } else {
    if (newQty > prod.stock) {
      alert(`Máximo disponible: ${prod.stock}`);
      return;
    }
    item.qty = newQty;
  }
  saveCart(CART);
  renderProducts();
  renderCart();
}

function removeFromCart(id) {
  CART = CART.filter(c=>c.id!==id);
  saveCart(CART);
  renderProducts();
  renderCart();
}

function calcTotals() {
  const subtotal = CART.reduce((sum, item) => {
    const p = getProductById(item.id);
    return sum + (p ? p.precio * item.qty : 0);
  }, 0);
  const envioConfig = STATE.envios[selectedShippingId] || STATE.envios.otros;
  const shipping = envioConfig ? Number(envioConfig.costo) || 0 : 0;
  const total = subtotal + shipping;
  return { subtotal, shipping, total, envioConfig };
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const subEl = document.getElementById("cartSubtotal");
  const shipEl = document.getElementById("cartShipping");
  const totalEl = document.getElementById("cartTotal");
  const zoneSelect = document.getElementById("shippingZoneSelect");
  const checkoutBtn = document.getElementById("checkoutBtn");

  // Zones select
  if (zoneSelect) {
    const currentVal = zoneSelect.value || selectedShippingId;
    zoneSelect.innerHTML = Object.values(STATE.envios).map(z => 
      `<option value="${z.id}">${z.nombre} ${z.costo>0 ? `- $${z.costo} MXN` : '- Costo por definir'}</option>`
    ).join("");
    zoneSelect.value = currentVal;
    selectedShippingId = currentVal;
    localStorage.setItem("dinorin_shipping_selected", selectedShippingId);
    zoneSelect.onchange = (e)=>{
      selectedShippingId = e.target.value;
      localStorage.setItem("dinorin_shipping_selected", selectedShippingId);
      renderCart();
      renderZones();
    };
  }

  const { subtotal, shipping, total } = calcTotals();

  if (subEl) subEl.textContent = `$${subtotal} MXN`;
  if (shipEl) shipEl.textContent = shipping===0 ? (STATE.envios[selectedShippingId]?.costo===0 ? "$0 / por definir" : `$${shipping} MXN`) : `$${shipping} MXN`;
  if (totalEl) totalEl.textContent = `$${total} MXN`;

  if (!container) return;
  if (CART.length===0) {
    container.innerHTML = `<p class="muted center" style="padding:20px">Tu carrito está vacío.<br/>Agrega tu café favorito.</p>`;
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }
  if (checkoutBtn) checkoutBtn.disabled = false;

  container.innerHTML = CART.map(item=>{
    const p = getProductById(item.id);
    if (!p) return "";
    return `
      <div class="cart-item">
        <img src="${p.imagen}" alt="${p.presentacion}" />
        <div>
          <h4>${p.nombre}</h4>
          <div class="small muted">${p.presentacion} · $${p.precio}</div>
          <div class="qty-control" style="margin-top:6px; width:fit-content">
            <button onclick="updateQty('${p.id}', -1)">−</button>
            <span style="padding:0 8px">${item.qty}</span>
            <button onclick="updateQty('${p.id}', 1)">+</button>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">$${p.precio * item.qty}</div>
          <button class="small muted" style="border:none;background:none;cursor:pointer;text-decoration:underline" onclick="removeFromCart('${p.id}')">Eliminar</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderZones() {
  const grid = document.getElementById("zonesGrid");
  if (!grid) return;
  grid.innerHTML = Object.values(STATE.envios).map(z=>{
    const isSelected = z.id===selectedShippingId;
    return `<div class="zone-card" style="${isSelected ? 'border-color:var(--bosque); background:var(--beige)' : ''}">
      <div><strong>${z.nombre}</strong><div class="small muted">${z.costo===0 ? 'Costo por definir / $0' : `$${z.costo} MXN`}</div></div>
      <span style="font-weight:700; color:var(--bosque)">${isSelected ? '✓ Seleccionado' : ''}</span>
    </div>`;
  }).join("");
}

// ========== CHECKOUT ==========
function openCart() {
  document.getElementById("cartDrawer")?.classList.add("open");
  document.getElementById("cartOverlay")?.classList.remove("hidden");
}
function closeCart() {
  document.getElementById("cartDrawer")?.classList.remove("open");
  document.getElementById("cartOverlay")?.classList.add("hidden");
}
function openCheckout() {
  if (CART.length===0) return;
  closeCart();
  renderCheckoutMini();
  document.getElementById("checkoutModal")?.classList.remove("hidden");
  document.getElementById("checkoutOverlay")?.classList.remove("hidden");
  // preselect ciudad from shipping
  const ciudadSel = document.getElementById("ciudadSelect");
  if (ciudadSel) ciudadSel.value = selectedShippingId;
}
function closeCheckout() {
  document.getElementById("checkoutModal")?.classList.add("hidden");
  document.getElementById("checkoutOverlay")?.classList.add("hidden");
}

function renderCheckoutMini() {
  const mini = document.getElementById("checkoutMiniCart");
  const totalEl = document.getElementById("checkoutTotal");
  if (!mini) return;
  const { subtotal, shipping, total, envioConfig } = calcTotals();
  mini.innerHTML = CART.map(item=>{
    const p = getProductById(item.id);
    return `<div class="summary-row"><span>${p.presentacion} x${item.qty}</span><span>$${p.precio * item.qty}</span></div>`;
  }).join("") + `
    <div class="summary-row"><span>Subtotal</span><span>$${subtotal}</span></div>
    <div class="summary-row"><span>Envío (${envioConfig.nombre})</span><span>$${shipping}</span></div>
  `;
  if (totalEl) totalEl.textContent = `$${total} MXN`;
}

// Form submit
function handleCheckoutSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  
  // Validación extra
  if (!data.nombre || data.nombre.trim().length < 3) { alert("Nombre muy corto"); return; }
  if (!data.telefono || data.telefono.length < 10) { alert("Teléfono inválido"); return; }

  const { subtotal, shipping, total, envioConfig } = calcTotals();
  
  // Determinar zona final según ciudad elegida
  const zonaFinal = STATE.envios[data.ciudad] || envioConfig;
  selectedShippingId = zonaFinal.id;
  localStorage.setItem("dinorin_shipping_selected", selectedShippingId);

  const order = {
    id: "DIN-" + Date.now().toString().slice(-6),
    fecha: new Date().toLocaleString("es-MX"),
    cliente: data,
    productos: CART.map(item=>{
      const p = getProductById(item.id);
      return { id: p.id, nombre: p.nombre, presentacion: p.presentacion, precio: p.precio, qty: item.qty, subtotal: p.precio * item.qty }
    }),
    subtotal,
    envio: { zona: zonaFinal.nombre, costo: zonaFinal.costo, id: zonaFinal.id },
    total: subtotal + Number(zonaFinal.costo||0),
    estado: "pendiente"
  };

  // Actualizar inventario
  order.productos.forEach(op=>{
    const prod = STATE.productos.find(p=>p.id===op.id);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - op.qty);
    }
  });
  saveInventory(STATE.productos);

  // Guardar pedido en histórico local
  let pedidos = [];
  try { pedidos = JSON.parse(localStorage.getItem(LS_KEYS.pedidos)) || []; } catch {}
  pedidos.unshift(order);
  localStorage.setItem(LS_KEYS.pedidos, JSON.stringify(pedidos));

  currentOrder = order;

  // Limpiar carrito
  CART = [];
  saveCart(CART);
  renderProducts();
  renderCart();
  renderZones();

  closeCheckout();
  showOrderConfirmation(order);
}

function showOrderConfirmation(order) {
  const summaryEl = document.getElementById("orderSummary");
  if (!summaryEl) return;

  const textoResumen = `
PEDIDO ${order.id}
Fecha: ${order.fecha}

CLIENTE
Nombre: ${order.cliente.nombre}
Tel: ${order.cliente.telefono}
Estado: ${order.cliente.estado}
Ciudad: ${STATE.envios[order.cliente.ciudad]?.nombre || order.cliente.ciudad}
Dirección: ${order.cliente.direccion}
Referencias: ${order.cliente.referencias || "—"}
Método pago: ${order.cliente.metodoPago}
Comentarios: ${order.cliente.comentarios || "—"}

PRODUCTOS
${order.productos.map(p=>`- ${p.presentacion} x${p.qty} = $${p.subtotal} MXN`).join("\n")}
Subtotal: $${order.subtotal} MXN
Envío (${order.envio.zona}): $${order.envio.costo} MXN
TOTAL: $${order.total} MXN

Origen: ${CONFIG_DEFAULT.marca.origen}
`.trim();

  summaryEl.textContent = textoResumen;

  document.getElementById("orderModal")?.classList.remove("hidden");
  document.getElementById("orderOverlay")?.classList.remove("hidden");
}

function closeOrder() {
  document.getElementById("orderModal")?.classList.add("hidden");
  document.getElementById("orderOverlay")?.classList.add("hidden");
}

function buildWhatsAppText(order) {
  if (!order) order = currentOrder;
  if (!order) return "";
  const resumen = `Hola CAFÉ DINORÍN! Quiero hacer este pedido:%0A%0A` +
  `*PEDIDO ${order.id}*%0A` +
  `*Cliente:* ${order.cliente.nombre}%0A` +
  `*Tel:* ${order.cliente.telefono}%0A` +
  `*Dirección:* ${order.cliente.direccion}, ${STATE.envios[order.cliente.ciudad]?.nombre || order.cliente.ciudad}, ${order.cliente.estado}%0A` +
  `*Referencias:* ${encodeURIComponent(order.cliente.referencias || "—")}%0A` +
  `*Pago:* ${encodeURIComponent(order.cliente.metodoPago)}%0A%0A` +
  `*Productos:*%0A` +
  order.productos.map(p=>`- ${encodeURIComponent(p.presentacion)} x${p.qty} = $${p.subtotal}`).join("%0A") + `%0A%0A` +
  `*Subtotal:* $${order.subtotal} MXN%0A` +
  `*Envío (${encodeURIComponent(order.envio.zona)}):* $${order.envio.costo} MXN%0A` +
  `*TOTAL: $${order.total} MXN*%0A%0A` +
  `Comentarios: ${encodeURIComponent(order.cliente.comentarios || "—")}`;

  return resumen;
}

function sendWhatsApp() {
  const contacto = STATE.contacto;
  let numero = contacto.whatsapp;
  // Limpiar
  numero = numero.replace(/[^0-9]/g, "");
  if (numero.includes("PENDIENTE") || numero.length < 10) {
    alert("⚠️ Aún no has configurado tu número de WhatsApp. Ve al panel de configuración (?admin=1) y pon tu número en formato 521XXXXXXXXXX. Por ahora copié el resumen al portapapeles.");
    copyOrder();
    return;
  }
  const text = buildWhatsAppText();
  const url = `https://wa.me/${numero}?text=${text}`;
  window.open(url, "_blank");
}

function copyOrder() {
  const summaryEl = document.getElementById("orderSummary");
  if (!summaryEl) return;
  navigator.clipboard.writeText(summaryEl.textContent).then(()=>{
    alert("Resumen copiado al portapapeles");
  });
}

// ========== ADMIN PANEL ==========
function renderAdmin() {
  // Contacto
  document.getElementById("adminWhatsapp").value = STATE.contacto.whatsapp.includes("PENDIENTE") ? "" : STATE.contacto.whatsapp;
  document.getElementById("adminBanco").value = STATE.contacto.banco.includes("PENDIENTE") ? "" : STATE.contacto.banco;

  // Envíos
  const shipContainer = document.getElementById("adminShippingInputs");
  if (shipContainer) {
    shipContainer.innerHTML = Object.values(STATE.envios).map(z=>`
      <label>${z.nombre}<input type="number" min="0" step="1" data-ship-id="${z.id}" value="${z.costo}" /></label>
    `).join("");
  }

  // Inventario
  const invContainer = document.getElementById("adminInventory");
  if (invContainer) {
    invContainer.innerHTML = STATE.productos.map(p=>`
      <div style="border:1px solid var(--borde); border-radius:12px; padding:12px; background:var(--blanco)">
        <strong>${p.presentacion}</strong> (${p.id})
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:10px">
          <label>Precio MXN<input type="number" data-inv-id="${p.id}" data-field="precio" value="${p.precio}" /></label>
          <label>Stock<input type="number" data-inv-id="${p.id}" data-field="stock" value="${p.stock}" /></label>
          <label>Activo
            <select data-inv-id="${p.id}" data-field="activo">
              <option value="true" ${p.activo ? "selected" : ""}>Sí</option>
              <option value="false" ${!p.activo ? "selected" : ""}>No</option>
            </select>
          </label>
        </div>
      </div>
    `).join("");
  }
}

function saveContactConfig() {
  const wa = document.getElementById("adminWhatsapp").value.trim();
  const banco = document.getElementById("adminBanco").value.trim();
  if (wa) STATE.contacto.whatsapp = wa;
  if (banco) STATE.contacto.banco = banco;
  saveContacto(STATE.contacto);
  updateFooterContact();
  alert("Contacto guardado");
}

function saveShippingConfig() {
  const inputs = document.querySelectorAll("[data-ship-id]");
  inputs.forEach(inp=>{
    const id = inp.dataset.shipId;
    const val = Number(inp.value) || 0;
    if (STATE.envios[id]) STATE.envios[id].costo = val;
  });
  saveEnvios(STATE.envios);
  renderCart();
  renderZones();
  alert("Costos de envío guardados");
}

function saveInventoryConfig() {
  const inputs = document.querySelectorAll("[data-inv-id]");
  const temp = {};
  inputs.forEach(inp=>{
    const id = inp.dataset.invId;
    const field = inp.dataset.field;
    if (!temp[id]) temp[id] = {};
    let val = inp.value;
    if (field === "precio" || field === "stock") val = Number(val);
    if (field === "activo") val = val === "true";
    temp[id][field] = val;
  });
  STATE.productos = STATE.productos.map(p=>{
    if (temp[p.id]) return { ...p, ...temp[p.id] };
    return p;
  });
  saveInventory(STATE.productos);
  renderProducts();
  renderCart();
  alert("Inventario guardado");
}

function resetInventory() {
  if (!confirm("¿Restablecer inventario por defecto? Se perderán cambios locales.")) return;
  localStorage.removeItem(LS_KEYS.inventory);
  STATE = loadConfig();
  renderAdmin();
  renderProducts();
  renderCart();
  renderZones();
}

function updateFooterContact() {
  const waEl = document.getElementById("footerWhatsapp");
  const bancoEl = document.getElementById("footerBanco");
  if (waEl) waEl.textContent = STATE.contacto.whatsapp;
  if (bancoEl) bancoEl.textContent = STATE.contacto.banco;
}

// ========== PWA ==========
function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("./service-worker.js")
        .then(reg=>console.log("SW registrado", reg.scope))
        .catch(err=>console.log("SW error", err));
    });
  }
}

// Install prompt
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById("installBtn");
  if (btn) btn.classList.remove("hidden");
});

function handleInstall() {
  if (!deferredPrompt) {
    alert("En Android, abre el menú del navegador (⋮) y elige 'Instalar aplicación' o 'Agregar a pantalla de inicio'. En iPhone, usa Compartir → Agregar a inicio.");
    return;
  }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(choice=>{
    if (choice.outcome === "accepted") {
      console.log("PWA instalada");
    }
    deferredPrompt = null;
    document.getElementById("installBtn")?.classList.add("hidden");
  });
}

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", ()=>{
  STATE = loadConfig();
  CART = loadCart();

  renderProducts();
  renderCart();
  renderZones();
  updateCartBadge();
  updateFooterContact();
  renderAdmin();
  registerSW();

  // Listeners
  document.getElementById("cartBtn")?.addEventListener("click", openCart);
  document.getElementById("closeCart")?.addEventListener("click", closeCart);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);
  document.getElementById("continueBtn")?.addEventListener("click", closeCart);
  document.getElementById("checkoutBtn")?.addEventListener("click", openCheckout);
  document.getElementById("closeCheckout")?.addEventListener("click", closeCheckout);
  document.getElementById("checkoutOverlay")?.addEventListener("click", closeCheckout);
  document.getElementById("checkoutForm")?.addEventListener("submit", handleCheckoutSubmit);
  document.getElementById("orderOverlay")?.addEventListener("click", closeOrder);
  document.getElementById("sendWhatsappBtn")?.addEventListener("click", sendWhatsApp);
  document.getElementById("copyOrderBtn")?.addEventListener("click", copyOrder);
  document.getElementById("newOrderBtn")?.addEventListener("click", ()=>{ closeOrder(); openCart(); });
  document.getElementById("installBtn")?.addEventListener("click", handleInstall);

  // Logo 5 clicks -> admin
  let logoClicks = 0;
  let logoTimer = null;
  document.getElementById("brandLogoTrigger")?.addEventListener("click", ()=>{
    logoClicks++;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(()=>logoClicks=0, 2000);
    if (logoClicks>=5) {
      logoClicks=0;
      document.getElementById("adminPanel")?.classList.remove("hidden");
    }
  });

  // ?admin=1
  const params = new URLSearchParams(window.location.search);
  if (params.get("admin")==="1") {
    document.getElementById("adminPanel")?.classList.remove("hidden");
  }
  document.getElementById("closeAdmin")?.addEventListener("click", ()=>{
    document.getElementById("adminPanel")?.classList.add("hidden");
  });

  // Sincronizar ciudad select con shipping
  document.getElementById("ciudadSelect")?.addEventListener("change", (e)=>{
    selectedShippingId = e.target.value || selectedShippingId;
    localStorage.setItem("dinorin_shipping_selected", selectedShippingId);
    renderCart();
    renderZones();
    renderCheckoutMini();
  });

  // Validar que el logo exista, si no mostrar placeholder
  const logoImg = document.getElementById("logoImg");
  if (logoImg) {
    logoImg.addEventListener("error", ()=>{
      logoImg.style.background = "var(--beige)";
      logoImg.alt = "Logo pendiente - coloca tu archivo en images/logo.png";
    });
  }
});

// Exponer funciones globales para onclick inline (productos)
window.addToCart = addToCart;
window.updateQty = updateQty;
window.removeFromCart = removeFromCart;
window.saveContactConfig = saveContactConfig;
window.saveShippingConfig = saveShippingConfig;
window.saveInventoryConfig = saveInventoryConfig;
window.resetInventory = resetInventory;

// ========== EMAIL FUTURO (estructura preparada) ==========
function buildEmailBody(order) {
  // Esta función queda lista para conectar con EmailJS, FormSubmit, o backend propio
  // Por ahora solo retorna texto plano
  const summaryEl = document.getElementById("orderSummary");
  return summaryEl ? summaryEl.textContent : "Pedido CAFÉ DINORÍN";
}
// Cuando quieras agregar email, conecta aquí tu servicio (ej: emailjs.send(...))
