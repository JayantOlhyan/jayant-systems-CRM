"use client";

import ExcelJS from "exceljs";
import {
  normalizeDomain,
  normalizeOrganizationName,
  validateUrlField,
  calculateLeadScore,
  sanitizeSpreadsheetCell,
} from "./domain-utils";
import {
  deduplicateAndDisambiguateWorkspaceState,
  areLeadsContentIdentical,
} from "./deduplicate-leads";
import { DEFAULT_SCORING_CONFIG, type ScoringConfigJSON } from "@/db/schema";

export const LOCAL_STORAGE_DB_KEY = "jayant_crm_local_db_v2";
const LEGACY_DUMMY_STORAGE_KEY = "jayant_crm_local_db_v1";
const IDB_NAME = "jayant_crm_idb_v2";
const IDB_STORE = "workspace_store";
const DEFAULT_WORKSPACE_ID = "ws_jayant_main";
const DEFAULT_PIPELINE_ID = "pip_agency_default";
const GLOBAL_ECOM_COLLECTION_ID = "col_global_ecommerce";

function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface LocalWorkspaceDB extends Record<string, any> {
  version: number;
  lastSavedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspace: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collections: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tags: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fieldDefinitions: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipelines: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipelineStages: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organizations: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memberships: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opportunities: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contacts: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notes: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activities: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  references: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentIdeas: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importBatches: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sourceRecords: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stageHistory: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suppressions: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savedViews: Array<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savedMappings: Array<Record<string, any>>;
}

/**
 * Builds a 100% clean, zero-dummy-data workspace structure in Local Browser Storage.
 * Only structural schema configuration (default pipeline stages & collection containers) is initialized.
 * All data tables (organizations, contacts, tasks, notes, opportunities, references, contentIdeas, importBatches) start empty.
 */
export function buildDefaultLocalBrowserDB(): LocalWorkspaceDB {
  const nowIso = new Date().toISOString();

  const stages = [
    { id: "stg_new", pipelineId: DEFAULT_PIPELINE_ID, name: "New", color: "#659BFA", sortOrder: 1, classification: "open" },
    { id: "stg_researching", pipelineId: DEFAULT_PIPELINE_ID, name: "Researching", color: "#E9AE50", sortOrder: 2, classification: "open" },
    { id: "stg_qualified", pipelineId: DEFAULT_PIPELINE_ID, name: "Qualified", color: "#32B881", sortOrder: 3, classification: "open" },
    { id: "stg_contacted", pipelineId: DEFAULT_PIPELINE_ID, name: "Contacted", color: "#7958F5", sortOrder: 4, classification: "open" },
    { id: "stg_replied", pipelineId: DEFAULT_PIPELINE_ID, name: "Replied", color: "#38BDF8", sortOrder: 5, classification: "open" },
    { id: "stg_meeting", pipelineId: DEFAULT_PIPELINE_ID, name: "Meeting", color: "#A855F7", sortOrder: 6, classification: "open" },
    { id: "stg_proposal", pipelineId: DEFAULT_PIPELINE_ID, name: "Proposal", color: "#F59E0B", sortOrder: 7, classification: "open" },
    { id: "stg_won", pipelineId: DEFAULT_PIPELINE_ID, name: "Won", color: "#10B981", sortOrder: 8, classification: "won" },
    { id: "stg_lost", pipelineId: DEFAULT_PIPELINE_ID, name: "Lost", color: "#E56B73", sortOrder: 9, classification: "lost" },
  ];

  const collections = [
    {
      id: GLOBAL_ECOM_COLLECTION_ID,
      workspaceId: DEFAULT_WORKSPACE_ID,
      name: "Global E-Commerce Leads",
      slug: "global-e-commerce-leads",
      description: "Primary collection for e-commerce lead spreadsheets and storefront audits",
      icon: "ShoppingBag",
      color: "#7958F5",
      recordType: "company",
      defaultView: "table",
      defaultPipelineId: DEFAULT_PIPELINE_ID,
      scoringConfig: DEFAULT_SCORING_CONFIG,
      isPinned: true,
      isVisibleInSidebar: true,
      sortOrder: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      archivedAt: null,
    },
  ];

  return {
    version: 2,
    lastSavedAt: nowIso,
    workspace: {
      id: DEFAULT_WORKSPACE_ID,
      name: "Jayant Web & AI Systems",
      defaultCurrency: "INR",
      timezone: "Asia/Kolkata",
      dateFormat: "DD MMM YYYY",
      theme: "dark",
      defaultLandingPage: "/dashboard",
      storageMode: "local_browser_storage",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    collections,
    categories: [],
    tags: [],
    fieldDefinitions: [],
    pipelines: [
      {
        id: DEFAULT_PIPELINE_ID,
        workspaceId: DEFAULT_WORKSPACE_ID,
        name: "Agency Sales & Qualification Pipeline",
        description: "Primary lead qualification, discovery, outreach, and deal closing workflow",
        isDefault: true,
        createdAt: nowIso,
      },
    ],
    pipelineStages: stages,
    organizations: [],
    memberships: [],
    opportunities: [],
    contacts: [],
    tasks: [],
    notes: [],
    activities: [],
    attachments: [],
    references: [
      {
        id: "ref_user_design_inspiration_1",
        workspaceId: DEFAULT_WORKSPACE_ID,
        title: "Jayant CRM — Primary UI & Workspace Design Inspiration",
        url: "/inspirations/jayant-crm-design-inspiration.png",
        screenshotUrl: "/inspirations/jayant-crm-design-inspiration.png",
        category: "Design Inspiration",
        description:
          "Saved design inspiration reference uploaded by user for JAYANT CRM layout, typography, centered lead cards, and dark-mode density.",
        tags: ["Design Inspiration", "CRM UI", "Saved Screenshot"],
        organizationId: null,
        createdAt: nowIso,
      },
    ],
    contentIdeas: [],
    importBatches: [],
    sourceRecords: [],
    stageHistory: [],
    suppressions: [],
    savedViews: [],
    savedMappings: [],
  };
}

function saveToIndexedDB(dbState: LocalWorkspaceDB): void {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(dbState, LOCAL_STORAGE_DB_KEY);
    };
  } catch {
    // Ignore IDB fallback errors
  }
}

export function formatLeadSequenceNumber(n: number): string {
  const safeNum = Math.max(1, Math.floor(Number(n) || 1));
  return String(safeNum).padStart(3, "0");
}

function normalizeLeadNumberingAndDays(state: LocalWorkspaceDB): boolean {
  let mutated = false;
  if (!Array.isArray(state.days)) {
    state.days = [];
    mutated = true;
  }
  if (!Array.isArray(state.categories)) {
    state.categories = [];
    mutated = true;
  }

  const todayIsoDate = new Date().toISOString().slice(0, 10);

  const perDayCounters: Record<string, number> = {};
  let maxGlobalSeq = 0;

  for (const org of state.organizations) {
    if (typeof org.sequenceNumber === "number" && org.sequenceNumber > maxGlobalSeq) {
      maxGlobalSeq = org.sequenceNumber;
    }
  }

  for (const org of state.organizations) {
    const resolvedDay =
      org.dayKey ||
      org.discoveryDate ||
      (org.createdAt ? String(org.createdAt).slice(0, 10) : todayIsoDate);

    if (org.dayKey !== resolvedDay) {
      org.dayKey = resolvedDay;
      if (!org.discoveryDate) org.discoveryDate = resolvedDay;
      mutated = true;
    }

    if (typeof org.sequenceNumber !== "number" || org.sequenceNumber < 1) {
      maxGlobalSeq += 1;
      org.sequenceNumber = maxGlobalSeq;
      mutated = true;
    }

    perDayCounters[resolvedDay] = (perDayCounters[resolvedDay] || 0) + 1;
    if (typeof org.daySequenceNumber !== "number" || org.daySequenceNumber < 1) {
      org.daySequenceNumber = perDayCounters[resolvedDay];
      mutated = true;
    } else if (org.daySequenceNumber > perDayCounters[resolvedDay]) {
      perDayCounters[resolvedDay] = org.daySequenceNumber;
    }

    if (!Array.isArray(org.categories)) {
      org.categories = org.industry ? [org.industry] : [];
      mutated = true;
    }
  }

  const dedupReport = deduplicateAndDisambiguateWorkspaceState(state);
  if (dedupReport.erasedCount > 0 || dedupReport.disambiguatedCount > 0) {
    mutated = true;
  }

  return mutated;
}

