/**
 * مُذَكِّر - الواجهة الأمامية
 * منطق الصفحة الرئيسية
 */

const latestGrid = document.getElementById('latest-grid');
const categoriesGrid = document.getElementById('categories-grid');
const seriesGrid = document.getElementById('series-grid');

document.addEventListener('DOMContentLoaded', () => {
    fetchHomeData();
});

// === جلب بيانات الصفحة الرئيسية ===
async function fetchHomeData() {
    try {
        const response = await fetch('/api/home');
        if (!response.ok) throw new Error('فشل في جلب بيانات الصفحة الرئيسية');
        const data = await response.json();

        renderHomeStats(data.stats || {});
        renderLatestItems(data.latestItems || []);
        renderCategories(data.categories || []);
        renderFeaturedSeries(data.featuredSeries || []);
    } catch (error) {
        console.error('خطأ في تحميل بيانات الرئيسية:', error);
        showToast('تعذر تحميل بعض محتويات الصفحة الرئيسية', 'error');
    }
}

// === عرض إحصائيات الصفحة الرئيسية وعداد الزوار ===
function renderHomeStats(stats) {
    const elVisitors = document.getElementById('home-total-visitors');
    const elMaterials = document.getElementById('home-total-materials');
    const elSpeakers = document.getElementById('home-total-speakers');
    const elHours = document.getElementById('home-reading-hours');

    if (elVisitors) elVisitors.textContent = toArabicNumerals(stats.totalVisitors || 0);
    if (elMaterials) elMaterials.textContent = toArabicNumerals(stats.totalItems || 0);
    if (elSpeakers) elSpeakers.textContent = toArabicNumerals(stats.totalSpeakers || 0);
    if (elHours) elHours.textContent = toArabicNumerals(stats.totalReadingHours || 1);
}

// === 1. عرض أحدث الإضافات ===
function renderLatestItems(items) {
    if (!latestGrid) return;
    latestGrid.innerHTML = '';

    if (items.length === 0) {
        latestGrid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📂</span>
                <p class="empty-text">لا توجد مواد منشورة حالياً</p>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const card = createItemCard(item);
        latestGrid.appendChild(card);
    });
}

// === إنشاء بطاقة مادة علمية موحدة ===
function createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const speakerName = item.speaker || 'غير محدد';
    const category = item.category || 'عام';
    const type = item.type || 'محاضرة';
    const status = item.reviewStatus || 'مراجَع';
    const dateStr = formatArabicDate(item.uploadDate);
    const description = item.description || 'تفريغ مدقق ومراجع كلمةً كلمةً على الأصل ومعد للمطالعة والتحميل.';
    
    const coverUrl = resolveItemCover(item);
    const speakerImgUrl = item.speakerImage ? resolveImageUrl(item.speakerImage, 'speaker') : null;
    const speakerAvatarHtml = speakerImgUrl
        ? `<img src="${speakerImgUrl}" alt="${escapeHtml(speakerName)}" class="speaker-avatar-tiny" onerror="this.outerHTML='🎙️'">`
        : `🎙️`;

    const rawHtml = item.htmlUrl || item.htmlFile || (item.type === 'html' ? item.filename : null);
    const rawPdf = item.pdfUrl || item.pdfFile || (item.type === 'pdf' ? item.filename : null);
    const isHtmlPdf = Boolean(rawHtml && ((rawPdf && rawHtml.trim() === rawPdf.trim()) || rawHtml.toLowerCase().includes('.pdf')));
    const hasHtml = isHtmlPdf ? null : rawHtml;
    const hasPdf = rawPdf || (isHtmlPdf ? rawHtml : null);

    const openHtmlTarget = hasHtml ? getMaterialFileUrl(hasHtml, 'html', true) : `item.html?id=${item.id}`;
    const openPdfTarget = hasPdf ? getMaterialFileUrl(hasPdf, 'preview') : null;
    const isSaved = isItemSaved(item.id);

    card.innerHTML = `
        <div class="item-card-cover-wrap">
            <a href="item.html?id=${item.id}" style="display: block; width: 100%; height: 100%;">
                <img src="${coverUrl}" alt="${escapeHtml(item.title)}" class="item-card-cover" loading="lazy" onerror="this.src='assets/default-cover.svg'">
            </a>
            <span class="item-card-cover-status">✓ ${escapeHtml(status)}</span>
            <span class="item-card-cover-badge">📁 ${escapeHtml(category)}</span>
        </div>
        <div class="item-card-top">
            <div class="item-meta-row">
                <a href="speaker.html?name=${encodeURIComponent(speakerName)}" class="item-speaker">
                    ${speakerAvatarHtml}
                    <span>${escapeHtml(speakerName)}</span>
                </a>
                <span class="badge-tag">🔖 ${escapeHtml(type)}</span>
            </div>
            <h3 class="item-title">
                <a href="item.html?id=${item.id}" style="color: inherit;">${escapeHtml(item.title)}</a>
            </h3>
            <div class="item-badges">
                <span class="badge-tag">📅 ${dateStr}</span>
            </div>
            <p class="item-desc">${escapeHtml(description)}</p>
        </div>

        <div class="item-actions">
            ${hasHtml ? `
                <a href="${openHtmlTarget}" class="btn-item btn-item-interactive" onclick="recordReadHistory('${item.id}', '${escapeHtml(item.title)}')">
                    🌐 تفاعلي
                </a>
            ` : `
                <a href="item.html?id=${item.id}" class="btn-item btn-item-interactive">
                    📖 صفحة المادة
                </a>
            `}
            ${hasPdf ? `
                <a href="${openPdfTarget}" class="btn-item btn-item-pdf">
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

    return card;
}

