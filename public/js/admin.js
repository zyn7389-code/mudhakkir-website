/**
 * مُذَكِّر - منطق لوحة تحكم المدير
 * يدعم تخزين ملفات Google Drive، النشر التلقائي عبر GitHub، وتصدير قاعدة البيانات
 */

const PASSWORD_KEY = 'mudhakkir_admin_password';
const TOKEN_KEY = 'mudhakkir_admin_token';
const GH_CONFIG_KEY = 'mudhakkir_github_config';

function getAdminAuthHeaders() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) return { 'Authorization': `Bearer ${token}` };
    const pwd = sessionStorage.getItem(PASSWORD_KEY);
    if (pwd) return { 'x-admin-password': pwd };
    return {};
}

// عناصر الصفحة
const loginSection = document.getElementById('login-section');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const passwordInput = document.getElementById('admin-password');
const logoutBtn = document.getElementById('logout-btn');
const uploadForm = document.getElementById('upload-form');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const filesTableBody = document.getElementById('files-table-body');
const adminEmptyState = document.getElementById('admin-empty-state');
const btnExportJson = document.getElementById('btn-export-json');

// عناصر إعدادات GitHub
const btnToggleGhSetup = document.getElementById('btn-toggle-gh-setup');
const ghSetupForm = document.getElementById('gh-setup-form');
const ghOwnerInput = document.getElementById('gh-owner');
const ghRepoInput = document.getElementById('gh-repo');
const ghTokenInput = document.getElementById('gh-token');
const btnSaveGh = document.getElementById('btn-save-gh');
const btnClearGh = document.getElementById('btn-clear-gh');
const ghStatusBadge = document.getElementById('gh-status-badge');

// عناصر الإحصاءات
const statTotal = document.getElementById('admin-stat-total');
const statSeries = document.getElementById('admin-stat-series');
const statSpeakers = document.getElementById('admin-stat-speakers');
const statCats = document.getElementById('admin-stat-cats');

// عناصر القوائم المقترحة
const speakersDatalist = document.getElementById('speakers-datalist');
const categoriesDatalist = document.getElementById('categories-datalist');

// عناصر نافذة التعديل
const editModal = document.getElementById('edit-modal');
const editModalClose = document.getElementById('edit-modal-close');
const editForm = document.getElementById('edit-form');
const editId = document.getElementById('edit-id');
const editTitle = document.getElementById('edit-title');
const editSpeaker = document.getElementById('edit-speaker');
const editCategory = document.getElementById('edit-category');
const editType = document.getElementById('edit-type');
const editStatus = document.getElementById('edit-status');
const editSource = document.getElementById('edit-source');
const editDesc = document.getElementById('edit-desc');
const editPdfUrl = document.getElementById('edit-pdf-url');
const editHtmlUrl = document.getElementById('edit-html-url');
const editCoverUrl = document.getElementById('edit-cover-url');
const editSpeakerImageUrl = document.getElementById('edit-speaker-image-url');
const editSpeakerBio = document.getElementById('edit-speaker-bio');

// حقول الغلاف والمقدّم و Google Client ID
const fileCoverUrlInput = document.getElementById('file-cover-url');
const fileSpeakerImageInput = document.getElementById('file-speaker-image');
const fileSpeakerBioInput = document.getElementById('file-speaker-bio');
const googleClientIdInput = document.getElementById('google-client-id');

let cachedAdminFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEditModal();
    setupExportButton();
    initGitHubSyncUI();

    const btnRefreshStats = document.getElementById('btn-refresh-stats');
    if (btnRefreshStats) {
        btnRefreshStats.addEventListener('click', async () => {
            btnRefreshStats.disabled = true;
            btnRefreshStats.textContent = 'جاري التحديث...';
            await loadVisitorAnalytics();
            btnRefreshStats.disabled = false;
            btnRefreshStats.textContent = '🔄 تحديث الإحصائيات';
            showToast('تم تحديث إحصائيات الزوار بنجاح', 'success');
        });
    }

    window.handleResetStats = async function() {
        if (!confirm('هل أنت متأكد من تصفير كافة الإحصائيات وبدء الرصد الفعلي الدقيق من الصفر؟')) return;
        const adminHeaders = getAdminAuthHeaders();
        try {
            const res = await fetch('/api/stats/reset', {
                method: 'POST',
                headers: { ...getAdminAuthHeaders() }
            });
            if (res.ok) {
                showToast('تم تصفير الإحصائيات بنجاح، وبدأ الرصد الفعلي الدقيق من الصفر 🎯', 'success');
                await loadVisitorAnalytics();
            } else {
                showToast('تعذر تصفير الإحصائيات', 'error');
            }
        } catch {
            showToast('تعذر الاتصال بالخادم', 'error');
        }
    };
});

async function checkAuth() {
    const headers = getAdminAuthHeaders();
    if (!headers.Authorization && !headers['x-admin-password']) return;

    try {
        const res = await fetch('/api/verify-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers }
        });
        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.token) {
                sessionStorage.setItem(TOKEN_KEY, data.token);
                sessionStorage.removeItem(PASSWORD_KEY);
            }
            showAdminPanel();
        } else {
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(PASSWORD_KEY);
        }
    } catch {
        // إبقاء شاشة تسجيل الدخول ظاهرة عند تعذر التحقق
    }
}

