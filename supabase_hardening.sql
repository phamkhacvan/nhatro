-- Chạy trong Supabase Dashboard → SQL Editor
-- Hardening nhỏ: chặn race thằng admin đầu tiên + thu hồi session khi đổi mật khẩu

-- 1) Đảm bảo đúng 1 admin duy nhất (partial unique index). Nếu 2 người đăng ký cùng lúc,
--    em nào insert is_admin=true trước sẽ thắng; em sau nhận lỗi 23505 và được tạo lại như user thường.
CREATE UNIQUE INDEX IF NOT EXISTS nhatro_users_single_admin ON nhatro_users ((true)) WHERE is_admin;

-- 2) Cột token_version: tăng lên mỗi lần đổi mật khẩu → mọi session JWT cũ bị vô hiệu.
ALTER TABLE nhatro_users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

-- Kiểm tra dữ liệu: phòng "1" bị mồ côi (có dòng monthly nhưng không có record trong nhatro_rooms nhà 1)?
-- SELECT house_id, count(*) FROM nhatro_monthly WHERE room = '1' GROUP BY house_id;
-- SELECT room, occupancy, tenant FROM nhatro_rooms WHERE house_id = 1 AND room = '1';