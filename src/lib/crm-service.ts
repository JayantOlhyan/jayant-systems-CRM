import crypto from "node:crypto";
import { and, desc, eq, asc, isNull } from "drizzle-orm";
import {
  getDb,
  DEFAULT_WORKSPACE_ID,
  DEFAULT_PIPELINE_ID,
  GLOBAL_ECOM_COLLECTION_ID,
  DEFAULT_SCORING_CONFIG,
} from "@/db";
import {
  workspaces,
  organizations,
  collections,
  collectionMemberships,
  categories,
  tags,
  fieldDefinitions,
  pipelines,
  pipelineStages,
  pipelineStageHistory,
  opportunities,
  contacts,
  notes,
  tasks,
  activities,
  attachments,
  referencesLibrary,
  contentIdeas,
  importBatches,
  sourceRecords,
  contactSuppressions,
  savedViews,
  savedMappings,
  type ScoringConfigJSON,
} from "@/db/schema";
import {
  normalizeDomain,
  normalizeOrganizationName,
  validateUrlField,
  calculateLeadScore,
} from "./domain-utils";

export interface LeadFilterParams {
  search?: string;
  collectionId?: string;
  market?: string;
  country?: string;
  category?: string;
  stageId?: string;
  verificationLevel?: string;
  qualificationDecision?: string;
  outreachApproval?: string;
  tag?: string;
  minScore?: number;
  maxScore?: number;
  hasWarning?: boolean;
  includeArchived?: boolean;
  sortBy?: "name" | "score" | "createdAt" | "updatedAt" | "country" | "nextFollowUpAt";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number | "unlimited";
  advancedFilters?: Array<{
    field: string;
    operator:
      | "equals"
      | "not_equals"
      | "contains"
      | "not_contains"
      | "is_empty"
      | "is_not_empty"
      | "gt"
      | "lt";
    value?: string;
  }>;
}

