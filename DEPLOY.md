# Hướng dẫn deploy nhatro (Vercel + Supabase)

Ứng dụng quản lý tiền trọ (Next.js + Supabase Postgres), chạy trên Vercel.

## 1. Tạo & cấu hình Supabase (miễn phí)

1. Vào https://supabase.com → Sign in → New project (region gần bạn, VD Singapore).
2. Vào **SQL Editor**, chạy lần lượt:
   - Toàn bộ nội dung `supabase/seed.sql`
   - (Nếu là DB cũ nâng cấp lên multi-tenant) Toàn bộ nội dung `supabase/migrations/multi_tenant.sql`
   - (Nếu chưa có tính năng hợp đồng phòng) Toàn bộ nội dung `supabase/migrations/contracts.sql`
3. Vào **Settings → API**:
   - `Project URL` → điền vào `SUPABASE_URL`
   - `service_role` key → điền vào `SUPABASE_SERVICE_KEY`

Không cần bật Supabase Auth — app tự quản lý tài khoản (email + scrypt) và session JWT.

## 2. Deploy lên Vercel

```bash
cd ~/nhatro
vercel login                 # đăng nhập (mở browser)
vercel link                  # tạo/link project
vercel env add SUPABASE_URL          # nhập từng biến (Production)
vercel env add SUPABASE_SERVICE_KEY
vercel env add SESSION_SECRET        # VD: openssl rand -hex 32
vercel env add RESEND_API_KEY        # nếu dùng gửi email (Resend)
vercel env add MAIL_FROM             # VD: noreply@ten-mien-cua-ban
vercel env add ADMIN_NOTIFY_EMAIL    # (tùy chọn) nhận thông báo bảo mật
vercel --prod
```

Ghi chú:
- `SESSION_SECRET` bắt buộc, nếu thiếu app sẽ lỗi khi chạy (`Thiếu SESSION_SECRET`).
- `RESEND_API_KEY`/`MAIL_FROM` bắt buộc nếu muốn gửi phiếu thu qua email (phải verify domain trên Resend).
- `ADMIN_PASSWORD` đã **không còn dùng** — đăng nhập = email + mật khẩu đăng ký.

## 3. (Tùy chọn) Gắn subdomain

1. Vercel dashboard → project → **Settings → Domains** → Add domain.
2. Nếu nameserver đang trỏ `vercel-dns.com`, Vercel tự tạo DNS — không cần đụng registrar.
3. Khi status = Valid, mở site.

## Chạy local

```bash
cp .env.local.example .env.local   # điền giá trị thật
npm install
npm run dev
```

## Lưu ý multi-tenant

- User **đầu tiên** đăng ký sẽ tự thành **admin** và được nhận toàn bộ nhà hiện có chưa có chủ (`owner_id IS NULL`).
- Môi trường prod cần chắc chắn có ít nhất 1 user admin để quản lý tài khoản khác.