FS.init();
const $ = id => document.getElementById(id);
document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { $('email').value = b.dataset.e; $('pw').value = b.dataset.p; });
$('f').onsubmit = async e => {
  e.preventDefault(); $('err').classList.add('hidden'); $('btn').disabled = true;
  try {
    const { token, user } = await FS.api('/auth/login', { method: 'POST', body: { email: $('email').value, password: $('pw').value } });
    FS.setAuth(token, user);
    const next = new URLSearchParams(location.search).get('next');
    location.href = next && next.startsWith('/') ? next : FS.home(user.role);
  } catch (err) { $('err').textContent = err.message; $('err').classList.remove('hidden'); $('btn').disabled = false; }
};