export async function getFullWorkspaceData(workspaceId = DEFAULT_WORKSPACE_ID) {
  const db = await getDb();

  const [
    wsList,
    allCollections,
    allCategories,
    allTags,
    allFields,
    allPipelines,
    allStages,
    allOrgs,
    allMemberships,
    allOpportunities,
    allContacts,
    allTasks,
    allNotes,
    allActivities,
    allReferences,
    allContentIdeas,
    allImportBatches,
    allSuppressions,
    allSavedViews,
    allSavedMappings,
  ] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, workspaceId)),
    db
      .select()
      .from(collections)
      .where(and(eq(collections.workspaceId, workspaceId), isNull(collections.archivedAt)))
      .orderBy(asc(collections.sortOrder), asc(collections.createdAt)),
    db
      .select()
      .from(categories)
      .where(eq(categories.workspaceId, workspaceId))
      .orderBy(asc(categories.sortOrder)),
    db.select().from(tags).where(eq(tags.workspaceId, workspaceId)),
    db
      .select()
      .from(fieldDefinitions)
      .where(and(eq(fieldDefinitions.workspaceId, workspaceId), isNull(fieldDefinitions.archivedAt)))
      .orderBy(asc(fieldDefinitions.sortOrder)),
    db.select().from(pipelines).where(eq(pipelines.workspaceId, workspaceId)),
    db.select().from(pipelineStages).orderBy(asc(pipelineStages.sortOrder)),
    db
      .select()
      .from(organizations)
      .where(and(eq(organizations.workspaceId, workspaceId), isNull(organizations.archivedAt)))
      .orderBy(desc(organizations.updatedAt)),
    db
      .select()
      .from(collectionMemberships)
      .where(eq(collectionMemberships.workspaceId, workspaceId)),
    db
      .select()
      .from(opportunities)
      .where(eq(opportunities.workspaceId, workspaceId))
      .orderBy(desc(opportunities.updatedAt)),
    db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceId))
      .orderBy(desc(contacts.updatedAt)),
    db
      .select()
      .from(tasks)
      .where(eq(tasks.workspaceId, workspaceId))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt)),
    db
      .select()
      .from(notes)
      .where(eq(notes.workspaceId, workspaceId))
      .orderBy(desc(notes.isPinned), desc(notes.createdAt)),
    db
      .select()
      .from(activities)
      .where(eq(activities.workspaceId, workspaceId))
      .orderBy(desc(activities.createdAt))
      .limit(100),
    db
      .select()
      .from(referencesLibrary)
      .where(eq(referencesLibrary.workspaceId, workspaceId))
      .orderBy(desc(referencesLibrary.createdAt)),
    db
      .select()
      .from(contentIdeas)
      .where(eq(contentIdeas.workspaceId, workspaceId))
      .orderBy(desc(contentIdeas.createdAt)),
    db
      .select()
      .from(importBatches)
      .where(eq(importBatches.workspaceId, workspaceId))
      .orderBy(desc(importBatches.createdAt)),
    db
      .select()
      .from(contactSuppressions)
      .where(eq(contactSuppressions.workspaceId, workspaceId))
      .orderBy(desc(contactSuppressions.createdAt)),
    db.select().from(savedViews).where(eq(savedViews.workspaceId, workspaceId)),
    db.select().from(savedMappings).where(eq(savedMappings.workspaceId, workspaceId)),
  ]);

  // Compute collection membership counts
  const collectionCounts: Record<string, number> = {};
  const orgCollectionsMap: Record<string, string[]> = {};
  for (const m of allMemberships) {
    collectionCounts[m.collectionId] = (collectionCounts[m.collectionId] || 0) + 1;
    if (!orgCollectionsMap[m.organizationId]) {
      orgCollectionsMap[m.organizationId] = [];
    }
    orgCollectionsMap[m.organizationId].push(m.collectionId);
  }

  return {
    workspace: wsList[0],
    collections: allCollections.map((c) => ({
      ...c,
      leadCount: collectionCounts[c.id] || 0,
    })),
    categories: allCategories,
    tags: allTags,
    fieldDefinitions: allFields,
    pipelines: allPipelines,
    pipelineStages: allStages,
    organizations: allOrgs.map((o) => ({
      ...o,
      collectionIds: orgCollectionsMap[o.id] || [],
    })),
    memberships: allMemberships,
    opportunities: allOpportunities,
    contacts: allContacts,
    tasks: allTasks,
    notes: allNotes,
    activities: allActivities,
    references: allReferences,
    contentIdeas: allContentIdeas,
    importBatches: allImportBatches,
    suppressions: allSuppressions,
    savedViews: allSavedViews,
    savedMappings: allSavedMappings,
  };
}