export function loadLocalBrowserDB(): LocalWorkspaceDB {
  if (typeof window === "undefined") {
    return buildDefaultLocalBrowserDB();
  }
  try {
    // Purge legacy v1 storage that contained pre-seeded dummy leads
    if (window.localStorage.getItem(LEGACY_DUMMY_STORAGE_KEY)) {
      window.localStorage.removeItem(LEGACY_DUMMY_STORAGE_KEY);
    }

    const raw = window.localStorage.getItem(LOCAL_STORAGE_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalWorkspaceDB;
      if (parsed && Array.isArray(parsed.organizations) && Array.isArray(parsed.collections)) {
        if (!Array.isArray(parsed.references)) parsed.references = [];
        const hasUserDesignInspiration = parsed.references.some(
          (r) => r.id === "ref_user_design_inspiration_1"
        );
        let shouldSave = false;
        if (!hasUserDesignInspiration) {
          parsed.references.unshift({
            id: "ref_user_design_inspiration_1",
            workspaceId: DEFAULT_WORKSPACE_ID,
            title: "Jayant CRM — Primary UI & Workspace Design Inspiration",
            url: "/inspirations/jayant-crm-design-inspiration.png",
            screenshotUrl: "/inspirations/jayant-crm-design-inspiration.png",
            category: "Design Inspiration",
            description:
              "Saved design inspiration reference uploaded by user for JAYANT CRM layout, typography, centered lead cards, and dark-mode density.",
            tags: ["Design Inspiration", "CRM UI", "Saved Screenshot"],
            organizationId: null,
            createdAt: new Date().toISOString(),
          });
          shouldSave = true;
        }
        if (normalizeLeadNumberingAndDays(parsed)) {
          shouldSave = true;
        }
        if (shouldSave) {
          saveLocalBrowserDB(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to parse localStorage DB, initializing clean state:", err);
  }

  const initial = buildDefaultLocalBrowserDB();
  normalizeLeadNumberingAndDays(initial);
  saveLocalBrowserDB(initial);
  return initial;
}

export function saveLocalBrowserDB(state: LocalWorkspaceDB): void {
  if (typeof window === "undefined") return;
  state.lastSavedAt = new Date().toISOString();
  try {
    window.localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("localStorage quota warning, persisting full state in IndexedDB:", err);
  }
  saveToIndexedDB(state);
  window.dispatchEvent(new CustomEvent("jayant-crm-local-storage-updated"));
}

export function getLocalBrowserStorageStats(): {
  leadCount: number;
  collectionCount: number;
  taskCount: number;
  opportunityCount: number;
  sizeKB: number;
  lastSavedAt: string;
} {
  if (typeof window === "undefined") {
    return {
      leadCount: 0,
      collectionCount: 1,
      taskCount: 0,
      opportunityCount: 0,
      sizeKB: 0,
      lastSavedAt: new Date().toISOString(),
    };
  }
  const raw = window.localStorage.getItem(LOCAL_STORAGE_DB_KEY) || "";
  const sizeKB = Math.max(1, Math.round((raw.length * 2) / 1024));
  const state = loadLocalBrowserDB();
  return {
    leadCount: state.organizations.filter((o) => !o.archivedAt).length,
    collectionCount: state.collections.filter((c) => !c.archivedAt).length,
    taskCount: state.tasks.length,
    opportunityCount: state.opportunities.length,
    sizeKB,
    lastSavedAt: state.lastSavedAt,
  };
}

function formatFullWorkspaceResponse(state: LocalWorkspaceDB) {
  const activeOrgs = state.organizations.filter((o) => !o.archivedAt);
  const activeOrgIds = new Set(activeOrgs.map((o) => o.id));
  const collectionCounts: Record<string, number> = {};
  const orgCollectionsMap: Record<string, string[]> = {};

  for (const m of state.memberships) {
    if (!activeOrgIds.has(m.organizationId)) continue;
    collectionCounts[m.collectionId] = (collectionCounts[m.collectionId] || 0) + 1;
    if (!orgCollectionsMap[m.organizationId]) {
      orgCollectionsMap[m.organizationId] = [];
    }
    orgCollectionsMap[m.organizationId].push(m.collectionId);
  }

  return {
    workspace: state.workspace,
    collections: state.collections
      .filter((c) => !c.archivedAt)
      .map((c) => ({
        ...c,
        leadCount: collectionCounts[c.id] || 0,
      })),
    categories: state.categories,
    days: state.days || [],
    tags: state.tags,
    fieldDefinitions: state.fieldDefinitions.filter((f) => !f.archivedAt),
    pipelines: state.pipelines,
    pipelineStages: state.pipelineStages,
    organizations: activeOrgs.map((o) => ({
      ...o,
      collectionIds: orgCollectionsMap[o.id] || [],
    })),
    memberships: state.memberships,
    opportunities: state.opportunities,
    contacts: state.contacts,
    tasks: state.tasks,
    notes: state.notes,
    activities: state.activities.slice(0, 120),
    references: state.references,
    contentIdeas: state.contentIdeas,
    importBatches: state.importBatches,
    suppressions: state.suppressions,
    savedViews: state.savedViews,
    savedMappings: state.savedMappings,
  };
}

function queryLocalLeadsPaginated(state: LocalWorkspaceDB, searchParams: URLSearchParams) {
  const includeArchived = searchParams.get("includeArchived") === "true";
  const collectionId = searchParams.get("collectionId") || undefined;
  const day = searchParams.get("day") || undefined;
  const search = searchParams.get("search") || undefined;
  const market = searchParams.get("market") || undefined;
  const country = searchParams.get("country") || undefined;
  const category = searchParams.get("category") || undefined;
  const stageId = searchParams.get("stageId") || undefined;
  const verificationLevel = searchParams.get("verificationLevel") || undefined;
  const qualificationDecision = searchParams.get("qualificationDecision") || undefined;
  const outreachApproval = searchParams.get("outreachApproval") || undefined;
  const tag = searchParams.get("tag") || undefined;
  const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined;
  const hasWarning = searchParams.get("hasWarning") === "true";
  const sortBy = searchParams.get("sortBy") || "sequenceNumber";
  const sortDir = searchParams.get("sortDir") || "asc";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.max(1, Math.min(5000, Number(searchParams.get("pageSize") || "50")));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgToMems = new Map<string, Array<Record<string, any>>>();
  for (const m of state.memberships) {
    const arr = orgToMems.get(m.organizationId) || [];
    arr.push(m);
    orgToMems.set(m.organizationId, arr);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let baseCollectionOrgs: Array<Record<string, any>> = state.organizations
    .filter((o) => (includeArchived ? true : !o.archivedAt))
    .map((org) => {
      const mems = orgToMems.get(org.id) || [];
      const activeMembership = collectionId
        ? mems.find((m) => m.collectionId === collectionId)
        : undefined;
      const dayKey =
        org.dayKey ||
        org.discoveryDate ||
        (org.createdAt ? String(org.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10));
      return {
        ...org,
        dayKey,
        collectionIds: mems.map((m) => m.collectionId),
        collectionCategories: activeMembership?.collectionCategories || org.categories || [],
        effectiveScore: activeMembership?.score ?? org.score,
        effectiveCustomValues: {
          ...(org.customValues || {}),
          ...(activeMembership?.customValues || {}),
        },
      };
    });

  if (collectionId) {
    baseCollectionOrgs = baseCollectionOrgs.filter((o) => o.collectionIds.includes(collectionId));
  }

  // Build availableDays summary (numbered 001, 002, 003... till infinity)
  const dayMap = new Map<
    string,
    {
      dayKey: string;
      label: string;
      leadCount: number;
      spreadsheets: string[];
      categories: Set<string>;
    }
  >();

  for (const d of state.days || []) {
    if (!d.dayKey) continue;
    dayMap.set(d.dayKey, {
      dayKey: d.dayKey,
      label: d.label || `Daily Spreadsheet (${d.dayKey})`,
      leadCount: 0,
      spreadsheets: [],
      categories: new Set<string>(),
    });
  }

  for (const b of state.importBatches || []) {
    if (b.status === "rolled_back") continue;
    if (collectionId && b.collectionId && b.collectionId !== collectionId) continue;
    const bDay =
      b.dayKey || (b.createdAt ? String(b.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const entry = dayMap.get(bDay) || {
      dayKey: bDay,
      label: String(b.filename || `Spreadsheet (${bDay})`),
      leadCount: 0,
      spreadsheets: [] as string[],
      categories: new Set<string>(),
    };
    const fname = b.filename ? String(b.filename) : "";
    if (fname && !entry.spreadsheets.includes(fname)) {
      entry.spreadsheets.push(fname);
      if (entry.label.startsWith("Daily Spreadsheet") || entry.label.startsWith("Spreadsheet")) {
        entry.label = fname;
      }
    }
    dayMap.set(bDay, entry);
  }

  for (const o of baseCollectionOrgs) {
    const dk = o.dayKey;
    const entry = dayMap.get(dk) || {
      dayKey: dk,
      label: `Spreadsheet (${dk})`,
      leadCount: 0,
      spreadsheets: [] as string[],
      categories: new Set<string>(),
    };
    entry.leadCount += 1;
    const primaryCat = o.categories?.[0] || o.industry;
    if (primaryCat) entry.categories.add(String(primaryCat));
    dayMap.set(dk, entry);
  }

  const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const availableDays = sortedDays.map((d, idx) => ({
    dayKey: d.dayKey,
    dayNumber: idx + 1,
    formattedDayNumber: formatLeadSequenceNumber(idx + 1),
    label: d.label,
    leadCount: d.leadCount,
    spreadsheets: d.spreadsheets,
    categories: Array.from(d.categories),
  }));

  // Filter by selected Day if specified
  let filtered = day
    ? baseCollectionOrgs.filter((o) => o.dayKey === day)
    : [...baseCollectionOrgs];

  // Build availableCategories summary for the active Day (or All Days), numbered 001, 002, 003...
  const catMap = new Map<
    string,
    { id: string | null; name: string; color: string; leadCount: number }
  >();

  for (const c of state.categories || []) {
    if (collectionId && c.collectionId && c.collectionId !== collectionId) continue;
    const key = String(c.name || "").trim().toLowerCase();
    if (!key) continue;
    catMap.set(key, {
      id: c.id || null,
      name: String(c.name).trim(),
      color: c.color || "#7958F5",
      leadCount: 0,
    });
  }

  for (const o of filtered) {
    const orgCats = new Set<string>();
    if (o.industry && String(o.industry).trim()) orgCats.add(String(o.industry).trim());
    for (const cName of o.categories || []) {
      if (cName && String(cName).trim()) orgCats.add(String(cName).trim());
    }
    for (const cName of o.collectionCategories || []) {
      if (cName && String(cName).trim()) orgCats.add(String(cName).trim());
    }
    for (const cName of orgCats) {
      const key = cName.toLowerCase();
      const existing = catMap.get(key);
      if (existing) {
        existing.leadCount += 1;
      } else {
        catMap.set(key, {
          id: null,
          name: cName,
          color: "#7958F5",
          leadCount: 1,
        });
      }
    }
  }

  const availableCategories = Array.from(catMap.values()).map((c, idx) => ({
    ...c,
    categoryNumber: idx + 1,
    formattedCategoryNumber: formatLeadSequenceNumber(idx + 1),
  }));

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (o) =>
        (o.name || "").toLowerCase().includes(q) ||
        (o.websiteUrl || "").toLowerCase().includes(q) ||
        (o.normalizedDomain || "").toLowerCase().includes(q) ||
        (o.country || "").toLowerCase().includes(q) ||
        (o.industry || "").toLowerCase().includes(q) ||
        (o.externalId || "").toLowerCase().includes(q) ||
        formatLeadSequenceNumber(o.sequenceNumber || 1).includes(q) ||
        formatLeadSequenceNumber(o.daySequenceNumber || 1).includes(q) ||
        (o.observedFacts || "").toLowerCase().includes(q) ||
        (o.publishedContact || "").toLowerCase().includes(q) ||
        (o.tags || []).some((t: string) => t.toLowerCase().includes(q)) ||
        (o.categories || []).some((c: string) => c.toLowerCase().includes(q))
    );
  }
  if (market) {
    filtered = filtered.filter((o) => (o.market || "").toLowerCase() === market.toLowerCase());
  }
  if (country) {
    filtered = filtered.filter((o) => (o.country || "").toLowerCase() === country.toLowerCase());
  }
  if (category) {
    const cLow = category.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        (o.industry || "").toLowerCase() === cLow ||
        (o.categories || []).some((c: string) => c.toLowerCase() === cLow) ||
        (o.collectionCategories || []).some((c: string) => c.toLowerCase() === cLow)
    );
  }
  if (stageId) {
    filtered = filtered.filter((o) => o.primaryStageId === stageId);
  }
  if (verificationLevel) {
    filtered = filtered.filter(
      (o) => (o.verificationLevel || "").toLowerCase() === verificationLevel.toLowerCase()
    );
  }
  if (qualificationDecision) {
    filtered = filtered.filter(
      (o) => (o.qualificationDecision || "").toLowerCase() === qualificationDecision.toLowerCase()
    );
  }
  if (outreachApproval) {
    filtered = filtered.filter(
      (o) => (o.outreachApproval || "").toLowerCase() === outreachApproval.toLowerCase()
    );
  }
  if (tag) {
    const tLow = tag.toLowerCase();
    filtered = filtered.filter((o) => (o.tags || []).some((t: string) => t.toLowerCase() === tLow));
  }
  if (minScore !== undefined && !Number.isNaN(minScore)) {
    filtered = filtered.filter((o) => o.effectiveScore !== null && o.effectiveScore >= minScore);
  }
  if (hasWarning) {
    filtered = filtered.filter(
      (o) =>
        !o.contactEvidenceValid ||
        (o.verificationLevel || "").toLowerCase().includes("directory")
    );
  }

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "sequenceNumber") {
      const seqA =
        a.baseNumber ?? (day ? (a.daySequenceNumber ?? a.sequenceNumber ?? 1) : (a.sequenceNumber ?? 1));
      const seqB =
        b.baseNumber ?? (day ? (b.daySequenceNumber ?? b.sequenceNumber ?? 1) : (b.sequenceNumber ?? 1));
      cmp = seqA - seqB;
      if (cmp === 0) {
        cmp = String(a.codeSuffix || "").localeCompare(String(b.codeSuffix || ""));
      }
    } else if (sortBy === "name") {
      cmp = (a.name || "").localeCompare(b.name || "");
    } else if (sortBy === "score") {
      cmp = (a.effectiveScore ?? -1) - (b.effectiveScore ?? -1);
    } else if (sortBy === "country") {
      cmp = (a.country || "").localeCompare(b.country || "");
    } else if (sortBy === "createdAt") {
      cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    } else {
      cmp = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
    }
    if (cmp === 0) {
      cmp = (a.sequenceNumber ?? 1) - (b.sequenceNumber ?? 1);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Number every lead in the sorted list sequentially: 001, 002, 003 ... till Infinity,
  // or 001A, 001B, 001C when numbers are duplicated across leads with different content!
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const numberedFiltered: Array<Record<string, any>> = filtered.map((item, idx) => {
    const suffix = item.codeSuffix ? String(item.codeSuffix) : "";
    const displayNum =
      sortBy === "sequenceNumber" && item.sequenceCode
        ? String(item.sequenceCode)
        : `${formatLeadSequenceNumber(idx + 1)}${suffix}`;
    return {
      ...item,
      sortedRank: idx + 1,
      displayNumber: displayNum,
      formattedSequenceNumber:
        item.sequenceCode || `${formatLeadSequenceNumber(item.sequenceNumber || idx + 1)}${suffix}`,
      formattedDaySequenceNumber:
        item.sequenceCode || `${formatLeadSequenceNumber(item.daySequenceNumber || idx + 1)}${suffix}`,
    };
  });

  const totalCount = numberedFiltered.length;
  const offset = (page - 1) * pageSize;
  const rows = numberedFiltered.slice(offset, offset + pageSize);

  return {
    rows,
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    availableDays,
    availableCategories,
  };
}

// ============================================================================
// CLIENT-SIDE SPREADSHEET PARSER & IMPORTER FOR LOCAL BROWSER STORAGE
// ============================================================================
const HEADER_SYNONYMS: Record<string, string> = {
  "lead id": "externalId",
  "lead_id": "externalId",
  id: "externalId",
  "discovery date": "discoveryDate",
  market: "market",
  country: "country",
  city: "city",
  business: "name",
  company: "name",
  "company name": "name",
  "business name": "name",
  niche: "industry",
  industry: "industry",
  "official website": "websiteUrl",
  website: "websiteUrl",
  "observed fact (from site)": "observedFacts",
  "observed facts": "observedFacts",
  "source url": "sourceUrl",
  "published business contact": "publishedContact",
  "published contact": "publishedContact",
  "contact evidence url": "contactEvidenceUrl",
  status: "sourceLeadStatus",
  "qualification decision": "qualificationDecision",
  "outreach approval": "outreachApproval",
  "opt-out": "optOutStatus",
  "prior contact check": "priorContactCheck",
  "verification level": "verificationLevel",
  notes: "sourceNotes",
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCsvTextToObjects(text: string): {
  headers: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Array<Record<string, any>>;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Array<Record<string, any>> = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? "";
    });
    rows.push(obj);
  }
  return { headers, rows };
}

async function parseBrowserSpreadsheet(
  arrayBuffer: ArrayBuffer,
  filename: string
): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inspection: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheetRowsMap: Record<string, Array<Record<string, any>>>;
}> {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheetRowsMap: Record<string, Array<Record<string, any>>> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheetsInfo: Array<Record<string, any>> = [];

  if (isCsv) {
    const text = new TextDecoder("utf-8").decode(arrayBuffer);
    const { headers, rows } = parseCsvTextToObjects(text);
    sheetRowsMap["CSV Sheet"] = rows;
    const suggestedMapping: Record<string, string> = {};
    for (const h of headers) {
      const norm = h.trim().toLowerCase();
      suggestedMapping[h] =
        HEADER_SYNONYMS[norm] || `custom:${norm.replace(/[^a-z0-9]+/g, "_")}`;
    }
    sheetsInfo.push({
      name: "CSV Sheet",
      sheetRole: "leads",
      headerRowNumber: 1,
      totalDataRows: rows.length,
      emptyRowsCount: 0,
      headers,
      duplicateHeaders: [],
      suggestedMapping,
      sampleRows: rows.slice(0, 10),
      columnStats: headers.map((h) => ({
        header: h,
        inferredType: "text",
        nonEmptyCount: rows.filter((r) => r[h] !== undefined && r[h] !== "").length,
        missingCount: rows.filter((r) => !r[h]).length,
        malformedUrlCount: 0,
        sampleValues: rows
          .slice(0, 3)
          .map((r) => String(r[h] ?? ""))
          .filter(Boolean),
      })),
    });
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    workbook.eachSheet((ws) => {
      const sheetName = ws.name;
      const lower = sheetName.toLowerCase();
      const sheetRole = lower.includes("run log")
        ? "run_log"
        : lower.includes("do not contact") || lower.includes("suppression")
        ? "do_not_contact"
        : "leads";

      const headerRow = ws.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        headers[colNumber - 1] = String(cell.text || cell.value || `Column_${colNumber}`).trim();
      });
      const cleanHeaders = headers.filter(Boolean);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: Array<Record<string, any>> = [];
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: Record<string, any> = {};
        let hasVal = false;
        headers.forEach((h, idx) => {
          if (!h) return;
          const cell = row.getCell(idx + 1);
          const val = cell.text !== undefined ? cell.text : cell.value;
          const strVal = val === null || val === undefined ? "" : String(val).trim();
          obj[h] = strVal;
          if (strVal !== "") hasVal = true;
        });
        if (hasVal) rows.push(obj);
      });

      sheetRowsMap[sheetName] = rows;
      const suggestedMapping: Record<string, string> = {};
      for (const h of cleanHeaders) {
        const norm = h.trim().toLowerCase();
        suggestedMapping[h] =
          HEADER_SYNONYMS[norm] || `custom:${norm.replace(/[^a-z0-9]+/g, "_")}`;
      }

      sheetsInfo.push({
        name: sheetName,
        sheetRole,
        headerRowNumber: 1,
        totalDataRows: rows.length,
        emptyRowsCount: 0,
        headers: cleanHeaders,
        duplicateHeaders: [],
        suggestedMapping,
        sampleRows: rows.slice(0, 10),
        columnStats: cleanHeaders.map((h) => ({
          header: h,
          inferredType: h.toLowerCase().includes("url") || h.toLowerCase().includes("website") ? "url" : "text",
          nonEmptyCount: rows.filter((r) => r[h] !== undefined && r[h] !== "").length,
          missingCount: rows.filter((r) => !r[h]).length,
          malformedUrlCount: 0,
          sampleValues: rows
            .slice(0, 3)
            .map((r) => String(r[h] ?? ""))
            .filter(Boolean),
        })),
      });
    });
  }

  const recommendedLeadSheet =
    sheetsInfo.find((s) => s.sheetRole === "leads")?.name || sheetsInfo[0]?.name || "Leads";
  const runLogSheet = sheetsInfo.find((s) => s.sheetRole === "run_log")?.name;
  const doNotContactSheet = sheetsInfo.find((s) => s.sheetRole === "do_not_contact")?.name;

  return {
    inspection: {
      filename,
      fileFormat: isCsv ? "csv" : "xlsx",
      fileSizeBytes: arrayBuffer.byteLength,
      sheets: sheetsInfo,
      recommendedLeadSheet,
      runLogSheet,
      doNotContactSheet,
    },
    sheetRowsMap,
  };
}

