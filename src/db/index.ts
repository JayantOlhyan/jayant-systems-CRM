import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

export type AppDatabase = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

export const DEFAULT_WORKSPACE_ID = "ws_jayant_main";
export const DEFAULT_USER_ID = "usr_jayant_admin";
export const DEFAULT_PIPELINE_ID = "pipe_sales_main";
export const GLOBAL_ECOM_COLLECTION_ID = "col_global_ecommerce";

export const DEFAULT_SCORING_CONFIG: schema.ScoringConfigJSON = {
  version: 1,
  highThreshold: 75,
  mediumThreshold: 50,
  missingValuePolicy: "unscored",
  dimensions: [
    {
      key: "website_opportunity",
      label: "Website Improvement Opportunity",
      weight: 25,
      description: "Visual, UX, speed, or conversion gaps on current site",
    },
    {
      key: "business_fit",
      label: "Business Fit",
      weight: 25,
      description: "Alignment with Jayant Web & AI Systems capabilities",
    },
    {
      key: "potential_value",
      label: "Potential Deal Value",
      weight: 20,
      description: "Estimated commercial budget and project scope",
    },
    {
      key: "accessibility",
      label: "Contact Accessibility",
      weight: 15,
      description: "Availability of verified decision-maker or business contact",
    },
    {
      key: "urgency",
      label: "Urgency",
      weight: 15,
      description: "Near-term need for web/AI/automation upgrade",
    },
  ],
};

