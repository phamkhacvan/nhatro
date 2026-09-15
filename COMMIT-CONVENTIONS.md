# COMMIT-CONVENTIONS — Nhà Trọ (nhatro)

Quy ước commit message + quy trình commit cho repo này. Đọc trước khi commit.

---

## 1. Định dạng

```
<type>(<scope>): <mô tả ngắn>
```

- **type**: bắt buộc
- **scope**: tùy chọn nhưng **khuyến khích dùng** khi rõ phạm vi
- **mô tả**: tiếng Việt không dấu, bắt đầu bằng động từ, ≤ 72 ký tự, không có dấu chấm cuối
- Nếu cần giải thích sâu → thêm **body** (dòng trống rồi mô tả "tại sao", mỗi dòng ≤ 72 ký tự)

### Ví dụ đúng

```
feat(actions): them tien mien phi dien/nuoc/wifi theo thoa thuan
fix(actions): xoa row nhatro_monthly du khi doi move_in qua thang sau
perf(deploy): ep Vercel region sin1 de giam round-trip DB
security(auth): thu hoi session khi doi mat khau (token_version)
docs: them COMMIT-CONVENTIONS cho repo
chore(deps): nang xlsx 0.20.3 + next 16.3.4
```

### Ví dụ sai

```
them mien phi              ← thiếu type(scope)
fix: update many stuff     ← mô tả chung chung, khó hiểu
Fix bug (phieu)            ← viết hoa đầu dòng, sai thứ tự
feat: them A, them B va sua C  ← 1 commit làm 3 việc
```

---

## 2. Các `type` áp dụng

| type | Dùng khi | Ví dụ mô tả |
|------|----------|-------------|
| `feat` | Tính năng / hành vi mới | `the lay qua email khi confirm payment` |
| `fix` | Sửa lỗi, sai logic, sai dữ liệu | `chong de paid (CAS), chong dem trung` |
| `perf` | Tối ưu hiệu năng | `chay healMonthIntegrity song song` |
| `refactor` | Tái cấu trúc, KHÔNG đổi hành vi | `tach BangTinhTab ra component rieng` |
| `security` | Vá lỗ hổng, làm cứng, giảm attack surface | `sanitize next/qr/contract, CSP strict` |
| `docs` | README, DEPLOY, BACKUP-NOTE, tài liệu | `them BACKUP-NOTE cho quy trinh backup DB` |
| `chore` | Tooling, config, dependency, gitignore, misc | `nang xlsx + next den phien ban moi` |
| `style` | Format code, thu tự import, không đổi logic | `sap xep import + format theo eslint` |
| `test` | Thêm/sửa test (hữu ích khi có test suite) | `them unit test cho computeRow` |

> Không có `type` nào lấn: `audit`/`hardening` cũ → dùng `security`; "an toàn dữ liệu" → `fix` hoặc `security` tùy bản chất.

---

## 3. Các `scope` áp dụng

| scope | Tương ứng | Dùng khi đụng |
|-------|-----------|----------------|
| `actions` | `src/app/actions.ts` | server action (save/upsert/login/...) |
| `calc` | `src/lib/calc.ts` | công thức tính tiền, prorate, penalty, exempt |
| `ui` | `src/components/*`, client pages, CSS | month-table, phieu, room modal, toast, tab |
| `auth` | `src/lib/auth*.ts`, `src/middleware.ts`, `/login` | session, token, login/register/reset |
| `api` | `src/app/api/*` | QR, contract download, route handler |
| `db` | `supabase/` (seed, migrations), `*_rls.sql` | schema, migration, index, RLS |
| `deploy` | `vercel.json`, `next.config.ts` | region, CSP, headers, build config |
| `deps` | `package.json`, `package-lock.json` | nâng/hạ/đổi dependency |

Nếu đụng nhiều scope → chọn scope **chính**; nếu không rõ → bỏ scope (chỉ `feat:`/`fix:`/...).