function previewLocalSpreadsheetImport(
  state: LocalWorkspaceDB,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheetRowsMap: Record<string, Array<Record<string, any>>>,
  filename: string,
  selectedSheet: string,
  mapping: Record<string, string>
) {
  const rows = sheetRowsMap[selectedSheet] || [];
  const existingByDomain = new Map<string, Record<string, unknown>>();
  const existingByExtId = new Map<string, Record<string, unknown>>();
  const existingByNameCountry = new Map<string, Record<string, unknown>>();

  for (const org of state.organizations) {
    if (org.normalizedDomain) existingByDomain.set(org.normalizedDomain, org);
    if (org.externalId) existingByExtId.set(String(org.externalId).toLowerCase(), org);
    const nc = `${normalizeOrganizationName(org.name)}|${(org.country || "").toLowerCase()}`;
    existingByNameCountry.set(nc, org);
  }

  let newCount = 0;
  let exactMatchCount = 0;
  let possibleMatchCount = 0;
  const conflictCount = 0;
  let invalidCount = 0;
  let warningsCount = 0;
  let directoryOnlyCount = 0;
  let siteDescriptionCount = 0;
  let indiaMarketCount = 0;
  let internationalMarketCount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewRows: Array<Record<string, any>> = [];

  rows.forEach((rawRow, idx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: Record<string, any> = {
      externalId: null,
      discoveryDate: null,
      market: null,
      country: null,
      city: null,
      name: "",
      industry: null,
      websiteUrl: null,
      normalizedDomain: null,
      observedFacts: null,
      sourceUrl: null,
      publishedContact: null,
      contactEvidenceUrl: null,
      contactEvidenceValid: true,
      contactEvidenceWarning: null,
      sourceLeadStatus: "candidate",
      qualificationDecision: "not reviewed",
      outreachApproval: "not approved",
      optOutStatus: "unknown",
      priorContactCheck: "not checked",
      verificationLevel: "unverified",
      sourceNotes: null,
      customValues: {},
    };

    for (const [header, targetField] of Object.entries(mapping)) {
      if (!targetField || targetField === "__ignore__") continue;
      const val = rawRow[header] !== undefined ? String(rawRow[header]).trim() : "";
      if (!val) continue;
      if (targetField.startsWith("custom:")) {
        mapped.customValues[targetField.slice(7)] = val;
      } else {
        mapped[targetField] = val;
      }
    }

    const warnings: Array<{ field: string; value: string; message: string }> = [];
    const evCheck = validateUrlField(mapped.contactEvidenceUrl, "Contact Evidence URL");
    mapped.contactEvidenceValid = evCheck.isValid;
    mapped.contactEvidenceWarning = evCheck.warning;
    if (!evCheck.isValid && evCheck.warning && mapped.contactEvidenceUrl) {
      warnings.push({
        field: "Contact Evidence URL",
        value: String(mapped.contactEvidenceUrl),
        message: evCheck.warning,
      });
    }

    const webCheck = validateUrlField(mapped.websiteUrl, "Website");
    mapped.normalizedDomain = webCheck.isValid ? normalizeDomain(mapped.websiteUrl) : null;

    if ((mapped.verificationLevel || "").toLowerCase().includes("directory")) {
      directoryOnlyCount++;
      warnings.push({
        field: "Verification Level",
        value: mapped.verificationLevel,
        message: "Directory listing only — requires manual website verification.",
      });
    } else if ((mapped.verificationLevel || "").toLowerCase().includes("site")) {
      siteDescriptionCount++;
    }

    if ((mapped.market || "").toLowerCase() === "india") indiaMarketCount++;
    else if (mapped.market) internationalMarketCount++;

    if (warnings.length > 0) warningsCount += warnings.length;

    if (!mapped.name) {
      invalidCount++;
      previewRows.push({
        rowNumber: idx + 2,
        status: "invalid",
        conflicts: [],
        warnings,
        isSuppressed: false,
        mappedData: mapped,
        rawValues: rawRow,
      });
      return;
    }

    const matchedByDom = mapped.normalizedDomain
      ? existingByDomain.get(mapped.normalizedDomain)
      : undefined;
    const rawMatchedByExt = mapped.externalId
      ? existingByExtId.get(String(mapped.externalId).toLowerCase())
      : undefined;
    // Only treat matchedByExt as a duplicate if the content (company name / domain) also matches!
    // If the number/externalId is duplicated but the content (company name & details) is different,
    // import it as a new lead so it gets disambiguated with A, B, C!
    const matchedByExt =
      rawMatchedByExt && areLeadsContentIdentical(rawMatchedByExt, mapped).isDuplicate
        ? rawMatchedByExt
        : undefined;
    const ncKey = `${normalizeOrganizationName(mapped.name)}|${(mapped.country || "").toLowerCase()}`;
    const matchedByName = existingByNameCountry.get(ncKey);

    const match = matchedByDom || matchedByExt || matchedByName;
    if (match) {
      if (matchedByDom || matchedByExt) exactMatchCount++;
      else possibleMatchCount++;
      previewRows.push({
        rowNumber: idx + 2,
        status: matchedByDom || matchedByExt ? "exact_match" : "possible_match",
        matchReason: matchedByDom
          ? `Canonical domain match (${mapped.normalizedDomain})`
          : matchedByExt
          ? `External Lead ID match (${mapped.externalId})`
          : "Normalized business name + country match",
        matchedOrganizationId: match.id as string,
        matchedOrganizationName: match.name as string,
        conflicts: [],
        warnings,
        isSuppressed: false,
        mappedData: mapped,
        rawValues: rawRow,
      });
    } else {
      newCount++;
      previewRows.push({
        rowNumber: idx + 2,
        status: "new",
        conflicts: [],
        warnings,
        isSuppressed: false,
        mappedData: mapped,
        rawValues: rawRow,
      });
    }
  });

  const runLogKey = Object.keys(sheetRowsMap).find((k) => k.toLowerCase().includes("run log"));
  const dncKey = Object.keys(sheetRowsMap).find((k) => k.toLowerCase().includes("do not contact"));

  return {
    filename,
    sheetName: selectedSheet,
    totalRows: rows.length,
    newCount,
    exactMatchCount,
    possibleMatchCount,
    conflictCount,
    invalidCount,
    warningsCount,
    directoryOnlyCount,
    siteDescriptionCount,
    indiaMarketCount,
    internationalMarketCount,
    runLogRows: runLogKey ? sheetRowsMap[runLogKey] : [],
    suppressionRows: dncKey ? sheetRowsMap[dncKey] : [],
    rows: previewRows,
  };
}

