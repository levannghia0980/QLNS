/* ═══════════════════════════════════════════════
   PAGE: HRAI GOOGLE SHEETS & EXCEL MANAGEMENT
   ═══════════════════════════════════════════════ */

let CURRENT_PREVIEW_DATA = null;
let CURRENT_SOURCE_TYPE = 'url'; // 'url' | 'excel'
let SELECTED_EXCEL_FILE = null;

async function renderHraiSheets(area) {
  area.innerHTML = `
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
  <div>
    <h4 class="fw-bold mb-1 text-danger"><i class="bi bi-file-earmark-spreadsheet-fill me-2"></i>Quản Lý Link Google Sheet & File Excel</h4>
    <p class="text-muted small mb-0">Kết nối đường link Google Sheet hoặc tải lên file Excel (.xlsx, .xls), xem trước phân tích AI Stage 1 & 2 và tự động đồng bộ CSDL.</p>
  </div>
  <button class="btn btn-danger px-3 shadow-sm" onclick="openConnectSheetModal()">
    <i class="bi bi-plus-lg me-1"></i>Thêm Link Sheet / File Excel
  </button>
</div>

<!-- 1. CONNECTED TABLES LIST -->
<div class="glass-card p-4 mb-4">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h6 class="fw-bold mb-0 text-dark"><i class="bi bi-link-45deg me-2 text-danger"></i>Danh Sách Sheet & File Excel Đã Kết Nối</h6>
    <button class="btn btn-sm btn-outline-secondary" onclick="loadConnectedSheets()"><i class="bi bi-arrow-clockwise me-1"></i>Làm mới</button>
  </div>
  <div id="hrai-sheets-container">
    <div class="text-center py-4"><span class="spinner-border text-danger"></span></div>
  </div>
</div>

<!-- MODAL 1: CONNECT & PREVIEW SHEET / EXCEL -->
<div class="modal fade" id="modal-hrai-preview" tabindex="-1">
  <div class="modal-dialog modal-xl modal-dialog-scrollable">
    <div class="modal-content glass-modal">
      <div class="modal-header border-0 pb-0">
        <div>
          <h5 class="modal-title fw-bold text-danger"><i class="bi bi-magic me-2"></i>Kết Nối & Phân Tích Sheet / Excel</h5>
          <small class="text-muted">Nhập URL Google Sheet hoặc chọn file Excel từ máy tính để Gemini AI phân tích cấu trúc & nhận diện cột</small>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body pt-3">

        <!-- TAB SELECTOR FOR SOURCE TYPE -->
        <div class="d-flex gap-2 mb-3">
          <button type="button" class="btn btn-sm btn-outline-danger active px-3" id="btn-tab-url" onclick="switchSourceTab('url')">
            <i class="bi bi-link-45deg me-1"></i>Link Google Sheet (URL)
          </button>
          <button type="button" class="btn btn-sm btn-outline-success px-3" id="btn-tab-excel" onclick="switchSourceTab('excel')">
            <i class="bi bi-file-earmark-excel-fill me-1"></i>Tải lên File Excel (.xlsx, .xls)
          </button>
        </div>

        <form id="form-hrai-preview" onsubmit="handlePreviewSheet(event)">
          <!-- Option A: Google Sheet URL -->
          <div id="box-source-url" class="input-group mb-3">
            <span class="input-group-text bg-white"><i class="bi bi-link-45deg text-danger fs-5"></i></span>
            <input type="url" id="hrai-sheet-url" class="form-control" placeholder="https://docs.google.com/spreadsheets/d/..." />
            <button type="submit" class="btn btn-danger" id="btn-do-preview">
              <span class="btn-text"><i class="bi bi-cpu me-1"></i>Xem Trước & Phân Tích AI</span>
              <span class="btn-spinner d-none"><span class="spinner-border spinner-border-sm me-1"></span>Đang phân tích...</span>
            </button>
          </div>

          <!-- Option B: Excel File Upload -->
          <div id="box-source-excel" class="input-group mb-3 d-none">
            <span class="input-group-text bg-white"><i class="bi bi-file-earmark-excel text-success fs-5"></i></span>
            <input type="file" id="hrai-excel-file" class="form-control" accept=".xlsx, .xls" onchange="onExcelFileSelected(this)" />
            <button type="submit" class="btn btn-success" id="btn-do-preview-excel">
              <span class="btn-text"><i class="bi bi-cpu me-1"></i>Phân Tích File Excel</span>
              <span class="btn-spinner d-none"><span class="spinner-border spinner-border-sm me-1"></span>Đang phân tích...</span>
            </button>
          </div>
        </form>

        <div id="hrai-preview-result" class="d-none mt-3">
          <!-- AI Structure Summary -->
          <div class="alert alert-danger bg-danger-subtle border-0 d-flex justify-content-between align-items-center p-3 mb-3">
            <div>
              <h6 class="fw-bold mb-1 text-danger" id="prev-sheet-name">—</h6>
              <div class="small text-secondary">
                <span class="me-3"><i class="bi bi-table me-1"></i>Tab: <strong id="prev-tab-name">—</strong></span>
                <span class="me-3"><i class="bi bi-list-ol me-1"></i>Số dòng: <strong id="prev-row-count">0</strong></span>
                <span><i class="bi bi-layers me-1"></i>Cấu trúc Header: <strong id="prev-header-level">1 dòng</strong></span>
              </div>
            </div>
            <span class="badge bg-danger fs-6" id="prev-badge-status">AI Stage 1 & 2 Ready</span>
          </div>

          <!-- Section Dividers & Inferred Field Proposal -->
          <div id="prev-inferred-box" class="glass-card p-3 mb-3 border-start border-warning border-4 d-none">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <h6 class="fw-bold text-warning-emphasis mb-1"><i class="bi bi-sliders me-2"></i>Cửa Sổ Phê Duyệt Cột Thuộc Tính Bổ Sung (Dành cho Người Dùng)</h6>
                <div class="small text-muted" id="prev-inferred-reason"></div>
              </div>
              <span class="badge bg-warning text-dark">Tùy Chọn Phê Duyệt</span>
            </div>

            <div class="alert alert-light border small text-dark p-2 mb-3">
              <i class="bi bi-info-circle-fill text-primary me-1"></i>
              <strong>Mô tả chức năng:</strong> Cột này giúp phân loại nhóm/trạng thái nhân sự dựa trên các tiêu đề phân đoạn trong file.
              <span class="text-danger fw-semibold">Mặc định hệ thống KHÔNG tự ý tạo cột này.</span> Nếu bạn cần, vui lòng tích chọn bên dưới và có thể tự sửa lại tên cột thuộc tính, giá trị mặc định theo ý muốn trước khi kết nối CSDL.
            </div>

            <div class="form-check form-switch mb-3">
              <input class="form-check-input" type="checkbox" id="chk-accept-inferred" onchange="onToggleInferredColumn(this.checked)">
              <label class="form-check-label fw-bold text-dark" for="chk-accept-inferred">
                Đồng ý tạo thêm cột thuộc tính mới này vào CSDL
              </label>
            </div>

            <div id="box-inferred-custom-fields" class="row g-2 p-3 bg-light rounded border d-none">
              <div class="col-md-4">
                <label class="form-label small fw-semibold text-dark mb-1">Tên cột thuộc tính (field_name):</label>
                <input type="text" id="inp-inferred-fieldname" class="form-control form-control-sm" placeholder="VD: loai_nhan_su" oninput="onUpdateInferredInputs()">
                <div class="form-text text-muted micro-text">Tên cột dùng trong CSDL (dạng snake_case)</div>
              </div>
              <div class="col-md-3">
                <label class="form-label small fw-semibold text-dark mb-1">Giá trị mặc định:</label>
                <input type="text" id="inp-inferred-default" class="form-control form-control-sm" placeholder="VD: TTS" oninput="onUpdateInferredInputs()">
                <div class="form-text text-muted micro-text">Gán cho nhóm hàng đầu tiên</div>
              </div>
              <div class="col-md-5">
                <label class="form-label small fw-semibold text-dark mb-1">Mô tả chức năng cột:</label>
                <input type="text" id="inp-inferred-desc" class="form-control form-control-sm" placeholder="VD: Phân loại nhóm nhân sự trong sheet" oninput="onUpdateInferredInputs()">
                <div class="form-text text-muted micro-text">Diễn giải ý nghĩa của thuộc tính này</div>
              </div>
            </div>
          </div>

          <!-- Column Headers & Data Types -->
          <h6 class="fw-bold text-dark mb-2"><i class="bi bi-columns-gap me-2"></i>Danh Sách Cột & Kiểu Dữ Liệu AI Đã Phân Tích</h6>
          <div class="table-responsive mb-3 border rounded">
            <table class="table table-sm table-hover mb-0 align-middle">
              <thead class="table-light">
                <tr>
                  <th style="width:40px">STT</th>
                  <th>Tên Cột Gốc</th>
                  <th style="width:130px">Kiểu Dữ Liệu</th>
                  <th>Mô Tả AI</th>
                  <th>Ví Dụ Dữ Liệu</th>
                </tr>
              </thead>
              <tbody id="prev-headers-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="modal-footer border-0 pt-0">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button>
        <button class="btn btn-danger d-none" id="btn-confirm-upload" onclick="handleUploadSheet()">
          <i class="bi bi-cloud-upload-fill me-1"></i>Tạo Bảng & Kết Nối CSDL
        </button>
      </div>
    </div>
  </div>
</div>
`;

  await loadConnectedSheets();
}

