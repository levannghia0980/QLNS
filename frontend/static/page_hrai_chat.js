/* ═══════════════════════════════════════════════
   PAGE: HRAI CHAT & EXCEL GENERATOR (hrai-chat)
   ═══════════════════════════════════════════════ */

let HRAI_CHAT_MESSAGES = [];

async function renderHraiChatPage(area) {
  area = area || document.getElementById('page-hrai-chat');
  if (!area) return;

  area.innerHTML = `
<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
  <div>
    <h4 class="fw-bold mb-1 text-danger">
      <i class="bi bi-robot me-2"></i>Trợ Lý AI HR (Hỏi Đáp & Xuất Excel)
    </h4>
    <p class="text-muted small mb-0">Hỏi đáp thông tin nhân sự, thực tập sinh, lịch làm việc, OT bằng ngôn ngữ tự nhiên. Tự động phân tích và tạo file Excel (.xlsx) theo yêu cầu.</p>
  </div>
  <div class="d-flex gap-2">
    <button class="btn btn-sm btn-outline-danger shadow-sm" onclick="clearHraiChatHistory()">
      <i class="bi bi-trash me-1"></i>Xóa lịch sử chat
    </button>
  </div>
</div>

<!-- SUGGESTION CHIPS -->
<div class="mb-3">
  <div class="small text-muted mb-2 fw-semibold"><i class="bi bi-lightbulb-fill text-warning me-1"></i>Gợi ý câu hỏi & Tạo file Excel nhanh:</div>
  <div class="d-flex flex-wrap gap-2">
    <button class="btn btn-xs btn-outline-danger rounded-pill" onclick="submitSuggestedHraiQuestion('Thống kê số lượng nhân sự theo từng vị trí và tạo file Excel')">
      📊 Xuất danh sách nhân sự theo vị trí ra Excel
    </button>
    <button class="btn btn-xs btn-outline-secondary rounded-pill" onclick="submitSuggestedHraiQuestion('Có nhân viên nào trùng ngày sinh với nhau không?')">
      🎂 Kiểm tra nhân sự trùng ngày sinh
    </button>
    <button class="btn btn-xs btn-outline-danger rounded-pill" onclick="submitSuggestedHraiQuestion('Danh sách thực tập sinh đăng ký lịch làm việc T8 và xuất file Excel')">
      ⏰ Lịch làm việc TTS T8 (Excel)
    </button>
    <button class="btn btn-xs btn-outline-secondary rounded-pill" onclick="submitSuggestedHraiQuestion('Danh sách nhân sự đã nghỉ việc hoặc thử việc')">
      👥 Nhân sự nghỉ việc / Thử việc
    </button>
    <button class="btn btn-xs btn-outline-danger rounded-pill" onclick="submitSuggestedHraiQuestion('Tạo file Excel tổng hợp các đăng ký OT làm thêm giờ')">
      📝 Tạo file Excel tổng hợp đăng ký OT
    </button>
  </div>
</div>

<!-- CHAT CONTAINER -->
<div class="glass-card d-flex flex-column" style="height: calc(100vh - 270px); min-height: 500px;">
  <!-- Chat History Viewport -->
  <div id="hrai-chat-viewport" class="flex-grow-1 p-4 overflow-y-auto" style="scroll-behavior: smooth;">
    <!-- Welcome Message -->
    <div class="d-flex gap-3 mb-4" id="hrai-welcome-card">
      <div class="avatar rounded-circle bg-danger text-white d-flex align-items-center justify-content-center shadow-sm" style="width: 42px; height: 42px; flex-shrink: 0;">
        <i class="bi bi-robot fs-5"></i>
      </div>
      <div class="glass-card p-3 border-start border-danger border-4 shadow-sm" style="max-width: 85%;">
        <h6 class="fw-bold text-danger mb-1"><i class="bi bi-stars me-1"></i>Xin chào! Tôi là Trợ lý AI HR (HrAi)</h6>
        <p class="small text-muted mb-2">Tôi có thể giúp bạn trả lời tất cả các câu hỏi về hồ sơ nhân sự, thực tập sinh, bảng lịch làm việc, đăng ký OT, cũng như <strong>tự động tạo và xuất file Excel (.xlsx)</strong> từ bất kỳ yêu cầu nào!</p>
        <div class="small text-secondary">
          <i class="bi bi-check-circle-fill text-success me-1"></i>Hỏi thông tin tự nhiên (VD: <em>"Ai làm vị trí BA ở dự án Cho mượn?"</em>)<br>
          <i class="bi bi-check-circle-fill text-success me-1"></i>Yêu cầu xuất Excel (VD: <em>"Tạo file Excel danh sách nhân sự Dev"</em>)
        </div>
      </div>
    </div>

    <!-- Dynamic Messages Rendered Here -->
    <div id="hrai-chat-messages-box"></div>
  </div>

  <!-- Chat Input Footer -->
  <div class="p-3 border-top bg-white bg-opacity-75 rounded-bottom">
    <form id="form-hrai-chat-full" onsubmit="handleSendHraiChat(event)">
      <div class="input-group">
        <input type="text" id="hrai-chat-input-full" class="form-control form-control-lg border-danger-subtle fs-6" placeholder="Nhập câu hỏi hoặc yêu cầu tạo file Excel (VD: Xuất file Excel danh sách thực tập sinh)..." autocomplete="off" required />
        <button type="submit" class="btn btn-danger px-4" id="btn-send-hrai-chat">
          <span class="btn-text d-flex align-items-center"><i class="bi bi-send-fill me-2"></i>Gửi câu hỏi</span>
          <span class="btn-spinner d-none"><span class="spinner-border spinner-border-sm me-2"></span>Đang xử lý...</span>
        </button>
      </div>
    </form>
  </div>
</div>
`;

  renderHraiChatMessages();
}