export async function queryLeadsPaginated(
  params: LeadFilterParams,
  workspaceId = DEFAULT_WORKSPACE_ID
) {
  const db = await getDb();
  const allOrgs = await db
    .select()
    .from(organizations)
    .where(
      params.includeArchived
        ? eq(organizations.workspaceId, workspaceId)
        : and(eq(organizations.workspaceId, workspaceId), isNull(organizations.archivedAt))
    );

  const allMemberships = await db
    .select()
    .from(collectionMemberships)
    .where(eq(collectionMemberships.workspaceId, workspaceId));

  const orgToCollections = new Map<string, typeof allMemberships>();
  for (const m of allMemberships) {
    const arr = orgToCollections.get(m.organizationId) || [];
    arr.push(m);
    orgToCollections.set(m.organizationId, arr);
  }

  let filtered = allOrgs.map((org) => {
    const mems = orgToCollections.get(org.id) || [];
    const activeMembership = params.collectionId
      ? mems.find((m) => m.collectionId === params.collectionId)
      : undefined;
    return {
      ...org,
      collectionIds: mems.map((m) => m.collectionId),
      collectionCategories: activeMembership?.collectionCategories || org.categories,
      effectiveScore: activeMembership?.score ?? org.score,
      effectiveCustomValues: {
        ...org.customValues,
        ...(activeMembership?.customValues || {}),
      },
    };
  });

  if (params.collectionId) {
    filtered = filtered.filter((o) => o.collectionIds.includes(params.collectionId!));
  }

  if (params.search && params.search.trim()) {
    const q = params.search.trim().toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.websiteUrl || "").toLowerCase().includes(q) ||
        (o.normalizedDomain || "").toLowerCase().includes(q) ||
        (o.country || "").toLowerCase().includes(q) ||
        (o.industry || "").toLowerCase().includes(q) ||
        (o.externalId || "").toLowerCase().includes(q) ||
        (o.observedFacts || "").toLowerCase().includes(q) ||
        (o.publishedContact || "").toLowerCase().includes(q) ||
        o.tags.some((t) => t.toLowerCase().includes(q)) ||
        o.categories.some((c) => c.toLowerCase().includes(q))
    );
  }

  if (params.market) {
    filtered = filtered.filter(
      (o) => (o.market || "").toLowerCase() === params.market!.toLowerCase()
    );
  }

  if (params.country) {
    filtered = filtered.filter(
      (o) => (o.country || "").toLowerCase() === params.country!.toLowerCase()
    );
  }

  if (params.category) {
    const catLower = params.category.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        (o.industry || "").toLowerCase() === catLower ||
        o.categories.some((c) => c.toLowerCase() === catLower) ||
        o.collectionCategories.some((c) => c.toLowerCase() === catLower)
    );
  }

  if (params.stageId) {
    filtered = filtered.filter((o) => o.primaryStageId === params.stageId);
  }

  if (params.verificationLevel) {
    filtered = filtered.filter(
      (o) =>
        (o.verificationLevel || "").toLowerCase() === params.verificationLevel!.toLowerCase()
    );
  }

  if (params.qualificationDecision) {
    const qLow = params.qualificationDecision.toLowerCase();
    filtered = filtered.filter((o) =>
      qLow === "qualified"
        ? (o.qualificationDecision || "").toLowerCase() === "qualified" ||
          o.primaryStageId === "stg_qualified"
        : (o.qualificationDecision || "").toLowerCase() === qLow
    );
  }

  if (params.outreachApproval) {
    filtered = filtered.filter(
      (o) =>
        (o.outreachApproval || "").toLowerCase() === params.outreachApproval!.toLowerCase()
    );
  }

  if (params.tag) {
    const tLower = params.tag.toLowerCase();
    filtered = filtered.filter((o) => o.tags.some((t) => t.toLowerCase() === tLower));
  }

  if (params.minScore !== undefined && !Number.isNaN(params.minScore)) {
    filtered = filtered.filter(
      (o) => o.effectiveScore !== null && o.effectiveScore >= params.minScore!
    );
  }

  if (params.maxScore !== undefined && !Number.isNaN(params.maxScore)) {
    filtered = filtered.filter(
      (o) => o.effectiveScore !== null && o.effectiveScore <= params.maxScore!
    );
  }

  if (params.hasWarning) {
    filtered = filtered.filter(
      (o) =>
        !o.contactEvidenceValid ||
        o.verificationLevel.toLowerCase().includes("directory")
    );
  }

  if (params.advancedFilters && params.advancedFilters.length > 0) {
    for (const af of params.advancedFilters) {
      filtered = filtered.filter((o) => {
        const rawVal =
          af.field in o
            ? (o as Record<string, unknown>)[af.field]
            : o.effectiveCustomValues[af.field];
        const strVal = rawVal === null || rawVal === undefined ? "" : String(rawVal).toLowerCase();
        const target = (af.value || "").toLowerCase();

        switch (af.operator) {
          case "equals":
            return strVal === target;
          case "not_equals":
            return strVal !== target;
          case "contains":
            return strVal.includes(target);
          case "not_contains":
            return !strVal.includes(target);
          case "is_empty":
            return strVal === "";
          case "is_not_empty":
            return strVal !== "";
          case "gt":
            return Number(rawVal) > Number(af.value);
          case "lt":
            return Number(rawVal) < Number(af.value);
          default:
            return true;
        }
      });
    }
  }

  // Sort
  const sortBy = params.sortBy || "updatedAt";
  const sortDir = params.sortDir || "desc";
  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy === "score") {
      const sa = a.effectiveScore ?? -1;
      const sb = b.effectiveScore ?? -1;
      cmp = sa - sb;
    } else if (sortBy === "country") {
      cmp = (a.country || "").localeCompare(b.country || "");
    } else if (sortBy === "createdAt") {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalCount = filtered.length;
  const isUnlimited = params.pageSize === "unlimited" || params.pageSize === 0;
  const page = isUnlimited ? 1 : Math.max(1, params.page || 1);
  const numericPageSize = isUnlimited
    ? Math.max(1, totalCount)
    : Math.max(1, Number(params.pageSize) || 50);
  const offset = isUnlimited ? 0 : (page - 1) * numericPageSize;
  const rows = isUnlimited ? filtered : filtered.slice(offset, offset + numericPageSize);

  return {
    rows,
    totalCount,
    page,
    pageSize: isUnlimited ? "unlimited" : numericPageSize,
    totalPages: isUnlimited ? 1 : Math.max(1, Math.ceil(totalCount / numericPageSize)),
  };
}

