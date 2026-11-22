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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mudhakkir2024';

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ترويسات الأمان الأساسية و CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
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
// دوال مساعدة
// ──────────────────────────────────────────────

/** قراءة بيانات الملفات من ملف JSON بحماية ضد UTF-8 BOM */
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

/** كتابة بيانات الملفات إلى ملف JSON */
function writeFilesData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** حذف ملف آمن من القرص */
function safeUnlink(filename) {
  if (!filename) return;
  try {
    const safeName = path.basename(filename);
    const fullPath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (e) {
    console.error(`Failed to unlink file ${filename}:`, e);
  }
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
// إعداد رفع الملفات (Multer)
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
    fileSize: 100 * 1024 * 1024, // الحد الأقصى: 100 ميجابايت
  },
});

// ──────────────────────────────────────────────
// نقاط النهاية (API Endpoints)
// ──────────────────────────────────────────────

/**
 * GET /api/health
 * فحص جاهزية الخادم للحوسبة السحابية والحاويات
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'mudhakkir',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/home
 * بيانات الصفحة الرئيسية: أحدث الإضافات، التصنيفات، السلاسل المميزة، والإحصاءات
 */
app.get('/api/home', (req, res) => {
  const files = readFilesData();
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
});

/**
 * GET /api/files
 * جلب قائمة جميع الملفات المرفوعة مع دعم الفلترة
 */
app.get('/api/files', (req, res) => {
  let files = readFilesData();
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
    if (format === 'pdf') files = files.filter((f) => f.type === 'pdf' || f.pdfFile);
    if (format === 'html') files = files.filter((f) => f.type === 'html' || f.htmlFile);
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
});

/**
 * GET /api/speakers
 * جلب قائمة بأسماء المقدّمين وعدد موادهم
 */
app.get('/api/speakers', (req, res) => {
  const files = readFilesData();
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
});

/**
 * GET /api/categories
 * جلب قائمة التصنيفات الفريدة
 */
app.get('/api/categories', (req, res) => {
  const files = readFilesData();
  const categories = [...new Set(files.map((f) => f.category).filter(Boolean))];
  res.json(categories);
});

/**
 * GET /api/files/:id
 * جلب معلومات ملف واحد بالمعرّف
 */
app.get('/api/files/:id', (req, res) => {
  const files = readFilesData();
  const file = files.find((f) => f.id === req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'الملف غير موجود' });
  }
  res.json(file);
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
 * رفع مادة علمية جديدة (صيغة تفاعلية HTML و/أو ملف PDF) مع البيانات الوصفية الكاملة
 */
app.post(
  '/api/upload',
  requireAdmin,
  upload.fields([
    { name: 'htmlFile', maxCount: 1 },
    { name: 'pdfFile', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  (req, res) => {
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
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'عنوان المادة مطلوب' });
      }

      let htmlFilename = null;
      let pdfFilename = null;

      if (req.files) {
        if (req.files.htmlFile && req.files.htmlFile[0]) {
          htmlFilename = req.files.htmlFile[0].filename;
        }
        if (req.files.pdfFile && req.files.pdfFile[0]) {
          pdfFilename = req.files.pdfFile[0].filename;
        }
        if (req.files.file && req.files.file[0]) {
          const f = req.files.file[0];
          const ext = path.extname(f.originalname).toLowerCase();
          if (ext === '.pdf') pdfFilename = f.filename;
          else htmlFilename = f.filename;
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
        htmlFile: htmlFilename,
        pdfFile: pdfFilename,
        filename: htmlFilename || pdfFilename || '',
        episodes: Array.isArray(parsedEpisodes) ? parsedEpisodes : [],
        uploadDate: new Date().toISOString(),
      };

      const files = readFilesData();
      files.unshift(fileEntry);
      writeFilesData(files);

      res.status(201).json({
        message: 'تمت إضافة المادة بنجاح',
        file: fileEntry,
      });
    } catch (err) {
      console.error('Upload handler error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء معالجة رفع المادة' });
    }
  }
);

/**
 * PUT /api/files/:id
 * تعديل البيانات الوصفية لمادة منشورة
 */
app.put('/api/files/:id', requireAdmin, (req, res) => {
  try {
    const files = readFilesData();
    const index = files.findIndex((f) => f.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'المادة غير موجودة' });
    }

    const current = files[index];
    const {
      title,
      speaker,
      category,
      type,
      description,
      originalSourceUrl,
      reviewStatus,
      featured,
    } = req.body;

    if (title !== undefined) current.title = title.trim();
    if (speaker !== undefined) current.speaker = speaker.trim();
    if (category !== undefined) current.category = category.trim();
    if (type !== undefined) current.type = type.trim();
    if (description !== undefined) current.description = description.trim();
    if (originalSourceUrl !== undefined) current.originalSourceUrl = originalSourceUrl.trim();
    if (reviewStatus !== undefined) current.reviewStatus = reviewStatus.trim();
    if (featured !== undefined) current.featured = featured === true || featured === 'true';

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
 * حذف مادة بالمعرّف مع تنظيف كافة ملفاتها من القرص
 */
app.delete('/api/files/:id', requireAdmin, (req, res) => {
  const files = readFilesData();
  const index = files.findIndex((f) => f.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'الملف غير موجود' });
  }

  const [removed] = files.splice(index, 1);

  // حذف كافة الملفات المرتبطة من القرص بأمان
  if (removed.htmlFile) safeUnlink(removed.htmlFile);
  if (removed.pdfFile) safeUnlink(removed.pdfFile);
  if (removed.filename && removed.filename !== removed.htmlFile && removed.filename !== removed.pdfFile) {
    safeUnlink(removed.filename);
  }

  // تحديث ملف البيانات
  writeFilesData(files);

  res.json({ message: 'تم حذف الملف بنجاح', file: removed });
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
if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ خادم مُذَكِّر يعمل على المنفذ ${PORT}`);
    console.log(`📂 الملفات الثابتة: ${PUBLIC_DIR}`);
    console.log(`📤 مجلد الرفع: ${UPLOADS_DIR}`);
  });
}

module.exports = app;
