const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// ──────────────────────────────────────────────
// قراءة متغيرات البيئة من ملف .env إن وجد
// ──────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const firstEquals = trimmed.indexOf('=');
        if (firstEquals > 0) {
          const key = trimmed.slice(0, firstEquals).trim();
          const value = trimmed.slice(firstEquals + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value.replace(/^["'](.*)["']$/, '$1');
          }
        }
      }
    });
  } catch (err) {
    console.warn('تنبيه: تعذر قراءة ملف .env:', err.message);
  }
}

// ──────────────────────────────────────────────
// إعداد التطبيق والمسارات
// ──────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '770213958';

const DATA_FILE = path.join(__dirname, 'data', 'files.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

// إنشاء المجلدات إذا لم تكن موجودة
[path.join(__dirname, 'data'), UPLOADS_DIR, PUBLIC_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// إنشاء ملف البيانات إذا لم يكن موجوداً
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

// ──────────────────────────────────────────────
// الوسائط (Middleware)
// ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ترويسات الأمان الأساسية و CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-password, Authorization');
  res.header('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// تقديم الملفات الثابتة
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// ──────────────────────────────────────────────
// دوال إدارة البيانات المحلية (files.json)
// ──────────────────────────────────────────────

/** قراءة بيانات المواد من ملف files.json محلياً */
function readFilesData() {
  try {
    let raw = fs.readFileSync(DATA_FILE, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) {
      raw = raw.slice(1);
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  } catch (err) {
    console.error('Error reading files data:', err);
    return [];
  }
}

/** كتابة بيانات المواد إلى ملف files.json محلياً */
function writeFilesData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing files data:', err);
    return false;
  }
}

/** جلب جميع المواد */
function getAllMaterials() {
  return readFilesData();
}

/** جلب مادة واحدة بالمعرف */
function getMaterialById(id) {
  const files = readFilesData();
  return files.find((f) => f.id === id) || null;
}

/** التحقق من كلمة مرور المدير */
function requireAdmin(req, res, next) {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'غير مصرح - كلمة المرور غير صحيحة' });
  }
  next();
}

// ──────────────────────────────────────────────
// إعداد رفع الملفات المحلية (Multer)
// ──────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.html' || ext === '.htm' || ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. يُسمح فقط بملفات HTML و PDF'), false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

const uploadMiddleware = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    return next();
  }
  return upload.fields([
    { name: 'htmlFile', maxCount: 1 },
    { name: 'pdfFile', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ])(req, res, next);
};

// ──────────────────────────────────────────────
// نقاط النهاية (API Endpoints)
// ──────────────────────────────────────────────

/**
 * GET /api/config
 * معلومات الإعدادات والتخزين
 */
app.get('/api/config', (req, res) => {
  res.json({
    storageProvider: 'google-drive',
    version: '1.0.0',
    adminConfigured: Boolean(ADMIN_PASSWORD),
  });
});

/**
 * GET /api/health
 * فحص جاهزية الخادم
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'mudhakkir',
    storageMode: 'google-drive',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/export-data
 * تصدير ملف files.json للتحميل المباشر
 */
app.get('/api/export-data', (req, res) => {
  const files = readFilesData();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="files.json"');
  res.send(JSON.stringify(files, null, 2));
});

/**
 * GET /api/home
 * بيانات الصفحة الرئيسية: الإحصاءات، المجالات، أحدث الإضافات، والسلاسل
 */
app.get('/api/home', (req, res) => {
  try {
    const files = getAllMaterials();
    const categoriesMap = {};
    const speakersSet = new Set();
    let seriesCount = 0;

    files.forEach((f) => {
      const cat = f.category || 'عام';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
      if (f.speaker) speakersSet.add(f.speaker);
      if (f.type === 'سلسلة') seriesCount++;
    });

    const categories = Object.keys(categoriesMap).map((name) => ({
      name,
      count: categoriesMap[name],
    }));

    const sorted = [...files].sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    const latestItems = sorted.slice(0, 6);
    const featuredSeries = files.filter((f) => f.type === 'سلسلة' || f.featured);

    res.json({
      stats: {
        totalItems: files.length,
        totalCategories: categories.length,
        totalSpeakers: speakersSet.size,
        totalSeries: seriesCount,
      },
      categories,
      latestItems,
      featuredSeries,
    });
  } catch (err) {
    console.error('Home API error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل بيانات الصفحة الرئيسية' });
  }
});

