FS.init();
const $ = id => document.getElementById(id);
$('lat').value = FS.DEFAULT_CENTER.lat; $('lng').value = FS.DEFAULT_CENTER.lng;
const role = () => document.querySelector('[name=role]:checked').value;
function sync() {
  const r = role();
  $('nameLbl').textContent = r === 'customer' ? 'Full name' : r === 'business' ? 'Business name' : 'Organisation name';
  document.querySelectorAll('.only-customer').forEach(e => e.classList.toggle('hidden', r !== 'customer'));
  document.querySelectorAll('.only-org').forEach(e => e.classList.toggle('hidden', r === 'customer'));
  document.querySelectorAll('.only-business').forEach(e => e.classList.toggle('hidden', r !== 'business'));
  document.querySelectorAll('.only-ngo').forEach(e => e.classList.toggle('hidden', r !== 'ngo'));
  $('address').required = r !== 'customer';
}
document.querySelectorAll('[name=role]').forEach(r => r.onchange = sync);
const pre = new URLSearchParams(location.search).get('role');
if (['customer', 'business', 'ngo'].includes(pre)) document.querySelector(`[name=role][value=${pre}]`).checked = true;
sync();
$('radius').oninput = () => $('rv').textContent = $('radius').value;
$('geo').onclick = async () => { try { const p = await FS.locate(); $('lat').value = p.lat; $('lng').value = p.lng; FS.toast('Location added', 'ok'); } catch (e) { FS.toast(e.message, 'err'); } };
$('f').onsubmit = async e => {
  e.preventDefault(); $('err').classList.add('hidden'); $('btn').disabled = true;
  try {
    const { token, user } = await FS.api('/auth/register', { method: 'POST', body: {
      role: role(), name: $('name').value, phone: $('phone').value, email: $('email').value, password: $('pw').value,
      address: $('address').value, businessType: $('btype').value, registrationNo: $('regno').value,
      lat: $('lat').value, lng: $('lng').value, radiusKm: $('radius').value, optIn: $('optin').checked } });
    FS.setAuth(token, user); location.href = FS.home(user.role);
  } catch (err) { $('err').textContent = err.message; $('err').classList.remove('hidden'); $('btn').disabled = false; scrollTo(0, 0); }
};