function clearHraiChatHistory() {
  HRAI_CHAT_MESSAGES = [];
  renderHraiChatMessages();
  toast('Đã xóa lịch sử chat');
}

function submitSuggestedHraiQuestion(qText) {
  const input = document.getElementById('hrai-chat-input-full');
  if (input) {
    input.value = qText;
    document.getElementById('form-hrai-chat-full').dispatchEvent(new Event('submit'));
  }
}

function renderHraiChatMessages() {
  const box = document.getElementById('hrai-chat-messages-box');
  if (!box) return;

  if (HRAI_CHAT_MESSAGES.length === 0) {
    box.innerHTML = '';
    return;
  }

  let html = '';
  HRAI_CHAT_MESSAGES.forEach((msg, idx) => {
    if (msg.role === 'user') {
      html += `
<div class="d-flex justify-content-end mb-4">
  <div class="bg-danger text-white p-3 rounded-4 shadow-sm" style="max-width: 75%; border-bottom-end-radius: 4px !important;">
    <div class="fw-semibold small mb-1"><i class="bi bi-person-fill me-1"></i>Bạn</div>
    <div>${escapeHtml(msg.text)}</div>
  </div>
</div>`;
    } else {
      // AI Response
      const res = msg.response || {};
      const dataRows = res.data || [];
      const hasData = Array.isArray(dataRows) && dataRows.length > 0;
      const sqlQuery = res.sql || (res.metadata && res.metadata.sql) || '';

      let dataTableHtml = '';
      if (hasData) {
        const cols = Object.keys(dataRows[0]);
        dataTableHtml = `
<div class="table-responsive border rounded my-2" style="max-height: 350px;">
  <table class="table table-sm table-striped table-hover mb-0 align-middle">
    <thead class="table-danger sticky-top">
      <tr>
        <th style="width:40px">#</th>
        ${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${dataRows.map((r, rIdx) => `
        <tr>
          <td class="text-muted small font-monospace">${rIdx + 1}</td>
          ${cols.map(c => `<td>${r[c] != null ? escapeHtml(String(r[c])) : '—'}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>`;
      }

      let sqlDetailsHtml = '';
      if (sqlQuery) {
        sqlDetailsHtml = `
<details class="my-2">
  <summary class="small text-muted cursor-pointer"><i class="bi bi-code-slash me-1"></i>Xem truy vấn SQL của AI</summary>
  <pre class="bg-dark text-warning p-2 rounded small mt-1 mb-0"><code>${escapeHtml(sqlQuery)}</code></pre>
</details>`;
      }

      let excelButtonHtml = '';
      if (hasData || sqlQuery) {
        excelButtonHtml = `
<div class="mt-3 pt-2 border-top d-flex justify-content-between align-items-center">
  <span class="small text-muted"><i class="bi bi-info-circle me-1"></i>Tìm thấy <strong>${dataRows.length}</strong> kết quả phù hợp</span>
  <button class="btn btn-sm btn-outline-success shadow-sm fw-semibold" onclick="downloadHraiChatExcel(${idx})">
    <i class="bi bi-file-earmark-excel-fill me-1"></i>Tạo & Tải File Excel (.xlsx)
  </button>
</div>`;
      }

      html += `
<div class="d-flex gap-3 mb-4">
  <div class="avatar rounded-circle bg-danger text-white d-flex align-items-center justify-content-center shadow-sm" style="width: 42px; height: 42px; flex-shrink: 0;">
    <i class="bi bi-robot fs-5"></i>
  </div>
  <div class="glass-card p-3 border-start border-danger border-4 shadow-sm" style="max-width: 85%;">
    <div class="fw-bold text-danger small mb-1"><i class="bi bi-stars me-1"></i>Trợ lý AI HR</div>
    <div class="text-dark mb-2" style="white-space: pre-line;">${escapeHtml(res.text || '')}</div>
    ${sqlDetailsHtml}
    ${dataTableHtml}
    ${excelButtonHtml}
  </div>
</div>`;
    }
  });

  box.innerHTML = html;
  const viewport = document.getElementById('hrai-chat-viewport');
  if (viewport) viewport.scrollTop = viewport.scrollHeight;
}

async function handleSendHraiChat(e) {
  e.preventDefault();
  const input = document.getElementById('hrai-chat-input-full');
  const question = input.value.trim();
  if (!question) return;

  const btn = document.getElementById('btn-send-hrai-chat');
  btn.querySelector('.btn-text').classList.add('d-none');
  btn.querySelector('.btn-spinner').classList.remove('d-none');
  btn.disabled = true;

  HRAI_CHAT_MESSAGES.push({ role: 'user', text: question });
  renderHraiChatMessages();
  input.value = '';

  try {
    const res = await api('POST', '/api/chat', { question: question });
    HRAI_CHAT_MESSAGES.push({ role: 'ai', response: res });
    renderHraiChatMessages();

    // Check if user specifically requested excel export
    const qLower = question.toLowerCase();
    if (qLower.includes('excel') || qLower.includes('xuất file') || qLower.includes('tạo file')) {
      const lastMsgIdx = HRAI_CHAT_MESSAGES.length - 1;
      toast('Đang tạo file Excel theo yêu cầu của bạn...', 'bg-success text-white');
      setTimeout(() => {
        downloadHraiChatExcel(lastMsgIdx);
      }, 500);
    }

  } catch (err) {
    HRAI_CHAT_MESSAGES.push({
      role: 'ai',
      response: { text: `Xin lỗi, đã xảy ra lỗi: ${err.message}`, data: [], sql: null }
    });
    renderHraiChatMessages();
  } finally {
    btn.querySelector('.btn-text').classList.remove('d-none');
    btn.querySelector('.btn-spinner').classList.add('d-none');
    btn.disabled = false;
  }
}

async function downloadHraiChatExcel(msgIndex) {
  const msg = HRAI_CHAT_MESSAGES[msgIndex];
  if (!msg || !msg.response) {
    toast('Không có dữ liệu để xuất Excel', 'bg-warning text-dark');
    return;
  }

  const res = msg.response;
  const payload = {
    title: "Bao_Cao_Dau_Ra_HrAi",
    sql: res.sql || (res.metadata && res.metadata.sql) || null,
    data: res.data || null
  };

  try {
    toast('Đang tạo file Excel (.xlsx)...');
    const token = localStorage.getItem('token');
    const response = await fetch('/api/chat/export-excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Lỗi khi tạo file Excel');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `HrAi_Report_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    toast('Đã tải xuống file Excel (.xlsx) thành công!');

  } catch (err) {
    toast(err.message, 'bg-danger text-white');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