export async function getLeadDetail(organizationId: string, workspaceId = DEFAULT_WORKSPACE_ID) {
  const db = await getDb();
  const orgRows = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), eq(organizations.workspaceId, workspaceId)));

  if (orgRows.length === 0) return null;
  const org = orgRows[0];

  const [
    mems,
    orgContacts,
    orgOpportunities,
    orgNotes,
    orgTasks,
    orgActivities,
    orgAttachments,
    orgSources,
    stageHistory,
    linkedReferences,
    linkedContent,
  ] = await Promise.all([
    db
      .select()
      .from(collectionMemberships)
      .where(eq(collectionMemberships.organizationId, organizationId)),
    db.select().from(contacts).where(eq(contacts.organizationId, organizationId)),
    db
      .select()
      .from(opportunities)
      .where(eq(opportunities.organizationId, organizationId))
      .orderBy(desc(opportunities.createdAt)),
    db
      .select()
      .from(notes)
      .where(eq(notes.organizationId, organizationId))
      .orderBy(desc(notes.isPinned), desc(notes.createdAt)),
    db
      .select()
      .from(tasks)
      .where(eq(tasks.organizationId, organizationId))
      .orderBy(asc(tasks.dueDate)),
    db
      .select()
      .from(activities)
      .where(eq(activities.organizationId, organizationId))
      .orderBy(desc(activities.createdAt)),
    db
      .select()
      .from(attachments)
      .where(eq(attachments.organizationId, organizationId))
      .orderBy(desc(attachments.createdAt)),
    db
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.organizationId, organizationId))
      .orderBy(desc(sourceRecords.importedAt)),
    db
      .select()
      .from(pipelineStageHistory)
      .where(eq(pipelineStageHistory.organizationId, organizationId))
      .orderBy(desc(pipelineStageHistory.createdAt)),
    db
      .select()
      .from(referencesLibrary)
      .where(eq(referencesLibrary.organizationId, organizationId)),
    db.select().from(contentIdeas).where(eq(contentIdeas.organizationId, organizationId)),
  ]);

  return {
    organization: org,
    memberships: mems,
    contacts: orgContacts,
    opportunities: orgOpportunities,
    notes: orgNotes,
    tasks: orgTasks,
    activities: orgActivities,
    attachments: orgAttachments,
    sourceRecords: orgSources,
    stageHistory,
    references: linkedReferences,
    contentIdeas: linkedContent,
  };
}

