-- ============================================================================
-- قواعد أمان Supabase (Row Level Security - RLS) لمشروع مُذَكِّر
-- القراءة عامة للمحتوى العام، والكتابة والتعديل والحذف محصورة بحساب المشرف فقط
-- ============================================================================

-- 1. تفعيل RLS على الجداول
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 2. دالة التحقق من المشرف عبر البريد الإلكتروني الموثق أو المعرف (UID)
-- استبدل YOUR_ADMIN_EMAIL@gmail.com و ADMIN_UUID_HERE ببيانات المشرف الفعلية
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email') = 'YOUR_ADMIN_EMAIL@gmail.com'
    OR auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid,
    FALSE
  );
$$;

-- 3. سياسات جدول المواد العلمية (materials): القراءة عامة، التعديل/الإضافة/الحذف للمشرف فقط
DROP POLICY IF EXISTS "Public read materials" ON public.materials;
CREATE POLICY "Public read materials"
  ON public.materials FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin write materials" ON public.materials;
CREATE POLICY "Admin write materials"
  ON public.materials FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. سياسات جدول الإحصائيات (stats): القراءة عامة، التعديل/الحذف للمشرف فقط
DROP POLICY IF EXISTS "Public read stats" ON public.stats;
CREATE POLICY "Public read stats"
  ON public.stats FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin write stats" ON public.stats;
CREATE POLICY "Admin write stats"
  ON public.stats FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. سياسات جدول إعدادات الإدارة (admin_config): محصور بالمشرف فقط قراءةً وكتابة
DROP POLICY IF EXISTS "Admin only config" ON public.admin_config;
CREATE POLICY "Admin only config"
  ON public.admin_config FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. سياسات جدول التعليقات (comments): القراءة عامة، الإضافة للمسجلين، الحذف والتعديل للمشرف أو صاحب التعليق
DROP POLICY IF EXISTS "Public read comments" ON public.comments;
CREATE POLICY "Public read comments"
  ON public.comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert comments" ON public.comments;
CREATE POLICY "Authenticated insert comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin or owner manage comments" ON public.comments;
CREATE POLICY "Admin or owner manage comments"
  ON public.comments FOR DELETE
  USING (public.is_admin() OR auth.uid() = user_id);
