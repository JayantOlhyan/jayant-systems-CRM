import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export interface ScoringDimensionConfig {
  key: string;
  label: string;
  weight: number; // percentage 0..100, sum = 100
  description?: string;
}

export interface ScoringConfigJSON {
  version: number;
  highThreshold: number;
  mediumThreshold: number;
  missingValuePolicy: "zero" | "exclude" | "unscored";
  dimensions: ScoringDimensionConfig[];
}

export const DEFAULT_SCORING_CONFIG: ScoringConfigJSON = {
  version: 1,
  highThreshold: 75,
  mediumThreshold: 50,
  missingValuePolicy: "zero",
  dimensions: [
    {
      key: "industry_fit",
      label: "Industry & Niche Fit",
      weight: 20,
      description: "Fit with Jayant Web & AI Systems core offerings",
    },
    {
      key: "website_upgrade_need",
      label: "Website / UX Upgrade Need",
      weight: 25,
      description: "Storefront speed, mobile UX, conversion friction, or visual debt",
    },
    {
      key: "ai_automation_potential",
      label: "AI & Automation Potential",
      weight: 20,
      description: "Potential for AI support agents, catalog automation, or workflow tools",
    },
    {
      key: "company_scale",
      label: "Company Scale & Budget Signal",
      weight: 15,
      description: "Catalog size, active market presence, and ability to invest",
    },
    {
      key: "contact_readiness",
      label: "Contact & Verification Readiness",
      weight: 10,
      description: "Availability of verified contact paths and site-level evidence",
    },
    {
      key: "geographic_fit",
      label: "Geographic & Market Priority",
      weight: 10,
      description: "Strategic fit with target domestic or international regions",
    },
  ],
};

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Jayant Web & AI Systems"),
  defaultCurrency: text("default_currency").notNull().default("INR"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  dateFormat: text("date_format").notNull().default("DD MMM YYYY"),
  theme: text("theme").notNull().default("dark"),
  defaultLandingPage: text("default_landing_page").notNull().default("/dashboard"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull().default("Jayant Olhyan"),
  roleTitle: text("role_title").notNull().default("Founder"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pipelines = pgTable("pipelines", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: text("id").primaryKey(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#659BFA"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    classification: text("classification").notNull().default("open"), // 'open' | 'won' | 'lost'
    requiredFields: jsonb("required_fields").$type<string[]>().notNull().default([]),
    defaultReminderDays: integer("default_reminder_days"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_pipeline_stages_pipeline").on(table.pipelineId)]
);

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon").notNull().default("ShoppingBag"),
    color: text("color").notNull().default("#7958F5"),
    recordType: text("record_type").notNull().default("company"), // 'company' | 'person' | 'opportunity' | 'reference' | 'custom'
    defaultView: text("default_view").notNull().default("table"), // 'table' | 'kanban' | 'cards' | 'map'
    defaultPipelineId: text("default_pipeline_id").references(() => pipelines.id, {
      onDelete: "set null",
    }),
    scoringConfig: jsonb("scoring_config").$type<ScoringConfigJSON>().notNull(),
    isPinned: boolean("is_pinned").notNull().default(true),
    isVisibleInSidebar: boolean("is_visible_in_sidebar").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [index("idx_collections_workspace").on(table.workspaceId)]
);

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    color: text("color").notNull().default("#7958F5"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_categories_collection").on(table.collectionId)]
);

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#659BFA"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idx_tags_workspace_name").on(table.workspaceId, table.name)]
);

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    websiteUrl: text("website_url"),
    normalizedDomain: text("normalized_domain"),
    market: text("market"), // e.g., 'India' | 'International'
    country: text("country"),
    city: text("city"),
    latitude: numeric("latitude"),
    longitude: numeric("longitude"),
    industry: text("industry"), // Niche / Industry
    description: text("description"),
    observedFacts: text("observed_facts"),
    sourceUrl: text("source_url"),
    publishedContact: text("published_contact"),
    contactEvidenceUrl: text("contact_evidence_url"),
    contactEvidenceValid: boolean("contact_evidence_valid").notNull().default(true),
    contactEvidenceWarning: text("contact_evidence_warning"),
    sourceLeadStatus: text("source_lead_status"), // e.g. 'candidate' (preserved separately from pipeline stage!)
    qualificationDecision: text("qualification_decision").notNull().default("not reviewed"),
    outreachApproval: text("outreach_approval").notNull().default("not approved"),
    optOutStatus: text("opt_out_status").notNull().default("unknown"),
    priorContactCheck: text("prior_contact_check").notNull().default("not checked"),
    verificationLevel: text("verification_level").notNull().default("unverified"), // e.g. 'site description' | 'directory listing only'
    sourceNotes: text("source_notes"),
    primaryPipelineId: text("primary_pipeline_id").references(() => pipelines.id, {
      onDelete: "set null",
    }),
    primaryStageId: text("primary_stage_id").references(() => pipelineStages.id, {
      onDelete: "set null",
    }),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    customValues: jsonb("custom_values").$type<Record<string, unknown>>().notNull().default({}),
    score: integer("score"), // null if not yet scored
    scoreIsManual: boolean("score_is_manual").notNull().default(false),
    scoreMethod: text("score_method").notNull().default("unscored"),
    scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>().notNull().default({}),
    scoreUpdatedAt: timestamp("score_updated_at", { withTimezone: true }),
    nextAction: text("next_action"),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    discoveryDate: text("discovery_date"),
    externalId: text("external_id"),
    externalNamespace: text("external_namespace"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_org_workspace").on(table.workspaceId),
    index("idx_org_normalized_name").on(table.normalizedName),
    index("idx_org_normalized_domain").on(table.normalizedDomain),
    index("idx_org_stage").on(table.primaryStageId),
    index("idx_org_external").on(table.externalNamespace, table.externalId),
  ]
);

export const collectionMemberships = pgTable(
  "collection_memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    collectionCategories: jsonb("collection_categories").$type<string[]>().notNull().default([]),
    stageId: text("stage_id").references(() => pipelineStages.id, { onDelete: "set null" }),
    customValues: jsonb("custom_values").$type<Record<string, unknown>>().notNull().default({}),
    score: integer("score"),
    scoreIsManual: boolean("score_is_manual").notNull().default(false),
    scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_membership_unique").on(table.collectionId, table.organizationId),
    index("idx_membership_org").on(table.organizationId),
  ]
);

export const fieldDefinitions = pgTable(
  "field_definitions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "cascade",
    }), // null means global field across collections
    name: text("name").notNull(),
    key: text("key").notNull(),
    fieldType: text("field_type").notNull(), // 'text' | 'long_text' | 'number' | 'currency' | 'percentage' | 'date' | 'datetime' | 'checkbox' | 'single_select' | 'multi_select' | 'url' | 'email' | 'phone' | 'rating' | 'relation' | 'file' | 'country' | 'formula'
    description: text("description"),
    defaultValue: text("default_value"),
    isRequired: boolean("is_required").notNull().default(false),
    isVisible: boolean("is_visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    validationRules: jsonb("validation_rules").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [index("idx_fields_collection").on(table.collectionId)]
);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title"),
    department: text("department"),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    preferredChannel: text("preferred_channel"),
    country: text("country"),
    city: text("city"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    doNotContact: boolean("do_not_contact").notNull().default(false),
    optOutRecorded: boolean("opt_out_recorded").notNull().default(false),
    approvalStatus: text("approval_status").notNull().default("not approved"),
    lastEligibilityReview: timestamp("last_eligibility_review", { withTimezone: true }),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_contacts_org").on(table.organizationId)]
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    primaryContactId: text("primary_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    serviceType: text("service_type").notNull().default("Website Development"),
    description: text("description"),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "restrict" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => pipelineStages.id, { onDelete: "restrict" }),
    estimatedValue: numeric("estimated_value"), // Nullable! Never fabricate 0 for unknown value
    currency: text("currency").notNull().default("INR"),
    probability: integer("probability"),
    priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high'
    expectedCloseDate: text("expected_close_date"),
    nextAction: text("next_action"),
    notes: text("notes"),
    outcome: text("outcome"), // 'open' | 'won' | 'lost'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_opportunities_org").on(table.organizationId),
    index("idx_opportunities_stage").on(table.stageId),
  ]
);