// ============================================================================
// BROWSER FETCH INTERCEPTOR FOR 100% LOCAL BROWSER STORAGE OPERATION
// ============================================================================
let interceptorInstalled = false;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function installLocalBrowserStorageInterceptor(): void {
  if (typeof window === "undefined" || interceptorInstalled) return;
  interceptorInstalled = true;

  // Ensure Local Browser Storage is initialized on startup (with zero dummy data)
  loadLocalBrowserDB();

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    const parsedUrl = new URL(urlStr, window.location.origin);
    const pathname = parsedUrl.pathname;
    const method = (init?.method || "GET").toUpperCase();

    // 1. Intercept /api/workspace (100% Local Browser Storage)
    if (pathname === "/api/workspace") {
      const state = loadLocalBrowserDB();

      if (method === "GET") {
        const view = parsedUrl.searchParams.get("view") || "full";
        if (view === "lead_detail") {
          normalizeLeadNumberingAndDays(state);
          const id = parsedUrl.searchParams.get("id");
          const org = state.organizations.find((o) => o.id === id);
          if (!org) return jsonResponse({ error: "Lead not found" }, 404);
          return jsonResponse({
            organization: org,
            memberships: state.memberships.filter((m) => m.organizationId === id),
            contacts: state.contacts.filter((c) => c.organizationId === id),
            opportunities: state.opportunities.filter((o) => o.organizationId === id),
            notes: state.notes
              .filter((n) => n.organizationId === id)
              .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))),
            tasks: state.tasks.filter((t) => t.organizationId === id),
            activities: state.activities.filter((a) => a.organizationId === id),
            attachments: state.attachments.filter((a) => a.organizationId === id),
            sourceRecords: state.sourceRecords.filter((s) => s.organizationId === id),
            stageHistory: state.stageHistory.filter((h) => h.organizationId === id),
            references: state.references.filter((r) => r.organizationId === id),
            contentIdeas: state.contentIdeas.filter((c) => c.organizationId === id),
            categoryTrees: state.categories || [],
          });
        }

        if (view === "leads_paginated") {
          return jsonResponse(queryLocalLeadsPaginated(state, parsedUrl.searchParams));
        }

        return jsonResponse(formatFullWorkspaceResponse(state));
      }

      if (method === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const { action, payload = {} } = body;
        const nowIso = new Date().toISOString();

        switch (action) {
          case "upsert_lead":
          case "inline_update_lead": {
            const targetId = payload.id;
            const updates = action === "inline_update_lead" ? payload.updates || {} : payload;

            if (targetId) {
              const idx = state.organizations.findIndex((o) => o.id === targetId);
              if (idx === -1) return jsonResponse({ error: "Lead not found" }, 404);
              const existing = state.organizations[idx];

              const nextWeb =
                updates.websiteUrl !== undefined ? updates.websiteUrl : existing.websiteUrl;
              const nextEv =
                updates.contactEvidenceUrl !== undefined
                  ? updates.contactEvidenceUrl
                  : existing.contactEvidenceUrl;
              const evCheck = validateUrlField(nextEv, "Contact Evidence URL");

              if (
                updates.primaryStageId &&
                updates.primaryStageId !== existing.primaryStageId
              ) {
                const fromStg = state.pipelineStages.find((s) => s.id === existing.primaryStageId);
                const toStg = state.pipelineStages.find((s) => s.id === updates.primaryStageId);
                state.stageHistory.unshift({
                  id: uid("psh"),
                  workspaceId: DEFAULT_WORKSPACE_ID,
                  organizationId: targetId,
                  fromStageId: existing.primaryStageId,
                  fromStageName: fromStg?.name || existing.primaryStageId,
                  toStageId: updates.primaryStageId,
                  toStageName: toStg?.name || updates.primaryStageId,
                  changedBy: "user",
                  createdAt: nowIso,
                });
                state.activities.unshift({
                  id: uid("act"),
                  workspaceId: DEFAULT_WORKSPACE_ID,
                  organizationId: targetId,
                  actorOrigin: "user",
                  activityType: "stage_changed",
                  title: `Pipeline stage moved to ${toStg?.name || updates.primaryStageId}`,
                  createdAt: nowIso,
                });
              }

              state.organizations[idx] = {
                ...existing,
                ...updates,
                name: (updates.name ?? existing.name).trim(),
                normalizedName: normalizeOrganizationName(updates.name ?? existing.name),
                normalizedDomain: nextWeb ? normalizeDomain(nextWeb) : null,
                contactEvidenceValid: evCheck.isValid,
                contactEvidenceWarning: evCheck.warning,
                customValues: updates.customValues
                  ? { ...(existing.customValues || {}), ...updates.customValues }
                  : existing.customValues,
                updatedAt: nowIso,
              };

              if (Array.isArray(updates.collectionIds)) {
                for (const colId of updates.collectionIds) {
                  const hasMem = state.memberships.some(
                    (m) => m.collectionId === colId && m.organizationId === targetId
                  );
                  if (!hasMem) {
                    state.memberships.push({
                      id: uid("mem"),
                      workspaceId: DEFAULT_WORKSPACE_ID,
                      collectionId: colId,
                      organizationId: targetId,
                      collectionCategories:
                        updates.categories || state.organizations[idx].categories || [],
                      stageId: state.organizations[idx].primaryStageId || "stg_new",
                      customValues: {},
                      createdAt: nowIso,
                      updatedAt: nowIso,
                    });
                  }
                }
              }

              normalizeLeadNumberingAndDays(state);
              saveLocalBrowserDB(state);
              return jsonResponse({ ok: true, id: targetId });
            }

            // Create new lead in Local Browser Storage
            const newId = uid("org");
            const evCheck = validateUrlField(updates.contactEvidenceUrl, "Contact Evidence URL");
            const normDomain = updates.websiteUrl ? normalizeDomain(updates.websiteUrl) : null;
            const resolvedDayKey = updates.dayKey || updates.discoveryDate || nowIso.split("T")[0];
            const maxGlobalSeq = state.organizations.reduce(
              (acc, o) => Math.max(acc, typeof o.sequenceNumber === "number" ? o.sequenceNumber : 0),
              0
            );
            const maxDaySeq = state.organizations
              .filter((o) => (o.dayKey || o.discoveryDate) === resolvedDayKey)
              .reduce(
                (acc, o) =>
                  Math.max(acc, typeof o.daySequenceNumber === "number" ? o.daySequenceNumber : 0),
                0
              );

            const initialCategories = Array.isArray(updates.categories)
              ? updates.categories
              : updates.category
              ? [String(updates.category).trim()]
              : updates.industry
              ? [String(updates.industry).trim()]
              : [];

            const newOrg = {
              id: newId,
              workspaceId: DEFAULT_WORKSPACE_ID,
              externalId: null,
              dayKey: resolvedDayKey,
              discoveryDate: resolvedDayKey,
              sequenceNumber: maxGlobalSeq + 1,
              daySequenceNumber: maxDaySeq + 1,
              name: String(updates.name || "Untitled Business").trim(),
              normalizedName: normalizeOrganizationName(updates.name || "Untitled Business"),
              websiteUrl: updates.websiteUrl || null,
              normalizedDomain: normDomain,
              country: updates.country || null,
              city: updates.city || null,
              market:
                updates.market ||
                (String(updates.country || "").toLowerCase() === "india"
                  ? "India"
                  : updates.country
                  ? "International"
                  : "India"),
              industry: updates.industry || initialCategories[0] || null,
              description: updates.description || null,
              observedFacts: updates.observedFacts || null,
              publishedContact: updates.publishedContact || null,
              contactEvidenceUrl: updates.contactEvidenceUrl || null,
              contactEvidenceValid: evCheck.isValid,
              contactEvidenceWarning: evCheck.warning,
              sourceLeadStatus: "manual",
              qualificationDecision: updates.qualificationDecision || "not reviewed",
              outreachApproval: updates.outreachApproval || "not approved",
              optOutStatus: "unknown",
              priorContactCheck: "not checked",
              verificationLevel:
                updates.verificationLevel || (normDomain ? "site description" : "unverified"),
              primaryPipelineId: DEFAULT_PIPELINE_ID,
              primaryStageId: updates.primaryStageId || "stg_new",
              categories: initialCategories,
              tags: updates.tags || [],
              score: updates.score ?? null,
              scoreIsManual: updates.score !== undefined && updates.score !== null,
              scoreMethod: updates.score !== undefined ? "manual" : "unscored",
              scoreBreakdown: updates.scoreBreakdown || {},
              nextAction: updates.nextAction || null,
              customValues: updates.customValues || {},
              createdAt: nowIso,
              updatedAt: nowIso,
              archivedAt: null,
            };

            state.organizations.unshift(newOrg);
            const colIds =
              Array.isArray(updates.collectionIds) && updates.collectionIds.length > 0
                ? updates.collectionIds
                : state.collections[0]
                ? [state.collections[0].id]
                : [];
            for (const colId of colIds) {
              state.memberships.push({
                id: uid("mem"),
                workspaceId: DEFAULT_WORKSPACE_ID,
                collectionId: colId,
                organizationId: newId,
                collectionCategories: newOrg.categories,
                stageId: newOrg.primaryStageId,
                customValues: newOrg.customValues,
                createdAt: nowIso,
                updatedAt: nowIso,
              });
            }
            if (updates.initialNote && String(updates.initialNote).trim()) {
              state.notes.unshift({
                id: uid("note"),
                workspaceId: DEFAULT_WORKSPACE_ID,
                organizationId: newId,
                content: String(updates.initialNote).trim(),
                isPinned: true,
                origin: "user",
                createdAt: nowIso,
                updatedAt: nowIso,
              });
            }
            state.activities.unshift({
              id: uid("act"),
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId: newId,
              actorOrigin: "user",
              activityType: "lead_created",
              title: `Lead #${formatLeadSequenceNumber(newOrg.sequenceNumber)} created in Local Browser Storage: ${newOrg.name}`,
              createdAt: nowIso,
            });

            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id: newId });
          }

          case "bulk_update_leads": {
            const { ids = [], operation, value } = payload;
            const idSet = new Set(ids);
            if (operation === "permanent_delete") {
              state.organizations = state.organizations.filter((o) => !idSet.has(o.id));
              state.memberships = state.memberships.filter((m) => !idSet.has(m.organizationId));
            } else {
              if (operation === "assign_category" && value) {
                const catName = String(value).trim();
                const hasCat = state.categories.some(
                  (c) => String(c.name || "").toLowerCase() === catName.toLowerCase()
                );
                if (!hasCat) {
                  state.categories.push({
                    id: uid("cat"),
                    workspaceId: DEFAULT_WORKSPACE_ID,
                    collectionId: null,
                    name: catName,
                    color: "#7958F5",
                    sortOrder: state.categories.length + 1,
                    createdAt: nowIso,
                  });
                }
              }

              for (const org of state.organizations) {
                if (!idSet.has(org.id)) continue;
                if (operation === "change_stage" && value) org.primaryStageId = value;
                else if (operation === "add_tag" && value) {
                  org.tags = Array.from(new Set([...(org.tags || []), String(value).trim()]));
                } else if (operation === "assign_category" && value) {
                  const catName = String(value).trim();
                  org.industry = catName;
                  org.categories = Array.from(new Set([catName, ...(org.categories || [])]));
                  for (const m of state.memberships) {
                    if (m.organizationId === org.id) {
                      m.collectionCategories = Array.from(
                        new Set([catName, ...(m.collectionCategories || [])])
                      );
                    }
                  }
                } else if (operation === "assign_day" && value) {
                  const dayVal = String(value).trim();
                  org.dayKey = dayVal;
                  org.discoveryDate = dayVal;
                } else if (operation === "set_qualification" && value) {
                  org.qualificationDecision = value;
                } else if (operation === "archive") {
                  org.archivedAt = nowIso;
                } else if (operation === "restore") {
                  org.archivedAt = null;
                } else if (operation === "assign_collection" && value) {
                  const exists = state.memberships.some(
                    (m) => m.collectionId === value && m.organizationId === org.id
                  );
                  if (!exists) {
                    state.memberships.push({
                      id: uid("mem"),
                      workspaceId: DEFAULT_WORKSPACE_ID,
                      collectionId: value,
                      organizationId: org.id,
                      collectionCategories: org.categories || [],
                      stageId: org.primaryStageId || "stg_new",
                      customValues: {},
                      createdAt: nowIso,
                      updatedAt: nowIso,
                    });
                  }
                } else if (operation === "remove_from_collection" && value) {
                  state.memberships = state.memberships.filter(
                    (m) => !(m.collectionId === value && idSet.has(m.organizationId))
                  );
                }
                org.updatedAt = nowIso;
              }
            }
            normalizeLeadNumberingAndDays(state);
            state.activities.unshift({
              id: uid("act"),
              workspaceId: DEFAULT_WORKSPACE_ID,
              actorOrigin: "user",
              activityType: "bulk_action",
              title: `Bulk action (${operation}) applied to ${ids.length} lead(s)`,
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, count: ids.length });
          }

          case "calculate_score": {
            const { organizationId, dimensionInputs = {}, collectionId, manualOverrideScore } =
              payload;
            const col = state.collections.find((c) => c.id === collectionId);
            const config: ScoringConfigJSON = col?.scoringConfig || DEFAULT_SCORING_CONFIG;
            const calc = calculateLeadScore(dimensionInputs, config);
            const isManual =
              manualOverrideScore !== undefined && manualOverrideScore !== null;
            const finalScore = isManual
              ? Math.max(0, Math.min(100, Math.round(Number(manualOverrideScore))))
              : calc.score;

            const org = state.organizations.find((o) => o.id === organizationId);
            if (org) {
              org.score = finalScore;
              org.scoreIsManual = isManual;
              org.scoreMethod = isManual ? "manual_override" : calc.method;
              org.scoreBreakdown = calc.normalizedBreakdown;
              org.scoreUpdatedAt = nowIso;
              org.updatedAt = nowIso;
            }
            for (const m of state.memberships) {
              if (m.organizationId === organizationId && (!collectionId || m.collectionId === collectionId)) {
                m.score = finalScore;
                m.scoreIsManual = isManual;
                m.scoreBreakdown = calc.normalizedBreakdown;
                m.updatedAt = nowIso;
              }
            }
            state.activities.unshift({
              id: uid("act"),
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId,
              actorOrigin: isManual ? "user" : "system",
              activityType: "score_updated",
              title: `Opportunity score updated to ${finalScore ?? "Unscored"}/100`,
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({
              ok: true,
              score: finalScore,
              isManual,
              breakdown: calc.normalizedBreakdown,
            });
          }

          case "create_collection": {
            const id = uid("col");
            const slug = String(payload.name || "collection")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-");
            state.collections.push({
              id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              name: String(payload.name).trim(),
              slug,
              description: payload.description || null,
              icon: payload.icon || "FolderKanban",
              color: payload.color || "#7958F5",
              recordType: payload.recordType || "company",
              defaultView: payload.defaultView || "table",
              defaultPipelineId: DEFAULT_PIPELINE_ID,
              scoringConfig: payload.scoringConfig || DEFAULT_SCORING_CONFIG,
              isPinned: true,
              isVisibleInSidebar: true,
              sortOrder: state.collections.length + 1,
              createdAt: nowIso,
              updatedAt: nowIso,
              archivedAt: null,
            });
            if (Array.isArray(payload.categories)) {
              payload.categories.forEach((catName: string, i: number) => {
                if (!catName.trim()) return;
                state.categories.push({
                  id: uid("cat"),
                  workspaceId: DEFAULT_WORKSPACE_ID,
                  collectionId: id,
                  name: catName.trim(),
                  color: payload.color || "#7958F5",
                  sortOrder: i + 1,
                  createdAt: nowIso,
                });
              });
            }
            if (Array.isArray(payload.customFields)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              payload.customFields.forEach((cf: any, i: number) => {
                if (!cf.name?.trim()) return;
                state.fieldDefinitions.push({
                  id: uid("fld"),
                  workspaceId: DEFAULT_WORKSPACE_ID,
                  collectionId: id,
                  name: cf.name.trim(),
                  key: cf.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                  fieldType: cf.fieldType || "text",
                  isRequired: Boolean(cf.isRequired),
                  isVisible: true,
                  sortOrder: i + 1,
                  options: cf.options || [],
                  createdAt: nowIso,
                  archivedAt: null,
                });
              });
            }
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id });
          }

          case "update_collection": {
            const col = state.collections.find((c) => c.id === payload.id);
            if (col) {
              if (payload.name !== undefined) col.name = payload.name;
              if (payload.description !== undefined) col.description = payload.description;
              if (payload.icon !== undefined) col.icon = payload.icon;
              if (payload.color !== undefined) col.color = payload.color;
              if (payload.defaultView !== undefined) col.defaultView = payload.defaultView;
              if (payload.isPinned !== undefined) col.isPinned = Boolean(payload.isPinned);
              if (payload.scoringConfig !== undefined) col.scoringConfig = payload.scoringConfig;
              if (payload.archived !== undefined) col.archivedAt = payload.archived ? nowIso : null;
              col.updatedAt = nowIso;
              saveLocalBrowserDB(state);
            }
            return jsonResponse({ ok: true });
          }

          case "duplicate_collection": {
            const src = state.collections.find((c) => c.id === payload.id);
            if (!src) return jsonResponse({ error: "Collection not found" }, 404);
            const newId = uid("col");
            state.collections.push({
              ...src,
              id: newId,
              name: `${src.name} (Copy)`,
              slug: `${src.slug}-copy`,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id: newId });
          }

          case "delete_collection": {
            state.memberships = state.memberships.filter((m) => m.collectionId !== payload.id);
            state.collections = state.collections.filter((c) => c.id !== payload.id);
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true });
          }

          case "create_custom_field": {
            const id = uid("fld");
            const key = String(payload.name)
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_");
            state.fieldDefinitions.push({
              id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              collectionId: payload.collectionId || null,
              name: String(payload.name).trim(),
              key,
              fieldType: payload.fieldType || "text",
              description: payload.description || null,
              defaultValue: payload.defaultValue || null,
              isRequired: Boolean(payload.isRequired),
              isVisible: true,
              sortOrder: state.fieldDefinitions.length + 1,
              options: Array.isArray(payload.options) ? payload.options : [],
              createdAt: nowIso,
              archivedAt: null,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id, key });
          }

          case "archive_custom_field": {
            const fld = state.fieldDefinitions.find((f) => f.id === payload.id);
            if (fld) fld.archivedAt = nowIso;
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true });
          }

          case "create_category": {
            const catName = String(payload.name || "").trim();
            if (!catName) return jsonResponse({ error: "Category name required" }, 400);
            const existingCat = state.categories.find(
              (c) =>
                String(c.name || "").toLowerCase() === catName.toLowerCase() &&
                (!payload.collectionId || !c.collectionId || c.collectionId === payload.collectionId)
            );
            const id = existingCat ? existingCat.id : uid("cat");
            if (!existingCat) {
              state.categories.push({
                id,
                workspaceId: DEFAULT_WORKSPACE_ID,
                collectionId: payload.collectionId || null,
                name: catName,
                color: payload.color || "#7958F5",
                sortOrder: state.categories.length + 1,
                createdAt: nowIso,
              });
            }
            if (Array.isArray(payload.organizationIds) && payload.organizationIds.length > 0) {
              const idSet = new Set(payload.organizationIds);
              for (const org of state.organizations) {
                if (!idSet.has(org.id)) continue;
                org.industry = catName;
                org.categories = Array.from(new Set([catName, ...(org.categories || [])]));
                org.updatedAt = nowIso;
              }
            }
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id, name: catName });
          }

          case "assign_lead_category": {
            const { organizationId, categoryName } = payload;
            const catName = String(categoryName || "").trim();
            const org = state.organizations.find((o) => o.id === organizationId);
            if (!org) return jsonResponse({ error: "Lead not found" }, 404);
            if (catName) {
              const hasCat = state.categories.some(
                (c) => String(c.name || "").toLowerCase() === catName.toLowerCase()
              );
              if (!hasCat) {
                state.categories.push({
                  id: uid("cat"),
                  workspaceId: DEFAULT_WORKSPACE_ID,
                  collectionId: payload.collectionId || null,
                  name: catName,
                  color: "#7958F5",
                  sortOrder: state.categories.length + 1,
                  createdAt: nowIso,
                });
              }
              org.industry = catName;
              org.categories = Array.from(new Set([catName, ...(org.categories || [])]));
              for (const m of state.memberships) {
                if (m.organizationId === organizationId) {
                  m.collectionCategories = Array.from(
                    new Set([catName, ...(m.collectionCategories || [])])
                  );
                }
              }
            }
            org.updatedAt = nowIso;
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, categoryName: catName });
          }

          case "create_day_slot": {
            const dayKey = String(payload.dayKey || nowIso.split("T")[0]).trim();
            const label = String(payload.label || `Daily Spreadsheet (${dayKey})`).trim();
            if (!Array.isArray(state.days)) state.days = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existingDay = state.days.find((d: Record<string, any>) => d.dayKey === dayKey);
            if (existingDay) {
              existingDay.label = label;
              existingDay.updatedAt = nowIso;
            } else {
              state.days.push({
                id: uid("day"),
                workspaceId: DEFAULT_WORKSPACE_ID,
                dayKey,
                label,
                createdAt: nowIso,
                updatedAt: nowIso,
              });
            }
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, dayKey, label });
          }

          case "deduplicate_and_disambiguate_leads": {
            const report = deduplicateAndDisambiguateWorkspaceState(state);
            normalizeLeadNumberingAndDays(state);
            state.activities.unshift({
              id: uid("act"),
              workspaceId: DEFAULT_WORKSPACE_ID,
              actorOrigin: "user",
              activityType: "deduplication_script",
              title: `Deduplication & Code Script: ${report.erasedCount} duplicate(s) erased, ${report.disambiguatedCount} number collision(s) assigned A/B/C codes`,
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, report });
          }

          case "delete_category": {
            state.categories = state.categories.filter((c) => c.id !== payload.id && c.name !== payload.name);
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true });
          }

          case "create_tag": {
            const id = uid("tag");
            state.tags.push({
              id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              name: String(payload.name).trim(),
              color: payload.color || "#659BFA",
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id });
          }

          case "upsert_opportunity": {
            if (payload.id) {
              const idx = state.opportunities.findIndex((o) => o.id === payload.id);
              if (idx !== -1) {
                state.opportunities[idx] = {
                  ...state.opportunities[idx],
                  ...payload,
                  updatedAt: nowIso,
                };
              }
              saveLocalBrowserDB(state);
              return jsonResponse({ ok: true, id: payload.id });
            }
            const newId = uid("opp");
            state.opportunities.unshift({
              id: newId,
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId: payload.organizationId,
              collectionId: payload.collectionId || null,
              primaryContactId: payload.primaryContactId || null,
              name: String(payload.name).trim(),
              serviceType: payload.serviceType || "Website Development",
              description: payload.description || null,
              pipelineId: payload.pipelineId || DEFAULT_PIPELINE_ID,
              stageId: payload.stageId || "stg_new",
              estimatedValue: payload.estimatedValue ? String(payload.estimatedValue) : null,
              currency: payload.currency || "INR",
              probability: payload.probability ? Number(payload.probability) : null,
              priority: payload.priority || "medium",
              expectedCloseDate: payload.expectedCloseDate || null,
              nextAction: payload.nextAction || null,
              notes: payload.notes || null,
              outcome: payload.outcome || "open",
              createdAt: nowIso,
              updatedAt: nowIso,
            });
            state.activities.unshift({
              id: uid("act"),
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId: payload.organizationId,
              opportunityId: newId,
              actorOrigin: "user",
              activityType: "opportunity_created",
              title: `Opportunity created: ${String(payload.name).trim()}`,
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id: newId });
          }

          case "upsert_contact": {
            if (payload.id) {
              const idx = state.contacts.findIndex((c) => c.id === payload.id);
              if (idx !== -1) {
                state.contacts[idx] = {
                  ...state.contacts[idx],
                  ...payload,
                  updatedAt: nowIso,
                };
              }
              saveLocalBrowserDB(state);
              return jsonResponse({ ok: true, id: payload.id });
            }
            const newId = uid("cnt");
            state.contacts.unshift({
              id: newId,
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId: payload.organizationId || null,
              fullName: String(payload.fullName).trim(),
              jobTitle: payload.jobTitle || null,
              department: payload.department || null,
              email: payload.email || null,
              phone: payload.phone || null,
              linkedinUrl: payload.linkedinUrl || null,
              preferredChannel: payload.preferredChannel || null,
              country: payload.country || null,
              city: payload.city || null,
              notes: payload.notes || null,
              doNotContact: Boolean(payload.doNotContact),
              optOutRecorded: Boolean(payload.doNotContact),
              approvalStatus: payload.doNotContact ? "suppressed" : payload.approvalStatus || "not approved",
              createdAt: nowIso,
              updatedAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id: newId });
          }

          case "add_suppression": {
            const id = uid("dnc");
            const normDom = normalizeDomain(payload.businessOrDomain);
            state.suppressions.unshift({
              id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              businessOrDomain: String(payload.businessOrDomain).trim(),
              normalizedDomain: normDom,
              contactOrChannel: payload.contactOrChannel || null,
              optOutDate: nowIso.split("T")[0],
              reasonOrSource: payload.reasonOrSource || "Manual user exclusion",
              status: "Do Not Contact",
              notes: payload.notes || null,
              createdAt: nowIso,
            });
            if (normDom) {
              for (const org of state.organizations) {
                if (org.normalizedDomain === normDom) {
                  org.optOutStatus = "opted out / suppressed";
                  org.outreachApproval = "do not contact";
                  org.updatedAt = nowIso;
                }
              }
            }
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id });
          }

          case "add_note": {
            const id = uid("note");
            state.notes.unshift({
              id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId: payload.organizationId || null,
              opportunityId: payload.opportunityId || null,
              contactId: payload.contactId || null,
              content: String(payload.content).trim(),
              isPinned: Boolean(payload.isPinned),
              origin: "user",
              createdAt: nowIso,
              updatedAt: nowIso,
            });
            state.activities.unshift({
              id: uid("act"),
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId: payload.organizationId || null,
              actorOrigin: "user",
              activityType: "note_added",
              title: "Note added to record",
              description: String(payload.content).trim().slice(0, 140),
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id });
          }

          case "toggle_pin_note": {
            const note = state.notes.find((n) => n.id === payload.id);
            if (note) {
              note.isPinned = Boolean(payload.isPinned);
              note.updatedAt = nowIso;
              saveLocalBrowserDB(state);
            }
            return jsonResponse({ ok: true });
          }

          case "delete_note": {
            state.notes = state.notes.filter((n) => n.id !== payload.id);
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true });
          }

          case "upsert_task": {
            if (payload.id) {
              const idx = state.tasks.findIndex((t) => t.id === payload.id);
              if (idx !== -1) {
                state.tasks[idx] = {
                  ...state.tasks[idx],
                  ...payload,
                  completedAt: payload.status === "Completed" ? nowIso : null,
                  updatedAt: nowIso,
                };
              }
              saveLocalBrowserDB(state);
              return jsonResponse({ ok: true, id: payload.id });
            }
            const newId = uid("tsk");
            const resolvedDate = payload.dueDate || nowIso.split("T")[0];
            state.tasks.unshift({
              id: newId,
              workspaceId: DEFAULT_WORKSPACE_ID,
              title: String(payload.title).trim(),
              description: payload.description || null,
              taskType: payload.taskType || "Follow-up",
              organizationId: payload.organizationId || null,
              opportunityId: payload.opportunityId || null,
              contactId: payload.contactId || null,
              collectionId: payload.collectionId || null,
              priority: payload.priority || "medium",
              status: payload.status || "To Do",
              dueDate: resolvedDate,
              dueTime: payload.dueTime || null,
              reminderSetting: payload.reminderSetting || "day_of",
              notes: payload.notes || null,
              completedAt: null,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
            if (payload.organizationId) {
              const org = state.organizations.find((o) => o.id === payload.organizationId);
              if (org) {
                org.nextAction = String(payload.title).trim();
                org.nextFollowUpAt = `${resolvedDate}T${payload.dueTime || "10:00"}:00Z`;
                org.updatedAt = nowIso;
              }
            }
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id: newId });
          }

          case "toggle_task_status": {
            const t = state.tasks.find((item) => item.id === payload.id);
            if (!t) return jsonResponse({ error: "Task not found" }, 404);
            const nextStatus = payload.status || (t.status === "Completed" ? "To Do" : "Completed");
            t.status = nextStatus;
            t.completedAt = nextStatus === "Completed" ? nowIso : null;
            t.updatedAt = nowIso;
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, status: nextStatus });
          }

          case "log_manual_activity": {
            const id = uid("act");
            state.activities.unshift({
              id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId: payload.organizationId || null,
              contactId: payload.contactId || null,
              opportunityId: payload.opportunityId || null,
              actorOrigin: "user",
              activityType: payload.activityType || "manual_log",
              title: `[Manually Logged] ${payload.title}`,
              description: payload.description || null,
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id });
          }

          case "add_attachment": {
            const id = uid("att");
            state.attachments.unshift({
              id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId: payload.organizationId,
              filename: String(payload.filename),
              mimeType: String(payload.mimeType || "application/octet-stream"),
              sizeBytes: Number(payload.sizeBytes || 0),
              category: payload.category || "Document",
              dataUrl: String(payload.dataUrl),
              notes: payload.notes || null,
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id });
          }

          case "upsert_reference": {
            if (payload.id) {
              const idx = state.references.findIndex((r) => r.id === payload.id);
              if (idx !== -1) state.references[idx] = { ...state.references[idx], ...payload };
              saveLocalBrowserDB(state);
              return jsonResponse({ ok: true, id: payload.id });
            }
            const newId = uid("ref");
            state.references.unshift({
              id: newId,
              workspaceId: DEFAULT_WORKSPACE_ID,
              title: String(payload.title).trim(),
              url: String(payload.url).trim(),
              description: payload.description || null,
              category: payload.category || "For Reference",
              tags: Array.isArray(payload.tags) ? payload.tags : [],
              screenshotUrl: payload.screenshotUrl || null,
              notes: payload.notes || null,
              organizationId: payload.organizationId || null,
              opportunityId: payload.opportunityId || null,
              collectionId: payload.collectionId || null,
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id: newId });
          }

          case "delete_reference": {
            state.references = state.references.filter((r) => r.id !== payload.id);
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true });
          }

          case "toggle_bookmark_inspiration": {
            const orgId = payload.organizationId;
            const org = state.organizations.find((o) => o.id === orgId);
            if (!org) return jsonResponse({ error: "Lead not found" }, 404);
            const existingRefIdx = state.references.findIndex(
              (r) => r.organizationId === orgId && r.category === "Design Inspiration"
            );
            if (existingRefIdx !== -1) {
              state.references.splice(existingRefIdx, 1);
              org.isBookmarked = false;
              org.updatedAt = nowIso;
              saveLocalBrowserDB(state);
              return jsonResponse({ ok: true, isBookmarked: false });
            } else {
              const newRefId = uid("ref");
              const targetUrl = org.websiteUrl
                ? org.websiteUrl.startsWith("http")
                  ? org.websiteUrl
                  : `https://${org.websiteUrl}`
                : org.sourceUrl || `https://${org.normalizedDomain || "example.com"}`;
              state.references.unshift({
                id: newRefId,
                workspaceId: DEFAULT_WORKSPACE_ID,
                title: `${org.name} — Bookmarked Website & Design Inspiration`,
                url: targetUrl,
                screenshotUrl: payload.screenshotUrl || null,
                category: "Design Inspiration",
                description:
                  org.observedFacts ||
                  `Bookmarked website inspiration from ${org.name} (${org.industry || "General"}, ${org.country || "Global"}).`,
                tags: ["Bookmarked Website", org.industry || "Inspiration"].filter(Boolean),
                organizationId: org.id,
                createdAt: nowIso,
              });
              org.isBookmarked = true;
              org.updatedAt = nowIso;
              state.activities.unshift({
                id: uid("act"),
                workspaceId: DEFAULT_WORKSPACE_ID,
                organizationId: org.id,
                actorOrigin: "user",
                activityType: "bookmarked_inspiration",
                title: `Bookmarked ${org.name} website to Design Inspirations`,
                createdAt: nowIso,
              });
              saveLocalBrowserDB(state);
              return jsonResponse({ ok: true, isBookmarked: true, referenceId: newRefId });
            }
          }

          case "record_message_operation": {
            const orgId = payload.organizationId;
            const org = state.organizations.find((o) => o.id === orgId);
            if (!org) return jsonResponse({ error: "Lead not found" }, 404);
            const messageStatus = payload.messageStatus || "message_sent";
            const channel = payload.channel || "Outreach Message";
            const note = payload.note ? String(payload.note).trim() : null;

            org.messageStatus = messageStatus;
            org.lastMessageChannel = channel;
            if (messageStatus !== "not_messaged") {
              org.lastMessagedAt = nowIso;
              org.lastContactedAt = nowIso;
            }
            if (note) {
              org.lastMessageNote = note;
            }

            if (messageStatus === "message_sent" || messageStatus === "followup_sent") {
              if (!org.primaryStageId || org.primaryStageId === "stg_new" || org.primaryStageId === "stg_researching" || org.primaryStageId === "stg_qualified") {
                org.primaryStageId = "stg_contacted";
              }
              org.nextAction =
                messageStatus === "message_sent"
                  ? "Follow up on sent message"
                  : "Await prospect reply";
            } else if (messageStatus === "replied") {
              org.primaryStageId = "stg_replied";
              org.nextAction = "Schedule discovery call / send proposal";
            }
            org.updatedAt = nowIso;

            const statusLabels: Record<string, string> = {
              not_messaged: "Reset message status to Not Messaged",
              message_sent: `Message sent via ${channel}`,
              followup_sent: `Follow-up message sent via ${channel}`,
              replied: `Prospect replied via ${channel}`,
            };

            state.activities.unshift({
              id: uid("act"),
              workspaceId: DEFAULT_WORKSPACE_ID,
              organizationId: org.id,
              actorOrigin: "user",
              activityType: "outreach_message",
              title: statusLabels[messageStatus] || `Message operation: ${messageStatus}`,
              description: note || `Outreach status updated for ${org.name}`,
              createdAt: nowIso,
            });

            if (note) {
              state.notes.unshift({
                id: uid("note"),
                workspaceId: DEFAULT_WORKSPACE_ID,
                organizationId: org.id,
                content: `[${channel}] ${note}`,
                isPinned: false,
                origin: "user",
                createdAt: nowIso,
                updatedAt: nowIso,
              });
            }

            saveLocalBrowserDB(state);
            return jsonResponse({
              ok: true,
              messageStatus: org.messageStatus,
              lastMessagedAt: org.lastMessagedAt,
              primaryStageId: org.primaryStageId,
            });
          }

          case "upsert_content_idea": {
            if (payload.id) {
              const idx = state.contentIdeas.findIndex((c) => c.id === payload.id);
              if (idx !== -1) {
                state.contentIdeas[idx] = {
                  ...state.contentIdeas[idx],
                  ...payload,
                  updatedAt: nowIso,
                };
              }
              saveLocalBrowserDB(state);
              return jsonResponse({ ok: true, id: payload.id });
            }
            const newId = uid("cid");
            state.contentIdeas.unshift({
              id: newId,
              workspaceId: DEFAULT_WORKSPACE_ID,
              title: String(payload.title).trim(),
              hook: payload.hook || null,
              description: payload.description || null,
              platform: payload.platform || "Instagram Reels",
              contentType: payload.contentType || "Website Audit / Breakdown",
              organizationId: payload.organizationId || null,
              referenceId: payload.referenceId || null,
              category: payload.category || "Good Reel",
              priority: payload.priority || "medium",
              status: payload.status || "Idea",
              notes: payload.notes || null,
              targetPublicationDate: payload.targetPublicationDate || null,
              publishedUrl: payload.publishedUrl || null,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id: newId });
          }

          case "save_view": {
            const id = uid("view");
            state.savedViews.push({
              id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              collectionId: payload.collectionId || null,
              name: String(payload.name).trim(),
              filters: payload.filters || {},
              sortConfig: payload.sortConfig || {},
              visibleColumns: payload.visibleColumns || [],
              viewMode: payload.viewMode || "table",
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id });
          }

          case "delete_saved_view": {
            state.savedViews = state.savedViews.filter((v) => v.id !== payload.id);
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true });
          }

          case "save_mapping_template": {
            const id = uid("map");
            state.savedMappings.push({
              id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              name: String(payload.name).trim(),
              mapping: payload.mapping || {},
              createdAt: nowIso,
            });
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true, id });
          }

          case "update_workspace_settings": {
            state.workspace = {
              ...state.workspace,
              ...payload,
              updatedAt: nowIso,
            };
            saveLocalBrowserDB(state);
            return jsonResponse({ ok: true });
          }

          case "reset_to_empty_workspace": {
            const emptyState = buildDefaultLocalBrowserDB();
            saveLocalBrowserDB(emptyState);
            return jsonResponse({ ok: true });
          }

          case "restore_json_backup": {
            if (payload.backupData && Array.isArray(payload.backupData.organizations)) {
              const nextState: LocalWorkspaceDB = {
                ...buildDefaultLocalBrowserDB(),
                ...payload.backupData,
                version: 2,
                lastSavedAt: nowIso,
              };
              saveLocalBrowserDB(nextState);
              return jsonResponse({ ok: true, leadCount: nextState.organizations.length });
            }
            return jsonResponse({ error: "Invalid JSON backup file" }, 400);
          }

          default:
            return jsonResponse({ ok: true });
        }
      }
    }

    // 2. Intercept /api/import (100% Local Browser Storage spreadsheet import & rollback)
    if (pathname === "/api/import" && method === "POST") {
      try {
        const state = loadLocalBrowserDB();
        let mode = "inspect";
        let filename = "spreadsheet.xlsx";
        let arrayBuffer: ArrayBuffer | null = null;
        let selectedSheet = "Leads";
        let collectionId = state.collections[0]?.id || GLOBAL_ECOM_COLLECTION_ID;
        let mapping: Record<string, string> = {};
        let duplicatePolicy = "fill_blanks";
        let batchId: string | undefined;
        let targetDayKey: string | undefined;
        let targetCategory: string | undefined;

        if (init?.body instanceof FormData) {
          const formData = init.body;
          mode = String(formData.get("mode") || "inspect");
          const file = formData.get("file") as File | null;
          if (file) {
            filename = file.name;
            arrayBuffer = await file.arrayBuffer();
          }
          if (formData.get("selectedSheet")) selectedSheet = String(formData.get("selectedSheet"));
          if (formData.get("collectionId")) collectionId = String(formData.get("collectionId"));
          if (formData.get("mapping")) mapping = JSON.parse(String(formData.get("mapping")));
          if (formData.get("duplicatePolicy")) duplicatePolicy = String(formData.get("duplicatePolicy"));
          if (formData.get("dayKey")) targetDayKey = String(formData.get("dayKey")).trim() || undefined;
          if (formData.get("category")) targetCategory = String(formData.get("category")).trim() || undefined;
        } else if (init?.body) {
          const body = JSON.parse(String(init.body));
          mode = body.mode || "inspect";
          selectedSheet = body.selectedSheet || "Leads";
          collectionId = body.collectionId || state.collections[0]?.id || GLOBAL_ECOM_COLLECTION_ID;
          mapping = body.mapping || {};
          duplicatePolicy = body.duplicatePolicy || "fill_blanks";
          batchId = body.batchId;
          targetDayKey = body.dayKey ? String(body.dayKey).trim() : undefined;
          targetCategory = body.category ? String(body.category).trim() : undefined;

          if (body.fileBase64 && body.filename) {
            filename = String(body.filename);
            const binary = window.atob(String(body.fileBase64));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            arrayBuffer = bytes.buffer;
          }
        }

        if (mode === "rollback") {
          const batch = state.importBatches.find((b) => b.id === batchId);
          if (!batch) return jsonResponse({ error: "Import batch not found" }, 404);
          const createdIds: string[] = batch.createdOrganizationIds || [];
          let deletedCount = 0;
          let preservedCount = 0;
          for (const orgId of createdIds) {
            const org = state.organizations.find((o) => o.id === orgId);
            if (!org) continue;
            const hasUserEdits =
              org.scoreIsManual ||
              state.notes.some((n) => n.organizationId === orgId) ||
              state.tasks.some((t) => t.organizationId === orgId) ||
              state.opportunities.some((o) => o.organizationId === orgId);
            if (hasUserEdits) {
              preservedCount++;
            } else {
              state.organizations = state.organizations.filter((o) => o.id !== orgId);
              state.memberships = state.memberships.filter((m) => m.organizationId !== orgId);
              deletedCount++;
            }
          }
          batch.status = "rolled_back";
          saveLocalBrowserDB(state);
          return jsonResponse({
            ok: true,
            status: "rolled_back",
            deletedCount,
            preservedCount,
          });
        }

        if (!arrayBuffer) {
          return jsonResponse({ error: "Please choose an .xlsx or .csv file from your device." }, 400);
        }

        const { inspection, sheetRowsMap } = await parseBrowserSpreadsheet(arrayBuffer, filename);

        if (mode === "inspect") {
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          return jsonResponse({
            ok: true,
            inspection,
            fileBase64: window.btoa(binary),
          });
        }

        if (mode === "quick_import") {
          const primaryLeadSheet =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            inspection.sheets?.find((s: any) => s.sheetRole === "leads") ||
            inspection.sheets?.[0];
          if (primaryLeadSheet) {
            selectedSheet = primaryLeadSheet.name;
            mapping = primaryLeadSheet.suggestedMapping || {};
          }
        }

        const preview = previewLocalSpreadsheetImport(
          state,
          sheetRowsMap,
          filename,
          selectedSheet,
          mapping
        );

        if (mode === "preview") {
          return jsonResponse({ ok: true, preview });
        }

        if (mode === "execute" || mode === "quick_import") {
          const nowIso = new Date().toISOString();
          const newBatchId = uid("imp");
          let newRecordsCreated = 0;
          let existingMatched = 0;
          let recordsUpdated = 0;
          let duplicatesSkipped = 0;
          const createdOrganizationIds: string[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const warningsSummary: Array<Record<string, any>> = [];

          let maxGlobalSeq = state.organizations.reduce(
            (acc, o) => Math.max(acc, typeof o.sequenceNumber === "number" ? o.sequenceNumber : 0),
            0
          );
          const perDayMaxSeq: Record<string, number> = {};
          for (const o of state.organizations) {
            const dk = o.dayKey || o.discoveryDate || nowIso.split("T")[0];
            const dSeq = typeof o.daySequenceNumber === "number" ? o.daySequenceNumber : 0;
            if (dSeq > (perDayMaxSeq[dk] || 0)) {
              perDayMaxSeq[dk] = dSeq;
            }
          }

          if (targetCategory) {
            const hasCat = state.categories.some(
              (c) => String(c.name || "").toLowerCase() === targetCategory!.toLowerCase()
            );
            if (!hasCat) {
              state.categories.push({
                id: uid("cat"),
                workspaceId: DEFAULT_WORKSPACE_ID,
                collectionId,
                name: targetCategory,
                color: "#7958F5",
                sortOrder: state.categories.length + 1,
                createdAt: nowIso,
              });
            }
          }

          // Collect newly created organizations in spreadsheet row order (001, 002, 003...)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newlyCreatedOrgs: Array<Record<string, any>> = [];
          let resolvedBatchDayKey = targetDayKey || nowIso.split("T")[0];

          for (const row of preview.rows) {
            if (row.status === "invalid") continue;
            const m = row.mappedData;
            for (const w of row.warnings) {
              warningsSummary.push({
                rowNumber: row.rowNumber,
                externalId: m.externalId,
                business: m.name,
                field: w.field,
                value: w.value,
                message: w.message,
              });
            }

            const rowDayKey = targetDayKey || m.discoveryDate || nowIso.split("T")[0];
            resolvedBatchDayKey = rowDayKey;
            const rowCategories = Array.from(
              new Set([targetCategory, m.industry].filter(Boolean) as string[])
            );

            if (row.matchedOrganizationId) {
              existingMatched++;
              if (duplicatePolicy === "skip_existing") {
                duplicatesSkipped++;
                continue;
              }
              const existingOrg = state.organizations.find((o) => o.id === row.matchedOrganizationId);
              if (existingOrg && duplicatePolicy !== "keep_existing") {
                recordsUpdated++;
                if (duplicatePolicy === "use_imported") {
                  existingOrg.industry = targetCategory || m.industry || existingOrg.industry;
                  existingOrg.observedFacts = m.observedFacts || existingOrg.observedFacts;
                  existingOrg.publishedContact = m.publishedContact || existingOrg.publishedContact;
                } else {
                  if (!existingOrg.industry && (targetCategory || m.industry))
                    existingOrg.industry = targetCategory || m.industry;
                  if (!existingOrg.observedFacts && m.observedFacts)
                    existingOrg.observedFacts = m.observedFacts;
                  if (!existingOrg.publishedContact && m.publishedContact)
                    existingOrg.publishedContact = m.publishedContact;
                }
                if (targetDayKey) {
                  existingOrg.dayKey = targetDayKey;
                  existingOrg.discoveryDate = targetDayKey;
                }
                if (rowCategories.length > 0) {
                  existingOrg.categories = Array.from(
                    new Set([...rowCategories, ...(existingOrg.categories || [])])
                  );
                }
                existingOrg.updatedAt = nowIso;
              }
              const hasMem = state.memberships.some(
                (mem) =>
                  mem.collectionId === collectionId &&
                  mem.organizationId === row.matchedOrganizationId
              );
              if (!hasMem) {
                state.memberships.push({
                  id: uid("mem"),
                  workspaceId: DEFAULT_WORKSPACE_ID,
                  collectionId,
                  organizationId: row.matchedOrganizationId,
                  collectionCategories: rowCategories,
                  stageId: "stg_new",
                  customValues: m.customValues || {},
                  createdAt: nowIso,
                  updatedAt: nowIso,
                });
              }
            } else {
              const newOrgId = uid("org");
              newRecordsCreated++;
              createdOrganizationIds.push(newOrgId);
              maxGlobalSeq += 1;
              perDayMaxSeq[rowDayKey] = (perDayMaxSeq[rowDayKey] || 0) + 1;

              newlyCreatedOrgs.push({
                id: newOrgId,
                workspaceId: DEFAULT_WORKSPACE_ID,
                externalId: m.externalId,
                dayKey: rowDayKey,
                discoveryDate: rowDayKey,
                sequenceNumber: maxGlobalSeq,
                daySequenceNumber: perDayMaxSeq[rowDayKey],
                name: m.name,
                normalizedName: normalizeOrganizationName(m.name),
                websiteUrl: m.websiteUrl,
                normalizedDomain: m.normalizedDomain,
                market: m.market || (String(m.country || "").toLowerCase() === "india" ? "India" : "International"),
                country: m.country,
                city: m.city,
                industry: targetCategory || m.industry,
                description: m.observedFacts,
                observedFacts: m.observedFacts,
                sourceUrl: m.sourceUrl,
                publishedContact: m.publishedContact,
                contactEvidenceUrl: m.contactEvidenceUrl,
                contactEvidenceValid: m.contactEvidenceValid,
                contactEvidenceWarning: m.contactEvidenceWarning,
                sourceLeadStatus: m.sourceLeadStatus || "candidate",
                qualificationDecision: m.qualificationDecision || "not reviewed",
                outreachApproval: m.outreachApproval || "not approved",
                optOutStatus: m.optOutStatus || "unknown",
                priorContactCheck: m.priorContactCheck || "not checked",
                verificationLevel: m.verificationLevel || "unverified",
                sourceNotes: m.sourceNotes,
                primaryPipelineId: DEFAULT_PIPELINE_ID,
                primaryStageId: "stg_new",
                categories: rowCategories,
                tags: [],
                customValues: m.customValues || {},
                score: null,
                scoreIsManual: false,
                scoreMethod: "unscored",
                scoreBreakdown: {},
                createdAt: nowIso,
                updatedAt: nowIso,
                archivedAt: null,
              });
              state.memberships.push({
                id: uid("mem"),
                workspaceId: DEFAULT_WORKSPACE_ID,
                collectionId,
                organizationId: newOrgId,
                collectionCategories: rowCategories,
                stageId: "stg_new",
                customValues: m.customValues || {},
                createdAt: nowIso,
                updatedAt: nowIso,
              });
              state.sourceRecords.push({
                id: uid("src"),
                workspaceId: DEFAULT_WORKSPACE_ID,
                importBatchId: newBatchId,
                organizationId: newOrgId,
                sourceFilename: filename,
                sheetName: selectedSheet,
                rowNumber: row.rowNumber,
                externalId: m.externalId,
                rawValues: row.rawValues,
                validationWarnings: row.warnings.map((w: { message: string }) => w.message),
                importedAt: nowIso,
              });
            }
          }

          if (newlyCreatedOrgs.length > 0) {
            state.organizations = [...newlyCreatedOrgs, ...state.organizations];
          }
          normalizeLeadNumberingAndDays(state);

          const batchRecord = {
            id: newBatchId,
            workspaceId: DEFAULT_WORKSPACE_ID,
            collectionId,
            dayKey: resolvedBatchDayKey,
            filename,
            fileFormat: filename.toLowerCase().endsWith(".csv") ? "csv" : "xlsx",
            selectedSheet,
            totalRows: preview.totalRows,
            totalRowsRead: preview.totalRows,
            newRecordsCreated,
            existingMatched,
            recordsUpdated,
            duplicatesSkipped,
            rowsRequiringReview: warningsSummary.length,
            validationWarningsCount: warningsSummary.length,
            failedRowsCount: preview.invalidCount,
            duplicatePolicy,
            mappingConfig: mapping,
            warningsSummary,
            runLogProvenance: preview.runLogRows,
            suppressionRowsCount: preview.suppressionRows?.length || 0,
            createdOrganizationIds,
            status: "completed",
            createdAt: nowIso,
          };

          state.importBatches.unshift(batchRecord);
          state.activities.unshift({
            id: uid("act"),
            workspaceId: DEFAULT_WORKSPACE_ID,
            collectionId,
            actorOrigin: "import",
            activityType: "lead_imported",
            title: `${newRecordsCreated} new leads imported (${existingMatched} matched) from ${filename} for Day ${resolvedBatchDayKey}`,
            createdAt: nowIso,
          });
          saveLocalBrowserDB(state);
          return jsonResponse({ ok: true, batch: batchRecord });
        }
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : "Local spreadsheet import failed" },
          500
        );
      }
    }

    // 3. Intercept /api/export (100% Local Browser Storage export)
    if (pathname === "/api/export" && method === "GET") {
      const state = loadLocalBrowserDB();
      const format = parsedUrl.searchParams.get("format") || "csv";
      if (format === "workspace_backup_json") {
        return new Response(JSON.stringify(state, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="jayant-crm-local-storage-backup.json"`,
          },
        });
      }
      const { rows } = queryLocalLeadsPaginated(state, parsedUrl.searchParams);
      if (format === "json") {
        return new Response(JSON.stringify(rows, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }
      const headers = [
        "Lead ID",
        "Company Name",
        "Website",
        "Normalized Domain",
        "Market",
        "Country",
        "Niche / Industry",
        "Score",
        "Pipeline Stage ID",
        "Source Lead Status",
        "Qualification Decision",
        "Outreach Approval",
        "Verification Level",
        "Published Contact",
        "Contact Evidence URL",
        "Observed Facts",
      ];
      const toCsv = (cells: unknown[]) =>
        cells
          .map((c) => {
            const s = sanitizeSpreadsheetCell(c);
            return s.includes(",") || s.includes('"') || s.includes("\n")
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(",");
      const csv = [
        toCsv(headers),
        ...rows.map((r) =>
          toCsv([
            r.externalId || r.id,
            r.name,
            r.websiteUrl || "",
            r.normalizedDomain || "",
            r.market || "",
            r.country || "",
            r.industry || "",
            r.effectiveScore ?? "",
            r.primaryStageId || "",
            r.sourceLeadStatus || "",
            r.qualificationDecision || "",
            r.outreachApproval || "",
            r.verificationLevel || "",
            r.publishedContact || "",
            r.contactEvidenceUrl || "",
            r.observedFacts || "",
          ])
        ),
      ].join("\n");
      return new Response(csv, {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      });
    }

    return nativeFetch(input, init);
  };
}

export function triggerLocalBrowserFileDownload(
  format: "csv" | "json" | "workspace_backup_json",
  collectionId?: string
): void {
  const state = loadLocalBrowserDB();
  const dateStr = new Date().toISOString().split("T")[0];

  if (format === "workspace_backup_json") {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jayant-crm-browser-storage-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const sp = new URLSearchParams({ pageSize: "5000" });
  if (collectionId) sp.set("collectionId", collectionId);
  const { rows } = queryLocalLeadsPaginated(state, sp);

  if (format === "json") {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jayant-crm-leads-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const headers = [
    "Lead ID",
    "Company Name",
    "Website",
    "Normalized Domain",
    "Market",
    "Country",
    "Niche / Industry",
    "Score",
    "Pipeline Stage ID",
    "Source Lead Status",
    "Qualification Decision",
    "Outreach Approval",
    "Verification Level",
    "Published Contact",
    "Contact Evidence URL",
    "Observed Facts",
  ];
  const toCsv = (cells: unknown[]) =>
    cells
      .map((c) => {
        const s = sanitizeSpreadsheetCell(c);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      })
      .join(",");
  const csv = [
    toCsv(headers),
    ...rows.map((r) =>
      toCsv([
        r.externalId || r.id,
        r.name,
        r.websiteUrl || "",
        r.normalizedDomain || "",
        r.market || "",
        r.country || "",
        r.industry || "",
        r.effectiveScore ?? "",
        r.primaryStageId || "",
        r.sourceLeadStatus || "",
        r.qualificationDecision || "",
        r.outreachApproval || "",
        r.verificationLevel || "",
        r.publishedContact || "",
        r.contactEvidenceUrl || "",
        r.observedFacts || "",
      ])
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jayant-crm-leads-${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
