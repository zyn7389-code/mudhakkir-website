/**
 * مُذَكِّر - منطق صفحة المادة والمعاينة
 */

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('id');

    if (!itemId) {
        showToast('لم يُحدد معرف المادة', 'error');
        setTimeout(() => window.location.href = 'library.html', 1500);
        return;
    }

    await loadItemDetails(itemId);
});

async function loadItemDetails(id) {
    try {
        const res = await fetch(`/api/files/${id}`);
        if (!res.ok) throw new Error('المادة غير موجودة');
        const item = await res.json();
        renderItem(item);
    } catch (e) {
        console.error('Error loading item:', e);
        showToast('تعذر العثور على المادة المطلوبة', 'error');
        setTimeout(() => window.location.href = 'library.html', 2000);
    }
}

function renderItem(item) {
    document.title = `مُذَكِّر | ${item.title}`;

    // مسار التنقل
    const catBreadcrumb = document.getElementById('breadcrumb-category');
    catBreadcrumb.textContent = item.category || 'عام';
    catBreadcrumb.onclick = () => window.location.href = `library.html?category=${encodeURIComponent(item.category || '')}`;
    catBreadcrumb.style.cursor = 'pointer';

    document.getElementById('breadcrumb-title').textContent = item.title;

    // البيانات التعريفية
    document.getElementById('item-type-badge').textContent = `🔖 ${item.type || 'محاضرة'}`;
    document.getElementById('item-category-badge').textContent = `📁 ${item.category || 'عام'}`;
    document.getElementById('item-status-badge').textContent = `✓ ${item.reviewStatus || 'مراجَع'}`;
    document.getElementById('item-title').textContent = item.title;

    // صورة الغلاف (الصفحة الأولى من ملف الـ PDF كغلاف مصمم جاهز تلقائياً أو الغلاف المخصص)
    const coverEl = document.getElementById('item-cover-img');
    if (coverEl) {
        coverEl.src = resolveItemCover(item);
        coverEl.onerror = () => { coverEl.src = 'assets/default-cover.svg'; };
    }

    const speakerLink = document.getElementById('item-speaker-link');
    const speakerNameEl = document.getElementById('item-speaker-name');
    const speakerAvatarEl = document.getElementById('item-speaker-avatar');

    if (speakerNameEl) speakerNameEl.textContent = item.speaker || 'غير محدد';
    if (speakerLink) speakerLink.href = `speaker.html?name=${encodeURIComponent(item.speaker || '')}`;

    if (speakerAvatarEl) {
        if (item.speakerImage) {
            speakerAvatarEl.src = resolveImageUrl(item.speakerImage, 'speaker');
            speakerAvatarEl.onerror = () => { speakerAvatarEl.src = 'assets/default-speaker.svg'; };
        } else {
            speakerAvatarEl.src = 'assets/default-speaker.svg';
        }
    }

    document.getElementById('item-description').textContent = item.description || 'تفريغ محرَّر ومدقق كلمةً بكلمة على الأصل.';
    document.getElementById('item-date').textContent = formatArabicDate(item.uploadDate);

    // المصدر الأصلي
    const sourceLink = document.getElementById('item-source-link');
    if (item.originalSourceUrl) {
        sourceLink.href = item.originalSourceUrl;
    } else {
        sourceLink.parentElement.style.display = 'none';
    }

    // الروابط وأزرار الإجراءات
    const interactiveBtn = document.getElementById('btn-open-interactive');
    const pdfBtn = document.getElementById('btn-download-pdf');
    const fullscreenBtn = document.getElementById('btn-fullscreen');
    const readerIframe = document.getElementById('reader-iframe');
    const readerSection = document.getElementById('reader-section');
    const readerTitle = document.querySelector('#reader-section .sub-section-title');

    const hasHtml = item.htmlUrl || item.htmlFile || (item.type === 'html' ? item.filename : null);
    const hasPdf = item.pdfUrl || item.pdfFile || (item.type === 'pdf' ? item.filename : null);

    if (hasHtml) {
        const htmlViewUrl = getMaterialFileUrl(hasHtml, 'view');
        const htmlPreviewUrl = getMaterialFileUrl(hasHtml, 'preview');
        interactiveBtn.href = htmlViewUrl;
        interactiveBtn.style.display = 'inline-flex';
        fullscreenBtn.href = htmlViewUrl;
        readerIframe.src = htmlPreviewUrl;
        if (readerTitle) readerTitle.textContent = 'معاينة المطالعة التفاعلية داخل الموقع';
        readerSection.style.display = 'block';
        recordReadHistory(item.id, item.title);
    } else if (hasPdf) {
        // إذا لم يتوفر ملف تفاعلي، نعرض ملف الـ PDF مباشرة داخل القارئ (يدعم معاينة Google Drive الممتازة)
        interactiveBtn.style.display = 'none';
        const pdfPreviewUrl = getMaterialFileUrl(hasPdf, 'preview');
        const pdfViewUrl = getMaterialFileUrl(hasPdf, 'view');
        readerIframe.src = pdfPreviewUrl;
        fullscreenBtn.href = pdfViewUrl;
        if (readerTitle) readerTitle.textContent = 'معاينة وقراءة ملف الـ PDF داخل الموقع';
        readerSection.style.display = 'block';
        recordReadHistory(item.id, item.title);
    } else {
        interactiveBtn.style.display = 'none';
        readerSection.style.display = 'none';
    }

    if (hasPdf) {
        pdfBtn.href = getMaterialFileUrl(hasPdf, 'download');
        pdfBtn.style.display = 'inline-flex';
    } else {
        pdfBtn.style.display = 'none';
    }

    // زر المفضلة
    const favBtn = document.getElementById('btn-toggle-favorite');
    const favIcon = document.getElementById('fav-icon');
    const favText = document.getElementById('fav-text');

    function updateFavBtn() {
        const isFav = isItemSaved(item.id);
        if (favIcon) favIcon.textContent = isFav ? '⭐' : '🤍';
        if (favText) favText.textContent = isFav ? 'محفوظة في مكتبتي' : 'حفظ في مكتبتي';
        if (favBtn) favBtn.classList.toggle('active', isFav);
    }
    updateFavBtn();

    if (favBtn) {
        favBtn.addEventListener('click', () => {
            toggleSaveItem(item.id, item.title, null);
            updateFavBtn();
        });
    }

    // عرض حلقات السلسلة إن وجدت
    const episodesBox = document.getElementById('series-episodes-box');
    const episodesContainer = document.getElementById('episodes-container');
    if (item.episodes && item.episodes.length > 0 && episodesBox && episodesContainer) {
        episodesBox.classList.remove('hidden');
        episodesContainer.innerHTML = '';
        item.episodes.forEach(ep => {
            const epCard = document.createElement('div');
            epCard.className = 'episode-card';
            epCard.innerHTML = `
                <div class="ep-info">
                    <span class="ep-num">${toArabicNumerals(ep.number || 1)}</span>
                    <span class="ep-title">${escapeHtml(ep.title)}</span>
                </div>
                <div class="ep-actions">
                    <a href="${getMaterialFileUrl(ep.htmlUrl || ep.htmlFile || item.htmlUrl || item.htmlFile)}" class="btn btn-sm btn-primary">
                        فتح التفاعلي 🌐
                    </a>
                </div>
            `;
            episodesContainer.appendChild(epCard);
        });
    }

    // تهيئة قسم التعليقات والمناقشات حول المادة
    initComments(item.id);
}

