"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { UAParser } from "ua-parser-js";
import { sb } from "@/lib/supabase";
import { STATIC_BANKS, Bank } from "@/lib/banks";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { getCurrentUser, sessionData, hashPassword, verifyPassword, SessionUser } from "@/lib/auth-server";
import { House, MonthlyRow, Room, ComputedRow, ContractMeta } from "@/lib/types";
import { prevKy, nextKy, computeRows, pricesToMap, applyRoomSync, displayKy, fmt, computeRow, vietQrLocalUrl, fmtDateVi, utilNote, exemptLabel } from "@/lib/calc";

async function logAudit(houseId: number, entries: { ky?: string; room?: string; field: string; old_val: string; new_val: string }[]) {
  const rows = entries.filter((e) => e.old_val !== e.new_val).map((e) => ({ house_id: houseId, ...e }));
  if (rows.length === 0) return;
  const { error } = await sb.from("nhatro_audit_log").insert(rows);
  if (error?.message) console.error("audit-insert:", error.message);
}

const NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "info@legaleader.com";

function ipFromHeaders(hs: Headers): string {
  const fwd = hs.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || hs.get("x-real-ip") || "unknown";
}

function isPrivateIp(ip: string): boolean {
  if (!ip || ip === "unknown" || ip === "localhost" || ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  return /^(10\.|127\.|0\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)/.test(ip);
}

async function ipLocation(ip: string): Promise<string> {
  if (isPrivateIp(ip)) return "";
  try {
    const r = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`, {
      signal: AbortSignal.timeout(4000),
    });
    const j = (await r.json()) as { status?: string; country?: string; regionName?: string; city?: string };
    if (r.ok && j.status === "success") return [j.city, j.regionName, j.country].filter(Boolean).join(", ");
  } catch {
    /* noop */
  }
  return "";
}

function describeDevice(ua: string | null): string {
  if (!ua) return "Trình duyệt không xác định";
  const p = new UAParser(ua).getResult();
  const browser = p.browser?.name ? `${p.browser.name}${p.browser.version ? " " + p.browser.version : ""}` : "Trình duyệt không xác định";
  const os = p.os?.name ? `${p.os.name}${p.os.version ? " " + p.os.version : ""}` : "";
  const dev = p.device?.model || "";
  return [browser, os, dev].filter(Boolean).join(" · ");
}

function viNow(d: Date = new Date()): string {
  return d.toLocaleString("vi-VN", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
}

async function sendNotify(subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [NOTIFY_EMAIL], subject, html }),
    });
  } catch {
    /* noop */
  }
}

function notifyFrame(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">
  <div style="background:#1e293b;color:#ffffff;padding:16px 22px;font-size:15px;font-weight:600">${esc(title)}</div>
  <div style="padding:20px 24px;font-size:14px;line-height:1.75">${bodyHtml}</div>
  <div style="padding:12px 24px;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;text-align:center">Legaleader · Quản lý nhà trọ</div>
</div></body></html>`;
}

export async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const hs = await headers();
  const ip = hs.get("x-forwarded-for")?.split(",")[0]?.trim() || hs.get("x-real-ip") || "unknown";

  const now = Date.now();
  const winMs = 15 * 60 * 1000;
  const { data: rec } = await sb.from("nhatro_login_attempts").select("*").eq("ip", ip).maybeSingle() as unknown as { data: { attempts?: number; window_start?: string; blocked_until?: string | null } | null };

  const blockedUntil = rec?.blocked_until ? new Date(rec.blocked_until).getTime() : 0;
  if (blockedUntil > now) {
    const mins = Math.ceil((blockedUntil - now) / 60000);
    return { ok: false, error: `Quá nhiều lần nhập sai. Thử lại sau ${mins} phút.` };
  }

  if (email && password) {
    const { data: user } = await sb.from("nhatro_users").select("*").eq("email", email.trim().toLowerCase()).maybeSingle();
    const ok = !!user && verifyPassword(password, (user as { password_hash: string }).password_hash);
    if (ok) {
      await sb.from("nhatro_login_attempts").delete().eq("ip", ip);
      const uid = (user as { id: number }).id;
      const tv = Number((user as { token_version?: number }).token_version ?? 0);
      const token = await signSession(uid, tv);
      const store = await cookies();
      store.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      const dev = describeDevice(hs.get("user-agent"));
      after(async () => {
        const loc = await ipLocation(ip);
        await sendNotify(
          "🔐 Đăng nhập mới · Quản lý nhà trọ",
          notifyFrame(
            "Cảnh báo bảo mật",
            `<p style="margin:0 0 10px">Có một phiên <strong>đăng nhập mới</strong> vào hệ thống quản lý nhà trọ:</p>
             <p style="margin:0 0 6px">👤 Người dùng: <strong>${esc((user as { email: string }).email)}</strong></p>
             <p style="margin:0 0 6px">⏰ Thời gian: <strong>${esc(viNow())}</strong></p>
             <p style="margin:0 0 6px">🌍 Địa chỉ IP: <strong>${esc(ip)}</strong>${loc ? ` (${esc(loc)})` : ""}</p>
             <p style="margin:0 0 6px">💻 Thiết bị: ${esc(dev)}</p>
             <p style="margin:12px 0 0;font-size:12px;color:#94a3b8">Nếu không phải bạn, hãy rà lại các tài khoản và liên hệ quản trị.</p>`
          )
        );
      });
      return { ok: true };
    }
  }

  const inWindow = rec && now - new Date(rec.window_start ?? now).getTime() < winMs;
  const attempts = (inWindow ? rec?.attempts ?? 0 : 0) + 1;
  const windowStart = new Date(inWindow ? rec!.window_start! : now);
  const blocked = attempts >= 5 ? new Date(now + winMs).toISOString() : null;
  await sb
    .from("nhatro_login_attempts")
    .upsert({ ip, attempts, window_start: windowStart.toISOString(), blocked_until: blocked }, { onConflict: "ip" });
  return { ok: false, error: "Email hoặc mật khẩu không đúng." };
}

export async function register(input: { name: string; email: string; password: string }): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Vui lòng nhập tên." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Email không hợp lệ." };
  if (input.password.length < 6) return { ok: false, error: "Mật khẩu phải có ít nhất 6 ký tự." };

  const { data: existing } = await sb.from("nhatro_users").select("id").eq("email", email).maybeSingle();
  if (existing) return { ok: false, error: "Email này đã được đăng ký." };

  // Chỉ user đầu tiên mới được claim các nhà chưa có chủ (dữ liệu hiện có)
  // Unique index nhatro_users_single_admin (partial) chốt đúng 1 admin nếu 2 người đăng ký cùng lúc
  const { data: userCount } = await sb.from("nhatro_users").select("id", { count: "exact", head: true });
  const isFirstUser = (userCount ?? 0) === 0;
  let isAdmin = isFirstUser;
  let firstHouseId: number | null = null;
  if (isFirstUser) {
    const { data: unowned } = await sb.from("nhatro_houses").select("id").is("owner_id", null).order("id");
    firstHouseId = ((unowned ?? [])[0] as { id?: number } | undefined)?.id ?? null;
  }

  const insertUser = (admin: boolean) =>
    sb
      .from("nhatro_users")
      .insert({
        name,
        email,
        password_hash: hashPassword(input.password),
        active_house_id: firstHouseId,
        is_admin: admin,
      })
      .select()
      .single();

  let inserted = await insertUser(isAdmin);
  if (inserted.error?.code === "23505" && isFirstUser) {
    // User khác vừa giành ngôi admin trước → đăng ký như tài khoản thường
    isAdmin = false;
    inserted = await insertUser(false);
  }
  const error = inserted.error;
  if (error) {
    console.error("register-fail:", error.message);
    return { ok: false, error: "Đăng ký thất bại. Thử lại." };
  }
  const uid = (inserted.data as { id: number }).id;

  if (isAdmin) {
    // Claim TOÀN BỘ nhà chưa có chủ (2 nhà trọ của bạn) cho user đầu tiên
    await sb.from("nhatro_houses").update({ owner_id: uid }).is("owner_id", null);
  }

  const token = await signSession(uid, 0);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logout() {
  // Thu hồi toàn bộ session (kể cả token bị đánh cắp) bằng cách tăng token_version.
  try {
    const sess = await sessionData();
    if (sess) {
      await sb.from("nhatro_users").update({ token_version: sess.tv + 1 }).eq("id", sess.id);
    }
  } catch {
    /* DB lỗi — vẫn xoá cookie */
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
}

export async function requestPasswordReset(): Promise<{ ok: boolean; error?: string }> {
  const hs = await headers();
  const ip = ipFromHeaders(hs);
  const now = Date.now();
  const { data: rec } = (await sb
    .from("nhatro_reset_requests")
    .select("last_at")
    .eq("ip", ip)
    .maybeSingle()) as unknown as { data: { last_at?: string } | null };
  const last = rec?.last_at ? new Date(rec.last_at).getTime() : 0;
  if (now - last < 10 * 60 * 1000) {
    const mins = Math.min(10, Math.ceil((10 * 60 * 1000 - (now - last)) / 60000));
    return { ok: false, error: `Yêu cầu đã gửi gần đây. Thử lại sau ${mins} phút.` };
  }
  await sb.from("nhatro_reset_requests").upsert({ ip, last_at: new Date(now).toISOString() });

  const dev = describeDevice(hs.get("user-agent"));
  const loc = await ipLocation(ip);
  await sendNotify(
    "🔑 Quên mật khẩu · Quản lý nhà trọ",
    notifyFrame(
      "Yêu cầu đặt lại mật khẩu",
      `<p style="margin:0 0 10px">Ai đó yêu cầu <strong>đặt lại mật khẩu</strong> trên hệ thống Quản lý nhà trọ:</p>
       <p style="margin:0 0 6px">⏰ Thời gian: <strong>${esc(viNow())}</strong></p>
       <p style="margin:0 0 6px">🌍 Địa chỉ IP: <strong>${esc(ip)}</strong>${loc ? ` (${esc(loc)})` : ""}</p>
       <p style="margin:0 0 10px">💻 Thiết bị: ${esc(dev)}</p>
       <p style="margin:0 0 8px">Nếu đúng là bạn, quản trị viên sẽ đặt lại mật khẩu tài khoản của bạn (vào Cài đặt → Tài khoản).</p>`
    )
  );
  return { ok: true };
}

let banksCache: Bank[] | null = null;

export async function getBanks(): Promise<Bank[]> {
  if (banksCache && banksCache.length) return banksCache;
  try {
    const r = await fetch("https://api.vietqr.io/v2/banks", {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "force-cache",
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      const j = (await r.json()) as { data?: { bin: string; shortName: string }[] };
      const list = (j.data || []).map((b) => ({ bin: b.bin, shortName: b.shortName }));
      if (list.length) {
        banksCache = list;
        return list;
      }
    }
  } catch {
    /* fallback */
  }
  banksCache = STATIC_BANKS;
  return STATIC_BANKS;
}

function formatKyNow(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

async function healMonthIntegrity(houseId: number, curKy: string | null): Promise<boolean> {
  const real = formatKyNow();
  const prev = prevKy(real);
  let changed = false;
  if (!curKy || curKy > real) {
    await sb.from("nhatro_houses").update({ cur_ky: real }).eq("id", houseId);
    changed = true;
  }
  if (!prev) return changed;
  const [{ data: pRows }, { data: cRows }] = await Promise.all([
    sb.from("nhatro_monthly").select("*").eq("house_id", houseId).eq("ky", prev),
    sb.from("nhatro_monthly").select("*").eq("house_id", houseId).eq("ky", real),
  ]);
  const pMap = new Map<string, MonthlyRow>();
  for (const r of (pRows ?? []) as MonthlyRow[]) pMap.set(r.room, r);
  const cMap = new Map<string, MonthlyRow>();
  for (const r of (cRows ?? []) as MonthlyRow[]) cMap.set(r.room, r);
  for (const p of (pRows ?? []) as MonthlyRow[]) {
    if (!p.move_in || p.move_in.slice(0, 7) !== prev) continue;
    const c = cMap.get(p.room);
    if (!c) continue;
    const cOld = c.old_index == null ? null : Number(c.old_index);
    const cNew = c.new_index == null ? null : Number(c.new_index);
    if (p.new_index != null || p.close_date != null) continue;
    if (cNew == null || cNew === 0 || cOld == null || !c.close_date) continue;
    const chot = String(cNew);
    changed = true;
    await Promise.all([
      sb.from("nhatro_monthly")
        .update({ old_index: String(cOld), new_index: chot, close_date: c.close_date, move_in: p.move_in })
        .eq("house_id", houseId).eq("ky", prev).eq("room", p.room),
      sb.from("nhatro_monthly")
        .update({ old_index: chot, old_date: c.close_date, new_index: null, close_date: null })
        .eq("house_id", houseId).eq("ky", real).eq("room", p.room),
    ]);
  }
  return changed;
}

// Danh sách nhà thuộc về user hiện tại
async function myHouseList(): Promise<House[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await sb.from("nhatro_houses").select("*").eq("owner_id", user.id).order("id");
  return (data ?? []) as House[];
}

// Lấy active_house của user hiện tại (isolation theo user)
async function myActive(): Promise<{ user: SessionUser; house: House }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Chưa đăng nhập.");
  const { data } = await sb.from("nhatro_houses").select("*").eq("id", user.active_house_id ?? 0).eq("owner_id", user.id).maybeSingle();
  if (!data) {
    // active_house không hợp lệ -> chọn nhà đầu tiên của user
    const list = await myHouseList();
    const fallback = list[0];
    if (!fallback) throw new Error("Chưa có nhà trọ.");
    if (fallback) {
      await sb.from("nhatro_users").update({ active_house_id: fallback.id }).eq("id", user.id);
    }
    return { user, house: fallback };
  }
  return { user, house: data as House };
}

export async function getActiveHouse(): Promise<House> {
  const { house } = await myActive();
  await healMonthIntegrity(house.id, house.cur_ky ?? null);
  return house;
}

async function ensureMonth(ky: string, houseId: number): Promise<void> {
  const [{ data: rooms }, { data: existing }, { data: prev }] = await Promise.all([
    sb.from("nhatro_rooms").select("*").eq("house_id", houseId).eq("active", true),
    sb.from("nhatro_monthly").select("room").eq("house_id", houseId).eq("ky", ky),
    sb.from("nhatro_monthly").select("*").eq("house_id", houseId).eq("ky", prevKy(ky)),
  ]);
  if (!rooms) return;
  const have = new Set((existing ?? []).map((r: { room: string }) => r.room));
  const prevMap = new Map<string, MonthlyRow>((prev ?? []).map((r) => [r.room, r as MonthlyRow]));
  const rows: Omit<MonthlyRow, "id">[] = [];
  for (const room of rooms as Room[]) {
    if (have.has(room.room)) continue;
    if (room.move_in && room.move_in.slice(0, 7) > ky) continue;
    const p = prevMap.get(room.room);
    const old_index = p ? (p.new_index ?? p.old_index) : null;
    const old_date = p ? (p.close_date ?? null) : null;
    rows.push({
      house_id: houseId,
      ky,
      room: room.room,
      tenant: room.tenant,
      phone: room.phone,
      occupancy: room.occupancy,
      old_index,
      old_date,
      new_index: null,
      close_date: null,
      move_in: room.move_in && room.move_in.slice(0, 7) === ky ? room.move_in : null,
      move_out: null,
      nights: 0,
      violations: 0,
      guest: 0,
      paid: 0,
    });
  }
  if (rows.length > 0) {
    await sb.from("nhatro_monthly").upsert(rows, { onConflict: "house_id,ky,room" });
  }
}

export async function saveMonth(ky: string, rows: MonthlyRow[]) {
  if (ky > formatKyNow()) return { ok: false, error: "Chưa đến thời điểm này." };
  const house = await getActiveHouse();
  const nk = nextKy(ky);
  const [{ data: roomList }, { data: existing }, { data: nextMonthRows }] = await Promise.all([
    sb.from("nhatro_rooms").select("room, occupancy, tenant, phone").eq("house_id", house.id),
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", ky),
    sb.from("nhatro_monthly").select("room, old_index, old_date").eq("house_id", house.id).eq("ky", nk),
  ]);
  const occMap = new Map<string, number>((roomList ?? []).map((r) => [r.room, Number(r.occupancy) || 0]));
  const tenantMap = new Map<string, string>((roomList ?? []).map((r) => [r.room, r.tenant]));
  const phoneMap = new Map<string, string>((roomList ?? []).map((r) => [r.room, r.phone]));
  const existMap = new Map<string, MonthlyRow>((existing ?? []).map((r: MonthlyRow) => [r.room, r]));
  const nextMap = new Map<string, { room: string; old_index: number | null; old_date: string | null }>(
    (nextMonthRows ?? []).map((r) => [r.room, r as { room: string; old_index: number | null; old_date: string | null }])
  );
  const upserts = rows.map((r) => {
    const ni: unknown = r.new_index;
    const ci: unknown = r.close_date;
    const mi: unknown = r.move_in;
    const mo: unknown = r.move_out;
    return {
      house_id: house.id,
      ky,
      room: r.room,
      tenant: tenantMap.get(r.room) ?? r.tenant,
      phone: phoneMap.get(r.room) ?? r.phone,
      occupancy: ky === house.cur_ky ? occMap.get(r.room) ?? (Number(r.occupancy) || 0) : Number(r.occupancy) || 0,
      old_index: r.old_index ?? null,
      old_date: r.old_date ?? null,
      new_index: ni == null || ni === "" ? null : Number(ni),
      close_date: ci == null || ci === "" ? null : ci,
      move_in: mi == null || mi === "" ? null : mi,
      move_out: mo == null || mo === "" ? null : mo,
      nights: Number(r.nights) || 0,
      violations: Number(r.violations) || 0,
      guest: Number(r.guest) ? 1 : 0,
    };
  });

  // paid được ghi RIÊNG bằng update có điều kiện (CAS) để không đè lên confirmPayment
  // đang chạy ở tab/thiết bị khác — tránh mất số tiền đã thu. Chỉ ghi nếu tab này thực sự sửa.
  for (const r of rows) {
    if (!Number.isFinite(Number(r.nights)) || Number(r.nights) < 0) return { ok: false, error: `Phòng ${r.room}: số đêm không thể âm.` };
    if (!Number.isFinite(Number(r.violations)) || Number(r.violations) < 0) return { ok: false, error: `Phòng ${r.room}: số vi phạm không thể âm.` };
    if (!Number.isFinite(Number(r.paid)) || Number(r.paid) < 0) return { ok: false, error: `Phòng ${r.room}: số tiền đã đóng không thể âm.` };
  }
  const paidIntents: { room: string; paid: number; old: number }[] = [];
  for (const r of rows) {
    const old = existMap.get(r.room);
    const oldPaid = old ? Number(old.paid) || 0 : 0;
    const wantPaid = Number(r.paid) || 0;
    if (wantPaid !== oldPaid) paidIntents.push({ room: r.room, paid: wantPaid, old: oldPaid });
  }

  const fieldsToTrack: (keyof MonthlyRow)[] = ["old_index", "old_date", "new_index", "close_date", "move_in", "move_out", "nights", "violations", "paid"];
  const auditEntries: { ky?: string; room: string; field: string; old_val: string; new_val: string }[] = [];
  for (const u of upserts) {
    const old = existMap.get(u.room);
    if (old) {
      for (const f of fieldsToTrack) {
        const ov = String((old as Record<string, unknown>)[f] ?? "");
        const nv = f === "paid"
          ? String(paidIntents.find((p) => p.room === u.room)?.paid ?? (Number(old.paid) || 0))
          : String((u as Record<string, unknown>)[f] ?? "");
        if (ov !== nv) auditEntries.push({ ky, room: u.room, field: f, old_val: ov, new_val: nv });
      }
    }
  }

  const { error } = await sb
    .from("nhatro_monthly")
    .upsert(upserts, { onConflict: "house_id,ky,room" });
  if (error) {
    console.error("saveMonth-upsert:", error.message);
    return { ok: false, error: "Lưu thất bại. Thử lại." };
  }
  for (const it of paidIntents) {
    const res = (await sb
      .from("nhatro_monthly")
      .update({ paid: it.paid })
      .eq("house_id", house.id)
      .eq("ky", ky)
      .eq("room", it.room)
      .eq("paid", it.old)
      .select("paid")) as { data: unknown[] | null; error: { message: string } | null };
    if (res.error) {
      console.error("saveMonth-paid:", res.error.message);
      return { ok: false, error: "Lưu thất bại. Thử lại." };
    }
    if (!res.data || res.data.length === 0) {
      return { ok: false, error: `Phòng ${it.room}: số tiền đã đóng vừa thay đổi ở chỗ khác. Tải lại trang để tránh ghi đè.` };
    }
  }
  for (const u of upserts) {
    if (u.new_index == null || u.close_date == null) continue;
    const next = nextMap.get(u.room);
    if (!next) continue;
    const oldNew = existMap.get(u.room)?.new_index ?? null;
    const seedIsAuto =
      next.old_index == null ||           // chưa có -> điền tự động
      next.old_index === oldNew ||        // seed cũ từ lần đóng trước -> cập nhật theo số mới
      next.old_index === u.new_index;     // đã đúng -> bỏ qua (không cập nhật lại)
    if (!seedIsAuto) continue;            // user đã sửa tay tháng sau -> không đè
    await sb
      .from("nhatro_monthly")
      .update({ old_index: u.new_index, old_date: u.close_date })
      .eq("house_id", house.id)
      .eq("ky", nk)
      .eq("room", u.room);
  }

  if (auditEntries.length > 0) await logAudit(house.id, auditEntries);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setCurrentMonth(ky: string) {
  if (ky > formatKyNow()) return { ok: false, error: "Chưa đến thời điểm này." };
  const house = await getActiveHouse();
  await ensureMonth(ky, house.id);
  await sb.from("nhatro_houses").update({ cur_ky: ky }).eq("id", house.id);
  revalidatePath("/", "layout");
  return { ok: true, ky };
}

const SETTINGS_WHITELIST = [
  "name",
  "address",
  "due_text",
  "transfer_note",
  "note",
  "elec_rate",
  "water_rate",
  "wifi_rate",
  "max_occupancy",
  "bank_code",
  "bank_account",
  "bank_name",
] as const;

export async function updateSettings(data: Partial<House> & Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const err = (msg: string) => ({ ok: false, error: msg });
  const update: Record<string, unknown> = {};
  for (const f of SETTINGS_WHITELIST) {
    if (f in data) update[f] = data[f];
  }
  for (const num of ["elec_rate", "water_rate", "wifi_rate"] as const) {
    if (!(num in update)) continue;
    const v = Number(update[num]);
    if (!Number.isFinite(v) || v < 0) return err("Giá điện/nước/wifi phải là số lớn hơn hoặc bằng 0.");
    update[num] = v;
  }
  if ("max_occupancy" in update) {
    const v = Number(update.max_occupancy);
    if (!Number.isInteger(v) || v < 1 || v > 20) return err("Số người tối đa phải là số nguyên từ 1 đến 20.");
    update.max_occupancy = v;
  }
  const house = await getActiveHouse();
  const { data: oldHouse } = await sb.from("nhatro_houses").select("bank_code,bank_account,bank_name").eq("id", house.id).single();
  const { error } = await sb.from("nhatro_houses").update(update).eq("id", house.id);
  if (error) {
    console.error("updateSettings:", error.message);
    return err("Lưu cài đặt thất bại. Thử lại.");
  }
  const auditEntries: { room?: string; field: string; old_val: string; new_val: string }[] = [];
  for (const f of ["bank_code", "bank_account", "bank_name"] as const) {
    const ov = String(oldHouse?.[f] ?? "");
    const nv = String((data as Record<string, unknown>)[f] ?? "");
    if (ov !== nv) auditEntries.push({ field: `settings.${f}`, old_val: ov, new_val: nv });
  }
  if (auditEntries.length > 0) await logAudit(house.id, auditEntries);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function upsertPrices(prices: { occupancy: number; price: number }[]): Promise<{ ok: boolean; error?: string }> {
  const house = await getActiveHouse();
  const seen = new Set<number>();
  for (const p of prices) {
    const occ = Number(p.occupancy);
    const price = Number(p.price);
    if (!Number.isInteger(occ) || occ < 1 || occ > 20) {
      return { ok: false, error: `Số người của bảng giá không hợp lệ (${String(p.occupancy)}).` };
    }
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: `Giá phòng ${occ} người phải là số lớn hơn hoặc bằng 0.` };
    }
    if (seen.has(occ)) {
      return { ok: false, error: `Giá phòng ${occ} người bị trùng trong danh sách gửi lên.` };
    }
    seen.add(occ);
  }
  const { data: oldPrices } = await sb.from("nhatro_prices").select("occupancy,price").eq("house_id", house.id);
  const oldMap = new Map((oldPrices ?? []).map((p: { occupancy: number; price: number }) => [p.occupancy, p.price]));
  const auditEntries: { room?: string; field: string; old_val: string; new_val: string }[] = [];
  for (const p of prices) {
    const occ = Number(p.occupancy);
    const price = Number(p.price);
    const ov = String(oldMap.get(occ) ?? "");
    const nv = String(price);
    if (ov !== nv) auditEntries.push({ room: `price_${occ}`, field: "price", old_val: ov, new_val: nv });
    const { error } = await sb
      .from("nhatro_prices")
      .upsert(
        { house_id: house.id, occupancy: occ, price },
        { onConflict: "house_id,occupancy" }
      );
    if (error) {
      console.error("upsertPrices:", error.message);
      return { ok: false, error: "Lưu bảng giá thất bại. Thử lại." };
    }
  }
  if (auditEntries.length > 0) await logAudit(house.id, auditEntries);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function getRoomInfo(room: string): Promise<{ ok: boolean; room?: Room; error?: string }> {
  const house = await getActiveHouse();
  const { data } = await sb
    .from("nhatro_rooms")
    .select("*")
    .eq("house_id", house.id)
    .eq("room", room)
    .single();
  if (!data) return { ok: false, error: `Không có thông tin phòng ${room}.` };
  const r = data as Room;
  let initial: number | null = null;
  if (r.move_in) {
    const { data: miRow } = await sb
      .from("nhatro_monthly")
      .select("old_index")
      .eq("house_id", house.id)
      .eq("ky", r.move_in.slice(0, 7))
      .eq("room", room)
      .maybeSingle();
    if (miRow && miRow.old_index != null) initial = Number(miRow.old_index);
  }
  return { ok: true, room: { ...r, initial_index: initial } };
}

export async function upsertRooms(rooms: Room[]) {
  const house = await getActiveHouse();
  const { data: existingRooms } = await sb.from("nhatro_rooms").select("*").eq("house_id", house.id);
  const existMap = new Map<string, Record<string, unknown>>((existingRooms ?? []).map((r: Record<string, unknown>) => [r.room as string, r]));
  for (const r of rooms) {
    if ((Number(r.occupancy) || 0) > 0 && !r.move_in) {
      return { ok: false, error: `Phòng ${r.room}: Ngày vào ở là bắt buộc khi có người ở.` };
    }
    if (r.move_in && r.contract_end && r.contract_end < r.move_in) {
      return { ok: false, error: `Phòng ${r.room}: Ngày kết thúc HĐ phải sau ngày vào ở.` };
    }
    const occ = Number(r.occupancy) || 0;
    if (!Number.isInteger(occ) || occ < 0 || occ > 20) {
      return { ok: false, error: `Phòng ${r.room}: số người phải là số nguyên từ 0 đến 20.` };
    }
    if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email).trim())) {
      return { ok: false, error: `Phòng ${r.room}: email không hợp lệ.` };
    }
    if (!Number.isFinite(Number(r.deposit)) || Number(r.deposit) < 0) {
      return { ok: false, error: `Phòng ${r.room}: tiền cọc không thể âm.` };
    }
    if (r.room_price != null && Number(r.room_price) !== 0 && (Number(r.room_price) < 0 || !Number.isFinite(Number(r.room_price)))) {
      return { ok: false, error: `Phòng ${r.room}: giá thuê riêng không hợp lệ.` };
    }
    const fFrom = r.exempt_from || null;
    const fUntil = r.exempt_until || null;
    if ((fFrom && !/^\d{4}-\d{2}$/.test(fFrom)) || (fUntil && !/^\d{4}-\d{2}$/.test(fUntil))) {
      return { ok: false, error: `Phòng ${r.room}: khoảng miễn phí phải đúng định dạng YYYY-MM.` };
    }
    const anyExempt = Boolean(r.exempt_elec) || Boolean(r.exempt_wifi) || Boolean(r.exempt_water) || Boolean(r.exempt_penalty);
    if (anyExempt && !fFrom && !fUntil) {
      return { ok: false, error: `Phòng ${r.room}: chọn miễn phí thì phải nhập khoảng tháng (từ → đến).` };
    }
    if (fFrom && fUntil && fFrom > fUntil) {
      return { ok: false, error: `Phòng ${r.room}: tháng bắt đầu miễn phí phải trước hoặc bằng tháng kết thúc.` };
    }
  }
  const { error: roomErr } = await sb.from("nhatro_rooms").upsert(
    rooms.map((r) => ({
      house_id: house.id,
      room: r.room,
      tenant: r.tenant,
      phone: r.phone,
      cccd: r.cccd ?? "",
      gender: r.gender ?? "",
      birth_year: r.birth_year ?? "",
      occupation: r.occupation ?? "",
      occupancy: Number(r.occupancy) || 0,
      move_in: r.move_in || null,
      contract_end: r.contract_end || null,
      tam_tru_date: r.tam_tru_date || null,
      email: r.email || null,
      deposit: Number(r.deposit) || 0,
      deposit_date: r.deposit_date || null,
      washing_machine: Boolean(r.washing_machine),
      active: r.active ?? true,
      exempt_elec: Boolean(r.exempt_elec),
      exempt_wifi: Boolean(r.exempt_wifi),
      exempt_water: Boolean(r.exempt_water),
      exempt_penalty: Boolean(r.exempt_penalty),
      exempt_from: r.exempt_from || null,
      exempt_until: r.exempt_until || null,
      room_price: r.room_price == null || Number(r.room_price) === 0 ? null : Number(r.room_price),
    })),
    { onConflict: "house_id,room" }
  );
  if (roomErr) {
    console.error("upsertRooms:", roomErr.message);
    return { ok: false, error: "Lưu phòng thất bại. Thử lại." };
  }

  const { data: monthRows } = await sb
    .from("nhatro_monthly")
    .select("ky,room,move_in,move_out,occupancy,tenant,phone,cccd,gender,birth_year,occupation,old_index,new_index,close_date,paid,nights,violations,guest")
    .eq("house_id", house.id);
  type MonthRef = { room: string; ky: string; move_in: string | null; move_out: string | null; occupancy: number; tenant: string; phone: string; cccd: string | null; gender: string | null; birth_year: string | null; occupation: string | null; old_index: number | null; new_index: number | null; close_date: string | null; paid: number; nights: number; violations: number; guest: number };
  const monthsByRoom = new Map<string, MonthRef[]>();
  for (const r of (monthRows ?? []) as MonthRef[]) {
    const arr = monthsByRoom.get(r.room) ?? [];
    arr.push(r);
    monthsByRoom.set(r.room, arr);
  }
  const roomAuditFields: { field: string; dbKey: string }[] = [
    { field: "tenant", dbKey: "tenant" },
    { field: "phone", dbKey: "phone" },
    { field: "cccd", dbKey: "cccd" },
    { field: "gender", dbKey: "gender" },
    { field: "birth_year", dbKey: "birth_year" },
    { field: "occupation", dbKey: "occupation" },
    { field: "occupancy", dbKey: "occupancy" },
    { field: "move_in", dbKey: "move_in" },
    { field: "contract_end", dbKey: "contract_end" },
    { field: "tam_tru_date", dbKey: "tam_tru_date" },
    { field: "deposit", dbKey: "deposit" },
    { field: "email", dbKey: "email" },
    { field: "exempt_elec", dbKey: "exempt_elec" },
    { field: "exempt_wifi", dbKey: "exempt_wifi" },
    { field: "exempt_water", dbKey: "exempt_water" },
    { field: "exempt_penalty", dbKey: "exempt_penalty" },
    { field: "exempt_from", dbKey: "exempt_from" },
    { field: "exempt_until", dbKey: "exempt_until" },
    { field: "room_price", dbKey: "room_price" },
  ];
  const auditEntries: { ky?: string; room: string; field: string; old_val: string; new_val: string }[] = [];
  for (const r of rooms) {
    const old = existMap.get(r.room);
    if (old) {
      for (const { field, dbKey } of roomAuditFields) {
        const ov = String(old[dbKey] ?? "");
        const nv = String((r as Record<string, unknown>)[field] ?? "");
        if (ov !== nv) auditEntries.push({ room: r.room, field, old_val: ov, new_val: nv });
      }
    }
    const newMoveIn = r.move_in || null;
    const newMoveOut = r.contract_end || null;
    const newTenant = r.tenant ?? "";
    const newPhone = r.phone ?? "";
    const newOcc = Number(r.occupancy) || 0;
    const newCccd = r.cccd ?? "";
    const newGender = r.gender ?? "";
    const newBirthYear = r.birth_year ?? "";
    const newOccupation = r.occupation ?? "";
    const changedKys: string[] = [];
    for (const m of monthsByRoom.get(r.room) ?? []) {
      const oldMoveIn = m.move_in ?? null;
      const oldMoveOut = m.move_out ?? null;
      if (
        oldMoveIn !== newMoveIn ||
        oldMoveOut !== newMoveOut ||
        m.tenant !== newTenant ||
        m.phone !== newPhone ||
        Number(m.occupancy) !== newOcc ||
        (m.cccd ?? "") !== newCccd ||
        (m.gender ?? "") !== newGender ||
        (m.birth_year ?? "") !== newBirthYear ||
        (m.occupation ?? "") !== newOccupation
      ) {
        changedKys.push(m.ky);
        if (oldMoveIn !== newMoveIn) auditEntries.push({ ky: m.ky, room: r.room, field: "move_in", old_val: oldMoveIn ?? "", new_val: newMoveIn ?? "" });
        if (oldMoveOut !== newMoveOut) auditEntries.push({ ky: m.ky, room: r.room, field: "move_out", old_val: oldMoveOut ?? "", new_val: newMoveOut ?? "" });
      }
    }
    if (changedKys.length > 0) {
      await sb
        .from("nhatro_monthly")
        .update({
          tenant: r.tenant,
          phone: r.phone,
          cccd: r.cccd ?? "",
          gender: r.gender ?? "",
          birth_year: r.birth_year ?? "",
          occupation: r.occupation ?? "",
          occupancy: newOcc,
        })
        .eq("house_id", house.id)
        .eq("room", r.room)
        .in("ky", changedKys);
    }
    if (newMoveIn) {
      await sb
        .from("nhatro_monthly")
        .update({ move_in: newMoveIn })
        .eq("house_id", house.id)
        .eq("room", r.room)
        .eq("ky", newMoveIn.slice(0, 7));
    }
    if (newMoveOut) {
      await sb
        .from("nhatro_monthly")
        .update({ move_out: newMoveOut })
        .eq("house_id", house.id)
        .eq("room", r.room)
        .eq("ky", newMoveOut.slice(0, 7));
    }
    if (newMoveIn) {
      const miKy = newMoveIn.slice(0, 7);
      const stale = (monthsByRoom.get(r.room) ?? []).filter(
        (m) =>
          m.ky < miKy &&
          !Number(m.paid) &&
          m.old_index == null &&
          m.new_index == null &&
          m.close_date == null &&
          m.move_out == null &&
          !Number(m.nights) &&
          !Number(m.violations) &&
          !Number(m.guest)
      );
      if (stale.length > 0) {
        await sb
          .from("nhatro_monthly")
          .delete()
          .eq("house_id", house.id)
          .eq("room", r.room)
          .in("ky", stale.map((m) => m.ky));
      }
    }
    const initial = r.initial_index == null ? null : Number(r.initial_index);
    const miKy = r.move_in ? r.move_in.slice(0, 7) : null;
    if (initial != null && miKy) {
      await sb
        .from("nhatro_monthly")
        .update({ old_index: initial, old_date: r.move_in })
        .eq("house_id", house.id)
        .eq("ky", miKy)
        .eq("room", r.room);
    }
  }
  if (auditEntries.length > 0) await logAudit(house.id, auditEntries);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteRoom(room: string): Promise<{ ok: boolean; error?: string }> {
  const house = await getActiveHouse();
  const { data: r } = await sb
    .from("nhatro_rooms")
    .select("*")
    .eq("house_id", house.id)
    .eq("room", room)
    .maybeSingle();
  if (!r) return { ok: true };
  if ((Number(r.occupancy) || 0) > 0) {
    return { ok: false, error: `Phòng ${room} đang có người ở (${r.occupancy} người), không xoá được.` };
  }
  const { data: paidRows } = await sb
    .from("nhatro_monthly")
    .select("ky")
    .eq("house_id", house.id)
    .eq("room", room)
    .neq("paid", 0);
  if ((paidRows ?? []).length > 0) {
    return { ok: false, error: `Phòng ${room} có lịch sử thanh toán, không xoá được qua giao diện (tránh mất dữ liệu tiền).` };
  }
  await sb.from("nhatro_contracts").delete().eq("house_id", house.id).eq("room", room);
  await sb.from("nhatro_monthly").delete().eq("house_id", house.id).eq("room", room);
  const { error } = await sb.from("nhatro_rooms").delete().eq("house_id", house.id).eq("room", room);
  if (error) {
    console.error("deleteRoom:", error.message);
    return { ok: false, error: "Xoá phòng thất bại. Thử lại." };
  }
  await logAudit(house.id, [{ room, field: "room_deleted", old_val: "1", new_val: "" }]);
  revalidatePath("/", "layout");
  return { ok: true };
}

const ALLOWED_CONTRACT_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_CONTRACT_SIZE = 4 * 1024 * 1024; // 4MB

export async function uploadContract(room: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const house = await getActiveHouse();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Chưa chọn file." };
  }
  if (!ALLOWED_CONTRACT_MIME.includes(file.type)) {
    return { ok: false, error: "Chỉ hỗ trợ PDF, Word (.doc/.docx), JPG, PNG, WEBP." };
  }
  if (file.size === 0 || file.size > MAX_CONTRACT_SIZE) {
    return { ok: false, error: "File phải từ 1 byte đến 4MB." };
  }
  const { data: roomRow } = await sb
    .from("nhatro_rooms")
    .select("room")
    .eq("house_id", house.id)
    .eq("room", room)
    .maybeSingle();
  if (!roomRow) {
    return { ok: false, error: `Không có phòng ${room}.` };
  }
  const { data: oldDoc } = await sb
    .from("nhatro_contracts")
    .select("file_name")
    .eq("house_id", house.id)
    .eq("room", room)
    .maybeSingle();
  const bytes = Buffer.from(await file.arrayBuffer());
  const data = bytes.toString("base64");
  const { error } = await sb.from("nhatro_contracts").upsert(
    { house_id: house.id, room, file_name: file.name, mime: file.type, size: file.size, data },
    { onConflict: "house_id,room" }
  );
  if (error) {
    console.error("uploadContract:", error.message);
    return { ok: false, error: "Tải hợp đồng thất bại. Thử lại." };
  }
  await logAudit(house.id, [{ room, field: "contract", old_val: oldDoc?.file_name ?? "", new_val: file.name }]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function getContractFile(
  room: string
): Promise<{ ok: boolean; file_name?: string; mime?: string; base64?: string; error?: string }> {
  const house = await getActiveHouse();
  try {
    const { data, error } = await sb
      .from("nhatro_contracts")
      .select("file_name, mime, data")
      .eq("house_id", house.id)
      .eq("room", room)
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Không có hợp đồng." };
    return { ok: true, file_name: data.file_name, mime: data.mime, base64: data.data };
  } catch (err) {
    console.error("getContractFile:", (err as Error)?.message ?? err);
    return { ok: false, error: "Lỗi khi lấy hợp đồng. Thử lại." };
  }
}

export async function deleteContract(room: string): Promise<{ ok: boolean; error?: string }> {
  const house = await getActiveHouse();
  const { data: oldDoc } = await sb
    .from("nhatro_contracts")
    .select("file_name")
    .eq("house_id", house.id)
    .eq("room", room)
    .maybeSingle();
  if (oldDoc) {
    const { error } = await sb.from("nhatro_contracts").delete().eq("house_id", house.id).eq("room", room);
    if (error) {
      console.error("deleteContract:", error.message);
      return { ok: false, error: "Xoá hợp đồng thất bại. Thử lại." };
    }
    await logAudit(house.id, [{ room, field: "contract", old_val: oldDoc.file_name, new_val: "" }]);
    revalidatePath("/", "layout");
    return { ok: true };
  }
  return { ok: true };
}

export async function getContractMeta(room: string): Promise<ContractMeta | null> {
  const house = await getActiveHouse();
  const { data } = await sb
    .from("nhatro_contracts")
    .select("file_name, mime, size")
    .eq("house_id", house.id)
    .eq("room", room)
    .maybeSingle();
  if (!data) return null;
  return { file_name: data.file_name as string, mime: data.mime as string, size: Number(data.size) };
}

export async function getAllContractMetas(): Promise<Record<string, ContractMeta>> {
  const house = await getActiveHouse();
  const { data } = await sb.from("nhatro_contracts").select("room, file_name, mime, size").eq("house_id", house.id);
  const map: Record<string, ContractMeta> = {};
  for (const r of data ?? []) {
    map[r.room as string] = { file_name: r.file_name as string, mime: r.mime as string, size: Number(r.size) };
  }
  return map;
}

export async function dataForKy(ky: string) {
  const prev = prevKy(ky);
  let house: House | null = null;
  try {
    house = (await myActive()).house;
  } catch {
    return {
      house: null as unknown as House,
      rows: [] as MonthlyRow[],
      prices: [],
      minKy: null as string | null,
      prevRows: [] as MonthlyRow[],
    };
  }
  const realNow = formatKyNow();
  const needHeal = !!house && (ky === realNow || ky === prevKy(realNow));
  const healP = needHeal ? healMonthIntegrity(house.id, house.cur_ky ?? null) : Promise.resolve(false);
  const [
    { data: rooms },
    { data: prices },
    { data: rows },
    { data: prevRows },
    healed,
  ] = await Promise.all([
    sb.from("nhatro_rooms").select("*").eq("house_id", house.id).eq("active", true).order("room"),
    sb.from("nhatro_prices").select("*").eq("house_id", house.id).order("occupancy"),
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", ky).order("room"),
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", prev),
    healP,
  ]);
  if (!house)
    return {
      house: null as unknown as House,
      rows: [] as MonthlyRow[],
      prices: [],
      minKy: null as string | null,
      prevRows: [] as MonthlyRow[],
    };
  const houseRooms = (rooms ?? []) as Room[];
  const housePrices = (prices ?? []) as { occupancy: number; price: number }[];
  let houseRows = (rows ?? []) as MonthlyRow[];
  let housePrevRows = (prevRows ?? []) as MonthlyRow[];
  // Nếu heal vừa tự sửa dữ liệu (hiếm) → đọc lại 2 tháng bị ảnh hưởng cho chính xác
  if (healed) {
    const [{ data: r2 }, { data: p2 }] = await Promise.all([
      sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", ky).order("room"),
      sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", prev).order("room"),
    ]);
    if (r2) houseRows = r2 as MonthlyRow[];
    if (p2) housePrevRows = p2 as MonthlyRow[];
  }
  const have = new Set(houseRows.map((r) => r.room));
  const prevMap = new Map<string, MonthlyRow>(
    (housePrevRows ?? []).filter((r: MonthlyRow) => r.house_id === house.id).map((r) => [r.room, r])
  );
  const minKy = houseRooms
    .map((r) => (r.move_in ? r.move_in.slice(0, 7) : null))
    .filter((x): x is string => !!x)
    .sort()[0] ?? null;
  const missing = houseRooms.filter(
    (r) => !have.has(r.room) && (!r.move_in || r.move_in.slice(0, 7) <= ky)
  );
  if (missing.length > 0 && ky <= realNow) {
    const inserts = missing.map((room) => {
      const p = prevMap.get(room.room);
const old_index = p ? (p.new_index ?? p.old_index) : null;
      return {
        house_id: house.id,
        ky,
        room: room.room,
        tenant: room.tenant,
        phone: room.phone,
        occupancy: Number(room.occupancy) || 0,
        old_index,
        old_date: p ? (p.close_date ?? null) : null,
        new_index: null,
        close_date: null,
        move_in: room.move_in && room.move_in.slice(0, 7) === ky ? room.move_in : null,
        move_out: null,
        nights: 0,
        violations: 0,
        guest: 0,
        paid: 0,
      };
    });
    await sb.from("nhatro_monthly").upsert(inserts, { onConflict: "house_id,ky,room" });
    houseRows = [...houseRows, ...(inserts as MonthlyRow[])];
  }
  const isCur = house.cur_ky === ky;
  const synced = applyRoomSync(houseRows, houseRooms, { historical: !isCur });
  synced.sort((a, b) => a.room.localeCompare(b.room, "en", { numeric: true }));
  const prevSynced = applyRoomSync(
    (housePrevRows ?? []).filter((r: MonthlyRow) => r.house_id === house.id),
    houseRooms,
    { historical: prevKy(ky) !== house.cur_ky }
  );
  return {
    house,
    rows: synced as MonthlyRow[],
    prices: housePrices as { occupancy: number; price: number }[],
    minKy,
    prevRows: prevSynced as MonthlyRow[],
  };
}

export async function listMonths() {
  let house: House | null = null;
  try {
    house = (await myActive()).house;
  } catch {
    return [];
  }
  if (!house) return [];
  const [{ data: prices }, { data: rooms }, { data: all }] = await Promise.all([
    sb.from("nhatro_prices").select("*").eq("house_id", house.id).order("occupancy"),
    sb.from("nhatro_rooms").select("*").eq("house_id", house.id).eq("active", true),
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id),
  ]);
  const houseRooms = (rooms ?? []).filter((r: Room) => r.house_id === house.id);
  const priceMap = pricesToMap((prices ?? []).filter((p) => p.house_id === house.id));
  const byKy = new Map<string, MonthlyRow[]>();
  for (const r of ((all ?? []) as MonthlyRow[]).filter((r) => r.house_id === house.id)) {
    const arr = byKy.get(r.ky) ?? [];
    arr.push(r);
    byKy.set(r.ky, arr);
  }
  const out: { ky: string; total: number; paid: number; count: number }[] = [];
  for (const k of [...byKy.keys()].sort()) {
    if (house.cur_ky && k > house.cur_ky) continue;
    const rows = byKy.get(k)!;
    const prevK = byKy.get(prevKy(k)) ?? [];
    const computed = computeRows(
      house,
      priceMap,
      applyRoomSync(rows, houseRooms, { historical: k !== house.cur_ky }),
      applyRoomSync(prevK, houseRooms, { historical: prevKy(k) !== house.cur_ky })
    );
    out.push({
      ky: k,
      total: computed.reduce((a, c) => a + c.total, 0),
      paid: computed.reduce((a, c) => a + c.paid, 0),
      count: computed.filter((c) => c.total > 0).length,
    });
  }
  out.sort((a, b) => b.ky.localeCompare(a.ky));
  return out;
}

export async function listHouses() {
  const user = await getCurrentUser();
  if (!user) return { active: 0, houses: [] as House[] };
  const houses = await myHouseList();
  return { active: user.active_house_id ?? 0, houses };
}

export async function bangTinhKy() {
  const house = await getActiveHouse();
  return house.cur_ky;
}

export async function dashboardData() {
  const user = await getCurrentUser();
  const houseList = user ? await myHouseList() : ([] as House[]);
  for (const h of houseList) {
    if (h.id != null) await healMonthIntegrity(h.id, h.cur_ky ?? null);
  }
  if (houseList.length === 0) return { active: 0, houses: [], totalCumRevenue: 0, totalCumPaid: 0 };
  const ids = houseList.map((h) => h.id);
  const [{ data: prices }, { data: rooms }, { data: monthly }] = await Promise.all([
    sb.from("nhatro_prices").select("*").in("house_id", ids).order("occupancy"),
    sb.from("nhatro_rooms").select("*").eq("active", true).in("house_id", ids),
    sb.from("nhatro_monthly").select("*").in("house_id", ids),
  ]);
  const priceMapByHouse = new Map<number, Record<number, number>>();
  for (const p of (prices ?? []) as { house_id: number; occupancy: number; price: number }[]) {
    if (!priceMapByHouse.has(p.house_id)) priceMapByHouse.set(p.house_id, {});
    priceMapByHouse.get(p.house_id)![p.occupancy] = Number(p.price);
  }
  const roomsByHouse = new Map<number, number>();
  for (const r of (rooms ?? []) as { house_id: number; occupancy: number }[]) {
    roomsByHouse.set(r.house_id, (roomsByHouse.get(r.house_id) ?? 0) + (Number(r.occupancy) || 0));
  }
  const byHouseKy = new Map<string, MonthlyRow[]>();
  for (const r of (monthly ?? []) as MonthlyRow[]) {
    const key = `${r.house_id}|${r.ky}`;
    const arr = byHouseKy.get(key) ?? [];
    arr.push(r);
    byHouseKy.set(key, arr);
  }
  const roomsByHouseFull = new Map<number, number>();
  const occupiedByHouse = new Map<number, number>();
  for (const r of (rooms ?? []) as Room[]) {
    const hId = r.house_id ?? 0;
    roomsByHouseFull.set(hId, (roomsByHouseFull.get(hId) ?? 0) + 1);
    if (Number(r.occupancy) > 0) occupiedByHouse.set(hId, (occupiedByHouse.get(hId) ?? 0) + 1);
  }
  const out = houseList.map((h) => {
    const houseRooms = (rooms ?? []).filter((r: Room) => r.house_id === h.id);
    const curKy = h.cur_ky;
    const curRows = curKy ? byHouseKy.get(`${h.id}|${curKy}`) ?? [] : [];
    const prevRowsH = curKy ? byHouseKy.get(`${h.id}|${prevKy(curKy)}`) ?? [] : [];
    const computed = computeRows(
      h,
      priceMapByHouse.get(h.id) ?? {},
      applyRoomSync(curRows, houseRooms),
      applyRoomSync(prevRowsH, houseRooms, { historical: true })
    );
    const revenue = computed.reduce((a, c) => a + c.total, 0);
    const paid = computed.reduce((a, c) => a + c.paid, 0);
    const allKy = new Set<string>();
    for (const r of (monthly ?? []) as MonthlyRow[]) if (r.house_id === h.id) allKy.add(r.ky);
    let cumRevenue = 0;
    let cumPaid = 0;
    for (const k of allKy) {
      if (k > h.cur_ky) continue;
      const kr = byHouseKy.get(`${h.id}|${k}`) ?? [];
      const prevK = byHouseKy.get(`${h.id}|${prevKy(k)}`) ?? [];
      const kc = computeRows(
        h,
        priceMapByHouse.get(h.id) ?? {},
        applyRoomSync(kr, houseRooms, { historical: k !== h.cur_ky }),
        applyRoomSync(prevK, houseRooms, { historical: prevKy(k) !== h.cur_ky })
      );
      cumRevenue += kc.reduce((a, c) => a + c.total, 0);
      cumPaid += kc.reduce((a, c) => a + c.paid, 0);
    }
    return {
      id: h.id,
      name: h.name,
      address: h.address,
      cur_ky: h.cur_ky,
      revenue,
      paid,
      cumRevenue,
      cumPaid,
      people: roomsByHouse.get(h.id) ?? 0,
      roomCount: roomsByHouseFull.get(h.id) ?? 0,
      occupied: occupiedByHouse.get(h.id) ?? 0,
    };
  });
  out.sort((a, b) => b.revenue - a.revenue);
  const totalCumRevenue = out.reduce((a, h) => a + h.cumRevenue, 0);
  const totalCumPaid = out.reduce((a, h) => a + h.cumPaid, 0);
  return { active: user?.active_house_id ?? 0, houses: out, totalCumRevenue, totalCumPaid };
}

export async function activateHouse(id: number) {
  const user = await getCurrentUser();
  if (!user) return;
  // Chi nhà thuộc user mới được kích hoạt
  const { data } = await sb.from("nhatro_houses").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (data) await sb.from("nhatro_users").update({ active_house_id: id }).eq("id", user.id);
}

export async function settingsData() {
  const user = await getCurrentUser();
  const hid: number | null = user?.active_house_id ?? null;
  const empty = {
    house: null as House | null,
    prices: [] as { occupancy: number; price: number }[],
    rooms: [] as Room[],
    contracts: {} as Record<string, ContractMeta>,
    me: user
      ? { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }
      : null,
    users: [] as UserAccount[],
  };
  // Kiểm tra quyền sở hữu TRƯỚC khi đọc dữ liệu của nhà — nếu không thuộc về user thì không trả gì.
  if (hid == null || !user) return empty;
  const { data: house } = await sb.from("nhatro_houses").select("*").eq("id", hid).eq("owner_id", user.id).maybeSingle();
  if (!house) return empty;
  const [{ data: prices }, { data: rooms }, { data: contracts }] = await Promise.all([
    sb.from("nhatro_prices").select("*").eq("house_id", hid).order("occupancy"),
    sb.from("nhatro_rooms").select("*").eq("house_id", hid).order("room"),
    sb.from("nhatro_contracts").select("room, file_name, mime, size").eq("house_id", hid),
  ]);
  const users = user?.is_admin ? await listUsers() : [];
  const contractMap: Record<string, ContractMeta> = {};
  for (const r of contracts ?? []) {
    contractMap[r.room as string] = { file_name: r.file_name as string, mime: r.mime as string, size: Number(r.size) };
  }
  return {
    house: house as House,
    prices: (prices ?? []) as { occupancy: number; price: number }[],
    rooms: (rooms ?? []) as Room[],
    contracts: contractMap,
    me: user
      ? { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }
      : null,
    users,
  };
}

export async function setActiveHouse(formData: FormData) {
  const id = Number(formData.get("id"));
  const user = await getCurrentUser();
  if (user) {
    const { data } = await sb.from("nhatro_houses").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (data) await sb.from("nhatro_users").update({ active_house_id: id }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
  redirect("/bang-tinh");
}

export async function createHouse(prev: { ok: boolean; error?: string } | null, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Vui lòng nhập tên nhà trọ." };
  const address = String(formData.get("address") ?? "").trim();
  const curKy = formatKyNow();
  const { data, error } = await sb
    .from("nhatro_houses")
    .insert({ name, address: address || null, cur_ky: curKy, owner_id: user.id })
    .select()
    .single();
  if (error || !data) {
    console.error("createHouse:", error?.message);
    return { ok: false, error: "Không tạo được nhà trọ. Thử lại." };
  }
  const { error: priceErr } = await sb.from("nhatro_prices").insert([
    { house_id: data.id, occupancy: 1, price: 2500000 },
    { house_id: data.id, occupancy: 2, price: 3000000 },
  ]);
  if (priceErr) {
    await sb.from("nhatro_houses").delete().eq("id", data.id);
    console.error("createHouse-prices:", priceErr.message);
    return { ok: false, error: "Không tạo được nhà trọ. Thử lại." };
  }
  await sb.from("nhatro_users").update({ active_house_id: data.id }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect(`/nha/${data.id}`);
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function appBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (envUrl) return envUrl;
  const host = (await headers()).get("host");
  if (host) return /^localhost(:\d+)?$/.test(host) ? `http://${host}` : `https://${host}`;
  return "https://nhatro-ten.vercel.app";
}

function buildPhieuHtml(house: House, c: ComputedRow, ky: string, baseUrl: string): string {
  const pDateStr = fmtDateVi(c.prevCloseDate);
  const oDateStr =
    c.prevMoveIn && c.prevMoveIn.slice(0, 7) === prevKy(ky) ? fmtDateVi(c.prevMoveIn) : null;
  const pl = ` (tháng ${displayKy(prevKy(ky))})`;
  const exParts = c.exempted ?? [];
  const exNote = (p: "water" | "wifi" | "elec" | "penalty") =>
    exParts.includes(p) ? `🎁 Được miễn phí (ưu đãi)` : "";
  const items: [string, number, string][] = [
    ["Tiền phòng", c.rent, c.rentNote || (c.occupancy > 0 ? `(${c.occupancy} người)` : "")],
    ["Tiền nước" + pl, c.water, [utilNote(c.prevOcc, c.prevUtilNote, ky, Boolean(c.washing_machine), c.prevUtilGuest), exNote("water")].filter(Boolean).join(" · ")],
    ["Wifi + Rác" + pl, c.wifi, [utilNote(c.prevOcc, c.prevUtilNote, ky, undefined, c.prevUtilGuest), exNote("wifi")].filter(Boolean).join(" · ")],
    ["Tiền điện" + pl, c.elec, [c.prevKwh > 0 ? (oDateStr && pDateStr
      ? `Số cũ: ${c.prevOldIndex.toLocaleString("vi-VN")} (${oDateStr}) → Số mới: ${c.prevNewIndex.toLocaleString("vi-VN")} (${pDateStr}) = ${c.prevKwh.toLocaleString("vi-VN")} kWh`
      : `Số cũ: ${c.prevOldIndex.toLocaleString("vi-VN")} → Số mới: ${c.prevNewIndex.toLocaleString("vi-VN")} = ${c.prevKwh.toLocaleString("vi-VN")} kWh${pDateStr ? ` (chốt ngày ${pDateStr})` : ""}`
    ) : "", exNote("elec")].filter(Boolean).join(" · ")],
    [
      "Phụ phí" + pl,
      c.penalty,
      [c.penalty > 0 ? `(khách đêm: ${c.prevNights}, vi phạm: ${c.prevViolations})` : "", exNote("penalty")].filter(Boolean).join(" · "),
    ],
  ];
  const rows = items
    .map(
      ([label, val, note]) => {
        const isElec = label.startsWith("Tiền điện");
        const noteStyle = isElec
          ? "display:block;margin-top:2px;padding-left:4px;font-size:12px;color:#64748b"
          : "color:#94a3b8";
        return `<tr><td style="border:1px solid #e2e8f0;padding:8px 12px;">${esc(label)} ${note ? `<span style="${noteStyle}">${esc(note)}</span>` : ""}</td><td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:right;white-space:nowrap">${fmt(val)}</td></tr>`;
      }
    )
    .join("");
  const qrUrl =
    house.bank_code && house.bank_account
      ? baseUrl + vietQrLocalUrl({
          bankCode: house.bank_code,
          accountNumber: house.bank_account,
          amount: c.remain,
          reference: `P${c.room} ${displayKy(ky)}`,
        })
      : "";
  const info = [
    ["Phòng", c.room],
    ["Người thuê", c.tenant || "—"],
    ["SĐT", c.phone || "—"],
    ["Số người", String(c.occupancy)],
  ]
    .map(
      ([l, v]) =>
        `<tr><td style="padding:3px 12px 3px 0;color:#64748b;white-space:nowrap;width:1%">${l}</td><td style="padding:3px 0;font-weight:600">${esc(String(v))}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;padding:16px;background:#f1f5f9">
  <div style="max-width:520px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;box-sizing:border-box">
    <h1 style="text-align:center;color:#1e3a8a;font-size:22px;margin:0">PHIẾU THU TIỀN TRỌ</h1>
    <p style="text-align:center;margin:4px 0">Tháng ${esc(displayKy(ky))}</p>
    <p style="text-align:center;color:#64748b;font-size:14px;margin:4px 0 0">Địa chỉ: ${esc(house.address)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">${info}</table>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
      <tr style="background:#ffedd5;font-weight:700"><td style="border:1px solid #e2e8f0;padding:8px 12px">TỔNG CỘNG</td><td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:right;white-space:nowrap">${fmt(c.total)}</td></tr>
      <tr><td style="border:1px solid #e2e8f0;padding:8px 12px">Đã đóng</td><td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:right;white-space:nowrap">${fmt(c.paid)}</td></tr>
      <tr><td style="border:1px solid #e2e8f0;padding:8px 12px">Còn lại</td><td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:right;white-space:nowrap;font-weight:600">${fmt(c.remain)}</td></tr>
    </table>
    ${exParts.length > 0 ? `<p style="font-size:12px;color:#15803d;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 10px;margin:10px 0 4px">🎁 Ưu đãi: ${exParts.map((p) => exemptLabel(p)).join(", ")} được miễn phí${c.exempt_from ? ` từ tháng ${displayKy(c.exempt_from)}` : ""}${c.exempt_until ? ` đến tháng ${displayKy(c.exempt_until)}` : ""}</p>` : ""}
    <p style="font-size:13px;margin:12px 0 4px">Hạn thanh toán: ${esc(house.due_text)}</p>
    <p style="font-size:13px;margin:4px 0">Chuyển khoản: ${esc(house.transfer_note)}</p>
    <div style="text-align:center;margin:8px 0">${qrUrl ? `<img src="${esc(qrUrl)}" alt="QR chuyển khoản" width="180" style="width:180px;max-width:180px;height:auto;border:1px solid #e2e8f0;border-radius:8px">` : `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:10px;color:#9a3412;font-size:13px">⚠ Chưa cấu hình số tài khoản ngân hàng trong Cài đặt. QR chưa hiển thị được số tiền cần chuyển.</div>`}</div>
    <p style="text-align:center;font-size:12px;color:#94a3b8;margin:2px 0 0">Nội dung: P${esc(c.room)} ${esc(displayKy(ky))}</p>
    <p style="text-align:center;font-style:italic;font-size:13px;color:#475569;margin:12px 0 0">Cảm ơn bạn đã thanh toán đúng hạn!</p>
  </div></body></html>`;
}

function buildConfirmHtml(
  house: House,
  c: ComputedRow,
  ky: string,
  receive: number,
  newPaid: number,
  newRemain: number,
  hadPrior: boolean
): string {
  const paid = c.paid;
  const due = newRemain > 0;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;padding:16px;background:#f1f5f9">
  <div style="max-width:520px;width:100%;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-sizing:border-box">
    <div style="background:linear-gradient(135deg,#16a34a,#059669);color:#ffffff;text-align:center;padding:24px 20px">
      <p style="font-size:13px;letter-spacing:1px;margin:0 0 6px;opacity:.85">BIÊN LAI THU TIỀN TRỌ</p>
      <p style="font-size:22px;font-weight:700;margin:0;letter-spacing:.5px">XÁC NHẬN THANH TOÁN</p>
      <p style="font-size:13px;margin:8px 0 0;opacity:.95">${house.name ? `${esc(house.name)} · ` : ""}${esc(displayKy(ky))}</p>
    </div>
    <div style="padding:20px 24px">
      <p style="font-size:14px;color:#334155;margin:0 0 4px">Kính gửi <strong>${esc(c.tenant || "Quý khách")}</strong><span style="color:#94a3b8"> · Phòng ${esc(c.room)}</span></p>
      <p style="font-size:13px;color:#64748b;margin:0 0 16px">${hadPrior ? "Chúng tôi đã nhận thêm một khoản thanh toán. Chi tiết hóa đơn của bạn:" : "Chúng tôi đã nhận thanh toán từ bạn. Chi tiết hóa đơn:"}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 4px">
        <tr><td style="padding:6px 0;color:#64748b">Tổng tiền phải đóng</td><td style="padding:6px 0;text-align:right;font-weight:600">${fmt(c.total)}</td></tr>
        <tr style="background:#f0fdf4"><td style="padding:7px 10px;border-radius:6px;color:#16a34a;font-weight:700">+ Số tiền nhận lần này</td><td style="padding:7px 10px;border-radius:6px;text-align:right;font-weight:700;color:#16a34a">${fmt(receive)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Đã đóng trước đó</td><td style="padding:6px 0;text-align:right">${fmt(paid)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Tổng đã đóng</td><td style="padding:6px 0;text-align:right;font-weight:700">${fmt(newPaid)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Còn thiếu</td><td style="padding:6px 0;text-align:right;font-weight:800;color:${due ? "#dc2626" : "#16a34a"};font-size:16px">${fmt(newRemain)}</td></tr>
      </table>
      <p style="font-size:12px;color:#94a3b8;margin:2px 0 16px;text-align:right">${due ? `Số còn thiếu sau lần nhận này: ${fmt(newRemain)}` : "Đã thanh toán đầy đủ."}</p>

      <div style="${due ? "background:#fff7ed;border:1px solid #fdba74" : "background:#ecfdf5;border:1px solid #6ee7b7"};border-radius:10px;padding:12px 14px;font-size:14px;text-align:center">
        ${due
          ? `<span style="font-weight:700;color:#9a3412">⚠ Bạn còn thiếu <span style="font-size:17px">${fmt(newRemain)}</span></span><br><span style="color:#9a3412;font-size:13px">Vui lòng thanh toán phần còn lại để hoàn tất tháng ${esc(displayKy(ky))}.</span>`
          : `<span style="font-weight:700;color:#065f46">✓ Hoàn tất! Đã nhận đủ tổng ${fmt(newPaid)} cho tháng ${esc(displayKy(ky))}.</span><br><span style="color:#065f46;font-size:13px">Cảm ơn bạn đã thanh toán đúng hạn.</span>`}
      </div>

      ${due
        ? `<div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px">
            <p style="font-size:12px;font-weight:700;letter-spacing:.5px;color:#64748b;margin:0 0 8px">CHUYỂN KHOẢN PHẦN CÒN THIẾU</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              ${house.bank_name ? `<tr><td style="padding:3px 0;color:#64748b">Chủ tài khoản</td><td style="padding:3px 0;text-align:right;font-weight:600">${esc(house.bank_name)}</td></tr>` : ""}
              ${house.bank_account ? `<tr><td style="padding:3px 0;color:#64748b">Số tài khoản</td><td style="padding:3px 0;text-align:right;font-weight:600">${esc(house.bank_account)}</td></tr>` : ""}
              ${house.bank_code ? `<tr><td style="padding:3px 0;color:#64748b">Ngân hàng</td><td style="padding:3px 0;text-align:right;font-weight:600">${esc(house.bank_code)}</td></tr>` : ""}
              <tr><td style="padding:3px 0;color:#64748b">Nội dung CK</td><td style="padding:3px 0;text-align:right;font-weight:700">P${esc(c.room)} ${esc(displayKy(ky))}</td></tr>
            </table>
          </div>`
        : ""}

      <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;text-align:center">${esc(house.address)}</p>
      <p style="font-size:13px;color:#475569;margin:6px 0 0;text-align:center">${house.bank_name ? `Trân trọng, <strong>${esc(house.bank_name)}</strong>` : "Trân trọng"}</p>
    </div>
  </div></body></html>`;
}

export async function sendPhieuEmail(ky: string, room: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    return { ok: false, error: "Chưa cấu hình gửi email (RESEND_API_KEY / MAIL_FROM)." };
  }
  const house = await getActiveHouse();
  const [{ data: row }, { data: prevRow }, { data: roomRow }, { data: prices }] = await Promise.all([
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", ky).eq("room", room).single(),
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", prevKy(ky)).eq("room", room).maybeSingle(),
    sb.from("nhatro_rooms").select("*").eq("house_id", house.id).eq("room", room).single(),
    sb.from("nhatro_prices").select("*").eq("house_id", house.id).order("occupancy"),
  ]);
  if (!row) return { ok: false, error: "Không có dữ liệu phiếu cho phòng này." };
  const to = (roomRow as Room | null)?.email?.trim();
  if (!to) return { ok: false, error: "Phòng chưa có email người thuê trong Cài đặt." };
  const synced = applyRoomSync([row as MonthlyRow], (roomRow ? [roomRow] : []) as Room[])[0] as MonthlyRow;
  const c = computeRow(house, pricesToMap(prices ?? []), synced, (prevRow ?? null) as MonthlyRow | null);
  const baseUrl = await appBaseUrl();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      cc: ["info@legaleader.com"],
      subject: `Phiếu thu tiền trọ ${displayKy(ky)} - Phòng ${c.room}`,
      html: buildPhieuHtml(house, c, ky, baseUrl),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    console.error("sendPhieuEmail:", res.status, (json as { message?: string }).message);
    return { ok: false, error: "Không gửi được email. Thử lại sau." };
  }
  return { ok: true };
}

export async function confirmPayment(ky: string, room: string, amount?: number) {
  const house = await getActiveHouse();
  const [{ data: row }, { data: prevRow }, { data: roomRow }, { data: prices }] = await Promise.all([
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", ky).eq("room", room).single(),
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", prevKy(ky)).eq("room", room).maybeSingle(),
    sb.from("nhatro_rooms").select("*").eq("house_id", house.id).eq("room", room).single(),
    sb.from("nhatro_prices").select("*").eq("house_id", house.id).order("occupancy"),
  ]);
  if (!row) return { ok: false, error: "Không tìm thấy dữ liệu." };

  const synced = applyRoomSync([row as MonthlyRow], (roomRow ? [roomRow] : []) as Room[])[0] as MonthlyRow;
  const c = computeRow(house, pricesToMap(prices ?? []), synced, (prevRow ?? null) as MonthlyRow | null);
  const receive0 = amount ?? c.remain;
  if (!Number.isFinite(receive0) || receive0 < 0) return { ok: false, error: "Số tiền nhận không hợp lệ." };
  const receive = Math.min(receive0, c.remain);
  if (c.remain <= 0) return { ok: false, error: "Không còn số tiền cần xác nhận." };
  if (receive <= 0) return { ok: false, error: "Số tiền nhận phải lớn hơn 0." };

  const oldPaid = Number(row.paid) || 0;
  const newPaid = oldPaid + receive;
  const newRemain = Math.max(0, c.total - newPaid);

  const res = (await sb
    .from("nhatro_monthly")
    .update({ paid: newPaid })
    .eq("id", row.id)
    .eq("paid", oldPaid)
    .select("paid")) as { data: unknown[] | null; error: { message: string } | null };
  if (res.error) {
    console.error("confirmPayment:", res.error.message);
    return { ok: false, error: "Xác nhận thất bại. Thử lại." };
  }
  if (!res.data || res.data.length === 0) {
    return { ok: false, error: "Phòng này vừa được xác nhận tiền ở nơi khác. Tải lại trang rồi thử lại." };
  }

  await logAudit(house.id, [{ ky, room, field: "paid", old_val: String(oldPaid), new_val: String(newPaid) }]);

  let emailSent = false;
  if (roomRow?.email) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;
    if (key && from) {
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [roomRow.email],
          cc: ["info@legaleader.com"],
          subject: `Xác nhận thanh toán tiền trọ Phòng ${room} - Tháng ${displayKy(ky)}`,
          html: buildConfirmHtml(house, c, ky, receive, newPaid, newRemain, oldPaid > 0),
        }),
      });
      emailSent = sent.ok;
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, paid: newPaid, remain: newRemain, emailSent };
}