function switchSourceTab(type) {
  CURRENT_SOURCE_TYPE = type;
  const btnUrl = document.getElementById('btn-tab-url');
  const btnExcel = document.getElementById('btn-tab-excel');
  const boxUrl = document.getElementById('box-source-url');
  const boxExcel = document.getElementById('box-source-excel');

  if (type === 'url') {
    btnUrl.classList.add('active');
    btnExcel.classList.remove('active');
    boxUrl.classList.remove('d-none');
    boxExcel.classList.add('d-none');
  } else {
    btnExcel.classList.add('active');
    btnUrl.classList.remove('active');
    boxExcel.classList.remove('d-none');
    boxUrl.classList.add('d-none');
  }
}

function onExcelFileSelected(input) {
  if (input.files && input.files[0]) {
    SELECTED_EXCEL_FILE = input.files[0];
  } else {
    SELECTED_EXCEL_FILE = null;
  }
}

// ── 1. Load connected sheet tables ──
async function loadConnectedSheets() {
  const container = document.getElementById('hrai-sheets-container');
  try {
    const data = await api('GET', '/api/sheets');
    if (!data || data.length === 0 || !data[0].tabs || data[0].tabs.length === 0) {
      container.innerHTML = `
        <div class="empty-state text-center py-5">
          <i class="bi bi-file-earmark-spreadsheet display-4 text-muted"></i>
          <p class="mt-2 text-muted">Chưa có đường link Google Sheet hay File Excel nào được kết nối.</p>
          <button class="btn btn-sm btn-danger" onclick="openConnectSheetModal()"><i class="bi bi-plus-lg me-1"></i>Kết nối ngay</button>
        </div>`;
      return;
    }

    const tabs = data[0].tabs;
    let html = `<div class="row g-3">`;

    tabs.forEach(tab => {
      const colNames = (tab.columns || []).map(c => c.name).slice(0, 5).join(', ');
      const moreCols = (tab.columns || []).length > 5 ? ` (+${tab.columns.length - 5} cột khác)` : '';
      const isExcel = tab.sheet_url && tab.sheet_url.startsWith('excel://');
      const typeBadge = isExcel
        ? `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-file-earmark-excel me-1"></i>Excel</span>`
        : `<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-link-45deg me-1"></i>Google Sheet</span>`;

      html += `
<div class="col-md-6 col-lg-4">
  <div class="glass-card p-3 h-100 d-flex flex-column justify-content-between border-top border-danger border-3 shadow-sm">
    <div>
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h6 class="fw-bold mb-0 text-dark text-truncate" title="${tab.sheet_name}">${tab.tab_name}</h6>
        ${typeBadge}
      </div>
      <div class="small text-muted mb-2"><i class="bi bi-hdd-rack me-1"></i>Bảng DB: <code class="text-danger">${tab.table_name}</code></div>
      <div class="d-flex gap-3 small text-secondary mb-3">
        <span><i class="bi bi-card-list me-1"></i><strong>${tab.row_count}</strong> dòng</span>
        <span><i class="bi bi-columns me-1"></i><strong>${(tab.columns || []).length}</strong> cột</span>
      </div>
      <div class="small text-muted text-truncate mb-3" title="${colNames}">
        <i class="bi bi-tag me-1"></i>${colNames}${moreCols}
      </div>
    </div>
    <div class="pt-2 border-top d-flex gap-2 justify-content-end">
      <button class="btn btn-xs btn-outline-danger" onclick="viewSheetTableData(${tab.id}, '${tab.tab_name}')" title="Xem dữ liệu">
        <i class="bi bi-eye me-1"></i>Xem Dữ Liệu
      </button>
      <button class="btn btn-xs btn-outline-secondary" onclick="syncSheetTable(${tab.id}, this)" title="Đồng bộ">
        <i class="bi bi-arrow-clockwise me-1"></i>Đồng bộ
      </button>
      <button class="btn btn-xs btn-outline-dark" onclick="deleteSheetTable(${tab.id}, '${tab.tab_name}')" title="Xóa">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  </div>
</div>`;
    });

    html += `</div>`;
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger py-2 small">${err.message}</div>`;
  }
}

