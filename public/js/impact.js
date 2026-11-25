const $ = id => document.getElementById(id);
const k = (v, l, c = '') => `<div class="kpi ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
const bars = (el, labelEl, cols, max) => {
  el.innerHTML = cols.map(c => `<div class="col" title="${FS.esc(c.title)}">${c.parts.map(p => `<div class="bar ${p.cls}" style="height:${max ? (p.v / max) * 100 : 0}%"></div>`).join('')}</div>`).join('');
  labelEl.innerHTML = cols.map(c => `<span>${FS.esc(c.label)}</span>`).join('');
};

async function loadAdmin() {
  const { orgs } = await FS.api('/admin/orgs');
  $('orgs').innerHTML = orgs.map(o => `<tr><td><strong>${FS.esc(o.name)}</strong><div class="small muted">${FS.esc(o.email)}</div></td><td>${o.role === 'ngo' ? 'NGO' : FS.esc(o.businessType)}</td><td>${FS.esc(o.address)}</td><td>${FS.esc(o.registrationNo || '—')}</td>
    <td><span class="badge ${o.verified ? 'green' : 'red'}">${o.verified ? 'Verified' : 'Pending'}</span></td>
    <td><button class="btn sm ${o.verified ? 'outline' : 'green'}" data-v="${o.id}" data-val="${!o.verified}">${o.verified ? 'Revoke' : 'Verify'}</button></td></tr>`).join('');
}

FS.init({ roles: ['customer', 'business', 'ngo', 'admin'] }).then(async u => {
  if (!u) return;
  const { metrics: m } = await FS.api('/insights/impact');
  const titles = { customer: ['My impact', 'What you have saved and rescued.'], business: ['Impact & insights', 'Sales, donations and surplus patterns for your business.'], ngo: ['My impact', 'Donations your organisation has collected.'], admin: ['Platform impact', 'All businesses, customers and NGO partners.'] }[u.role];
  $('h').textContent = titles[0]; $('sub').textContent = titles[1];
  const set = {
    customer: k(m.ordersCompleted, 'orders collected', 'red') + k(FS.money(m.customerSavings), 'saved vs full price', 'green') + k(m.soldQty, 'portions rescued') + k('~' + m.estimatedKgRescued + ' kg', 'food rescued (estimate)'),
    business: k(FS.money(m.revenueRecovered), 'revenue recovered', 'red') + k(m.soldQty, 'portions sold') + k(m.donatedQty, 'portions donated', 'green') + k(m.collectionRate == null ? '—' : m.collectionRate + '%', 'of listed food collected') + k(FS.money(m.customerSavings), 'customer savings') + k('~' + m.estimatedKgRescued + ' kg', 'food rescued (estimate)'),
    ngo: k(m.donationsCompleted, 'collections completed', 'green') + k(m.donatedQty, 'portions received') + k('~' + m.estimatedKgRescued + ' kg', 'food redistributed (estimate)'),
    admin: k(m.ordersCompleted, 'orders completed', 'red') + k(m.soldQty, 'portions sold') + k(m.donatedQty, 'portions donated', 'green') + k(FS.money(m.revenueRecovered), 'sales value') + k(FS.money(m.platformCommission), 'platform commission') + k(m.collectionRate == null ? '—' : m.collectionRate + '%', 'listed food collected') + k('~' + m.estimatedKgRescued + ' kg', 'food rescued (estimate)')
  }[u.role];
  $('kpis').innerHTML = set;
  const max = Math.max(1, ...m.series.map(s => s.sold + s.donated));
  bars($('chart'), $('labels'), m.series.map(s => ({ label: s.date.slice(8), title: `${s.date}: ${s.sold} sold, ${s.donated} donated`, parts: [{ cls: 'donated', v: s.donated }, { cls: 'sold', v: s.sold }] })), max);
  $('note').textContent = m.estimateNote + ' Sold and donated food are recorded separately.';

  if (['business', 'admin'].includes(u.role)) {
    const t = await FS.api('/insights/trends'); $('trends').classList.remove('hidden');
    const wm = Math.max(1, ...t.byWeekday.map(d => d.avgUnsold));
    bars($('wchart'), $('wlabels'), t.byWeekday.map(d => ({ label: d.day.slice(0, 3), title: `${d.day}: ${d.avgUnsold} unsold on average (${d.listings} listings)`, parts: [{ cls: 'unsold', v: d.avgUnsold }] })), wm);
    $('tips').innerHTML = t.enough ? `<ul>${t.tips.map(x => `<li style="margin-bottom:.5rem">${FS.esc(x)}</li>`).join('') || '<li>No clear surplus pattern yet.</li>'}</ul>` : `<p class="muted">${FS.esc(t.message)}</p>`;
    $('disc').textContent = t.disclaimer || '';
  }
  if (u.role === 'admin') {
    $('admin').classList.remove('hidden'); loadAdmin();
    $('orgs').addEventListener('click', async e => { const id = e.target.dataset.v; if (!id) return;
      try { await FS.api(`/admin/orgs/${id}/verify`, { method: 'POST', body: { verified: e.target.dataset.val === 'true' } }); loadAdmin(); } catch (err) { FS.toast(err.message, 'err'); } });
  }
}).catch(e => FS.toast(e.message, 'err'));
