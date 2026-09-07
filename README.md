# Nhatro — Quản lý nhà trọ

Ứng dụng web quản lý thu tiền nhà trọ: tính phiếu thu hằng tháng (tiền phòng, điện, nước, wifi, phụ phí), xuất phiếu in/ký ảnh gửi Zalo, gửi email, dashboard doanh thu. Hỗ trợ **multi-tenant**: mỗi người đăng ký tài khoản và quản lý nhà trọ riêng.

- **Frontend/Backend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **Database**: Supabase (PostgreSQL) — dùng `service_role` key nên **mọi truy vấn đều scope theo `owner_id` ở tầng ứng dụng**
- **Auth**: email + mật khẩu (scrypt, do app tự quản lý — không dùng Supabase Auth) + session JWT (jose)
- **Email**: Resend (gửi phiếu thu, thông báo đăng ký/đặt lại mật khẩu)
- **QR**: VietQR (qr-preview, qr local)
- **Vercel** deploy (VD: `nhatro.legaleader.com`)

---

## Cấu trúc dự án

```
src/
├── app/
│   ├── (app)/                     # Nhóm route đã đăng nhập
│   │   ├── page.tsx               # Dashboard (tổng doanh thu, đã thu, còn phải thu)
│   │   ├── bang-tinh/page.tsx     # Redirect → /thang/[ky]  (bảng tính tháng hiện tại)
│   │   ├── thang/[ky]/page.tsx    # Bảng tính 1 tháng (server-rendered)
│   │   ├── nha/[id]/page.tsx      # Workspace 1 nhà: bảng tính / lịch sử / cài đặt / phòng
│   │   ├── phieu/[ky]/[room]/page.tsx  # Phiếu thu của 1 phòng (copy ảnh, QR, gửi email)
│   │   ├── lich-su/page.tsx       # Lịch sử (bảng tính các tháng)
│   │   ├── cai-dat/page.tsx       # Cài đặt (thông tin nhà, giá, soạn phiếu, tài khoản)
│   │   └── layout.tsx             # Nav + kiểm tra session
│   ├── login/page.tsx             # Đăng nhập / đăng ký
│   ├── api/
│   │   ├── qr/route.ts            # Trả QR tĩnh theo bank+acc từ query
│   │   └── qr-preview/route.ts    # Preview QR khi soạn phiếu
│   └── actions.ts                 # Server Actions: toàn bộ logic đọc/ghi dữ liệu
├── components/
│   ├── month-table.tsx            # Bảng tính tháng (edit cell, chốt chỉ số, save)
│   ├── phieu-card.tsx             # Phiếu thu gọn (copy ảnh, in)
│   ├── phieu-actions.tsx          # Nút hành động phiếu (copy ảnh, gửi email)
│   ├── house-workspace.tsx        # Tab workspace 1 nhà
│   ├── home-tabs.tsx              # Dashboard tabs
│   ├── settings-form.tsx          # Cấu hình nhà + soạn phiếu
│   ├── rooms-manager.tsx          # Quản lý phòng (thêm/sửa/xóa)
│   ├── login-form.tsx             # Login/Register UI
│   ├── account-manager.tsx        # Quản lý tài khoản/người dùng
│   ├── revenue-chart.tsx          # Biểu đồ doanh thu
│   └── ...                        # cai-dat-tabs, month-selector, skeleton, toast, ...
└── lib/
    ├── calc.ts                    # Công thức tính tiền (lõi nghiệp vụ)
    ├── types.ts                   # Kiểu dữ liệu (House, Room, MonthlyRow, ComputedRow...)
    ├── auth.ts                    # JWT (edge-safe, dùng jose) — sign/verify session
    ├── auth-server.ts             # Auth server-only: getCurrentUser, hash/verify scrypt
    ├── supabase.ts                # Client Supabase (service role)
    ├── banks.ts                   # Danh sách ngân hàng (VietQR)
    └── dirty.ts                   # Theo dõi trạng thái "chưa lưu" khi rời trang

supabase/
├── seed.sql                       # Tạo toàn bộ schema + seed (chạy 1 lần khi setup DB)
└── migrations/multi_tenant.sql    # Migration bảng users + owner_id cho nhà trọ
```

---

## Biến môi trường (`.env.local`)

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `SUPABASE_URL` | ✅ | Project URL của Supabase (`Settings → API`) |
| `SUPABASE_SERVICE_KEY` | ✅ | `service_role` key (giữ bí mật — chạy ở server) |
| `SESSION_SECRET` | ✅ | Chuỗi bí mật ký session JWT (VD: `openssl rand -hex 32`) |
| `RESEND_API_KEY` | để gửi email | Key Resend — gửi phiếu thu qua email, thông báo |
| `MAIL_FROM` | để gửi email | Địa chỉ gửi (phải verify domain trên Resend) |
| `ADMIN_NOTIFY_EMAIL` | tùy chọn | Nhận thông báo đăng nhập/đặt lại mật khẩu |

