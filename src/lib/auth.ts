import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "nhatro_session";

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Thiếu SESSION_SECRET (tối thiểu 32 ký tự) trong .env.local");
  return new TextEncoder().encode(s);
}

export async function signSession(uid: number, tv = 0): Promise<string> {
  return new SignJWT({ sub: String(uid), tv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export type SessionData = { id: number; tv: number };

export async function verifySessionData(token?: string): Promise<SessionData | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const sub = payload.sub;
    if (!sub) return null;
    const id = Number(sub);
    if (!(Number.isInteger(id) && id > 0)) return null;
    return { id, tv: Number(payload.tv) || 0 };
  } catch {
    return null;
  }
}

export async function verifySession(token?: string): Promise<number | null> {
  const data = await verifySessionData(token);
  return data ? data.id : null;
}