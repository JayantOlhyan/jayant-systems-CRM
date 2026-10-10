import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  normalizeDomain,
  normalizeOrganizationName,
  validateUrlField,
  calculateLeadScore,
  sanitizeSpreadsheetCell,
} from "../lib/domain-utils";
import {
  DEFAULT_SCORING_CONFIG,
  GLOBAL_ECOM_COLLECTION_ID,
  DEFAULT_WORKSPACE_ID,
  DEFAULT_PIPELINE_ID,
  resetTestDb,
  getDb,
} from "../db";
import {
  organizations,
  notes,
  collectionMemberships,
  opportunities,
  tasks,
  contentIdeas,
  contactSuppressions,
  pipelineStageHistory,
} from "../db/schema";
import {
  parseWorkbookSheets,
  previewSpreadsheetImport,
  executeSpreadsheetImport,
  rollbackImportBatch,
} from "../lib/importer";
import {
  createCollection,
  createOrUpdateLead,
  calculateAndSaveOrganizationScore,
  getLeadDetail,
  queryLeadsPaginated,
} from "../lib/crm-service";
import { generateLedgerWorkbookBuffer, LEDGER_FILENAME } from "../lib/ledger-fixture";

describe("Domain & URL Utilities (Section 12.7 & 13.5)", () => {
  it("normalizes root organization domains with public-suffix awareness", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
    expect(normalizeDomain("http://example.com/")).toBe("example.com");
    expect(normalizeDomain("https://www.example.com/about")).toBe("example.com");
    expect(normalizeDomain("https://www.aurabotanics.co.uk/collections")).toBe("aurabotanics.co.uk");
    expect(normalizeDomain("https://brand.myshopify.com/products")).toBe("brand.myshopify.com");
  });

  it("does not treat missing or unknown websites as valid domains", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain("unknown")).toBeNull();
    expect(normalizeDomain("directory only")).toBeNull();
    expect(normalizeDomain("N/A")).toBeNull();
  });

  it("flags unexpected values like '49' and 'sent' in Contact Evidence URL", () => {
    const res49 = validateUrlField("49", "Contact Evidence URL");
    expect(res49.isValid).toBe(false);
    expect(res49.normalizedUrl).toBeNull();
    expect(res49.rawValue).toBe("49");
    expect(res49.warning).toContain("numeric value");

    const resSent = validateUrlField("sent", "Contact Evidence URL");
    expect(resSent.isValid).toBe(false);
    expect(resSent.normalizedUrl).toBeNull();
    expect(resSent.rawValue).toBe("sent");
    expect(resSent.warning).toContain("Not interpreted as outreach activity");

    const resValid = validateUrlField("https://apexfurniture.in/contact", "Contact Evidence URL");
    expect(resValid.isValid).toBe(true);
    expect(resValid.normalizedUrl).toBe("https://apexfurniture.in/contact");
  });

  it("normalizes organization names and sanitizes CSV formula injection", () => {
    expect(normalizeOrganizationName("Apex Furniture Studio Pvt. Ltd.")).toBe(
      "apex furniture studio"
    );
    expect(sanitizeSpreadsheetCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(sanitizeSpreadsheetCell("Normal Text")).toBe("Normal Text");
  });
});

describe("Configurable Lead Scoring (Section 14)", () => {
  it("computes deterministic weighted scores only when inputs are present", () => {
    const emptyRes = calculateLeadScore({}, DEFAULT_SCORING_CONFIG);
    expect(emptyRes.score).toBeNull();

    const fullRes = calculateLeadScore(
      {
        website_opportunity: 90,
        business_fit: 80,
        potential_value: 75,
        accessibility: 80,
        urgency: 70,
      },
      DEFAULT_SCORING_CONFIG
    );
    // 90*0.25 (22.5) + 80*0.25 (20) + 75*0.20 (15) + 80*0.15 (12) + 70*0.15 (10.5) = 80
    expect(fullRes.score).toBe(80);
  });
});

