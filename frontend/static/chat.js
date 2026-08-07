/* =============================================
   CHAT ASSISTANT — HrAi Per-User History via localStorage
   ============================================= */

(function () {
  const toggleBtn = document.getElementById('chat-toggle-btn');
  const chatWidget = document.getElementById('chat-widget');
  const chatWindow = document.getElementById('chat-window');
  const closeBtn = document.getElementById('chat-close-btn');
  const chatForm = document.getElementById('form-chat');
  const chatInput = document.getElementById('chat-input');
  const chatBody = document.getElementById('chat-body');

  // ── Toggle open/close ──
  function toggleChat() {
    chatWindow.classList.toggle('d-none');
    if (!chatWindow.classList.contains('d-none')) {
      chatInput.focus();
    }
  }
  if (toggleBtn) toggleBtn.addEventListener('click', toggleChat);
  if (closeBtn) closeBtn.addEventListener('click', toggleChat);

  // ── Per-user storage key ──
  function storageKey() {
    return `chat_history_${STATE.userId || 'guest'}`;
  }

  // ── Persist messages ──
  function saveHistory(messages) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(messages));
    } catch (_) {}
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  // ── Render one message bubble ──
  function renderBubble(msg, animate = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${msg.type}`;
    if (animate) msgDiv.style.animation = 'fadeIn 0.3s ease';

    let sqlHtml = '';
    if (msg.sql) {
      sqlHtml = `
        <div class="chat-sql-block mt-2 p-2 bg-dark text-light rounded small">
          <div class="d-flex justify-content-between align-items-center mb-1 text-muted">
            <span><i class="bi bi-code-slash me-1"></i>Truy vấn SQL thực thi:</span>
          </div>
          <code>${msg.sql}</code>
        </div>`;
    }

    let dataHtml = '';
    if (msg.data && Array.isArray(msg.data) && msg.data.length > 0) {
      const cols = Object.keys(msg.data[0]);
      dataHtml = `
        <div class="chat-table-block mt-2 table-responsive border rounded bg-white text-dark">
          <table class="table table-sm table-striped mb-0 align-middle style="font-size: 0.8rem;">
            <thead class="table-danger">
              <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${msg.data.slice(0, 10).map(r => `<tr>${cols.map(c => `<td>${r[c] != null ? r[c] : '—'}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          ${msg.data.length > 10 ? `<div class="p-1 text-muted text-center small">Hiển thị 10 / ${msg.data.length} kết quả</div>` : ''}
        </div>`;
    }

    let metaHtml = '';
    if (msg.metadata && msg.metadata.execution_time_seconds) {
      metaHtml = `<div class="mt-1 text-end"><small class="text-muted" style="font-size:10px"><i class="bi bi-clock me-1"></i>${msg.metadata.execution_time_seconds}s</small></div>`;
    }

    const formatted = (msg.content || '').replace(/\n/g, '<br>');
    msgDiv.innerHTML = `<div class="message-content">${formatted}${sqlHtml}${dataHtml}${metaHtml}</div>`;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // ── Init: load history for current user ──
  window.initChat = function () {
    if (!chatWidget) return;
    chatWidget.classList.remove('d-none');

    chatBody.innerHTML = `
      <div class="chat-message ai-message">
        <div class="message-content">Xin chào <strong>${STATE.fullName || ''}</strong>! Tôi là trợ lý AI HR (HrAi). Bạn muốn tra cứu hay hỏi gì về nhân sự?</div>
      </div>`;

    const history = loadHistory();
    history.forEach(msg => renderBubble(msg));
  };

  // ── Destroy: hide widget & close window on logout ──
  window.destroyChat = function () {
    if (chatWidget) chatWidget.classList.add('d-none');
    if (chatWindow) chatWindow.classList.add('d-none');
  };

  // ── Send message ──
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      const userMsg = { type: 'user-message', content: text };
      renderBubble(userMsg, true);
      chatInput.value = '';
      chatInput.disabled = true;

      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'chat-message ai-message typing-indicator';
      loadingDiv.innerHTML = `<div class="message-content">
        <span class="spinner-grow spinner-grow-sm text-danger"></span>
        <span class="spinner-grow spinner-grow-sm text-danger ms-1"></span>
        <span class="spinner-grow spinner-grow-sm text-danger ms-1"></span>
      </div>`;
      chatBody.appendChild(loadingDiv);
      chatBody.scrollTop = chatBody.scrollHeight;

      try {
        const res = await fetch(API + '/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + STATE.token
          },
          body: JSON.stringify({ question: text, message: text })
        });
        const data = await res.json();
        chatBody.removeChild(loadingDiv);

        const aiMsg = {
          type: 'ai-message',
          content: res.ok ? (data.text || data.answer || 'Hoàn tất.') : ('Có lỗi xảy ra: ' + (data.detail || 'Lỗi server')),
          sql: res.ok ? data.sql : null,
          data: res.ok ? data.data : null,
          metadata: res.ok ? data.metadata : null
        };
        renderBubble(aiMsg, true);

        const history = loadHistory();
        history.push(userMsg, aiMsg);
        if (history.length > 100) history.splice(0, history.length - 100);
        saveHistory(history);

      } catch (err) {
        if (loadingDiv.parentNode) chatBody.removeChild(loadingDiv);
        const errMsg = { type: 'ai-message', content: 'Không thể kết nối đến máy chủ AI.' };
        renderBubble(errMsg, true);
      } finally {
        chatInput.disabled = false;
        chatInput.focus();
      }
    });
  }
})();