File mẫu: `.env.local.example`. **KHÔNG commit `.env.local`** (đã có trong `.gitignore`).

---

## Chạy local

```bash
npm install
cp .env.local.example .env.local   # điền giá trị thật
npm run dev                        # http://localhost:3000
```

Yêu cầu: DB Supabase đã chạy `supabase/seed.sql` (`npm run db:setup` nếu có script — xem DEPLOY.md).

---

## Cách tính tiền (nghiệp vụ lõi — `calc.ts`)

> Mô hình **lag 1 tháng**: phiếu/bảng tính tháng **M** thu tiêu thụ tháng **M-1**.
> Tức dữ liệu điện nước/khách đêm của tháng `M-1` được tính và thu trên phiếu tháng `M`.

- **Tiền phòng**: giá theo số người ở (`prices[occupancy]`), nhân tỷ lệ ngày thực ở theo `move_in`/`move_out` (prorate). Quy tắc "Khách qua ở trên 5 ngày" → giữ nguyên tiền phòng 1 người.
- **Tiền nước** × **Wifi + Rác**: tính theo số người tháng trước (`prevOcc`); nếu phòng có máy giặt → nước **150k/người/tháng** (thay vì `water_rate` mặc định). Khách ở trên 5 ngày tính như **2 người**. Tháng đầu chuyển vào → nước/wifi = 0.
- **Tiền điện**: `(chỉ số mới − chỉ số cũ) × elec_rate` dựa trên chỉ số của tháng được thu.
- **Phụ phí**: đêm khách + vi phạm:
  ```ts
  n ≤ 2 ? 0 : 200000 + (n-3) * 250000   // số đêm khách
  + v * 500000                          // vi phạm
  + (khách > 5 ngày ? 500000 : 0)       // phụ phí khách qua ở
  ```
- **Thành tiền** = phòng + nước + wifi + điện + phụ phí. **Còn phải thu** = tổng − đã đóng.

Hàm chính: `computeRow(house, prices, row, prevRow)` → `ComputedRow`; bảng tính dùng `computeRows` cho nhiều phòng. Ghi chú hiển thị trên phiếu do `utilNote()` sinh ra (đủ tháng: `(x người, tháng M/YYYY)`; ở thiếu ngày: `(x người, tính theo X/Y ngày)`).

---

## Routes & luồng chính

| Công việc | Đi qua |
|-----------|--------|
| Xem bảng tính 1 tháng | `/thang/[ky]` → `dataForKy()` |
| Xem/sửa bảng tính trong workspace nhà | `/nha/[id]` (tab Bảng tính) |
| Mở phiếu thu phòng | `/phieu/[ky]/[room]` → `computeRow` |
| Chốt chỉ số điện / đóng tiền | Bảng tính `thang/[ky]`: edit cell → `saveMonth` |
| Gửi phiếu email | `phieu-actions` → `sendPhieuEmail` (Resend) |
| Copy ảnh phiếu gửi Zalo | `PhieuCard` → html-to-image → clipboard |
| Dashboard doanh thu | `/` → `dashboardData()` |
| Quản lý phòng / soạn phiếu / giá | `/nha/[id]` tab Cài đặt |

---

## Multi-tenant

- Bảng `nhatro_users` (email + password_hash), mỗi `nhatro_houses` có `owner_id`.
- **Đăng ký công khai**: user đầu tiên tự thành admin và nhận mọi nhà hiện có chưa có chủ; user mới bắt đầu trống.
- **Isolation**: vì app dùng `service_role` key (RLS không áp dụng cho key này), mọi query đều bị scope ở tầng code: `myActive()`, `myHouseList()`, `getCurrentUser()`, và các server action luôn filter theo `user.id` / `house.owner_id`. Không nhúng owner vào client.
- Session: cookie `session` (JWT ký bằng `SESSION_SECRET`, `sub` = user id). Xem `lib/auth.ts` (edge-safe, dùng jose).

---

## Triển khai (Vercel)

```bash
vercel login
vercel link
vercel env add SUPABASE_URL        # Production
vercel env add SUPABASE_SERVICE_KEY
vercel env add SESSION_SECRET
vercel env add RESEND_API_KEY      # nếu dùng email
vercel env add MAIL_FROM
vercel --prod
```

Chi tiết + cách gắn subdomain: xem [DEPLOY.md](https://github.com/phamkhacvan/nhatro/blob/main/DEPLOY.md).

---

## Lint / Build

```bash
npm run lint     # ESLint (Next.js)
npm run build    # kiểm tra biên dịch TS + production build
```

> Lưu ý phiên bản Next.js trong repo có breaking changes so với tài liệu training data lẫn tài liệu cũ của Next.js — đọc `node_modules/next/dist/docs/` trước khi viết code mới.