// ── 2. Open Connect Modal ──
function openConnectSheetModal() {
  CURRENT_PREVIEW_DATA = null;
  SELECTED_EXCEL_FILE = null;
  document.getElementById('hrai-sheet-url').value = '';
  document.getElementById('hrai-excel-file').value = '';
  document.getElementById('hrai-preview-result').classList.add('d-none');
  document.getElementById('btn-confirm-upload').classList.add('d-none');
  switchSourceTab('url');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-hrai-preview')).show();
}

// ── 3. Handle Preview ──
async function handlePreviewSheet(e) {
  e.preventDefault();

  if (CURRENT_SOURCE_TYPE === 'url') {
    const url = document.getElementById('hrai-sheet-url').value.trim();
    if (!url) {
      toast('Vui lòng nhập đường link Google Sheet hợp lệ', 'bg-warning text-dark');
      return;
    }

    const btn = document.getElementById('btn-do-preview');
    btn.querySelector('.btn-text').classList.add('d-none');
    btn.querySelector('.btn-spinner').classList.remove('d-none');
    btn.disabled = true;

    try {
      const res = await api('POST', '/api/sheets/preview', { sheet_url: url });
      renderPreviewResult(res);
      toast('Đã phân tích cấu trúc Google Sheet bằng AI thành công!');
    } catch (err) {
      toast(err.message, 'bg-danger text-white');
    } finally {
      btn.querySelector('.btn-text').classList.remove('d-none');
      btn.querySelector('.btn-spinner').classList.add('d-none');
      btn.disabled = false;
    }

  } else {
    // Excel file preview
    const fileInput = document.getElementById('hrai-excel-file');
    const file = (fileInput.files && fileInput.files[0]) || SELECTED_EXCEL_FILE;
    if (!file) {
      toast('Vui lòng chọn 1 file Excel (.xlsx, .xls) từ máy tính', 'bg-warning text-dark');
      return;
    }

    const btn = document.getElementById('btn-do-preview-excel');
    btn.querySelector('.btn-text').classList.add('d-none');
    btn.querySelector('.btn-spinner').classList.remove('d-none');
    btn.disabled = true;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/sheets/preview-excel', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || 'Lỗi khi đọc file Excel');
      }

      const res = await response.json();
      renderPreviewResult(res);
      toast(`Đã đọc và phân tích AI thành công file Excel '${file.name}'!`);

    } catch (err) {
      toast(err.message, 'bg-danger text-white');
    } finally {
      btn.querySelector('.btn-text').classList.remove('d-none');
      btn.querySelector('.btn-spinner').classList.add('d-none');
      btn.disabled = false;
    }
  }
}