export async function createOrUpdateLead(
  input: {
    id?: string;
    name: string;
    websiteUrl?: string | null;
    country?: string | null;
    city?: string | null;
    market?: string | null;
    industry?: string | null;
    description?: string | null;
    observedFacts?: string | null;
    publishedContact?: string | null;
    contactEvidenceUrl?: string | null;
    qualificationDecision?: string;
    outreachApproval?: string;
    verificationLevel?: string;
    primaryStageId?: string;
    categories?: string[];
    tags?: string[];
    collectionIds?: string[];
    score?: number | null;
    scoreBreakdown?: Record<string, number>;
    nextAction?: string | null;
    customValues?: Record<string, unknown>;
    initialNote?: string;
  },
  workspaceId = DEFAULT_WORKSPACE_ID
) {
  const db = await getDb();
  const websiteCheck = validateUrlField(input.websiteUrl, "Website");
  const normDomain = websiteCheck.isValid ? normalizeDomain(input.websiteUrl) : null;
  const evidenceCheck = validateUrlField(input.contactEvidenceUrl, "Contact Evidence URL");

  if (input.id) {
    const existingRows = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, input.id), eq(organizations.workspaceId, workspaceId)));
    if (existingRows.length === 0) throw new Error("Organization not found");
    const existing = existingRows[0];

    const stageChanged =
      input.primaryStageId && input.primaryStageId !== existing.primaryStageId;
    const scoreChanged =
      input.score !== undefined && input.score !== existing.score;

    await db
      .update(organizations)
      .set({
        name: input.name.trim(),
        normalizedName: normalizeOrganizationName(input.name),
        websiteUrl: input.websiteUrl !== undefined ? input.websiteUrl : existing.websiteUrl,
        normalizedDomain:
          input.websiteUrl !== undefined ? normDomain : existing.normalizedDomain,
        country: input.country !== undefined ? input.country : existing.country,
        city: input.city !== undefined ? input.city : existing.city,
        market: input.market !== undefined ? input.market : existing.market,
        industry: input.industry !== undefined ? input.industry : existing.industry,
        description: input.description !== undefined ? input.description : existing.description,
        observedFacts:
          input.observedFacts !== undefined ? input.observedFacts : existing.observedFacts,
        publishedContact:
          input.publishedContact !== undefined
            ? input.publishedContact
            : existing.publishedContact,
        contactEvidenceUrl:
          input.contactEvidenceUrl !== undefined
            ? input.contactEvidenceUrl
            : existing.contactEvidenceUrl,
        contactEvidenceValid:
          input.contactEvidenceUrl !== undefined
            ? evidenceCheck.isValid
            : existing.contactEvidenceValid,
        contactEvidenceWarning:
          input.contactEvidenceUrl !== undefined
            ? evidenceCheck.warning
            : existing.contactEvidenceWarning,
        qualificationDecision: input.qualificationDecision ?? existing.qualificationDecision,
        outreachApproval: input.outreachApproval ?? existing.outreachApproval,
        verificationLevel: input.verificationLevel ?? existing.verificationLevel,
        primaryStageId: input.primaryStageId ?? existing.primaryStageId,
        categories: input.categories ?? existing.categories,
        tags: input.tags ?? existing.tags,
        score: input.score !== undefined ? input.score : existing.score,
        scoreIsManual: input.score !== undefined ? true : existing.scoreIsManual,
        scoreMethod: input.score !== undefined ? "manual_override" : existing.scoreMethod,
        scoreBreakdown: input.scoreBreakdown ?? existing.scoreBreakdown,
        scoreUpdatedAt: input.score !== undefined ? new Date() : existing.scoreUpdatedAt,
        nextAction: input.nextAction !== undefined ? input.nextAction : existing.nextAction,
        customValues: input.customValues
          ? { ...existing.customValues, ...input.customValues }
          : existing.customValues,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, input.id));

    if (input.collectionIds) {
      for (const colId of input.collectionIds) {
        const mem = await db
          .select()
          .from(collectionMemberships)
          .where(
            and(
              eq(collectionMemberships.collectionId, colId),
              eq(collectionMemberships.organizationId, input.id)
            )
          );
        if (mem.length === 0) {
          await db.insert(collectionMemberships).values({
            id: `mem_${crypto.randomUUID().slice(0, 10)}`,
            workspaceId,
            collectionId: colId,
            organizationId: input.id,
            collectionCategories: input.categories || existing.categories,
            stageId: input.primaryStageId || existing.primaryStageId,
          });
        }
      }
    }

    if (stageChanged && input.primaryStageId) {
      const stages = await db.select().from(pipelineStages);
      const fromStage = stages.find((s) => s.id === existing.primaryStageId);
      const toStage = stages.find((s) => s.id === input.primaryStageId);

      await db.insert(pipelineStageHistory).values({
        id: `psh_${crypto.randomUUID().slice(0, 10)}`,
        workspaceId,
        organizationId: input.id,
        fromStageId: existing.primaryStageId,
        fromStageName: fromStage?.name || existing.primaryStageId,
        toStageId: input.primaryStageId,
        toStageName: toStage?.name || input.primaryStageId,
        changedBy: "user",
      });

      await db.insert(activities).values({
        id: `act_${crypto.randomUUID().slice(0, 10)}`,
        workspaceId,
        organizationId: input.id,
        actorOrigin: "user",
        activityType: "stage_changed",
        title: `Pipeline stage moved to ${toStage?.name || input.primaryStageId}`,
        description: `${existing.name} moved from ${fromStage?.name || "previous"} to ${toStage?.name || input.primaryStageId}`,
      });
    }

    if (scoreChanged) {
      await db.insert(activities).values({
        id: `act_${crypto.randomUUID().slice(0, 10)}`,
        workspaceId,
        organizationId: input.id,
        actorOrigin: "user",
        activityType: "score_updated",
        title: `Lead score updated to ${input.score ?? "Unscored"} (${existing.name})`,
      });
    }

    return input.id;
  }

  // Create new lead
  const newId = `org_${crypto.randomUUID().slice(0, 10)}`;
  await db.insert(organizations).values({
    id: newId,
    workspaceId,
    name: input.name.trim(),
    normalizedName: normalizeOrganizationName(input.name),
    websiteUrl: input.websiteUrl || null,
    normalizedDomain: normDomain,
    country: input.country || null,
    city: input.city || null,
    market:
      input.market ||
      (input.country?.toLowerCase() === "india"
        ? "India"
        : input.country
        ? "International"
        : null),
    industry: input.industry || null,
    description: input.description || null,
    observedFacts: input.observedFacts || null,
    publishedContact: input.publishedContact || null,
    contactEvidenceUrl: input.contactEvidenceUrl || null,
    contactEvidenceValid: evidenceCheck.isValid,
    contactEvidenceWarning: evidenceCheck.warning,
    sourceLeadStatus: "manual",
    qualificationDecision: input.qualificationDecision || "not reviewed",
    outreachApproval: input.outreachApproval || "not approved",
    verificationLevel: input.verificationLevel || (normDomain ? "site description" : "unverified"),
    primaryPipelineId: DEFAULT_PIPELINE_ID,
    primaryStageId: input.primaryStageId || "stg_new",
    categories: input.categories || (input.industry ? [input.industry] : []),
    tags: input.tags || [],
    score: input.score ?? null,
    scoreIsManual: input.score !== undefined && input.score !== null,
    scoreMethod: input.score !== undefined && input.score !== null ? "manual" : "unscored",
    scoreBreakdown: input.scoreBreakdown || {},
    scoreUpdatedAt: input.score !== undefined && input.score !== null ? new Date() : null,
    nextAction: input.nextAction || null,
    customValues: input.customValues || {},
    discoveryDate: new Date().toISOString().split("T")[0],
  });

  const colIds =
    input.collectionIds && input.collectionIds.length > 0
      ? input.collectionIds
      : [GLOBAL_ECOM_COLLECTION_ID];

  for (const colId of colIds) {
    await db.insert(collectionMemberships).values({
      id: `mem_${crypto.randomUUID().slice(0, 10)}`,
      workspaceId,
      collectionId: colId,
      organizationId: newId,
      collectionCategories: input.categories || (input.industry ? [input.industry] : []),
      stageId: input.primaryStageId || "stg_new",
      customValues: input.customValues || {},
    });
  }

  if (input.initialNote && input.initialNote.trim()) {
    await db.insert(notes).values({
      id: `note_${crypto.randomUUID().slice(0, 10)}`,
      workspaceId,
      organizationId: newId,
      content: input.initialNote.trim(),
      isPinned: true,
      origin: "user",
    });
  }

  await db.insert(activities).values({
    id: `act_${crypto.randomUUID().slice(0, 10)}`,
    workspaceId,
    organizationId: newId,
    actorOrigin: "user",
    activityType: "lead_created",
    title: `Lead created: ${input.name.trim()}`,
  });

  return newId;
}

