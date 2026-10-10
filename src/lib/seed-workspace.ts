import { eq } from "drizzle-orm";
import { getDb, DEFAULT_WORKSPACE_ID } from "@/db";
import { organizations } from "@/db/schema";

/**
 * Workspace initialization check.
 * Does NOT insert any dummy leads, dummy contacts, dummy tasks, or fabricated records.
 */
export async function ensureWorkspaceSeeded(workspaceId = DEFAULT_WORKSPACE_ID) {
  const db = await getDb();
  const existingOrgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.workspaceId, workspaceId));

  return { seeded: false, leadCount: existingOrgs.length };
}
