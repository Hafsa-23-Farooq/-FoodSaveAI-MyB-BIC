const $ = id => document.getElementById(id);
let items = [];
async function load() {
  items = (await FS.api('/donations/available')).listings;
  $('avail').innerHTML = items.length ? items.map(l => FS.listingCard(l, { action: l.requested ? '<span class="badge green">Requested</span>' : `<button class="btn green sm" data-id="${l.id}">Request</button>` })
    .replace('</article>', `<div class="small muted" style="padding:0 1rem 1rem"><strong>Handling:</strong> ${FS.esc(l.storageInfo)}${l.allergens ? `<br><strong>Allergens:</strong> ${FS.esc(l.allergens)}` : ''}</div></article>`)).join('')
    : '<div class="card"><h3>No donations available right now</h3><p class="muted">You will get a notification when a nearby business offers food.</p></div>';
  const { donations } = await FS.api('/donations/mine');
  $('mine').innerHTML = donations.length ? donations.map(d => `<div class="card"><div class="row between"><div><h3 style="margin:0">${FS.esc(d.listing?.title)}</h3><div class="muted small">${FS.esc(d.businessName)} · ${d.qty} portions</div></div><span class="${FS.statusBadge(d.status)}">${d.status}</span></div>
    ${['accepted', 'collected'].includes(d.status) ? `<p class="small" style="margin:.6rem 0 0"><strong>Collect from:</strong> ${FS.esc(d.listing.address)}${d.businessPhone ? ' · ' + FS.esc(d.businessPhone) : ''}<br><strong>Before:</strong> ${FS.dateTime(d.listing.pickupEnd)}</p>` : ''}</div>`).join('')
    : '<div class="card"><p class="muted" style="margin:0">You have not requested any donations yet.</p></div>';
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  $('avail').classList.toggle('hidden', t.dataset.t !== 'avail'); $('mine').classList.toggle('hidden', t.dataset.t !== 'mine');
});
$('avail').addEventListener('click', e => {
  const id = e.target.dataset.id; if (!id) return;
  const l = items.find(x => x.id === id);
  const m = FS.modal(`<h2>Request ${FS.esc(l.title)}</h2><p class="muted">${l.remaining} portions from ${FS.esc(l.businessName)}. Collect before ${FS.clock(l.pickupEnd)}.</p>
    <div class="field"><label for="eta">When can you collect?</label><input id="eta" placeholder="e.g. within 45 minutes"></div>
    <div class="field"><label for="note">Note to the business (optional)</label><textarea id="note"></textarea></div>
    <div class="row"><button class="btn green" id="go">Send request</button><button class="btn outline" data-close>Cancel</button></div>`);
  m.el.querySelector('#go').onclick = async () => {
    try { await FS.api('/donations/request', { method: 'POST', body: { listingId: id, eta: m.el.querySelector('#eta').value, note: m.el.querySelector('#note').value } }); m.close(); FS.toast('Request sent. The business will respond soon.', 'ok'); load(); }
    catch (err) { FS.toast(err.message, 'err'); }
  };
});
FS.init({ roles: ['ngo'] }).then(u => { if (!u) return; if (!u.verified) $('verify').classList.remove('hidden'); else load(); });