export function hashPassword(password: string): string {
  const salt = "jayant_crm_salt_v1";
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Jayant Web & AI Systems',
  default_currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  date_format TEXT NOT NULL DEFAULT 'DD MMM YYYY',
  theme TEXT NOT NULL DEFAULT 'dark',
  default_landing_page TEXT NOT NULL DEFAULT '/dashboard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT 'Jayant Olhyan',
  role_title TEXT NOT NULL DEFAULT 'Founder',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#659BFA',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  classification TEXT NOT NULL DEFAULT 'open',
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_reminder_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'ShoppingBag',
  color TEXT NOT NULL DEFAULT '#7958F5',
  record_type TEXT NOT NULL DEFAULT 'company',
  default_view TEXT NOT NULL DEFAULT 'table',
  default_pipeline_id TEXT REFERENCES pipelines(id) ON DELETE SET NULL,
  scoring_config JSONB NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible_in_sidebar BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_collections_workspace ON collections(workspace_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT,
  color TEXT NOT NULL DEFAULT '#7958F5',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_collection ON categories(collection_id);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#659BFA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_workspace_name ON tags(workspace_id, name);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  website_url TEXT,
  normalized_domain TEXT,
  market TEXT,
  country TEXT,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  industry TEXT,
  description TEXT,
  observed_facts TEXT,
  source_url TEXT,
  published_contact TEXT,
  contact_evidence_url TEXT,
  contact_evidence_valid BOOLEAN NOT NULL DEFAULT TRUE,
  contact_evidence_warning TEXT,
  source_lead_status TEXT,
  qualification_decision TEXT NOT NULL DEFAULT 'not reviewed',
  outreach_approval TEXT NOT NULL DEFAULT 'not approved',
  opt_out_status TEXT NOT NULL DEFAULT 'unknown',
  prior_contact_check TEXT NOT NULL DEFAULT 'not checked',
  verification_level TEXT NOT NULL DEFAULT 'unverified',
  source_notes TEXT,
  primary_pipeline_id TEXT REFERENCES pipelines(id) ON DELETE SET NULL,
  primary_stage_id TEXT REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER,
  score_is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  score_method TEXT NOT NULL DEFAULT 'unscored',
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_updated_at TIMESTAMPTZ,
  next_action TEXT,
  next_follow_up_at TIMESTAMPTZ,
  discovery_date TEXT,
  external_id TEXT,
  external_namespace TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_org_workspace ON organizations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_org_normalized_name ON organizations(normalized_name);
CREATE INDEX IF NOT EXISTS idx_org_normalized_domain ON organizations(normalized_domain);
CREATE INDEX IF NOT EXISTS idx_org_stage ON organizations(primary_stage_id);
CREATE INDEX IF NOT EXISTS idx_org_external ON organizations(external_namespace, external_id);

CREATE TABLE IF NOT EXISTS collection_memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  collection_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage_id TEXT REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  custom_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER,
  score_is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_unique ON collection_memberships(collection_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_membership_org ON collection_memberships(organization_id);

CREATE TABLE IF NOT EXISTS field_definitions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  field_type TEXT NOT NULL,
  description TEXT,
  default_value TEXT,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_fields_collection ON field_definitions(collection_id);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  job_title TEXT,
  department TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  preferred_channel TEXT,
  country TEXT,
  city TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,
  opt_out_recorded BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status TEXT NOT NULL DEFAULT 'not approved',
  last_eligibility_review TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  primary_contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'Website Development',
  description TEXT,
  pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
  stage_id TEXT NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  estimated_value NUMERIC,
  currency TEXT NOT NULL DEFAULT 'INR',
  probability INTEGER,
  priority TEXT NOT NULL DEFAULT 'medium',
  expected_close_date TEXT,
  next_action TEXT,
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage_id);

CREATE TABLE IF NOT EXISTS pipeline_stage_history (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage_id TEXT,
  from_stage_name TEXT,
  to_stage_id TEXT NOT NULL,
  to_stage_name TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stage_history_org ON pipeline_stage_history(organization_id);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  origin TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_org ON notes(organization_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'Follow-up',
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'To Do',
  due_date TEXT NOT NULL,
  due_time TEXT,
  reminder_setting TEXT NOT NULL DEFAULT 'day_of',
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  actor_origin TEXT NOT NULL DEFAULT 'user',
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activities_workspace_time ON activities(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(organization_id);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'Document',
  data_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_org ON attachments(organization_id);

CREATE TABLE IF NOT EXISTS references_library (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'For Reference',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  screenshot_url TEXT,
  notes TEXT,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_ideas (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  hook TEXT,
  description TEXT,
  platform TEXT NOT NULL DEFAULT 'Instagram Reels',
  content_type TEXT NOT NULL DEFAULT 'Website Audit / Breakdown',
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  reference_id TEXT REFERENCES references_library(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'Good Reel',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'Idea',
  notes TEXT,
  target_publication_date TEXT,
  published_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_format TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  selected_sheet TEXT NOT NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  total_rows INTEGER NOT NULL DEFAULT 0,
  new_records_created INTEGER NOT NULL DEFAULT 0,
  existing_matched INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  rows_requiring_review INTEGER NOT NULL DEFAULT 0,
  validation_warnings_count INTEGER NOT NULL DEFAULT 0,
  failed_rows_count INTEGER NOT NULL DEFAULT 0,
  mapping_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_log_provenance JSONB NOT NULL DEFAULT '[]'::jsonb,
  suppression_rows_count INTEGER NOT NULL DEFAULT 0,
  warnings_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_organization_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_filename TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  external_lead_id TEXT,
  raw_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapped_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_source_records_org ON source_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_source_records_batch ON source_records(import_batch_id);

CREATE TABLE IF NOT EXISTS contact_suppressions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  business_or_domain TEXT NOT NULL,
  normalized_domain TEXT,
  contact_or_channel TEXT,
  opt_out_date TEXT,
  reason_or_source TEXT,
  status TEXT NOT NULL DEFAULT 'Do Not Contact',
  notes TEXT,
  import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_views (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  view_mode TEXT NOT NULL DEFAULT 'table',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_mappings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mapping JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

declare global {
  // eslint-disable-next-line no-var
  var __jayantCrmDbPromise: Promise<AppDatabase> | undefined;
}

async function bootstrapDefaults(db: AppDatabase) {
  const existingWs = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, DEFAULT_WORKSPACE_ID));

  if (existingWs.length === 0) {
    await db.insert(schema.workspaces).values({
      id: DEFAULT_WORKSPACE_ID,
      name: process.env.CRM_WORKSPACE_NAME || "Jayant Web & AI Systems",
      defaultCurrency: process.env.CRM_DEFAULT_CURRENCY || "INR",
      timezone: process.env.CRM_DEFAULT_TIMEZONE || "Asia/Kolkata",
      dateFormat: "DD MMM YYYY",
      theme: "dark",
      defaultLandingPage: "/dashboard",
    });
  }

  const existingUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, DEFAULT_USER_ID));

  if (existingUser.length === 0) {
    const email = process.env.CRM_ADMIN_EMAIL || "jayant@jayantwebsystems.com";
    const password = process.env.CRM_ADMIN_PASSWORD || "jayant-crm-admin-2026";
    await db.insert(schema.users).values({
      id: DEFAULT_USER_ID,
      workspaceId: DEFAULT_WORKSPACE_ID,
      email,
      fullName: "Jayant Olhyan",
      roleTitle: "Founder — Jayant Web & AI Systems",
      passwordHash: hashPassword(password),
    });
  }

  const existingPipeline = await db
    .select()
    .from(schema.pipelines)
    .where(eq(schema.pipelines.id, DEFAULT_PIPELINE_ID));

  if (existingPipeline.length === 0) {
    await db.insert(schema.pipelines).values({
      id: DEFAULT_PIPELINE_ID,
      workspaceId: DEFAULT_WORKSPACE_ID,
      name: "Agency Sales & Qualification Pipeline",
      description: "Primary lead qualification, discovery, outreach, and deal closing workflow",
      isDefault: true,
    });

    const stages = [
      { id: "stg_new", name: "New", color: "#659BFA", sortOrder: 1, classification: "open" },
      { id: "stg_researching", name: "Researching", color: "#E9AE50", sortOrder: 2, classification: "open" },
      { id: "stg_qualified", name: "Qualified", color: "#32B881", sortOrder: 3, classification: "open" },
      { id: "stg_contacted", name: "Contacted", color: "#7958F5", sortOrder: 4, classification: "open" },
      { id: "stg_replied", name: "Replied", color: "#38BDF8", sortOrder: 5, classification: "open" },
      { id: "stg_meeting", name: "Meeting", color: "#A855F7", sortOrder: 6, classification: "open" },
      { id: "stg_proposal", name: "Proposal", color: "#F59E0B", sortOrder: 7, classification: "open" },
      { id: "stg_won", name: "Won", color: "#10B981", sortOrder: 8, classification: "won" },
      { id: "stg_lost", name: "Lost", color: "#E56B73", sortOrder: 9, classification: "lost" },
    ];

    for (const s of stages) {
      await db.insert(schema.pipelineStages).values({
        id: s.id,
        pipelineId: DEFAULT_PIPELINE_ID,
        name: s.name,
        color: s.color,
        sortOrder: s.sortOrder,
        classification: s.classification,
      });
    }
  }

  // Ensure initial Global E-Commerce Leads collection exists per Section 13.2
  const existingEcom = await db
    .select()
    .from(schema.collections)
    .where(eq(schema.collections.id, GLOBAL_ECOM_COLLECTION_ID));

  if (existingEcom.length === 0) {
    await db.insert(schema.collections).values({
      id: GLOBAL_ECOM_COLLECTION_ID,
      workspaceId: DEFAULT_WORKSPACE_ID,
      name: "Global E-Commerce Leads",
      slug: "global-e-commerce-leads",
      description: "Global & India e-commerce brand ledger with site observation & verification tracking",
      icon: "ShoppingBag",
      color: "#7958F5",
      recordType: "company",
      defaultView: "table",
      defaultPipelineId: DEFAULT_PIPELINE_ID,
      scoringConfig: DEFAULT_SCORING_CONFIG,
      isPinned: true,
      isVisibleInSidebar: true,
      sortOrder: 1,
    });

    const defaultCategories = [
      { id: "cat_ecom_fashion", name: "Fashion & Apparel", color: "#7958F5", sortOrder: 1 },
      { id: "cat_ecom_beauty", name: "Beauty & Skincare", color: "#EC4899", sortOrder: 2 },
      { id: "cat_ecom_electronics", name: "Electronics & Gadgets", color: "#659BFA", sortOrder: 3 },
      { id: "cat_ecom_homedecor", name: "Home & Furniture", color: "#E9AE50", sortOrder: 4 },
      { id: "cat_ecom_d2c", name: "D2C Brand", color: "#32B881", sortOrder: 5 },
      { id: "cat_ecom_wholesale", name: "Wholesale / B2B", color: "#94A3B8", sortOrder: 6 },
    ];

    for (const cat of defaultCategories) {
      await db.insert(schema.categories).values({
        id: cat.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        name: cat.name,
        color: cat.color,
        sortOrder: cat.sortOrder,
      });
    }

    // Saved views recommended in Section 13.2
    const recommendedViews = [
      { id: "view_ecom_all", name: "All E-Commerce Leads", filters: {} },
      { id: "view_ecom_india", name: "India", filters: { market: "India" } },
      { id: "view_ecom_intl", name: "International", filters: { market: "International" } },
      {
        id: "view_ecom_verify",
        name: "Needs Verification",
        filters: { verificationLevel: "directory listing only" },
      },
      {
        id: "view_ecom_qualify",
        name: "Needs Qualification",
        filters: { qualificationDecision: "not reviewed" },
      },
      { id: "view_ecom_high", name: "High Priority", filters: { minScore: 75 } },
    ];

    for (const v of recommendedViews) {
      await db.insert(schema.savedViews).values({
        id: v.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        collectionId: GLOBAL_ECOM_COLLECTION_ID,
        name: v.name,
        filters: v.filters,
        viewMode: "table",
      });
    }
  }
}

async function createDatabaseConnection(): Promise<AppDatabase> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://"))) {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    await pool.query(SCHEMA_SQL);
    const db = drizzleNodePg(pool, { schema });
    await bootstrapDefaults(db);
    return db;
  }

  // Embedded PostgreSQL 16 via PGlite
  const isMemory = process.env.PGLITE_IN_MEMORY === "true";
  let client: PGlite;
  if (isMemory) {
    client = new PGlite();
  } else {
    const dataDir = path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR || "./data/pgdata");
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    client = new PGlite(dataDir);
  }

  await client.exec(SCHEMA_SQL);
  const db = drizzlePglite(client, { schema });
  await bootstrapDefaults(db);
  return db;
}

export async function getDb(): Promise<AppDatabase> {
  if (!global.__jayantCrmDbPromise) {
    global.__jayantCrmDbPromise = createDatabaseConnection();
  }
  return global.__jayantCrmDbPromise;
}

export async function resetTestDb(): Promise<AppDatabase> {
  global.__jayantCrmDbPromise = createDatabaseConnection();
  return global.__jayantCrmDbPromise;
}