/**
 * GET /api/files
 * جلب قائمة جميع الملفات مع دعم البحث والفلترة
 */
app.get('/api/files', (req, res) => {
  try {
    let files = getAllMaterials();
    const { category, speaker, type, format, q } = req.query;

    if (category && category !== 'all') {
      files = files.filter((f) => f.category === category);
    }
    if (speaker) {
      files = files.filter((f) => f.speaker === speaker);
    }
    if (type && type !== 'all') {
      files = files.filter((f) => f.type === type);
    }
    if (format) {
      if (format === 'pdf') files = files.filter((f) => f.type === 'pdf' || f.pdfFile || f.pdfUrl);
      if (format === 'html') files = files.filter((f) => f.type === 'html' || f.htmlFile || f.htmlUrl);
    }
    if (q) {
      const query = q.toLowerCase().trim();
      files = files.filter(
        (f) =>
          (f.title && f.title.toLowerCase().includes(query)) ||
          (f.description && f.description.toLowerCase().includes(query)) ||
          (f.speaker && f.speaker.toLowerCase().includes(query)) ||
          (f.category && f.category.toLowerCase().includes(query))
      );
    }

    files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    res.json(files);
  } catch (err) {
    console.error('Files API error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب قائمة المواد' });
  }
});

/**
 * GET /api/speakers
 * جلب قائمة بأسماء المقدّمين وعدد موادهم
 */
app.get('/api/speakers', (req, res) => {
  try {
    const files = getAllMaterials();
    const speakerMap = {};
    files.forEach((f) => {
      if (f.speaker) {
        if (!speakerMap[f.speaker]) {
          speakerMap[f.speaker] = { name: f.speaker, itemsCount: 0, categories: new Set() };
        }
        speakerMap[f.speaker].itemsCount++;
        if (f.category) speakerMap[f.speaker].categories.add(f.category);
      }
    });
    const list = Object.values(speakerMap).map((s) => ({
      name: s.name,
      itemsCount: s.itemsCount,
      categories: [...s.categories],
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'تعذر جلب قائمة المقدّمين' });
  }
});

/**
 * GET /api/categories
 * جلب قائمة المجالات والتصنيفات
 */
app.get('/api/categories', (req, res) => {
  try {
    const files = getAllMaterials();
    const categories = [...new Set(files.map((f) => f.category).filter(Boolean))];
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'تعذر جلب التصنيفات' });
  }
});

/**
 * GET /api/files/:id
 * جلب معلومات مادة واحدة بالمعرّف
 */
app.get('/api/files/:id', (req, res) => {
  try {
    const file = getMaterialById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'المادة غير موجودة' });
    }
    res.json(file);
  } catch (err) {
    res.status(500).json({ error: 'تعذر جلب المادة المطلوبة' });
  }
});

/**
 * POST /api/verify-admin
 * التحقق من صحة كلمة مرور المدير
 */
app.post('/api/verify-admin', requireAdmin, (req, res) => {
  res.json({ valid: true, message: 'كلمة المرور صحيحة' });
});

/**
 * POST /api/upload
 * إضافة وتوثيق مادة علمية جديدة (رابط جوجل درايف أو رفع ملف محلي)
 */
