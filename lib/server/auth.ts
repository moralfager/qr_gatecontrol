import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "./db";

export const SESSION_COOKIE = "gatecontrol_session";
export const ROLE_COOKIE = "userRole";

const SESSION_TTL_SECONDS = 60 * 60 * 12;

export interface CurrentUser {
  id: number;
  login: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  organization_id: number | null;
  organization_name: string | null;
  allowed_post_ids: number[];
}

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-session-secret-change-before-production";
}

function sign(data: string) {
  return crypto.createHmac("sha256", secret()).update(data).digest("hex");
}

function secureCookies() {
  return process.env.APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
}

export function hashPassword(password: string) {
  const iterations = 260000;
  const salt = crypto.randomBytes(16);
  const digest = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return ["pbkdf2_sha256", iterations, salt.toString("base64url"), digest.toString("base64url")].join("$");
}

export function verifyPassword(password: string, encoded: string) {
  const [algo, iterRaw, saltRaw, digestRaw] = encoded.split("$");
  if (algo !== "pbkdf2_sha256" || !iterRaw || !saltRaw || !digestRaw) return false;
  const digest = crypto.pbkdf2Sync(
    password,
    Buffer.from(saltRaw, "base64url"),
    Number(iterRaw),
    Buffer.from(digestRaw, "base64url").length,
    "sha256",
  );
  return crypto.timingSafeEqual(digest, Buffer.from(digestRaw, "base64url"));
}

export function makeSession(userId: number) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = crypto.randomBytes(16).toString("base64url");
  const payload = `${userId}:${expires}:${nonce}`;
  return `${payload}:${sign(payload)}`;
}

export function readSession(value?: string | null) {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 4) return null;
  const [idRaw, expiresRaw, nonce, signature] = parts;
  const payload = `${idRaw}:${expiresRaw}:${nonce}`;
  if (!crypto.timingSafeEqual(Buffer.from(sign(payload)), Buffer.from(signature))) return null;
  if (Number(expiresRaw) < Math.floor(Date.now() / 1000)) return null;
  return Number(idRaw);
}

export async function getCurrentUser(request: NextRequest): Promise<CurrentUser | null> {
  const userId = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const result = await query<CurrentUser>(
    `
    SELECT u.id, u.login, u.email, u.name, u.role, u.department, u.organization_id,
           o.name AS organization_name, u.allowed_post_ids
    FROM users u
    LEFT JOIN organizations o ON o.id = u.organization_id
    WHERE u.id = $1 AND u.active = true
    `,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function requireUser(request: NextRequest, roles?: string[]) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (roles && !roles.includes(user.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

export function setAuthCookies(response: NextResponse, user: CurrentUser | { id: number; role: string }) {
  response.cookies.set(SESSION_COOKIE, makeSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  response.cookies.set(ROLE_COOKIE, user.role, {
    httpOnly: false,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(ROLE_COOKIE, "", { path: "/", maxAge: 0 });
}
