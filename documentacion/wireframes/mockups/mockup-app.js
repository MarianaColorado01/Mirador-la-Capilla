/* Bar POS · Mirador La Capilla — motor de mockups (prototipo y láminas)
   Estado en memoria, sin servidor: simula las reglas del documento de requerimientos. */
(function (global) {
'use strict';

/* ---------------- iconos ---------------- */
const P = {
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>', back:'<path d="M19 12H5M11 6l-6 6 6 6"/>', close:'<path d="M6 6l12 12M18 6L6 18"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>', check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkc:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', alert:'<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>', x:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  wifi:'<path d="M2.5 9a14 14 0 0119 0M5.5 12.5a9.5 9.5 0 0113 0M8.5 16a5 5 0 017 0"/><circle cx="12" cy="19" r=".8"/>',
  wifioff:'<path d="M3 3l18 18M8.5 16a5 5 0 017 0M5.5 12.5a9.5 9.5 0 014.6-2.5M14.5 10.2a9.5 9.5 0 014 2.3M2.5 9a14 14 0 014.3-2.8M11 5.1A14 14 0 0121.5 9"/>',
  grid:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  glass:'<path d="M7 3h10l-1 8a4 4 0 01-8 0z"/><path d="M12 15v6M8.5 21h7"/>', cash:'<rect x="3" y="6" width="18" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.6"/>',
  box:'<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>', chart:'<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  pin:'<path d="M12 21s7-6.1 7-11.5a7 7 0 10-14 0C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M21.5 20a6.5 6.5 0 00-4-6"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>', bell:'<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 004 0"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>', more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  chev:'<path d="M9 6l6 6-6 6"/>', logout:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', note:'<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4"/>',
  play:'<path d="M7 5l12 7-12 7z"/>', share:'<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
  file:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>', backspace:'<path d="M8 5h12v14H8l-5-7z"/><path d="M11.5 9.5l5 5M16.5 9.5l-5 5"/>',
  lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>',
  gps:'<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>',
};
const ic = (n, c = 'i') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
const $ = n => (n < 0 ? '−' : '') + '$' + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fig = (s, cls = 'md') => `<span class="flap ${cls}"><i class="c">${s}</i></span>`;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------- ilustraciones de producto (SVG propio) ---------------- */
function art(kind, a, b) {
  const g = { beer: `<path d="M26 8h8v10c4 3 6 7 6 12v26a4 4 0 01-4 4H24a4 4 0 01-4-4V30c0-5 2-9 6-12z" fill="${a}"/><rect x="26" y="5" width="8" height="5" rx="1" fill="#E7E7E7"/><rect x="21" y="34" width="18" height="13" rx="2" fill="${b}"/><path d="M24 22c2-2 4-3 6-3" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>`,
    liquor: `<path d="M25 6h10v10l5 5v35a4 4 0 01-4 4H24a4 4 0 01-4-4V21l5-5z" fill="#DCE3E8"/><rect x="25" y="3" width="10" height="5" rx="1" fill="${b}"/><rect x="21" y="30" width="18" height="18" rx="2" fill="${b}"/><circle cx="30" cy="39" r="4" fill="#fff" fill-opacity=".85"/>`,
    rum: `<path d="M26 6h8v9c5 2 7 6 7 10v31a4 4 0 01-4 4H23a4 4 0 01-4-4V25c0-4 2-8 7-10z" fill="${a}"/><rect x="26" y="3" width="8" height="5" rx="1" fill="${b}"/><rect x="21" y="31" width="18" height="15" rx="2" fill="${b}"/>`,
    coffee: `<path d="M14 26h28v14a12 12 0 01-12 12h-4a12 12 0 01-12-12z" fill="${a}"/><path d="M42 30h4a5 5 0 010 10h-4" stroke="${a}" stroke-width="3" fill="none"/><ellipse cx="28" cy="26" rx="14" ry="3" fill="${b}"/><path d="M24 12c-2 3 2 5 0 8M31 10c-2 3 2 5 0 8" stroke="${a}" stroke-opacity=".5" stroke-width="2" fill="none"/>`,
    cocktail: `<path d="M14 14h32L30 34z" fill="${a}"/><path d="M30 34v16M22 52h16" stroke="#C9CED6" stroke-width="3"/><circle cx="40" cy="14" r="6" fill="${b}"/><path d="M36 6l8 16" stroke="#7A5A2E" stroke-width="2"/>`,
    food: `<ellipse cx="30" cy="40" rx="22" ry="8" fill="#E9ECEF"/><circle cx="24" cy="35" r="10" fill="${a}"/><path d="M30 34c4-6 12-6 16 0-4 5-12 5-16 0z" fill="${b}"/>`,
    water: `<path d="M25 6h10v8c3 2 5 5 5 9v33a4 4 0 01-4 4H24a4 4 0 01-4-4V23c0-4 2-7 5-9z" fill="${a}"/><rect x="25" y="3" width="10" height="5" rx="1" fill="${b}"/><rect x="21" y="30" width="18" height="12" fill="${b}"/>` }[kind];
  return `<svg viewBox="0 0 60 60" width="100%" height="100%" aria-hidden="true">${g}</svg>`;
}

/* ---------------- datos semilla ---------------- */
const USERS = [
  { id: 'ana', name: 'Ana', role: 'mesero', label: 'Mesero' },
  { id: 'luis', name: 'Luis', role: 'mesero', label: 'Mesero' },
  { id: 'op', name: 'Operador', role: 'todo', label: 'Todo en uno · L–S' },
  { id: 'prep', name: 'Preparador', role: 'barra', label: 'Barra' },
  { id: 'caj', name: 'Cajero', role: 'caja', label: 'Caja' },
  { id: 'due', name: 'Dueño', role: 'dueno', label: 'Dueño' },
];
const CATS = ['Todas', 'Café', 'Cervezas', 'Licores', 'Cócteles', 'Comidas', 'Sin alcohol'];
function seed() {
  const now = Date.now(), m = 60000;
  const products = [
    { id: 1, name: 'Águila 330 ml', cat: 'Cervezas', price: 4000, cost: 2500, stock: 48, min: 12, art: ['beer', '#C99A2E', '#F2C200'] },
    { id: 2, name: 'Club Colombia', cat: 'Cervezas', price: 5000, cost: 3000, stock: 30, min: 10, art: ['beer', '#9C6A1C', '#B5121B'] },
    { id: 3, name: 'Aguardiente 1/2', cat: 'Licores', price: 45000, cost: 30000, stock: 2, min: 5, art: ['liquor', '', '#C0282E'] },
    { id: 4, name: 'Ron botella', cat: 'Licores', price: 55000, cost: 38000, stock: 1, min: 3, art: ['rum', '#5A2A12', '#E2B65A'] },
    { id: 5, name: 'Tinto', cat: 'Café', price: 2500, cost: 600, stock: 120, min: 20, art: ['coffee', '#F2F2F2', '#4A2D1B'] },
    { id: 6, name: 'Café de origen', cat: 'Café', price: 6000, cost: 1800, stock: 40, min: 10, art: ['coffee', '#E8C9A0', '#3B2416'] },
    { id: 7, name: 'Michelada', cat: 'Cócteles', price: 8000, cost: 3500, stock: 20, min: 5, art: ['cocktail', '#E9474E', '#F2C200'] },
    { id: 8, name: 'Mojito', cat: 'Cócteles', price: 12000, cost: 5000, stock: 0, min: 5, art: ['cocktail', '#9BD57A', '#F2F2F2'] },
    { id: 9, name: 'Arepa con chorizo', cat: 'Comidas', price: 12000, cost: 5500, stock: 18, min: 6, art: ['food', '#F2D27A', '#A8322A'] },
    { id: 10, name: 'Agua 600 ml', cat: 'Sin alcohol', price: 3000, cost: 1200, stock: 24, min: 6, art: ['water', '#BFE0F5', '#2F7BF6'] },
  ];
  const it = (pid, q, note = '') => ({ pid, q, price: products.find(p => p.id === pid).price, cost: products.find(p => p.id === pid).cost, note, void: null });
  return {
    now0: now,
    user: null, conn: 'ok', theme: 'dark',
    config: { tax: 8, tip: 10, single: true, business: 'Mirador La Capilla' },
    products,
    tables: [1, 2, 3, 4, 5, 6, 7, 8],
    accounts: [
      { id: 'a1', table: 2, waiter: 'Ana', status: 'abierta', opened: now - 34 * m, rounds: [{ id: 'r1', n: 1, by: 'Ana', at: now - 26 * m, status: 'entregado', items: [it(1, 2), it(3, 1, 'sin hielo')] }] },
      { id: 'a2', table: 3, waiter: 'Luis', status: 'por_cobrar', opened: now - 55 * m, rounds: [{ id: 'r2', n: 1, by: 'Luis', at: now - 40 * m, status: 'entregado', items: [it(2, 2)] }] },
      { id: 'a3', table: 4, waiter: 'Luis', status: 'abierta', opened: now - 12 * m, rounds: [{ id: 'r3', n: 1, by: 'Luis', at: now - 7 * m, status: 'tomado', items: [it(7, 1, 'poco picante'), it(9, 1)] }] },
      { id: 'a4', table: 7, waiter: 'Ana', status: 'abierta', opened: now - 6 * m, rounds: [{ id: 'r4', n: 1, by: 'Ana', at: now - 3 * m, status: 'preparacion', items: [it(6, 2)] }] },
    ],
    invoices: [
      { id: 126, at: now - 80 * m, table: 5, waiter: 'Luis', method: 'Efectivo', subtotal: 12000, desc: 0, tip: 0, tax: 0, total: 12000, cost: 5500, status: 'pagada', items: [it(9, 1)] },
      { id: 127, at: now - 64 * m, table: 4, waiter: 'Luis', method: 'Transferencia', subtotal: 20000, desc: 0, tip: 0, tax: 0, total: 20000, cost: 12000, status: 'anulada', items: [it(1, 5)] },
      { id: 128, at: now - 45 * m, table: 1, waiter: 'Ana', method: 'Tarjeta', subtotal: 53000, desc: 0, tip: 5300, tax: 0, total: 58300, cost: 35000, status: 'pagada', items: [it(1, 2), it(3, 1)] },
    ],
    nextInv: 129, seq: 10,
    drafts: {}, notifs: [], toast: null,
    stack: [{ s: 'login', p: { sel: 'ana', pin: '' } }],
    ui: {},
    base: { sales: 1250000, cost: 620000, gastos: 40000, surtido: 288000 },
  };
}

/* ---------------- cálculos (sección 4.3) ---------------- */
const live = a => a.rounds.flatMap(r => r.items.filter(i => !i.void));
const subtotalOf = a => live(a).reduce((s, i) => s + i.q * i.price, 0);
function bill(sub, form, taxPct) {
  const errs = {};
  const num = v => (String(v).trim() === '' ? 0 : Number(String(v).replace(/\./g, '').replace(',', '.')));
  const d = num(form.desc), t = num(form.tip), r = num(form.recv);
  if (isNaN(d)) errs.desc = 'Escribe solo números.'; else if (d < 0) errs.desc = 'El descuento no puede ser negativo.'; else if (d > sub) errs.desc = `No puede superar el subtotal (${$(sub)}).`;
  if (isNaN(t)) errs.tip = 'Escribe solo números.'; else if (t < 0 || t > 100) errs.tip = 'Debe estar entre 0 % y 100 %.';
  const D = errs.desc ? 0 : d, T = errs.tip ? 0 : t;
  const base = sub - D, tipV = base * T / 100, taxV = base * taxPct / 100, total = Math.round(base + tipV + taxV);
  if (form.method === 'Efectivo') { if (isNaN(r)) errs.recv = 'Escribe solo números.'; else if (String(form.recv).trim() !== '' && r < total) errs.recv = `Faltan ${$(total - r)}: no cubre el total.`; }
  const change = form.method === 'Efectivo' && !isNaN(r) && r >= total ? r - total : null;
  const ready = !Object.keys(errs).length && (form.method !== 'Efectivo' || (String(form.recv).trim() !== '' && r >= total));
  return { D, T, base, tipV, taxV, total, change, errs, ready };
}

/* ---------------- app ---------------- */
function createApp(root, opts = {}) {
  const S = opts.state || seed();
  const interactive = opts.interactive !== false;
  let clockTimer = null;

  function helpers() {
    return {
      login: id => { S.user = USERS.find(u => u.id === id); S.stack = [{ s: home(), p: {} }]; },
      go: (s, p = {}) => S.stack.push({ s, p }),
      only: (s, p = {}) => { S.stack = [{ s, p }]; },
      acc: t => S.accounts.find(a => a.table === t && a.status !== 'pagada'),
      prod: id => S.products.find(p => p.id === id),
      USERS,
    };
  }
  const H = helpers();
  const top = () => S.stack[S.stack.length - 1];
  const role = () => (S.user ? S.user.role : null);
  const can = what => ({
    reopen: ['caja', 'dueno', 'todo'], charge: ['caja', 'dueno', 'todo'], voidItem: ['caja', 'dueno', 'todo'],
    order: ['mesero', 'todo', 'dueno'], bar: ['barra', 'todo', 'dueno'], inv: ['dueno'],
  }[what] || []).includes(role());
  function home() { const r = role(); return r === 'barra' ? 'barra' : r === 'caja' ? 'caja' : 'mesas'; }
  const TABS = { todo: [['mesas', 'Mesas', 'grid'], ['barra', 'Barra', 'glass'], ['caja', 'Caja', 'cash']], caja: [['mesas', 'Mesas', 'grid'], ['caja', 'Caja', 'cash']], dueno: [['mesas', 'Mesas', 'grid'], ['barra', 'Barra', 'glass'], ['caja', 'Caja', 'cash'], ['inventario', 'Inventario', 'box']] };
  const mins = t => Math.max(0, Math.floor((Date.now() - t) / 60000));
  const toast = (text, icon = 'checkc', act = null) => { S.toast = { text, icon, act, at: Date.now() }; };
  const tableState = t => { const a = H.acc(t); return !a ? 'g' : a.status === 'por_cobrar' ? 'r' : 'o'; };

  /* ------------ piezas de UI ------------ */
  const tag = (t, c = 'n') => `<span class="tag ${c}">${t}</span>`;
  const RST = { tomado: ['Tomada', 'k'], preparacion: ['Preparando', 'a'], listo: ['Lista', 'g'], entregado: ['Entregada', 'n'] };
  const btn = (t, c = 'p', i = '', act = '', dis = false, data = '') => `<button type="button" class="btn ${c}" ${dis ? 'aria-disabled="true"' : `data-a="${act}"`} ${data}>${i ? ic(i) : ''}${t}</button>`;
  const lamp = () => ({ ok: '<span class="lamp ok"><i></i>Conectado</span>', warn: '<span class="lamp warn"><i></i>Reconectando</span>', off: '<span class="lamp off"><i></i>Sin conexión</span>' }[S.conn]);
  const field = (label, key, val, { err = '', help = '', ph = '', ro = false, mode = 'numeric' } = {}) => `<div class="fld"><label class="lb" for="${key}">${label}</label>${ro ? `<div class="inp ro">${esc(val)}</div>` : `<input id="${key}" class="inp ${err ? 'err' : ''}" data-in="${key}" inputmode="${mode}" value="${esc(val)}" placeholder="${ph}" autocomplete="off">`}${err ? `<div class="help err">${ic('alert', 'i s')}<span>${err}</span></div>` : help ? `<div class="help">${help}</div>` : ''}</div>`;
  const thumb = p => `<div class="thumb mk">${art(...p.art)}</div>`;
  const itemRow = (i, opts = {}) => { const p = H.prod(i.pid); return `<div class="row ${i.void ? 'void' : ''}" style="align-items:flex-start"><span class="num" style="min-width:26px;font-weight:700">${i.q}×</span><div class="grow"><p class="nm">${p.name}</p>${i.note ? `<p class="t s">Nota: ${esc(i.note)}</p>` : ''}${i.void ? `<p class="t s" style="color:var(--red)">Anulado · ${i.void}</p>` : ''}</div>${opts.noPrice ? '' : `<span class="num ${i.void ? 'strike' : ''}">${$(i.q * i.price)}</span>`}${opts.voidAct && !i.void ? `<button type="button" class="ib sm" aria-label="Anular ${p.name}" data-a="askVoid" data-r="${opts.r}" data-i="${opts.idx}">${ic('more')}</button>` : ''}</div>`; };

  function phone(v) {
    const r = role(), tabs = r && TABS[r] && !v.noNav ? TABS[r] : null, depth = S.stack.length > 1;
    const left = v.left === ' ' ? '' : v.left || (depth ? 'back' : (S.user ? 'menu' : ''));
    const t = new Date(); const clock = opts.clock || (pad(t.getHours()) + ':' + pad(t.getMinutes()));
    return `<div class="ph app">
  <div class="sb"><span>${clock}</span><span>${ic('wifi')}<svg viewBox="0 0 24 24"><path d="M3 20h2v-3H3zM8 20h2v-6H8zM13 20h2v-9h-2zM18 20h2V8h-2z"/></svg><svg viewBox="0 0 24 24"><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4"/></svg></span></div>
  <div class="appbar">${left ? `<button class="ib" type="button" data-a="${left === 'back' ? 'back' : left === 'menu' ? 'drawer' : 'back'}" aria-label="${left === 'menu' ? 'Abrir menú' : 'Volver'}">${ic(left)}</button>` : '<span style="width:12px"></span>'}<h3>${v.title}</h3>${v.action || ''}</div>
  <div class="strip"><span>${S.user ? S.user.name + ' · ' + S.user.label : S.config.business}</span>${lamp()}</div>
  <div class="body" ${v.fab ? 'style="padding-bottom:92px"' : ''}>${S.conn === 'off' && S.user ? `<div class="ban r">${ic('wifioff')}<div><b>Sin conexión con el PC de caja</b><p>Las confirmaciones quedan deshabilitadas. Reintentando…</p></div></div>` : ''}${v.body}</div>
  ${v.foot ? `<div class="foot">${v.foot}</div>` : ''}
  ${tabs ? `<nav class="nav" aria-label="Pestañas">${tabs.map(([k, l, i]) => `<a href="#" data-a="tab" data-k="${k}" class="${S.stack[0].s === k ? 'on' : ''}"><span class="pill">${ic(i)}</span>${l}</a>`).join('')}</nav>` : ''}
  <div class="gest"></div>
  ${v.fab || ''}${toastHTML()}${overlayHTML()}
</div>`;
  }
  function toastHTML() {
    if (!S.toast) return '';
    return `<div class="snack" style="bottom:${(S.user && TABS[role()]) ? 96 : 26}px">${ic(S.toast.icon)}<span style="flex:1">${S.toast.text}</span>${S.toast.act ? `<button class="btn t" type="button" data-a="${S.toast.act.a}" ${S.toast.act.data || ''}>${S.toast.act.l}</button>` : `<button class="ib sm" type="button" data-a="untoast" aria-label="Cerrar">${ic('close')}</button>`}</div>`;
  }

  /* ------------ overlays ------------ */
  function overlayHTML() {
    const u = S.ui;
    if (u.drawer) {
      const r = role(); const items = [
        r === 'dueno' && ['resumen', 'Resumen del negocio', 'chart'],
        ['caja', 'dueno', 'todo'].includes(r) && ['facturas', 'Facturas', 'receipt'],
        r === 'dueno' && ['inventario', 'Inventario', 'box'],
        ['ubicacion', 'Ubicación', 'pin'],
      ].filter(Boolean);
      return `<div class="scrim" data-a="closeUi"></div><div class="drawer"><div class="dh"><p style="margin:0 0 6px;font:600 22px/1 Cinzel,serif;letter-spacing:.06em;color:var(--carve)">MIRADOR</p><p class="h" style="color:var(--shell-ink)">${S.user.name}</p><p style="margin:2px 0 0;color:var(--shell-ink2);font-size:13px">${S.user.label}</p></div>
      <div style="padding:8px 0;overflow:auto;flex:1">${items.map(([k, l, i]) => `<a href="#" class="dl" data-a="nav" data-k="${k}">${ic(i)}${l}</a>`).join('')}
      <div class="dsec lbl">Simulación</div><a href="#" class="dl" data-a="toggleConn">${ic(S.conn === 'off' ? 'wifi' : 'wifioff')}${S.conn === 'off' ? 'Reconectar' : 'Simular sin conexión'}</a>
      <a href="#" class="dl" data-a="logout" style="margin-top:6px">${ic('logout')}Cambiar de perfil</a></div></div>`;
    }
    if (u.open) {
      return `<div class="scrim" data-a="closeUi"></div><div class="dialog" role="dialog" aria-label="Abrir mesa">${fig(pad(u.open), 'lg g')}<p class="h">¿Abrir la mesa ${u.open}?</p><p class="t">Se crea una cuenta nueva a nombre de ${S.user.name}. Si alguien la abrió desde otro celular, te lo avisamos sin duplicarla.</p><div class="acts">${btn('Cancelar', 't', '', 'closeUi')}${btn('Abrir y tomar ronda', 't', '', 'openTable', S.conn === 'off')}</div></div>`;
    }
    if (u.remove != null) {
      const i = S.drafts[top().p.id].items[u.remove], p = H.prod(i.pid);
      return `<div class="scrim" data-a="closeUi"></div><div class="dialog" role="dialog" aria-label="Quitar ítem"><p class="h">¿Quitar ${p.name}?</p><p class="t">Al bajar de 1 el producto sale de esta ronda. Puedes volver a agregarlo desde el catálogo.</p><div class="acts">${btn('Mantener', 't', '', 'closeUi')}${btn('Quitar', 't', '', 'doRemove')}</div></div>`;
    }
    if (u.void) {
      const a = S.accounts.find(x => x.id === top().p.id), r = a.rounds.find(x => x.id === u.void.r), i = r.items[u.void.i], p = H.prod(i.pid);
      const reasons = ['Cliente cambió de opinión', 'Error al tomar el pedido', 'Producto en mal estado'];
      const delivered = r.status === 'entregado';
      const blocked = delivered && role() !== 'dueno';
      return `<div class="scrim" data-a="closeUi"></div><div class="sheet" role="dialog" aria-label="Anular ítem"><div class="grab"></div><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><p class="h">Anular ${i.q} × ${p.name}</p>${tag(RST[r.status][0], RST[r.status][1])}</div>
       ${blocked ? `<div class="ban a">${ic('lock')}<div><b>Solo el dueño puede anular</b><p>La ronda ya se entregó. Si se anula queda como merma, sin devolver stock.</p></div></div>` : `
       <div class="brd">${reasons.map((m, k) => `<div class="row" data-a="pickReason" data-k="${k}" style="cursor:pointer"><span class="radio ${u.void.reason === k ? 'on' : ''}"></span><span class="grow">${m}</span></div>`).join('')}</div>
       ${delivered ? `<p class="t s">Ronda entregada: no se devuelve stock, queda como merma.</p>` : `<div style="display:flex;gap:12px;align-items:center;cursor:pointer" data-a="toggleRestock"><div style="flex:1"><p style="margin:0;font-weight:500">Devolver al stock</p><p class="t s">Solo si no se alcanzó a preparar.</p></div><span class="sw ${u.void.restock ? 'on' : ''}" role="switch" aria-checked="${!!u.void.restock}"></span></div>`}
       <p class="t s">Quedará registrado: ${S.user.name} · ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })} · motivo.</p>
       ${btn('Anular ítem', 'd', 'x', 'doVoid', u.void.reason == null || S.conn === 'off')}`}</div>`;
    }
    return '';
  }

  /* ------------ pantallas ------------ */
  const V = {};
  V.login = p => {
    const u = USERS.find(x => x.id === p.sel);
    return { title: 'Ingresar', noNav: true, left: ' ', body: `
      <div class="hero-mk"><svg viewBox="0 0 360 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 90 L0 52 C 40 40 70 30 110 44 S 190 18 230 32 S 300 60 360 38 L360 90Z" fill="var(--steel)" opacity=".22"/><path d="M0 90 L0 70 C 60 56 110 66 170 58 S 270 50 360 64 L360 90Z" fill="var(--steel)" opacity=".38"/><circle cx="286" cy="24" r="10" fill="var(--trim)"/></svg><p class="wm">MIRADOR</p><p class="wm2">LA CAPILLA</p></div>
      <div class="brd">${USERS.map(x => `<div class="row ${x.id === p.sel ? 'sel' : ''}" data-a="pickUser" data-k="${x.id}" style="cursor:pointer"><span class="radio ${x.id === p.sel ? 'on' : ''}"></span><div class="grow"><p style="font-weight:500">${x.name}</p></div><span class="lbl">${x.label}</span></div>`).join('')}</div>
      <div><p class="lb t" style="text-align:center;margin-bottom:4px">PIN de ${u.name} <span class="t s">(demo: cualquier PIN de 4 dígitos)</span></p><div class="dots" aria-label="${p.pin.length} de 4 dígitos">${[0, 1, 2, 3].map(k => `<i class="${k < p.pin.length ? 'f' : ''}"></i>`).join('')}</div></div>
      <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-a="key" data-k="${n}">${n}</button>`).join('')}<span></span><button type="button" data-a="key" data-k="0">0</button><button type="button" data-a="key" data-k="del" aria-label="Borrar">${ic('backspace')}</button></div>`,
      foot: btn('Ingresar como ' + u.name, 'p', '', 'doLogin', p.pin.length < 4) };
  };
  V.mesas = p => {
    const f = p.f || 0;
    const list = S.tables.filter(t => f === 0 || (f === 1 && tableState(t) === 'g') || (f === 2 && tableState(t) === 'o') || (f === 3 && tableState(t) === 'r'));
    const cnt = k => S.tables.filter(t => tableState(t) === k).length;
    const mine = S.notifs.filter(n => S.user && n.to === S.user.name && !n.seen);
    const single = role() === 'todo';
    return { title: 'Mesas', fab: can('order') ? `<button type="button" class="fab" data-a="fabOpen" style="bottom:${TABS[role()] ? 110 : 40}px">${ic('plus')}Abrir mesa</button>` : '', body: `
      ${single ? `<div class="ban a">${ic('info')}<div><b>Modo un solo operador</b><p>Las rondas pasan directo a «entregada». Cobrar sigue siendo un paso aparte.</p></div></div>` : ''}
      ${mine.length ? `<div class="ban g" data-a="seeNotif" data-k="${mine[0].acc}" style="cursor:pointer">${ic('bell')}<div><b>${mine[0].text}</b><p>Toca para ir a la cuenta y marcarla entregada.</p></div></div>` : ''}
      <div class="chips">${[`Todas <span class="n">${S.tables.length}</span>`, `Libres <span class="n">${cnt('g')}</span>`, `Ocupadas <span class="n">${cnt('o')}</span>`, `Por cobrar <span class="n">${cnt('r')}</span>`].map((l, k) => `<button type="button" class="chip" aria-pressed="${k === f}" data-a="filter" data-k="${k}">${l}</button>`).join('')}</div>
      ${list.length ? `<div class="mesas">${list.map(t => {
        const a = H.acc(t), st = tableState(t), lab = { g: 'Libre', o: 'Ocupada', r: 'Por cobrar' }[st];
        const ready = a && a.rounds.some(r => r.status === 'listo');
        const meta = !a ? 'Disponible' : `${a.waiter} · ${$(subtotalOf(a))}<br>${a.status === 'por_cobrar' ? 'Pidió la cuenta' : mins(a.opened) + ' min abierta'}`;
        return `<button type="button" class="mesa" data-a="tapTable" data-k="${t}"><div class="top-m">${fig(pad(t), 'xl')}${ready ? tag('Lista', 'g') : ''}</div><div class="meta">${meta}</div><div class="band ${st}">${lab}</div></button>`;
      }).join('')}</div>` : `<div class="brd empty">${ic('grid')}<p class="h">No hay mesas en este filtro</p><button type="button" class="btn o" data-a="filter" data-k="0">Ver todas</button></div>`}` };
  };
  V.mesa = p => {
    const a = S.accounts.find(x => x.id === p.id);
    if (!a) return { title: 'Mesa', body: `<div class="brd empty">${fig('404', 'md r')}<p class="h">Mesa no encontrada</p><p class="t">La cuenta ya se pagó o no existe.</p>${btn('Volver a mesas', 'p', 'back', 'back')}</div>` };
    const sub = subtotalOf(a), pc = a.status === 'por_cobrar', paid = a.status === 'pagada';
    const rounds = [...a.rounds].reverse();
    let foot = '';
    if (paid) foot = btn('Volver a mesas', 'p', '', 'home');
    else if (pc) foot = can('charge') ? `<div class="btns">${btn('Reabrir', 'o', 'undo', 'reopen')}${btn('Cobrar', 'p', 'cash', 'goCobro')}</div>` : `<div class="ban n">${ic('info')}<div><b>Cuenta en caja</b><p>No admite rondas hasta que caja la reabra.</p></div></div>`;
    else foot = `${can('order') ? btn('Agregar ronda', 'p', 'plus', 'goRonda') : ''}${role() === 'todo' ? btn('Cobrar ahora', 'o', 'cash', 'askBillGo', S.conn === 'off' || !sub) : btn('Pedir la cuenta', 'o', 'receipt', 'askBill', S.conn === 'off' || !sub)}`;
    return { title: 'Mesa ' + pad(a.table), body: `
      <div class="brd"><div class="row"><div class="grow"><span class="lbl">Total acumulado</span><div style="margin-top:6px">${fig($(sub), 'lg')}</div></div>${tag(paid ? 'Pagada' : pc ? 'Por cobrar' : 'Ocupada', paid ? 'n' : pc ? 'r' : 'o')}</div></div>
      ${rounds.length ? rounds.map(r => `<div class="brd"><div class="brd-h"><span class="h sm">Ronda ${r.n} · ${new Date(r.at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })} · ${r.by}</span>${tag(...RST[r.status])}</div>
        ${r.items.map((i, k) => itemRow(i, { voidAct: can('voidItem') && !paid, r: r.id, idx: k })).join('')}
        ${r.status === 'listo' && can('order') ? `<div class="row">${btn('Marcar entregada', 'o', 'check', 'deliver', S.conn === 'off', `data-r="${r.id}"`)}</div>` : ''}</div>`).join('') : `<div class="brd empty">${ic('note')}<p class="h">Aún no hay rondas</p><p class="t">Agrega la primera ronda de esta mesa.</p></div>`}
      <p class="t s">Los ítems anulados no suman al total.</p>`, foot };
  };
  V.ronda = p => {
    const a = S.accounts.find(x => x.id === p.id), d = S.drafts[a.id] || (S.drafts[a.id] = { items: [], at: Date.now() });
    const cat = p.cat || 0, q = (p.q || '').trim().toLowerCase();
    const list = S.products.filter(x => (cat === 0 || x.cat === CATS[cat]) && (!q || x.name.toLowerCase().includes(q)));
    const total = d.items.reduce((s, i) => s + i.q * H.prod(i.pid).price, 0), units = d.items.reduce((s, i) => s + i.q, 0);
    const prev = subtotalOf(a);
    return { title: `Ronda ${a.rounds.length + 1} · Mesa ${pad(a.table)}`, body: `
      ${prev ? `<div class="brd"><div class="row">${ic('receipt')}<div class="grow"><p class="t">Ya en la cuenta: ${a.rounds.length} ${a.rounds.length === 1 ? 'ronda' : 'rondas'} · <b>${$(prev)}</b></p></div></div></div>` : ''}
      <div class="fld"><label class="lb" for="q">Buscar producto</label><div class="inp search">${ic('search')}<input id="q" data-in="q" value="${esc(p.q || '')}" placeholder="Buscar por nombre…" autocomplete="off"></div></div>
      <div class="chips scroll">${CATS.map((c, k) => `<button type="button" class="chip" aria-pressed="${k === cat}" data-a="cat" data-k="${k}">${c}</button>`).join('')}</div>
      <div class="brd" id="catalog">${list.length ? list.map(x => {
        const inD = d.items.find(i => i.pid === x.id), left = x.stock - (inD ? inD.q : 0);
        return `<div class="pc ${x.stock === 0 ? 'out' : ''}">${thumb(x)}<div style="flex:1;min-width:0"><p style="margin:0;font-weight:500">${x.name}</p><p class="t s" style="margin:2px 0 0">${$(x.price)} · ${x.stock === 0 ? '<b style="color:var(--red)">Agotado</b>' : x.stock <= x.min ? `<b style="color:var(--amber)">${x.stock} ${x.stock === 1 ? 'disponible' : 'disponibles'}</b>` : x.stock + ' disponibles'}</p></div>${x.stock === 0 ? '' : `<button type="button" class="add" data-a="addP" data-k="${x.id}" aria-label="Agregar ${x.name}" ${left <= 0 ? 'aria-disabled="true"' : ''}>${inD ? `<b class="num">${inD.q}</b>` : ic('plus')}</button>`}</div>`;
      }).join('') : `<div class="empty">${ic('search')}<p class="h">Nada coincide con «${esc(p.q || '')}»</p><p class="t">Prueba otra palabra o quita el filtro ${CATS[cat]}.</p><button type="button" class="btn o" data-a="clearQ">Quitar filtros</button></div>`}</div>
      <div class="brd"><div class="brd-h"><span class="h sm">Esta ronda · ${units} ${units === 1 ? 'unidad' : 'unidades'}</span>${d.items.length ? tag('Borrador guardado', 'n') : ''}</div>
       ${d.items.length ? d.items.map((i, k) => { const x = H.prod(i.pid); return `<div class="row" style="flex-wrap:wrap"><div class="grow"><p style="font-weight:500">${x.name}</p><p class="t s">${$(x.price)} c/u · subtotal <b class="num">${$(x.price * i.q)}</b>${i.q >= x.stock ? ` · máx. ${x.stock}` : ''}</p></div>
         <span class="counter" role="group" aria-label="Cantidad"><button type="button" data-a="dec" data-k="${k}" aria-label="Restar">${ic('minus')}</button><span class="v">${i.q}</span><button type="button" data-a="inc" data-k="${k}" aria-label="Sumar" ${i.q >= x.stock ? 'aria-disabled="true"' : ''}>${ic('plus')}</button></span>
         <div style="flex-basis:100%">${i.noteOpen || i.note ? `<div class="fld"><label class="lb" for="n${k}">Nota para barra</label><input id="n${k}" class="inp" data-in="note" data-k="${k}" maxlength="100" value="${esc(i.note || '')}" placeholder="Ej. sin hielo" autocomplete="off"><div class="help"><span></span><span>${(i.note || '').length}/100</span></div></div>` : `<button type="button" class="btn t sm" data-a="noteOpen" data-k="${k}" style="padding:0">${ic('note')}Agregar nota</button>`}</div></div>`; }).join('') : `<div class="empty" style="padding:18px"><p class="t">Toca <b>+</b> en un producto para agregarlo.</p></div>`}</div>`,
      foot: `<div class="kv tot" style="padding:0"><span class="k">Total ronda</span>${fig($(total), 'md')}</div>${btn(S.conn === 'off' ? 'Confirmar · sin conexión' : role() === 'todo' ? 'Confirmar · entregar' : 'Confirmar y enviar a barra', 'p', 'check', 'confirm', !d.items.length || S.conn === 'off')}` };
  };
  V.barra = p => {
    const tab = p.tab || 0, keys = ['tomado', 'preparacion', 'listo'];
    const all = S.accounts.flatMap(a => a.rounds.map(r => ({ a, r }))).filter(x => keys.includes(x.r.status));
    const list = all.filter(x => x.r.status === keys[tab]).sort((x, y) => x.r.at - y.r.at);
    const cnt = k => all.filter(x => x.r.status === k).length;
    return { title: 'Barra', body: `
      <div class="segc" role="group">${['Pendientes · ' + cnt('tomado'), 'Preparando · ' + cnt('preparacion'), 'Listas · ' + cnt('listo')].map((l, k) => `<button type="button" aria-pressed="${k === tab}" data-a="btab" data-k="${k}">${l}</button>`).join('')}</div>
      ${list.length ? list.map(({ a, r }) => { const m = mins(r.at), warn = m >= 12; return `<div class="brd"><div class="brd-h">${fig('M' + pad(a.table), 'md')}<span class="h sm" style="flex:1;margin-left:6px">${r.by} · Ronda ${r.n}</span>${tag(...RST[r.status])}</div>
        <div style="padding:10px 14px 0"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="lbl">Espera</span><span>${fig(pad(m), 'sm ' + (warn ? 'r' : ''))} <span class="lbl">min</span></span></div><div class="wait ${warn ? 'r' : m > 6 ? 'a' : ''}"><i style="width:${Math.min(m / 20 * 100, 100)}%"></i></div><div class="ticks"><span>0</span><span>10</span><span>20 min</span></div></div>
        ${r.items.map(i => itemRow(i, { noPrice: true })).join('')}
        <div class="row">${r.status === 'tomado' ? btn('Preparar', 'o', 'play', 'advance', S.conn === 'off', `data-r="${r.id}"`) : r.status === 'preparacion' ? btn('Marcar lista', 'p', 'check', 'advance', S.conn === 'off', `data-r="${r.id}"`) : `<p class="t s" style="margin:0">Esperando a que ${r.by} la entregue.</p>`}</div></div>`; }).join('') : `<div class="brd empty">${ic('glass')}<p class="h">Nada por aquí</p><p class="t">Las rondas nuevas aparecen solas, sin recargar.</p></div>`}` };
  };
  V.caja = () => {
    const list = S.accounts.filter(a => a.status === 'por_cobrar'), sum = list.reduce((s, a) => s + subtotalOf(a), 0);
    return { title: 'Caja', body: `
      <div class="brd"><div class="row"><div class="grow"><span class="lbl">Por cobrar · ${list.length} ${list.length === 1 ? 'mesa' : 'mesas'}</span><div style="margin-top:6px">${fig($(sum), 'lg')}</div></div></div></div>
      ${list.length ? `<div class="brd"><div class="brd-h"><span class="lbl">Mesa</span><span class="lbl">Subtotal</span></div>${list.map(a => `<div class="row" data-a="goCobroId" data-k="${a.id}" style="cursor:pointer">${fig(pad(a.table), 'md r')}<div class="grow"><p style="font-weight:500">${a.waiter}</p><p class="t s">${a.rounds.length} ${a.rounds.length === 1 ? 'ronda' : 'rondas'}${live(a).length !== a.rounds.flatMap(r => r.items).length ? ' · ítems anulados' : ''}</p></div><b class="num">${$(subtotalOf(a))}</b>${ic('chev', 'i s')}</div>`).join('')}</div>` : `<div class="brd empty">${ic('cash')}<p class="h">No hay cuentas por cobrar</p><p class="t">Cuando un mesero pida la cuenta, la mesa aparece aquí.</p></div>`}` };
  };
  V.cobro = p => {
    const a = S.accounts.find(x => x.id === p.id); const f = p.form || (p.form = { desc: '', tip: String(S.config.tip), method: 'Efectivo', recv: '' });
    const sub = subtotalOf(a), b = bill(sub, f, S.config.tax);
    return { title: 'Cobrar Mesa ' + pad(a.table), body: `
      <div class="brd"><div class="brd-h"><span class="h sm">${a.rounds.length} ${a.rounds.length === 1 ? 'ronda' : 'rondas'} · ${a.waiter}</span>${tag('Por cobrar', 'r')}</div>${a.rounds.flatMap(r => r.items).map(i => itemRow(i)).join('')}</div>
      <div class="two">${field('Descuento ($)', 'desc', f.desc, { err: b.errs.desc, ph: '0' })}${field('Propina (%)', 'tip', f.tip, { err: b.errs.tip, help: 'Sugerida: ' + S.config.tip + ' %' })}</div>
      ${field('Impuesto (%)', 'tax', String(S.config.tax), { ro: true, help: 'Lo define el dueño en Ajustes' })}
      <div class="brd" style="padding:4px 14px" id="calc">
        <div class="kv"><span class="k">Subtotal</span><span class="num">${$(sub)}</span></div>
        <div class="kv"><span class="k">Descuento</span><span class="num">${b.D ? '−' + $(b.D) : $(0)}</span></div>
        <div class="kv"><span class="k">Propina ${b.T} %</span><span class="num">${$(b.tipV)}</span></div>
        <div class="kv"><span class="k">Impuesto ${S.config.tax} %</span><span class="num">${$(b.taxV)}</span></div>
        <div class="kv tot"><span class="k">Total</span>${fig($(b.total), 'md')}</div></div>
      <p class="lbl" style="margin-bottom:-6px">Método de pago</p>
      <div class="segc" role="group">${['Efectivo', 'Tarjeta', 'Transferencia'].map(m => `<button type="button" aria-pressed="${f.method === m}" data-a="method" data-k="${m}">${m}</button>`).join('')}</div>
      ${f.method === 'Efectivo' ? `<div class="two">${field('Recibido', 'recv', f.recv, { err: b.errs.recv, ph: 'Ej. ' + (Math.ceil(b.total / 10000) * 10000).toLocaleString('es-CO') })}<div class="fld"><span class="lb">Cambio</span><div class="inp ro" style="font-weight:700">${b.change != null ? $(b.change) : '—'}</div></div></div>` : ''}`,
      foot: btn(`Cobrar ${$(b.total)} y facturar`, 'p', 'receipt', 'charge', !b.ready || S.conn === 'off') };
  };
  V.factura = p => {
    const inv = S.invoices.find(x => x.id === p.id);
    if (!inv) return { title: 'Factura', body: `<div class="brd empty">${fig('404', 'md r')}<p class="h">Factura no encontrada</p>${btn('Volver', 'p', 'back', 'back')}</div>` };
    return { title: 'Factura ' + pad(inv.id, 6), body: `
      ${p.fresh ? `<div class="ban g">${ic('checkc')}<div><b>Pago registrado · Mesa ${pad(inv.table)} liberada</b><p>La mesa vuelve a «libre» en todos los celulares.</p></div></div>` : ''}
      ${inv.status === 'anulada' ? `<div class="ban r">${ic('x')}<div><b>Factura anulada</b><p>Se generó el ajuste de stock con referencia a ${pad(inv.id, 6)}.</p></div></div>` : ''}
      <div class="brd"><div class="brd-h"><span class="lbl">Factura N.º</span>${fig(pad(inv.id, 6), 'md')}</div>
       <div style="padding:4px 14px"><div class="kv"><span class="k">Fecha</span><span class="num">${new Date(inv.at).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span></div><div class="kv"><span class="k">Mesa · Mesero</span><span>${pad(inv.table)} · ${inv.waiter}</span></div><div class="kv"><span class="k">Método</span><span>${inv.method}</span></div></div>
       ${inv.items.filter(i => !i.void).map(i => itemRow(i)).join('')}
       <div style="padding:4px 14px 8px"><div class="kv"><span class="k">Subtotal</span><span class="num">${$(inv.subtotal)}</span></div>${inv.desc ? `<div class="kv"><span class="k">Descuento</span><span class="num">−${$(inv.desc)}</span></div>` : ''}<div class="kv"><span class="k">Propina</span><span class="num">${$(inv.tip)}</span></div><div class="kv"><span class="k">Impuesto</span><span class="num">${$(inv.tax)}</span></div><div class="kv tot"><span class="k">Total</span>${fig($(inv.total), 'md')}</div>${inv.recv ? `<div class="kv"><span class="k">Recibido · cambio</span><span class="num">${$(inv.recv)} · ${$(inv.recv - inv.total)}</span></div>` : ''}</div></div>
      <div class="btns">${btn('PDF', 'o', 'file', 'fakePdf')}${btn('Compartir', 'o', 'share', 'fakePdf')}</div>`,
      foot: p.fresh ? btn('Volver a ' + (role() === 'caja' ? 'cuentas' : 'mesas'), 'p', '', 'home') : '' };
  };
  V.facturas = () => ({ title: 'Facturas', body: `<div class="brd">${[...S.invoices].reverse().map(inv => `<div class="row ${inv.status === 'anulada' ? 'void' : ''}" data-a="openInv" data-k="${inv.id}" style="cursor:pointer">${fig(pad(inv.id, 6), 'sm')}<div class="grow"><p class="t s">${new Date(inv.at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })} · Mesa ${pad(inv.table)} · ${inv.method}</p>${inv.status === 'anulada' ? tag('Anulada', 'r') : ''}</div><b class="num ${inv.status === 'anulada' ? 'strike' : ''}">${$(inv.total)}</b>${ic('chev', 'i s')}</div>`).join('')}</div><p class="t s">Numeración consecutiva y sin saltos. Las facturas viven en el servidor del local.</p>` });
  V.inventario = () => {
    const list = [...S.products].sort((x, y) => (x.stock <= x.min ? 0 : 1) - (y.stock <= y.min ? 0 : 1) || x.name.localeCompare(y.name));
    const low = list.filter(x => x.stock <= x.min);
    return { title: 'Inventario', body: `
      ${low.length ? `<div class="ban r">${ic('bell')}<div><b>${low.length} ${low.length === 1 ? 'producto' : 'productos'} en o bajo el mínimo</b><p>${low.map(x => x.name).join(', ')}.</p></div></div>` : ''}
      <div class="brd"><div class="brd-h"><span class="lbl">Producto</span><span class="lbl">Stock / mín.</span></div>${list.map(x => `<div class="row ${x.stock <= x.min ? 'void' : ''}">${thumb(x)}<div class="grow"><p style="font-weight:500">${x.name}</p><p class="t s">${x.cat} · margen ${$(x.price - x.cost)}</p></div>${fig(pad(x.stock), 'sm ' + (x.stock <= x.min ? 'r' : ''))}<span class="t s">/ ${x.min}</span></div>`).join('')}</div>` };
  };
  V.resumen = p => {
    const per = p.per || 0, paid = S.invoices.filter(i => i.status === 'pagada' && i.id >= S.nextInvStart);
    const extraS = paid.reduce((s, i) => s + i.subtotal - i.desc, 0), extraC = paid.reduce((s, i) => s + i.cost, 0);
    const mult = [1, 5.6, 22][per];
    const sales = Math.round(S.base.sales * mult) + extraS, cost = Math.round(S.base.cost * mult) + extraC, gastos = Math.round(S.base.gastos * mult);
    const bars = [['L', 620], ['M', 540], ['X', 710], ['J', 880], ['V', 1250], ['S', 1430], ['D', Math.round(980 + extraS / 1000)]];
    const mx = Math.max(...bars.map(b => b[1]));
    return { title: 'Resumen', body: `
      <div class="segc" role="group">${['Hoy', 'Semana', 'Mes'].map((l, k) => `<button type="button" aria-pressed="${k === per}" data-a="per" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="brd"><div class="row"><div class="grow"><span class="lbl">Utilidad estimada · ${['hoy', 'semana', 'mes'][per]}</span><div style="margin-top:6px">${fig($(sales - cost - gastos), 'lg g')}</div></div></div>
       <div style="padding:2px 14px 8px"><div class="kv"><span class="k">Ventas</span><span class="num">${$(sales)}</span></div><div class="kv"><span class="k">Costo de lo vendido</span><span class="num">−${$(cost)}</span></div><div class="kv"><span class="k">Otros gastos</span><span class="num">−${$(gastos)}</span></div></div>
       <div class="row" style="background:var(--face2)"><div class="grow"><p class="t s">Gasto en surtido · se reporta aparte</p></div><span class="num">${$(Math.round(S.base.surtido * mult))}</span></div></div>
      <div class="brd"><div class="brd-h"><span class="h sm">Ventas por día · miles</span><span class="lbl">Semana</span></div><div class="chart" style="padding:12px 14px 10px;height:170px">${bars.map(([d, v], i) => `<div class="col"><span class="lbl" style="font-size:11px">${v}</span><div class="b ${i === 6 ? 'hi' : ''}" style="height:${v / mx * 100}%"></div><span class="lbl">${d}</span></div>`).join('')}</div></div>
      <div class="brd"><div class="brd-h"><span class="h sm">Margen por producto</span><span class="lbl">Precio − costo</span></div>${[...S.products].sort((x, y) => (y.price - y.cost) - (x.price - x.cost)).slice(0, 5).map(x => `<div class="row"><span class="grow">${x.name}</span><span class="num">${$(x.price - x.cost)}</span></div>`).join('')}</div>` };
  };
  V.ubicacion = () => ({ title: 'Ubicación', body: `
      <div class="map" style="height:420px"><svg class="streets" viewBox="0 0 360 330" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" style="color:var(--line)"><path d="M-10 250 C 80 210, 140 220, 200 160 S 320 80, 380 60" stroke-width="14"/><path d="M60 -10 C 80 80, 110 140, 120 340" stroke-width="8"/><path d="M200 160 L 260 340" stroke-width="8"/><path d="M-10 90 L 380 140" stroke-width="5"/></g><path d="M-10 250 C 80 210, 140 220, 200 160 S 320 80, 380 60" stroke="#F2C66B" stroke-width="7" fill="none"/></svg>
       <div class="pin" style="left:46%;top:58%"><span class="pl">Mirador La Capilla</span><svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 22s7-6.4 7-12a7 7 0 10-14 0c0 5.6 7 12 7 12z" fill="#E9474E" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg></div>
       <div class="pin" style="left:62%;top:30%"><span class="pl">Distribuidora X</span><svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 22s7-6.4 7-12a7 7 0 10-14 0c0 5.6 7 12 7 12z" fill="#2F2F35" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg></div>
       <span class="me" style="left:40%;top:74%"></span>
       <div class="mapctl" style="top:10px"><button class="ib" type="button" aria-label="Centrar">${ic('gps')}</button><button class="ib" type="button" aria-label="Acercar">${ic('plus')}</button><button class="ib" type="button" aria-label="Alejar">${ic('minus')}</button></div><span class="attr">© OpenStreetMap · Leaflet</span></div>
      <p class="t s">Km 3 vía Belalcázar – La Virginia, vereda La Alemania. Coordenadas exactas pendientes de confirmar.</p>` });

  /* ------------ acciones ------------ */
  const ACT = {
    back: () => { if (S.stack.length > 1) S.stack.pop(); S.ui = {}; },
    home: () => { S.stack = [{ s: home(), p: {} }]; },
    tab: d => { S.stack = [{ s: d.k, p: {} }]; },
    nav: d => { S.ui = {}; S.stack.push({ s: d.k, p: {} }); },
    drawer: () => { S.ui = { drawer: 1 }; }, closeUi: () => { S.ui = {}; }, untoast: () => { S.toast = null; },
    toggleConn: () => { S.conn = S.conn === 'off' ? 'ok' : 'off'; S.ui = {}; toast(S.conn === 'off' ? 'Sin conexión: las confirmaciones quedan bloqueadas' : 'Conectado de nuevo al PC de caja', S.conn === 'off' ? 'wifioff' : 'wifi'); },
    logout: () => { S.ui = {}; S.toast = null; S.stack = [{ s: 'login', p: { sel: S.user ? S.user.id : 'ana', pin: '' } }]; S.user = null; },
    pickUser: d => { top().p.sel = d.k; top().p.pin = ''; },
    key: d => { const p = top().p; if (d.k === 'del') p.pin = p.pin.slice(0, -1); else if (p.pin.length < 4) p.pin += d.k; },
    doLogin: () => { H.login(top().p.sel); toast('Hola, ' + S.user.name, 'checkc'); },
    filter: d => { top().p.f = +d.k; },
    fabOpen: () => { const free = S.tables.find(t => !H.acc(t)); if (free) S.ui = { open: free }; else toast('No hay mesas libres', 'info'); },
    tapTable: d => { const t = +d.k, a = H.acc(t); if (a) S.stack.push({ s: 'mesa', p: { id: a.id } }); else if (can('order')) S.ui = { open: t }; else toast('Mesa libre', 'info'); },
    openTable: () => {
      const t = S.ui.open; S.ui = {};
      if (H.acc(t)) { toast(`La mesa ${t} ya fue abierta desde otro celular`, 'alert'); return; }
      const a = { id: 'a' + (++S.seq), table: t, waiter: S.user.name, status: 'abierta', opened: Date.now(), rounds: [] };
      S.accounts.push(a); S.stack.push({ s: 'mesa', p: { id: a.id } }); S.stack.push({ s: 'ronda', p: { id: a.id } });
    },
    seeNotif: d => { S.notifs.forEach(n => { if (n.acc === d.k) n.seen = true; }); S.stack.push({ s: 'mesa', p: { id: d.k } }); S.toast = null; },
    goRonda: () => S.stack.push({ s: 'ronda', p: { id: top().p.id } }),
    cat: d => { top().p.cat = +d.k; }, clearQ: () => { top().p.q = ''; top().p.cat = 0; },
    addP: d => { const p = top().p, dr = S.drafts[p.id], pr = H.prod(+d.k); const i = dr.items.find(x => x.pid === pr.id); if (i) { if (i.q < pr.stock) i.q++; } else dr.items.push({ pid: pr.id, q: 1, note: '' }); },
    inc: d => { const dr = S.drafts[top().p.id], i = dr.items[+d.k]; if (i.q < H.prod(i.pid).stock) i.q++; },
    dec: d => { const dr = S.drafts[top().p.id], i = dr.items[+d.k]; if (i.q > 1) i.q--; else S.ui = { remove: +d.k }; },
    doRemove: () => { S.drafts[top().p.id].items.splice(S.ui.remove, 1); S.ui = {}; },
    noteOpen: d => { S.drafts[top().p.id].items[+d.k].noteOpen = true; S._focus = 'n' + d.k; },
    confirm: () => {
      const id = top().p.id, a = S.accounts.find(x => x.id === id), dr = S.drafts[id];
      const short = dr.items.find(i => i.q > H.prod(i.pid).stock);
      if (short) { toast(`${H.prod(short.pid).name}: solo quedan ${H.prod(short.pid).stock}. Ajusta la cantidad.`, 'alert'); return; }
      const single = role() === 'todo';
      const r = { id: 'r' + (++S.seq), n: a.rounds.length + 1, by: S.user.name, at: Date.now(), status: single ? 'entregado' : 'tomado', items: dr.items.map(i => { const p = H.prod(i.pid); p.stock -= i.q; return { pid: i.pid, q: i.q, price: p.price, cost: p.cost, note: i.note, void: null }; }) };
      a.rounds.push(r); delete S.drafts[id]; S.stack.pop();
      toast(single ? `Ronda ${r.n} registrada como entregada` : `Ronda ${r.n} enviada a barra · stock validado`, 'checkc');
    },
    deliver: d => { const a = S.accounts.find(x => x.id === top().p.id); a.rounds.find(r => r.id === d.r).status = 'entregado'; toast('Ronda marcada como entregada', 'checkc'); },
    askBill: () => { const a = S.accounts.find(x => x.id === top().p.id); a.status = 'por_cobrar'; toast(`Mesa ${a.table} pasó a «por cobrar»`, 'receipt'); },
    askBillGo: () => { const a = S.accounts.find(x => x.id === top().p.id); a.status = 'por_cobrar'; S.stack.push({ s: 'cobro', p: { id: a.id } }); },
    reopen: () => { const a = S.accounts.find(x => x.id === top().p.id); a.status = 'abierta'; toast(`Cuenta de la mesa ${a.table} reabierta`, 'undo'); },
    goCobro: () => S.stack.push({ s: 'cobro', p: { id: top().p.id } }),
    goCobroId: d => S.stack.push({ s: 'cobro', p: { id: d.k } }),
    btab: d => { top().p.tab = +d.k; },
    advance: d => {
      for (const a of S.accounts) { const r = a.rounds.find(x => x.id === d.r); if (!r) continue;
        if (r.status === 'tomado') { r.status = 'preparacion'; toast(`Mesa ${a.table}: en preparación`, 'play'); }
        else if (r.status === 'preparacion') { r.status = 'listo'; S.notifs.push({ to: r.by, acc: a.id, text: `Ronda ${r.n} de la mesa ${a.table} está lista`, seen: false }); toast(`Aviso enviado a ${r.by}`, 'bell'); } }
    },
    method: d => { top().p.form.method = d.k; },
    charge: () => {
      const p = top().p, a = S.accounts.find(x => x.id === p.id), sub = subtotalOf(a), b = bill(sub, p.form, S.config.tax);
      if (!b.ready) return;
      const items = a.rounds.flatMap(r => r.items);
      const inv = { id: S.nextInv++, at: Date.now(), table: a.table, waiter: a.waiter, method: p.form.method, subtotal: sub, desc: b.D, tip: Math.round(b.tipV), tax: Math.round(b.taxV), total: b.total, recv: p.form.method === 'Efectivo' ? Number(String(p.form.recv).replace(/\./g, '')) : 0, cost: live(a).reduce((s, i) => s + i.q * i.cost, 0), status: 'pagada', items };
      S.invoices.push(inv); a.status = 'pagada';
      S.stack = [{ s: home(), p: {} }, { s: 'factura', p: { id: inv.id, fresh: true } }];
    },
    openInv: d => S.stack.push({ s: 'factura', p: { id: +d.k } }),
    fakePdf: () => toast('PDF generado · listo para compartir', 'file'),
    per: d => { top().p.per = +d.k; },
    askVoid: d => { S.ui = { void: { r: d.r, i: +d.i, reason: null, restock: true } }; },
    pickReason: d => { S.ui.void.reason = +d.k; }, toggleRestock: () => { S.ui.void.restock = !S.ui.void.restock; },
    doVoid: () => {
      const v = S.ui.void, a = S.accounts.find(x => x.id === top().p.id), r = a.rounds.find(x => x.id === v.r), i = r.items[v.i];
      const reasons = ['cliente cambió de opinión', 'error al tomar el pedido', 'producto en mal estado'];
      i.void = `${S.user.name} · ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })} · ${reasons[v.reason]}`;
      if (r.status !== 'entregado' && v.restock) H.prod(i.pid).stock += i.q;
      S.ui = {}; toast('Ítem anulado · barra ya lo ve tachado', 'x');
    },
  };

  /* ------------ render ------------ */
  function render() {
    const t = top(), v = (V[t.s] || V.mesas)(t.p);
    const prevBody = root.querySelector('.body'), sameScreen = root.dataset.screen === t.s + JSON.stringify(t.p.id || '');
    const scroll = prevBody && sameScreen ? prevBody.scrollTop : 0;
    const ae = document.activeElement, focusKey = ae && root.contains(ae) && ae.dataset.in ? (ae.id) : null, sel = focusKey ? [ae.selectionStart, ae.selectionEnd] : null;
    root.innerHTML = phone(v);
    root.dataset.screen = t.s + JSON.stringify(t.p.id || '');
    const nb = root.querySelector('.body'); if (nb) nb.scrollTop = scroll;
    const fk = S._focus || focusKey; S._focus = null;
    if (fk && interactive) { const el = root.querySelector('#' + fk); if (el) { el.focus(); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
    if (opts.onRender) opts.onRender(S);
  }
  if (interactive) {
    root.addEventListener('click', e => {
      const el = e.target.closest('[data-a]'); if (!el || !root.contains(el)) return;
      e.preventDefault(); if (el.getAttribute('aria-disabled') === 'true') return;
      const f = ACT[el.dataset.a]; if (!f) return;
      if (el.dataset.a !== 'untoast' && S.toast && Date.now() - S.toast.at > 2500) S.toast = null;
      f(el.dataset); render();
    });
    root.addEventListener('input', e => {
      const el = e.target; if (!el.dataset.in) return; const p = top().p;
      if (el.dataset.in === 'q') p.q = el.value;
      else if (el.dataset.in === 'note') { S.drafts[p.id].items[+el.dataset.k].note = el.value.slice(0, 100); }
      else if (p.form) p.form[el.dataset.in] = el.value;
      render();
    });
    clockTimer = setInterval(() => { if (!root.isConnected) return clearInterval(clockTimer); if (!document.activeElement || !root.contains(document.activeElement) || !document.activeElement.dataset.in) render(); }, 30000);
  }
  if (opts.setup) opts.setup(S, H);
  S.nextInvStart = S.nextInvStart || S.nextInv;
  render();
  return {
    state: S, render, act: (a, d = {}) => { ACT[a](d); render(); },
    loginAs: id => { H.login(id); render(); },
    setConn: c => { S.conn = c; render(); },
    reset: () => { const n = seed(); Object.keys(S).forEach(k => delete S[k]); Object.assign(S, n); S.nextInvStart = S.nextInv; render(); },
  };
}

global.BarPOS = { createApp, seed, USERS, helpers: { $, pad } };
})(window);