app.post('/api/upload', requireAdmin, uploadMiddleware, (req, res) => {
  try {
    const {
      title,
      speaker,
      category,
      type = 'محاضرة',
      reviewStatus = 'مراجَع',
      originalSourceUrl,
      description,
      featured,
      episodes,
      htmlUrl,
      pdfUrl,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'عنوان المادة مطلوب' });
    }

    let finalHtmlUrl = (htmlUrl || '').trim();
    let finalPdfUrl = (pdfUrl || '').trim();

    // إذا تم رفع ملفات محلية عبر Multer
    if (req.files) {
      if (req.files.htmlFile && req.files.htmlFile[0]) {
        finalHtmlUrl = req.files.htmlFile[0].filename;
      }
      if (req.files.pdfFile && req.files.pdfFile[0]) {
        finalPdfUrl = req.files.pdfFile[0].filename;
      }
      if (req.files.file && req.files.file[0]) {
        const f = req.files.file[0];
        const ext = path.extname(f.originalname).toLowerCase();
        if (ext === '.pdf') finalPdfUrl = f.filename;
        else finalHtmlUrl = f.filename;
      }
    }

    let parsedEpisodes = [];
    if (episodes) {
      try {
        parsedEpisodes = typeof episodes === 'string' ? JSON.parse(episodes) : episodes;
      } catch {}
    }

    const fileEntry = {
      id: uuidv4(),
      title: title.trim(),
      speaker: (speaker || 'غير محدد').trim(),
      category: (category || 'عام').trim(),
      type: type.trim(),
      description: (description || '').trim(),
      originalSourceUrl: (originalSourceUrl || '').trim(),
      reviewStatus: reviewStatus.trim(),
      featured: featured === 'true' || featured === true,
      htmlFile: finalHtmlUrl,
      pdfFile: finalPdfUrl,
      htmlUrl: finalHtmlUrl,
      pdfUrl: finalPdfUrl,
      filename: finalHtmlUrl || finalPdfUrl || '',
      episodes: Array.isArray(parsedEpisodes) ? parsedEpisodes : [],
      uploadDate: new Date().toISOString(),
    };

    const files = readFilesData();
    files.unshift(fileEntry);
    writeFilesData(files);

    res.status(201).json({
      message: 'تمت إضافة المادة وحفظها بنجاح',
      file: fileEntry,
    });
  } catch (err) {
    console.error('Upload handler error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء معالجة إضافة المادة' });
  }
});

/**
 * PUT /api/files/:id
 * تعديل البيانات الوصفية وروابط مادة منشورة
 */
app.put('/api/files/:id', requireAdmin, (req, res) => {
  try {
    const {
      title,
      speaker,
      category,
      type,
      description,
      originalSourceUrl,
      reviewStatus,
      featured,
      pdfUrl,
      htmlUrl,
    } = req.body;

    const files = readFilesData();
    const index = files.findIndex((f) => f.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'المادة غير موجودة' });
    }

    const current = files[index];
    if (title !== undefined) current.title = title.trim();
    if (speaker !== undefined) current.speaker = speaker.trim();
    if (category !== undefined) current.category = category.trim();
    if (type !== undefined) current.type = type.trim();
    if (description !== undefined) current.description = description.trim();
    if (originalSourceUrl !== undefined) current.originalSourceUrl = originalSourceUrl.trim();
    if (reviewStatus !== undefined) current.reviewStatus = reviewStatus.trim();
    if (featured !== undefined) current.featured = featured === true || featured === 'true';
    if (pdfUrl !== undefined) {
      current.pdfUrl = pdfUrl.trim();
      current.pdfFile = pdfUrl.trim();
    }
    if (htmlUrl !== undefined) {
      current.htmlUrl = htmlUrl.trim();
      current.htmlFile = htmlUrl.trim();
    }
    current.updatedAt = new Date().toISOString();

    files[index] = current;
    writeFilesData(files);

    res.json({ message: 'تم تحديث بيانات المادة بنجاح', file: current });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات المادة' });
  }
});

/**
 * DELETE /api/files/:id
 * حذف مادة بالمعرّف
 */
app.delete('/api/files/:id', requireAdmin, (req, res) => {
  try {
    const files = readFilesData();
    const index = files.findIndex((f) => f.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'المادة غير موجودة' });
    }

    const [removed] = files.splice(index, 1);

    // حذف الملفات المحلية إن كانت موجودة في uploads
    [removed.htmlFile, removed.pdfFile, removed.filename].forEach((file) => {
      if (file && !file.startsWith('http://') && !file.startsWith('https://')) {
        try {
          const safeName = path.basename(file);
          const fullPath = path.join(UPLOADS_DIR, safeName);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (e) {
          console.warn('Failed to unlink local file:', e.message);
        }
      }
    });

    writeFilesData(files);

    res.json({ message: 'تم حذف المادة بنجاح', file: removed });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المادة' });
  }
});

// ──────────────────────────────────────────────
// معالجة الأخطاء العامة
// ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('خطأ غير متوقع:', err.message);
  res.status(500).json({ error: 'حدث خطأ داخلي في الخادم' });
});

// ──────────────────────────────────────────────
// تشغيل وتصدير الخادم (متوافق مع Vercel والبيئات السحابية)
// ──────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ خادم مُذَكِّر يعمل على المنفذ ${PORT}`);
    console.log(`📂 الملفات الثابتة: ${PUBLIC_DIR}`);
    console.log(`📤 التخزين: Google Drive والملفات المحلية`);
  });
}

module.exports = app;
