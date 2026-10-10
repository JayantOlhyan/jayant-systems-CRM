import crypto from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, DEFAULT_WORKSPACE_ID, hashPassword } from "@/db";
import { users, workspaces } from "@/db/schema";

export const SESSION_COOKIE_NAME = "jayant_crm_session";

function getSecret(): string {
  return process.env.CRM_SESSION_SECRET || "jayant-crm-private-workspace-secret-key-2026";
}

export interface SessionPayload {
  userId: string;
  workspaceId: string;
  email: string;
  fullName: string;
  exp: number;
}

export function signSessionToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionPayload | null> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const found = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail));

  if (found.length === 0) return null;
  const user = found[0];
  const computedHash = hashPassword(password);
  if (user.passwordHash !== computedHash) return null;

  return {
    userId: user.id,
    workspaceId: user.workspaceId || DEFAULT_WORKSPACE_ID,
    email: user.email,
    fullName: user.fullName,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14, // 14 days
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getWorkspaceContext() {
  const db = await getDb();
  const session = await getSession();
  const workspaceId = session?.workspaceId || DEFAULT_WORKSPACE_ID;

  const wsRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  return {
    session,
    workspaceId,
    workspace: wsRows[0] || {
      id: DEFAULT_WORKSPACE_ID,
      name: "Jayant Web & AI Systems",
      defaultCurrency: "INR",
      timezone: "Asia/Kolkata",
      dateFormat: "DD MMM YYYY",
      theme: "dark",
      defaultLandingPage: "/dashboard",
    },
  };
}
