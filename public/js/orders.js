const $ = id => document.getElementById(id);
async function load() {
  const { orders } = await FS.api('/orders/mine');
  const saved = orders.filter(o => o.status === 'collected').reduce((s, o) => s + (o.unitOriginal - o.unitPrice) * o.qty, 0);
  $('sum').textContent = saved ? `You have saved ${FS.money(saved)} so far. Thank you for rescuing food!` : 'Your reservations and pickup codes.';
  $('list').innerHTML = orders.length ? orders.map(o => { const l = o.listing || {}; const live = o.status === 'reserved';
    return `<div class="card"><div class="row between"><div><h3 style="margin:0">${FS.esc(l.title)}</h3><div class="muted small">${FS.esc(l.businessName)} · ${FS.esc(l.address)}</div></div><span class="${FS.statusBadge(o.status)}">${o.status}</span></div>
      <div class="meta"><span>${o.qty} × ${FS.money(o.unitPrice)} = <strong>${FS.money(o.total)}</strong></span><span>${o.paymentStatus}</span><span>Ordered ${FS.dateTime(o.createdAt)}</span></div>
      ${live ? `<div class="row between"><div>Pickup code <span class="code">${o.pickupCode}</span></div><div class="row"><span class="timer" data-until="${l.pickupEnd}">${FS.left(l.pickupEnd)}</span><button class="btn outline sm" data-cancel="${o.id}">Cancel</button></div></div>` : ''}</div>`; }).join('')
    : `<div class="card"><h3>No orders yet</h3><p class="muted">Find discounted food near you and reserve it in a few taps.</p><a class="btn" href="/marketplace.html">Find food</a></div>`;
}
$('list').addEventListener('click', async e => {
  const id = e.target.dataset.cancel; if (!id || !confirm('Cancel this reservation?')) return;
  try { await FS.api(`/orders/${id}/cancel`, { method: 'POST' }); FS.toast('Reservation cancelled', 'ok'); load(); } catch (err) { FS.toast(err.message, 'err'); }
});
FS.init({ roles: ['customer'] }).then(u => u && load());