// === إعدادات الربط مع GitHub ===
function getGitHubConfig() {
    try {
        const raw = localStorage.getItem(GH_CONFIG_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function getGitHubHeaders() {
    const cfg = getGitHubConfig();
    if (!cfg) return {};
    const headers = {};
    if (cfg.token) headers['x-github-token'] = cfg.token;
    if (cfg.owner) headers['x-github-owner'] = cfg.owner;
    if (cfg.repo) headers['x-github-repo'] = cfg.repo;
    return headers;
}

function updateGitHubUI() {
    const cfg = getGitHubConfig();
    if (!ghStatusBadge) return;

    if (cfg && cfg.token && cfg.owner && cfg.repo) {
        ghStatusBadge.textContent = `✅ النشر التلقائي متصل ومفعّل (${cfg.owner}/${cfg.repo})`;
        ghStatusBadge.style.background = 'rgba(39, 174, 96, 0.2)';
        ghStatusBadge.style.color = '#2ecc71';
        ghStatusBadge.style.borderColor = '#27ae60';
        if (ghOwnerInput && !ghOwnerInput.value) ghOwnerInput.value = cfg.owner;
        if (ghRepoInput && !ghRepoInput.value) ghRepoInput.value = cfg.repo;
        if (ghTokenInput && !ghTokenInput.value) ghTokenInput.value = cfg.token;
    } else {
        ghStatusBadge.textContent = '⚠️ النشر التلقائي غير مفعل';
        ghStatusBadge.style.background = 'rgba(231, 76, 60, 0.2)';
        ghStatusBadge.style.color = '#e74c3c';
        ghStatusBadge.style.borderColor = '#c0392b';
    }
}

async function initGitHubSyncUI() {
    // 1. مزامنة الإعدادات فورياً مع الخادم حتى لا تُفقد عند مسح الكاش أو فتح نافذة خاصة
    try {
        const adminHeaders = getAdminAuthHeaders();
        const user = typeof getLoggedInUser === 'function' ? getLoggedInUser() : null;
        const headers = getAdminAuthHeaders();

        const res = await fetch('/api/github-config', { headers });
        if (res.ok) {
            const serverData = await res.json();
            if (serverData && serverData.configured) {
                const currentLocal = getGitHubConfig() || {};
                const merged = {
                    owner: serverData.owner || currentLocal.owner || '',
                    repo: serverData.repo || currentLocal.repo || '',
                    token: serverData.token || currentLocal.token || ''
                };
                localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(merged));
            } else {
                // إذا كان المتصفح يملك الإعدادات مسبقاً، نرفعها فوراً للخادم ليحفظها للأبد
                const localCfg = getGitHubConfig();
                if (localCfg && localCfg.token && localCfg.owner && localCfg.repo) {
                    fetch('/api/github-config', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAdminAuthHeaders()
                        },
                        body: JSON.stringify(localCfg)
                    }).catch(() => {});
                }
            }
        }
    } catch (e) {
        console.warn('GitHub config sync check:', e);
    }

    updateGitHubUI();

    const adminAutoEmailInput = document.getElementById('admin-auto-email');
    const hideAdminPublicToggle = document.getElementById('hide-admin-public-toggle');

    if (adminAutoEmailInput) {
        adminAutoEmailInput.value = localStorage.getItem('mudhakkir_admin_email') || '';
        if (hideAdminPublicToggle) {
            const savedHide = localStorage.getItem('mudhakkir_hide_admin_public');
            hideAdminPublicToggle.checked = savedHide === null ? true : savedHide === 'true';
        }
        fetch('/api/admin-config').then(r => r.json()).then(d => {
            if (d) {
                if (d.adminEmail) {
                    adminAutoEmailInput.value = d.adminEmail;
                    localStorage.setItem('mudhakkir_admin_email', d.adminEmail);
                }
                if (d.googleClientId && googleClientIdInput) {
                    googleClientIdInput.value = d.googleClientId;
                    localStorage.setItem('mudhakkir_google_client_id', d.googleClientId);
                }
                if (hideAdminPublicToggle && d.showAdminEntry !== undefined) {
                    hideAdminPublicToggle.checked = !d.showAdminEntry;
                    localStorage.setItem('mudhakkir_hide_admin_public', String(!d.showAdminEntry));
                }
            }
        }).catch(() => {});

        adminAutoEmailInput.addEventListener('change', () => {
            const email = adminAutoEmailInput.value.trim().toLowerCase();
            localStorage.setItem('mudhakkir_admin_email', email);
            const adminHeaders = getAdminAuthHeaders();
            fetch('/api/admin-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeaders()
                },
                body: JSON.stringify({ adminEmail: email })
            }).catch(() => {});
            showToast('تم حفظ بريد المدير للدخول التلقائي بنجاح', 'success');
        });
    }

    if (googleClientIdInput) {
        googleClientIdInput.value = localStorage.getItem('mudhakkir_google_client_id') || '';
        googleClientIdInput.addEventListener('change', () => {
            const gClientId = googleClientIdInput.value.trim();
            localStorage.setItem('mudhakkir_google_client_id', gClientId);
            const adminHeaders = getAdminAuthHeaders();
            fetch('/api/admin-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeaders()
                },
                body: JSON.stringify({ googleClientId: gClientId })
            }).catch(() => {});
            showToast('تم حفظ معرّف Google Client ID بنجاح', 'success');
        });
    }

    // ربط زر حفظ إعدادات المدير ومعرّف Google Client ID المستقل تماماً
    const btnSaveAdminSettings = document.getElementById('btn-save-admin-settings');
    if (btnSaveAdminSettings) {
        btnSaveAdminSettings.addEventListener('click', async () => {
            const adminEmail = adminAutoEmailInput ? adminAutoEmailInput.value.trim().toLowerCase() : '';
            const googleClientId = googleClientIdInput ? googleClientIdInput.value.trim() : '';
            const isHidden = hideAdminPublicToggle ? hideAdminPublicToggle.checked : true;
            const showAdminEntry = !isHidden;

            if (adminEmail) localStorage.setItem('mudhakkir_admin_email', adminEmail);
            if (googleClientId) localStorage.setItem('mudhakkir_google_client_id', googleClientId);
            localStorage.setItem('mudhakkir_hide_admin_public', String(isHidden));

            const adminHeaders = getAdminAuthHeaders();
            btnSaveAdminSettings.disabled = true;
            btnSaveAdminSettings.textContent = 'جاري الحفظ...';

            try {
                await fetch('/api/admin-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAdminAuthHeaders()
                    },
                    body: JSON.stringify({ adminEmail, googleClientId, showAdminEntry })
                });
                showToast('تم حفظ إعدادات بريد المدير ومعرّف Google وحالة الإخفاء بنجاح! ✅', 'success');
            } catch (err) {
                showToast('تم الحفظ محلياً في المتصفح بنجاح! ✅', 'success');
            } finally {
                btnSaveAdminSettings.disabled = false;
                btnSaveAdminSettings.textContent = '💾 حفظ إعدادات المدير وGoogle';
            }
        });
    }

    if (btnToggleGhSetup && ghSetupForm) {
        btnToggleGhSetup.addEventListener('click', () => {
            ghSetupForm.classList.toggle('hidden');
        });
    }

    if (btnSaveGh) {
        btnSaveGh.addEventListener('click', async () => {
            const owner = ghOwnerInput.value.trim();
            const repo = ghRepoInput.value.trim();
            const token = ghTokenInput.value.trim();

            if (!owner || !repo || !token) {
                showToast('يرجى ملء كافة حقول اسم المستخدم، والمستودع، والـ Token', 'error');
                return;
            }

            const adminHeaders = getAdminAuthHeaders();
            btnSaveGh.disabled = true;
            btnSaveGh.textContent = 'جاري التحقق...';

            try {
                // 1. فحص فوري ومباشر مع GitHub API من المتصفح
                const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github+json'
                    }
                });

                if (ghRes.status === 200) {
                    const ghConfigObj = { owner, repo, token };
                    localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(ghConfigObj));

                    // حفظ دائم على الخادم لعدم ضياع الربط أبداً
                    fetch('/api/github-config', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAdminAuthHeaders()
                        },
                        body: JSON.stringify(ghConfigObj)
                    }).catch(() => {});

                    if (adminAutoEmailInput && adminAutoEmailInput.value.trim()) {
                        const aEmail = adminAutoEmailInput.value.trim().toLowerCase();
                        localStorage.setItem('mudhakkir_admin_email', aEmail);
                        fetch('/api/admin-config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
                            body: JSON.stringify({ adminEmail: aEmail })
                        }).catch(() => {});
                    }
                    updateGitHubUI();
                    showToast('تم الاتصال بمستودع GitHub وحفظ الإعدادات بنجاح! النشر التلقائي مفعّل الآن ✅', 'success');
                    return;
                } else if (ghRes.status === 401) {
                    showToast('رمز الـ Token غير صحيح أو منتهي الصلاحية (كود 401: تأكد من نسخ الرمز كاملاً)', 'error');
                    return;
                } else if (ghRes.status === 404) {
                    showToast('المستودع غير موجود (كود 404): تأكد من صحة اسم الحساب واسم المستودع بالضبط، وتأكد من تحديد صلاحية repo عند إنشاء الرمز', 'error');
                    return;
                } else if (ghRes.status === 403) {
                    showToast('صلاحيات الرمز غير كافية أو تم تجاوز الحد (كود 403: تأكد من تفعيل صلاحية repo)', 'error');
                    return;
                } else {
                    const ghErr = await ghRes.json().catch(() => ({}));
                    showToast(`خطأ من GitHub (كود ${ghRes.status}): ${ghErr.message || 'يرجى مراجعة البيانات'}`, 'error');
                    return;
                }
            } catch (browserErr) {
                // 2. إذا فشل الاتصال المباشر من المتصفح (مثلاً مانع إعلانات)، نجرب عبر الخادم
                try {
                    const res = await fetch('/api/github-test', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAdminAuthHeaders(),
                            'x-github-owner': owner,
                            'x-github-repo': repo,
                            'x-github-token': token
                        }
                    });

                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                        localStorage.setItem(GH_CONFIG_KEY, JSON.stringify({ owner, repo, token }));
                        updateGitHubUI();
                        if (ghSetupForm) ghSetupForm.classList.add('hidden');
                        showToast('تم الاتصال بمستودع GitHub بنجاح! النشر التلقائي مفعّل الآن ✅', 'success');
                    } else {
                        showToast(data.error || 'تعذر الاتصال بمستودع GitHub', 'error');
                    }
                } catch (serverErr) {
                    showToast('حدث خطأ أثناء فحص اتصال GitHub. تأكد من اتصال الإنترنت وصحة الرمز', 'error');
                }
            } finally {
                btnSaveGh.disabled = false;
                btnSaveGh.textContent = 'حفظ واختبار الاتصال';
            }
        });
    }

    if (btnClearGh) {
        btnClearGh.addEventListener('click', () => {
            localStorage.removeItem(GH_CONFIG_KEY);
            if (ghOwnerInput) ghOwnerInput.value = '';
            if (ghRepoInput) ghRepoInput.value = '';
            if (ghTokenInput) ghTokenInput.value = '';
            updateGitHubUI();
            showToast('تم إلغاء ربط GitHub', 'info');
        });
    }
}

