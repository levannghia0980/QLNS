/* ═══════════════════════════════════════════════
   PAGE: HRAI DEDICATED GOOGLE SHEET DATA VIEWER (hrai-sheet-data)
   ═══════════════════════════════════════════════ */

let CURRENT_SELECTED_SHEET_TAB_ID = 1;
let CURRENT_SHEET_DATA_RAW = [];

async function renderHraiSheetDataPage(area, targetTabId = null) {
  area = area || document.getElementById('page-hrai-sheet-data');
  if (!area) return;

  if (targetTabId) {
    CURRENT_SELECTED_SHEET_TAB_ID = parseInt(targetTabId);
  }

  area.innerHTML = `
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
  <div>
    <h4 class="fw-bold mb-1 text-danger">
      <i class="bi bi-table me-2"></i>Dữ Liệu Google Sheet
    </h4>
    <p class="text-muted small mb-0">Trang xem chi tiết, tra cứu và tìm kiếm dữ liệu trực tiếp từ các link Google Sheet đã kết nối.</p>
  </div>
  <div class="d-flex gap-2 align-items-center">
    <a href="#" class="btn btn-sm btn-outline-danger" onclick="event.preventDefault(); navigate('hrai-sheets');">
      <i class="bi bi-arrow-left me-1"></i>Quản lý Link Sheet
    </a>
  </div>
</div>

<!-- SHEET SELECTOR & CONTROL CARD -->
<div class="glass-card p-3 mb-4">
  <div class="row g-3 align-items-center">
    <div class="col-md-5">
      <label class="form-label fw-semibold small text-muted mb-1"><i class="bi bi-file-earmark-spreadsheet me-1 text-danger"></i>Chọn Link Sheet Cần Xem:</label>
      <select id="select-active-sheet-tab" class="form-select border-danger-subtle fw-semibold" onchange="onSheetSelectChanged(this.value)">
        <option value="">Đang tải danh sách Sheet...</option>
      </select>
    </div>
    <div class="col-md-7 d-flex justify-content-md-end align-items-end gap-2 flex-wrap">
      <a id="btn-open-google-sheet-external" href="#" target="_blank" class="btn btn-sm btn-outline-success d-none">
        <i class="bi bi-box-arrow-up-right me-1"></i>Mở Google Sheet Gốc
      </a>
      <button class="btn btn-sm btn-danger" id="btn-sync-current-sheet" onclick="syncActiveSheetData()">
        <i class="bi bi-arrow-clockwise me-1"></i>Đồng bộ dữ liệu mới nhất
      </button>
    </div>
  </div>
</div>

<!-- METRICS SUMMARY BAR -->
<div class="row g-3 mb-4 d-none" id="sheet-data-metrics-bar">
  <div class="col-md-3 col-6">
    <div class="glass-card p-3 d-flex align-items-center">
      <div class="rounded-circle bg-danger-subtle p-2 me-3 text-danger fs-4"><i class="bi bi-card-list"></i></div>
      <div>
        <div class="text-muted small">Tổng số dòng</div>
        <div class="fw-bold fs-5 text-dark" id="sheet-metric-rows">—</div>
      </div>
    </div>
  </div>
  <div class="col-md-3 col-6">
    <div class="glass-card p-3 d-flex align-items-center">
      <div class="rounded-circle bg-primary-subtle p-2 me-3 text-primary fs-4"><i class="bi bi-columns-gap"></i></div>
      <div>
        <div class="text-muted small">Số cột dữ liệu</div>
        <div class="fw-bold fs-5 text-dark" id="sheet-metric-cols">—</div>
      </div>
    </div>
  </div>
  <div class="col-md-3 col-6">
    <div class="glass-card p-3 d-flex align-items-center">
      <div class="rounded-circle bg-secondary-subtle p-2 me-3 text-secondary fs-4"><i class="bi bi-hdd-rack"></i></div>
      <div>
        <div class="text-muted small">Tên Bảng CSDL</div>
        <div class="fw-bold fs-6 text-danger text-truncate" id="sheet-metric-tablename" style="max-width: 140px;">—</div>
      </div>
    </div>
  </div>
  <div class="col-md-3 col-6">
    <div class="glass-card p-3 d-flex align-items-center">
      <div class="rounded-circle bg-success-subtle p-2 me-3 text-success fs-4"><i class="bi bi-clock-history"></i></div>
      <div>
        <div class="text-muted small">Lần đồng bộ cuối</div>
        <div class="fw-bold small text-dark" id="sheet-metric-synced">—</div>
      </div>
    </div>
  </div>
</div>

<!-- SEARCH & TABLE CONTAINER -->
<div class="glass-card p-4">
  <div class="row g-2 align-items-center mb-3">
    <div class="col-md-6">
      <div class="input-group">
        <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
        <input type="text" id="input-search-sheet-rows" class="form-control border-start-0" placeholder="Tìm kiếm dữ liệu trong bảng này..." oninput="filterSheetRows()">
      </div>
    </div>
    <div class="col-md-6 text-md-end">
      <span class="text-muted small">Hiển thị <strong id="lbl-showing-rows-count">0</strong> / <span id="lbl-total-rows-count">0</span> dòng</span>
    </div>
  </div>

  <div id="sheet-table-data-wrapper">
    <div class="text-center py-5"><span class="spinner-border text-danger"></span></div>
  </div>
</div>
`;

  await initSheetDataPage();
}