export async function createCollection(
  input: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    recordType?: string;
    defaultView?: string;
    categories?: string[];
    customFields?: Array<{
      name: string;
      fieldType: string;
      isRequired?: boolean;
      options?: string[];
    }>;
    scoringConfig?: ScoringConfigJSON;
  },
  workspaceId = DEFAULT_WORKSPACE_ID
) {
  const db = await getDb();
  const id = `col_${crypto.randomUUID().slice(0, 10)}`;
  const slug = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await db.insert(collections).values({
    id,
    workspaceId,
    name: input.name.trim(),
    slug: slug || id,
    description: input.description || null,
    icon: input.icon || "FolderKanban",
    color: input.color || "#7958F5",
    recordType: input.recordType || "company",
    defaultView: input.defaultView || "table",
    defaultPipelineId: DEFAULT_PIPELINE_ID,
    scoringConfig: input.scoringConfig || DEFAULT_SCORING_CONFIG,
    isPinned: true,
    isVisibleInSidebar: true,
  });

  if (input.categories && input.categories.length > 0) {
    let idx = 1;
    for (const catName of input.categories) {
      if (!catName.trim()) continue;
      await db.insert(categories).values({
        id: `cat_${crypto.randomUUID().slice(0, 10)}`,
        workspaceId,
        collectionId: id,
        name: catName.trim(),
        color: input.color || "#7958F5",
        sortOrder: idx++,
      });
    }
  }

  if (input.customFields && input.customFields.length > 0) {
    let idx = 1;
    for (const cf of input.customFields) {
      if (!cf.name.trim()) continue;
      const key = cf.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      await db.insert(fieldDefinitions).values({
        id: `fld_${crypto.randomUUID().slice(0, 10)}`,
        workspaceId,
        collectionId: id,
        name: cf.name.trim(),
        key,
        fieldType: cf.fieldType || "text",
        isRequired: Boolean(cf.isRequired),
        isVisible: true,
        sortOrder: idx++,
        options: cf.options || [],
      });
    }
  }

  await db.insert(activities).values({
    id: `act_${crypto.randomUUID().slice(0, 10)}`,
    workspaceId,
    collectionId: id,
    actorOrigin: "user",
    activityType: "collection_created",
    title: `${input.name.trim()} collection created`,
  });

  return id;
}

