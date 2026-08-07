/* ═══════════════════════════════════════════════
   PAGE: HRAI GEMINI AI CONFIGURATION
   ═══════════════════════════════════════════════ */

async function renderHraiSettings(area) {
  area.innerHTML = `
<div class="d-flex justify-content-between align-items-center mb-4">
  <div>
    <h4 class="fw-bold mb-1 text-danger"><i class="bi bi-robot me-2"></i>Cấu Hình Trợ Lý HrAi Gemini</h4>
    <p class="text-muted small mb-0">Quản lý Gemini API Key, mô hình AI mặc định và kiểm tra trạng thái kết nối trực tiếp.</p>
  </div>
</div>

<div class="row g-4">
  <!-- CONFIG CARD -->
  <div class="col-md-7">
    <div class="glass-card p-4">
      <h6 class="fw-bold text-dark mb-3"><i class="bi bi-sliders me-2 text-danger"></i>Thông Số Kết Nối AI</h6>
      <form id="form-hrai-settings" onsubmit="handleSaveHraiSettings(event)">
        <div class="mb-3">
          <label class="form-label fw-semibold">Gemini API Key</label>
          <div class="input-group">
            <input type="password" id="hrai-api-key" class="form-control" placeholder="AIzaSy..." required />
            <button type="button" class="btn btn-outline-secondary" onclick="togglePass('hrai-api-key', this)">
              <i class="bi bi-eye"></i>
            </button>
          </div>
          <div class="form-text">Khóa API được sử dụng để suy luận mô hình Gemini LLM và Embedding.</div>
        </div>

        <div class="mb-4">
          <label class="form-label fw-semibold">Mô Hình Gemini (LLM Model)</label>
          <select id="hrai-model" class="form-select">
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Tối ưu tốc độ, mặc định)</option>
            <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Phiên bản Gemini 3.5)</option>
          </select>
        </div>

        <div class="d-flex gap-2">
          <button type="submit" class="btn btn-danger px-4" id="btn-save-settings">
            <i class="bi bi-floppy-fill me-1"></i>Lưu Cài Đặt (.env)
          </button>
          <button type="button" class="btn btn-outline-danger" id="btn-test-key" onclick="handleTestSingleKey()">
            <i class="bi bi-speedometer me-1"></i>Kiểm Tra Kết Nối
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- TEST LATENCY DISPLAY -->
  <div class="col-md-5">
    <div class="glass-card p-4 h-100">
      <h6 class="fw-bold text-dark mb-3"><i class="bi bi-activity me-2 text-danger"></i>Trạng Thái & Độ Trễ (Latency)</h6>
      <div id="hrai-test-result" class="text-center py-4">
        <i class="bi bi-cpu display-4 text-muted"></i>
        <p class="text-muted small mt-2">Bấm "Kiểm Tra Kết Nối" để thử gửi yêu cầu đến Google Gemini API.</p>
      </div>
    </div>
  </div>
</div>
`;

  await loadHraiSettingsData();
}

// ── Load Current Settings Data ──
async function loadHraiSettingsData() {
  try {
    const data = await api('GET', '/api/settings');
    if (data.api_key) {
      document.getElementById('hrai-api-key').value = data.api_key;
    }
    if (data.model) {
      document.getElementById('hrai-model').value = data.model;
    }
  } catch (err) {
    toast(err.message, 'bg-danger text-white');
  }
}

// ── Save Settings ──
async function handleSaveHraiSettings(e) {
  e.preventDefault();
  const apiKey = document.getElementById('hrai-api-key').value.trim();
  const model = document.getElementById('hrai-model').value;

  try {
    const res = await api('POST', '/api/settings', { api_key: apiKey, model: model });
    toast(res.message || 'Đã lưu cài đặt thành công!');
  } catch (err) {
    toast(err.message, 'bg-danger text-white');
  }
}

// ── Test Single Key ──
async function handleTestSingleKey() {
  const apiKey = document.getElementById('hrai-api-key').value.trim();
  const model = document.getElementById('hrai-model').value;
  const display = document.getElementById('hrai-test-result');

  if (!apiKey) {
    toast('Vui lòng nhập API Key để kiểm tra!', 'bg-warning text-dark');
    return;
  }

  display.innerHTML = `
    <div class="py-4">
      <span class="spinner-border text-danger"></span>
      <p class="text-muted small mt-2">Đang kết nối đến Gemini API...</p>
    </div>`;

  try {
    const res = await api('POST', '/api/settings/test-single', { api_key: apiKey, model_id: model });
    if (res.working) {
      display.innerHTML = `
        <div class="alert alert-success bg-success-subtle border-0 text-start p-3">
          <div class="d-flex align-items-center gap-2 mb-2 text-success">
            <i class="bi bi-check-circle-fill fs-4"></i>
            <h6 class="fw-bold mb-0">Kết Nối Thành Công!</h6>
          </div>
          <div class="small mb-1">Độ trễ phản hồi (Latency): <strong class="text-success fs-6">${res.latency_ms} ms</strong></div>
          <div class="small text-muted">Phản hồi từ AI: <code>"${res.response}"</code></div>
        </div>`;
      toast(`Kết nối Gemini OK (${res.latency_ms}ms)`);
    } else {
      display.innerHTML = `
        <div class="alert alert-danger bg-danger-subtle border-0 text-start p-3">
          <div class="d-flex align-items-center gap-2 mb-2 text-danger">
            <i class="bi bi-x-circle-fill fs-4"></i>
            <h6 class="fw-bold mb-0">Lỗi Kết Nối!</h6>
          </div>
          <div class="small text-danger">${res.error || 'API Key không hợp lệ.'}</div>
        </div>`;
    }
  } catch (err) {
    display.innerHTML = `
      <div class="alert alert-danger bg-danger-subtle border-0 text-start p-3">
        <div class="small text-danger">${err.message}</div>
      </div>`;
  }
}
