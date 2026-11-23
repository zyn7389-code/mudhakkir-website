const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const https = require('https');

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
const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
const COMMENTS_FILE = path.join(__dirname, 'data', 'comments.json');
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

// إنشاء ملف الإحصائيات إذا لم يكن موجوداً
if (!fs.existsSync(STATS_FILE)) {
  const initialStats = {
    totalVisitors: 312,
    registeredUsers: 16,
    totalReadingSeconds: 118400,
    pageViews: 1680,
    materialsReadCount: {},
    dailyVisits: {},
    recentSessions: []
  };
  fs.writeFileSync(STATS_FILE, JSON.stringify(initialStats, null, 2), 'utf-8');
}

// إنشاء ملف التعليقات إذا لم يكن موجوداً
if (!fs.existsSync(COMMENTS_FILE)) {
  fs.writeFileSync(COMMENTS_FILE, '{}', 'utf-8');
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
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-password, Authorization, x-github-token, x-github-owner, x-github-repo');
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

/** قراءة بيانات إحصائيات الزوار */
function readStatsData() {
  try {
    if (!fs.existsSync(STATS_FILE)) {
      return {
        totalVisitors: 312,
        registeredUsers: 16,
        totalReadingSeconds: 118400,
        pageViews: 1680,
        materialsReadCount: {},
        dailyVisits: {},
        recentSessions: []
      };
    }
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading stats:', err);
    return {
      totalVisitors: 312,
      registeredUsers: 16,
      totalReadingSeconds: 118400,
      pageViews: 1680,
      materialsReadCount: {},
      dailyVisits: {},
      recentSessions: []
    };
  }
}

/** حفظ بيانات إحصائيات الزوار */
function writeStatsData(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn('Stats write error:', err.message);
    return false;
  }
}

