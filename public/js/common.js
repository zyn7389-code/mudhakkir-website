/**
 * مُذَكِّر - الدوال والمكونات المشتركة
 * دعم Google Drive، تسجيل Google الموثق، المفضلة، وسجل القراءة، وقفل لوحة التحكم
 */

// مفاتيح التخزين المحلي
const READING_HISTORY_KEY = 'mudhakkir_reading_history';
const FAVORITES_KEY = 'mudhakkir_favorites';
const USER_INFO_KEY = 'mudhakkir_user_info';
const ADMIN_TOKEN_KEY = 'mudhakkir_admin_token';
const ADMIN_PASSWORD_KEY = 'mudhakkir_admin_password';

// ==============================
// 1. دعم وتفسير روابط Google Drive
// ==============================

/**
 * تحليل روابط Google Drive واستخراج معرف الملف والروابط الجاهزة
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
 */
function getMaterialFileUrl(fileOrUrl, mode = 'view', isHtml = false) {
    if (!fileOrUrl || typeof fileOrUrl !== 'string') return null;
    const trimmed = fileOrUrl.trim();
    if (!trimmed) return null;

    const driveInfo = parseGoogleDriveUrl(trimmed);
    if (driveInfo) {
        if (mode === 'download') return driveInfo.downloadUrl;
        // إذا كان الاستدعاء لملف تفاعلي HTML على Google Drive
        if (mode === 'html' || isHtml) {
            return `/api/render-html/${driveInfo.fileId}`;
        }
        return driveInfo.previewUrl;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    return `/uploads/${trimmed}`;
}

/**
 * تحليل وحل روابط الصور (يدعم Google Drive والصور المباشرة مع صور افتراضية راقية)
 */
function resolveImageUrl(url, fallbackType = 'cover') {
    if (!url || typeof url !== 'string' || !url.trim()) {
        return fallbackType === 'speaker' ? 'assets/default-speaker.svg' : 'assets/default-cover.svg';
    }
    const trimmed = url.trim();
    const driveInfo = parseGoogleDriveUrl(trimmed);
    if (driveInfo) {
        // رابط صورة مباشر وسريع من Google Drive
        return `https://drive.google.com/thumbnail?id=${driveInfo.fileId}&sz=w800`;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        return trimmed;
    }
    return `/uploads/${trimmed}`;
}

/**
 * استخراج صورة غلاف المادة العلمية:
 * 1. إذا حُدد رابط غلاف خاص يُستخدم فوراً.
 * 2. الصفحة الأولى من ملف الـ PDF كغلاف مصمم جاهز تلقائياً (يدعم روابط Google Drive عبر thumbnail API المباشر).
 * 3. الصفحة الأولى من الملف التفاعلي HTML إن كان على Google Drive.
 * 4. الغلاف الافتراضي الراقي لمشروع مُذَكِّر.
 */
function resolveItemCover(item) {
    if (!item) return 'assets/default-cover.svg';

    // 1. غلاف مخصص
    if (item.coverImage && typeof item.coverImage === 'string' && item.coverImage.trim()) {
        return resolveImageUrl(item.coverImage, 'cover');
    }

    // 2. الصفحة الأولى من ملف PDF (وهي الغلاف المصمم الجاهز في تفريغات المحاضرات والكتب)
    const pdfTarget = item.pdfUrl || item.pdfFile || (item.type === 'pdf' ? item.filename : null);
    if (pdfTarget && typeof pdfTarget === 'string') {
        const drive = parseGoogleDriveUrl(pdfTarget);
        if (drive && drive.fileId) {
            // Google Drive thumbnail endpoint يُرجع الصفحة الأولى من ملف PDF كصورة فائقة الدقة والسرعة
            return `https://drive.google.com/thumbnail?id=${drive.fileId}&sz=w800`;
        }
    }

    // 3. فحص ملف HTML إن كان في جوجل درايف
    const htmlTarget = item.htmlUrl || item.htmlFile || (item.type === 'html' ? item.filename : null);
    if (htmlTarget && typeof htmlTarget === 'string') {
        const drive = parseGoogleDriveUrl(htmlTarget);
        if (drive && drive.fileId) {
            return `https://drive.google.com/thumbnail?id=${drive.fileId}&sz=w800`;
        }
    }

    return 'assets/default-cover.svg';
}

// ==============================
// 2. إدارة حساب المستخدم وتسجيل الدخول الموثق عبر Google
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
    const profileAvatarCircle = document.getElementById('profile-avatar-circle');
    const profileVerifiedBadge = document.getElementById('profile-verified-badge');
    const adminPanelProfileLink = document.getElementById('admin-panel-profile-link');
    const btnAdminUnlock = document.getElementById('btn-admin-unlock');

    // إخفاء أي زر لإلغاء قفل وضع المدير تماماً عن أعين الزوار
    if (btnAdminUnlock) {
        btnAdminUnlock.style.display = 'none';
    }

    const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    const isAdminLoggedIn = Boolean(adminToken);

    if (userBtnLabel) {
        userBtnLabel.textContent = user ? (user.name || 'حسابي') : 'دخول / حساب';
    }
    if (user && profileGreeting) {
        profileGreeting.textContent = `مرحباً بك، ${user.name || 'طالب العلم'}`;
        if (profileEmail) profileEmail.textContent = user.email || '';
        if (profileAvatarCircle) {
            if (user.picture) {
                profileAvatarCircle.innerHTML = `<img src="${user.picture}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                profileAvatarCircle.textContent = (user.name || 'ط')[0].toUpperCase();
            }
        }
        if (profileVerifiedBadge) {
            profileVerifiedBadge.style.display = (user && user.isGoogle && user.verified === true) ? 'inline-block' : 'none';
        }
    }

    // إظهار رابط لوحة التحكم للمدير فقط عبر الحقن الديناميكي عند وجود توكن إداري موثق
    const profileActions = document.querySelector('#profile-wrap .profile-actions');
    const existingAdminLink = document.getElementById('admin-panel-profile-link');
    if (isAdminLoggedIn && profileActions) {
        if (!existingAdminLink) {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.id = 'admin-panel-profile-link';
            adminLink.className = 'btn btn-outline btn-block';
            adminLink.style.cssText = 'border-color: var(--gold); color: var(--gold); font-weight: bold;';
            adminLink.textContent = '👑 لوحة الإدارة والتحكم';
            const logoutBtnEl = document.getElementById('user-logout-btn');
            profileActions.insertBefore(adminLink, logoutBtnEl || null);
        }
    } else if (existingAdminLink) {
        existingAdminLink.remove();
    }
}

/**
 * حفظ مستخدم مسجل عبر Google (بعد التحقق الرسمي من الخادم فقط) وتحديث الواجهة
 */
function completeGoogleLogin(userData) {
    if (!userData || !userData.email || userData.verified !== true) {
        showToast('تعذر التحقق من حساب Google بشكل رسمي', 'error');
        return;
    }

    const email = userData.email.toLowerCase().trim();
    const name = (userData.name || '').trim() || email.split('@')[0];
    const user = {
        name: name,
        email: email,
        picture: userData.picture || 'assets/logo.jpg',
        isGoogle: true,
        verified: true,
        loginDate: new Date().toISOString()
    };

    localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));

    // إشعارات الدخول (التحقق من صلاحية الإدارة يتم حصرياً عبر الخادم بتوكن موقّع)
    if (userData.adminToken) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, userData.adminToken);
        showToast(`مرحباً بك يا مدير الموقع! تم تفعيل صلاحيات الإدارة بأمان 👑`, 'success');
    } else {
        showToast(`تم تسجيل الدخول بنجاح! أهلاً بك يا ${name}`, 'success');
    }

    updateUserUI();

    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.classList.add('hidden');
}

/**
 * معالجة النقر على زر الدخول عبر Google (المصادقة الرسمية والتحقق عبر الخادم فقط)
 */
async function handleGoogleAuth() {
    let configuredClientId = (localStorage.getItem('mudhakkir_google_client_id') || '').trim();

    if (!configuredClientId) {
        try {
            const res = await fetch('/api/admin-config');
            if (res.ok) {
                const cfg = await res.json();
                if (cfg && cfg.googleClientId) {
                    configuredClientId = cfg.googleClientId.trim();
                    localStorage.setItem('mudhakkir_google_client_id', configuredClientId);
                }
            }
        } catch {}
    }

    if (!configuredClientId) {
        showToast('تسجيل الدخول عبر Google غير مفعّل بعد من لوحة التحكم', 'error');
        return;
    }

    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        showToast('جاري تحميل خدمة تسجيل الدخول من Google، يرجى المحاولة بعد لحظة', 'info');
        return;
    }

    try {
        google.accounts.id.initialize({
            client_id: configuredClientId,
            callback: async (response) => {
                if (!response || !response.credential) {
                    showToast('لم تكتمل عملية التحقق من Google', 'error');
                    return;
                }
                try {
                    const verifyRes = await fetch('/api/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ credential: response.credential })
                    });
                    const verifyData = await verifyRes.json().catch(() => ({}));
                    if (verifyRes.ok && verifyData.user && verifyData.user.verified) {
                        completeGoogleLogin({
                            ...verifyData.user,
                            adminToken: verifyData.adminToken || null
                        });
                    } else {
                        showToast(verifyData.error || 'فشل التحقق من حساب Google على الخادم', 'error');
                    }
                } catch {
                    showToast('تعذر الاتصال بالخادم للتحقق من حساب Google', 'error');
                }
            }
        });
        google.accounts.id.prompt();
    } catch (e) {
        console.warn('Google Identity error:', e);
        showToast('تعذر فتح نافذة تسجيل الدخول عبر Google', 'error');
    }
}

function initAuthUI() {
    const userMenuBtn = document.getElementById('user-menu-btn');
    const authModal = document.getElementById('auth-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const loginFormWrap = document.getElementById('login-form-wrap');
    const profileWrap = document.getElementById('profile-wrap');
    const userLogoutBtn = document.getElementById('user-logout-btn');
    const btnGoogleLogin = document.getElementById('btn-google-login');
    const btnAdminUnlock = document.getElementById('btn-admin-unlock');

    function showWrap(type) {
        if (!loginFormWrap || !profileWrap) return;
        loginFormWrap.classList.add('hidden');
        profileWrap.classList.add('hidden');

        if (type === 'login') loginFormWrap.classList.remove('hidden');
        if (type === 'profile') {
            updateUserUI();
            profileWrap.classList.remove('hidden');
        }
    }

    updateUserUI();

    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', handleGoogleAuth);
    }

    if (btnAdminUnlock) {
        btnAdminUnlock.addEventListener('click', async () => {
            const password = prompt('أدخل كلمة مرور الإدارة:');
            if (!password) return;

            try {
                const res = await fetch('/api/verify-admin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': password
                    }
                });

                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    if (data.token) sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
                    updateUserUI();
                    showToast('تم التحقق بنجاح كمدير للموقع!', 'success');
                    window.location.href = 'admin.html';
                } else {
                    showToast('كلمة المرور غير صحيحة', 'error');
                }
            } catch {
                showToast('تعذر الاتصال بالخادم', 'error');
            }
        });
    }

    if (userMenuBtn && authModal) {
        userMenuBtn.addEventListener('click', () => {
            const user = getLoggedInUser();
            if (user && user.isGoogle && user.verified === true) {
                showWrap('profile');
            } else {
                if (user) localStorage.removeItem(USER_INFO_KEY);
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

    if (userLogoutBtn) {
        userLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem(USER_INFO_KEY);
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
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

        // تسجيل قراءة المادة لإحصائية الزوار لدى المدير
        fetch('/api/stats/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'read_item',
                itemId,
                itemTitle: title,
                durationSeconds: 60
            })
        }).catch(() => {});
    } catch {
        // تجاهل
    }
}

// ==============================
// 5. عداد وقت المدارسة وأوسمة طلب العلم التحفيزية
// ==============================
const STUDY_SECONDS_KEY = 'mudhakkir_total_study_seconds';

const STUDY_RANKS = [
    {
        id: 'starter',
        minMinutes: 0,
        maxMinutes: 5,
        title: 'طالب مبتدئ',
        icon: '🌿',
        quote: 'بداية الغرس المبارك.. قال الإمام الشافعي: «العلم صيدٌ والكتابة قيده».',
        desc: 'خطواتك الأولى في رياض العلم وتفريغات المعرفة'
    },
    {
        id: 'consistent',
        minMinutes: 5,
        maxMinutes: 15,
        title: 'قارئ مواظب',
        icon: '📖',
        quote: 'ثباتٌ وإقبال.. قال ابن الجوزي: «من عرف شرف العمر وقيمة أوقاته لم يضيّع منه لحظة».',
        desc: 'مقبلٌ على مجالس المدارسة وملازمٌ للفوائد العلمية'
    },
    {
        id: 'insightful',
        minMinutes: 15,
        maxMinutes: 30,
        title: 'باحث متبصر',
        icon: '💡',
        quote: 'تأملٌ وتدبر.. «قيدوا العلم بالكتاب والمراجعة».',
        desc: 'شغوفٌ بالمدارسة والتدقيق في دقائق المسائل وحفظ الأثر'
    },
    {
        id: 'steadfast',
        minMinutes: 30,
        maxMinutes: 60,
        title: 'مُدارِس همام',
        icon: '📜',
        quote: 'همةٌ تناطح السحاب.. «صبر ساعة يورث عز الدهر وعلو الرتب».',
        desc: 'صاحب همة عالية وصبر كريم في مدارسة العلم وتحصيله'
    },
    {
        id: 'guardian',
        minMinutes: 60,
        maxMinutes: 120,
        title: 'حافظ الأوقات',
        icon: '🏆',
        quote: 'تعظيم لساعات العمر.. «الوقت أنفس ما عنيت بحفظه، وأراه أسهل ما عليك يضيع».',
        desc: 'مُعظّم لنفائس الأوقات لا يُفلت من يومه إلا بفائدة محققة'
    },
    {
        id: 'scholar_companion',
        minMinutes: 120,
        maxMinutes: Infinity,
        title: 'حليف الكتب والمجالس',
        icon: '🌟',
        quote: 'عزمٌ راسخ.. «العلم لا يعطيك بعضه حتى تعطيه كلك».',
        desc: 'أهل العزائم الصادقة وورثة هدي العلماء في الملازمة والرسوخ'
    }
];

function getStudyRank(totalMinutes) {
    for (let i = STUDY_RANKS.length - 1; i >= 0; i--) {
        if (totalMinutes >= STUDY_RANKS[i].minMinutes) {
            return STUDY_RANKS[i];
        }
    }
    return STUDY_RANKS[0];
}

function getNextStudyRank(totalMinutes) {
    for (let i = 0; i < STUDY_RANKS.length; i++) {
        if (totalMinutes < STUDY_RANKS[i].maxMinutes && STUDY_RANKS[i].maxMinutes !== Infinity) {
            return STUDY_RANKS[i + 1] || null;
        }
    }
    return null;
}

let sessionSeconds = 0;
let currentRankId = null;

function initStudyTimeTracker() {
    // 1. تسجيل زيارة عامة للموقع إن لم تُسجل في هذه الجلسة
    if (!sessionStorage.getItem('mudhakkir_visit_recorded')) {
        sessionStorage.setItem('mudhakkir_visit_recorded', '1');
        fetch('/api/stats/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'visit', path: window.location.pathname })
        }).catch(() => {});
    }

    // 2. إنشاء ويدجت العداد والوسام
    let widget = document.getElementById('study-time-widget');
    if (!widget) {
        widget = document.createElement('div');
        widget.id = 'study-time-widget';
        widget.className = 'study-time-widget';
        widget.title = 'وسامك ووقتك في طلب العلم (انقر للتفاصيل)';
        widget.innerHTML = `
            <div class="tracker-rank-icon" id="tracker-icon">🌿</div>
            <div class="tracker-info-box">
                <div class="tracker-rank-name" id="tracker-name">طالب مبتدئ</div>
                <div class="tracker-timer" id="tracker-timer">⏱️ ٠٠:٠٠</div>
            </div>
        `;
        document.body.appendChild(widget);
        widget.addEventListener('click', showStudyRankModal);
    }

    // 3. قراءة الوقت الإجمالي
    let totalSeconds = parseInt(localStorage.getItem(STUDY_SECONDS_KEY) || '0', 10);
    const initialRank = getStudyRank(totalSeconds / 60);
    currentRankId = initialRank.id;
    updateTrackerUI(0, totalSeconds, initialRank);

    // 4. تشغيل العداد الحي
    setInterval(() => {
        if (document.hidden) return;
        sessionSeconds++;
        totalSeconds++;
        localStorage.setItem(STUDY_SECONDS_KEY, totalSeconds);

        const currentMinutes = totalSeconds / 60;
        const rank = getStudyRank(currentMinutes);

        if (currentRankId && rank.id !== currentRankId) {
            currentRankId = rank.id;
            showToast(`🎉 مبارك! ارتقيت إلى وسام: ${rank.icon} «${rank.title}» في طلب العلم`, 'success');
        }

        updateTrackerUI(sessionSeconds, totalSeconds, rank);
    }, 1000);

    // 5. إرسال نبضة مزامنة دورية للخادم كل 30 ثانية لتسجيل وقت القراءة العام للمدير
    setInterval(() => {
        if (!document.hidden && sessionSeconds > 0) {
            fetch('/api/stats/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'heartbeat', durationSeconds: 30 })
            }).catch(() => {});
        }
    }, 30000);
}

function updateTrackerUI(sessionSec, totalSec, rank) {
    const iconEl = document.getElementById('tracker-icon');
    const nameEl = document.getElementById('tracker-name');
    const timerEl = document.getElementById('tracker-timer');

    if (iconEl) iconEl.textContent = rank.icon;
    if (nameEl) nameEl.textContent = rank.title;

    if (timerEl) {
        const m = Math.floor(sessionSec / 60);
        const s = sessionSec % 60;
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');
        timerEl.textContent = `⏱️ ${toArabicNumerals(mm)}:${toArabicNumerals(ss)}`;
    }
}

function showStudyRankModal() {
    const totalSec = parseInt(localStorage.getItem(STUDY_SECONDS_KEY) || '0', 10);
    const totalMinutes = Math.floor(totalSec / 60);
    const rank = getStudyRank(totalMinutes);
    const nextRank = getNextStudyRank(totalMinutes);

    let nextProgressHtml = '';
    if (nextRank) {
        const currentTierSpan = nextRank.minMinutes - rank.minMinutes;
        const userProgressInTier = Math.max(0, totalMinutes - rank.minMinutes);
        const pct = Math.min(100, Math.round((userProgressInTier / (currentTierSpan || 1)) * 100));
        const remainingMinutes = Math.max(1, nextRank.minMinutes - totalMinutes);

        nextProgressHtml = `
            <div style="margin-top: 18px; text-align: right;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--gold); margin-bottom: 6px;">
                    <span>الوسام القادم: ${nextRank.icon} ${nextRank.title}</span>
                    <span>متبقي ${toArabicNumerals(remainingMinutes)} دقيقة</span>
                </div>
                <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #d49a05, #f7ba07); border-radius: 10px; transition: width 0.3s ease;"></div>
                </div>
            </div>
        `;
    } else {
        nextProgressHtml = `
            <div style="margin-top: 14px; color: #2ecc71; font-weight: 700; font-size: 0.9rem;">
                🌟 بلغت أعلى وسام في مجالس العلم! هنيئاً لك هذا الصبر وتلك الهمة العالية.
            </div>
        `;
    }

    let modal = document.getElementById('study-rank-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'study-rank-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    const sessionMinutes = Math.floor(sessionSeconds / 60);
    const sessionSecRem = sessionSeconds % 60;
    const totalHours = (totalSec / 3600).toFixed(1);

    modal.innerHTML = `
        <div class="modal-box" style="max-width: 460px; text-align: center; border-top: 4px solid var(--gold);">
            <button class="modal-close-btn" id="study-rank-close-btn">&times;</button>
            <div style="font-size: 3.2rem; margin-bottom: 8px;">${rank.icon}</div>
            <h3 style="color: var(--gold); font-size: 1.5rem; margin-bottom: 4px;">وسام: «${rank.title}»</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 16px;">
                ${rank.desc}
            </p>

            <div style="background: rgba(247, 186, 7, 0.08); border: 1px dashed rgba(247, 186, 7, 0.4); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 0.88rem; color: #ffe699; line-height: 1.7; font-style: italic;">
                ${rank.quote}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
                    <div style="font-size: 0.78rem; color: var(--text-muted);">جلسة القراءة الحالية</div>
                    <div style="font-size: 1.15rem; color: var(--gold); font-weight: 700; margin-top: 4px;">
                        ${toArabicNumerals(sessionMinutes)} د و ${toArabicNumerals(sessionSecRem)} ث
                    </div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
                    <div style="font-size: 0.78rem; color: var(--text-muted);">إجمالي وقتك في الموقع</div>
                    <div style="font-size: 1.15rem; color: var(--gold); font-weight: 700; margin-top: 4px;">
                        ${toArabicNumerals(totalHours)} ساعة
                    </div>
                </div>
            </div>

            ${nextProgressHtml}

            <button type="button" class="btn btn-primary btn-block" id="btn-close-study-modal" style="margin-top: 20px;">
                متابعة القراءة والمدارسة 📖
            </button>
        </div>
    `;

    document.getElementById('study-rank-close-btn').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-close-study-modal').onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

// ==============================
// 6. دوال التنسيق المساعدة
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
    initStudyTimeTracker();

    // جلب بريد المدير المعتمد ومعرّف Google Client ID وخيار الإخفاء تلقائياً من الخادم
    fetch('/api/admin-config')
        .then(r => r.json())
        .then(d => {
            if (d) {
                if (d.adminEmail) {
                    localStorage.setItem('mudhakkir_admin_email', d.adminEmail.toLowerCase().trim());
                }
                if (d.googleClientId) {
                    localStorage.setItem('mudhakkir_google_client_id', d.googleClientId.trim());
                }
                if (d.showAdminEntry !== undefined) {
                    localStorage.setItem('mudhakkir_hide_admin_public', String(!d.showAdminEntry));
                }
                updateUserUI();
            }
        })
        .catch(() => {});
});
