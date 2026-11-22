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

    const speakerLink = document.getElementById('item-speaker-link');
    speakerLink.textContent = item.speaker || 'غير محدد';
    speakerLink.href = `speaker.html?name=${encodeURIComponent(item.speaker || '')}`;

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
                    <a href="${getMaterialFileUrl(ep.htmlUrl || ep.htmlFile || item.htmlUrl || item.htmlFile)}" target="_blank" class="btn btn-sm btn-primary">
                        فتح التفاعلي 🌐
                    </a>
                </div>
            `;
            episodesContainer.appendChild(epCard);
        });
    }
}
