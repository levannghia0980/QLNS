/* ═══════════════════════════════════════════════
   VIETTEL INTERN & EMPLOYEE MANAGEMENT — FRONTEND
   ═══════════════════════════════════════════════ */

const API = 'http://localhost:8000';
let STATE = { token: null, role: null, user_type: null, userId: null, fullName: null };

// ── Persist session ──
function saveSession(data) {
  STATE = {
    token: data.access_token,
    role: data.role,
    user_type: data.user_type || 'intern',
    userId: data.user_id,
    fullName: data.full_name,
  };
  localStorage.setItem('intern_session', JSON.stringify(STATE));
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem('intern_session'));
    if (s?.token) { STATE = s; return true; }
  } catch { }
  return false;
}
function clearSession() { STATE = {}; localStorage.removeItem('intern_session'); }

// ── API helper ──
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (STATE.token) opts.headers['Authorization'] = 'Bearer ' + STATE.token;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = 'Lỗi máy chủ';
    if (typeof data.detail === 'string') msg = data.detail;
    else if (Array.isArray(data.detail)) msg = data.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
    throw new Error(msg);
  }
  return data;
}

// ── Toast ──
function toast(msg, type = 'success') {
  const el = document.getElementById('app-toast');
  const msgEl = document.getElementById('toast-msg');
  el.className = `toast align-items-center border-0 ${type}`;
  msgEl.textContent = msg;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 3000 }).show();
}

// ── Toggle password visibility ──
function togglePass(id, btn) {
  const inp = document.getElementById(id);
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  btn.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
}

// ── Clock ──
function startClock() {
  const el = document.getElementById('topbar-clock');
  const tick = () => { el.textContent = new Date().toLocaleString('vi-VN', { hour12: false }); };
  tick(); setInterval(tick, 1000);
}

// ── Page routing ──
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  'manage-users': 'Quản lý Thực tập sinh',
  'manage-employees': 'Quản lý Nhân sự',
  'manage-periods': 'Quản lý Kỳ đăng ký',
  'manage-accounts': 'Tài khoản đăng nhập',
  'admin-schedule': 'Bảng lịch theo tháng',
  profile: 'Hồ sơ cá nhân',
  'register-schedule': 'Đăng ký lịch thực tập',
  'view-schedule': 'Xem lịch của tôi',
  'change-password': 'Đổi mật khẩu',
  'documents': 'Quản lý tài liệu',
  'ai-config': 'Cấu hình AI',
  'register-ot': 'Chấm công OT',
  'hrai-chat': 'Trợ lý AI & Xuất Excel',
  'hrai-sheets': 'Quản lý Link Google Sheet & Excel',
  'hrai-sheet-data': 'Dữ liệu Google Sheet & Excel',
  'hrai-db': 'Cơ sở dữ liệu Hệ thống AI HR',
  'hrai-settings': 'Cấu hình HrAi Gemini',
};

function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  document.getElementById('topbar-title').textContent = PAGE_TITLES[page] || page;
  const area = document.getElementById('content-area');
  area.innerHTML = '<div class="d-flex justify-content-center py-5"><div class="spinner-border text-danger"></div></div>';
  renderPage(page, area);
}

// ── Nav click ──
document.querySelectorAll('.nav-item[data-page]').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); });
});

// ── Sidebar toggle ──
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  const toggle = () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
    } else {
      sidebar.classList.toggle('collapsed');
      main.classList.toggle('expanded');
    }
  };
  document.getElementById('sidebar-toggle').addEventListener('click', toggle);
  document.getElementById('topbar-toggle').addEventListener('click', toggle);
}

// ── Login ──
document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.querySelector('.btn-text').classList.add('d-none');
  btn.querySelector('.btn-spinner').classList.remove('d-none');
  btn.disabled = true;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('d-none');
  try {
    const data = await api('POST', '/auth/login', {
      username: document.getElementById('login-code').value.trim(),
      password: document.getElementById('login-pass').value,
    });
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
  } finally {
    btn.querySelector('.btn-text').classList.remove('d-none');
    btn.querySelector('.btn-spinner').classList.add('d-none');
    btn.disabled = false;
  }
});

// ── Logout ──
document.getElementById('nav-logout').addEventListener('click', e => {
  e.preventDefault();
  if (typeof destroyChat === 'function') destroyChat();
  clearSession();
  document.getElementById('page-app').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
});

// ── Show app after login ──
function showApp() {
  document.getElementById('page-login').classList.remove('active');
  const appEl = document.getElementById('page-app');
  appEl.classList.add('active');
  document.getElementById('sidebar-name').textContent = STATE.fullName;

  const isAdmin = STATE.role === 'admin';
  const isEmployee = STATE.user_type === 'employee';
  const isIntern = !isAdmin && !isEmployee;

  // Role label
  let roleLabel = 'Thực tập sinh';
  if (isAdmin) roleLabel = 'Admin';
  else if (isEmployee) roleLabel = 'Nhân viên';
  document.getElementById('sidebar-role').textContent = roleLabel;

  // Menus visibility
  document.getElementById('admin-menu').classList.toggle('d-none', !isAdmin);
  document.getElementById('ai-menu').classList.toggle('d-none', !isAdmin);
  document.getElementById('employee-menu').classList.toggle('d-none', !isEmployee);

  // Nav đến trang sau login
  setupSidebar();
  startClock();
  if (typeof initChat === 'function') initChat();

  if (isAdmin) navigate('dashboard');
  else navigate('profile');
}

// ── Init ──
window.addEventListener('DOMContentLoaded', () => {
  if (loadSession()) showApp();
});
