/**
 * مُذَكِّر - منطق صفحة المكتبة الشاملة
 */

let allLoadedItems = [];
let activeTab = 'all'; // 'all' or 'saved'

// عناصر الصفحة
const libraryGrid = document.getElementById('library-grid');
const emptyState = document.getElementById('lib-empty-state');
const spinner = document.getElementById('lib-spinner');
const searchInput = document.getElementById('lib-search-input');
const filterCategory = document.getElementById('filter-category');
const filterSpeaker = document.getElementById('filter-speaker');
const filterType = document.getElementById('filter-type');
const filterFormat = document.getElementById('filter-format');
const resetBtn = document.getElementById('reset-filters-btn');
const resultsCountText = document.getElementById('results-count-text');
const tabAll = document.getElementById('tab-all');
const tabSaved = document.getElementById('tab-saved');

document.addEventListener('DOMContentLoaded', async () => {
    initFiltersFromUrl();
    await loadFilterOptions();
    await fetchLibraryItems();
    setupEventListeners();
});

function initFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('q')) searchInput.value = params.get('q');
    if (params.get('type')) filterType.value = params.get('type');
    if (params.get('format')) filterFormat.value = params.get('format');
    if (params.get('view') === 'saved') {
        activeTab = 'saved';
        tabSaved.classList.add('active');
        tabAll.classList.remove('active');
    }
}

async function loadFilterOptions() {
    try {
        const [catsRes, spksRes] = await Promise.all([
            fetch('/api/categories'),
            fetch('/api/speakers')
        ]);
        const categories = await catsRes.json();
        const speakers = await spksRes.json();

        // ملء خيارات المجالات
        const urlParams = new URLSearchParams(window.location.search);
        const selectedCat = urlParams.get('category');
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (selectedCat && selectedCat === cat) opt.selected = true;
            filterCategory.appendChild(opt);
        });

        // ملء خيارات المقدّمين
        const selectedSpk = urlParams.get('speaker');
        speakers.forEach(spk => {
            const opt = document.createElement('option');
            opt.value = spk.name;
            opt.textContent = `${spk.name} (${toArabicNumerals(spk.itemsCount)})`;
            if (selectedSpk && selectedSpk === spk.name) opt.selected = true;
            filterSpeaker.appendChild(opt);
        });
    } catch (e) {
        console.error('Error loading filter options:', e);
    }
}

async function fetchLibraryItems() {
    spinner.classList.remove('hidden');
    emptyState.classList.add('hidden');

    const params = new URLSearchParams();
    if (filterCategory.value !== 'all') params.set('category', filterCategory.value);
    if (filterSpeaker.value !== 'all') params.set('speaker', filterSpeaker.value);
    if (filterType.value !== 'all') params.set('type', filterType.value);
    if (filterFormat.value !== 'all') params.set('format', filterFormat.value);
    if (searchInput.value.trim()) params.set('q', searchInput.value.trim());

    try {
        const res = await fetch(`/api/files?${params.toString()}`);
        allLoadedItems = await res.json();
        renderFilteredItems();
    } catch (err) {
        console.error('Failed to load library items:', err);
        showToast('تعذر تحميل المواد', 'error');
    } finally {
        spinner.classList.add('hidden');
    }
}

function renderFilteredItems() {
    libraryGrid.innerHTML = '';

    let itemsToDisplay = allLoadedItems;
    if (activeTab === 'saved') {
        const savedIds = getSavedItemIds();
        itemsToDisplay = allLoadedItems.filter(item => savedIds.includes(item.id));
    }

    resultsCountText.textContent = `تم العثور على ${toArabicNumerals(itemsToDisplay.length)} مادة علمية`;

    if (itemsToDisplay.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    itemsToDisplay.forEach(item => {
        const card = createLibraryCard(item);
        libraryGrid.appendChild(card);
    });
}

function createLibraryCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const speakerName = item.speaker || 'غير محدد';
    const category = item.category || 'عام';
    const type = item.type || 'محاضرة';
    const status = item.reviewStatus || 'مراجَع';
    const dateStr = formatArabicDate(item.uploadDate);
    const description = item.description || 'تفريغ محرَّر ومدقق كلمةً كلمةً على الأصل ومعد للمطالعة والتحميل.';
    
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
            <button class="btn-fav-toggle" onclick="handleCardFavToggle('${item.id}', '${escapeHtml(item.title)}', this)">
                ${isSaved ? '⭐ محفوظة في مكتبتي' : '🤍 حفظ في مكتبتي'}
            </button>
        </div>
    `;

    return card;
}

function handleCardFavToggle(id, title, btn) {
    toggleSaveItem(id, title, btn);
    if (activeTab === 'saved') {
        renderFilteredItems();
    }
}

function setupEventListeners() {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchLibraryItems, 300);
    });

    [filterCategory, filterSpeaker, filterType, filterFormat].forEach(select => {
        select.addEventListener('change', fetchLibraryItems);
    });

    resetBtn.addEventListener('click', resetAllFilters);

    tabAll.addEventListener('click', () => {
        activeTab = 'all';
        tabAll.classList.add('active');
        tabSaved.classList.remove('active');
        renderFilteredItems();
    });

    tabSaved.addEventListener('click', () => {
        activeTab = 'saved';
        tabSaved.classList.add('active');
        tabAll.classList.remove('active');
        renderFilteredItems();
    });
}

function resetAllFilters() {
    searchInput.value = '';
    filterCategory.value = 'all';
    filterSpeaker.value = 'all';
    filterType.value = 'all';
    filterFormat.value = 'all';
    activeTab = 'all';
    tabAll.classList.add('active');
    tabSaved.classList.remove('active');
    fetchLibraryItems();
}
