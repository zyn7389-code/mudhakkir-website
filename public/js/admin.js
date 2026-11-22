/**
 * مُذَكِّر - منطق لوحة تحكم المدير
 * يدعم تخزين ملفات Google Drive، الروابط المباشرة، الرفع، وتصدير قاعدة البيانات
 */

const PASSWORD_KEY = 'mudhakkir_admin_password';

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

let cachedAdminFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEditModal();
    setupExportButton();
});

function checkAuth() {
    const savedPassword = sessionStorage.getItem(PASSWORD_KEY);
    if (savedPassword) {
        showAdminPanel();
    }
}

// === تسجيل الدخول ===
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
            sessionStorage.setItem(PASSWORD_KEY, password);
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
    sessionStorage.removeItem(PASSWORD_KEY);
    adminPanel.classList.add('hidden');
    loginSection.classList.remove('hidden');
    passwordInput.value = '';
    showToast('تم تسجيل الخروج من لوحة التحكم', 'info');
});

function showAdminPanel() {
    loginSection.classList.add('hidden');
    adminPanel.classList.remove('hidden');
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
    } catch (e) {
        console.error('Error loading admin data:', e);
        showToast('فشل في تحميل بيانات المواد', 'error');
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

        tr.innerHTML = `
            <td>
                <a href="item.html?id=${item.id}" target="_blank" style="color: var(--gold); font-weight: 700;">
                    ${escapeHtml(item.title)}
                </a>
            </td>
            <td>${escapeHtml(item.speaker || '—')}</td>
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

// === إضافة مادة جديدة (Google Drive أو رفع ملف محلي) ===
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

    const htmlFileInput = document.getElementById('input-html-file');
    const pdfFileInput = document.getElementById('input-pdf-file');

    const htmlFile = htmlFileInput ? htmlFileInput.files[0] : null;
    const pdfFile = pdfFileInput ? pdfFileInput.files[0] : null;

    if (!title) {
        showToast('يرجى كتابة عنوان المادة', 'error');
        return;
    }

    const adminPassword = sessionStorage.getItem(PASSWORD_KEY);
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '30%';
    progressText.textContent = '٣٠٪ جاري إعداد وتجهيز المادة...';

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

            if (htmlFile) formData.append('htmlFile', htmlFile);
            if (pdfFile) formData.append('pdfFile', pdfFile);

            progressFill.style.width = '60%';
            progressText.textContent = '٦٠٪ جاري حفظ المادة والملفات...';

            response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'x-admin-password': adminPassword
                },
                body: formData
            });
        } else {
            // تسجيل مباشر بروابط Google Drive
            progressFill.style.width = '70%';
            progressText.textContent = '٧٠٪ جاري توثيق روابط Google Drive...';

            response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': adminPassword
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
                    htmlUrl: htmlDriveUrl
                })
            });
        }

        progressFill.style.width = '100%';
        progressText.textContent = '١٠٠٪ تم الحفظ بنجاح!';

        const result = await response.json();

        if (response.ok) {
            showToast('تمت إضافة ونشر المادة بنجاح في المكتبة', 'success');
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
            const adminPassword = sessionStorage.getItem(PASSWORD_KEY);

            const payload = {
                title: editTitle.value.trim(),
                speaker: editSpeaker.value.trim(),
                category: editCategory.value.trim(),
                type: editType.value,
                reviewStatus: editStatus.value,
                originalSourceUrl: editSource.value.trim(),
                description: editDesc.value.trim(),
                pdfUrl: editPdfUrl ? editPdfUrl.value.trim() : '',
                htmlUrl: editHtmlUrl ? editHtmlUrl.value.trim() : ''
            };

            try {
                const res = await fetch(`/api/files/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPassword
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showToast('تم حفظ التعديلات بنجاح', 'success');
                    editModal.classList.add('hidden');
                    loadAdminData();
                } else {
                    const err = await res.json();
                    showToast(err.error || 'فشل حفظ التعديلات', 'error');
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

    editModal.classList.remove('hidden');
};

// === حذف مادة ===
window.deleteMaterial = async function(id, title) {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف مادة «${title}» نهائياً من المكتبة؟`)) {
        return;
    }

    const adminPassword = sessionStorage.getItem(PASSWORD_KEY);

    try {
        const response = await fetch(`/api/files/${id}`, {
            method: 'DELETE',
            headers: {
                'x-admin-password': adminPassword
            }
        });

        if (response.ok) {
            showToast('تم حذف المادة بنجاح', 'success');
            loadAdminData();
        } else {
            const data = await response.json();
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
            showToast('جاري تصدير وتحميل files.json... يمكنك استبدال الملف في مستودع GitHub لديك لحفظ التعديلات دائماً', 'info');
        });
    }
}
