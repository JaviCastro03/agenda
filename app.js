(() => {
'use strict';

/* =========================================================
   Agenda para estética · todo se guarda en el propio iPhone
   ========================================================= */

const KEY = 'agenda-estetica-v1';
const DEFAULT_TEMPLATE =
  'Hola {nombre}, te recuerdo tu cita {cuando} a las {hora} ({servicio}). ¡Te esperamos! Si no puedes venir, avísame por favor. {negocio}';

/* ---------- Datos ---------- */
function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  const s = Object.assign(
    { business: '', country: '34', template: DEFAULT_TEMPLATE, leadHours: 24, autoIcs: true, icsMode: 'shortcut', shortcutName: 'Aviso Agenda', lastBackup: '' },
    d.settings || {}
  );
  const appts = (Array.isArray(d.appts) ? d.appts : []).filter(a => a && a.id && a.date && a.time);
  return { appts, settings: s };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {}
  return normalize({});
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('No se pudo guardar (almacenamiento lleno)'); }
}

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
const todayStr = () => toStr(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return toStr(d); };
const weekStart = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toStr(d); };
const monthStart = s => s.slice(0, 8) + '01';
const monthEnd = s => { const d = parse(s); return toStr(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); };
const addMonths = (s, n) => { const d = parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return toStr(d); };
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const fmtLong = s => cap(parse(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
const fmtShort = s => parse(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const fmtMonth = s => cap(parse(s).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
const eurFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const money = n => eurFmt.format(n || 0);
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const byTime = (a, b) => a.time.localeCompare(b.time);
const find = id => db.appts.find(a => a.id === id);
const sum = (arr, f) => arr.reduce((t, x) => t + (f(x) || 0), 0);

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- Teléfono, WhatsApp y mensaje ---------- */
function waNumber(p) {
  let raw = String(p || '').trim();
  if (raw.startsWith('+')) return raw.replace(/\D/g, '');
  let d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) return d.slice(2);
  if (d.length <= 10) return String(db.settings.country || '34').replace(/\D/g, '') + d.replace(/^0+/, '');
  return d;
}
function cuando(date) {
  const t = todayStr();
  if (date === t) return 'hoy';
  if (date === addDays(t, 1)) return 'mañana';
  return 'el ' + parse(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
function buildMsg(a) {
  const s = db.settings;
  const m = (s.template || DEFAULT_TEMPLATE)
    .split('{nombre}').join((a.name || '').trim().split(/\s+/)[0] || '')
    .split('{cuando}').join(cuando(a.date))
    .split('{fecha}').join(parse(a.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))
    .split('{hora}').join(a.time)
    .split('{servicio}').join(a.service || '')
    .split('{negocio}').join(s.business || '');
  return m.replace(/\(\s*\)/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}
function waLink(a) {
  return 'https://wa.me/' + waNumber(a.phone) + '?text=' + encodeURIComponent(buildMsg(a));
}

/* ---------- Aviso para el Calendario de Apple (.ics) ---------- */
const icsEsc = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsDT(date, time, addMin) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm + (addMin || 0));
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}
function avisoTitle(a) {
  const lead = Math.max(1, Number(db.settings.leadHours) || 24);
  const first = (a.name || 'cliente').trim().split(/\s+/)[0];
  const when = lead === 24 ? 'de mañana' : 'del ' + fmtShort(a.date);
  return `Recordar a ${first} su cita ${when} a las ${a.time}`;
}
function buildIcs(a) {
  const lead = Math.max(1, Number(db.settings.leadHours) || 24);
  const title = avisoTitle(a);
  const desc = [`Cliente: ${a.name}`, a.phone ? `Tel: ${a.phone}` : '', a.service ? `Servicio: ${a.service}` : '', `Cita: ${fmtLong(a.date)} a las ${a.time}`]
    .filter(Boolean).join('\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agenda Estetica//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${a.id}-aviso@agenda`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDT(a.date, a.time, -lead * 60)}`,
    `DTEND:${icsDT(a.date, a.time, -lead * 60 + 15)}`,
    `SUMMARY:${icsEsc(title)}`,
    `DESCRIPTION:${icsEsc(desc)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(title)}`, 'TRIGGER:PT0S', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
}
async function giveFile(name, type, text) {
  try {
    const file = new File([text], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/* ---------- Aviso con Atajos de iOS ---------- */
function fmtLocal(date, time, addMin) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm + (addMin || 0));
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function shortcutUrl(text) {
  const name = String(db.settings.shortcutName || '').trim() || 'Aviso Agenda';
  return 'shortcuts://run-shortcut?name=' + encodeURIComponent(name) + '&input=text&text=' + encodeURIComponent(text);
}
function sendAviso(a) {
  if (db.settings.icsMode === 'share') {
    giveFile(`aviso-${a.date}-${a.time.replace(':', '')}.ics`, 'text/calendar', buildIcs(a));
    return;
  }
  const lead = Math.max(1, Number(db.settings.leadHours) || 24);
  const notes = [a.name, a.phone ? 'Tel: ' + a.phone : '', a.service || ''].filter(Boolean).join(' · ');
  const text = [avisoTitle(a), fmtLocal(a.date, a.time, -lead * 60), notes].join('\n');
  window.location.href = shortcutUrl(text);
}

/* ---------- Estado de pantalla ---------- */
const state = {
  tab: 'agenda', mode: 'day', date: todayStr(),
  incMode: 'week', incDate: todayStr(), sheet: null
};

/* ---------- Componentes ---------- */
const seg = (key, opts, cur) =>
  `<div class="seg">${opts.map(([v, l]) =>
    `<button type="button" class="${v === cur ? 'on' : ''}" data-action="seg" data-key="${key}" data-val="${v}">${l}</button>`).join('')}</div>`;
const navBar = (title, scope) =>
  `<div class="nav"><button data-action="nav" data-scope="${scope}" data-dir="-1" aria-label="Anterior">‹</button>
   <div class="nav-title">${title}</div>
   <button data-action="nav" data-scope="${scope}" data-dir="1" aria-label="Siguiente">›</button></div>`;

function card(a) {
  const st = a.status || 'pending';
  const badge = st === 'done' ? '<span class="badge ok">Realizada</span>' : st === 'noshow' ? '<span class="badge bad">No vino</span>' : '';
  const paid = st === 'done' && (a.price || a.tip)
    ? `<p class="paid">💶 ${money(a.price)}${a.tip ? ' · propina ' + money(a.tip) : ''}${a.method ? ' · ' + esc(a.method) : ''}</p>` : '';
  const hasPhone = !!waNumber(a.phone);
  const tel = a.phone
    ? `<a class="phone" data-action="stop" href="tel:+${waNumber(a.phone)}">📞 ${esc(a.phone)}</a>`
    : '<span class="phone none">Sin teléfono</span>';
  const wa = hasPhone
    ? `<a class="btn wa" data-action="wa" data-id="${a.id}" href="${waLink(a)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
  return `<article class="card ${st}" data-action="pay" data-id="${a.id}">
    <div class="time"><b>${esc(a.time)}</b><small>${a.dur || 60} min</small></div>
    <div class="body">
      <div class="line1"><h3>${esc(a.name)}</h3>${badge}</div>
      ${a.service ? `<p class="svc">${esc(a.service)}</p>` : ''}
      ${tel}
      ${a.notes ? `<p class="notes">${esc(a.notes)}</p>` : ''}
      ${paid}
      <div class="acts">
        ${wa}
        <button class="btn" data-action="ics" data-id="${a.id}">🔔 Aviso</button>
        <button class="btn ghost" data-action="edit" data-id="${a.id}">Editar</button>
        ${a.reminded ? '<span class="sent">✓ Avisada</span>' : ''}
      </div>
    </div>
  </article>`;
}

/* ---------- Vista: Agenda ---------- */
function renderAgenda() {
  const d = state.date, today = todayStr();
  const biz = db.settings.business ? esc(db.settings.business) : 'Agenda';
  let h = `<header class="top"><div><h1>${biz}</h1></div><button class="icon" data-action="today">Hoy</button></header>`;
  h += seg('mode', [['day', 'Día'], ['week', 'Semana']], state.mode);

  if (state.mode === 'day') {
    const tm = addDays(today, 1);
    const tl = db.appts.filter(a => a.date === tm && a.status !== 'noshow' && waNumber(a.phone));
    if (tl.length) {
      const pend = tl.filter(a => !a.reminded).length;
      h += `<button class="banner" data-action="remind"><span>🔔 Recordatorios de mañana</span><b>${pend ? pend + ' por enviar' : 'Todos enviados ✓'}</b></button>`;
    }
    h += navBar(esc(fmtLong(d)) + (d === today ? ' · hoy' : ''), 'agenda');
    const list = db.appts.filter(a => a.date === d).sort(byTime);
    const done = list.filter(a => a.status === 'done');
    if (list.length) {
      const inc = sum(done, a => a.price), tips = sum(done, a => a.tip);
      h += `<p class="summary">${list.length} ${list.length === 1 ? 'cita' : 'citas'}${done.length ? ` · cobrado ${money(inc)}${tips ? ` (+ ${money(tips)} de propina)` : ''}` : ''}</p>`;
      h += list.map(card).join('');
    } else {
      h += '<p class="empty">Sin citas este día.<br>Pulsa ＋ para añadir una.</p>';
    }
  } else {
    const ws = weekStart(d), we = addDays(ws, 6);
    const title = parse(ws).getMonth() === parse(we).getMonth()
      ? `${parse(ws).getDate()} – ${fmtShort(we)}` : `${fmtShort(ws)} – ${fmtShort(we)}`;
    h += navBar(esc(title), 'agenda');
    for (let i = 0; i < 7; i++) {
      const day = addDays(ws, i);
      const list = db.appts.filter(a => a.date === day).sort(byTime);
      const wd = parse(day).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      h += `<section class="wday ${day === today ? 'today' : ''}" data-action="goday" data-date="${day}">
        <div class="wd-head"><b>${esc(cap(wd))}</b><span>${list.length ? list.length + (list.length === 1 ? ' cita' : ' citas') : 'libre'}</span></div>
        ${list.length ? `<ul>${list.map(a => `<li><em>${esc(a.time)}</em>${esc(a.name)}${a.service ? ' · ' + esc(a.service) : ''}</li>`).join('')}</ul>` : ''}
      </section>`;
    }
  }
  return h;
}

/* ---------- Vista: Ingresos ---------- */
function range(mode, date) {
  if (mode === 'day') return [date, date];
  if (mode === 'week') { const s = weekStart(date); return [s, addDays(s, 6)]; }
  return [monthStart(date), monthEnd(date)];
}
function renderIncome() {
  const mode = state.incMode, date = state.incDate;
  const [from, to] = range(mode, date);
  const inR = db.appts.filter(a => a.date >= from && a.date <= to);
  const done = inR.filter(a => a.status === 'done');
  const noshow = inR.filter(a => a.status === 'noshow').length;
  const paid = sum(done, a => a.price), tips = sum(done, a => a.tip);
  const title = mode === 'day' ? fmtLong(date)
    : mode === 'week' ? (parse(from).getMonth() === parse(to).getMonth() ? `${parse(from).getDate()} – ${fmtShort(to)}` : `${fmtShort(from)} – ${fmtShort(to)}`)
    : fmtMonth(date);

  let h = `<header class="top"><h1>Ingresos</h1><button class="icon" data-action="today">Hoy</button></header>`;
  h += seg('incMode', [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']], mode);
  h += navBar(esc(title), 'income');
  h += `<div class="stat-big"><small>TOTAL (cobrado + propinas)</small><b>${money(paid + tips)}</b></div>
    <div class="grid2">
      <div class="stat"><small>Cobrado</small><b>${money(paid)}</b></div>
      <div class="stat"><small>Propinas</small><b>${money(tips)}</b></div>
      <div class="stat"><small>Citas realizadas</small><b>${done.length}</b></div>
      <div class="stat"><small>Media por cita</small><b>${money(done.length ? (paid + tips) / done.length : 0)}</b></div>
    </div>`;
  if (noshow) h += `<p class="summary">${noshow} ${noshow === 1 ? 'cita en la que no se presentaron' : 'citas en las que no se presentaron'}.</p>`;

  if (mode !== 'day') {
    const days = [];
    for (let s = from; s <= to; s = addDays(s, 1)) days.push(s);
    const vals = days.map(day => sum(done.filter(a => a.date === day), a => (a.price || 0) + (a.tip || 0)));
    const max = Math.max(...vals, 1);
    const L = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    h += `<div class="chart ${mode}">${days.map((day, i) => {
      const v = vals[i], px = Math.round(v / max * 108);
      const label = mode === 'week' ? L[i] : ((parse(day).getDate() % 5 === 1) ? parse(day).getDate() : '');
      return `<div class="bar"><span class="val">${v ? Math.round(v) : ''}</span><i class="${v ? '' : 'zero'}" style="height:${v ? px : 2}px"></i><b>${label}</b></div>`;
    }).join('')}</div>`;
  } else if (done.length) {
    h += `<div class="list">${done.sort(byTime).map(a =>
      `<div class="it"><div><b>${esc(a.name)}</b><br><small>${esc(a.time)}${a.doneService || a.service ? ' · ' + esc(a.doneService || a.service) : ''}${a.method ? ' · ' + esc(a.method) : ''}</small></div>
       <div style="text-align:right"><b>${money(a.price)}</b>${a.tip ? `<br><small>+ ${money(a.tip)} propina</small>` : ''}</div></div>`).join('')}</div>`;
  }
  if (!done.length) h += '<p class="empty">Aún no hay cobros en este periodo.<br>Pulsa una cita en la agenda para apuntar lo cobrado.</p>';
  return h;
}

/* ---------- Vista: Ajustes ---------- */
function renderSettings() {
  const s = db.settings;
  return `<header class="top"><h1>Ajustes</h1></header>
  <form id="f-set" autocomplete="off">
    <label>Nombre del negocio (opcional)
      <input name="business" value="${esc(s.business)}" placeholder="Ej. Estética Lola"></label>
    <div class="row2">
      <label>Prefijo de país
        <input name="country" inputmode="numeric" value="${esc(s.country)}" placeholder="34"></label>
      <label>Aviso al Calendario (horas antes)
        <input name="leadHours" type="number" inputmode="numeric" min="1" max="168" value="${esc(s.leadHours)}"></label>
    </div>
    <label class="check"><input type="checkbox" name="autoIcs" ${s.autoIcs ? 'checked' : ''}> Al crear una cita, crear el aviso en el Calendario</label>
    <label>Cómo crear el aviso
      <select name="icsMode">
        <option value="shortcut" ${s.icsMode !== 'share' ? 'selected' : ''}>Atajo de iOS (automático)</option>
        <option value="share" ${s.icsMode === 'share' ? 'selected' : ''}>Compartir archivo (manual)</option>
      </select></label>
    <label>Nombre del atajo
      <input name="shortcutName" value="${esc(s.shortcutName)}" placeholder="Aviso Agenda"></label>
    <div class="btnrow" style="margin:-2px 0 6px"><button type="button" class="btn ghost" data-action="testshortcut">Probar atajo (aviso en 2 min)</button></div>
    <p class="hint">Crea el atajo una vez en la app Atajos con ese nombre exacto y pulsa «Probar atajo». Si funciona, te sonará un aviso en 2 minutos.</p>
    <label>Mensaje de WhatsApp
      <textarea name="template" id="tpl" rows="5">${esc(s.template)}</textarea></label>
    <p class="hint">Puedes usar: {nombre} {cuando} {fecha} {hora} {servicio} {negocio}. {cuando} pone «mañana», «hoy» o el día de la semana.</p>
    <div class="btnrow">
      <button type="button" class="btn ghost" data-action="resettpl">Mensaje original</button>
      <button type="submit" class="btn primary">Guardar</button>
    </div>
  </form>

  <div class="section">Copia de seguridad</div>
  <p class="hint">Los datos viven solo en este iPhone. Haz una copia de vez en cuando y guárdala en Archivos (iCloud).<br>Última copia: ${s.lastBackup ? esc(fmtLong(s.lastBackup)) : 'nunca'}.</p>
  <div class="btnrow">
    <button class="btn primary" data-action="export">Exportar copia</button>
    <button class="btn ghost" data-action="import">Importar copia</button>
  </div>

  <div class="section">Datos</div>
  <p class="hint">${db.appts.length} citas guardadas.</p>
  <button class="btn danger block" data-action="wipe">Borrar todos los datos</button>`;
}

/* ---------- Hojas (formularios) ---------- */
const head = t => `<div class="sheet-head"><h2>${t}</h2><button class="x" data-action="close" aria-label="Cerrar">✕</button></div>`;

function defaultTime(date) {
  const list = db.appts.filter(a => a.date === date && a.status !== 'noshow').sort(byTime);
  if (!list.length) return '10:00';
  const l = list[list.length - 1];
  const m = Math.min(toMin(l.time) + (l.dur || 60), 23 * 60 + 45);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
function apptSheet(id) {
  const a = id ? find(id) : null;
  const v = a || { name: '', phone: '', date: state.date, time: defaultTime(state.date), service: '', dur: 60, notes: '' };
  const services = [...new Set(db.appts.map(x => x.service).filter(Boolean))].sort();
  const durs = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180];
  if (!durs.includes(Number(v.dur))) durs.push(Number(v.dur)), durs.sort((x, y) => x - y);
  return head(a ? 'Editar cita' : 'Nueva cita') + `
  <form id="f-appt" autocomplete="off">
    <label>Nombre<input name="name" required value="${esc(v.name)}" autocapitalize="words" placeholder="María López"></label>
    <label>Teléfono<input name="phone" type="tel" inputmode="tel" value="${esc(v.phone)}" placeholder="612 345 678"></label>
    <div class="row2">
      <label>Fecha<input name="date" type="date" required value="${esc(v.date)}"></label>
      <label>Hora<input name="time" type="time" required value="${esc(v.time)}"></label>
    </div>
    <label>Servicio<input name="service" list="svc" value="${esc(v.service)}" placeholder="Limpieza facial, manicura…" autocapitalize="sentences">
      <datalist id="svc">${services.map(s => `<option value="${esc(s)}">`).join('')}</datalist></label>
    <label>Duración<select name="dur">${durs.map(m => `<option value="${m}" ${Number(v.dur) === m ? 'selected' : ''}>${m >= 60 ? (Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '')) : m + ' min'}</option>`).join('')}</select></label>
    <label>Notas<textarea name="notes" placeholder="Alergias, preferencias…">${esc(v.notes)}</textarea></label>
    <label class="check"><input type="checkbox" name="ics" ${!a && db.settings.autoIcs ? 'checked' : ''}> Crear aviso en el Calendario (${Number(db.settings.leadHours) || 24} h antes)</label>
    <div class="btnrow">
      ${a ? '<button type="button" class="btn danger" data-action="del" data-id="' + a.id + '">Eliminar</button>' : ''}
      <button type="submit" class="btn primary">Guardar</button>
    </div>
  </form>`;
}
function paySheet(id) {
  const a = find(id);
  if (!a) return '';
  const st = a.status || 'pending';
  const chip = (v, l) => `<label class="chip"><input type="radio" name="status" value="${v}" ${st === v ? 'checked' : ''}><span>${l}</span></label>`;
  return head(`${esc(a.name)} · ${esc(a.time)}`) + `
  <form id="f-pay" autocomplete="off">
    <div class="chips">${chip('pending', 'Pendiente')}${chip('done', 'Realizada')}${chip('noshow', 'No vino')}</div>
    <label>Servicio realizado<input name="doneService" value="${esc(a.doneService || a.service || '')}" placeholder="Servicio"></label>
    <div class="row2">
      <label>Cobrado (€)<input name="price" inputmode="decimal" value="${a.price ? String(a.price).replace('.', ',') : ''}" placeholder="0,00"></label>
      <label>Propina (€)<input name="tip" inputmode="decimal" value="${a.tip ? String(a.tip).replace('.', ',') : ''}" placeholder="0,00"></label>
    </div>
    <label>Forma de pago<select name="method">${['Efectivo', 'Tarjeta', 'Bizum', 'Otro'].map(m => `<option ${a.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    <div class="btnrow">
      <button type="button" class="btn ghost" data-action="edit" data-id="${a.id}">Editar cita</button>
      <button type="submit" class="btn primary">Guardar</button>
    </div>
  </form>`;
}
function remindSheet() {
  const tm = addDays(todayStr(), 1);
  const list = db.appts.filter(a => a.date === tm && a.status !== 'noshow').sort(byTime);
  return head('Recordatorios de mañana') + `<p class="hint" style="margin-top:-4px">${esc(fmtLong(tm))}. Se marcan como enviadas al pulsar el botón.</p>` +
    (list.length ? list.map(a => `<div class="rem">
      <div><b>${esc(a.time)}</b> ${esc(a.name)}<br><small>${a.phone ? esc(a.phone) : 'Sin teléfono'}${a.service ? ' · ' + esc(a.service) : ''}</small></div>
      <div>${waNumber(a.phone) ? `<a class="btn wa" data-action="wa" data-id="${a.id}" href="${waLink(a)}" target="_blank" rel="noopener">${a.reminded ? '✓ Reenviar' : 'Enviar'}</a>` : ''}</div>
    </div>`).join('') : '<p class="empty">No hay citas mañana.</p>');
}
function renderSheet() {
  const root = $('#sheet-root');
  const s = state.sheet;
  if (!s) { root.innerHTML = ''; document.body.classList.remove('lock'); return; }
  const inner = s.type === 'appt' ? apptSheet(s.id) : s.type === 'pay' ? paySheet(s.id) : remindSheet();
  root.innerHTML = `<div class="backdrop" data-action="close"></div><div class="sheet" role="dialog" aria-modal="true">${inner}</div>`;
  document.body.classList.add('lock');
}
function openSheet(s) { state.sheet = s; renderSheet(); }
function closeSheet() { state.sheet = null; renderSheet(); }

/* ---------- Render principal ---------- */
function render() {
  const v = $('#view');
  v.innerHTML = state.tab === 'agenda' ? renderAgenda() : state.tab === 'income' ? renderIncome() : renderSettings();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  $('#fab').classList.toggle('hide', state.tab !== 'agenda');
}

/* ---------- Guardados ---------- */
function overlaps(x, y) {
  const s1 = toMin(x.time), e1 = s1 + (x.dur || 60), s2 = toMin(y.time), e2 = s2 + (y.dur || 60);
  return s1 < e2 && s2 < e1;
}
function saveAppt(f) {
  const fd = new FormData(f);
  const data = {
    name: String(fd.get('name') || '').trim(), phone: String(fd.get('phone') || '').trim(),
    date: fd.get('date'), time: fd.get('time'), service: String(fd.get('service') || '').trim(),
    dur: Number(fd.get('dur')) || 60, notes: String(fd.get('notes') || '').trim()
  };
  if (!data.name || !data.date || !data.time) return;
  const id = state.sheet && state.sheet.id;
  let a = id ? find(id) : null;
  const clash = db.appts.find(x => x.id !== id && x.date === data.date && x.status !== 'noshow' && overlaps(x, data));
  if (clash && !confirm(`Ya hay una cita a esa hora: ${clash.name} (${clash.time}). ¿Guardar igualmente?`)) return;
  if (a) {
    const moved = a.date !== data.date || a.time !== data.time;
    Object.assign(a, data);
    if (moved) a.reminded = false;
  } else {
    a = Object.assign({ id: uid(), status: 'pending', price: 0, tip: 0, method: 'Efectivo', reminded: false, created: Date.now() }, data);
    db.appts.push(a);
  }
  save();
  const wantAviso = fd.get('ics') === 'on';
  state.date = data.date; state.mode = 'day'; state.tab = 'agenda';
  closeSheet(); render(); toast('Cita guardada');
  if (wantAviso) sendAviso(a);
}
function savePay(f) {
  const a = find(state.sheet && state.sheet.id);
  if (!a) return;
  const fd = new FormData(f);
  a.price = num(fd.get('price')); a.tip = num(fd.get('tip'));
  a.method = fd.get('method'); a.doneService = String(fd.get('doneService') || '').trim();
  let st = fd.get('status') || 'pending';
  if (st === 'pending' && (a.price > 0 || a.tip > 0)) st = 'done';
  a.status = st;
  save(); closeSheet(); render(); toast('Guardado');
}
function saveSettings(f) {
  const fd = new FormData(f);
  const s = db.settings;
  s.business = String(fd.get('business') || '').trim();
  s.country = String(fd.get('country') || '').replace(/\D/g, '') || '34';
  s.leadHours = Math.min(168, Math.max(1, parseInt(fd.get('leadHours'), 10) || 24));
  s.autoIcs = fd.get('autoIcs') === 'on';
  s.icsMode = fd.get('icsMode') === 'share' ? 'share' : 'shortcut';
  s.shortcutName = String(fd.get('shortcutName') || '').trim() || 'Aviso Agenda';
  s.template = String(fd.get('template') || '').trim() || DEFAULT_TEMPLATE;
  save(); render(); toast('Ajustes guardados');
}

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const act = el.dataset.action, id = el.dataset.id;
  switch (act) {
    case 'stop': return;
    case 'tab': state.tab = el.dataset.tab; render(); window.scrollTo(0, 0); return;
    case 'seg': state[el.dataset.key] = el.dataset.val; render(); return;
    case 'today':
      if (state.tab === 'income') state.incDate = todayStr(); else state.date = todayStr();
      render(); return;
    case 'nav': {
      const dir = Number(el.dataset.dir);
      if (el.dataset.scope === 'agenda') state.date = addDays(state.date, dir * (state.mode === 'week' ? 7 : 1));
      else state.incDate = state.incMode === 'month' ? addMonths(state.incDate, dir) : addDays(state.incDate, dir * (state.incMode === 'week' ? 7 : 1));
      render(); return;
    }
    case 'goday': state.date = el.dataset.date; state.mode = 'day'; render(); window.scrollTo(0, 0); return;
    case 'new': openSheet({ type: 'appt' }); return;
    case 'edit': openSheet({ type: 'appt', id }); return;
    case 'pay': openSheet({ type: 'pay', id }); return;
    case 'remind': openSheet({ type: 'remind' }); return;
    case 'close': closeSheet(); return;
    case 'wa': {
      const a = find(id);
      if (a) { a.reminded = true; save(); setTimeout(() => { render(); if (state.sheet && state.sheet.type === 'remind') renderSheet(); }, 400); }
      return; /* el enlace abre WhatsApp con el mensaje escrito */
    }
    case 'ics': {
      const a = find(id);
      if (a) sendAviso(a);
      return;
    }
    case 'del': {
      const a = find(id);
      if (a && confirm(`¿Eliminar la cita de ${a.name}?`)) {
        db.appts = db.appts.filter(x => x.id !== id); save(); closeSheet(); render(); toast('Cita eliminada');
      }
      return;
    }
    case 'testshortcut': {
      const n = new Date();
      const text = ['Prueba de aviso de la agenda', fmtLocal(todayStr(), pad(n.getHours()) + ':' + pad(n.getMinutes()), 2), 'Si ves este aviso, el atajo funciona'].join('\n');
      window.location.href = shortcutUrl(text);
      return;
    }
    case 'resettpl': { const t = $('#tpl'); if (t) t.value = DEFAULT_TEMPLATE; return; }
    case 'export': {
      db.settings.lastBackup = todayStr(); save();
      const payload = JSON.stringify({ version: 1, exported: new Date().toISOString(), data: db }, null, 1);
      giveFile(`agenda-copia-${todayStr()}.json`, 'application/json', payload);
      render(); return;
    }
    case 'import': $('#imp').click(); return;
    case 'wipe':
      if (confirm('¿Borrar TODAS las citas y cobros de este iPhone? No se puede deshacer.') &&
          confirm('Última confirmación: se borrará todo. ¿Seguro?')) {
        const keep = db.settings; db = normalize({ settings: keep }); save(); render(); toast('Datos borrados');
      }
      return;
  }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'f-appt') saveAppt(f);
  else if (f.id === 'f-pay') savePay(f);
  else if (f.id === 'f-set') saveSettings(f);
});
$('#imp').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    const src = d && d.data ? d.data : d;
    if (!src || !Array.isArray(src.appts)) throw new Error('formato');
    if (!confirm(`La copia tiene ${src.appts.length} citas. Se reemplazarán los datos actuales. ¿Continuar?`)) return;
    db = normalize(src); save(); render(); toast('Copia importada');
  } catch (err) { toast('Archivo no válido'); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && !state.sheet) render(); });

/* ---------- Inicio ---------- */
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
render();
})();
