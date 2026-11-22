/**
 * مُذَكِّر - منطق صفحة المقدّم
 */

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const speakerName = params.get('name');

    if (!speakerName) {
        showToast('لم يُحدد اسم المقدّم', 'error');
        setTimeout(() => window.location.href = 'library.html', 1500);
        return;
    }

    document.getElementById('speaker-title').textContent = speakerName;
    document.getElementById('speaker-breadcrumb').textContent = speakerName;
    document.title = `مُذَكِّر | تفريغات ${speakerName}`;

    await loadSpeakerItems(speakerName);
});

async function loadSpeakerItems(name) {
    try {
        const res = await fetch(`/api/files?speaker=${encodeURIComponent(name)}`);
        const items = await res.json();

        const metaEl = document.getElementById('speaker-meta');
        metaEl.textContent = `إجمالي المواد المفرغة: ${toArabicNumerals(items.length)} مادة علمية`;

        const grid = document.getElementById('speaker-items-grid');
        grid.innerHTML = '';

        if (items.length === 0) {
            grid.innerHTML = '<p class="text-muted" style="grid-column: 1 / -1; text-align: center;">لا توجد مواد منشورة لهذا المقدّم حالياً.</p>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';

            const category = item.category || 'عام';
            const type = item.type || 'محاضرة';
            const status = item.reviewStatus || 'مراجَع';
            const dateStr = formatArabicDate(item.uploadDate);
            const description = item.description || 'تفريغ محرَّر ومدقق كلمةً بكلمة على الأصل ومعد للمطالعة والتحميل.';
            
            const hasHtml = item.htmlUrl || item.htmlFile || (item.type === 'html' ? item.filename : null);
            const hasPdf = item.pdfUrl || item.pdfFile || (item.type === 'pdf' ? item.filename : null);
            const openHtmlTarget = hasHtml ? getMaterialFileUrl(hasHtml) : `item.html?id=${item.id}`;
            const openPdfTarget = hasPdf ? getMaterialFileUrl(hasPdf) : null;
            const isSaved = isItemSaved(item.id);

            card.innerHTML = `
                <div class="item-card-top">
                    <div class="item-meta-row">
                        <a href="library.html?category=${encodeURIComponent(category)}" class="badge-tag">📁 ${escapeHtml(category)}</a>
                        <span class="item-status-badge">✓ ${escapeHtml(status)}</span>
                    </div>
                    <h3 class="item-title">
                        <a href="item.html?id=${item.id}" style="color: inherit;">${escapeHtml(item.title)}</a>
                    </h3>
                    <div class="item-badges">
                        <span class="badge-tag">🔖 ${escapeHtml(type)}</span>
                        <span class="badge-tag">📅 ${dateStr}</span>
                    </div>
                    <p class="item-desc">${escapeHtml(description)}</p>
                </div>

                <div class="item-actions">
                    ${hasHtml ? `
                        <a href="${openHtmlTarget}" target="_blank" class="btn-item btn-item-interactive" onclick="recordReadHistory('${item.id}', '${escapeHtml(item.title)}')">
                            🌐 تفاعلي
                        </a>
                    ` : `
                        <a href="item.html?id=${item.id}" class="btn-item btn-item-interactive">
                            📖 صفحة المادة
                        </a>
                    `}
                    ${hasPdf ? `
                        <a href="${openPdfTarget}" target="_blank" class="btn-item btn-item-pdf">
                            📕 PDF
                        </a>
                    ` : ''}
                </div>
                <div style="margin-top: 10px; text-align: left;">
                    <button class="btn-fav-toggle" onclick="toggleSaveItem('${item.id}', '${escapeHtml(item.title)}', this)">
                        ${isSaved ? '⭐ محفوظة في مكتبتي' : '🤍 حفظ في مكتبتي'}
                    </button>
                </div>
            `;

            grid.appendChild(card);
        });
    } catch (e) {
        console.error('Error loading speaker items:', e);
        showToast('تعذر تحميل مواد المقدّم', 'error');
    }
}
