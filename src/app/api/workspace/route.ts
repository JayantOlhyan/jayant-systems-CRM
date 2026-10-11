import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, DEFAULT_WORKSPACE_ID, DEFAULT_PIPELINE_ID } from "@/db";
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
  contactSuppressions,
  savedViews,
  savedMappings,
  importBatches,
  sourceRecords,
} from "@/db/schema";
import {
  getFullWorkspaceData,
  queryLeadsPaginated,
  getLeadDetail,
  createOrUpdateLead,
  createCollection,
  calculateAndSaveOrganizationScore,
} from "@/lib/crm-service";
import { ensureWorkspaceSeeded } from "@/lib/seed-workspace";
import { normalizeDomain } from "@/lib/domain-utils";

let initialSeedChecked = false;

export async function GET(req: NextRequest) {
  try {
    if (!initialSeedChecked && process.env.CRM_SKIP_AUTO_SEED !== "true") {
      initialSeedChecked = true;
      await ensureWorkspaceSeeded(DEFAULT_WORKSPACE_ID);
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "full";

    if (view === "lead_detail") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
      const detail = await getLeadDetail(id, DEFAULT_WORKSPACE_ID);
      if (!detail) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      return NextResponse.json(detail);
    }

    if (view === "leads_paginated") {
      const page = Number(searchParams.get("page") || "1");
      const rawPageSize = (searchParams.get("pageSize") || "50").toLowerCase();
      const pageSize =
        rawPageSize === "unlimited" || rawPageSize === "all" || rawPageSize === "0"
          ? "unlimited"
          : Number(rawPageSize || "50");
      const result = await queryLeadsPaginated(
        {
          search: searchParams.get("search") || undefined,
          collectionId: searchParams.get("collectionId") || undefined,
          market: searchParams.get("market") || undefined,
          country: searchParams.get("country") || undefined,
          category: searchParams.get("category") || undefined,
          stageId: searchParams.get("stageId") || undefined,
          verificationLevel: searchParams.get("verificationLevel") || undefined,
          qualificationDecision: searchParams.get("qualificationDecision") || undefined,
          outreachApproval: searchParams.get("outreachApproval") || undefined,
          tag: searchParams.get("tag") || undefined,
          minScore: searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined,
          hasWarning: searchParams.get("hasWarning") === "true",
          includeArchived: searchParams.get("includeArchived") === "true",
          sortBy: (searchParams.get("sortBy") as "name" | "score" | "createdAt" | "updatedAt" | "country") || "updatedAt",
          sortDir: (searchParams.get("sortDir") as "asc" | "desc") || "desc",
          page,
          pageSize,
        },
        DEFAULT_WORKSPACE_ID
      );
      return NextResponse.json(result);
    }

    const fullData = await getFullWorkspaceData(DEFAULT_WORKSPACE_ID);
    return NextResponse.json(fullData);
  } catch (err) {
    console.error("GET /api/workspace error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load workspace" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;
    const db = await getDb();
    const workspaceId = DEFAULT_WORKSPACE_ID;

    switch (action) {
      case "upsert_lead": {
        const id = await createOrUpdateLead(payload, workspaceId);
        return NextResponse.json({ ok: true, id });
      }

      case "inline_update_lead": {
        const { id, updates } = payload;
        if (!id || !updates) {
          return NextResponse.json({ error: "Missing lead id or updates" }, { status: 400 });
        }
        const existingRows = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, id));
        if (existingRows.length === 0) {
          return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }
        const current = existingRows[0];

        await createOrUpdateLead(
          {
            id,
            name: updates.name ?? current.name,
            ...updates,
          },
          workspaceId
        );
        return NextResponse.json({ ok: true });
      }

      case "bulk_update_leads": {
        const { ids, operation, value } = payload as {
          ids: string[];
          operation:
            | "change_stage"
            | "add_tag"
            | "assign_collection"
            | "remove_from_collection"
            | "set_qualification"
            | "archive"
            | "restore"
            | "permanent_delete";
          value?: string;
        };

        if (!Array.isArray(ids) || ids.length === 0) {
          return NextResponse.json({ error: "No records selected" }, { status: 400 });
        }

        if (operation === "change_stage" && value) {
          await db
            .update(organizations)
            .set({ primaryStageId: value, updatedAt: new Date() })
            .where(inArray(organizations.id, ids));
        } else if (operation === "add_tag" && value) {
          const rows = await db
            .select()
            .from(organizations)
            .where(inArray(organizations.id, ids));
          for (const r of rows) {
            const nextTags = Array.from(new Set([...(r.tags || []), value.trim()]));
            await db
              .update(organizations)
              .set({ tags: nextTags, updatedAt: new Date() })
              .where(eq(organizations.id, r.id));
          }
        } else if (operation === "assign_collection" && value) {
          for (const orgId of ids) {
            const existing = await db
              .select()
              .from(collectionMemberships)
              .where(
                and(
                  eq(collectionMemberships.collectionId, value),
                  eq(collectionMemberships.organizationId, orgId)
                )
              );
            if (existing.length === 0) {
              await db.insert(collectionMemberships).values({
                id: `mem_${crypto.randomUUID().slice(0, 10)}`,
                workspaceId,
                collectionId: value,
                organizationId: orgId,
                stageId: "stg_new",
              });
            }
          }
        } else if (operation === "remove_from_collection" && value) {
          for (const orgId of ids) {
            await db
              .delete(collectionMemberships)
              .where(
                and(
                  eq(collectionMemberships.collectionId, value),
                  eq(collectionMemberships.organizationId, orgId)
                )
              );
          }
        } else if (operation === "set_qualification" && value) {
          await db
            .update(organizations)
            .set({ qualificationDecision: value, updatedAt: new Date() })
            .where(inArray(organizations.id, ids));
        } else if (operation === "archive") {
          await db
            .update(organizations)
            .set({ archivedAt: new Date(), updatedAt: new Date() })
            .where(inArray(organizations.id, ids));
        } else if (operation === "restore") {
          await db
            .update(organizations)
            .set({ archivedAt: null, updatedAt: new Date() })
            .where(inArray(organizations.id, ids));
        } else if (operation === "permanent_delete") {
          await db.delete(organizations).where(inArray(organizations.id, ids));
        }

        await db.insert(activities).values({
          id: `act_${crypto.randomUUID().slice(0, 10)}`,
          workspaceId,
          actorOrigin: "user",
          activityType: "bulk_action",
          title: `Bulk operation (${operation}) applied to ${ids.length} lead(s)`,
        });

        return NextResponse.json({ ok: true, count: ids.length });
      }

      case "calculate_score": {
        const { organizationId, dimensionInputs, collectionId, manualOverrideScore } = payload;
        const res = await calculateAndSaveOrganizationScore(
          organizationId,
          dimensionInputs || {},
          collectionId,
          manualOverrideScore,
          workspaceId
        );
        return NextResponse.json({ ok: true, ...res });
      }

      case "create_collection": {
        const id = await createCollection(payload, workspaceId);
        return NextResponse.json({ ok: true, id });
      }

      case "update_collection": {
        const { id, name, description, icon, color, defaultView, isPinned, scoringConfig, archived } =
          payload;
        const updates: Partial<typeof collections.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (icon !== undefined) updates.icon = icon;
        if (color !== undefined) updates.color = color;
        if (defaultView !== undefined) updates.defaultView = defaultView;
        if (isPinned !== undefined) updates.isPinned = Boolean(isPinned);
        if (scoringConfig !== undefined) updates.scoringConfig = scoringConfig;
        if (archived !== undefined) updates.archivedAt = archived ? new Date() : null;

        await db.update(collections).set(updates).where(eq(collections.id, id));
        return NextResponse.json({ ok: true });
      }

      case "duplicate_collection": {
        const { id } = payload;
        const existing = await db.select().from(collections).where(eq(collections.id, id));
        if (existing.length === 0) {
          return NextResponse.json({ error: "Collection not found" }, { status: 404 });
        }
        const src = existing[0];
        const srcCats = await db.select().from(categories).where(eq(categories.collectionId, id));
        const srcFields = await db
          .select()
          .from(fieldDefinitions)
          .where(eq(fieldDefinitions.collectionId, id));

        const newId = await createCollection(
          {
            name: `${src.name} (Copy)`,
            description: src.description || undefined,
            icon: src.icon,
            color: src.color,
            recordType: src.recordType,
            defaultView: src.defaultView,
            categories: srcCats.map((c) => c.name),
            customFields: srcFields.map((f) => ({
              name: f.name,
              fieldType: f.fieldType,
              isRequired: f.isRequired,
              options: f.options,
            })),
            scoringConfig: src.scoringConfig,
          },
          workspaceId
        );
        return NextResponse.json({ ok: true, id: newId });
      }

      case "delete_collection": {
        // Section 7.2: Deleting a collection must not automatically delete shared company or contact records!
        const { id } = payload;
        await db.delete(collectionMemberships).where(eq(collectionMemberships.collectionId, id));
        await db.delete(collections).where(eq(collections.id, id));
        return NextResponse.json({ ok: true });
      }

      case "create_custom_field": {
        const { collectionId, name, fieldType, description, defaultValue, isRequired, options } =
          payload;
        const key = String(name)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
        const id = `fld_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(fieldDefinitions).values({
          id,
          workspaceId,
          collectionId: collectionId || null,
          name: String(name).trim(),
          key,
          fieldType: fieldType || "text",
          description: description || null,
          defaultValue: defaultValue || null,
          isRequired: Boolean(isRequired),
          isVisible: true,
          options: Array.isArray(options) ? options : [],
        });
        return NextResponse.json({ ok: true, id, key });
      }

      case "archive_custom_field": {
        const { id } = payload;
        await db
          .update(fieldDefinitions)
          .set({ archivedAt: new Date() })
          .where(eq(fieldDefinitions.id, id));
        return NextResponse.json({ ok: true });
      }

      case "create_category": {
        const { collectionId, name, color } = payload;
        const id = `cat_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(categories).values({
          id,
          workspaceId,
          collectionId: collectionId || null,
          name: String(name).trim(),
          color: color || "#7958F5",
        });
        return NextResponse.json({ ok: true, id });
      }

      case "delete_category": {
        const { id } = payload;
        await db.delete(categories).where(eq(categories.id, id));
        return NextResponse.json({ ok: true });
      }

      case "create_tag": {
        const { name, color } = payload;
        const id = `tag_${crypto.randomUUID().slice(0, 10)}`;
        await db
          .insert(tags)
          .values({
            id,
            workspaceId,
            name: String(name).trim(),
            color: color || "#659BFA",
          })
          .onConflictDoNothing();
        return NextResponse.json({ ok: true, id });
      }

      case "upsert_opportunity": {
        const {
          id,
          organizationId,
          collectionId,
          primaryContactId,
          name,
          serviceType,
          description,
          pipelineId,
          stageId,
          estimatedValue,
          currency,
          probability,
          priority,
          expectedCloseDate,
          nextAction,
          notes: oppNotes,
          outcome,
        } = payload;

        const cleanValue =
          estimatedValue === "" || estimatedValue === null || estimatedValue === undefined
            ? null
            : String(estimatedValue);

        if (id) {
          const existing = await db.select().from(opportunities).where(eq(opportunities.id, id));
          const prev = existing[0];
          await db
            .update(opportunities)
            .set({
              name: name ?? prev?.name,
              serviceType: serviceType ?? prev?.serviceType,
              description: description !== undefined ? description : prev?.description,
              stageId: stageId ?? prev?.stageId,
              estimatedValue: cleanValue !== undefined ? cleanValue : prev?.estimatedValue,
              currency: currency ?? prev?.currency,
              probability: probability !== undefined ? Number(probability) : prev?.probability,
              priority: priority ?? prev?.priority,
              expectedCloseDate:
                expectedCloseDate !== undefined ? expectedCloseDate : prev?.expectedCloseDate,
              nextAction: nextAction !== undefined ? nextAction : prev?.nextAction,
              notes: oppNotes !== undefined ? oppNotes : prev?.notes,
              outcome: outcome ?? prev?.outcome,
              updatedAt: new Date(),
            })
            .where(eq(opportunities.id, id));

          if (prev && stageId && stageId !== prev.stageId) {
            const stgRows = await db.select().from(pipelineStages);
            const fromStg = stgRows.find((s) => s.id === prev.stageId);
            const toStg = stgRows.find((s) => s.id === stageId);
            await db.insert(pipelineStageHistory).values({
              id: `psh_${crypto.randomUUID().slice(0, 10)}`,
              workspaceId,
              organizationId: prev.organizationId,
              opportunityId: id,
              fromStageId: prev.stageId,
              fromStageName: fromStg?.name || prev.stageId,
              toStageId: stageId,
              toStageName: toStg?.name || stageId,
              changedBy: "user",
            });
            await db.insert(activities).values({
              id: `act_${crypto.randomUUID().slice(0, 10)}`,
              workspaceId,
              organizationId: prev.organizationId,
              opportunityId: id,
              actorOrigin: "user",
              activityType: "stage_changed",
              title: `Opportunity "${prev.name}" moved to ${toStg?.name || stageId}`,
            });
          }

          return NextResponse.json({ ok: true, id });
        }

        const newId = `opp_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(opportunities).values({
          id: newId,
          workspaceId,
          organizationId,
          collectionId: collectionId || null,
          primaryContactId: primaryContactId || null,
          name: String(name).trim(),
          serviceType: serviceType || "Website Development",
          description: description || null,
          pipelineId: pipelineId || DEFAULT_PIPELINE_ID,
          stageId: stageId || "stg_new",
          estimatedValue: cleanValue,
          currency: currency || "INR",
          probability: probability !== undefined && probability !== "" ? Number(probability) : null,
          priority: priority || "medium",
          expectedCloseDate: expectedCloseDate || null,
          nextAction: nextAction || null,
          notes: oppNotes || null,
          outcome: outcome || "open",
        });

        await db.insert(activities).values({
          id: `act_${crypto.randomUUID().slice(0, 10)}`,
          workspaceId,
          organizationId,
          opportunityId: newId,
          actorOrigin: "user",
          activityType: "opportunity_created",
          title: `Opportunity created: ${String(name).trim()}`,
        });

        return NextResponse.json({ ok: true, id: newId });
      }

      case "upsert_pipeline_stage": {
        const { id, pipelineId, name, color, sortOrder, classification } = payload;
        if (id) {
          await db
            .update(pipelineStages)
            .set({
              name,
              color,
              sortOrder: Number(sortOrder || 0),
              classification: classification || "open",
            })
            .where(eq(pipelineStages.id, id));
          return NextResponse.json({ ok: true, id });
        }
        const newId = `stg_${crypto.randomUUID().slice(0, 8)}`;
        await db.insert(pipelineStages).values({
          id: newId,
          pipelineId: pipelineId || DEFAULT_PIPELINE_ID,
          name: String(name).trim(),
          color: color || "#7958F5",
          sortOrder: Number(sortOrder || 10),
          classification: classification || "open",
        });
        return NextResponse.json({ ok: true, id: newId });
      }

      case "upsert_contact": {
        const {
          id,
          organizationId,
          fullName,
          jobTitle,
          department,
          email,
          phone,
          linkedinUrl,
          preferredChannel,
          country,
          city,
          notes: contactNotes,
          doNotContact,
          approvalStatus,
        } = payload;

        if (id) {
          await db
            .update(contacts)
            .set({
              organizationId: organizationId || null,
              fullName: String(fullName).trim(),
              jobTitle: jobTitle || null,
              department: department || null,
              email: email || null,
              phone: phone || null,
              linkedinUrl: linkedinUrl || null,
              preferredChannel: preferredChannel || null,
              country: country || null,
              city: city || null,
              notes: contactNotes || null,
              doNotContact: Boolean(doNotContact),
              optOutRecorded: Boolean(doNotContact),
              approvalStatus: doNotContact ? "suppressed" : approvalStatus || "not approved",
              lastEligibilityReview: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, id));
          return NextResponse.json({ ok: true, id });
        }

        const newId = `cnt_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(contacts).values({
          id: newId,
          workspaceId,
          organizationId: organizationId || null,
          fullName: String(fullName).trim(),
          jobTitle: jobTitle || null,
          department: department || null,
          email: email || null,
          phone: phone || null,
          linkedinUrl: linkedinUrl || null,
          preferredChannel: preferredChannel || null,
          country: country || null,
          city: city || null,
          notes: contactNotes || null,
          doNotContact: Boolean(doNotContact),
          optOutRecorded: Boolean(doNotContact),
          approvalStatus: doNotContact ? "suppressed" : approvalStatus || "not approved",
        });

        if (doNotContact) {
          await db.insert(contactSuppressions).values({
            id: `dnc_${crypto.randomUUID().slice(0, 10)}`,
            workspaceId,
            businessOrDomain: String(fullName).trim(),
            contactOrChannel: email || phone || null,
            optOutDate: new Date().toISOString().split("T")[0],
            reasonOrSource: "Marked Do Not Contact in Contact Directory",
            status: "Do Not Contact",
          });
        }

        await db.insert(activities).values({
          id: `act_${crypto.randomUUID().slice(0, 10)}`,
          workspaceId,
          organizationId: organizationId || null,
          contactId: newId,
          actorOrigin: "user",
          activityType: "contact_added",
          title: `Contact saved: ${String(fullName).trim()}`,
        });

        return NextResponse.json({ ok: true, id: newId });
      }

      case "add_suppression": {
        const { businessOrDomain, contactOrChannel, reasonOrSource, notes: supNotes } = payload;
        const id = `dnc_${crypto.randomUUID().slice(0, 10)}`;
        const normDom = normalizeDomain(businessOrDomain);
        await db.insert(contactSuppressions).values({
          id,
          workspaceId,
          businessOrDomain: String(businessOrDomain).trim(),
          normalizedDomain: normDom,
          contactOrChannel: contactOrChannel || null,
          optOutDate: new Date().toISOString().split("T")[0],
          reasonOrSource: reasonOrSource || "Manual user exclusion",
          status: "Do Not Contact",
          notes: supNotes || null,
        });

        // Also update matching organization's optOutStatus & outreachApproval
        if (normDom) {
          await db
            .update(organizations)
            .set({
              optOutStatus: "opted out / suppressed",
              outreachApproval: "do not contact",
              updatedAt: new Date(),
            })
            .where(eq(organizations.normalizedDomain, normDom));
        }

        return NextResponse.json({ ok: true, id });
      }

      case "add_note": {
        const { organizationId, opportunityId, contactId, content, isPinned } = payload;
        const id = `note_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(notes).values({
          id,
          workspaceId,
          organizationId: organizationId || null,
          opportunityId: opportunityId || null,
          contactId: contactId || null,
          content: String(content).trim(),
          isPinned: Boolean(isPinned),
          origin: "user",
        });

        await db.insert(activities).values({
          id: `act_${crypto.randomUUID().slice(0, 10)}`,
          workspaceId,
          organizationId: organizationId || null,
          opportunityId: opportunityId || null,
          actorOrigin: "user",
          activityType: "note_added",
          title: "Note added to record",
          description: String(content).trim().slice(0, 140),
        });

        return NextResponse.json({ ok: true, id });
      }

      case "toggle_pin_note": {
        const { id, isPinned } = payload;
        await db
          .update(notes)
          .set({ isPinned: Boolean(isPinned), updatedAt: new Date() })
          .where(eq(notes.id, id));
        return NextResponse.json({ ok: true });
      }

      case "delete_note": {
        const { id } = payload;
        await db.delete(notes).where(eq(notes.id, id));
        return NextResponse.json({ ok: true });
      }

      case "upsert_task": {
        const {
          id,
          title,
          description,
          taskType,
          organizationId,
          opportunityId,
          contactId,
          collectionId,
          priority,
          status,
          dueDate,
          dueTime,
          reminderSetting,
          notes: taskNotes,
        } = payload;

        if (id) {
          const isCompleted = status === "Completed";
          await db
            .update(tasks)
            .set({
              title: String(title).trim(),
              description: description || null,
              taskType: taskType || "Follow-up",
              priority: priority || "medium",
              status: status || "To Do",
              dueDate: dueDate || new Date().toISOString().split("T")[0],
              dueTime: dueTime || null,
              reminderSetting: reminderSetting || "day_of",
              notes: taskNotes || null,
              completedAt: isCompleted ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, id));

          if (isCompleted) {
            await db.insert(activities).values({
              id: `act_${crypto.randomUUID().slice(0, 10)}`,
              workspaceId,
              organizationId: organizationId || null,
              actorOrigin: "user",
              activityType: "task_completed",
              title: `Task completed: ${String(title).trim()}`,
            });
          }
          return NextResponse.json({ ok: true, id });
        }

        const newId = `tsk_${crypto.randomUUID().slice(0, 10)}`;
        const resolvedDate = dueDate || new Date().toISOString().split("T")[0];
        await db.insert(tasks).values({
          id: newId,
          workspaceId,
          title: String(title).trim(),
          description: description || null,
          taskType: taskType || "Follow-up",
          organizationId: organizationId || null,
          opportunityId: opportunityId || null,
          contactId: contactId || null,
          collectionId: collectionId || null,
          priority: priority || "medium",
          status: status || "To Do",
          dueDate: resolvedDate,
          dueTime: dueTime || null,
          reminderSetting: reminderSetting || "day_of",
          notes: taskNotes || null,
        });

        if (organizationId) {
          await db
            .update(organizations)
            .set({
              nextAction: String(title).trim(),
              nextFollowUpAt: new Date(`${resolvedDate}T${dueTime || "10:00"}:00Z`),
              updatedAt: new Date(),
            })
            .where(eq(organizations.id, organizationId));
        }

        await db.insert(activities).values({
          id: `act_${crypto.randomUUID().slice(0, 10)}`,
          workspaceId,
          organizationId: organizationId || null,
          actorOrigin: "user",
          activityType: "followup_scheduled",
          title: `Follow-up scheduled: ${String(title).trim()} (${resolvedDate})`,
        });

        return NextResponse.json({ ok: true, id: newId });
      }

      case "toggle_task_status": {
        const { id, status } = payload;
        const existing = await db.select().from(tasks).where(eq(tasks.id, id));
        if (existing.length === 0) {
          return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }
        const t = existing[0];
        const nextStatus = status || (t.status === "Completed" ? "To Do" : "Completed");
        await db
          .update(tasks)
          .set({
            status: nextStatus,
            completedAt: nextStatus === "Completed" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, id));

        if (nextStatus === "Completed") {
          await db.insert(activities).values({
            id: `act_${crypto.randomUUID().slice(0, 10)}`,
            workspaceId,
            organizationId: t.organizationId,
            actorOrigin: "user",
            activityType: "task_completed",
            title: `Completed: ${t.title}`,
          });
        }
        return NextResponse.json({ ok: true, status: nextStatus });
      }

      case "log_manual_activity": {
        // Section 16.6: Manual activity logging (Email Sent, Call Made, Meeting Held, Message Received, Follow-up Completed, Proposal Sent)
        const { organizationId, contactId, opportunityId, activityType, title, description } =
          payload;

        // Check suppression first (Section 17.4)
        if (organizationId) {
          const orgRows = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, organizationId));
          if (
            orgRows[0]?.outreachApproval === "do not contact" ||
            orgRows[0]?.optOutStatus?.includes("suppressed")
          ) {
            return NextResponse.json(
              {
                error:
                  "Outreach action blocked: Organization is marked Do Not Contact / Suppressed.",
              },
              { status: 400 }
            );
          }
        }

        const id = `act_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(activities).values({
          id,
          workspaceId,
          organizationId: organizationId || null,
          contactId: contactId || null,
          opportunityId: opportunityId || null,
          actorOrigin: "user",
          activityType: activityType || "manual_log",
          title: `[Manually Logged] ${title}`,
          description: description || null,
        });

        if (contactId) {
          await db
            .update(contacts)
            .set({ lastContactedAt: new Date(), updatedAt: new Date() })
            .where(eq(contacts.id, contactId));
        }
        return NextResponse.json({ ok: true, id });
      }

      case "add_attachment": {
        const { organizationId, filename, mimeType, sizeBytes, category, dataUrl, notes: attNotes } =
          payload;
        if (sizeBytes > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: "File exceeds 10MB attachment limit." },
            { status: 400 }
          );
        }
        const id = `att_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(attachments).values({
          id,
          workspaceId,
          organizationId,
          filename: String(filename),
          mimeType: String(mimeType || "application/octet-stream"),
          sizeBytes: Number(sizeBytes || 0),
          category: category || "Document",
          dataUrl: String(dataUrl),
          notes: attNotes || null,
        });
        await db.insert(activities).values({
          id: `act_${crypto.randomUUID().slice(0, 10)}`,
          workspaceId,
          organizationId,
          actorOrigin: "user",
          activityType: "file_attached",
          title: `File attached: ${filename}`,
        });
        return NextResponse.json({ ok: true, id });
      }

      case "upsert_reference": {
        const {
          id,
          title,
          url,
          description,
          category,
          tags: refTags,
          screenshotUrl,
          notes: refNotes,
          organizationId,
          opportunityId,
          collectionId,
        } = payload;

        if (id) {
          await db
            .update(referencesLibrary)
            .set({
              title: String(title).trim(),
              url: String(url).trim(),
              description: description || null,
              category: category || "For Reference",
              tags: Array.isArray(refTags) ? refTags : [],
              screenshotUrl: screenshotUrl || null,
              notes: refNotes || null,
              organizationId: organizationId || null,
              opportunityId: opportunityId || null,
              collectionId: collectionId || null,
            })
            .where(eq(referencesLibrary.id, id));
          return NextResponse.json({ ok: true, id });
        }

        const newId = `ref_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(referencesLibrary).values({
          id: newId,
          workspaceId,
          title: String(title).trim(),
          url: String(url).trim(),
          description: description || null,
          category: category || "For Reference",
          tags: Array.isArray(refTags) ? refTags : [],
          screenshotUrl: screenshotUrl || null,
          notes: refNotes || null,
          organizationId: organizationId || null,
          opportunityId: opportunityId || null,
          collectionId: collectionId || null,
        });

        await db.insert(activities).values({
          id: `act_${crypto.randomUUID().slice(0, 10)}`,
          workspaceId,
          organizationId: organizationId || null,
          actorOrigin: "user",
          activityType: "reference_saved",
          title: `Reference saved: ${String(title).trim()} (${category || "For Reference"})`,
        });

        return NextResponse.json({ ok: true, id: newId });
      }

      case "upsert_content_idea": {
        // Section 19: Content Idea Management & [Create Content Idea From Lead]
        const {
          id,
          title,
          hook,
          description,
          platform,
          contentType,
          organizationId,
          referenceId,
          category,
          priority,
          status,
          notes: ideaNotes,
          targetPublicationDate,
          publishedUrl,
        } = payload;

        if (id) {
          await db
            .update(contentIdeas)
            .set({
              title: String(title).trim(),
              hook: hook || null,
              description: description || null,
              platform: platform || "Instagram Reels",
              contentType: contentType || "Website Audit / Breakdown",
              organizationId: organizationId || null,
              referenceId: referenceId || null,
              category: category || "Good Reel",
              priority: priority || "medium",
              status: status || "Idea",
              notes: ideaNotes || null,
              targetPublicationDate: targetPublicationDate || null,
              publishedUrl: publishedUrl || null,
              updatedAt: new Date(),
            })
            .where(eq(contentIdeas.id, id));
          return NextResponse.json({ ok: true, id });
        }

        const newId = `cid_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(contentIdeas).values({
          id: newId,
          workspaceId,
          title: String(title).trim(),
          hook: hook || null,
          description: description || null,
          platform: platform || "Instagram Reels",
          contentType: contentType || "Website Audit / Breakdown",
          organizationId: organizationId || null,
          referenceId: referenceId || null,
          category: category || "Good Reel",
          priority: priority || "medium",
          status: status || "Idea",
          notes: ideaNotes || null,
          targetPublicationDate: targetPublicationDate || null,
          publishedUrl: publishedUrl || null,
        });

        await db.insert(activities).values({
          id: `act_${crypto.randomUUID().slice(0, 10)}`,
          workspaceId,
          organizationId: organizationId || null,
          actorOrigin: "user",
          activityType: "content_idea_created",
          title: `Content idea created: ${String(title).trim()}`,
        });

        return NextResponse.json({ ok: true, id: newId });
      }

      case "save_view": {
        const { collectionId, name, filters, sortConfig, visibleColumns, viewMode } = payload;
        const id = `view_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(savedViews).values({
          id,
          workspaceId,
          collectionId: collectionId || null,
          name: String(name).trim(),
          filters: filters || {},
          sortConfig: sortConfig || {},
          visibleColumns: visibleColumns || [],
          viewMode: viewMode || "table",
        });
        return NextResponse.json({ ok: true, id });
      }

      case "delete_saved_view": {
        const { id } = payload;
        await db.delete(savedViews).where(eq(savedViews.id, id));
        return NextResponse.json({ ok: true });
      }

      case "save_mapping_template": {
        const { name, mapping } = payload;
        const id = `map_${crypto.randomUUID().slice(0, 10)}`;
        await db.insert(savedMappings).values({
          id,
          workspaceId,
          name: String(name).trim(),
          mapping: mapping || {},
        });
        return NextResponse.json({ ok: true, id });
      }

      case "update_workspace_settings": {
        const { name, defaultCurrency, timezone, dateFormat, theme, defaultLandingPage } = payload;
        await db
          .update(workspaces)
          .set({
            name: name || "Jayant Web & AI Systems",
            defaultCurrency: defaultCurrency || "INR",
            timezone: timezone || "Asia/Kolkata",
            dateFormat: dateFormat || "DD MMM YYYY",
            theme: theme || "dark",
            defaultLandingPage: defaultLandingPage || "/dashboard",
            updatedAt: new Date(),
          })
          .where(eq(workspaces.id, workspaceId));
        return NextResponse.json({ ok: true });
      }

      case "reset_to_empty_workspace": {
        await db.delete(sourceRecords).where(eq(sourceRecords.workspaceId, workspaceId));
        await db.delete(importBatches).where(eq(importBatches.workspaceId, workspaceId));
        await db.delete(opportunities).where(eq(opportunities.workspaceId, workspaceId));
        await db.delete(tasks).where(eq(tasks.workspaceId, workspaceId));
        await db.delete(notes).where(eq(notes.workspaceId, workspaceId));
        await db.delete(contacts).where(eq(contacts.workspaceId, workspaceId));
        await db.delete(referencesLibrary).where(eq(referencesLibrary.workspaceId, workspaceId));
        await db.delete(contentIdeas).where(eq(contentIdeas.workspaceId, workspaceId));
        await db.delete(collectionMemberships).where(eq(collectionMemberships.workspaceId, workspaceId));
        await db.delete(organizations).where(eq(organizations.workspaceId, workspaceId));
        await db.delete(activities).where(eq(activities.workspaceId, workspaceId));
        return NextResponse.json({ ok: true });
      }

      case "reseed_workspace": {
        const res = await ensureWorkspaceSeeded(workspaceId);
        return NextResponse.json({ ok: true, ...res });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("POST /api/workspace error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Operation failed" },
      { status: 500 }
    );
  }
}
