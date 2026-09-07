# Hướng dẫn deploy nhatro.legaleader.com

Ứng dụng quản lý tiền trọ (Next.js + Supabase Postgres), chạy trên Vercel,
gắn subdomain `nhatro.legaleader.com` (legaleader.com đã dùng Vercel nên thêm domain rất dễ).

## 1. Tạo Supabase (miễn phí)
1. Vào https://supabase.com → Sign in → New project (miễn phí).
2. Đặt tên bất kỳ (VD: nhatro), mật khẩu database, region gần (Singapore).
3. Vào **SQL Editor**, dán toàn bộ nội dung file `supabase/seed.sql`, bấm **Run**.
4. Vào **Settings → API**:
   - `Project URL` → điền vào `SUPABASE_URL`
   - `service_role` key → điền vào `SUPABASE_SERVICE_KEY`
5. `ADMIN_PASSWORD` = mật khẩu đăng nhập app (tự đặt).
6. `SESSION_SECRET` = một chuỗi dài bất kỳ (VD: dùng lệnh `openssl rand -hex 32`).

## 2. Deploy lên Vercel
```bash
cd ~/nhatro
vercel login                 # đăng nhập (mở browser)
vercel link                  # tạo/link project
vercel env add SUPABASE_URL          # nhập từng biến (Production)
vercel env add SUPABASE_SERVICE_KEY
vercel env add ADMIN_PASSWORD
vercel env add SESSION_SECRET
vercel --prod
```

## 3. Gắn subdomain
1. Trên Vercel dashboard → project → **Settings → Domains** → Add: `nhatro.legaleader.com`.
2. Vì nameserver của legaleader.com đang trỏ vercel-dns.com, Vercel **tự tạo DNS** cho subdomain — không cần đụng bên registrar.
3. Sau khi status = Valid, mở https://nhatro.legaleader.com

## Chạy local (sau khi có Supabase)
```bash
cp .env.local.example .env.local   # điền giá trị thật
npm run dev
```