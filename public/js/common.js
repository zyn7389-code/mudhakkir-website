/**
 * مُذَكِّر - الدوال والمكونات المشتركة
 * دعم Google Drive، المفضلة، وسجل القراءة، التنبيهات، والقائمة المتنقلة
 */

// مفاتيح التخزين المحلي
const READING_HISTORY_KEY = 'mudhakkir_reading_history';
const FAVORITES_KEY = 'mudhakkir_favorites';
const USER_INFO_KEY = 'mudhakkir_user_info';

// ==============================
// 1. دعم وتفسير روابط Google Drive
// ==============================

/**
 * تحليل روابط Google Drive واستخراج معرف الملف والروابط الجاهزة
 * يدعم مختلف صيغ روابط المشاركة من جوجل درايف
 */
function parseGoogleDriveUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    const match = trimmed.match(/(?:file\/d\/|id=|open\?id=|document\/d\/|presentation\/d\/)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        const fileId = match[1];
        return {
            isDrive: true,
            fileId: fileId,
            previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
            viewUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
        };
    }
    return null;
}

/**
 * الحصول على الرابط المناسب للمادة (للمعاينة داخل القارئ أو التحميل أو الفتح)
 * @param {string} fileOrUrl - اسم الملف أو الرابط (جوجل درايف أو غيره)
 * @param {'preview'|'download'|'view'} [mode='view']
 */
function getMaterialFileUrl(fileOrUrl, mode = 'view') {
    if (!fileOrUrl || typeof fileOrUrl !== 'string') return null;
    const trimmed = fileOrUrl.trim();
    if (!trimmed) return null;

    const driveInfo = parseGoogleDriveUrl(trimmed);
    if (driveInfo) {
        if (mode === 'download') return driveInfo.downloadUrl;
        return driveInfo.previewUrl;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    return `/uploads/${trimmed}`;
}

// ==============================
// 2. إدارة حساب المستخدم المحلي
// ==============================

function getLoggedInUser() {
    try {
        const raw = localStorage.getItem(USER_INFO_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function updateUserUI() {
    const user = getLoggedInUser();
    const userBtnLabel = document.getElementById('user-btn-label');
    const profileGreeting = document.getElementById('profile-greeting');
    const profileEmail = document.getElementById('profile-email');

    if (userBtnLabel) {
        userBtnLabel.textContent = user ? (user.name || 'حسابي') : 'دخول / حساب';
    }
    if (user && profileGreeting) {
        profileGreeting.textContent = `مرحباً بك، ${user.name || 'طالب العلم'}`;
        if (profileEmail) profileEmail.textContent = user.email || '';
    }
}

function initAuthUI() {
    const userMenuBtn = document.getElementById('user-menu-btn');
    const authModal = document.getElementById('auth-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const loginFormWrap = document.getElementById('login-form-wrap');
    const registerFormWrap = document.getElementById('register-form-wrap');
    const profileWrap = document.getElementById('profile-wrap');
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');
    const userLoginForm = document.getElementById('user-login-form');
    const userRegisterForm = document.getElementById('user-register-form');
    const userLogoutBtn = document.getElementById('user-logout-btn');

    function showWrap(type) {
        if (!loginFormWrap || !registerFormWrap || !profileWrap) return;
        loginFormWrap.classList.add('hidden');
        registerFormWrap.classList.add('hidden');
        profileWrap.classList.add('hidden');

        if (type === 'login') loginFormWrap.classList.remove('hidden');
        if (type === 'register') registerFormWrap.classList.remove('hidden');
        if (type === 'profile') {
            updateUserUI();
            profileWrap.classList.remove('hidden');
        }
    }

    updateUserUI();

    if (userMenuBtn && authModal) {
        userMenuBtn.addEventListener('click', () => {
            const user = getLoggedInUser();
            if (user) {
                showWrap('profile');
            } else {
                showWrap('login');
            }
            authModal.classList.remove('hidden');
        });
    }

    if (modalCloseBtn && authModal) {
        modalCloseBtn.addEventListener('click', () => {
            authModal.classList.add('hidden');
        });
    }

    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.classList.add('hidden');
            }
        });
    }

    if (switchToRegister) {
        switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            showWrap('register');
        });
    }

    if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            showWrap('login');
        });
    }

    if (userLoginForm) {
        userLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            if (!email || !password) return;

            const name = email.split('@')[0];
            localStorage.setItem(USER_INFO_KEY, JSON.stringify({ email, name }));
            updateUserUI();
            authModal.classList.add('hidden');
            showToast(`أهلاً بك يا ${name}! تم تسجيل الدخول`, 'success');
        });
    }

    if (userRegisterForm) {
        userRegisterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('register-name').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            if (!name || !email || !password) return;

            localStorage.setItem(USER_INFO_KEY, JSON.stringify({ email, name }));
            updateUserUI();
            authModal.classList.add('hidden');
            showToast(`تم إنشاء حسابك بنجاح في «مُذَكِّر». أهلاً بك يا ${name}!`, 'success');
        });
    }

    if (userLogoutBtn) {
        userLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem(USER_INFO_KEY);
            updateUserUI();
            authModal.classList.add('hidden');
            showToast('تم تسجيل الخروج', 'info');
        });
    }
}

// ==============================
// 3. القائمة المتنقلة للشاشات الصغيرة
// ==============================
function setupMobileMenu() {
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const mainNav = document.querySelector('.main-nav');
    if (mobileBtn && mainNav) {
        mobileBtn.addEventListener('click', () => {
            mainNav.classList.toggle('active');
        });
    }
}

// ==============================
// 4. إدارة المفضلة وسجل القراءة
// ==============================
function getSavedItemIds() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch {
        return [];
    }
}

function isItemSaved(id) {
    return getSavedItemIds().includes(id);
}

function toggleSaveItem(id, title, btn) {
    let saved = getSavedItemIds();
    const alreadySaved = saved.includes(id);

    if (alreadySaved) {
        saved = saved.filter(i => i !== id);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(saved));
        if (btn) btn.innerHTML = '🤍 حفظ في مكتبتي';
        showToast('تمت إزالة المادة من مكتبتك المحفوظة', 'info');
    } else {
        saved.push(id);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(saved));
        if (btn) btn.innerHTML = '⭐ محفوظة في مكتبتي';
        showToast('تم حفظ المادة في «مكتبتي» بنجاح', 'success');
    }
}

function recordReadHistory(itemId, title) {
    try {
        let history = JSON.parse(localStorage.getItem(READING_HISTORY_KEY) || '[]');
        history = history.filter(h => h.id !== itemId);
        history.unshift({
            id: itemId,
            title,
            timestamp: new Date().toISOString()
        });
        if (history.length > 50) history = history.slice(0, 50);
        localStorage.setItem(READING_HISTORY_KEY, JSON.stringify(history));
    } catch {
        // تجاهل
    }
}

// ==============================
// 5. دوال التنسيق المساعدة
// ==============================
function toArabicNumerals(num) {
    if (num === null || num === undefined) return '';
    const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).replace(/[0-9]/g, w => digits[+w]);
}

function formatArabicDate(isoDate) {
    if (!isoDate) return '';
    try {
        const d = new Date(isoDate);
        const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        return `${toArabicNumerals(d.getDate())} ${months[d.getMonth()]} ${toArabicNumerals(d.getFullYear())}`;
    } catch {
        return '';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// التهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    initAuthUI();
    setupMobileMenu();
});
