const $ = id => document.getElementById(id);
let me = null, pos = JSON.parse(sessionStorage.getItem('fs_pos') || 'null');
let items = [];
FS.CATEGORIES.forEach(c => $('cat').insertAdjacentHTML('beforeend', `<option>${c}</option>`));

async function load() {
  const q = new URLSearchParams({ radius: $('radius').value, category: $('cat').value, sort: $('sort').value });
  if ($('search').value) q.set('search', $('search').value);
  if ($('price').value < 1000) q.set('maxPrice', $('price').value);
  if ($('within').value) q.set('withinMinutes', $('within').value);
  if (pos) { q.set('lat', pos.lat); q.set('lng', pos.lng); }
  try {
    items = (await FS.api('/listings?' + q)).listings;
    $('list').innerHTML = items.length ? items.map(l => FS.listingCard(l, { action: `<button class="btn sm" data-id="${l.id}">Reserve</button>` })).join('')
      : `<div class="card"><h3>No food matches right now</h3><p class="muted">Try a larger distance or clear a filter. New listings appear throughout the day.</p></div>`;
  } catch (e) { FS.toast(e.message, 'err'); }
}

let t; const reload = () => { clearTimeout(t); t = setTimeout(load, 250); };
['search', 'radius', 'cat', 'price', 'within', 'sort'].forEach(id => $(id).addEventListener('input', () => {
  $('rv').textContent = $('radius').value; $('pv').textContent = $('price').value >= 1000 ? 'Any' : 'Rs. ' + $('price').value; reload(); }));
$('geo').onclick = async () => { try { pos = await FS.locate(); sessionStorage.setItem('fs_pos', JSON.stringify(pos)); FS.toast('Showing food near you', 'ok'); load(); } catch (e) { FS.toast(e.message, 'err'); } };

$('list').addEventListener('click', e => {
  const b = e.target.closest('[data-id]'); if (!b) return;
  const l = items.find(x => x.id === b.dataset.id);
  if (!me) { location.href = '/login.html?next=/marketplace.html'; return; }
  if (me.role !== 'customer') return FS.toast('Only customer accounts can reserve food.', 'err');
  const m = FS.modal(`<h2>Reserve ${FS.esc(l.title)}</h2>
    <p class="muted">${FS.esc(l.businessName)} · ${FS.esc(l.address)}<br>Collect by <strong>${FS.clock(l.pickupEnd)}</strong>. Unclaimed food is released after the deadline.</p>
    ${l.storageInfo ? `<div class="notice small" style="margin-bottom:1rem"><strong>Handling:</strong> ${FS.esc(l.storageInfo)}${l.allergens ? `<br><strong>Allergens:</strong> ${FS.esc(l.allergens)}` : ''}</div>` : ''}
    <div class="field"><label for="qty">Portions (max ${Math.min(5, l.remaining)})</label><input id="qty" type="number" min="1" max="${Math.min(5, l.remaining)}" value="1"></div>
    <div class="field"><label for="pay">Payment</label><select id="pay"><option value="pay_at_pickup">Pay at pickup</option><option value="card_demo">Card (demo payment)</option></select></div>
    <p class="price" id="tot"></p><div id="merr" class="error-box hidden"></div>
    <div class="row"><button class="btn" id="go">Confirm reservation</button><button class="btn outline" data-close>Cancel</button></div>`);
  const upd = () => m.el.querySelector('#tot').textContent = 'Total ' + FS.money(l.price * (+m.el.querySelector('#qty').value || 1));
  m.el.querySelector('#qty').oninput = upd; upd();
  m.el.querySelector('#go').onclick = async () => {
    try {
      const { order } = await FS.api('/orders', { method: 'POST', body: { listingId: l.id, qty: +m.el.querySelector('#qty').value, paymentMethod: m.el.querySelector('#pay').value } });
      m.el.innerHTML = `<h2>Reserved! 🎉</h2><p>Show this code at <strong>${FS.esc(l.businessName)}</strong> before ${FS.clock(l.pickupEnd)}:</p>
        <p><span class="code">${order.pickupCode}</span></p><p class="muted">${order.qty} × ${FS.esc(l.title)} · ${FS.money(order.total)} (${order.paymentStatus})</p>
        <div class="row"><a class="btn" href="/orders.html">View my orders</a><button class="btn outline" data-close>Close</button></div>`;
      load();
    } catch (err) { const x = m.el.querySelector('#merr'); x.textContent = err.message; x.classList.remove('hidden'); }
  };
});

(async () => { me = await FS.init(); if (me && !pos) pos = { lat: me.lat, lng: me.lng }; load(); })();
