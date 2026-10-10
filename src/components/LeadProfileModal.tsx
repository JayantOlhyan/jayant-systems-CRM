"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  X,
  Globe,
  ExternalLink,
  AlertTriangle,
  Edit3,
  Plus,
  Calendar,
  Paperclip,
  Archive,
  Pin,
  CheckCircle2,
  Sparkles,
  Phone,
  Mail,
  Video,
  FileText,
  Sliders,
  ShieldAlert,
  Database,
  Layers,
} from "lucide-react";
import { DEFAULT_SCORING_CONFIG, type ScoringConfigJSON } from "@/db/schema";

interface LeadProfileModalProps {
  organizationId: string;
  collections: Array<{ id: string; name: string; color: string; scoringConfig?: ScoringConfigJSON }>;
  stages: Array<{ id: string; name: string; color: string }>;
  fieldDefinitions: Array<{
    id: string;
    collectionId: string | null;
    name: string;
    key: string;
    fieldType: string;
    options: string[];
  }>;
  onClose: () => void;
  onMutated: () => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function LeadProfileModal({
  organizationId,
  collections,
  stages,
  fieldDefinitions,
  onClose,
  onMutated,
  notify,
}: LeadProfileModalProps) {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "contacts"
    | "opportunities"
    | "notes"
    | "activity"
    | "tasks"
    | "files"
    | "source"
  >("overview");
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detail, setDetail] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editMarket, setEditMarket] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editObservedFacts, setEditObservedFacts] = useState("");
  const [editPublishedContact, setEditPublishedContact] = useState("");
  const [editContactEvidenceUrl, setEditContactEvidenceUrl] = useState("");
  const [editQualification, setEditQualification] = useState("not reviewed");
  const [editOutreachApproval, setEditOutreachApproval] = useState("not approved");
  const [editVerification, setEditVerification] = useState("site description");
  const [editNextAction, setEditNextAction] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCategories, setEditCategories] = useState("");
  const [editCustomValues, setEditCustomValues] = useState<Record<string, unknown>>({});

  // Scoring state
  const [scoreBreakdown, setScoreBreakdown] = useState<Record<string, number>>({});
  const [manualScoreInput, setManualScoreInput] = useState<string>("");

  // Quick sub-forms
  const [newNoteText, setNewNoteText] = useState("");
  const [newNotePinned, setNewNotePinned] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState("Follow-up");
  const [newTaskPriority, setNewTaskPriority] = useState("high");
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split("T")[0]);
  const [newTaskTime, setNewTaskTime] = useState("10:00");

  const [newOppName, setNewOppName] = useState("");
  const [newOppService, setNewOppService] = useState("Website Redesign");
  const [newOppStage, setNewOppStage] = useState("stg_new");
  const [newOppValue, setNewOppValue] = useState("");
  const [newOppCurrency, setNewOppCurrency] = useState("INR");
  const [newOppNextAction, setNewOppNextAction] = useState("");

  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactDnc, setNewContactDnc] = useState(false);

  const [manualActType, setManualActType] = useState("email_sent");
  const [manualActTitle, setManualActTitle] = useState("");

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace?view=lead_detail&id=${organizationId}`);
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();
      setDetail(data);
      const o = data.organization;
      setEditName(o.name || "");
      setEditWebsite(o.websiteUrl || "");
      setEditCountry(o.country || "");
      setEditCity(o.city || "");
      setEditMarket(o.market || "");
      setEditIndustry(o.industry || "");
      setEditObservedFacts(o.observedFacts || "");
      setEditPublishedContact(o.publishedContact || "");
      setEditContactEvidenceUrl(o.contactEvidenceUrl || "");
      setEditQualification(o.qualificationDecision || "not reviewed");
      setEditOutreachApproval(o.outreachApproval || "not approved");
      setEditVerification(o.verificationLevel || "site description");
      setEditNextAction(o.nextAction || "");
      setEditTags((o.tags || []).join(", "));
      setEditCategories((o.categories || []).join(", "));
      setEditCustomValues(o.customValues || {});
      setScoreBreakdown(o.scoreBreakdown || {});
      setManualScoreInput(o.score !== null && o.score !== undefined ? String(o.score) : "");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error loading lead", "error");
    } finally {
      setLoading(false);
    }
  }, [organizationId, notify]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (loading || !detail) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-4xl bg-app-surface border-l border-app-border h-full p-6 overflow-y-auto animate-pulse space-y-4">
          <div className="h-8 w-64 bg-app-secondary rounded" />
          <div className="h-4 w-96 bg-app-secondary rounded" />
          <div className="h-64 bg-app-secondary rounded-xl mt-6" />
        </div>
      </div>
    );
  }

  const org = detail.organization;
  const activeStage = stages.find((s) => s.id === org.primaryStageId) || stages[0];
  const memberCollectionIds: string[] = (detail.memberships || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => m.collectionId
  );
  const primaryCol =
    collections.find((c) => memberCollectionIds.includes(c.id)) || collections[0];
  const scoringConfig = primaryCol?.scoringConfig || DEFAULT_SCORING_CONFIG;

  async function handleSaveOverview(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_lead",
        payload: {
          id: org.id,
          name: editName,
          websiteUrl: editWebsite || null,
          country: editCountry || null,
          city: editCity || null,
          market: editMarket || null,
          industry: editIndustry || null,
          observedFacts: editObservedFacts || null,
          publishedContact: editPublishedContact || null,
          contactEvidenceUrl: editContactEvidenceUrl || null,
          qualificationDecision: editQualification,
          outreachApproval: editOutreachApproval,
          verificationLevel: editVerification,
          nextAction: editNextAction || null,
          tags: editTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          categories: editCategories
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          customValues: editCustomValues,
        },
      }),
    });
    if (res.ok) {
      setIsEditing(false);
      await fetchDetail();
      await onMutated();
      notify("Lead profile saved", "success");
    }
  }

  async function handleStageChange(newStageId: string) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "inline_update_lead",
        payload: { id: org.id, updates: { primaryStageId: newStageId } },
      }),
    });
    await fetchDetail();
    await onMutated();
    notify("Pipeline stage updated", "success");
  }

  async function handleToggleCollectionMembership(colId: string) {
    const isMember = memberCollectionIds.includes(colId);
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk_update_leads",
        payload: {
          ids: [org.id],
          operation: isMember ? "remove_from_collection" : "assign_collection",
          value: colId,
        },
      }),
    });
    await fetchDetail();
    await onMutated();
    notify(isMember ? "Removed from collection" : "Added to collection", "info");
  }

  async function handleSaveScore(useManual: boolean) {
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "calculate_score",
        payload: {
          organizationId: org.id,
          dimensionInputs: scoreBreakdown,
          collectionId: primaryCol?.id,
          manualOverrideScore:
            useManual && manualScoreInput !== "" ? Number(manualScoreInput) : undefined,
        },
      }),
    });
    if (res.ok) {
      await fetchDetail();
      await onMutated();
      notify("Opportunity score updated", "success");
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_note",
        payload: {
          organizationId: org.id,
          content: newNoteText,
          isPinned: newNotePinned,
        },
      }),
    });
    setNewNoteText("");
    setNewNotePinned(false);
    await fetchDetail();
    await onMutated();
    notify("Note added", "success");
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_task",
        payload: {
          organizationId: org.id,
          collectionId: primaryCol?.id,
          title: newTaskTitle,
          taskType: newTaskType,
          priority: newTaskPriority,
          dueDate: newTaskDate,
          dueTime: newTaskTime,
        },
      }),
    });
    setNewTaskTitle("");
    await fetchDetail();
    await onMutated();
    notify("Follow-up task scheduled", "success");
  }

  async function handleCreateOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!newOppName.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_opportunity",
        payload: {
          organizationId: org.id,
          collectionId: primaryCol?.id,
          name: newOppName,
          serviceType: newOppService,
          stageId: newOppStage,
          estimatedValue: newOppValue === "" ? null : newOppValue,
          currency: newOppCurrency,
          nextAction: newOppNextAction,
        },
      }),
    });
    setNewOppName("");
    setNewOppValue("");
    setNewOppNextAction("");
    await fetchDetail();
    await onMutated();
    notify("Opportunity created", "success");
  }

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newContactName.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_contact",
        payload: {
          organizationId: org.id,
          fullName: newContactName,
          jobTitle: newContactRole,
          email: newContactEmail,
          phone: newContactPhone,
          country: org.country,
          doNotContact: newContactDnc,
        },
      }),
    });
    setNewContactName("");
    setNewContactRole("");
    setNewContactEmail("");
    setNewContactPhone("");
    setNewContactDnc(false);
    await fetchDetail();
    await onMutated();
    notify("Contact added", "success");
  }

  async function handleLogManualActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!manualActTitle.trim()) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "log_manual_activity",
        payload: {
          organizationId: org.id,
          activityType: manualActType,
          title: manualActTitle,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || "Unable to log activity", "error");
      return;
    }
    setManualActTitle("");
    await fetchDetail();
    await onMutated();
    notify("Manual activity recorded", "success");
  }

  async function handleCreateContentIdeaFromLead() {
    // Section 19.3: Explicit user action [Create Content Idea From Lead], prefilling factual info without inventing problems
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_content_idea",
        payload: {
          organizationId: org.id,
          title: `${org.name} (${org.industry || "E-Commerce"}) — Storefront Breakdown`,
          hook: org.observedFacts
            ? `Observed on ${org.normalizedDomain || org.name}: ${org.observedFacts}`
            : `Storefront review for ${org.name}`,
          description:
            org.observedFacts ||
            `Factual reference record created from lead ${org.name} (${org.websiteUrl || "no website"}).`,
          platform: "Instagram Reels",
          contentType: "Website Audit / Breakdown",
          category: "Good Reel",
          priority: "medium",
          status: "Idea",
        },
      }),
    });
    if (res.ok) {
      await fetchDetail();
      await onMutated();
      notify(`Content idea created from ${org.name}`, "success");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notify("File exceeds 10MB limit", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_attachment",
          payload: {
            organizationId: org.id,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            category: file.type.startsWith("image/") ? "Screenshot" : "Document",
            dataUrl: String(reader.result),
          },
        }),
      });
      if (res.ok) {
        await fetchDetail();
        notify(`Attached ${file.name}`, "success");
      }
    };
    reader.readAsDataURL(file);
  }

  const applicableCustomFields = fieldDefinitions.filter(
    (f) => !f.collectionId || memberCollectionIds.includes(f.collectionId)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-profile-heading"
    >
      <div className="w-full max-w-4xl bg-app-surface border-l border-app-border h-full flex flex-col overflow-hidden shadow-2xl">
        {/* Top Profile Header (Matches Mockup 4) */}
        <div className="p-5 border-b border-app-border bg-app-sidebar">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-accent/20 border border-accent/40 text-accent font-heading font-bold text-base flex items-center justify-center shrink-0">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="lead-profile-heading"
                    className="text-lg font-heading font-bold text-text-primary"
                  >
                    {org.name}
                  </h2>
                  {org.externalId && (
                    <span className="px-2 py-0.5 rounded bg-app-secondary border border-app-border font-mono text-[11px] text-text-secondary">
                      {org.externalId}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${
                      org.score !== null && org.score >= 75
                        ? "bg-status-success/15 text-status-success"
                        : org.score !== null && org.score >= 50
                        ? "bg-status-warning/15 text-status-warning"
                        : org.score !== null
                        ? "bg-status-error/15 text-status-error"
                        : "bg-app-secondary text-text-muted"
                    }`}
                  >
                    {org.score !== null ? `${org.score} / 100` : "Unscored"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary mt-1">
                  {org.websiteUrl && org.normalizedDomain ? (
                    <a
                      href={
                        org.websiteUrl.startsWith("http")
                          ? org.websiteUrl
                          : `https://${org.websiteUrl}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-accent hover:underline font-mono"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {org.normalizedDomain}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-status-warning font-mono">
                      No verified website domain
                    </span>
                  )}
                  <span>•</span>
                  <span>{org.country || "Unknown Country"}</span>
                  {org.market && (
                    <>
                      <span>•</span>
                      <span>Market: {org.market}</span>
                    </>
                  )}
                  {org.industry && (
                    <>
                      <span>•</span>
                      <span>{org.industry}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Pipeline Stage"
                value={activeStage?.id || "stg_new"}
                onChange={(e) => handleStageChange(e.target.value)}
                className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    Stage: {s.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("overview");
                  setIsEditing(!isEditing);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-medium text-text-primary"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isEditing ? "Cancel Edit" : "Edit"}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("tasks")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
              >
                <Calendar className="w-3.5 h-3.5" />
                + Follow-up
              </button>

              <button
                type="button"
                onClick={handleCreateContentIdeaFromLead}
                title="Create Content Idea from Lead"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-app-surface hover:bg-app-elevated border border-app-border text-xs text-text-secondary hover:text-text-primary"
              >
                <Video className="w-3.5 h-3.5 text-accent" />
                Reel Idea
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close lead profile"
                className="p-1.5 rounded-lg bg-app-surface hover:bg-app-elevated border border-app-border text-text-secondary hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Governance & Verification Banner */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-app-border/70 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border text-text-secondary">
              Source Status: <strong className="text-text-primary">{org.sourceLeadStatus || "candidate"}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border text-text-secondary">
              Qualification: <strong className="text-text-primary">{org.qualificationDecision}</strong>
            </span>
            <span
              className={`px-2 py-0.5 rounded border ${
                org.outreachApproval === "approved"
                  ? "bg-status-success/10 border-status-success/30 text-status-success"
                  : org.outreachApproval === "do not contact"
                  ? "bg-status-error/10 border-status-error/30 text-status-error"
                  : "bg-status-warning/10 border-status-warning/30 text-status-warning"
              }`}
            >
              Outreach Approval: <strong>{org.outreachApproval}</strong>
            </span>
            <span
              className={`px-2 py-0.5 rounded border ${
                org.verificationLevel.toLowerCase().includes("directory")
                  ? "bg-status-warning/15 border-status-warning/40 text-status-warning"
                  : "bg-status-success/10 border-status-success/30 text-status-success"
              }`}
            >
              Verification: <strong>{org.verificationLevel}</strong>
            </span>
          </div>

          {/* Tabs Navigation */}
          <div className="flex items-center gap-1 mt-4 -mb-5 overflow-x-auto">
            {[
              { id: "overview", label: "Overview" },
              { id: "contacts", label: `Contacts (${detail.contacts.length})` },
              { id: "opportunities", label: `Opportunities (${detail.opportunities.length})` },
              { id: "notes", label: `Notes (${detail.notes.length})` },
              { id: "activity", label: `Activity (${detail.activities.length})` },
              { id: "tasks", label: `Tasks (${detail.tasks.length})` },
              { id: "files", label: `Files (${detail.attachments.length})` },
              { id: "source", label: `Source Data (${detail.sourceRecords.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === t.id
                    ? "border-accent text-accent"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Warning Banners if Directory-Only or Invalid Contact Evidence URL */}
          {org.verificationLevel.toLowerCase().includes("directory") && (
            <div className="p-3.5 rounded-xl bg-status-warning/10 border border-status-warning/40 flex items-start gap-3 text-xs text-status-warning">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Directory-Only Listing — Requires Identity &amp; Domain Verification:</strong>{" "}
                This record was imported from a directory listing without an independently verified website description. Verify the official domain before approving outreach.
              </div>
            </div>
          )}

          {!org.contactEvidenceValid && org.contactEvidenceUrl && (
            <div className="p-3.5 rounded-xl bg-status-error/10 border border-status-error/40 flex items-start gap-3 text-xs text-status-error">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Source Data Anomaly in Contact Evidence URL:</strong> Raw value{" "}
                <code className="px-1.5 py-0.5 rounded bg-app-secondary font-mono">
                  {org.contactEvidenceUrl}
                </code>{" "}
                is not a valid URL ({org.contactEvidenceWarning}). Clickable link generation is disabled and this value has not been interpreted as confirmed outreach.
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {isEditing ? (
                  <form
                    onSubmit={handleSaveOverview}
                    className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-4"
                  >
                    <h3 className="text-sm font-heading font-semibold text-text-primary">
                      Edit Lead &amp; Governance Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label htmlFor="edit-name" className="block text-text-secondary mb-1">
                          Company Name *
                        </label>
                        <input
                          id="edit-name"
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-website" className="block text-text-secondary mb-1">
                          Official Website
                        </label>
                        <input
                          id="edit-website"
                          type="text"
                          value={editWebsite}
                          onChange={(e) => setEditWebsite(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-country" className="block text-text-secondary mb-1">
                          Country
                        </label>
                        <input
                          id="edit-country"
                          type="text"
                          value={editCountry}
                          onChange={(e) => setEditCountry(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-market" className="block text-text-secondary mb-1">
                          Market
                        </label>
                        <input
                          id="edit-market"
                          type="text"
                          value={editMarket}
                          onChange={(e) => setEditMarket(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-niche" className="block text-text-secondary mb-1">
                          Niche / Industry
                        </label>
                        <input
                          id="edit-niche"
                          type="text"
                          value={editIndustry}
                          onChange={(e) => setEditIndustry(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-contact" className="block text-text-secondary mb-1">
                          Published Business Contact
                        </label>
                        <input
                          id="edit-contact"
                          type="text"
                          value={editPublishedContact}
                          onChange={(e) => setEditPublishedContact(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-evidence" className="block text-text-secondary mb-1">
                          Contact Evidence URL
                        </label>
                        <input
                          id="edit-evidence"
                          type="text"
                          value={editContactEvidenceUrl}
                          onChange={(e) => setEditContactEvidenceUrl(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-qual" className="block text-text-secondary mb-1">
                          Qualification Decision
                        </label>
                        <select
                          id="edit-qual"
                          value={editQualification}
                          onChange={(e) => setEditQualification(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        >
                          <option value="not reviewed">not reviewed</option>
                          <option value="qualified">qualified</option>
                          <option value="disqualified">disqualified</option>
                          <option value="needs research">needs research</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="edit-outreach" className="block text-text-secondary mb-1">
                          Outreach Approval
                        </label>
                        <select
                          id="edit-outreach"
                          value={editOutreachApproval}
                          onChange={(e) => setEditOutreachApproval(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        >
                          <option value="not approved">not approved</option>
                          <option value="approved">approved</option>
                          <option value="do not contact">do not contact</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="edit-verif" className="block text-text-secondary mb-1">
                          Verification Level
                        </label>
                        <select
                          id="edit-verif"
                          value={editVerification}
                          onChange={(e) => setEditVerification(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        >
                          <option value="site description">site description</option>
                          <option value="directory listing only">directory listing only</option>
                          <option value="manually verified">manually verified</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="edit-cats" className="block text-text-secondary mb-1">
                          Categories (comma-separated)
                        </label>
                        <input
                          id="edit-cats"
                          type="text"
                          value={editCategories}
                          onChange={(e) => setEditCategories(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-tags" className="block text-text-secondary mb-1">
                          Tags (comma-separated)
                        </label>
                        <input
                          id="edit-tags"
                          type="text"
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label htmlFor="edit-facts" className="block text-text-secondary mb-1">
                        Observed Business Facts (from site)
                      </label>
                      <textarea
                        id="edit-facts"
                        rows={3}
                        value={editObservedFacts}
                        onChange={(e) => setEditObservedFacts(e.target.value)}
                        className="w-full bg-app-surface border border-app-border rounded-lg p-2.5 text-text-primary"
                      />
                    </div>

                    {/* Custom Fields Section */}
                    {applicableCustomFields.length > 0 && (
                      <div className="pt-3 border-t border-app-border space-y-2">
                        <div className="text-xs font-mono uppercase text-text-muted">
                          Collection Custom Fields
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {applicableCustomFields.map((cf) => (
                            <div key={cf.id}>
                              <label className="block text-text-secondary mb-1">{cf.name}</label>
                              <input
                                type="text"
                                value={String(editCustomValues[cf.key] ?? "")}
                                onChange={(e) =>
                                  setEditCustomValues((prev) => ({
                                    ...prev,
                                    [cf.key]: e.target.value,
                                  }))
                                }
                                className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3.5 py-1.5 rounded-lg bg-app-surface border border-app-border text-xs text-text-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-mono uppercase text-text-muted">
                        Basic Information &amp; Site Evidence
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="text-xs text-accent hover:underline"
                      >
                        Edit Fields
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-text-muted block">Company Name</span>
                        <strong className="text-text-primary">{org.name}</strong>
                      </div>
                      <div>
                        <span className="text-text-muted block">Website</span>
                        <span className="font-mono text-text-primary">
                          {org.websiteUrl || "Not available"}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block">Country / Market</span>
                        <span className="text-text-primary">
                          {org.country || "—"} ({org.market || "—"})
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block">Niche / Industry</span>
                        <span className="text-text-primary">{org.industry || "—"}</span>
                      </div>
                      <div>
                        <span className="text-text-muted block">Published Contact</span>
                        <span className="font-mono text-text-primary">
                          {org.publishedContact || "Unknown"}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block">Contact Evidence URL</span>
                        {org.contactEvidenceUrl ? (
                          org.contactEvidenceValid ? (
                            <a
                              href={org.contactEvidenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline font-mono truncate block"
                            >
                              {org.contactEvidenceUrl}
                            </a>
                          ) : (
                            <span className="text-status-error font-mono">
                              {org.contactEvidenceUrl} (Invalid URL)
                            </span>
                          )
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-app-border">
                      <div className="text-xs text-text-muted mb-1">
                        Observed Fact (from site)
                      </div>
                      <p className="text-xs text-text-primary bg-app-surface p-3 rounded-lg border border-app-border leading-relaxed">
                        {org.observedFacts || "No site observations recorded yet."}
                      </p>
                    </div>

                    {org.sourceNotes && (
                      <div>
                        <div className="text-xs text-text-muted mb-1">Source Ledger Notes</div>
                        <p className="text-xs text-text-secondary bg-app-surface p-2.5 rounded-lg border border-app-border">
                          {org.sourceNotes}
                        </p>
                      </div>
                    )}

                    {/* Collections Membership Pills */}
                    <div className="pt-3 border-t border-app-border">
                      <div className="text-xs text-text-muted mb-2">
                        Collection Memberships (Shared Company Record)
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {collections.map((c) => {
                          const active = memberCollectionIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleToggleCollectionMembership(c.id)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                                active
                                  ? "bg-accent/15 border-accent text-accent"
                                  : "bg-app-surface border-app-border text-text-muted hover:text-text-primary"
                              }`}
                            >
                              {active ? "✓ " : "+ "}
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Configurable Opportunity Scoring Card (Section 14) */}
                <div className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-accent" />
                      <h3 className="text-xs font-mono uppercase text-text-primary">
                        Opportunity Score Assessment ({primaryCol?.name || "Default"})
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-text-secondary">
                      Origin: <strong>{org.scoreMethod}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {scoringConfig.dimensions.map((dim) => (
                      <div
                        key={dim.key}
                        className="p-2.5 rounded-lg bg-app-surface border border-app-border text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-text-primary">{dim.label}</span>
                          <span className="font-mono text-text-muted">{dim.weight}% wt</span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="0 - 100"
                          value={scoreBreakdown[dim.key] ?? ""}
                          onChange={(e) =>
                            setScoreBreakdown((prev) => ({
                              ...prev,
                              [dim.key]: Number(e.target.value),
                            }))
                          }
                          className="w-full bg-app-secondary border border-app-border rounded px-2 py-1 text-xs font-mono text-text-primary"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-app-border">
                    <button
                      type="button"
                      onClick={() => handleSaveScore(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
                    >
                      Calculate Weighted Score
                    </button>

                    <div className="flex items-center gap-2">
                      <label htmlFor="manual-score" className="text-xs text-text-secondary">
                        Manual Score Override (0–100):
                      </label>
                      <input
                        id="manual-score"
                        type="number"
                        min={0}
                        max={100}
                        value={manualScoreInput}
                        onChange={(e) => setManualScoreInput(e.target.value)}
                        className="w-20 bg-app-surface border border-app-border rounded px-2 py-1 text-xs font-mono text-text-primary"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveScore(true)}
                        className="px-3 py-1.5 rounded-lg bg-app-elevated border border-app-border text-xs font-medium text-text-primary"
                      >
                        Override
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Next Action & Recent Activity */}
              <div className="space-y-4">
                <div className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-2">
                  <div className="text-xs font-mono uppercase text-text-muted">Next Action</div>
                  <p className="text-xs font-medium text-text-primary">
                    {org.nextAction || "Review qualification & site evidence"}
                  </p>
                  {org.nextFollowUpAt && (
                    <div className="text-[11px] font-mono text-accent">
                      Due: {new Date(org.nextFollowUpAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-3">
                  <div className="text-xs font-mono uppercase text-text-muted">
                    Recent Record Activity
                  </div>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {detail.activities.length === 0 ? (
                      <p className="text-xs text-text-muted">No activity recorded yet.</p>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      detail.activities.slice(0, 8).map((act: any) => (
                        <div
                          key={act.id}
                          className="text-xs border-l-2 border-accent pl-2.5 py-0.5"
                        >
                          <div className="text-text-primary font-medium">{act.title}</div>
                          <div className="text-[10px] font-mono text-text-muted">
                            {act.actorOrigin.toUpperCase()} •{" "}
                            {new Date(act.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACTS */}
          {activeTab === "contacts" && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateContact}
                className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-3"
              >
                <h3 className="text-xs font-mono uppercase text-text-primary">
                  Add Contact for {org.name}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <input
                    type="text"
                    required
                    placeholder="Full Name *"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                  <input
                    type="text"
                    placeholder="Job Title (e.g. Founder)"
                    value={newContactRole}
                    onChange={(e) => setNewContactRole(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                  <input
                    type="email"
                    placeholder="Business Email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={newContactDnc}
                      onChange={(e) => setNewContactDnc(e.target.checked)}
                    />
                    Mark as Do Not Contact (Suppress Outreach)
                  </label>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold"
                  >
                    + Save Contact
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {detail.contacts.length === 0 ? (
                  <div className="p-6 text-center bg-app-secondary border border-app-border rounded-xl text-xs text-text-secondary">
                    No individual contacts stored yet. Published business contact on record:{" "}
                    <strong className="font-mono text-text-primary">
                      {org.publishedContact || "Unknown"}
                    </strong>
                  </div>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  detail.contacts.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl bg-app-secondary border border-app-border flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-heading font-semibold text-sm text-text-primary flex items-center gap-2">
                          {c.fullName}
                          {c.doNotContact && (
                            <span className="px-2 py-0.5 rounded bg-status-error/15 text-status-error text-[10px] font-mono">
                              DO NOT CONTACT
                            </span>
                          )}
                        </div>
                        <div className="text-text-secondary mt-0.5">
                          {c.jobTitle || "Role unknown"} • {c.email || "No email"} •{" "}
                          {c.phone || "No phone"}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-text-muted">
                        Approval: {c.approvalStatus}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OPPORTUNITIES */}
          {activeTab === "opportunities" && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateOpportunity}
                className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-3"
              >
                <h3 className="text-xs font-mono uppercase text-text-primary">
                  Create Opportunity for {org.name} (Supports Multiple Opportunities per Company)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <input
                    type="text"
                    required
                    placeholder="Opportunity Name (e.g. Storefront Redesign) *"
                    value={newOppName}
                    onChange={(e) => setNewOppName(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                  <input
                    type="text"
                    placeholder="Service Type (e.g. Web Dev / AI)"
                    value={newOppService}
                    onChange={(e) => setNewOppService(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                  <select
                    value={newOppStage}
                    onChange={(e) => setNewOppStage(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        Stage: {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Estimated Value (leave blank if unknown)"
                    value={newOppValue}
                    onChange={(e) => setNewOppValue(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                  <select
                    value={newOppCurrency}
                    onChange={(e) => setNewOppCurrency(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Next Action"
                    value={newOppNextAction}
                    onChange={(e) => setNewOppNextAction(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold"
                  >
                    + Add Opportunity
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {detail.opportunities.length === 0 ? (
                  <div className="p-6 text-center bg-app-secondary border border-app-border rounded-xl text-xs text-text-secondary">
                    No active sales opportunities created for this organization yet.
                  </div>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  detail.opportunities.map((opp: any) => {
                    const stg = stages.find((s) => s.id === opp.stageId);
                    return (
                      <div
                        key={opp.id}
                        className="p-4 rounded-xl bg-app-secondary border border-app-border flex flex-wrap items-center justify-between gap-4 text-xs"
                      >
                        <div>
                          <div className="font-heading font-semibold text-sm text-text-primary">
                            {opp.name}
                          </div>
                          <div className="text-text-secondary mt-0.5">
                            {opp.serviceType} • Value:{" "}
                            <strong className="font-mono text-text-primary">
                              {opp.estimatedValue !== null && opp.estimatedValue !== undefined
                                ? `${opp.currency} ${Number(opp.estimatedValue).toLocaleString()}`
                                : "Unknown (Not Estimated)"}
                            </strong>
                          </div>
                          {opp.nextAction && (
                            <div className="text-text-muted mt-1">
                              Next Action: {opp.nextAction}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded bg-app-surface border border-app-border font-mono">
                            {stg?.name || opp.stageId}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: NOTES */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              <form
                onSubmit={handleAddNote}
                className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-3"
              >
                <textarea
                  rows={3}
                  required
                  placeholder="Write detailed research note, website audit findings, or conversation summary..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full bg-app-surface border border-app-border rounded-lg p-3 text-xs text-text-primary"
                />
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={newNotePinned}
                      onChange={(e) => setNewNotePinned(e.target.checked)}
                    />
                    Pin important note to top
                  </label>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold"
                  >
                    Save Note
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {detail.notes.length === 0 ? (
                  <p className="text-xs text-text-secondary text-center py-6">
                    No user notes added yet.
                  </p>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  detail.notes.map((n: any) => (
                    <div
                      key={n.id}
                      className={`p-4 rounded-xl border text-xs space-y-2 ${
                        n.isPinned
                          ? "bg-accent/10 border-accent/40"
                          : "bg-app-secondary border-app-border"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
                        <span className="flex items-center gap-1.5">
                          {n.isPinned && <Pin className="w-3 h-3 text-accent" />}
                          {n.origin.toUpperCase()} NOTE •{" "}
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
                        {n.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: ACTIVITY */}
          {activeTab === "activity" && (
            <div className="space-y-5">
              <form
                onSubmit={handleLogManualActivity}
                className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-3"
              >
                <h3 className="text-xs font-mono uppercase text-text-primary">
                  Log Manual Communication / Activity
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <select
                    value={manualActType}
                    onChange={(e) => setManualActType(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  >
                    <option value="email_sent">Email Sent</option>
                    <option value="call_made">Call Made</option>
                    <option value="meeting_held">Meeting Held</option>
                    <option value="message_received">Message Received</option>
                    <option value="followup_completed">Follow-up Completed</option>
                    <option value="proposal_sent">Proposal Sent</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Summary of interaction..."
                    value={manualActTitle}
                    onChange={(e) => setManualActTitle(e.target.value)}
                    className="sm:col-span-2 bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold"
                  >
                    Log Activity
                  </button>
                </div>
              </form>

              <div className="space-y-2.5">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {detail.activities.map((a: any) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-xl bg-app-secondary border border-app-border flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-medium text-text-primary">{a.title}</div>
                      {a.description && (
                        <div className="text-text-secondary mt-0.5">{a.description}</div>
                      )}
                    </div>
                    <div className="text-right font-mono text-[11px] text-text-muted shrink-0">
                      <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border mr-2">
                        {a.actorOrigin}
                      </span>
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: TASKS & FOLLOW-UPS */}
          {activeTab === "tasks" && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateTask}
                className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-3"
              >
                <h3 className="text-xs font-mono uppercase text-text-primary">
                  Schedule Follow-up or Task
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <input
                    type="text"
                    required
                    placeholder="Task / Follow-up Title *"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="sm:col-span-2 bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  >
                    <option value="Follow-up">Follow-up</option>
                    <option value="Research">Research / Audit</option>
                    <option value="Email">Email</option>
                    <option value="Call">Call</option>
                    <option value="Proposal">Proposal</option>
                  </select>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold"
                  >
                    Schedule Task
                  </button>
                </div>
              </form>

              <div className="space-y-2.5">
                {detail.tasks.length === 0 ? (
                  <p className="text-xs text-text-secondary text-center py-6">
                    No tasks scheduled for this record.
                  </p>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  detail.tasks.map((t: any) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl bg-app-secondary border border-app-border flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={t.status === "Completed"}
                          onChange={async () => {
                            await fetch("/api/workspace", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "toggle_task_status",
                                payload: { id: t.id },
                              }),
                            });
                            await fetchDetail();
                            await onMutated();
                          }}
                        />
                        <span
                          className={
                            t.status === "Completed"
                              ? "line-through text-text-muted"
                              : "font-medium text-text-primary"
                          }
                        >
                          {t.title}
                        </span>
                      </div>
                      <span className="font-mono text-text-secondary">
                        Due {t.dueDate} {t.dueTime || ""}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 7: FILES */}
          {activeTab === "files" && (
            <div className="space-y-4">
              <div className="bg-app-secondary border border-app-border rounded-xl p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-text-primary">
                    Attachments &amp; Audit Documents
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Upload website screenshots, audit PDFs, or proposals (Max 10MB).
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer">
                  <Paperclip className="w-3.5 h-3.5" />
                  Attach File
                  <input type="file" className="sr-only" onChange={handleFileUpload} />
                </label>
              </div>

              <div className="space-y-2.5">
                {detail.attachments.length === 0 ? (
                  <p className="text-xs text-text-secondary text-center py-6">
                    No files attached to this organization yet.
                  </p>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  detail.attachments.map((att: any) => (
                    <div
                      key={att.id}
                      className="p-3.5 rounded-xl bg-app-secondary border border-app-border flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-accent" />
                        <div>
                          <div className="font-medium text-text-primary">{att.filename}</div>
                          <div className="text-[11px] font-mono text-text-muted">
                            {(att.sizeBytes / 1024).toFixed(1)} KB • {att.category}
                          </div>
                        </div>
                      </div>
                      <a
                        href={att.dataUrl}
                        download={att.filename}
                        className="text-accent hover:underline font-medium"
                      >
                        Download
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 8: SOURCE DATA PROVENANCE (Section 11.9) */}
          {activeTab === "source" && (
            <div className="space-y-4">
              {detail.sourceRecords.length === 0 ? (
                <div className="p-6 text-center bg-app-secondary border border-app-border rounded-xl text-xs text-text-secondary">
                  This record was created manually in the CRM and has no external spreadsheet provenance.
                </div>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                detail.sourceRecords.map((sr: any) => (
                  <div
                    key={sr.id}
                    className="bg-app-secondary border border-app-border rounded-xl p-4 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-app-border">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-accent" />
                        <strong className="text-text-primary">{sr.sourceFilename}</strong>
                      </div>
                      <div className="font-mono text-[11px] text-text-secondary">
                        Sheet: <strong>{sr.sheetName}</strong> • Row:{" "}
                        <strong>#{sr.rowNumber}</strong> • Lead ID:{" "}
                        <strong>{sr.externalLeadId || "—"}</strong> • Batch:{" "}
                        <strong>{sr.importBatchId}</strong>
                      </div>
                    </div>

                    {sr.validationWarnings && sr.validationWarnings.length > 0 && (
                      <div className="p-2.5 rounded bg-status-warning/15 border border-status-warning/30 text-status-warning">
                        <div className="font-semibold mb-1">Import Validation Warnings:</div>
                        {sr.validationWarnings.map((w: string, idx: number) => (
                          <div key={idx}>• {w}</div>
                        ))}
                      </div>
                    )}

                    <div>
                      <div className="text-[11px] font-mono uppercase text-text-muted mb-2">
                        Preserved Original Spreadsheet Row Values
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(sr.rawValues || {}).map(([col, val]) => (
                          <div
                            key={col}
                            className="p-2 rounded bg-app-surface border border-app-border flex justify-between gap-2"
                          >
                            <span className="text-text-muted">{col}:</span>
                            <span className="font-mono text-text-primary text-right break-all">
                              {String(val || "—")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
