import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { sb } from "@/lib/supabase";
import { verifySession, verifySessionData, SESSION_COOKIE } from "@/lib/auth";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  active_house_id: number | null;
  is_admin: boolean;
};

// Đọc uid từ session cookie
export async function sessionUid(): Promise<number | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

// Đọc uid + token_version từ session cookie (để so sánh khi đổi mật khẩu)
export async function sessionData(): Promise<{ id: number; tv: number } | null> {
  const store = await cookies();
  return verifySessionData(store.get(SESSION_COOKIE)?.value);
}

// Lấy user hiện tại từ DB (server-component / server-action)
// cache() giúp tránh query lặp nhiều lần trong cùng 1 request
// Session bị thu hồi nếu token_version đổi sau khi đổi mật khẩu
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const sess = await sessionData();
  if (!sess) return null;
  const { data } = await sb.from("nhatro_users").select("*").eq("id", sess.id).single();
  if (!data) return null;
  if (Number(data.token_version ?? 0) !== sess.tv) return null;
  return {
    id: data.id as number,
    email: data.email as string,
    name: (data.name as string) || "",
    active_house_id: data.active_house_id != null ? Number(data.active_house_id) : null,
    is_admin: Boolean(data.is_admin),
  };
});

// ---- Password hashing (scrypt) ----
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 64);
  const storedBuf = Buffer.from(hash, "hex");
  return candidate.length === storedBuf.length && timingSafeEqual(candidate, storedBuf);
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}