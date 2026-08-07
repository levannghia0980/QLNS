/* ═══════════════════════════════════════════
   PAGE RENDERERS — appended to app.js scope
   ═══════════════════════════════════════════ */

// ── Utility ──
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('vi-VN') : '—'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('vi-VN', { hour12: false }) : '—'; }
function fmtNum(n) { return n != null ? Number(n).toLocaleString('vi-VN') : '—'; }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
function getWorkdays(y, m) {
  const days = [];
  const total = daysInMonth(y, m);
  for (let d = 1; d <= total; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 0 && dow !== 6) days.push(d);
  }
  return days;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function toDateStr(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function badgeStatus(s) {
  if (s === 'Working') return `<span class="custom-badge badge-working"><i class="bi bi-circle-fill" style="font-size:7px"></i> Đang làm</span>`;
  if (s === 'Lên chính thức') return `<span class="custom-badge" style="background:rgba(156,39,176,.15);color:#9c27b0;border:1px solid rgba(156,39,176,.3)"><i class="bi bi-star-fill" style="font-size:9px"></i> Lên chính thức</span>`;
  if (s === 'Chuyển trung tâm') return `<span class="custom-badge" style="background:rgba(33,150,243,.15);color:#1565c0;border:1px solid rgba(33,150,243,.35)"><i class="bi bi-arrow-right-circle-fill" style="font-size:9px"></i> Chuyển TT</span>`;
  return `<span class="custom-badge badge-resigned"><i class="bi bi-circle-fill" style="font-size:7px"></i> Đã nghỉ</span>`;
}
function badgeShift(s) {
  if (s === 'SC') return `<span class="custom-badge" style="background:rgba(63,185,80,.18);color:#276221;border:1px solid rgba(63,185,80,.35);font-weight:700">SC</span>`;
  if (s === 'S')  return `<span class="custom-badge" style="background:rgba(255,193,7,.2);color:#9c5700;border:1px solid rgba(255,193,7,.4);font-weight:700">S</span>`;
  if (s === 'C')  return `<span class="custom-badge" style="background:rgba(88,166,255,.2);color:#0d47a1;border:1px solid rgba(88,166,255,.4);font-weight:700">C</span>`;
  return `<span style="opacity:.3">—</span>`;
}
function badgeEmpType(t) {
  if ((t||'').toLowerCase().includes('mượn')) return `<span class="custom-badge" style="background:rgba(255,152,0,.15);color:#e65100;border:1px solid rgba(255,152,0,.3)"><i class="bi bi-arrow-left-right" style="font-size:9px"></i> Đi mượn</span>`;
  return `<span class="custom-badge" style="background:rgba(88,166,255,.12);color:#0d47a1;border:1px solid rgba(88,166,255,.25)"><i class="bi bi-building" style="font-size:9px"></i> TTS Trung tâm</span>`;
}
function badgeEmpKind(k) {
  if ((k||'').toLowerCase() === 'parttime') return `<span class="custom-badge" style="background:rgba(255,193,7,.15);color:#9c5700;border:1px solid rgba(255,193,7,.3)">Part-time</span>`;
  return `<span class="custom-badge" style="background:rgba(63,185,80,.12);color:#276221;border:1px solid rgba(63,185,80,.28)">Full-time</span>`;
}

function badgePeriod(s) {
  return s === 'open'
    ? `<span class="custom-badge badge-open"><i class="bi bi-unlock-fill" style="font-size:9px"></i> Mở</span>`
    : `<span class="custom-badge badge-closed"><i class="bi bi-lock-fill" style="font-size:9px"></i> Đóng</span>`;
}

// ═══════════════════════════════════════════
// RENDER DISPATCHER
// ═══════════════════════════════════════════
async function renderPage(page, area) {
  try {
    switch (page) {
      case 'dashboard': await renderDashboard(area); break;
      case 'manage-users': await renderManageUsers(area); break;
      case 'manage-employees': await renderManageEmployees(area); break;
      case 'manage-periods': await renderManagePeriods(area); break;
      case 'manage-accounts': await renderManageAccounts(area, 'intern'); break;
      case 'manage-emp-accounts': await renderManageAccounts(area, 'employee'); break;
      case 'admin-schedule': await renderAdminSchedule(area); break;
      case 'profile': await renderProfile(area); break;
      case 'register-schedule': await renderRegisterSchedule(area); break;
      case 'view-schedule': await renderViewSchedule(area); break;
      case 'change-password': renderChangePassword(area); break;
      case 'register-ot': await renderRegisterOT(area); break;
      case 'manage-ot': await renderManageOT(area); break;
      case 'hrai-chat': await renderHraiChatPage(area); break;
      case 'hrai-sheets': await renderHraiSheets(area); break;
      case 'hrai-sheet-data': await renderHraiSheetDataPage(area); break;
      case 'hrai-db': await renderHraiDbPage(area); break;
      case 'hrai-settings': await renderHraiSettings(area); break;
      default: area.innerHTML = '<div class="empty-state"><i class="bi bi-compass"></i><p>Trang không tồn tại</p></div>';
    }
  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>${err.message}</div>`;
  }
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
async function renderDashboard(area) {
  const [users, periods, stats] = await Promise.all([
    api('GET', '/admin/users'),
    api('GET', '/admin/periods'),
    api('GET', '/admin/stats'),
  ]);
  const now = new Date();

  area.innerHTML = `
<div class="d-flex justify-content-between align-items-center mb-4">
  <h4 class="fw-bold mb-0 text-danger">Tổng quan Hệ thống</h4>
  <span class="badge bg-danger px-3 py-2">Tháng ${now.getMonth() + 1}/${now.getFullYear()}</span>
</div>

<!-- 1. KEY METRICS -->
<div class="row g-3 mb-4">
  <div class="col-6 col-md-3">
    <div class="glass-card p-3 d-flex align-items-center gap-3 h-100 border-start border-danger border-4">
      <div class="stat-icon" style="width:48px;height:48px;font-size:1.2rem;background:rgba(229,57,53,0.1);color:#e53935;"><i class="bi bi-people-fill"></i></div>
      <div>
        <div class="text-muted small fw-semibold text-uppercase">Tổng Nhân Sự</div>
        <div class="fs-4 fw-bold lh-1">${stats.total_interns + stats.total_employees}</div>
        <div class="small text-muted mt-1">${stats.total_employees} NV | ${stats.total_interns} TTS</div>
      </div>
    </div>
  </div>
  <div class="col-6 col-md-3">
    <div class="glass-card p-3 d-flex align-items-center gap-3 h-100 border-start border-danger border-4">
      <div class="stat-icon" style="width:48px;height:48px;font-size:1.2rem;background:rgba(229,57,53,0.1);color:#e53935;"><i class="bi bi-briefcase-fill"></i></div>
      <div>
        <div class="text-muted small fw-semibold text-uppercase">Loại Nhân Viên</div>
        <div class="fs-4 fw-bold lh-1">${stats.emp_trung_tam} <span class="fs-6 text-muted fw-normal">NS TTâm</span></div>
        <div class="small text-muted mt-1">${stats.emp_cho_muon} Cho mượn | ${stats.emp_onsite} Onsite</div>
      </div>
    </div>
  </div>
  <div class="col-6 col-md-3">
    <div class="glass-card p-3 d-flex align-items-center gap-3 h-100 border-start border-danger border-4">
      <div class="stat-icon" style="width:48px;height:48px;font-size:1.2rem;background:rgba(229,57,53,0.1);color:#e53935;"><i class="bi bi-person-badge-fill"></i></div>
      <div>
        <div class="text-muted small fw-semibold text-uppercase">Nguồn TTS</div>
        <div class="fs-4 fw-bold lh-1">${stats.intern_count} <span class="fs-6 text-muted fw-normal">Thực tập</span></div>
        <div class="small text-muted mt-1">${stats.borrowed_count} Đi mượn</div>
      </div>
    </div>
  </div>
  <div class="col-6 col-md-3">
    <div class="glass-card p-3 d-flex align-items-center gap-3 h-100 border-start border-danger border-4">
      <div class="stat-icon" style="width:48px;height:48px;font-size:1.2rem;background:rgba(229,57,53,0.1);color:#e53935;"><i class="bi bi-person-check-fill"></i></div>
      <div>
        <div class="text-muted small fw-semibold text-uppercase">TTS Đang Làm</div>
        <div class="fs-4 fw-bold lh-1">${stats.working}</div>
        <div class="small text-muted mt-1 text-danger"><i class="bi bi-arrow-down-right"></i> ${stats.resigned} đã nghỉ</div>
      </div>
    </div>
  </div>
</div>

<!-- 2. CHARTS -->
<div class="row g-4 mb-4">
  <div class="col-md-4">
    <div class="glass-card p-4 h-100 d-flex flex-column">
      <h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill text-danger me-2"></i>Cơ cấu Nhân sự</h6>
      <div class="flex-grow-1 position-relative" style="min-height:220px;">
        <canvas id="chart-users"></canvas>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="glass-card p-4 h-100 d-flex flex-column">
      <h6 class="fw-bold mb-3"><i class="bi bi-bar-chart-fill text-danger me-2"></i>Phân loại Nhân viên</h6>
      <div class="flex-grow-1 position-relative" style="min-height:220px;">
        <canvas id="chart-emp-type"></canvas>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="glass-card p-4 h-100 d-flex flex-column">
      <h6 class="fw-bold mb-3"><i class="bi bi-bar-chart-steps text-danger me-2"></i>Phân loại Thực tập sinh</h6>
      <div class="flex-grow-1 position-relative" style="min-height:220px;">
        <canvas id="chart-intern-type"></canvas>
      </div>
    </div>
</div>

<!-- 3. TODAY WORKERS -->
<div class="row mb-4">
  <div class="col-12">
    <div class="glass-card p-4">
      <h6 class="fw-bold mb-3"><i class="bi bi-calendar-check-fill text-success me-2"></i>TTS đi làm hôm nay</h6>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Mã NV</th>
              <th>Họ và tên</th>
              <th>Ca làm việc</th>
            </tr>
          </thead>
          <tbody>
            ${stats.today_workers && stats.today_workers.length > 0 ? stats.today_workers.map(w => `
              <tr>
                <td><span class="badge bg-secondary">${w.employee_code}</span></td>
                <td class="fw-medium">${w.full_name}</td>
                <td>
                  ${w.shift === 'S' ? '<span class="badge bg-info text-dark">Sáng</span>' : ''}
                  ${w.shift === 'C' ? '<span class="badge bg-warning text-dark">Chiều</span>' : ''}
                  ${w.shift === 'SC' ? '<span class="badge bg-success">Cả ngày</span>' : ''}
                </td>
              </tr>
            `).join('') : '<tr><td colspan="3" class="text-center text-muted py-3">Không có ai đăng ký lịch làm hôm nay.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;

  // Colors: Modern Palette
  const c1 = '#4F46E5';
  const c2 = '#06B6D4';
  const c3 = '#EC4899';
  const c4 = '#8B5CF6';
  const c5 = '#10B981';
  const c6 = '#F59E0B';

  // Draw Charts
  const cUsers = document.getElementById('chart-users');
  if (cUsers) {
    new Chart(cUsers, {
      type: 'pie',
      data: {
        labels: ['Nhân viên', 'Thực tập sinh'],
        datasets: [{
          data: [stats.total_employees, stats.total_interns],
          backgroundColor: [c1, c2],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }
      }
    });
  }

  const cEmp = document.getElementById('chart-emp-type');
  if (cEmp) {
    new Chart(cEmp, {
      type: 'bar',
      data: {
        labels: ['NS Trung tâm', 'Cho mượn', 'Onsite'],
        datasets: [{
          label: 'Số lượng',
          data: [stats.emp_trung_tam, stats.emp_cho_muon, stats.emp_onsite],
          backgroundColor: [c1, c3, c4],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, border: { display: false }, ticks: { precision: 0, stepSize: 1 } }
        }
      }
    });
  }

  const cIntern = document.getElementById('chart-intern-type');
  if (cIntern) {
    new Chart(cIntern, {
      type: 'bar',
      data: {
        labels: ['Thực tập', 'Đi mượn'],
        datasets: [{
          label: 'Số lượng',
          data: [stats.intern_count, stats.borrowed_count],
          backgroundColor: [c5, c6],
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y', // Horizontal bar
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, border: { display: false }, ticks: { precision: 0, stepSize: 1 } },
          y: { grid: { display: false } }
        }
      }
    });
  }
}
