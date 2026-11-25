const $ = id => document.getElementById(id);
FS.init({ roles: ['customer', 'business', 'ngo', 'admin'] }).then(async () => {
  const { user: u } = await FS.api('/auth/me');
  ['name', 'phone', 'email', 'address', 'lat', 'lng'].forEach(k => $(k).value = u[k] ?? '');
  $('radius').value = u.radiusKm; $('rv').textContent = u.radiusKm;
  const cust = u.role === 'customer';
  $('optBox').classList.toggle('hidden', !cust); $('catBox').classList.toggle('hidden', !cust);
  $('addrBox').classList.toggle('hidden', cust); $('alerts').classList.toggle('hidden', !['customer', 'ngo'].includes(u.role));
  $('optin').checked = u.optIn;
  $('cats').innerHTML = FS.CATEGORIES.map(c => `<label class="chip ${u.categories.includes(c) ? 'on' : ''}"><input type="checkbox" value="${c}" ${u.categories.includes(c) ? 'checked' : ''} hidden>${FS.CAT_ICON[c]} ${c}</label>`).join('');
  $('cats').addEventListener('change', e => e.target.parentElement.classList.toggle('on', e.target.checked));
  $('radius').oninput = () => $('rv').textContent = $('radius').value;
  $('geo').onclick = async () => { try { const p = await FS.locate(); $('lat').value = p.lat; $('lng').value = p.lng; } catch (e) { FS.toast(e.message, 'err'); } };
  $('f').onsubmit = async e => {
    e.preventDefault();
    try {
      const { user } = await FS.api('/auth/me', { method: 'PUT', body: { name: $('name').value, phone: $('phone').value, address: $('address').value, lat: $('lat').value, lng: $('lng').value, radiusKm: $('radius').value, optIn: $('optin').checked, categories: [...document.querySelectorAll('#cats input:checked')].map(i => i.value) } });
      FS.setAuth(FS.token(), user); FS.toast('Settings saved', 'ok');
    } catch (err) { FS.toast(err.message, 'err'); }
  };
});
