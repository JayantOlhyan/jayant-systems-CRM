"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  X,
  Globe,
  AlertTriangle,
  Edit3,
  Paperclip,
  Pin,
  CheckCircle2,
  Phone,
  Mail,
  Video,
  FileText,
  Sliders,
  ShieldAlert,
  Database,
  Bookmark,
  Send,
  MessageSquare,
  Heart,
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Compass,
  Maximize2,
} from "lucide-react";
import { DEFAULT_SCORING_CONFIG, type ScoringConfigJSON } from "@/db/schema";

export function resolveLeadWebPages(org: {
  websiteUrl?: string | null;
  normalizedDomain?: string | null;
  contactEvidenceUrl?: string | null;
  contactEvidenceValid?: boolean | null;
}): {
  websitePageUrl: string | null;
  contactPageUrl: string | null;
  displayDomain: string | null;
  hasVerifiedContactPage: boolean;
} {
  let websitePageUrl: string | null = null;
  let contactPageUrl: string | null = null;
  let displayDomain: string | null = org.normalizedDomain || null;

  const rawWebsite = (org.websiteUrl || "").trim();
  if (rawWebsite && rawWebsite.toLowerCase() !== "unknown") {
    websitePageUrl = rawWebsite.startsWith("http") ? rawWebsite : `https://${rawWebsite}`;
  }

  const rawContact = (org.contactEvidenceUrl || "").trim();
  const hasVerifiedContactPage = Boolean(org.contactEvidenceValid && rawContact);
  if (hasVerifiedContactPage) {
    contactPageUrl = rawContact.startsWith("http") ? rawContact : `https://${rawContact}`;
  }

  // When there's a Contact Page URL, ensure we ALWAYS also have the root Website Page URL
  if (!websitePageUrl && contactPageUrl) {
    try {
      const parsed = new URL(contactPageUrl);
      websitePageUrl = parsed.origin;
      if (!displayDomain) {
        displayDomain = parsed.hostname.replace(/^www\./i, "");
      }
    } catch {
      // ignore invalid URL
    }
  }

  if (!displayDomain && websitePageUrl) {
    try {
      displayDomain = new URL(websitePageUrl).hostname.replace(/^www\./i, "");
    } catch {
      displayDomain = websitePageUrl;
    }
  }

  // If there is a Website Page but no explicit Contact Page URL, provide a standard /contact path
  // if it's different from the contactPageUrl
  if (websitePageUrl && !contactPageUrl) {
    try {
      const parsed = new URL(websitePageUrl);
      contactPageUrl = `${parsed.origin}/contact`;
    } catch {
      // ignore
    }
  }

  return {
    websitePageUrl,
    contactPageUrl,
    displayDomain,
    hasVerifiedContactPage,
  };
}

