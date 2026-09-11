# BACKUP NOTE — Nhà Trọ (nhatro)

## Backup database Supabase

- **Zip backup**: `~/Desktop/nhatro-backup-20260911.zip` (AES-256, có mật khẩu)
- **Lưu trữ GitHub (private)**: https://github.com/phamkhacvan/nhatro-backup
  - Chứa zip mã hóa + `dump_api.py` + `dump_all_tables.sql`
- **Dữ liệu**: 10 bảng Supabase của project `legaleader-legal-app` (ref: `depsrerskyoocnozhhxz`)
  - nhatro_houses, nhatro_rooms, nhatro_prices, nhatro_monthly, nhatro_audit_log,
    nhatro_reset_requests, nhatro_login_attempts, nhatro_contracts, nhatro_settings, nhatro_users
- **Mật khẩu zip**: lưu trong Apple Password (`Mật khẩu` app) — tìm tên "nhatro-backup"
- **Giải nén**: `7z x nhatro-backup-20260911.zip` (nhập mật khẩu)
- **CSV gốc (không nén)**: `~/Desktop/nhatro-backup/`
- **Script dump lại**: `~/Desktop/nhatro-backup/dump_api.py` (chạy `python3 dump_api.py`)

## Cách backup lần sau

1. `python3 ~/Desktop/nhatro-backup/dump_api.py` — dump data qua REST API
2. Copy `nhatro_users.csv` từ query SQL nếu cần
3. Zip có mật khẩu: `cd ~/Desktop/nhatro-backup && 7z a -tzip -mx9 -p -mem=AES256 ../nhatro-backup-$(date +%Y%m%d).zip *.csv dump_all_tables.sql`
4. Push zip mới lên repo https://github.com/phamkhacvan/nhatro-backup:
   `cd /tmp/nhatro-backup-repo && cp ~/Desktop/nhatro-backup-*.zip . && git add . && git commit -m "Backup $(date +%Y%m%d)" && git push`

## Lưu ý an toàn

- KHÔNG đẩy CSV/thông tin backup lên repo public
- Nhớ revoke Supabase Personal Access Token khi không dùng:
  https://supabase.com/dashboard/account/tokens