// === تسجيل الدخول كمدير ===
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) return;

    try {
        const response = await fetch('/api/verify-admin', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-password': password 
            }
        });

        if (response.ok) {
            const data = await response.json().catch(() => ({}));
            if (data.token) {
                sessionStorage.setItem(TOKEN_KEY, data.token);
            }
            sessionStorage.removeItem(PASSWORD_KEY);
            loginError.classList.add('hidden');
            showAdminPanel();
            showToast('تم تسجيل الدخول بنجاح كمدير', 'success');
        } else {
            loginError.classList.remove('hidden');
            showToast('كلمة المرور غير صحيحة', 'error');
        }
    } catch {
        showToast('تعذر الاتصال بالخادم', 'error');
    }
});

// === تسجيل الخروج ===
logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PASSWORD_KEY);
    adminPanel.classList.add('hidden');
    loginSection.classList.remove('hidden');
    passwordInput.value = '';
    showToast('تم تسجيل الخروج من لوحة التحكم', 'info');
});

function showAdminPanel() {
    loginSection.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    updateGitHubUI();
    loadAdminData();
}

// === تحميل بيانات لوحة التحكم ===
async function loadAdminData() {
    try {
        const [homeRes, filesRes] = await Promise.all([
            fetch('/api/home'),
            fetch('/api/files')
        ]);
        const homeData = await homeRes.json();
        const files = await filesRes.json();
        cachedAdminFiles = files;

        // تحديث الإحصاءات
        if (homeData.stats) {
            statTotal.textContent = toArabicNumerals(homeData.stats.totalItems || 0);
            statSeries.textContent = toArabicNumerals(homeData.stats.totalSeries || 0);
            statSpeakers.textContent = toArabicNumerals(homeData.stats.totalSpeakers || 0);
            statCats.textContent = toArabicNumerals(homeData.stats.totalCategories || 0);
        }

        // ملء القوائم المقترحة
        populateDatalists(homeData.categories || [], files);

        // ملء جدول المواد
        renderFilesTable(files);

        // تحميل خانة إحصائية الزوار الخاصة بالمدير
        await loadVisitorAnalytics();
    } catch (e) {
        console.error('Error loading admin data:', e);
        showToast('فشل في تحميل بيانات المواد', 'error');
    }
}