interface LeadProfileModalProps {
  organizationId: string;
  allOrganizationIds?: string[];
  onSelectOrganization?: (id: string) => void;
  initialTab?: "overview" | "website" | "notes_tasks" | "more";
  initialSitePage?: "website" | "contact";
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
  allOrganizationIds = [],
  onSelectOrganization,
  initialTab = "overview",
  initialSitePage = "website",
  collections,
  stages,
  fieldDefinitions,
  onClose,
  onMutated,
  notify,
}: LeadProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "website" | "notes_tasks" | "more">(
    initialTab
  );
  const [siteViewerMode, setSiteViewerMode] = useState<"website" | "contact">(initialSitePage);
  const [customBrowserUrl, setCustomBrowserUrl] = useState<string>("");
  const [iframeRefreshKey, setIframeRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detail, setDetail] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Quick Message Box state
  const [quickMessageText, setQuickMessageText] = useState("");
  const [quickMessageChannel, setQuickMessageChannel] = useState("Email");

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

  const currentIdx = allOrganizationIds.indexOf(organizationId);
  const prevOrgId = currentIdx > 0 ? allOrganizationIds[currentIdx - 1] : null;
  const nextOrgId =
    currentIdx !== -1 && currentIdx < allOrganizationIds.length - 1
      ? allOrganizationIds[currentIdx + 1]
      : null;

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
      setQuickMessageText(
        `Hi ${o.name} team — we reviewed ${o.normalizedDomain || "your storefront"} (${
          o.observedFacts || "e-commerce store"
        }) and put together a quick breakdown of conversion & AI automation upgrades for your team.`
      );
      setCustomBrowserUrl("");
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
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-[96vw] max-w-[1440px] h-[88vh] bg-app-surface border border-app-border rounded-3xl p-8 overflow-y-auto animate-pulse space-y-6 shadow-2xl"
        >
          <div className="h-10 w-80 bg-app-secondary rounded-lg" />
          <div className="h-5 w-96 bg-app-secondary rounded-lg" />
          <div className="h-[60vh] bg-app-secondary rounded-2xl mt-8" />
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

  const { websitePageUrl, contactPageUrl, displayDomain, hasVerifiedContactPage } =
    resolveLeadWebPages(org);

  const activeTargetUrl =
    customBrowserUrl ||
    (siteViewerMode === "contact"
      ? contactPageUrl || websitePageUrl
      : websitePageUrl || contactPageUrl);

  function openInTabSiteViewer(mode: "website" | "contact", explicitUrl?: string) {
    setSiteViewerMode(mode);
    setCustomBrowserUrl(explicitUrl || "");
    setActiveTab("website");
  }

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

  async function handleToggleBookmarkInspiration() {
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_bookmark_inspiration",
        payload: { organizationId: org.id },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchDetail();
      await onMutated();
      notify(
        data.isBookmarked
          ? `Bookmarked ${org.name} website to Design Inspirations`
          : `Removed ${org.name} from Design Inspirations`,
        data.isBookmarked ? "success" : "info"
      );
    }
  }

  async function handleMessageOperation(
    messageStatus: "not_messaged" | "message_sent" | "followup_sent" | "replied",
    channel = quickMessageChannel,
    note?: string
  ) {
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_message_operation",
        payload: {
          organizationId: org.id,
          messageStatus,
          channel,
          note,
        },
      }),
    });
    if (res.ok) {
      await fetchDetail();
      await onMutated();
      const labels: Record<string, string> = {
        not_messaged: "Marked as Not Messaged",
        message_sent: `Marked Message Sent (${channel})`,
        followup_sent: `Marked Follow-up Sent (${channel})`,
        replied: `Marked Replied (${channel})`,
      };
      notify(labels[messageStatus] || "Message status updated", "success");
    }
  }

  async function handleTinderDecision(decision: "pass" | "qualify") {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "inline_update_lead",
        payload: {
          id: org.id,
          updates:
            decision === "qualify"
              ? {
                  qualificationDecision: "qualified",
                  outreachApproval: "approved",
                  primaryStageId:
                    org.primaryStageId === "stg_new" ? "stg_qualified" : org.primaryStageId,
                }
              : {
                  qualificationDecision: "disqualified",
                  primaryStageId: "stg_lost",
                },
        },
      }),
    });
    await fetchDetail();
    await onMutated();
    notify(
      decision === "qualify"
        ? `Qualified & approved ${org.name} for outreach`
        : `Passed on ${org.name}`,
      decision === "qualify" ? "success" : "info"
    );
    if (nextOrgId && onSelectOrganization) {
      onSelectOrganization(nextOrgId);
    }
  }

  const extractedEmail =
    detail.contacts?.[0]?.email ||
    (org.publishedContact && org.publishedContact.includes("@")
      ? org.publishedContact.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
      : null);

  const extractedPhone =
    detail.contacts?.[0]?.phone ||
    (org.publishedContact
      ? org.publishedContact.replace(/[^0-9+]/g, "").length >= 8
        ? org.publishedContact.replace(/[^0-9]/g, "")
        : null
      : null);

  const applicableCustomFields = fieldDefinitions.filter(
    (f) => !f.collectionId || memberCollectionIds.includes(f.collectionId)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-profile-heading"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[96vw] max-w-[1440px] h-[92vh] bg-app-surface border border-app-border rounded-3xl flex flex-col overflow-hidden shadow-2xl"
      >
        {/* SPACIOUS, UNCLUTTERED TOP HEADER */}
        <div className="px-6 pt-6 pb-0 border-b border-app-border bg-app-sidebar shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
            {/* Left: Identity + Website Page & Contact Page Buttons */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/40 text-accent font-heading font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2
                    id="lead-profile-heading"
                    className="text-xl sm:text-2xl font-heading font-bold text-text-primary tracking-tight"
                  >
                    {org.name}
                  </h2>
                  {org.externalId && (
                    <span className="px-2.5 py-0.5 rounded-md bg-app-secondary border border-app-border font-mono text-xs text-text-secondary">
                      {org.externalId}
                    </span>
                  )}
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-heading font-semibold tabular-nums ${
                      org.score !== null && org.score >= 75
                        ? "bg-status-success/15 text-status-success"
                        : org.score !== null && org.score >= 50
                        ? "bg-status-warning/15 text-status-warning"
                        : org.score !== null
                        ? "bg-status-error/15 text-status-error"
                        : "bg-app-secondary text-text-muted"
                    }`}
                  >
                    {org.score !== null ? `Score ${org.score} / 100` : "Unscored"}
                  </span>
                  {org.isBookmarked && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium">
                      <Bookmark className="w-3.5 h-3.5 fill-current" />
                      Bookmarked Inspiration
                    </span>
                  )}
                </div>

                {/* Subtitle + Side-by-Side Website Page & Contact Page Buttons (Open in This Tab Only) */}
                <div className="flex flex-wrap items-center gap-2.5 text-sm text-text-secondary">
                  <span>{org.country || "Unknown Country"}</span>
                  {org.market && (
                    <>
                      <span>•</span>
                      <span>{org.market} Market</span>
                    </>
                  )}
                  {org.industry && (
                    <>
                      <span>•</span>
                      <span className="text-text-primary font-medium">{org.industry}</span>
                    </>
                  )}

                  {/* Always show BOTH Website Page and Contact Page buttons when available, opening in this tab only */}
                  {websitePageUrl && (
                    <button
                      type="button"
                      onClick={() => openInTabSiteViewer("website")}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent/15 hover:bg-accent text-accent hover:text-white border border-accent/40 text-xs font-semibold transition ml-1"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Website Page ({displayDomain || "Open in This Tab"})
                    </button>
                  )}

                  {contactPageUrl && (
                    <button
                      type="button"
                      onClick={() => openInTabSiteViewer("contact")}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-app-surface hover:bg-app-elevated text-text-primary border border-app-border text-xs font-semibold transition"
                    >
                      <Compass className="w-3.5 h-3.5 text-accent" />
                      Contact Page {hasVerifiedContactPage ? "(Verified)" : "(In-Tab)"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Tinder-Style Navigation, Pass, Bookmark, Qualify, Stage & Close */}
            <div className="flex flex-wrap items-center gap-2">
              {allOrganizationIds.length > 1 && onSelectOrganization && (
                <div className="inline-flex items-center bg-app-surface border border-app-border rounded-xl p-1 mr-1">
                  <button
                    type="button"
                    disabled={!prevOrgId}
                    onClick={() => prevOrgId && onSelectOrganization(prevOrgId)}
                    title="Previous Lead Card"
                    className="p-1.5 rounded-lg hover:bg-app-elevated text-text-secondary hover:text-text-primary disabled:opacity-35"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2.5 font-mono text-xs tabular-nums text-text-secondary">
                    {currentIdx + 1} / {allOrganizationIds.length}
                  </span>
                  <button
                    type="button"
                    disabled={!nextOrgId}
                    onClick={() => nextOrgId && onSelectOrganization(nextOrgId)}
                    title="Next Lead Card"
                    className="p-1.5 rounded-lg hover:bg-app-elevated text-text-secondary hover:text-text-primary disabled:opacity-35"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleTinderDecision("pass")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-status-error/15 hover:bg-status-error/25 border border-status-error/30 text-status-error text-xs font-semibold transition"
              >
                <X className="w-4 h-4" />
                Pass
              </button>

              <button
                type="button"
                onClick={handleToggleBookmarkInspiration}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${
                  org.isBookmarked
                    ? "bg-accent text-white border-accent"
                    : "bg-app-surface hover:bg-app-elevated border-app-border text-text-primary"
                }`}
              >
                <Bookmark className={`w-4 h-4 ${org.isBookmarked ? "fill-current" : ""}`} />
                {org.isBookmarked ? "Bookmarked" : "Bookmark Site"}
              </button>

              <button
                type="button"
                onClick={() => handleTinderDecision("qualify")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-status-success/15 hover:bg-status-success/25 border border-status-success/40 text-status-success text-xs font-semibold transition"
              >
                <Heart className="w-4 h-4 fill-current" />
                Qualify
              </button>

              <select
                aria-label="Pipeline Stage"
                value={activeStage?.id || "stg_new"}
                onChange={(e) => handleStageChange(e.target.value)}
                className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-xs font-medium text-text-primary"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    Stage: {s.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close lead profile"
                className="p-2 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 4 CLEAN, SPACIOUS TOP-LEVEL TABS */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: "overview", label: "Overview & Outreach" },
              {
                id: "website",
                label: "Website & Contact Page (In-Tab)",
              },
              {
                id: "notes_tasks",
                label: `Notes (${detail.notes.length}) & Tasks (${detail.tasks.length})`,
              },
              {
                id: "more",
                label: `Score, Contacts (${detail.contacts.length}) & Provenance`,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === t.id
                    ? "border-accent text-accent font-semibold"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {/* Warning Banners if Directory-Only or Invalid Contact Evidence URL */}
          {org.verificationLevel.toLowerCase().includes("directory") && (
            <div className="mb-6 p-4 rounded-2xl bg-status-warning/10 border border-status-warning/40 flex items-start gap-3 text-sm text-status-warning">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong>Directory-Only Listing — Requires Domain Verification:</strong>{" "}
                Imported from a directory listing without an independently verified website description. Verify the official domain before outreach.
              </div>
            </div>
          )}

          {!org.contactEvidenceValid && org.contactEvidenceUrl && (
            <div className="mb-6 p-4 rounded-2xl bg-status-error/10 border border-status-error/40 flex items-start gap-3 text-sm text-status-error">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong>Source Data Anomaly in Contact Evidence URL:</strong> Raw value{" "}
                <code className="px-2 py-0.5 rounded bg-app-secondary font-mono">
                  {org.contactEvidenceUrl}
                </code>{" "}
                is not a valid URL ({org.contactEvidenceWarning}). Clickable link generation is disabled.
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW & OUTREACH (BIG, CLEAN, UNCLUTTERED) */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
              {/* Left 8 Columns: Business Evidence + Unified Outreach Operations */}
              <div className="lg:col-span-8 space-y-6">
                {isEditing ? (
                  <form
                    onSubmit={handleSaveOverview}
                    className="bg-app-secondary border border-app-border rounded-2xl p-6 space-y-5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-heading font-bold text-text-primary">
                        Edit Lead &amp; Governance Details
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="text-xs text-text-secondary hover:text-text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <label htmlFor="edit-name" className="block text-text-secondary mb-1.5">
                          Company Name *
                        </label>
                        <input
                          id="edit-name"
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-website" className="block text-text-secondary mb-1.5">
                          Website Page URL
                        </label>
                        <input
                          id="edit-website"
                          type="text"
                          value={editWebsite}
                          onChange={(e) => setEditWebsite(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-evidence" className="block text-text-secondary mb-1.5">
                          Contact Page / Evidence URL
                        </label>
                        <input
                          id="edit-evidence"
                          type="text"
                          value={editContactEvidenceUrl}
                          onChange={(e) => setEditContactEvidenceUrl(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-contact" className="block text-text-secondary mb-1.5">
                          Published Business Contact
                        </label>
                        <input
                          id="edit-contact"
                          type="text"
                          value={editPublishedContact}
                          onChange={(e) => setEditPublishedContact(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-country" className="block text-text-secondary mb-1.5">
                          Country
                        </label>
                        <input
                          id="edit-country"
                          type="text"
                          value={editCountry}
                          onChange={(e) => setEditCountry(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-market" className="block text-text-secondary mb-1.5">
                          Market
                        </label>
                        <input
                          id="edit-market"
                          type="text"
                          value={editMarket}
                          onChange={(e) => setEditMarket(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-niche" className="block text-text-secondary mb-1.5">
                          Niche / Industry
                        </label>
                        <input
                          id="edit-niche"
                          type="text"
                          value={editIndustry}
                          onChange={(e) => setEditIndustry(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-qual" className="block text-text-secondary mb-1.5">
                          Qualification Decision
                        </label>
                        <select
                          id="edit-qual"
                          value={editQualification}
                          onChange={(e) => setEditQualification(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        >
                          <option value="not reviewed">not reviewed</option>
                          <option value="qualified">qualified</option>
                          <option value="disqualified">disqualified</option>
                          <option value="needs research">needs research</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="edit-outreach" className="block text-text-secondary mb-1.5">
                          Outreach Approval
                        </label>
                        <select
                          id="edit-outreach"
                          value={editOutreachApproval}
                          onChange={(e) => setEditOutreachApproval(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        >
                          <option value="not approved">not approved</option>
                          <option value="approved">approved</option>
                          <option value="do not contact">do not contact</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="edit-verif" className="block text-text-secondary mb-1.5">
                          Verification Level
                        </label>
                        <select
                          id="edit-verif"
                          value={editVerification}
                          onChange={(e) => setEditVerification(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        >
                          <option value="site description">site description</option>
                          <option value="directory listing only">directory listing only</option>
                          <option value="manually verified">manually verified</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="edit-cats" className="block text-text-secondary mb-1.5">
                          Categories (comma-separated)
                        </label>
                        <input
                          id="edit-cats"
                          type="text"
                          value={editCategories}
                          onChange={(e) => setEditCategories(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-tags" className="block text-text-secondary mb-1.5">
                          Tags (comma-separated)
                        </label>
                        <input
                          id="edit-tags"
                          type="text"
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                        />
                      </div>
                    </div>

                    <div className="text-sm">
                      <label htmlFor="edit-facts" className="block text-text-secondary mb-1.5">
                        Observed Business Facts (from site)
                      </label>
                      <textarea
                        id="edit-facts"
                        rows={3}
                        value={editObservedFacts}
                        onChange={(e) => setEditObservedFacts(e.target.value)}
                        className="w-full bg-app-surface border border-app-border rounded-xl p-3.5 text-text-primary"
                      />
                    </div>

                    {applicableCustomFields.length > 0 && (
                      <div className="pt-4 border-t border-app-border space-y-3">
                        <div className="text-xs font-mono uppercase text-text-muted">
                          Collection Custom Fields
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
                                className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 rounded-xl bg-app-surface border border-app-border text-sm text-text-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-accent text-white text-sm font-semibold"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="bg-app-secondary border border-app-border rounded-2xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-heading font-bold text-text-primary">
                        Storefront &amp; Contact Intelligence
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-medium text-text-primary"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Details
                      </button>
                    </div>

                    {/* Prominent Observed Facts Box */}
                    <div className="bg-app-surface border border-app-border rounded-2xl p-5 space-y-2">
                      <div className="text-xs font-mono uppercase text-text-muted">
                        Observed Business Facts (from Website)
                      </div>
                      <p className="text-base text-text-primary leading-relaxed">
                        {org.observedFacts || "No site observations recorded yet."}
                      </p>
                    </div>

                    {/* Side-by-side Website Page & Contact Page Cards (Always Both When Contact Page Exists) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-app-surface border border-app-border flex flex-col justify-between gap-3">
                        <div>
                          <span className="text-xs font-mono uppercase text-text-muted block">
                            Official Website Page
                          </span>
                          <span className="font-mono text-sm text-text-primary mt-1 block break-all">
                            {websitePageUrl || "Not available"}
                          </span>
                        </div>
                        {websitePageUrl && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openInTabSiteViewer("website")}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              Open Website Page (In-Tab)
                            </button>
                            <a
                              href={websitePageUrl}
                              target="_self"
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-app-secondary hover:bg-app-elevated border border-app-border text-xs text-text-secondary hover:text-text-primary"
                            >
                              Navigate This Tab
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="p-4 rounded-2xl bg-app-surface border border-app-border flex flex-col justify-between gap-3">
                        <div>
                          <span className="text-xs font-mono uppercase text-text-muted block">
                            Contact Page &amp; Published Contact
                          </span>
                          <span className="font-mono text-sm text-text-primary mt-1 block break-all">
                            {org.publishedContact || "No email/phone listed"}
                          </span>
                          {contactPageUrl && (
                            <span className="font-mono text-xs text-text-secondary mt-1 block break-all">
                              {contactPageUrl}
                            </span>
                          )}
                        </div>
                        {contactPageUrl && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openInTabSiteViewer("contact")}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-app-secondary hover:bg-app-elevated border border-accent/40 text-accent text-xs font-semibold transition"
                            >
                              <Compass className="w-3.5 h-3.5" />
                              Open Contact Page (In-Tab)
                            </button>
                            {websitePageUrl && (
                              <button
                                type="button"
                                onClick={() => openInTabSiteViewer("website")}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-app-secondary hover:bg-app-elevated border border-app-border text-xs text-text-secondary hover:text-text-primary"
                              >
                                <Globe className="w-3.5 h-3.5" />
                                Website Page
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Clean Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-sm">
                      <div className="p-3.5 rounded-xl bg-app-surface border border-app-border">
                        <span className="text-xs text-text-muted block">Country &amp; Market</span>
                        <strong className="text-text-primary mt-0.5 block">
                          {org.country || "—"} ({org.market || "—"})
                        </strong>
                      </div>
                      <div className="p-3.5 rounded-xl bg-app-surface border border-app-border">
                        <span className="text-xs text-text-muted block">Niche / Industry</span>
                        <strong className="text-text-primary mt-0.5 block">
                          {org.industry || "—"}
                        </strong>
                      </div>
                      <div className="p-3.5 rounded-xl bg-app-surface border border-app-border">
                        <span className="text-xs text-text-muted block">Qualification</span>
                        <strong className="text-text-primary font-mono text-xs mt-0.5 block">
                          {org.qualificationDecision}
                        </strong>
                      </div>
                      <div className="p-3.5 rounded-xl bg-app-surface border border-app-border">
                        <span className="text-xs text-text-muted block">Outreach Approval</span>
                        <strong
                          className={`font-mono text-xs mt-0.5 block ${
                            org.outreachApproval === "approved"
                              ? "text-status-success"
                              : org.outreachApproval === "do not contact"
                              ? "text-status-error"
                              : "text-status-warning"
                          }`}
                        >
                          {org.outreachApproval}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* SINGLE UNIFIED OUTREACH & MESSAGE OPERATIONS CARD */}
                <div className="bg-app-secondary border border-app-border rounded-2xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-accent" />
                      <h3 className="text-base font-heading font-bold text-text-primary">
                        Outreach &amp; Message Operations
                      </h3>
                    </div>

                    {/* Message Status Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { id: "not_messaged", label: "Not Messaged" },
                        { id: "message_sent", label: "✓ Message Sent" },
                        { id: "followup_sent", label: "✓ Follow-up Sent" },
                        { id: "replied", label: "★ Replied" },
                      ].map((st) => {
                        const currentSt = org.messageStatus || "not_messaged";
                        const isActive = currentSt === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() =>
                              handleMessageOperation(
                                st.id as
                                  | "not_messaged"
                                  | "message_sent"
                                  | "followup_sent"
                                  | "replied"
                              )
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                              isActive
                                ? st.id === "replied"
                                  ? "bg-status-success text-black border-status-success font-semibold"
                                  : st.id === "not_messaged"
                                  ? "bg-app-surface border-text-muted text-text-primary"
                                  : "bg-accent text-white border-accent font-semibold"
                                : "bg-app-surface border-app-border text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={quickMessageText}
                    onChange={(e) => setQuickMessageText(e.target.value)}
                    placeholder="Write or customize your outreach message for this lead..."
                    className="w-full bg-app-surface border border-app-border rounded-xl p-3.5 text-sm text-text-primary leading-relaxed"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={quickMessageChannel}
                        onChange={(e) => setQuickMessageChannel(e.target.value)}
                        aria-label="Message channel"
                        className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-xs text-text-primary"
                      >
                        <option value="Email">Channel: Email</option>
                        <option value="WhatsApp">Channel: WhatsApp</option>
                        <option value="Instagram DM">Channel: Instagram DM</option>
                        <option value="LinkedIn">Channel: LinkedIn</option>
                        <option value="Contact Form">Channel: Website Contact Form</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(quickMessageText);
                          notify("Outreach message copied to clipboard", "info");
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-medium text-text-secondary hover:text-text-primary"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Text
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {extractedEmail && (
                        <a
                          href={`mailto:${extractedEmail}?subject=${encodeURIComponent(
                            `Quick question for ${org.name}`
                          )}&body=${encodeURIComponent(quickMessageText)}`}
                          onClick={() => handleMessageOperation("message_sent", "Email")}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-semibold text-text-primary"
                        >
                          <Mail className="w-3.5 h-3.5 text-accent" />
                          Email Client
                        </a>
                      )}

                      {extractedPhone && (
                        <a
                          href={`https://wa.me/${extractedPhone}?text=${encodeURIComponent(
                            quickMessageText
                          )}`}
                          target="_self"
                          onClick={() => handleMessageOperation("message_sent", "WhatsApp")}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-status-success/20 hover:bg-status-success/30 border border-status-success/40 text-status-success text-xs font-semibold"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(quickMessageText);
                          handleMessageOperation(
                            "message_sent",
                            quickMessageChannel,
                            quickMessageText
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Copy &amp; Log Message Sent
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 4 Columns: Collections, Next Action & Recent Activity */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3">
                  <div className="text-xs font-mono uppercase text-text-muted">Next Action</div>
                  <p className="text-sm font-medium text-text-primary leading-relaxed">
                    {org.nextAction || "Review qualification & site evidence"}
                  </p>
                  {org.nextFollowUpAt && (
                    <div className="text-xs font-mono text-accent">
                      Due: {new Date(org.nextFollowUpAt).toLocaleDateString()}
                    </div>
                  )}
                  <div className="pt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCreateContentIdeaFromLead}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-medium text-text-primary"
                    >
                      <Video className="w-3.5 h-3.5 text-accent" />
                      Create Reel / Audit Idea
                    </button>
                  </div>
                </div>

                <div className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3">
                  <div className="text-xs font-mono uppercase text-text-muted">
                    Collection Memberships
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {collections.map((c) => {
                      const active = memberCollectionIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleToggleCollectionMembership(c.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
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

                <div className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3">
                  <div className="text-xs font-mono uppercase text-text-muted">
                    Recent Record Activity
                  </div>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {detail.activities.length === 0 ? (
                      <p className="text-xs text-text-muted">No activity recorded yet.</p>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      detail.activities.slice(0, 8).map((act: any) => (
                        <div
                          key={act.id}
                          className="text-xs border-l-2 border-accent pl-3 py-1"
                        >
                          <div className="text-text-primary font-medium">{act.title}</div>
                          <div className="text-[11px] font-mono text-text-muted mt-0.5">
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

          {/* TAB 2: LIVE WEBSITE & CONTACT PAGE VIEWER (OPENS IN THIS TAB ONLY) */}
          {activeTab === "website" && (
            <div className="flex flex-col h-[72vh] bg-app-secondary border border-app-border rounded-2xl overflow-hidden">
              {/* In-Tab Browser Bar */}
              <div className="p-3.5 bg-app-sidebar border-b border-app-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Website Page Button */}
                  {websitePageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSiteViewerMode("website");
                        setCustomBrowserUrl("");
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                        siteViewerMode === "website" && !customBrowserUrl
                          ? "bg-accent text-white border-accent shadow-sm"
                          : "bg-app-surface hover:bg-app-elevated border-app-border text-text-primary"
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      Website Page
                    </button>
                  )}

                  {/* Contact Page Button */}
                  {contactPageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSiteViewerMode("contact");
                        setCustomBrowserUrl("");
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                        siteViewerMode === "contact" && !customBrowserUrl
                          ? "bg-accent text-white border-accent shadow-sm"
                          : "bg-app-surface hover:bg-app-elevated border-app-border text-text-primary"
                      }`}
                    >
                      <Compass className="w-4 h-4" />
                      Contact Page {hasVerifiedContactPage ? "(Verified)" : ""}
                    </button>
                  )}
                </div>

                {/* Address Bar */}
                <div className="flex-1 min-w-[260px] flex items-center gap-2 bg-app-surface border border-app-border rounded-xl px-3 py-1.5">
                  <Globe className="w-3.5 h-3.5 text-accent shrink-0" />
                  <input
                    type="text"
                    value={activeTargetUrl || ""}
                    onChange={(e) => setCustomBrowserUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-transparent font-mono text-xs text-text-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIframeRefreshKey((k) => k + 1)}
                    title="Reload Page in This Tab"
                    className="p-1 rounded hover:bg-app-secondary text-text-secondary hover:text-text-primary"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Same-Tab Actions (No New Tab) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(quickMessageText);
                      handleMessageOperation("message_sent", "Contact Form", quickMessageText);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/15 hover:bg-accent text-accent hover:text-white border border-accent/30 text-xs font-semibold transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Copy Msg &amp; Mark Sent
                  </button>

                  {activeTargetUrl && (
                    <a
                      href={activeTargetUrl}
                      target="_self"
                      title="Navigate current browser tab directly to this URL (does not open a new tab)"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      Navigate This Tab
                    </a>
                  )}
                </div>
              </div>

              {/* Embedded Live Website / Contact Page Frame */}
              <div className="flex-1 bg-white relative">
                {activeTargetUrl ? (
                  <iframe
                    key={`${activeTargetUrl}-${iframeRefreshKey}`}
                    src={`/api/site-preview?url=${encodeURIComponent(activeTargetUrl)}`}
                    title={`${org.name} — ${
                      siteViewerMode === "contact" ? "Contact Page" : "Website Page"
                    }`}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  />
                ) : (
                  <div className="h-full bg-app-surface flex flex-col items-center justify-center p-8 text-center space-y-3">
                    <Globe className="w-10 h-10 text-text-muted" />
                    <p className="text-base font-heading font-semibold text-text-primary">
                      No Website or Contact Page URL on Record
                    </p>
                    <p className="text-xs text-text-secondary max-w-md">
                      Add an official website URL or contact page URL in the Overview tab to browse it directly inside this tab.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: NOTES & FOLLOW-UP TASKS (SIDE-BY-SIDE 2-COLUMN) */}
          {activeTab === "notes_tasks" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
              {/* Left: Notes */}
              <div className="space-y-4">
                <h3 className="text-base font-heading font-bold text-text-primary">
                  Research Notes &amp; Audit Findings ({detail.notes.length})
                </h3>
                <form
                  onSubmit={handleAddNote}
                  className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3"
                >
                  <textarea
                    rows={3}
                    required
                    placeholder="Write detailed research note, website audit findings, or conversation summary..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="w-full bg-app-surface border border-app-border rounded-xl p-3.5 text-sm text-text-primary"
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
                      className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold"
                    >
                      Save Note
                    </button>
                  </div>
                </form>

                <div className="space-y-3">
                  {detail.notes.length === 0 ? (
                    <p className="text-sm text-text-secondary text-center py-8 bg-app-secondary border border-app-border rounded-2xl">
                      No user notes added yet.
                    </p>
                  ) : (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    detail.notes.map((n: any) => (
                      <div
                        key={n.id}
                        className={`p-4 rounded-2xl border text-sm space-y-2 ${
                          n.isPinned
                            ? "bg-accent/10 border-accent/40"
                            : "bg-app-secondary border-app-border"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono text-text-muted">
                          <span className="flex items-center gap-1.5">
                            {n.isPinned && <Pin className="w-3.5 h-3.5 text-accent" />}
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

              {/* Right: Follow-Up Tasks */}
              <div className="space-y-4">
                <h3 className="text-base font-heading font-bold text-text-primary">
                  Follow-ups &amp; Scheduled Tasks ({detail.tasks.length})
                </h3>
                <form
                  onSubmit={handleCreateTask}
                  className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <input
                      type="text"
                      required
                      placeholder="Task / Follow-up Title *"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="sm:col-span-2 bg-app-surface border border-app-border rounded-xl px-3.5 py-2 text-text-primary"
                    />
                    <select
                      value={newTaskType}
                      onChange={(e) => setNewTaskType(e.target.value)}
                      className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
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
                      className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                    >
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                    <input
                      type="date"
                      value={newTaskDate}
                      onChange={(e) => setNewTaskDate(e.target.value)}
                      className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                    />
                    <input
                      type="time"
                      value={newTaskTime}
                      onChange={(e) => setNewTaskTime(e.target.value)}
                      className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold"
                    >
                      Schedule Task
                    </button>
                  </div>
                </form>

                <div className="space-y-3">
                  {detail.tasks.length === 0 ? (
                    <p className="text-sm text-text-secondary text-center py-8 bg-app-secondary border border-app-border rounded-2xl">
                      No tasks scheduled for this record.
                    </p>
                  ) : (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    detail.tasks.map((t: any) => (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl bg-app-secondary border border-app-border flex items-center justify-between gap-3 text-sm"
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
                        <span className="font-mono text-xs text-text-secondary">
                          Due {t.dueDate} {t.dueTime || ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCORE, CONTACTS, OPPORTUNITIES, FILES & PROVENANCE */}
          {activeTab === "more" && (
            <div className="space-y-8">
              {/* Opportunity Score Assessment */}
              <div className="bg-app-secondary border border-app-border rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-accent" />
                    <h3 className="text-base font-heading font-bold text-text-primary">
                      Opportunity Score Assessment ({primaryCol?.name || "Default"})
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-text-secondary">
                    Origin: <strong>{org.scoreMethod}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {scoringConfig.dimensions.map((dim) => (
                    <div
                      key={dim.key}
                      className="p-3.5 rounded-xl bg-app-surface border border-app-border text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
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
                        className="w-full bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-app-border">
                  <button
                    type="button"
                    onClick={() => handleSaveScore(false)}
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
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
                      className="w-20 bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveScore(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-app-elevated border border-app-border text-xs font-medium text-text-primary"
                    >
                      Override
                    </button>
                  </div>
                </div>
              </div>

              {/* Contacts & Opportunities Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                {/* Contacts */}
                <div className="space-y-4">
                  <h3 className="text-base font-heading font-bold text-text-primary">
                    Individual Contacts ({detail.contacts.length})
                  </h3>
                  <form
                    onSubmit={handleCreateContact}
                    className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <input
                        type="text"
                        required
                        placeholder="Full Name *"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                      />
                      <input
                        type="text"
                        placeholder="Job Title (e.g. Founder)"
                        value={newContactRole}
                        onChange={(e) => setNewContactRole(e.target.value)}
                        className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                      />
                      <input
                        type="email"
                        placeholder="Business Email"
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                      />
                      <input
                        type="text"
                        placeholder="Phone"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                        <input
                          type="checkbox"
                          checked={newContactDnc}
                          onChange={(e) => setNewContactDnc(e.target.checked)}
                        />
                        Mark as Do Not Contact
                      </label>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold"
                      >
                        + Save Contact
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2.5">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {detail.contacts.map((c: any) => (
                      <div
                        key={c.id}
                        className="p-4 rounded-2xl bg-app-secondary border border-app-border flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-heading font-semibold text-sm text-text-primary">
                            {c.fullName}
                          </div>
                          <div className="text-text-secondary mt-0.5">
                            {c.jobTitle || "Role unknown"} • {c.email || "No email"} •{" "}
                            {c.phone || "No phone"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opportunities */}
                <div className="space-y-4">
                  <h3 className="text-base font-heading font-bold text-text-primary">
                    Sales Opportunities ({detail.opportunities.length})
                  </h3>
                  <form
                    onSubmit={handleCreateOpportunity}
                    className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <input
                        type="text"
                        required
                        placeholder="Opportunity Name *"
                        value={newOppName}
                        onChange={(e) => setNewOppName(e.target.value)}
                        className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                      />
                      <input
                        type="text"
                        placeholder="Service Type"
                        value={newOppService}
                        onChange={(e) => setNewOppService(e.target.value)}
                        className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                      />
                      <input
                        type="number"
                        placeholder="Estimated Value"
                        value={newOppValue}
                        onChange={(e) => setNewOppValue(e.target.value)}
                        className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                      />
                      <select
                        value={newOppCurrency}
                        onChange={(e) => setNewOppCurrency(e.target.value)}
                        className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold"
                      >
                        + Add Opportunity
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2.5">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {detail.opportunities.map((opp: any) => (
                      <div
                        key={opp.id}
                        className="p-4 rounded-2xl bg-app-secondary border border-app-border flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-heading font-semibold text-sm text-text-primary">
                            {opp.name}
                          </div>
                          <div className="text-text-secondary mt-0.5">
                            {opp.serviceType} •{" "}
                            {opp.estimatedValue !== null && opp.estimatedValue !== undefined
                              ? `${opp.currency} ${Number(opp.estimatedValue).toLocaleString()}`
                              : "Unestimated"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Files & Manual Activity Log */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                <div className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-heading font-semibold text-text-primary">
                      Attachments &amp; Audit Files ({detail.attachments.length})
                    </h4>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold cursor-pointer">
                      <Paperclip className="w-3.5 h-3.5" />
                      Attach File
                      <input type="file" className="sr-only" onChange={handleFileUpload} />
                    </label>
                  </div>
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {detail.attachments.map((att: any) => (
                      <div
                        key={att.id}
                        className="p-3 rounded-xl bg-app-surface border border-app-border flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-2 text-text-primary">
                          <FileText className="w-4 h-4 text-accent" />
                          {att.filename}
                        </span>
                        <a
                          href={att.dataUrl}
                          download={att.filename}
                          className="text-accent hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={handleLogManualActivity}
                  className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3"
                >
                  <h4 className="text-sm font-heading font-semibold text-text-primary">
                    Log Manual Communication
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <select
                      value={manualActType}
                      onChange={(e) => setManualActType(e.target.value)}
                      className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                    >
                      <option value="email_sent">Email Sent</option>
                      <option value="call_made">Call Made</option>
                      <option value="meeting_held">Meeting Held</option>
                      <option value="message_received">Message Received</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Summary of interaction..."
                      value={manualActTitle}
                      onChange={(e) => setManualActTitle(e.target.value)}
                      className="sm:col-span-2 bg-app-surface border border-app-border rounded-xl px-3 py-2 text-text-primary"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold"
                    >
                      Log Activity
                    </button>
                  </div>
                </form>
              </div>

              {/* Source Provenance */}
              {detail.sourceRecords.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-heading font-bold text-text-primary">
                    Spreadsheet Import Provenance
                  </h3>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {detail.sourceRecords.map((sr: any) => (
                    <div
                      key={sr.id}
                      className="bg-app-secondary border border-app-border rounded-2xl p-5 space-y-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-app-border">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-accent" />
                          <strong className="text-text-primary">{sr.sourceFilename}</strong>
                        </div>
                        <div className="font-mono text-text-secondary">
                          Sheet: <strong>{sr.sheetName}</strong> • Row:{" "}
                          <strong>#{sr.rowNumber}</strong>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {Object.entries(sr.rawValues || {}).map(([col, val]) => (
                          <div
                            key={col}
                            className="p-2.5 rounded-xl bg-app-surface border border-app-border flex justify-between gap-2"
                          >
                            <span className="text-text-muted">{col}:</span>
                            <span className="font-mono text-text-primary text-right break-all">
                              {String(val || "—")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