function onToggleInferredColumn(checked) {
  const customBox = document.getElementById('box-inferred-custom-fields');
  if (customBox) {
    if (checked) customBox.classList.remove('d-none');
    else customBox.classList.add('d-none');
  }
  renderHeadersTable();
}

function onUpdateInferredInputs() {
  renderHeadersTable();
}

function renderHeadersTable() {
  if (!CURRENT_PREVIEW_DATA) return;
  const tab = CURRENT_PREVIEW_DATA.tabs[0];
  const tbody = document.getElementById('prev-headers-tbody');
  if (!tbody) return;

  let headers = [...(tab.headers || [])];
  const chk = document.getElementById('chk-accept-inferred');
  const isAccepted = chk ? chk.checked : false;

  if (isAccepted) {
    const fnInput = document.getElementById('inp-inferred-fieldname');
    const descInput = document.getElementById('inp-inferred-desc');
    const defInput = document.getElementById('inp-inferred-default');

    const fieldName = (fnInput && fnInput.value.trim()) || (tab.inferred_proposal && tab.inferred_proposal.field_name) || 'loai_nhan_su';
    const fieldDesc = (descInput && descInput.value.trim()) || (tab.inferred_proposal && tab.inferred_proposal.description) || 'Cột phân loại nhóm nhân sự trong sheet';
    const defVal = (defInput && defInput.value.trim()) || (tab.inferred_proposal && tab.inferred_proposal.default_value) || 'TTS';

    headers.push({
      name: fieldName,
      data_type: 'TEXT',
      description: fieldDesc,
      sample_value: defVal,
      is_inferred: true
    });
  }

  tbody.innerHTML = headers.map((h, i) => `
    <tr class="${h.is_inferred ? 'table-warning' : ''}">
      <td class="text-center text-muted fw-bold">${i + 1}</td>
      <td class="fw-bold text-dark">
        ${h.name}
        ${h.is_inferred ? '<span class="badge bg-warning text-dark ms-1"><i class="bi bi-plus-circle me-1"></i>Cột tự chọn thêm</span>' : ''}
      </td>
      <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle">${h.data_type}</span></td>
      <td class="small text-muted">${h.description || '—'}</td>
      <td class="small text-secondary">${h.is_inferred ? h.sample_value : ((tab.sample_rows && tab.sample_rows[0]) ? (tab.sample_rows[0][i] || '—') : '—')}</td>
    </tr>
  `).join('');
}

