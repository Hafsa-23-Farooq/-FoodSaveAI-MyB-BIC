/* Shared helpers: API calls, auth state, navigation, toasts, modals, listing cards */
const FS = (() => {
  const CAT_ICON = { 'Bakery': '🥐', 'Meals': '🍛', 'Fast food': '🍔', 'Desserts': '🍰', 'Fruit & Veg': '🥬', 'Beverages': '🥤', 'Groceries': '🛒', 'Other': '🍽️' };
  const CATEGORIES = Object.keys(CAT_ICON);
  const DEFAULT_CENTER = { lat: 33.6844, lng: 73.0479 };

  const token = () => localStorage.getItem('fs_token');
  const user = () => { try { return JSON.parse(localStorage.getItem('fs_user')); } catch { return null; } };
  const setAuth = (t, u) => { localStorage.setItem('fs_token', t); localStorage.setItem('fs_user', JSON.stringify(u)); };
  const logout = () => { localStorage.removeItem('fs_token'); localStorage.removeItem('fs_user'); location.href = '/'; };

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch('/api' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && token()) { localStorage.removeItem('fs_token'); localStorage.removeItem('fs_user'); }
      const err = new Error(data.error || 'Something went wrong. Please try again.'); err.status = res.status; throw err;
    }
    return data;
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => 'Rs. ' + Math.round(n).toLocaleString('en-PK');
  const clock = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateTime = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const left = iso => {
    const m = Math.round((Date.parse(iso) - Date.now()) / 60000);
    if (m <= 0) return 'Closed';
    return m < 60 ? `${m} min left` : `${Math.floor(m / 60)}h ${m % 60}m left`;
  };

  function toast(msg, type = '') {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  function modal(html) {
    const o = document.createElement('div'); o.className = 'overlay';
    o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => o.remove();
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    document.body.appendChild(o);
    return { el: o.firstChild, close };
  }

  function listingCard(l, { action = '', showDistance = true } = {}) {
    const off = l.originalPrice > 0 && l.price < l.originalPrice ? Math.round((1 - l.price / l.originalPrice) * 100) : 0;
    const donation = l.type === 'donation';
    return `<article class="listing">
      <div class="pic">${l.photo ? `<img src="${l.photo}" alt="${esc(l.title)}">` : CAT_ICON[l.category] || '🍽️'}
        <span class="badge ${donation ? 'green' : ''}">${donation ? 'Free donation' : esc(l.category)}</span>
        ${off ? `<span class="badge off">${off}% off</span>` : ''}</div>
      <div class="body"><h3>${esc(l.title)}</h3>
        <div class="muted small">${esc(l.businessName)}</div>
        <div class="meta"><span>🍽 ${l.remaining} left</span>${showDistance && l.distanceKm != null ? `<span>📍 ${l.distanceKm} km</span>` : ''}<span>⏰ until ${clock(l.pickupEnd)}</span></div>
        <div class="timer ${l.minutesLeft > 180 ? 'long' : ''}" data-until="${l.pickupEnd}">${left(l.pickupEnd)}</div>
        ${l.description ? `<p class="small muted" style="margin:.4rem 0 0">${esc(l.description)}</p>` : ''}</div>
      <div class="perf"></div>
      <div class="foot">${donation ? '<span class="price" style="color:var(--basil-deep)">Free</span>' : `<span class="price">${money(l.price)}<s>${money(l.originalPrice)}</s></span>`}${action}</div>
    </article>`;
  }

  // Updates every ".timer[data-until]" on the page
  setInterval(() => document.querySelectorAll('[data-until]').forEach(el => { el.textContent = left(el.dataset.until); }), 30000);

  function home(role) { return { business: '/business.html', ngo: '/ngo.html', customer: '/marketplace.html', admin: '/impact.html' }[role] || '/'; }

  // Build the header. Call FS.init({ roles: ['business'] }) on pages that need a login.
  async function init({ roles = null, active = '' } = {}) {
    const u = user();
    if (roles && (!u || !token())) { location.href = '/login.html?next=' + encodeURIComponent(location.pathname); return null; }
    if (roles && !roles.includes(u.role)) { location.href = home(u.role); return null; }
    const links = [];
    if (!u) links.push(['/marketplace.html', 'Find food'], ['/#how', 'How it works']);
    else if (u.role === 'customer') links.push(['/marketplace.html', 'Find food'], ['/orders.html', 'My orders'], ['/impact.html', 'My impact']);
    else if (u.role === 'business') links.push(['/business.html', 'Dashboard'], ['/marketplace.html', 'Marketplace'], ['/impact.html', 'Impact & insights']);
    else if (u.role === 'ngo') links.push(['/ngo.html', 'Donations'], ['/impact.html', 'My impact']);
    else links.push(['/impact.html', 'Admin & impact'], ['/marketplace.html', 'Marketplace']);
    const here = location.pathname;
    const nav = links.map(([h, t]) => `<a href="${h}" class="${here === h.split('#')[0] && !h.includes('#') ? 'active' : ''}">${t}</a>`).join('');
    const right = u
      ? `${u.role !== 'admin' ? `<a href="/notifications.html" class="bell" aria-label="Notifications">🔔<span class="count hidden" id="bellCount">0</span></a>` : ''}
         <a href="/account.html">${esc(u.name.split(' ')[0])}</a><a href="#" id="logoutBtn">Log out</a>`
      : `<a href="/login.html">Log in</a><a href="/register.html" class="btn sm">Sign up</a>`;
    document.getElementById('site-header').outerHTML = `<header class="site-header"><div class="container nav">
      <a class="logo" href="${u ? home(u.role) : '/'}"><span class="logo-mark">🍃</span>FoodSave <b>AI</b></a>
      <button class="nav-toggle" aria-label="Menu" id="navToggle">☰</button>
      <nav class="nav-links" id="navLinks">${nav}${right}</nav></div></header>`;
    document.getElementById('navToggle').onclick = () => document.getElementById('navLinks').classList.toggle('open');
    document.getElementById('logoutBtn')?.addEventListener('click', e => { e.preventDefault(); logout(); });
    const f = document.getElementById('site-footer');
    if (f) f.outerHTML = `<footer class="site-footer"><div class="container row between"><div><strong>FoodSave AI</strong> — Save Food. Save Money. Make an Impact.</div><div class="small">Businesses are responsible for confirming their food is safe to distribute. AI features are recommendations only.</div></div></footer>`;
    if (u && u.role !== 'admin') pollBell();
    return u;
  }

  let lastUnread = null;
  async function pollBell() {
    try {
      const { unread, notifications } = await api('/notifications');
      const b = document.getElementById('bellCount');
      if (b) { b.textContent = unread; b.classList.toggle('hidden', !unread); }
      if (lastUnread !== null && unread > lastUnread) toast('🔔 ' + notifications[0].title);
      lastUnread = unread;
    } catch { /* ignore */ }
    setTimeout(pollBell, 20000);
  }

  // Get a position from the browser. Resolves {lat,lng} or rejects.
  const locate = () => new Promise((ok, no) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => ok({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }), () => no(new Error('Location permission denied. Enter coordinates manually.'))) : no(new Error('Location is not supported in this browser.')));

  // Resize a chosen image to a small JPEG data-URL
  const readImage = (file, max = 640) => new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .72));
    }; img.onerror = () => no(new Error('Could not read this image.')); img.src = r.result; };
    r.onerror = () => no(new Error('Could not read this file.')); r.readAsDataURL(file);
  });

  const statusBadge = s => ({ reserved: 'badge', collected: 'badge green', cancelled: 'badge grey', expired: 'badge red', requested: 'badge', accepted: 'badge green', declined: 'badge grey', active: 'badge green', claimed: 'badge green', ended: 'badge grey', withdrawn: 'badge grey' }[s] || 'badge');
  const toLocalInput = d => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 16); };

  return { api, user, token, setAuth, logout, init, esc, money, clock, dateTime, left, toast, modal, listingCard, locate, readImage, statusBadge, toLocalInput, home, CATEGORIES, CAT_ICON, DEFAULT_CENTER };
})();
