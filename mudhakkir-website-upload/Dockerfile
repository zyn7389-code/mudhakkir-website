# استخدام بيئة Node.js خفيفة ومستقرة
FROM node:20-alpine

# تحديد مجلد العمل
WORKDIR /usr/src/app

# نسخ ملفات الحزم وتثبيت الاعتماديات للإنتاج
COPY package*.json ./
RUN npm ci --only=production

# نسخ كود وموارد المشروع
COPY . .

# إنشاء مجلدات التخزين وضمان الصلاحيات
RUN mkdir -p data uploads public

# المتغيرات البيئية الافتراضية
ENV NODE_ENV=production
ENV PORT=3000
ENV ADMIN_PASSWORD=mudhakkir2024

# كشف المنفذ
EXPOSE 3000

# فحص جاهزية الخادم
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# تشغيل الخادم
CMD ["node", "server.js"]
