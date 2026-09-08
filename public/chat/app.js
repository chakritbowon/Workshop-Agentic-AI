(() => {
  const history = [];
  const messages = document.querySelector('#messages');
  const welcome = document.querySelector('#welcome');
  const form = document.querySelector('#form');
  const input = document.querySelector('#input');
  const provider = document.querySelector('#provider');
  const model = document.querySelector('#model');

  function render(role, content) {
    welcome?.remove();
    const el = document.createElement('div');
    el.className = `bubble ${role}`;
    el.textContent = content;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function setBusy(busy) {
    const button = form.querySelector('button');
    button.disabled = busy;
    button.textContent = busy ? '…' : '↑';
  }

  async function sendMessage() {
    const message = input.value.trim();
    if (!message || form.querySelector('button').disabled) return;
    input.value = '';
    input.style.height = 'auto';
    render('user', message);
    history.push({ role: 'user', content: message });
    setBusy(true);
    const loading = render('assistant', 'กำลังคิด…');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, history: history.slice(0, -1), provider: provider.value, model: model.value.trim() || undefined }) });
      const data = await response.json();
      const reply = data.reply || data.error || 'ไม่พบคำตอบ';
      loading.textContent = reply;
      history.push({ role: 'assistant', content: reply });
    } catch {
      loading.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ backend';
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); sendMessage(); });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; });
  input.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); sendMessage(); }
  });
})();