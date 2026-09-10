-- Các bảng phụ trợ bị thiếu so với supabase_rls.sql + được app tham chiếu.
-- Chạy bằng tay trên Supabase SQL Editor (idempotent - an toàn chạy lại).
-- Lưu ý: nếu bản production đã có bảng (được tạo tay), CREATE TABLE IF NOT EXISTS sẽ bỏ qua.

CREATE TABLE IF NOT EXISTS public.nhatro_audit_log (
  id bigserial PRIMARY KEY,
  house_id bigint NOT NULL,
  ky text,
  room text,
  field text NOT NULL,
  old_val text,
  new_val text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.nhatro_audit_log IS 'Nhật ký thay đổi dữ liệu theo phòng/kỳ';

CREATE TABLE IF NOT EXISTS public.nhatro_login_attempts (
  ip text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);
COMMENT ON TABLE public.nhatro_login_attempts IS 'Chống brute-force đăng nhập theo IP';

CREATE TABLE IF NOT EXISTS public.nhatro_reset_requests (
  ip text PRIMARY KEY,
  last_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.nhatro_reset_requests IS 'Nhịp điệu yêu cầu đặt lại mật khẩu theo IP';

-- Index cho audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_house_created
  ON public.nhatro_audit_log (house_id, created_at DESC);

-- RLS: policy tự chứa (không phụ thuộc helper) — an toàn chạy trên bất kỳ project nào.
ALTER TABLE public.nhatro_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner full on audit log" ON public.nhatro_audit_log;
CREATE POLICY "owner full on audit log" ON public.nhatro_audit_log
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.nhatro_houses h
    WHERE h.id = house_id AND h.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.nhatro_houses h
    WHERE h.id = house_id AND h.owner_id = auth.uid()
  ));