function renderPreviewResult(res) {
  CURRENT_PREVIEW_DATA = res;
  const tab = res.tabs[0];

  document.getElementById('prev-sheet-name').textContent = res.sheet_name;
  document.getElementById('prev-tab-name').textContent = tab.tab_name;
  document.getElementById('prev-row-count').textContent = tab.row_count;
  document.getElementById('prev-header-level').textContent = `${tab.header_level} dòng`;

  // Inferred Proposal Box
  const infBox = document.getElementById('prev-inferred-box');
  const chkInferred = document.getElementById('chk-accept-inferred');
  const customBox = document.getElementById('box-inferred-custom-fields');
  const fnInput = document.getElementById('inp-inferred-fieldname');
  const defInput = document.getElementById('inp-inferred-default');
  const descInput = document.getElementById('inp-inferred-desc');

  if (tab.inferred_proposal && tab.inferred_proposal.field_name) {
    infBox.classList.remove('d-none');
    document.getElementById('prev-inferred-reason').textContent = tab.inferred_proposal.reason || '';
    if (fnInput) fnInput.value = tab.inferred_proposal.field_name || 'loai_nhan_su';
    if (defInput) defInput.value = tab.inferred_proposal.default_value || 'TTS';
    if (descInput) descInput.value = tab.inferred_proposal.description || 'Phân loại nhóm nhân sự trong sheet';
    
    // UNCHECKED BY DEFAULT as requested
    if (chkInferred) {
      chkInferred.checked = false;
    }
    if (customBox) {
      customBox.classList.add('d-none');
    }
  } else {
    infBox.classList.add('d-none');
    if (chkInferred) chkInferred.checked = false;
  }

  // Render Headers Tbody
  renderHeadersTable();

  document.getElementById('hrai-preview-result').classList.remove('d-none');
  document.getElementById('btn-confirm-upload').classList.remove('d-none');
}