export const pipelineStageHistory = pgTable(
  "pipeline_stage_history",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, {
      onDelete: "cascade",
    }),
    fromStageId: text("from_stage_id"),
    fromStageName: text("from_stage_name"),
    toStageId: text("to_stage_id").notNull(),
    toStageName: text("to_stage_name").notNull(),
    changedBy: text("changed_by").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_stage_history_org").on(table.organizationId)]
);

export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, {
      onDelete: "cascade",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    origin: text("origin").notNull().default("user"), // 'user' | 'import'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_notes_org").on(table.organizationId)]
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    taskType: text("task_type").notNull().default("Follow-up"), // 'Follow-up' | 'Email' | 'Call' | 'Research' | 'Proposal' | 'Meeting' | 'Content'
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high'
    status: text("status").notNull().default("To Do"), // 'To Do' | 'In Progress' | 'Waiting' | 'Completed' | 'Cancelled'
    dueDate: text("due_date").notNull(), // YYYY-MM-DD in workspace timezone
    dueTime: text("due_time"), // HH:mm
    reminderSetting: text("reminder_setting").notNull().default("day_of"), // 'none' | 'day_of' | '1_hour_before' | '1_day_before'
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tasks_due_date").on(table.dueDate),
    index("idx_tasks_org").on(table.organizationId),
  ]
);

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    actorOrigin: text("actor_origin").notNull().default("user"), // 'user' | 'import' | 'system'
    activityType: text("activity_type").notNull(), // 'lead_created' | 'lead_imported' | 'stage_changed' | 'score_updated' | 'note_added' | 'task_completed' | 'followup_scheduled' | 'email_sent' | 'call_made' | 'meeting_held' | 'proposal_sent'
    title: text("title").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_activities_workspace_time").on(table.workspaceId, table.createdAt),
    index("idx_activities_org").on(table.organizationId),
  ]
);