async function initSheetDataPage() {
  try {
    const res = await api('GET', '/api/sheets');
    const select = document.getElementById('select-active-sheet-tab');
    if (!select) return;

    if (!res || res.length === 0 || !res[0].tabs || res[0].tabs.length === 0) {
      select.innerHTML = '<option value="">(Chưa có link Sheet nào được kết nối)</option>';
      document.getElementById('sheet-table-data-wrapper').innerHTML = `
        <div class="empty-state text-center py-5">
          <i class="bi bi-file-earmark-spreadsheet display-4 text-muted"></i>
          <p class="mt-2 text-muted">Chưa có Google Sheet nào được kết nối.</p>
          <button class="btn btn-sm btn-danger" onclick="navigate('hrai-sheets')"><i class="bi bi-link-45deg me-1"></i>Quản lý & Kết nối Link Sheet</button>
        </div>`;
      return;
    }

    const tabs = res[0].tabs;
    select.innerHTML = tabs.map(t => `
      <option value="${t.id}" ${t.id === CURRENT_SELECTED_SHEET_TAB_ID ? 'selected' : ''}>
        ${t.tab_name} (${t.row_count} dòng) — [${t.table_name}]
      </option>
    `).join('');

    // If selected ID is not in tabs, pick first tab
    const matchedTab = tabs.find(t => t.id === CURRENT_SELECTED_SHEET_TAB_ID) || tabs[0];
    CURRENT_SELECTED_SHEET_TAB_ID = matchedTab.id;
    select.value = CURRENT_SELECTED_SHEET_TAB_ID;

    await loadSheetTabData(CURRENT_SELECTED_SHEET_TAB_ID);

  } catch (err) {
    const wrapper = document.getElementById('sheet-table-data-wrapper');
    if (wrapper) wrapper.innerHTML = `<div class="alert alert-danger py-2 small">${err.message}</div>`;
  }
}

async function onSheetSelectChanged(newTabId) {
  if (!newTabId) return;
  CURRENT_SELECTED_SHEET_TAB_ID = parseInt(newTabId);
  await loadSheetTabData(CURRENT_SELECTED_SHEET_TAB_ID);
}

async function loadSheetTabData(tabId) {
  const wrapper = document.getElementById('sheet-table-data-wrapper');
  if (!wrapper) return;

  wrapper.innerHTML = '<div class="text-center py-5"><span class="spinner-border text-danger"></span><p class="small text-muted mt-2">Đang tải dữ liệu Sheet...</p></div>';

  try {
    const res = await api('GET', `/api/sheets/${tabId}/data?limit=500`);
    CURRENT_SHEET_DATA_RAW = res.data || [];

    // Show external link button
    const extBtn = document.getElementById('btn-open-google-sheet-external');
    if (res.sheet_url && res.sheet_url.startsWith('http')) {
      extBtn.href = res.sheet_url;
      extBtn.classList.remove('d-none');
    } else {
      extBtn.classList.add('d-none');
    }

    // Update metrics bar
    const bar = document.getElementById('sheet-data-metrics-bar');
    bar.classList.remove('d-none');

    const totalRows = res.total || 0;
    const colCount = CURRENT_SHEET_DATA_RAW.length > 0 ? Object.keys(CURRENT_SHEET_DATA_RAW[0]).length : 0;

    document.getElementById('sheet-metric-rows').textContent = totalRows.toLocaleString();
    document.getElementById('sheet-metric-cols').textContent = colCount;
    document.getElementById('sheet-metric-tablename').textContent = res.table_name || '—';
    document.getElementById('sheet-metric-tablename').title = res.table_name || '';
    document.getElementById('sheet-metric-synced').textContent = res.last_synced || 'Vừa xong';

    document.getElementById('lbl-total-rows-count').textContent = totalRows;

    filterSheetRows();

  } catch (err) {
    wrapper.innerHTML = `<div class="alert alert-danger py-2 small">${err.message}</div>`;
  }
}

function filterSheetRows() {
  const wrapper = document.getElementById('sheet-table-data-wrapper');
  if (!wrapper) return;

  const query = (document.getElementById('input-search-sheet-rows')?.value || '').toLowerCase().trim();
  
  const filtered = CURRENT_SHEET_DATA_RAW.filter(row => {
    if (!query) return true;
    return Object.values(row).some(v => v != null && String(v).toLowerCase().includes(query));
  });

  document.getElementById('lbl-showing-rows-count').textContent = filtered.length;

  if (filtered.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state text-center py-5">
        <i class="bi bi-search display-4 text-muted"></i>
        <p class="mt-2 text-muted">Không tìm thấy bản ghi nào phù hợp.</p>
      </div>`;
    return;
  }

  const cols = Object.keys(filtered[0]);

  let html = `
  <div class="table-responsive border rounded shadow-sm" style="max-height: 600px;">
    <table class="table table-sm table-striped table-hover mb-0 align-middle">
      <thead class="table-danger sticky-top">
        <tr>
          <th style="width: 50px;" class="text-center">#</th>
          ${cols.map(c => `<th class="text-nowrap">${c}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${filtered.map((row, idx) => `
          <tr>
            <td class="text-center text-muted fw-bold small">${idx + 1}</td>
            ${cols.map(c => {
              const val = row[c];
              if (val == null || val === '') return '<td class="text-muted small">—</td>';
              return `<td class="text-nowrap small">${val}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;

  wrapper.innerHTML = html;
}

async function syncActiveSheetData() {
  const btn = document.getElementById('btn-sync-current-sheet');
  const icon = btn.querySelector('i');
  icon.classList.add('spin-icon');
  btn.disabled = true;

  try {
    const res = await api('POST', `/api/sheets/${CURRENT_SELECTED_SHEET_TAB_ID}/sync`, {});
    toast(res.message || 'Đã đồng bộ dữ liệu mới nhất thành công!');
    await loadSheetTabData(CURRENT_SELECTED_SHEET_TAB_ID);
  } catch (err) {
    toast(err.message, 'bg-danger text-white');
  } finally {
    icon.classList.remove('spin-icon');
    btn.disabled = false;
  }
}
