FS.init();
const ht = document.getElementById('heroTimer');
ht.dataset.until = new Date(Date.now() + 133 * 60000).toISOString(); ht.textContent = FS.left(ht.dataset.until);

FS.api('/listings?limit=3&sort=ending').then(({ listings }) => {
  document.getElementById('preview').innerHTML = listings.length
    ? listings.map(l => FS.listingCard(l, { action: `<a class="btn sm" href="/marketplace.html">Reserve</a>` })).join('')
    : '<p class="muted">No live listings right now. Check back soon.</p>';
}).catch(() => {});

FS.api('/insights/public').then(m => {
  const k = (v, l, c = '') => `<div class="kpi ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  document.getElementById('impact').innerHTML = k(m.soldQty, 'portions sold', 'red') + k(m.donatedQty, 'portions donated', 'green') + k('~' + m.estimatedKgRescued + ' kg', 'food rescued (estimate)') + k(m.businesses + ' / ' + m.ngos, 'businesses / NGO partners');
  document.getElementById('impactNote').textContent = m.estimateNote + ' Sample data for the demo.';
}).catch(() => {});