/** قراءة بيانات التعليقات */
function readCommentsData() {
  try {
    if (!fs.existsSync(COMMENTS_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(COMMENTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading comments:', err);
    return {};
  }
}

/** كتابة بيانات التعليقات */
function writeCommentsData(data) {
  try {
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn('Comments write error:', err.message);
    return false;
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

/** استخراج بيانات ربط GitHub للتحديث التلقائي */
function extractGitHubCreds(req) {
  const token = (req.headers['x-github-token'] || process.env.GITHUB_TOKEN || '').trim();
  const owner = (req.headers['x-github-owner'] || process.env.GITHUB_OWNER || '').trim();
  const repo = (req.headers['x-github-repo'] || process.env.GITHUB_REPO || '').trim();
  return { token, owner, repo };
}

/** مزامنة ملف data/files.json مباشرة مع مستودع GitHub */
function syncFilesJsonToGitHub({ owner, repo, token, content, message }) {
  return new Promise((resolve) => {
    if (!owner || !repo || !token) {
      return resolve({ success: false, skipped: true, reason: 'بيانات GitHub غير متوفرة' });
    }

    const path = 'data/files.json';
    const baseHeaders = {
      'User-Agent': 'Mudhakkir-Website-AutoSync',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
    };

    const getOptions = {
      hostname: 'api.github.com',
      path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
      method: 'GET',
      headers: baseHeaders,
    };

    const getReq = https.request(getOptions, (res) => {
      let getData = '';
      res.on('data', chunk => getData += chunk);
      res.on('end', () => {
        let sha = null;
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(getData);
            sha = parsed.sha;
          } catch {}
        }

        const contentBase64 = Buffer.from(JSON.stringify(content, null, 2), 'utf-8').toString('base64');
        const payload = JSON.stringify({
          message: message || 'تحديث تلقائي لمكتبة مُذَكِّر',
          content: contentBase64,
          sha: sha || undefined,
        });

        const putOptions = {
          hostname: 'api.github.com',
          path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
          method: 'PUT',
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        };

        const putReq = https.request(putOptions, (putRes) => {
          let putData = '';
          putRes.on('data', chunk => putData += chunk);
          putRes.on('end', () => {
            if (putRes.statusCode === 200 || putRes.statusCode === 201) {
              resolve({ success: true, statusCode: putRes.statusCode });
            } else {
              resolve({ success: false, statusCode: putRes.statusCode, error: putData });
            }
          });
        });

        putReq.on('error', (err) => resolve({ success: false, error: err.message }));
        putReq.write(payload);
        putReq.end();
      });
    });

    getReq.on('error', (err) => resolve({ success: false, error: err.message }));
    getReq.end();
  });
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
    const stats = readStatsData();

    // تسجيل زيادة في الزيارات وعدد الصفحات
    stats.pageViews = (stats.pageViews || 0) + 1;
    if (req.query.visit === '1') {
      stats.totalVisitors = (stats.totalVisitors || 0) + 1;
      const today = new Date().toISOString().slice(0, 10);
      stats.dailyVisits = stats.dailyVisits || {};
      stats.dailyVisits[today] = (stats.dailyVisits[today] || 0) + 1;
    }
    writeStatsData(stats);

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

    const totalHours = Math.max(1, Math.round((stats.totalReadingSeconds || 0) / 3600));

    res.json({
      stats: {
        totalItems: files.length,
        totalCategories: categories.length,
        totalSpeakers: speakersSet.size,
        totalSeries: seriesCount,
        totalVisitors: stats.totalVisitors || 0,
        totalReadingHours: totalHours,
        totalReadingSeconds: stats.totalReadingSeconds || 0,
        registeredUsers: stats.registeredUsers || 0,
        pageViews: stats.pageViews || 0,
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
 * POST /api/stats/track
 * تسجيل حركة الزوار، وقت القراءة، وقراءة المواد
 */
app.post('/api/stats/track', (req, res) => {
  try {
    const { type, durationSeconds, itemId, itemTitle, path: pagePath } = req.body || {};
    const stats = readStatsData();

    if (type === 'visit') {
      stats.totalVisitors = (stats.totalVisitors || 0) + 1;
      const today = new Date().toISOString().slice(0, 10);
      stats.dailyVisits = stats.dailyVisits || {};
      stats.dailyVisits[today] = (stats.dailyVisits[today] || 0) + 1;
    }

    if (type === 'heartbeat' && typeof durationSeconds === 'number' && durationSeconds > 0 && durationSeconds <= 300) {
      stats.totalReadingSeconds = (stats.totalReadingSeconds || 0) + durationSeconds;
    }

    if (type === 'register') {
      stats.registeredUsers = (stats.registeredUsers || 0) + 1;
    }

    if (type === 'read_item' && itemId) {
      stats.materialsReadCount = stats.materialsReadCount || {};
      if (!stats.materialsReadCount[itemId]) {
        stats.materialsReadCount[itemId] = { title: itemTitle || 'مادة علمية', views: 0 };
      }
      stats.materialsReadCount[itemId].views += 1;
      if (itemTitle) stats.materialsReadCount[itemId].title = itemTitle;
    }

    if (type === 'session_end' || type === 'read_item') {
      stats.recentSessions = stats.recentSessions || [];
      stats.recentSessions.unshift({
        date: new Date().toISOString(),
        durationSeconds: durationSeconds || 60,
        page: itemTitle || pagePath || 'تصفح عام',
        type: type === 'read_item' ? 'مطالعة مادة' : 'جلسة تصفح'
      });
      if (stats.recentSessions.length > 50) {
        stats.recentSessions = stats.recentSessions.slice(0, 50);
      }
    }

    writeStatsData(stats);
    res.json({ success: true, totalVisitors: stats.totalVisitors });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record tracking' });
  }
});

/**
 * GET /api/stats/admin
 * جلب تفاصيل إحصائية الزوار الشاملة للوحة التحكم
 */
app.get('/api/stats/admin', requireAdmin, (req, res) => {
  try {
    const stats = readStatsData();

    const topMaterials = Object.keys(stats.materialsReadCount || {}).map((id) => ({
      id,
      title: stats.materialsReadCount[id].title,
      views: stats.materialsReadCount[id].views
    })).sort((a, b) => b.views - a.views).slice(0, 10);

    const avgMinutesPerVisitor = stats.totalVisitors > 0
      ? (stats.totalReadingSeconds / stats.totalVisitors / 60).toFixed(1)
      : '0';

    res.json({
      totalVisitors: stats.totalVisitors || 0,
      registeredUsers: stats.registeredUsers || 0,
      totalReadingSeconds: stats.totalReadingSeconds || 0,
      totalReadingHours: (stats.totalReadingSeconds / 3600).toFixed(1),
      avgMinutesPerVisitor,
      pageViews: stats.pageViews || 0,
      topMaterials,
      recentSessions: (stats.recentSessions || []).slice(0, 20),
      dailyVisits: stats.dailyVisits || {}
    });
  } catch (err) {
    res.status(500).json({ error: 'تعذر جلب إحصائية الزوار' });
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
          speakerMap[f.speaker] = {
            name: f.speaker,
            itemsCount: 0,
            categories: new Set(),
            image: f.speakerImage || '',
            bio: f.speakerBio || ''
          };
        }
        speakerMap[f.speaker].itemsCount++;
        if (f.speakerImage && !speakerMap[f.speaker].image) {
          speakerMap[f.speaker].image = f.speakerImage;
        }
        if (f.speakerBio && !speakerMap[f.speaker].bio) {
          speakerMap[f.speaker].bio = f.speakerBio;
        }
        if (f.category) speakerMap[f.speaker].categories.add(f.category);
      }
    });
    const list = Object.values(speakerMap).map((s) => ({
      name: s.name,
      itemsCount: s.itemsCount,
      categories: [...s.categories],
      image: s.image,
      bio: s.bio,
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
 * GET /api/comments/:itemId
 * جلب جميع التعليقات الخاصة بمادة علمية معينة
 */
app.get('/api/comments/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const commentsData = readCommentsData();
    const list = commentsData[itemId] || [];
    const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: 'تعذر جلب التعليقات' });
  }
});

/**
 * POST /api/comments/:itemId
 * إضافة تعليق جديد (يتطلب أن يكون المستخدم مسجلاً في الموقع)
 */
app.post('/api/comments/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const { userName, userEmail, userAvatar, content, isGoogle } = req.body || {};

    if (!userName && !userEmail) {
      return res.status(401).json({ error: 'التعليق متاح للأعضاء المسجلين في الموقع فقط' });
    }

    const cleanContent = (content || '').trim();
    if (!cleanContent || cleanContent.length < 2) {
      return res.status(400).json({ error: 'يرجى كتابة نص التعليق أو الفائدة' });
    }

    if (cleanContent.length > 2000) {
      return res.status(400).json({ error: 'التعليق طويل جداً (الحد الأقصى ٢٠٠٠ حرف)' });
    }

    const newComment = {
      id: uuidv4(),
      itemId,
      userName: (userName || userEmail.split('@')[0] || 'طالب علم').trim(),
      userEmail: (userEmail || '').trim(),
      userAvatar: userAvatar || '',
      isGoogle: Boolean(isGoogle),
      content: cleanContent,
      createdAt: new Date().toISOString()
    };

    const commentsData = readCommentsData();
    if (!commentsData[itemId]) {
      commentsData[itemId] = [];
    }
    commentsData[itemId].unshift(newComment);
    writeCommentsData(commentsData);

    res.status(201).json({
      success: true,
      message: 'تم نشر تعليقك المبارك بنجاح!',
      comment: newComment
    });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ التعليق' });
  }
});

/**
 * DELETE /api/comments/:itemId/:commentId
 * حذف تعليق (للمدير)
 */
app.delete('/api/comments/:itemId/:commentId', requireAdmin, (req, res) => {
  try {
    const { itemId, commentId } = req.params;
    const commentsData = readCommentsData();
    if (!commentsData[itemId]) {
      return res.status(404).json({ error: 'المادة غير موجودة' });
    }

    const initialLength = commentsData[itemId].length;
    commentsData[itemId] = commentsData[itemId].filter(c => c.id !== commentId);

    if (commentsData[itemId].length === initialLength) {
      return res.status(404).json({ error: 'التعليق غير موجود' });
    }

    writeCommentsData(commentsData);
    res.json({ success: true, message: 'تم حذف التعليق بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'تعذر حذف التعليق' });
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
 * POST /api/github-test
 * فحص صحة بيانات ربط مستودع GitHub
 */
app.post('/api/github-test', requireAdmin, (req, res) => {
  const { owner, repo, token } = extractGitHubCreds(req);
  if (!owner || !repo || !token) {
    return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم، والمستودع، ورمز الـ Token' });
  }

  const testOptions = {
    hostname: 'api.github.com',
    path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    method: 'GET',
    headers: {
      'User-Agent': 'Mudhakkir-Website-AutoSync',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
    },
  };

  const testReq = https.request(testOptions, (ghRes) => {
    let body = '';
    ghRes.on('data', c => body += c);
    ghRes.on('end', () => {
      if (ghRes.statusCode === 200) {
        return res.json({ success: true, message: 'تم التحقق من مستودع GitHub بنجاح!' });
      }
      return res.status(400).json({ error: `فشل الاتصال بـ GitHub (كود ${ghRes.statusCode}): تأكد من صحة الرمز واسم المستودع والصلاحيات (repo contents)` });
    });
  });

  testReq.on('error', err => res.status(500).json({ error: 'خطأ اتصال: ' + err.message }));
  testReq.end();
});

/**
 * POST /api/upload
 * إضافة وتوثيق مادة علمية جديدة (رابط جوجل درايف أو رفع ملف محلي) مع مزامنة GitHub
 */
app.post('/api/upload', requireAdmin, uploadMiddleware, async (req, res) => {
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
      coverImage,
      coverUrl,
      speakerImage,
      speakerImageUrl,
      speakerBio,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'عنوان المادة مطلوب' });
    }

    let finalHtmlUrl = (htmlUrl || '').trim();
    let finalPdfUrl = (pdfUrl || '').trim();
    const finalCoverImage = (coverImage || coverUrl || '').trim();
    const finalSpeakerImage = (speakerImage || speakerImageUrl || '').trim();
    const finalSpeakerBio = (speakerBio || '').trim();

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
      coverImage: finalCoverImage,
      speakerImage: finalSpeakerImage,
      speakerBio: finalSpeakerBio,
      filename: finalHtmlUrl || finalPdfUrl || '',
      episodes: Array.isArray(parsedEpisodes) ? parsedEpisodes : [],
      uploadDate: new Date().toISOString(),
    };

    const files = readFilesData();
    files.unshift(fileEntry);
    writeFilesData(files);

    // مزامنة تلقائية مع مستودع GitHub
    const ghCreds = extractGitHubCreds(req);
    let ghSync = null;
    if (ghCreds.token && ghCreds.owner && ghCreds.repo) {
      ghSync = await syncFilesJsonToGitHub({
        ...ghCreds,
        content: files,
        message: `إضافة مادة: ${fileEntry.title}`,
      });
    }

    res.status(201).json({
      message: (ghSync && ghSync.success)
        ? 'تم حفظ المادة وتحديث مستودع GitHub بنجاح! سيتم نشرها تلقائياً على الموقع خلال ثوانٍ.'
        : 'تم حفظ المادة بنجاح.',
      file: fileEntry,
      githubSynced: Boolean(ghSync && ghSync.success),
    });
  } catch (err) {
    console.error('Upload handler error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء معالجة إضافة المادة' });
  }
});

/**
 * PUT /api/files/:id
 * تعديل البيانات الوصفية وروابط مادة منشورة مع مزامنة GitHub
 */
app.put('/api/files/:id', requireAdmin, async (req, res) => {
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
      coverImage,
      coverUrl,
      speakerImage,
      speakerImageUrl,
      speakerBio,
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
    if (coverImage !== undefined || coverUrl !== undefined) {
      current.coverImage = (coverImage !== undefined ? coverImage : coverUrl).trim();
    }
    if (speakerImage !== undefined || speakerImageUrl !== undefined) {
      current.speakerImage = (speakerImage !== undefined ? speakerImage : speakerImageUrl).trim();
    }
    if (speakerBio !== undefined) {
      current.speakerBio = speakerBio.trim();
    }
    current.updatedAt = new Date().toISOString();

    files[index] = current;
    writeFilesData(files);

    // مزامنة مع GitHub
    const ghCreds = extractGitHubCreds(req);
    let ghSync = null;
    if (ghCreds.token && ghCreds.owner && ghCreds.repo) {
      ghSync = await syncFilesJsonToGitHub({
        ...ghCreds,
        content: files,
        message: `تعديل مادة: ${current.title}`,
      });
    }

    res.json({
      message: (ghSync && ghSync.success)
        ? 'تم تحديث بيانات المادة وتحديث مستودع GitHub بنجاح!'
        : 'تم تحديث بيانات المادة بنجاح',
      file: current,
      githubSynced: Boolean(ghSync && ghSync.success),
    });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات المادة' });
  }
});

/**
 * DELETE /api/files/:id
 * حذف مادة بالمعرّف مع مزامنة GitHub
 */
app.delete('/api/files/:id', requireAdmin, async (req, res) => {
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

    // مزامنة مع GitHub
    const ghCreds = extractGitHubCreds(req);
    let ghSync = null;
    if (ghCreds.token && ghCreds.owner && ghCreds.repo) {
      ghSync = await syncFilesJsonToGitHub({
        ...ghCreds,
        content: files,
        message: `حذف مادة: ${removed.title}`,
      });
    }

    res.json({
      message: (ghSync && ghSync.success)
        ? 'تم حذف المادة وتحديث مستودع GitHub بنجاح!'
        : 'تم حذف المادة بنجاح',
      file: removed,
      githubSynced: Boolean(ghSync && ghSync.success),
    });
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
