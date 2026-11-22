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

        renderLatestItems(data.latestItems || []);
        renderCategories(data.categories || []);
        renderFeaturedSeries(data.featuredSeries || []);
    } catch (error) {
        console.error('خطأ في تحميل بيانات الرئيسية:', error);
        showToast('تعذر تحميل بعض محتويات الصفحة الرئيسية', 'error');
    }
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
    
    const hasHtml = item.htmlUrl || item.htmlFile || (item.type === 'html' ? item.filename : null);
    const hasPdf = item.pdfUrl || item.pdfFile || (item.type === 'pdf' ? item.filename : null);
    const openHtmlTarget = hasHtml ? getMaterialFileUrl(hasHtml) : `item.html?id=${item.id}`;
    const openPdfTarget = hasPdf ? getMaterialFileUrl(hasPdf) : null;
    const isSaved = isItemSaved(item.id);

    card.innerHTML = `
        <div class="item-card-top">
            <div class="item-meta-row">
                <a href="speaker.html?name=${encodeURIComponent(speakerName)}" class="item-speaker">🎙️ ${escapeHtml(speakerName)}</a>
                <span class="item-status-badge">✓ ${escapeHtml(status)}</span>
            </div>
            <h3 class="item-title">
                <a href="item.html?id=${item.id}" style="color: inherit;">${escapeHtml(item.title)}</a>
            </h3>
            <div class="item-badges">
                <a href="library.html?category=${encodeURIComponent(category)}" class="badge-tag">📁 ${escapeHtml(category)}</a>
                <span class="badge-tag">🔖 ${escapeHtml(type)}</span>
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
                                <a href="${getMaterialFileUrl(ep.htmlUrl || ep.htmlFile || series.htmlUrl || series.htmlFile)}" class="btn-item btn-item-interactive" style="padding: 2px 10px; font-size: 0.8rem;" onclick="recordReadHistory('${series.id}', '${escapeHtml(ep.title)}')">
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