// === تحميل خانة إحصائية الزوار الشاملة للمدير ===
async function loadVisitorAnalytics() {
    const adminHeaders = getAdminAuthHeaders();
    if (!adminHeaders.Authorization && !adminHeaders["x-admin-password"]) return;

    try {
        const res = await fetch('/api/stats/admin', {
            headers: { ...getAdminAuthHeaders() }
        });
        if (!res.ok) return;
        const data = await res.json();

        // 1. تحديث بطاقات المؤشرات
        const elVisitors = document.getElementById('admin-analytics-visitors');
        const elRegistered = document.getElementById('admin-analytics-registered');
        const elTime = document.getElementById('admin-analytics-time');
        const elAvg = document.getElementById('admin-analytics-avg');
        const elViews = document.getElementById('admin-analytics-pageviews');

        if (elVisitors) elVisitors.textContent = toArabicNumerals(data.totalVisitors || 0);
        if (elRegistered) elRegistered.textContent = toArabicNumerals(data.registeredUsers || 0);
        if (elTime) elTime.textContent = toArabicNumerals(data.totalReadingHours || '0');
        if (elAvg) elAvg.textContent = toArabicNumerals(data.avgMinutesPerVisitor || '0');
        if (elViews) elViews.textContent = toArabicNumerals(data.pageViews || 0);

        // 2. تحديث قائمة أكثر المواد قراءة
        const topMaterialsList = document.getElementById('admin-top-materials-list');
        if (topMaterialsList) {
            if (!data.topMaterials || data.topMaterials.length === 0) {
                topMaterialsList.innerHTML = '<p class="text-muted" style="text-align: center; margin: 10px 0;">لا توجد تفاعلات مسجلة بعد</p>';
            } else {
                topMaterialsList.innerHTML = data.topMaterials.map((m, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                        <span style="font-weight: 600;">${toArabicNumerals(idx + 1)}. ${escapeHtml(m.title)}</span>
                        <span class="badge-tag" style="background: rgba(247, 186, 7, 0.15); color: var(--gold);">${toArabicNumerals(m.views)} قراءة</span>
                    </div>
                `).join('');
            }
        }

        // 3. تحديث سجل الجلسات الأخيرة
        const recentSessionsList = document.getElementById('admin-recent-sessions-list');
        if (recentSessionsList) {
            if (!data.recentSessions || data.recentSessions.length === 0) {
                recentSessionsList.innerHTML = '<p class="text-muted" style="text-align: center; margin: 10px 0;">لا توجد جلسات حديثة</p>';
            } else {
                recentSessionsList.innerHTML = data.recentSessions.map(s => {
                    const durM = Math.round((s.durationSeconds || 60) / 60);
                    const timeStr = formatArabicDate(s.date) || 'اليوم';
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.82rem;">
                            <span>🔹 ${escapeHtml(s.page || 'تصفح')} (${escapeHtml(s.type || 'زيارة')})</span>
                            <span style="color: var(--gold);">${toArabicNumerals(durM)} دقيقة • ${timeStr}</span>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error loading visitor analytics:', err);
    }
}

function populateDatalists(categories, files) {
    if (categoriesDatalist) {
        categoriesDatalist.innerHTML = '';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            categoriesDatalist.appendChild(opt);
        });
    }

    if (speakersDatalist) {
        speakersDatalist.innerHTML = '';
        const speakers = [...new Set(files.map(f => f.speaker).filter(Boolean))];
        speakers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            speakersDatalist.appendChild(opt);
        });
    }
}

function renderFilesTable(files) {
    filesTableBody.innerHTML = '';

    if (files.length === 0) {
        adminEmptyState.classList.remove('hidden');
        return;
    }

    adminEmptyState.classList.add('hidden');

    files.forEach(item => {
        const tr = document.createElement('tr');

        const formats = [];
        if (item.htmlFile || item.htmlUrl || item.type === 'html') formats.push('🌐 تفاعلي');
        if (item.pdfFile || item.pdfUrl || item.type === 'pdf') formats.push('📕 PDF');
        const formatsText = formats.join(' • ') || '—';

        const coverImg = resolveImageUrl(item.coverImage, 'cover');
        const speakerImg = item.speakerImage ? resolveImageUrl(item.speakerImage, 'speaker') : null;
        const speakerAvatarHtml = speakerImg
            ? `<img src="${speakerImg}" class="speaker-avatar-tiny" style="width: 22px; height: 22px;" alt="${escapeHtml(item.speaker)}">`
            : `🎙️`;

        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${coverImg}" style="width: 44px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);" onerror="this.src='assets/default-cover.svg'">
                    <a href="item.html?id=${item.id}" target="_blank" style="color: var(--gold); font-weight: 700;">
                        ${escapeHtml(item.title)}
                    </a>
                </div>
            </td>
            <td>
                <span style="display: inline-flex; align-items: center; gap: 6px;">
                    ${speakerAvatarHtml}
                    <span>${escapeHtml(item.speaker || '—')}</span>
                </span>
            </td>
            <td><span class="badge-tag">📁 ${escapeHtml(item.category || 'عام')}</span></td>
            <td>${escapeHtml(item.type || 'محاضرة')}</td>
            <td><span class="item-status-badge">✓ ${escapeHtml(item.reviewStatus || 'مراجَع')}</span></td>
            <td>${formatsText}</td>
            <td style="white-space: nowrap;">
                <button class="btn btn-sm btn-outline" onclick="openEditModal('${item.id}')" style="margin-inline-end: 6px;">
                    ✏️ تعديل
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteMaterial('${item.id}', '${escapeHtml(item.title)}')">
                    🗑️ حذف
                </button>
            </td>
        `;
        filesTableBody.appendChild(tr);
    });
}

// === إضافة مادة جديدة (Google Drive أو رفع ملف محلي مع مزامنة GitHub) ===
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('file-title').value.trim();
    const speaker = document.getElementById('file-speaker').value.trim();
    const category = document.getElementById('file-category').value.trim();
    const type = document.getElementById('file-type').value;
    const reviewStatus = document.getElementById('file-status').value;
    const source = document.getElementById('file-source').value.trim();
    const desc = document.getElementById('file-desc').value.trim();

    const pdfDriveUrl = document.getElementById('pdf-drive-url').value.trim();
    const htmlDriveUrl = document.getElementById('html-drive-url').value.trim();
    const coverUrl = fileCoverUrlInput ? fileCoverUrlInput.value.trim() : '';
    const speakerImg = fileSpeakerImageInput ? fileSpeakerImageInput.value.trim() : '';
    const speakerBio = fileSpeakerBioInput ? fileSpeakerBioInput.value.trim() : '';

    const htmlFileInput = document.getElementById('input-html-file');
    const pdfFileInput = document.getElementById('input-pdf-file');

    const htmlFile = htmlFileInput ? htmlFileInput.files[0] : null;
    const pdfFile = pdfFileInput ? pdfFileInput.files[0] : null;

    if (!title) {
        showToast('يرجى كتابة عنوان المادة', 'error');
        return;
    }

    const adminHeaders = getAdminAuthHeaders();
    const ghHeaders = getGitHubHeaders();

    progressContainer.classList.remove('hidden');
    progressFill.style.width = '30%';
    progressText.textContent = '٣٠٪ جاري تجهيز المادة...';

    try {
        let response;

        // إذا تم اختيار ملفات محلية للرفع
        if (htmlFile || pdfFile) {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('speaker', speaker);
            formData.append('category', category);
            formData.append('type', type);
            formData.append('reviewStatus', reviewStatus);
            formData.append('originalSourceUrl', source);
            formData.append('description', desc);
            formData.append('pdfUrl', pdfDriveUrl);
            formData.append('htmlUrl', htmlDriveUrl);
            formData.append('coverImage', coverUrl);
            formData.append('speakerImage', speakerImg);
            formData.append('speakerBio', speakerBio);

            if (htmlFile) formData.append('htmlFile', htmlFile);
            if (pdfFile) formData.append('pdfFile', pdfFile);

            progressFill.style.width = '60%';
            progressText.textContent = '٦٠٪ جاري حفظ المادة ومزامنة البيانات...';

            response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    ...getAdminAuthHeaders(),
                    ...ghHeaders
                },
                body: formData
            });
        } else {
            // تسجيل بروابط Google Drive
            progressFill.style.width = '60%';
            progressText.textContent = '٦٠٪ جاري توثيق روابط Google Drive ومزامنة GitHub...';

            response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAdminAuthHeaders(),
                    ...ghHeaders
                },
                body: JSON.stringify({
                    title,
                    speaker,
                    category,
                    type,
                    reviewStatus,
                    originalSourceUrl: source,
                    description: desc,
                    pdfUrl: pdfDriveUrl,
                    htmlUrl: htmlDriveUrl,
                    coverImage: coverUrl,
                    speakerImage: speakerImg,
                    speakerBio: speakerBio
                })
            });
        }

        progressFill.style.width = '100%';
        progressText.textContent = '١٠٠٪ تم الحفظ بنجاح!';

        const result = await response.json();

        if (response.ok) {
            showToast(result.message || 'تمت إضافة المادة بنجاح', 'success');
            uploadForm.reset();
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                progressFill.style.width = '0%';
            }, 1000);
            loadAdminData();
        } else {
            showToast(result.error || 'فشل في حفظ المادة', 'error');
            progressContainer.classList.add('hidden');
        }
    } catch (err) {
        console.error('Upload error:', err);
        showToast(err.message || 'حدث خطأ أثناء حفظ المادة', 'error');
        progressContainer.classList.add('hidden');
    }
});