// === إدارة التعليقات والمناقشات حول المادة ===
function initComments(itemId) {
    const authFormWrap = document.getElementById('comment-auth-form');
    const guestPromptWrap = document.getElementById('comment-guest-prompt');
    const btnCommentLogin = document.getElementById('btn-comment-login');
    const commentForm = document.getElementById('comment-form');
    const commentInput = document.getElementById('comment-input');
    const btnSubmitComment = document.getElementById('btn-submit-comment');
    const commentsList = document.getElementById('comments-list');
    const commentsCountBadge = document.getElementById('comments-count-badge');

    function checkAuthForComments() {
        const user = getLoggedInUser();
        if (user) {
            if (authFormWrap) authFormWrap.classList.remove('hidden');
            if (guestPromptWrap) guestPromptWrap.classList.add('hidden');

            const nameEl = document.getElementById('comment-user-name');
            const avatarEl = document.getElementById('comment-user-avatar');
            const statusEl = document.getElementById('comment-user-status');

            if (nameEl) nameEl.textContent = user.name || 'طالب العلم';
            if (statusEl) statusEl.textContent = user.verified ? '✓ حساب موثق' : 'عضو مسجل';
            if (avatarEl) {
                if (user.picture) {
                    avatarEl.innerHTML = `<img src="${user.picture}" alt="${escapeHtml(user.name)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                } else {
                    avatarEl.textContent = (user.name || 'ط')[0].toUpperCase();
                }
            }
        } else {
            if (authFormWrap) authFormWrap.classList.add('hidden');
            if (guestPromptWrap) guestPromptWrap.classList.remove('hidden');
        }
    }

    checkAuthForComments();

    if (btnCommentLogin) {
        btnCommentLogin.addEventListener('click', () => {
            const authModal = document.getElementById('auth-modal');
            if (authModal) {
                authModal.classList.remove('hidden');
            } else {
                handleGoogleAuth();
            }
        });
    }

    // جلب التعليقات السابقة
    async function loadComments() {
        if (!commentsList) return;
        try {
            const res = await fetch(`/api/comments/${itemId}`);
            const comments = await res.json();

            if (commentsCountBadge) {
                commentsCountBadge.textContent = toArabicNumerals(comments.length);
            }

            if (!comments || comments.length === 0) {
                commentsList.innerHTML = `
                    <div class="empty-comments" style="text-align: center; padding: 32px 16px; background: rgba(0,0,0,0.15); border-radius: var(--radius); border: 1px dashed var(--border); margin-top: 16px;">
                        <span style="font-size: 2.2rem; display: block; margin-bottom: 6px;">💭</span>
                        <p style="color: var(--text-muted); margin: 0; font-size: 0.95rem;">لا توجد تعليقات بعد. كن أول من يشارك فائدة قيّدها من هذه المادة العلمية!</p>
                    </div>
                `;
                return;
            }

            const isAdmin = Boolean(sessionStorage.getItem('mudhakkir_admin_password'));

            commentsList.innerHTML = comments.map(c => {
                const dateStr = formatArabicDate(c.createdAt) || 'مؤخراً';
                const avatarContent = c.userAvatar
                    ? `<img src="${c.userAvatar}" alt="${escapeHtml(c.userName)}" class="comment-item-avatar-img">`
                    : `<span>${escapeHtml((c.userName || 'ط')[0].toUpperCase())}</span>`;

                const verifiedBadge = c.isGoogle
                    ? `<span class="comment-verified-pill" title="حساب Google موثق">✓ موثق عبر Google</span>`
                    : '';

                const adminDeleteBtn = isAdmin ? `
                    <button type="button" class="btn-comment-delete" onclick="deleteComment('${itemId}', '${c.id}')" title="حذف التعليق كمدير">
                        🗑️
                    </button>
                ` : '';

                return `
                    <div class="comment-item" id="comment-${c.id}">
                        <div class="comment-item-avatar">
                            ${avatarContent}
                        </div>
                        <div class="comment-item-body">
                            <div class="comment-item-header">
                                <div class="comment-item-user-info">
                                    <span class="comment-item-author">${escapeHtml(c.userName)}</span>
                                    ${verifiedBadge}
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span class="comment-item-date">${dateStr}</span>
                                    ${adminDeleteBtn}
                                </div>
                            </div>
                            <div class="comment-item-text">
                                ${escapeHtml(c.content).replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Failed to load comments:', err);
            commentsList.innerHTML = '<p class="text-muted" style="text-align: center;">تعذر تحميل التعليقات</p>';
        }
    }

    loadComments();

    // إرسال تعليق جديد
    if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = getLoggedInUser();
            if (!user) {
                showToast('عذراً، يجب تسجيل الدخول أولاً لإضافة تعليق', 'error');
                checkAuthForComments();
                return;
            }

            const content = commentInput.value.trim();
            if (!content) {
                showToast('يرجى كتابة نص التعليق أو الفائدة', 'error');
                return;
            }

            if (btnSubmitComment) {
                btnSubmitComment.disabled = true;
                btnSubmitComment.textContent = 'جاري النشر...';
            }

            try {
                const res = await fetch(`/api/comments/${itemId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userName: user.name || 'طالب العلم',
                        userEmail: user.email || '',
                        userAvatar: user.picture || '',
                        isGoogle: Boolean(user.isGoogle),
                        content
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'تم نشر تعليقك المبارك بنجاح!', 'success');
                    commentInput.value = '';
                    await loadComments();
                } else {
                    showToast(data.error || 'فشل حفظ التعليق', 'error');
                }
            } catch (err) {
                showToast('حدث خطأ أثناء إرسال التعليق', 'error');
            } finally {
                if (btnSubmitComment) {
                    btnSubmitComment.disabled = false;
                    btnSubmitComment.textContent = 'نشر التعليق';
                }
            }
        });
    }

    // إتاحة حذف التعليق للمدير
    window.deleteComment = async function(iId, cId) {
        if (!confirm('هل أنت متأكد من رغبتك في حذف هذا التعليق؟')) return;
        const adminPass = sessionStorage.getItem('mudhakkir_admin_password');
        try {
            const res = await fetch(`/api/comments/${iId}/${cId}`, {
                method: 'DELETE',
                headers: { 'x-admin-password': adminPass }
            });
            if (res.ok) {
                showToast('تم حذف التعليق بنجاح', 'success');
                const el = document.getElementById(`comment-${cId}`);
                if (el) el.remove();
                loadComments();
            } else {
                showToast('فشل حذف التعليق', 'error');
            }
        } catch {
            showToast('خطأ أثناء حذف التعليق', 'error');
        }
    };
}