---

## 4. Quy tắc nội dung

1. **Một commit = một thay đổi logic.** Không gộp feat + fix + refactor vào 1 commit.
2. **Viết mô tả trả lời "cái gì thay đổi và tại sao"**, không mô tả cách làm.
3. **Đề cập tên field/table/quy tắc nghiệp vụ** khi liên quan: `move_in`, `paid` (CAS), `old_index`, `nhatro_monthly`, `owner_id`... — giúp người đọc nhớ ngữ cảnh.
4. **Đơn vị tiền tên riêng dùng nguyên bản** (quy tắc nghiệp vụ: `prorate` theo `move_in`/`move_out`, "khách qua ở trên 5 ngày").
5. **Không lộ bí mật** trong message: không ghi key, token, password, email người thuê, IP cụ thể, URL nhạy cảm.
6. **Migration SQL**: đặt tên file `snake_case` mô tả (`room_exempt.sql`), idempotent (`IF NOT EXISTS`), commit kèm theo change liên quan; message dùng scope `db`.
7. **Không commit** file generate, `.env*`, `*.tsbuildinfo`, dữ liệu backup (đã trong `.gitignore`; `supabase/.temp/` cũng phải bỏ qua).

---

## 5. Quy trình trước khi commit

```bash
# 1. Kiểm tra trạng thái
git status
git diff                      # xem nội dung thay đổi
git diff --stat               # nắm phạm vi

# 2. Verify code (bắt buộc nếu đụng code)
npm run lint                  # 0 error (3 warning <img> hiện hữu là chấp nhận)
npx tsc --noEmit              # không lỗi type
npm run build                 # production build phải qua

# 3. Chỉ stage những gì thuộc commit hiện tại
git add <file cụ thể>         # KHÔNG dùng git add . một cách bừa bãi
# Nếu cần tách hunk: git add -p

# 4. Commit
git commit                    # mở editor, viết theo format trên
```

> Repo này deploy tay (`vercel --prod`) — không có CI/CD tự động. Nếu commit chỉ là tài liệu (`docs`/`chore`) → không cần build. Nếu đụng code → bắt buộc qua đủ 3 bước verify.

---

## 6. Mẹo viết mô tả hay

- Tránh "update", "fix bug", "change code" chung chung — nói rõ **hệ thống con + hành vi**:
  - ❌ `fix: sua loi phieu thu`
  - ✅ `fix(calc): tinh tien nuoc 0 khi thang dau chuyen phong`
- Dùng **thì hiện tại, câu mệnh lệnh** (imperative): "sua", "them", "xoa" — không "da sua", "se them".
- Khi có ngữ cảnh quan trọng (vì sao, ảnh hưởng) → ghi vào body:

```
perf(deploy): ep Vercel region sin1 de giam round-trip DB

dataForKy truoc day goi nhieu query noi tiep, round-trip x Singapore- US
lam 1 request dau +10s. Day region len sin1 (gan nhat) + chay cac
heal/validate song song giam xong ~90%.
```

- Commit bảo mật lớn có thể chia nhỏ theo từng vector tấn công nếu dễ tách; ngược lại gộp 1 commit `security(...)` kèm body liệt kê.

---

## 7. Xử lý tình huống

| Tình huống | Làm gì |
|------------|--------|
| Chưa verify code | Chạy đủ lint + tsc + build trước khi commit |
| Commit bị lỗi/hook chặn | Sửa và tạo **commit mới**, không amend commit lỗi |
| Thay đổi dính nhiều loại | Dùng `git add -p` tách thành nhiều commit |
| Chỉnh sửa tài liệu | 1 commit `docs:` — không cần build |
| Cần đẩy lên GitHub | `git push` — chỉ khi user yêu cầu |
| Backup DB | Theo `BACKUP-NOTE.md`, vào repo riêng `phamkhacvan/nhatro-backup` — không nhét vào repo app |