export async function getAuditLogs(limit = 50, offset = 0, kyFilter?: string) {
  const l = Math.max(1, Math.min(200, Math.floor(Number(limit) || 50)));
  const o = Math.max(0, Math.floor(Number(offset) || 0));
  const house = await getActiveHouse();
  let query = sb
    .from("nhatro_audit_log")
    .select("*")
    .eq("house_id", house.id)
    .order("created_at", { ascending: false });
  if (kyFilter) query = query.eq("ky", kyFilter);
  let countQuery = sb
    .from("nhatro_audit_log")
    .select("*", { count: "exact", head: true })
    .eq("house_id", house.id);
  if (kyFilter) countQuery = countQuery.eq("ky", kyFilter);
  const [{ data }, { count }] = await Promise.all([
    query.range(o, o + l - 1),
    countQuery,
  ]);
  return { logs: data ?? [], total: count ?? 0 };
}

export type UserAccount = {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  created_at: string;
  houseCount: number;
};

export async function listUsers(): Promise<UserAccount[]> {
  const me = await getCurrentUser();
  if (!me?.is_admin) return [];
  const { data: users } = await sb.from("nhatro_users").select("*").order("id");
  if (!users) return [];
  const { data: houses } = await sb.from("nhatro_houses").select("owner_id");
  const countByOwner = new Map<number, number>();
  for (const h of (houses ?? []) as { owner_id: number | null }[]) {
    if (h.owner_id != null) countByOwner.set(h.owner_id, (countByOwner.get(h.owner_id) ?? 0) + 1);
  }
  return (users as { id: number; email: string; name: string; is_admin: boolean; created_at: string }[]).map(
    (u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      is_admin: Boolean(u.is_admin),
      created_at: u.created_at,
      houseCount: countByOwner.get(u.id) ?? 0,
    })
  );
}