// === 2. عرض بطاقات المجالات ===
function renderCategories(categories) {
    if (!categoriesGrid) return;
    categoriesGrid.innerHTML = '';

    const categoryIcons = {
        'فكري': '💡',
        'شرعي': '📖',
        'تربوي': '🌱',
        'دعوي': '📢',
        'قرآني': '✨',
        'حديثي': '📜',
        'تاريخي': '🏛️',
        'عام': '📚'
    };

    categories.forEach(cat => {
        const card = document.createElement('a');
        card.className = 'category-card';
        card.href = `library.html?category=${encodeURIComponent(cat.name)}`;

        const icon = categoryIcons[cat.name] || '📚';
        const countText = `${toArabicNumerals(cat.count)} مادة علمية`;

        card.innerHTML = `
            <span class="category-icon">${icon}</span>
            <h3 class="category-name">${escapeHtml(cat.name)}</h3>
            <span class="category-count">${countText}</span>
        `;

        categoriesGrid.appendChild(card);
    });
}

// === 3. عرض السلاسل المميزة ===
function renderFeaturedSeries(seriesList) {
    if (!seriesGrid) return;
    seriesGrid.innerHTML = '';

    if (seriesList.length === 0) {
        seriesGrid.innerHTML = '<p class="text-muted text-center" style="grid-column: 1 / -1;">لا توجد سلاسل حالياً</p>';
        return;
    }

    seriesList.forEach(series => {
        const card = document.createElement('div');
        card.className = 'series-card';

        const episodes = series.episodes || [];
        const episodesCount = episodes.length > 0 ? toArabicNumerals(episodes.length) : 'متعددة';
        const speaker = series.speaker || 'غير محدد';

        let episodesHtml = '';
        if (episodes.length > 0) {
            episodesHtml = `
                <div class="series-episodes-toggle">
                    <button class="btn-toggle-episodes" onclick="toggleEpisodes('${series.id}')">
                        <span>▼ عرض حلقات السلسلة (${episodesCount})</span>
                    </button>
                    <div class="episodes-list hidden" id="episodes-${series.id}">
                        ${episodes.map(ep => `
                            <div class="episode-item">
                                <span>${toArabicNumerals(ep.number || 1)}. ${escapeHtml(ep.title)}</span>
                                <a href="${getMaterialFileUrl(ep.htmlUrl || ep.htmlFile || series.htmlUrl || series.htmlFile, 'html', true)}" class="btn-item btn-item-interactive" style="padding: 2px 10px; font-size: 0.8rem;" onclick="recordReadHistory('${series.id}', '${escapeHtml(ep.title)}')">
                                    فتح 🌐
                                </a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="series-card-header">
                <div>
                    <span class="badge-tag" style="margin-bottom: 6px; display: inline-block;">سلسلة علمية</span>
                    <h3 class="series-title">
                        <a href="item.html?id=${series.id}" style="color: inherit;">${escapeHtml(series.title)}</a>
                    </h3>
                </div>
                <span class="item-status-badge">✓ مراجَع</span>
            </div>
            <p class="item-speaker" style="margin-bottom: 8px;">
                <a href="speaker.html?name=${encodeURIComponent(speaker)}" style="color: inherit;">🎙️ ${escapeHtml(speaker)}</a> • 
                <a href="library.html?category=${encodeURIComponent(series.category || 'عام')}" style="color: inherit;">📁 ${escapeHtml(series.category || 'عام')}</a>
            </p>
            <p class="item-desc">${escapeHtml(series.description || '')}</p>
            ${episodesHtml}
        `;

        seriesGrid.appendChild(card);
    });
}

// === فتح/إغلاق حلقات السلسلة ===
window.toggleEpisodes = function(seriesId) {
    const list = document.getElementById(`episodes-${seriesId}`);
    if (list) {
        list.classList.toggle('hidden');
    }
};