export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    category: text("category").notNull().default("Document"), // 'Screenshot' | 'Proposal' | 'Audit Report' | 'Document' | 'Image'
    dataUrl: text("data_url").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_attachments_org").on(table.organizationId)]
);

export const referencesLibrary = pgTable("references_library", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  category: text("category").notNull().default("For Reference"), // 'Good Reel' | 'For Reference' | 'Good, Need to Work With It' | 'Good Website Design' | 'Competitor' | 'Landing Page Inspiration'
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  screenshotUrl: text("screenshot_url"),
  notes: text("notes"),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  opportunityId: text("opportunity_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),
  collectionId: text("collection_id").references(() => collections.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentIdeas = pgTable("content_ideas", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  hook: text("hook"),
  description: text("description"),
  platform: text("platform").notNull().default("Instagram Reels"), // 'Instagram Reels' | 'YouTube Shorts' | 'LinkedIn' | 'X / Twitter' | 'YouTube Long-form'
  contentType: text("content_type").notNull().default("Website Audit / Breakdown"),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  referenceId: text("reference_id").references(() => referencesLibrary.id, {
    onDelete: "set null",
  }),
  category: text("category").notNull().default("Good Reel"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("Idea"), // 'Idea' | 'Researching' | 'Scripting' | 'Ready to Record' | 'Recorded' | 'Editing' | 'Ready to Publish' | 'Published'
  notes: text("notes"),
  targetPublicationDate: text("target_publication_date"),
  publishedUrl: text("published_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  fileFormat: text("file_format").notNull(), // 'xlsx' | 'csv'
  fileSizeBytes: integer("file_size_bytes").notNull().default(0),
  selectedSheet: text("selected_sheet").notNull(),
  collectionId: text("collection_id").references(() => collections.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("completed"), // 'completed' | 'rolled_back' | 'failed'
  totalRows: integer("total_rows").notNull().default(0),
  newRecordsCreated: integer("new_records_created").notNull().default(0),
  existingMatched: integer("existing_matched").notNull().default(0),
  recordsUpdated: integer("records_updated").notNull().default(0),
  duplicatesSkipped: integer("duplicates_skipped").notNull().default(0),
  rowsRequiringReview: integer("rows_requiring_review").notNull().default(0),
  validationWarningsCount: integer("validation_warnings_count").notNull().default(0),
  failedRowsCount: integer("failed_rows_count").notNull().default(0),
  mappingConfig: jsonb("mapping_config").$type<Record<string, string>>().notNull().default({}),
  runLogProvenance: jsonb("run_log_provenance")
    .$type<Record<string, unknown>[]>()
    .notNull()
    .default([]),
  suppressionRowsCount: integer("suppression_rows_count").notNull().default(0),
  warningsSummary: jsonb("warnings_summary")
    .$type<Array<{ rowNumber: number; externalId?: string; business?: string; field: string; value: string; message: string }>>()
    .notNull()
    .default([]),
  createdOrganizationIds: jsonb("created_organization_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourceRecords = pgTable(
  "source_records",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    importBatchId: text("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceFilename: text("source_filename").notNull(),
    sheetName: text("sheet_name").notNull(),
    rowNumber: integer("row_number").notNull(),
    externalLeadId: text("external_lead_id"),
    rawValues: jsonb("raw_values").$type<Record<string, unknown>>().notNull().default({}),
    mappedValues: jsonb("mapped_values").$type<Record<string, unknown>>().notNull().default({}),
    validationWarnings: jsonb("validation_warnings").$type<string[]>().notNull().default([]),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_source_records_org").on(table.organizationId),
    index("idx_source_records_batch").on(table.importBatchId),
  ]
);

export const contactSuppressions = pgTable("contact_suppressions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  businessOrDomain: text("business_or_domain").notNull(),
  normalizedDomain: text("normalized_domain"),
  contactOrChannel: text("contact_or_channel"),
  optOutDate: text("opt_out_date"),
  reasonOrSource: text("reason_or_source"),
  status: text("status").notNull().default("Do Not Contact"),
  notes: text("notes"),
  importBatchId: text("import_batch_id").references(() => importBatches.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedViews = pgTable("saved_views", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  collectionId: text("collection_id").references(() => collections.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
  sortConfig: jsonb("sort_config").$type<Record<string, unknown>>().notNull().default({}),
  visibleColumns: jsonb("visible_columns").$type<string[]>().notNull().default([]),
  viewMode: text("view_mode").notNull().default("table"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedMappings = pgTable("saved_mappings", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mapping: jsonb("mapping").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