// ── 4. Confirm Upload ──
async function handleUploadSheet() {
  if (!CURRENT_PREVIEW_DATA) return;
  const tab = CURRENT_PREVIEW_DATA.tabs[0];
  const chkInferred = document.getElementById('chk-accept-inferred');
  const acceptInferred = chkInferred ? chkInferred.checked : false;

  let inferredProposal = (tab.inferred_proposal && typeof tab.inferred_proposal === 'object') ? {...tab.inferred_proposal} : {};
  if (acceptInferred) {
    const fnInput = document.getElementById('inp-inferred-fieldname');
    const defInput = document.getElementById('inp-inferred-default');
    const descInput = document.getElementById('inp-inferred-desc');

    if (fnInput && fnInput.value.trim()) inferredProposal.field_name = fnInput.value.trim();
    if (defInput && defInput.value.trim()) inferredProposal.default_value = defInput.value.trim();
    if (descInput && descInput.value.trim()) inferredProposal.description = descInput.value.trim();
  }

  if (CURRENT_SOURCE_TYPE === 'url') {
    const payload = {
      sheet_url: CURRENT_PREVIEW_DATA.sheet_url,
      tab_name: tab.tab_name,
      accept_inferred_field: acceptInferred,
      inferred_proposal: inferredProposal
    };

    try {
      const res = await api('POST', '/api/sheets/upload', payload);
      bootstrap.Modal.getInstance(document.getElementById('modal-hrai-preview')).hide();
      toast(res.message || 'Đã tạo bảng và kết nối CSDL thành công!');
      await loadConnectedSheets();
    } catch (err) {
      toast(err.message, 'bg-danger text-white');
    }
  } else {
    // Excel Upload
    const fileInput = document.getElementById('hrai-excel-file');
    const file = (fileInput.files && fileInput.files[0]) || SELECTED_EXCEL_FILE;
    if (!file) {
      toast('Vui lòng chọn file Excel', 'bg-warning text-dark');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify({
        tab_name: tab.tab_name,
        accept_inferred_field: acceptInferred,
        inferred_proposal: inferredProposal
      }));

      const token = localStorage.getItem('token');
      const response = await fetch('/api/sheets/upload-excel', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || 'Lỗi khi nhập file Excel');
      }

      const res = await response.json();
      bootstrap.Modal.getInstance(document.getElementById('modal-hrai-preview')).hide();
      toast(res.message || 'Đã nhập dữ liệu file Excel thành công!');
      await loadConnectedSheets();
    } catch (err) {
      toast(err.message, 'bg-danger text-white');
    }
  }
}

// ── 5. View Data Page Navigation ──
function viewSheetTableData(tabId, tabName) {
  if (typeof renderHraiSheetDataPage === 'function') {
    const area = document.getElementById('content-area');
    CURRENT_SELECTED_SHEET_TAB_ID = tabId;
    navigate('hrai-sheet-data');
  }
}

// ── 6. Sync Sheet Table ──
async function syncSheetTable(tabId, btn) {
  const icon = btn.querySelector('i');
  icon.classList.add('spin-icon');
  try {
    const res = await api('POST', `/api/sheets/${tabId}/sync`, {});
    toast(res.message || 'Đã đồng bộ dữ liệu mới nhất thành công!');
    await loadConnectedSheets();
  } catch (err) {
    toast(err.message, 'bg-danger text-white');
  } finally {
    icon.classList.remove('spin-icon');
  }
}

// ── 7. Delete Sheet Table ──
async function deleteSheetTable(tabId, tabName) {
  if (!confirm(`Bạn có chắc chắn muốn xóa bảng CSDL Sheet '${tabName}' không?`)) return;
  try {
    const res = await api('DELETE', `/api/sheets/${tabId}`);
    toast(res.message || 'Đã xóa bảng thành công!');
    await loadConnectedSheets();
  } catch (err) {
    toast(err.message, 'bg-danger text-white');
  }
}
