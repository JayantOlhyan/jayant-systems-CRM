import * as fs from "fs";
import * as path from "path";
import { eq } from "drizzle-orm";
import { getDb, DEFAULT_WORKSPACE_ID } from "../db";
import { organizations } from "../db/schema";
import {
  deduplicateAndDisambiguateWorkspaceState,
  type DeduplicationReport,
} from "../lib/deduplicate-leads";

function printReport(label: string, report: DeduplicationReport) {
  console.log(`\n================================================================`);
  console.log(`JAYANT CRM — Deduplication & Number Disambiguation Report`);
  console.log(`Target: ${label}`);
  console.log(`================================================================`);
  console.log(`Total leads before : ${report.totalBefore}`);
  console.log(`Duplicates erased  : ${report.erasedCount}`);
  console.log(`Numbers re-coded   : ${report.disambiguatedCount} (A, B, C... suffixes)`);
  console.log(`Total leads after  : ${report.totalAfter}`);

  if (report.erasedDuplicates.length > 0) {
    console.log(`\n--- Erased Content Duplicates ---`);
    for (const d of report.erasedDuplicates.slice(0, 25)) {
      console.log(
        `  [ERASED] "${d.name}" (${d.externalId || d.erasedId}) -> merged into ${d.mergedIntoId} | Reason: ${d.reason}`
      );
    }
    if (report.erasedDuplicates.length > 25) {
      console.log(`  ... and ${report.erasedDuplicates.length - 25} more duplicate(s) erased.`);
    }
  }

  if (report.disambiguatedLeads.length > 0) {
    console.log(`\n--- Disambiguated Number Collisions (Different Content -> A, B, C...) ---`);
    for (const c of report.disambiguatedLeads.slice(0, 25)) {
      const extInfo =
        c.previousExternalId && c.newExternalId && c.previousExternalId !== c.newExternalId
          ? ` | External ID: ${c.previousExternalId} -> ${c.newExternalId}`
          : "";
      console.log(`  [CODE #${c.sequenceCode}] "${c.name}" (Base #${String(c.baseNumber).padStart(3, "0")} + "${c.codeSuffix}")${extInfo}`);
    }
    if (report.disambiguatedLeads.length > 25) {
      console.log(
        `  ... and ${report.disambiguatedLeads.length - 25} more lead(s) assigned letter suffixes.`
      );
    }
  }
  console.log(`================================================================\n`);
}

async function processJsonFile(filePath: string) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }
  const raw = fs.readFileSync(absPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    const wrapper = { organizations: parsed };
    const report = deduplicateAndDisambiguateWorkspaceState(wrapper);
    fs.writeFileSync(absPath, JSON.stringify(wrapper.organizations, null, 2), "utf-8");
    printReport(absPath, report);
    return;
  }

  if (parsed && Array.isArray(parsed.organizations)) {
    const report = deduplicateAndDisambiguateWorkspaceState(parsed);
    fs.writeFileSync(absPath, JSON.stringify(parsed, null, 2), "utf-8");
    printReport(absPath, report);
    return;
  }

  throw new Error(
    `Unsupported JSON structure in ${absPath}. Expected an array of leads or a workspace backup object containing an "organizations" array.`
  );
}

async function processDatabase() {
  const db = await getDb();
  const allOrgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.workspaceId, DEFAULT_WORKSPACE_ID));

  if (allOrgs.length === 0) {
    console.log(
      "Local SQLite/PGlite database currently has 0 leads (active leads live in your browser's Local Storage)."
    );
    console.log(
      "Running verification self-check on sample duplicate & colliding-number leads..."
    );

    const sampleState = {
      organizations: [
        {
          id: "org_3",
          name: "Nova Robotics",
          websiteUrl: "https://novarobotics.ai",
          normalizedDomain: "novarobotics.ai",
          country: "United States",
          externalId: "001",
          daySequenceNumber: 1,
          sequenceNumber: 1,
        },
        {
          id: "org_2",
          name: "Aura Botanicals",
          websiteUrl: "https://aurabotanicals.in",
          normalizedDomain: "aurabotanicals.in",
          country: "India",
          externalId: "001",
          daySequenceNumber: 1,
          sequenceNumber: 1,
        },
        {
          id: "org_1",
          name: "Aura Botanicals",
          websiteUrl: "https://aurabotanicals.in",
          normalizedDomain: "aurabotanicals.in",
          country: "India",
          externalId: "001",
          daySequenceNumber: 1,
          sequenceNumber: 1,
        },
      ],
    };

    const demoReport = deduplicateAndDisambiguateWorkspaceState(sampleState);
    printReport("Verification Self-Check (Sample Collisions)", demoReport);
    return;
  }

  const stateWrapper = {
    organizations: allOrgs.map((o) => ({ ...o })),
  };
  const report = deduplicateAndDisambiguateWorkspaceState(stateWrapper);

  // Erase duplicates from DB
  for (const dup of report.erasedDuplicates) {
    await db.delete(organizations).where(eq(organizations.id, dup.erasedId));
  }

  // Update disambiguated externalIds in DB
  for (const dis of report.disambiguatedLeads) {
    const nextExternalId = dis.newExternalId || dis.sequenceCode;
    await db
      .update(organizations)
      .set({ externalId: nextExternalId })
      .where(eq(organizations.id, dis.id));
  }

  printReport("Local Workspace Database", report);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    for (const fileArg of args) {
      await processJsonFile(fileArg);
    }
  } else {
    await processDatabase();
  }
}

main().catch((err) => {
  console.error("Error running deduplication script:", err);
  process.exit(1);
});
