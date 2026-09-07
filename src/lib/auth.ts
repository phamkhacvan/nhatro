import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "nhatro_session";

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Thiếu SESSION_SECRET trong .env.local");
  return new TextEncoder().encode(s);
}

export async function signSession(uid: number): Promise<string> {
  return new SignJWT({ sub: String(uid) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySession(token?: string): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const sub = payload.sub;
    if (!sub) return null;
    const id = Number(sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}