(() => {
  const history = [];
  const messages = document.querySelector('#messages');
  const form = document.querySelector('#form');
  const input = document.querySelector('#input');
  const provider = document.querySelector('#provider');
  const model = document.querySelector('#model');
  function render(role, content) { const el = document.createElement('div'); el.className = `bubble ${role}`; el.textContent = content; messages.appendChild(el); messages.scrollTop = messages.scrollHeight; }
  form.addEventListener('submit', async (event) => { event.preventDefault(); const message = input.value.trim(); if (!message) return; input.value = ''; render('user', message); history.push({ role: 'user', content: message }); const button = form.querySelector('button'); button.disabled = true;
    try { const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, history: history.slice(0, -1), provider: provider.value, model: model.value.trim() || undefined }) }); const data = await response.json(); const reply = data.reply || data.error || 'ไม่พบคำตอบ'; render('assistant', reply); history.push({ role: 'assistant', content: reply }); } catch { render('assistant', 'เกิดข้อผิดพลาดในการเชื่อมต่อ backend'); } finally { button.disabled = false; input.focus(); }
  });
})();