export async function calculateAndSaveOrganizationScore(
  organizationId: string,
  dimensionInputs: Record<string, number>,
  collectionId?: string,
  manualOverrideScore?: number | null,
  workspaceId = DEFAULT_WORKSPACE_ID
) {
  const db = await getDb();
  let config = DEFAULT_SCORING_CONFIG;

  if (collectionId) {
    const colRows = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId));
    if (colRows.length > 0 && colRows[0].scoringConfig) {
      config = colRows[0].scoringConfig;
    }
  }

  const calc = calculateLeadScore(dimensionInputs, config);
  const finalScore =
    manualOverrideScore !== undefined && manualOverrideScore !== null
      ? Math.max(0, Math.min(100, Math.round(manualOverrideScore)))
      : calc.score;
  const isManual = manualOverrideScore !== undefined && manualOverrideScore !== null;

  await db
    .update(organizations)
    .set({
      score: finalScore,
      scoreIsManual: isManual,
      scoreMethod: isManual ? "manual_override" : calc.method,
      scoreBreakdown: calc.normalizedBreakdown,
      scoreUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  if (collectionId) {
    await db
      .update(collectionMemberships)
      .set({
        score: finalScore,
        scoreIsManual: isManual,
        scoreBreakdown: calc.normalizedBreakdown,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(collectionMemberships.collectionId, collectionId),
          eq(collectionMemberships.organizationId, organizationId)
        )
      );
  }

  await db.insert(activities).values({
    id: `act_${crypto.randomUUID().slice(0, 10)}`,
    workspaceId,
    organizationId,
    collectionId: collectionId || null,
    actorOrigin: isManual ? "user" : "system",
    activityType: "score_updated",
    title: `Opportunity score updated to ${finalScore ?? "Unscored"}/100 (${isManual ? "Manual Override" : "Weighted Calculation"})`,
    metadata: { finalScore, breakdown: calc.normalizedBreakdown },
  });

  return { score: finalScore, isManual, breakdown: calc.normalizedBreakdown };
}