// === تعديل مادة ===
function setupEditModal() {
    if (editModalClose) {
        editModalClose.addEventListener('click', () => {
            editModal.classList.add('hidden');
        });
    }

    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                editModal.classList.add('hidden');
            }
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = editId.value;
            const adminHeaders = getAdminAuthHeaders();
            const ghHeaders = getGitHubHeaders();

            const payload = {
                title: editTitle.value.trim(),
                speaker: editSpeaker.value.trim(),
                category: editCategory.value.trim(),
                type: editType.value,
                reviewStatus: editStatus.value,
                originalSourceUrl: editSource.value.trim(),
                description: editDesc.value.trim(),
                pdfUrl: editPdfUrl ? editPdfUrl.value.trim() : '',
                htmlUrl: editHtmlUrl ? editHtmlUrl.value.trim() : '',
                coverImage: editCoverUrl ? editCoverUrl.value.trim() : '',
                speakerImage: editSpeakerImageUrl ? editSpeakerImageUrl.value.trim() : '',
                speakerBio: editSpeakerBio ? editSpeakerBio.value.trim() : ''
            };

            try {
                const res = await fetch(`/api/files/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAdminAuthHeaders(),
                        ...ghHeaders
                    },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'تم حفظ التعديلات بنجاح', 'success');
                    editModal.classList.add('hidden');
                    loadAdminData();
                } else {
                    showToast(data.error || 'فشل حفظ التعديلات', 'error');
                }
            } catch {
                showToast('تعذر الاتصال بالخادم لتحديث البيانات', 'error');
            }
        });
    }
}

window.openEditModal = function(id) {
    const item = cachedAdminFiles.find(f => f.id === id);
    if (!item) return;

    editId.value = item.id;
    editTitle.value = item.title || '';
    editSpeaker.value = item.speaker || '';
    editCategory.value = item.category || '';
    editType.value = item.type || 'محاضرة';
    editStatus.value = item.reviewStatus || 'مراجَع';
    editSource.value = item.originalSourceUrl || '';
    editDesc.value = item.description || '';
    if (editPdfUrl) editPdfUrl.value = item.pdfUrl || item.pdfFile || '';
    if (editHtmlUrl) editHtmlUrl.value = item.htmlUrl || item.htmlFile || '';
    if (editCoverUrl) editCoverUrl.value = item.coverImage || '';
    if (editSpeakerImageUrl) editSpeakerImageUrl.value = item.speakerImage || '';
    if (editSpeakerBio) editSpeakerBio.value = item.speakerBio || '';

    editModal.classList.remove('hidden');
};

// === حذف مادة ===
window.deleteMaterial = async function(id, title) {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف مادة «${title}» نهائياً من المكتبة؟`)) {
        return;
    }

    const adminHeaders = getAdminAuthHeaders();
    const ghHeaders = getGitHubHeaders();

    try {
        const response = await fetch(`/api/files/${id}`, {
            method: 'DELETE',
            headers: {
                ...getAdminAuthHeaders(),
                ...ghHeaders
            }
        });

        const data = await response.json();
        if (response.ok) {
            showToast(data.message || 'تم حذف المادة بنجاح', 'success');
            loadAdminData();
        } else {
            showToast(data.error || 'فشل في حذف المادة', 'error');
        }
    } catch {
        showToast('تعذر الاتصال بالخادم لحذف المادة', 'error');
    }
};

// === إعداد زر تصدير قاعدة البيانات ===
function setupExportButton() {
    if (btnExportJson) {
        btnExportJson.addEventListener('click', () => {
            showToast('جاري تصدير وتحميل files.json كنسخة احتياطية...', 'info');
        });
    }
}