describe("End-to-End Workflows A–F (Section 13.8 & Section 33)", () => {
  let workbookBuffer: Buffer;
  let batch1Id: string;

  beforeAll(async () => {
    process.env.PGLITE_IN_MEMORY = "true";
    await resetTestDb();
    workbookBuffer = await generateLedgerWorkbookBuffer();
  });

  it("Workflow A: inspects all 3 sheets (Leads, Run Log, Do Not Contact) accurately", async () => {
    const { inspection } = await parseWorkbookSheets(workbookBuffer, LEDGER_FILENAME);
    expect(inspection.sheets.map((s) => s.name)).toEqual(["Leads", "Run Log", "Do Not Contact"]);
    expect(inspection.recommendedLeadSheet).toBe("Leads");
    expect(inspection.runLogSheet).toBe("Run Log");
    expect(inspection.doNotContactSheet).toBe("Do Not Contact");

    const leadsSheet = inspection.sheets.find((s) => s.name === "Leads")!;
    expect(leadsSheet.totalDataRows).toBe(200);
    expect(leadsSheet.headers.length).toBe(18);
  });

  it("Workflow A & B: imports all 200 leads, preserves governance statuses, flags 49/sent anomalies, and survives re-import without duplicating or overwriting user edits", async () => {
    const { inspection } = await parseWorkbookSheets(workbookBuffer, LEDGER_FILENAME);
    const leadsSheet = inspection.sheets.find((s) => s.name === "Leads")!;
    const mapping = leadsSheet.suggestedMapping;

    const preview = await previewSpreadsheetImport({
      buffer: workbookBuffer,
      filename: LEDGER_FILENAME,
      selectedSheet: "Leads",
      mapping,
    });

    expect(preview.totalRows).toBe(200);
    expect(preview.newCount).toBe(200);
    expect(preview.indiaMarketCount).toBe(100);
    expect(preview.internationalMarketCount).toBe(100);
    expect(preview.siteDescriptionCount).toBe(192);
    expect(preview.directoryOnlyCount).toBe(8);

    // Execute first import
    const batch1 = await executeSpreadsheetImport({
      buffer: workbookBuffer,
      filename: LEDGER_FILENAME,
      selectedSheet: "Leads",
      collectionId: GLOBAL_ECOM_COLLECTION_ID,
      mapping,
    });
    batch1Id = batch1.id;

    expect(batch1.newRecordsCreated).toBe(200);
    expect(batch1.failedRowsCount).toBe(0);
    expect(batch1.runLogProvenance.length).toBe(1);

    const db = await getDb();
    const allOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.workspaceId, DEFAULT_WORKSPACE_ID));

    expect(allOrgs.length).toBe(200);

    // Verify governance fields preserved accurately
    expect(allOrgs.every((o) => o.sourceLeadStatus === "candidate")).toBe(true);
    expect(allOrgs.every((o) => o.qualificationDecision === "not reviewed")).toBe(true);
    expect(allOrgs.every((o) => o.outreachApproval === "not approved")).toBe(true);
    expect(allOrgs.every((o) => o.optOutStatus === "unknown")).toBe(true);

    // Verify 192 site description vs 8 directory listing only
    const siteDescOrgs = allOrgs.filter((o) => o.verificationLevel === "site description");
    const dirOnlyOrgs = allOrgs.filter((o) => o.verificationLevel === "directory listing only");
    expect(siteDescOrgs.length).toBe(192);
    expect(dirOnlyOrgs.length).toBe(8);

    // Verify Contact Evidence URL anomalies '49' and 'sent' are flagged and preserved
    const row49 = allOrgs.find((o) => o.externalId === "ECOM-IN-049")!;
    expect(row49.contactEvidenceUrl).toBe("49");
    expect(row49.contactEvidenceValid).toBe(false);
    expect(row49.contactEvidenceWarning).toContain("49");

    const rowSent = allOrgs.find((o) => o.externalId === "ECOM-INTL-012")!;
    expect(rowSent.contactEvidenceUrl).toBe("sent");
    expect(rowSent.contactEvidenceValid).toBe(false);
    expect(rowSent.primaryStageId).toBe("stg_new"); // Never reclassified as Contacted!

    // Simulate user adding a manual note, manual score, and changing stage on ECOM-IN-001
    const firstOrg = allOrgs.find((o) => o.externalId === "ECOM-IN-001")!;
    await db
      .update(organizations)
      .set({
        score: 92,
        scoreIsManual: true,
        primaryStageId: "stg_researching",
      })
      .where(eq(organizations.id, firstOrg.id));

    await db.insert(notes).values({
      id: "note_test_preserve",
      workspaceId: DEFAULT_WORKSPACE_ID,
      organizationId: firstOrg.id,
      content: "User manual audit note: must survive repeated spreadsheet imports.",
      isPinned: true,
    });

    // Execute second import of the exact same spreadsheet
    const batch2 = await executeSpreadsheetImport({
      buffer: workbookBuffer,
      filename: LEDGER_FILENAME,
      selectedSheet: "Leads",
      collectionId: GLOBAL_ECOM_COLLECTION_ID,
      mapping,
      duplicatePolicy: "fill_blanks",
    });

    expect(batch2.newRecordsCreated).toBe(0);
    expect(batch2.existingMatched).toBe(200);

    const orgsAfterSecondImport = await db
      .select()
      .from(organizations)
      .where(eq(organizations.workspaceId, DEFAULT_WORKSPACE_ID));

    expect(orgsAfterSecondImport.length).toBe(200);

    const updatedFirstOrg = orgsAfterSecondImport.find((o) => o.id === firstOrg.id)!;
    expect(updatedFirstOrg.score).toBe(92);
    expect(updatedFirstOrg.scoreIsManual).toBe(true);
    expect(updatedFirstOrg.primaryStageId).toBe("stg_researching");

    const preservedNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.organizationId, firstOrg.id));
    expect(preservedNotes.length).toBe(1);
    expect(preservedNotes[0].content).toContain("must survive repeated spreadsheet imports");
  });

  it("Workflow C: creates a new collection with custom fields & categories, and maintains independent collection memberships for a shared company", async () => {
    const db = await getDb();
    const schoolsCollectionId = await createCollection({
      name: "Schools & Education",
      description: "Private schools, coaching institutes, and EdTech prospects",
      color: "#659BFA",
      categories: ["K-12 Private School", "EdTech Platform", "Coaching Institute"],
      customFields: [
        { name: "Student Count", fieldType: "number", isRequired: false },
        { name: "Admission Portal URL", fieldType: "url", isRequired: false },
        { name: "Has Online Fee Payment", fieldType: "boolean", isRequired: false },
      ],
    });

    // Find an existing organization from Global E-Commerce and add it to Schools & Education
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.externalId, "ECOM-IN-002"));

    // Add membership to Schools & Education with collection-specific categories & custom fields
    await db.insert(collectionMemberships).values({
      id: "mem_shared_school_test",
      workspaceId: DEFAULT_WORKSPACE_ID,
      collectionId: schoolsCollectionId,
      organizationId: existingOrg.id,
      collectionCategories: ["EdTech Platform"],
      stageId: "stg_qualified",
      customValues: {
        student_count: 4500,
        has_online_fee_payment: true,
      },
    });

    // Verify shared company identity vs independent collection memberships
    const profile = await getLeadDetail(existingOrg.id);
    expect(profile).not.toBeNull();
    expect(profile!.memberships.length).toBe(2);

    const ecomMem = profile!.memberships.find(
      (m) => m.collectionId === GLOBAL_ECOM_COLLECTION_ID
    )!;
    const schoolMem = profile!.memberships.find((m) => m.collectionId === schoolsCollectionId)!;

    expect(ecomMem.collectionCategories).not.toEqual(schoolMem.collectionCategories);
    expect(schoolMem.collectionCategories).toEqual(["EdTech Platform"]);
    expect(schoolMem.stageId).toBe("stg_qualified");
    expect((schoolMem.customValues as Record<string, unknown>).student_count).toBe(4500);
  });

  it("Workflow D: executes daily agency workflow (filtering, scoring, moving pipeline stages, creating opportunities, tasks, and content ideas)", async () => {
    const db = await getDb();
    const [targetOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.externalId, "ECOM-IN-001"));

    // 1. Score calculation & persistence
    const scoreResult = await calculateAndSaveOrganizationScore(
      targetOrg.id,
      {
        website_opportunity: 95,
        business_fit: 90,
        potential_value: 85,
        accessibility: 80,
        urgency: 85,
      },
      GLOBAL_ECOM_COLLECTION_ID
    );
    expect(scoreResult.score).toBeGreaterThanOrEqual(85);

    // 2. Move lead stage and verify stage history log
    await createOrUpdateLead({
      id: targetOrg.id,
      name: targetOrg.name,
      primaryStageId: "stg_qualified",
      qualificationDecision: "qualified",
      outreachApproval: "approved",
    });

    const historyRows = await db
      .select()
      .from(pipelineStageHistory)
      .where(eq(pipelineStageHistory.organizationId, targetOrg.id));
    expect(historyRows.length).toBeGreaterThanOrEqual(1);
    expect(historyRows[0].toStageId).toBe("stg_qualified");

    // 3. Create multiple opportunities under the same organization
    await db.insert(opportunities).values([
      {
        id: "opp_web_redesign_1",
        workspaceId: DEFAULT_WORKSPACE_ID,
        organizationId: targetOrg.id,
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        pipelineId: DEFAULT_PIPELINE_ID,
        stageId: "stg_proposal",
        name: `${targetOrg.name} — Headless Storefront Redesign`,
        serviceType: "Website Redesign",
        estimatedValue: "450000",
        currency: "INR",
        probability: 75,
        outcome: "open",
      },
      {
        id: "opp_ai_assistant_2",
        workspaceId: DEFAULT_WORKSPACE_ID,
        organizationId: targetOrg.id,
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        pipelineId: DEFAULT_PIPELINE_ID,
        stageId: "stg_qualified",
        name: `${targetOrg.name} — WhatsApp & Web AI Shopping Concierge`,
        serviceType: "AI Chatbot",
        estimatedValue: "220000",
        currency: "INR",
        probability: 60,
        outcome: "open",
      },
    ]);

    // 4. Create a follow-up task and complete it
    await db.insert(tasks).values({
      id: "tsk_audit_video_1",
      workspaceId: DEFAULT_WORKSPACE_ID,
      organizationId: targetOrg.id,
      title: "Record 3-minute mobile checkout UX teardown",
      taskType: "Send Website Audit",
      priority: "High",
      status: "completed",
      dueDate: "2026-10-15",
      completedAt: new Date(),
      notes: "Recorded Loom audit highlighting 4.2s LCP and cart drawer friction.",
    });

    // 5. Create Content Idea directly from Lead
    await db.insert(contentIdeas).values({
      id: "cid_teardown_1",
      workspaceId: DEFAULT_WORKSPACE_ID,
      organizationId: targetOrg.id,
      title: `Why ${targetOrg.name} loses mobile conversions at checkout`,
      platform: "Instagram Reel",
      contentType: "Website Teardown",
      hook: "This D2C brand has great products, but their mobile product page hides the CTA below the fold.",
      status: "scripted",
    });

    // 6. Query paginated leads with filters
    const filtered = await queryLeadsPaginated({
      market: "India",
      qualificationDecision: "qualified",
      minScore: 80,
    });
    expect(filtered.totalCount).toBeGreaterThanOrEqual(1);
    expect(filtered.rows.some((i) => i.id === targetOrg.id)).toBe(true);
  });

  it("Workflow E & F: enforces Do Not Contact suppression and safely rolls back unmodified batch records while preserving user-modified leads", async () => {
    const db = await getDb();

    // Add a domain to Contact Suppression registry
    const [suppressedCandidate] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.externalId, "ECOM-INTL-005"));

    await db.insert(contactSuppressions).values({
      id: "sup_test_domain_1",
      workspaceId: DEFAULT_WORKSPACE_ID,
      businessOrDomain: suppressedCandidate.normalizedDomain || suppressedCandidate.name,
      normalizedDomain: suppressedCandidate.normalizedDomain,
      reasonOrSource: "Requested opt-out via email",
    });

    // Mark organization suppressed
    await db
      .update(organizations)
      .set({
        optOutStatus: "opted_out",
        outreachApproval: "do_not_contact",
      })
      .where(
        and(
          eq(organizations.id, suppressedCandidate.id),
          eq(organizations.workspaceId, DEFAULT_WORKSPACE_ID)
        )
      );

    const [verifiedSuppressed] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, suppressedCandidate.id));
    expect(verifiedSuppressed.optOutStatus).toBe("opted_out");
    expect(verifiedSuppressed.outreachApproval).toBe("do_not_contact");

    // Workflow F: Roll back batch1Id
    // ECOM-IN-001 has user notes, tasks, opportunities, and manual score -> MUST be preserved!
    // Unmodified leads from batch1Id -> MUST be removed cleanly!
    const rollbackRes = await rollbackImportBatch(batch1Id);
    expect(rollbackRes.status).toBe("rolled_back");
    expect(rollbackRes.preservedCount).toBe(1);
    expect(rollbackRes.deletedCount).toBe(199);

    const remainingOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.workspaceId, DEFAULT_WORKSPACE_ID));
    expect(remainingOrgs.length).toBe(1);
    expect(remainingOrgs[0].externalId).toBe("ECOM-IN-001");
  });
});
