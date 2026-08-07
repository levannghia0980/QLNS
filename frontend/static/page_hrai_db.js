/* ═══════════════════════════════════════════════
   PAGE: HRAI SYSTEM DATABASE MANAGEMENT (hrai-db)
   ═══════════════════════════════════════════════ */

let ALL_SYSTEM_DB_TABLES = [];

async function renderHraiDbPage(area) {
  area = area || document.getElementById('page-hrai-db');
  if (!area) return;

  area.innerHTML = `
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
  <div>
    <h4 class="fw-bold mb-1 text-danger">
      <i class="bi bi-database-fill-gear me-2"></i>Cơ Sở Dữ Liệu Hệ Thống
    </h4>
    <p class="text-muted small mb-0">Quản lý tổng quan cấu trúc tất cả các bảng CSDL trong hệ thống (nhân sự, tài khoản, lịch làm...) và dữ liệu Google Sheets đã lưu trữ.</p>
  </div>
  <div class="d-flex gap-2">
    <button class="btn btn-sm btn-outline-secondary shadow-sm" onclick="loadSystemDbTables()">
      <i class="bi bi-arrow-clockwise me-1"></i>Làm mới
    </button>
  </div>
</div>

<!-- STATS SUMMARY BAR -->
<div class="row g-3 mb-4" id="hrai-db-stats-bar">
  <div class="col-md-4">
    <div class="glass-card p-3 d-flex align-items-center">
      <div class="rounded-circle bg-danger-subtle p-3 me-3 text-danger fs-4"><i class="bi bi-table"></i></div>
      <div>
        <div class="text-muted small">Tổng số bảng CSDL</div>
        <div class="fw-bold fs-4 text-dark" id="stat-total-tables">—</div>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="glass-card p-3 d-flex align-items-center">
      <div class="rounded-circle bg-primary-subtle p-3 me-3 text-primary fs-4"><i class="bi bi-hdd-stack-fill"></i></div>
      <div>
        <div class="text-muted small">Tổng số dòng dữ liệu</div>
        <div class="fw-bold fs-4 text-dark" id="stat-total-rows">—</div>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="glass-card p-3 d-flex align-items-center">
      <div class="rounded-circle bg-success-subtle p-3 me-3 text-success fs-4"><i class="bi bi-file-earmark-excel-fill"></i></div>
      <div>
        <div class="text-muted small">Bảng từ Google Sheets</div>
        <div class="fw-bold fs-4 text-dark" id="stat-sheet-tables">—</div>
      </div>
    </div>
  </div>
</div>

<!-- SEARCH & FILTER -->
<div class="glass-card p-3 mb-4">
  <div class="row g-2 align-items-center">
    <div class="col-md-6">
      <div class="input-group">
        <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
        <input type="text" id="input-search-db-table" class="form-control border-start-0" placeholder="Tìm kiếm bảng CSDL..." oninput="filterSystemDbTables()">
      </div>
    </div>
    <div class="col-md-6 text-md-end">
      <span class="text-muted small">Hiển thị <strong id="lbl-showing-tables-count">0</strong> bảng</span>
    </div>
  </div>
</div>

<!-- TABLES GRID -->
<div id="hrai-db-tables-container">
  <div class="text-center py-5"><span class="spinner-border text-danger"></span></div>
</div>

<!-- MODAL: VIEW TABLE DATA -->
<div class="modal fade" id="modal-db-table-view" tabindex="-1">
  <div class="modal-dialog modal-xl modal-dialog-scrollable">
    <div class="modal-content glass-modal">
      <div class="modal-header border-0 pb-2">
        <div>
          <h5 class="modal-title fw-bold text-danger" id="db-view-title"><i class="bi bi-table me-2"></i>Dữ Liệu Bảng CSDL</h5>
          <small class="text-muted" id="db-view-subtitle"></small>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body pt-2">
        <div class="table-responsive border rounded" style="max-height:550px">
          <table class="table table-sm table-striped table-hover mb-0 align-middle">
            <thead class="table-danger sticky-top" id="db-view-thead"></thead>
            <tbody id="db-view-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
`;

  await loadSystemDbTables();
}

