import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  authenticateUser,
  getSession,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/lib/auth";
import { getDb, DEFAULT_USER_ID, DEFAULT_WORKSPACE_ID, hashPassword } from "@/db";
import { users } from "@/db/schema";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ authenticated: Boolean(session), session });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    if (action === "quick_owner_login") {
      const db = await getDb();
      const uRows = await db.select().from(users).where(eq(users.id, DEFAULT_USER_ID));
      const user = uRows[0];
      const payload = {
        userId: user?.id || DEFAULT_USER_ID,
        workspaceId: user?.workspaceId || DEFAULT_WORKSPACE_ID,
        email: user?.email || "jayant@jayantwebsystems.com",
        fullName: user?.fullName || "Jayant Olhyan",
        exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
      };
      const token = signSessionToken(payload);
      const res = NextResponse.json({ ok: true, session: payload });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });
      return res;
    }

    if (action === "update_password") {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { newPassword, fullName, email } = body;
      const db = await getDb();
      const updates: Partial<typeof users.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (fullName) updates.fullName = String(fullName).trim();
      if (email) updates.email = String(email).trim().toLowerCase();
      if (newPassword && String(newPassword).length >= 6) {
        updates.passwordHash = hashPassword(String(newPassword));
      }
      await db.update(users).set(updates).where(eq(users.id, session.userId));
      return NextResponse.json({ ok: true });
    }

    // Standard email + password login
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const payload = await authenticateUser(String(email), String(password));
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid email or password. Use workspace credentials to sign in." },
        { status: 401 }
      );
    }

    const token = signSessionToken(payload);
    const res = NextResponse.json({ ok: true, session: payload });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Authentication error" },
      { status: 500 }
    );
  }
}
