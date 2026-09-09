-- Bật Row Level Security cho toàn bộ bảng của app nhà trọ.
-- App hiện chỉ dùng SERVICE KEY (supabase-js, role: service_role) -> service key BỎ QUA RLS,
-- nên bật RLS KHÔNG làm hỏng app.
-- Lợi ích: nếu anon key / public bị lộ, toàn bộ bảng bị TỪ CHỐI truy cập (hiện đang full-access vì RLS tắt).
--
-- CÁCH CHẠY: Supabase Dashboard -> SQL Editor -> dán toàn bộ file này -> Run.
-- NOTICE "no policy exists" là bình thường và MONG MUỐN (mọi policy permissive bị tắt,
-- chỉ còn service_role + owner table mới truy cập được).

ALTER TABLE public.nhatro_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_houses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_prices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_monthly        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_contracts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_audit_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhatro_reset_requests ENABLE ROW LEVEL SECURITY;

-- Chặn mọi quyền của role anon/authenticated trên các bảng này.
-- service_role (dùng bởi app) không bị ảnh hưởng.
REVOKE ALL
  ON TABLE public.nhatro_users,
       public.nhatro_houses,
       public.nhatro_rooms,
       public.nhatro_prices,
       public.nhatro_monthly,
       public.nhatro_contracts,
       public.nhatro_audit_log,
       public.nhatro_login_attempts,
       public.nhatro_reset_requests
  FROM anon, authenticated;