async function loadSystemDbTables() {
  const container = document.getElementById('hrai-db-tables-container');
  if (!container) return;

  try {
    const data = await api('GET', '/api/db-tables');
    ALL_SYSTEM_DB_TABLES = data || [];

    // Calculate Stats
    const totalTables = ALL_SYSTEM_DB_TABLES.length;
    const totalRows = ALL_SYSTEM_DB_TABLES.reduce((acc, t) => acc + (t.row_count || 0), 0);
    const sheetTables = ALL_SYSTEM_DB_TABLES.filter(t => t.is_sheet).length;

    document.getElementById('stat-total-tables').textContent = totalTables;
    document.getElementById('stat-total-rows').textContent = totalRows.toLocaleString();
    document.getElementById('stat-sheet-tables').textContent = sheetTables;

    filterSystemDbTables();

  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger py-2 small">${err.message}</div>`;
  }
}

function filterSystemDbTables() {
  const container = document.getElementById('hrai-db-tables-container');
  if (!container) return;

  const query = (document.getElementById('input-search-db-table')?.value || '').toLowerCase().trim();
  const filtered = ALL_SYSTEM_DB_TABLES.filter(t => 
    t.table_name.toLowerCase().includes(query) || 
    t.display_name.toLowerCase().includes(query) ||
    (t.columns || []).some(c => c.name.toLowerCase().includes(query))
  );

  document.getElementById('lbl-showing-tables-count').textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state text-center py-5">
        <i class="bi bi-database-x display-4 text-muted"></i>
        <p class="mt-2 text-muted">Không tìm thấy bảng CSDL nào phù hợp.</p>
      </div>`;
    return;
  }

  let html = `<div class="row g-3">`;

  filtered.forEach(t => {
    const colNames = (t.columns || []).map(c => c.name).slice(0, 5).join(', ');
    const moreCols = (t.columns || []).length > 5 ? ` (+${t.columns.length - 5} cột khác)` : '';
    const badgeType = t.is_sheet 
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-file-earmark-spreadsheet me-1"></i>Google Sheet</span>`
      : `<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-hdd-network me-1"></i>Hệ Thống</span>`;

    html += `
<div class="col-md-6 col-lg-4">
  <div class="glass-card p-3 h-100 d-flex flex-column justify-content-between border-top border-danger border-3 shadow-sm">
    <div>
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h6 class="fw-bold mb-0 text-dark text-truncate" title="${t.display_name}">${t.display_name}</h6>
        ${badgeType}
      </div>
      <div class="small text-muted mb-2"><i class="bi bi-database me-1"></i>Bảng DB: <code class="text-danger">${t.table_name}</code></div>
      <div class="d-flex gap-3 small text-secondary mb-3">
        <span><i class="bi bi-card-list me-1"></i><strong>${t.row_count.toLocaleString()}</strong> dòng</span>
        <span><i class="bi bi-columns me-1"></i><strong>${t.column_count}</strong> cột</span>
      </div>
      <div class="small text-muted text-truncate mb-3" title="${colNames}">
        <i class="bi bi-tag me-1"></i>${colNames}${moreCols}
      </div>
    </div>
    <div class="pt-2 border-top d-flex gap-2 justify-content-end">
      <button class="btn btn-xs btn-outline-danger" onclick="viewSystemDbTableData('${t.table_name}', '${t.display_name}')">
        <i class="bi bi-eye me-1"></i>Xem Dữ Liệu
      </button>
    </div>
  </div>
</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

async function viewSystemDbTableData(tableName, displayName) {
  try {
    const res = await api('GET', `/api/db-tables/${tableName}/data?limit=500`);
    document.getElementById('db-view-title').innerHTML = `<i class="bi bi-table me-2"></i>Dữ Liệu Bảng: ${displayName || tableName}`;
    document.getElementById('db-view-subtitle').textContent = `Bảng CSDL: ${tableName} | Hiển thị: ${res.total || 0} bản ghi`;

    const thead = document.getElementById('db-view-thead');
    const tbody = document.getElementById('db-view-tbody');

    if (!res.data || res.data.length === 0) {
      thead.innerHTML = '';
      tbody.innerHTML = '<tr><td class="text-center py-4 text-muted">Bảng này hiện chưa có dữ liệu.</td></tr>';
    } else {
      const cols = Object.keys(res.data[0]);
      thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;
      tbody.innerHTML = res.data.map(row => `
        <tr>${cols.map(c => `<td>${row[c] != null ? row[c] : '—'}</td>`).join('')}</tr>
      `).join('');
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-db-table-view')).show();
  } catch (err) {
    toast(err.message, 'bg-danger text-white');
  }
}