export async function changeOwnPassword(current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (next.length < 6) return { ok: false, error: "Mật khẩu mới phải có ít nhất 6 ký tự." };
  const { data: rec } = await sb.from("nhatro_users").select("password_hash, token_version").eq("id", user.id).single();
  if (!rec || !verifyPassword(current, (rec as { password_hash: string }).password_hash)) {
    return { ok: false, error: "Mật khẩu hiện tại không đúng." };
  }
  const tv = Number((rec as { token_version?: number }).token_version ?? 0) + 1;
  await sb.from("nhatro_users").update({ password_hash: hashPassword(next), token_version: tv }).eq("id", user.id);
  // Giữ phiên hiện tại, thu hồi các thiết bị khác (token_version cũ)
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(user.id, tv), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}

export async function adminResetPassword(userId: number, next: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me?.is_admin) return { ok: false, error: "Không có quyền." };
  if (userId === me.id) return { ok: false, error: "Không thể tự đặt lại mật khẩu của mình ở đây — hãy dùng chức năng Đổi mật khẩu." };
  if (next.length < 6) return { ok: false, error: "Mật khẩu mới phải có ít nhất 6 ký tự." };
  const { data: rec } = await sb.from("nhatro_users").select("token_version").eq("id", userId).single();
  const tv = Number((rec as { token_version?: number }).token_version ?? 0) + 1;
  await sb.from("nhatro_users").update({ password_hash: hashPassword(next), token_version: tv }).eq("id", userId);
  if (me.active_house_id != null) {
    await logAudit(me.active_house_id, [{ room: String(userId), field: "admin_password_reset", old_val: "", new_val: me.email }]);
  }
  return { ok: true };
}