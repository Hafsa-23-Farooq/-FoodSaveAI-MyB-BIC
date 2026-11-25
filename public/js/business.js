const $ = id => document.getElementById(id);
let me, photo = '', myListings = [];
const iso = v => v ? new Date(v).toISOString() : '';

function tab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.t === name));
  ['listings', 'new', 'orders', 'donations'].forEach(s => $(s).classList.toggle('hidden', s !== name));
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => tab(t.dataset.t));
$('newBtn').onclick = () => tab('new');

async function kpis() {
  const { metrics: m } = await FS.api('/insights/impact');
  const k = (v, l, c = '') => `<div class="kpi ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  $('kpis').innerHTML = k(FS.money(m.revenueRecovered), 'revenue recovered', 'red') + k(m.soldQty, 'portions sold') + k(m.donatedQty, 'portions donated', 'green') + k(m.collectionRate == null ? '—' : m.collectionRate + '%', 'of listed food collected');
}

async function loadListings() {
  myListings = (await FS.api('/listings/mine')).listings;
  $('lbody').innerHTML = myListings.length ? myListings.map(l => `<tr><td><strong>${FS.esc(l.title)}</strong><div class="small muted">${FS.esc(l.category)}</div></td>
    <td>${l.type === 'donation' ? '<span class="badge green">Donation</span>' : 'Sale'}</td><td>${l.type === 'donation' ? 'Free' : FS.money(l.price)}</td>
    <td>${l.remaining} / ${l.quantity}${l.reservedQty ? `<div class="small muted">${l.reservedQty} reserved</div>` : ''}</td><td>${FS.dateTime(l.pickupEnd)}</td>
    <td><span class="${FS.statusBadge(l.status)}">${l.status}</span></td>
    <td>${l.status === 'active' ? `<div class="row" style="gap:.3rem"><button class="btn sm outline" data-edit="${l.id}">Edit</button>${l.type === 'sale' && l.remaining ? `<button class="btn sm green" data-donate="${l.id}">Donate rest</button>` : ''}<button class="btn sm outline" data-withdraw="${l.id}">Withdraw</button></div>` : ''}</td></tr>`).join('')
    : '<tr><td colspan="7" class="muted">No listings yet. Use “New listing” to publish your first surplus item.</td></tr>';
}

async function loadOrders() {
  const { orders } = await FS.api('/orders/business');
  $('oc').textContent = orders.filter(o => o.status === 'reserved').length || '';
  $('obody').innerHTML = orders.length ? orders.map(o => `<tr><td>${FS.esc(o.customerName)}</td><td>${FS.esc(o.listing?.title)}</td><td>${o.qty}</td><td>${FS.money(o.total)}</td><td>${o.paymentStatus}</td><td><span class="${FS.statusBadge(o.status)}">${o.status}</span></td>
    <td>${o.status === 'reserved' ? `<div class="row" style="gap:.3rem;flex-wrap:nowrap"><input style="width:90px" placeholder="Code" maxlength="4" id="c_${o.id}"><button class="btn sm" data-collect="${o.id}">Confirm</button></div>` : ''}</td></tr>`).join('')
    : '<tr><td colspan="7" class="muted">No reservations yet.</td></tr>';
}

async function loadDonations() {
  const { donations } = await FS.api('/donations/business');
  $('dc').textContent = donations.filter(d => d.status === 'requested').length || '';
  $('donations').innerHTML = donations.length ? donations.map(d => `<div class="card"><div class="row between"><div><h3 style="margin:0">${FS.esc(d.listing?.title)}</h3><div class="small muted">Requested by <strong>${FS.esc(d.ngoName)}</strong>${d.eta ? ' · ETA ' + FS.esc(d.eta) : ''}</div>${d.note ? `<div class="small">“${FS.esc(d.note)}”</div>` : ''}</div>
    <div class="row"><span class="${FS.statusBadge(d.status)}">${d.status}</span>
    ${d.status === 'requested' ? `<button class="btn green sm" data-accept="${d.id}">Accept</button><button class="btn outline sm" data-decline="${d.id}">Decline</button>` : ''}
    ${d.status === 'accepted' ? `<button class="btn sm" data-dcollect="${d.id}">Mark collected</button>` : ''}</div></div></div>`).join('')
    : '<div class="card"><p class="muted" style="margin:0">No donation requests yet. Publish a donation listing or use “Donate rest” on a discounted listing.</p></div>';
}

const refresh = () => Promise.all([kpis(), loadListings(), loadOrders(), loadDonations()]).catch(e => FS.toast(e.message, 'err'));

document.body.addEventListener('click', async e => {
  const d = e.target.dataset; if (!d) return;
  try {
    if (d.withdraw && confirm('Withdraw this listing? Reservations will be cancelled.')) { await FS.api(`/listings/${d.withdraw}/withdraw`, { method: 'POST' }); FS.toast('Listing withdrawn', 'ok'); refresh(); }
    if (d.donate && confirm('Offer the remaining portions to NGO partners for free?')) { const r = await FS.api(`/listings/${d.donate}/donate`, { method: 'POST' }); FS.toast(`Offered to NGOs · ${r.notified} alerted`, 'ok'); refresh(); }
    if (d.collect) { await FS.api(`/orders/${d.collect}/collect`, { method: 'POST', body: { code: $('c_' + d.collect).value } }); FS.toast('Handover confirmed', 'ok'); refresh(); }
    if (d.accept) { await FS.api(`/donations/${d.accept}/accept`, { method: 'POST' }); FS.toast('Donation accepted. The NGO has been told.', 'ok'); refresh(); }
    if (d.decline) { await FS.api(`/donations/${d.decline}/decline`, { method: 'POST' }); FS.toast('Request declined', 'ok'); refresh(); }
    if (d.dcollect) { await FS.api(`/donations/${d.dcollect}/collect`, { method: 'POST' }); FS.toast('Collection recorded', 'ok'); refresh(); }
    if (d.edit) {
      const l = myListings.find(x => x.id === d.edit);
      const m = FS.modal(`<h2>Edit ${FS.esc(l.title)}</h2>
        <div class="field"><label>Total quantity</label><input id="eq" type="number" value="${l.quantity}"></div>
        ${l.type === 'sale' ? `<div class="field"><label>Discounted price (Rs.)</label><input id="ep" type="number" value="${l.price}"></div>` : ''}
        <div class="row"><button class="btn" id="es">Save</button><button class="btn outline" data-close>Cancel</button></div>`);
      m.el.querySelector('#es').onclick = async () => {
        try { await FS.api(`/listings/${l.id}`, { method: 'PUT', body: { quantity: m.el.querySelector('#eq').value, ...(l.type === 'sale' ? { price: m.el.querySelector('#ep').value } : {}) } }); m.close(); FS.toast('Listing updated', 'ok'); refresh(); }
        catch (err) { FS.toast(err.message, 'err'); }
      };
    }
  } catch (err) { FS.toast(err.message, 'err'); }
});

// ---------- New listing form ----------
FS.CATEGORIES.forEach(c => $('category').insertAdjacentHTML('beforeend', `<option>${c}</option>`));
$('category').value = 'Meals';
$('pickupEnd').value = FS.toLocalInput(new Date(Date.now() + 3 * 3600e3));
function setType() {
  const don = document.querySelector('[name=type]:checked').value === 'donation';
  $('tSale').classList.toggle('on', !don); $('tDon').classList.toggle('on', don);
  document.querySelectorAll('.sale').forEach(x => x.classList.toggle('hidden', don));
}
document.querySelectorAll('[name=type]').forEach(r => r.onchange = setType);
$('photo').onchange = async e => { try { photo = e.target.files[0] ? await FS.readImage(e.target.files[0]) : ''; } catch (err) { FS.toast(err.message, 'err'); } };

$('aiCat').onclick = async () => {
  try { const r = await FS.api('/ai/categorize', { method: 'POST', body: { title: $('title').value, description: $('description').value } });
    $('category').value = r.category; FS.toast(r.confidence === 'none' ? 'No clear match. Please choose a category.' : `Suggested: ${r.category} (${r.confidence} confidence)`, 'ok'); } catch (e) { FS.toast(e.message, 'err'); }
};
$('aiPrice').onclick = async () => {
  const out = $('aiOut'); out.classList.remove('hidden'); out.textContent = 'Thinking…';
  try {
    const r = await FS.api('/ai/discount', { method: 'POST', body: { title: $('title').value, description: $('description').value, category: $('category').value, originalPrice: $('originalPrice').value, quantity: $('quantity').value, pickupEnd: iso($('pickupEnd').value), storageInfo: $('storageInfo').value, allergens: $('allergens').value, hasPhoto: !!photo } });
    out.innerHTML = `<div class="row between"><div><span class="price">${FS.money(r.suggestedPrice)}</span> <span class="badge red">${r.discountPct}% off</span></div><button type="button" class="btn sm" id="apply">Use this price</button></div>
      <ul style="margin:.5rem 0 0 1.1rem;padding:0">${r.reasons.map(x => `<li>${FS.esc(x)}</li>`).join('')}</ul>
      ${r.aiNote ? `<p style="margin:.5rem 0 0"><em>${FS.esc(r.aiNote)}</em></p>` : ''}
      ${r.flags.length ? `<div style="margin-top:.5rem"><strong>Needs review:</strong><ul style="margin:.2rem 0 0 1.1rem;padding:0">${r.flags.map(x => `<li>${FS.esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="muted" style="margin-top:.5rem">${FS.esc(r.label)} · ${r.poweredBy}</div>`;
    $('apply').onclick = () => { $('price').value = r.suggestedPrice; FS.toast('Price applied', 'ok'); };
  } catch (e) { out.innerHTML = `<span style="color:var(--tomato-deep);font-weight:700">${FS.esc(e.message)}</span>`; }
};

$('f').onsubmit = async e => {
  e.preventDefault(); $('ferr').classList.add('hidden'); $('pub').disabled = true;
  try {
    const r = await FS.api('/listings', { method: 'POST', body: {
      type: document.querySelector('[name=type]:checked').value, title: $('title').value, description: $('description').value, category: $('category').value,
      quantity: $('quantity').value, originalPrice: $('originalPrice').value, price: $('price').value, pickupEnd: iso($('pickupEnd').value),
      storageInfo: $('storageInfo').value, allergens: $('allergens').value, approvedStorage: $('approved').checked, safetyConfirmed: $('safe').checked, photo } });
    FS.toast(`Published. ${r.notified} ${r.audience} nearby alerted.`, 'ok');
    $('f').reset(); photo = ''; $('pickupEnd').value = FS.toLocalInput(new Date(Date.now() + 3 * 3600e3)); $('category').value = 'Meals'; $('aiOut').classList.add('hidden'); setType();
    tab('listings'); refresh();
  } catch (err) { $('ferr').textContent = err.message; $('ferr').classList.remove('hidden'); scrollTo({ top: 0, behavior: 'smooth' }); }
  $('pub').disabled = false;
};

FS.init({ roles: ['business'] }).then(u => { if (!u) return; me = u; $('hello').textContent = u.name; if (!u.verified) $('verify').classList.remove('hidden'); refresh(); });
