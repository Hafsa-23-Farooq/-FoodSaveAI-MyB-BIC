const $ = id => document.getElementById(id);
const ICON = { new_listing: '🍽️', donation_available: '🤝', donation: '🤝', order: '🧾', account: '✅' };
async function load() {
  const { notifications } = await FS.api('/notifications');
  $('list').innerHTML = notifications.length ? notifications.map(n => `<div class="notif ${n.read ? '' : 'unread'}"><div style="font-size:1.6rem">${ICON[n.type] || '🔔'}</div>
    <div><strong>${FS.esc(n.title)}</strong>${n.simulated ? ' <span class="badge">demo</span>' : ''}<div class="small">${FS.esc(n.body)}</div><div class="small muted">${FS.dateTime(n.createdAt)}</div></div></div>`).join('')
    : '<p class="muted" style="padding:1.2rem">No notifications yet. Customers who opt in receive alerts when new food is listed within their chosen radius.</p>';
}
FS.init({ roles: ['customer', 'business', 'ngo'] }).then(u => {
  if (!u) return;
  if (u.role === 'customer') $('sim').classList.remove('hidden');
  $('readAll').onclick = async () => { await FS.api('/notifications/read-all', { method: 'POST' }); load(); };
  $('sim').onclick = async () => { try { await FS.api('/notifications/simulate', { method: 'POST' }); FS.toast('Demo alert sent', 'ok'); load(); } catch (e) { FS.toast(e.message, 'err'); } };
  load();
});
