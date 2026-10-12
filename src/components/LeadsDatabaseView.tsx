"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Download,
  Upload,
  Table as TableIcon,
  Columns,
  LayoutGrid,
  MapPin,
  AlertTriangle,
  Globe,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  SlidersHorizontal,
  Archive,
  Send,
  Heart,
  X,
  Sparkles,
  MessageSquare,
  Compass,
  Maximize2,
  Calendar,
  FolderPlus,
  Hash,
} from "lucide-react";
import {
  triggerLocalBrowserFileDownload,
  formatLeadSequenceNumber,
} from "@/lib/browser-storage";
import { resolveLeadWebPages } from "./LeadProfileModal";

interface LeadsDatabaseViewProps {
  collectionId?: string;
  onlyQualified?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collections: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stages: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savedViews: any[];
  onOpenLead: (id: string) => void;
  onOpenQuickAdd: () => void;
  onMutated: () => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function LeadsDatabaseView({
  collectionId,
  onlyQualified = false,
  collections,
  stages,
  categories,
  savedViews,
  onOpenLead,
  onOpenQuickAdd,
  onMutated,
  notify,
}: LeadsDatabaseViewProps) {
  const activeCol = collections.find((c) => c.id === collectionId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [viewMode, setViewMode] = useState<"table" | "swipe" | "cards" | "kanban" | "map">("table");
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swipeSiteMode, setSwipeSiteMode] = useState<"none" | "website" | "contact">("none");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [inTabPreview, setInTabPreview] = useState<{ lead: any; mode: "website" | "contact" } | null>(null);
  const [importingFile, setImportingFile] = useState(false);

  const [selectedDay, setSelectedDay] = useState<string>("");
  const [newDayDate, setNewDayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [newDayLabel, setNewDayLabel] = useState<string>("");
  const [showAddDayForm, setShowAddDayForm] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [search, setSearch] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
  const [qualificationFilter, setQualificationFilter] = useState("");
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [minScoreFilter, setMinScoreFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "sequenceNumber" | "updatedAt" | "name" | "score" | "country"
  >("sequenceNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<50 | 100 | "unlimited">(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availableDays, setAvailableDays] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [saveViewName, setSaveViewName] = useState("");
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    number: true,
    website: true,
    country: true,
    niche: true,
    verification: true,
    score: true,
    stage: true,
    qualification: true,
    outreach: true,
    nextAction: true,
    quickActions: true,
  });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("view", "leads_paginated");
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      sp.set("sortBy", sortBy);
      sp.set("sortDir", sortDir);
      if (collectionId) sp.set("collectionId", collectionId);
      if (selectedDay) sp.set("day", selectedDay);
      if (search.trim()) sp.set("search", search.trim());
      if (marketFilter) sp.set("market", marketFilter);
      if (countryFilter) sp.set("country", countryFilter);
      if (categoryFilter) sp.set("category", categoryFilter);
      if (stageFilter) sp.set("stageId", stageFilter);
      if (verificationFilter) sp.set("verificationLevel", verificationFilter);
      const effectiveQualification = onlyQualified ? "qualified" : qualificationFilter;
      if (effectiveQualification) sp.set("qualificationDecision", effectiveQualification);
      if (minScoreFilter !== "") sp.set("minScore", minScoreFilter);
      if (warningsOnly) sp.set("hasWarning", "true");

      const res = await fetch(`/api/workspace?${sp.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
        setAvailableDays(data.availableDays || []);
        setAvailableCategories(data.availableCategories || []);
      }
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    sortBy,
    sortDir,
    collectionId,
    onlyQualified,
    selectedDay,
    search,
    marketFilter,
    countryFilter,
    categoryFilter,
    stageFilter,
    verificationFilter,
    qualificationFilter,
    minScoreFilter,
    warningsOnly,
  ]);

  useEffect(() => {
    setPage(1);
  }, [onlyQualified, collectionId]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    setSwipeIndex(0);
  }, [rows.length, collectionId, onlyQualified, selectedDay, categoryFilter, search, marketFilter]);

  async function handleDirectFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingFile(true);
    try {
      const formData = new FormData();
      formData.append("mode", "quick_import");
      formData.append("file", file);
      if (collectionId) {
        formData.append("collectionId", collectionId);
      } else if (collections[0]?.id) {
        formData.append("collectionId", collections[0].id);
      }
      if (selectedDay) {
        formData.append("dayKey", selectedDay);
      }
      if (categoryFilter) {
        formData.append("category", categoryFilter);
      }
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok && json.batch) {
        if (json.batch.dayKey && !selectedDay) {
          setSelectedDay(json.batch.dayKey);
        }
        await fetchLeads();
        await onMutated();
        notify(
          `Imported ${json.batch.newRecordsCreated} leads (#001 → #${formatLeadSequenceNumber(
            json.batch.newRecordsCreated || 1
          )}) from ${file.name} into Day ${json.batch.dayKey || "Today"}`,
          "success"
        );
      } else {
        notify(json.error || "Could not import spreadsheet", "error");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Spreadsheet import failed", "error");
    } finally {
      setImportingFile(false);
      e.target.value = "";
    }
  }

  async function handleCreateDaySlot(e: React.FormEvent) {
    e.preventDefault();
    if (!newDayDate) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_day_slot",
        payload: {
          dayKey: newDayDate,
          label: newDayLabel.trim() || `Daily Spreadsheet (${newDayDate})`,
        },
      }),
    });
    if (res.ok) {
      setSelectedDay(newDayDate);
      setNewDayLabel("");
      setShowAddDayForm(false);
      setPage(1);
      await fetchLeads();
      await onMutated();
      notify(`Selected Day ${newDayDate} — ready for daily spreadsheet leads`, "success");
    }
  }

  async function handleCreateCategoryInLeads(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCreatingCategory(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_category",
          payload: {
            collectionId: collectionId || null,
            name: trimmed,
            color: "#7958F5",
            organizationIds: selectedIds.size > 0 ? Array.from(selectedIds) : [],
          },
        }),
      });
      if (res.ok) {
        setNewCategoryName("");
        await fetchLeads();
        await onMutated();
        notify(
          selectedIds.size > 0
            ? `Created category "${trimmed}" and stored ${selectedIds.size} selected lead(s) in it`
            : `Created category "${trimmed}" in Leads`,
          "success"
        );
      }
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleAssignLeadCategory(
    orgId: string,
    orgName: string,
    categoryName: string,
    e?: React.MouseEvent | React.ChangeEvent
  ) {
    if (e) e.stopPropagation();
    if (!categoryName) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign_lead_category",
        payload: {
          organizationId: orgId,
          categoryName,
          collectionId: collectionId || null,
        },
      }),
    });
    if (res.ok) {
      await fetchLeads();
      await onMutated();
      notify(`Stored ${orgName} in category "${categoryName}"`, "success");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dedupReport, setDedupReport] = useState<Record<string, any> | null>(null);
  const [runningDedup, setRunningDedup] = useState(false);

  async function handleRunDeduplicateScript() {
    setRunningDedup(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deduplicate_and_disambiguate_leads",
          payload: {},
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDedupReport(data.report || null);
        await fetchLeads();
        await onMutated();
        const erased = data.report?.erasedCount || 0;
        const disamb = data.report?.disambiguatedCount || 0;
        notify(
          `Script complete: ${erased} duplicate lead(s) erased, ${disamb} colliding number(s) assigned A, B, C codes`,
          "success"
        );
      }
    } finally {
      setRunningDedup(false);
    }
  }

  async function handleToggleBookmark(orgId: string, orgName: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_bookmark_inspiration",
        payload: { organizationId: orgId },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchLeads();
      await onMutated();
      notify(
        data.isBookmarked
          ? `Bookmarked ${orgName} website to Design Inspirations`
          : `Removed ${orgName} from Design Inspirations`,
        data.isBookmarked ? "success" : "info"
      );
    }
  }

  async function handleQuickMessageStatus(
    orgId: string,
    orgName: string,
    messageStatus: "not_messaged" | "message_sent" | "followup_sent" | "replied",
    channel = "Outreach",
    e?: React.MouseEvent
  ) {
    if (e) e.stopPropagation();
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_message_operation",
        payload: { organizationId: orgId, messageStatus, channel },
      }),
    });
    if (res.ok) {
      await fetchLeads();
      await onMutated();
      const mapLabel: Record<string, string> = {
        not_messaged: `Reset ${orgName} to Not Messaged`,
        message_sent: `Marked Message Sent to ${orgName}`,
        followup_sent: `Marked Follow-up Sent to ${orgName}`,
        replied: `Marked ${orgName} as Replied`,
      };
      notify(mapLabel[messageStatus] || "Updated message status", "success");
    }
  }

  async function handleSwipeDecision(orgId: string, orgName: string, decision: "pass" | "qualify") {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "inline_update_lead",
        payload: {
          id: orgId,
          updates:
            decision === "qualify"
              ? {
                  qualificationDecision: "qualified",
                  outreachApproval: "approved",
                  primaryStageId: "stg_qualified",
                }
              : {
                  qualificationDecision: "disqualified",
                  primaryStageId: "stg_lost",
                },
        },
      }),
    });
    await fetchLeads();
    await onMutated();
    notify(
      decision === "qualify"
        ? `Qualified & approved ${orgName}`
        : `Passed on ${orgName}`,
      decision === "qualify" ? "success" : "info"
    );
    setSwipeIndex((prev) => (prev + 1 < rows.length ? prev + 1 : 0));
  }

  function resetFilters() {
    setSearch("");
    setMarketFilter("");
    setCountryFilter("");
    setCategoryFilter("");
    setStageFilter("");
    setVerificationFilter("");
    setQualificationFilter("");
    setMinScoreFilter("");
    setWarningsOnly(false);
    setPage(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applySavedView(v: any) {
    resetFilters();
    const f = v.filters || {};
    if (f.market) setMarketFilter(f.market);
    if (f.country) setCountryFilter(f.country);
    if (f.verificationLevel) setVerificationFilter(f.verificationLevel);
    if (f.qualificationDecision) setQualificationFilter(f.qualificationDecision);
    if (f.minScore !== undefined) setMinScoreFilter(String(f.minScore));
    if (f.hasWarning) setWarningsOnly(true);
    notify(`Applied view: ${v.name}`, "info");
  }

  async function handleSaveCurrentView() {
    if (!saveViewName.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_view",
        payload: {
          collectionId: collectionId || null,
          name: saveViewName.trim(),
          filters: {
            market: marketFilter || undefined,
            country: countryFilter || undefined,
            verificationLevel: verificationFilter || undefined,
            qualificationDecision: qualificationFilter || undefined,
            minScore: minScoreFilter ? Number(minScoreFilter) : undefined,
            hasWarning: warningsOnly || undefined,
          },
          viewMode,
        },
      }),
    });
    setSaveViewName("");
    await onMutated();
    notify("Custom table view saved", "success");
  }

  async function handleInlineStageChange(orgId: string, newStageId: string) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "inline_update_lead",
        payload: { id: orgId, updates: { primaryStageId: newStageId } },
      }),
    });
    await fetchLeads();
    await onMutated();
    notify("Stage updated", "success");
  }

  async function handleInlineQualificationChange(
    orgId: string,
    orgName: string,
    nextQualification: string,
    e?: React.MouseEvent
  ) {
    if (e) e.stopPropagation();
    const isQualifying = nextQualification.toLowerCase() === "qualified";
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "inline_update_lead",
        payload: {
          id: orgId,
          updates: isQualifying
            ? {
                qualificationDecision: "qualified",
                outreachApproval: "approved",
                primaryStageId: "stg_qualified",
              }
            : {
                qualificationDecision: nextQualification,
              },
        },
      }),
    });
    await fetchLeads();
    await onMutated();
    notify(
      isQualifying
        ? `Qualified ${orgName} — added to Qualified Leads`
        : `Updated qualification for ${orgName} to ${nextQualification}`,
      isQualifying ? "success" : "info"
    );
  }

  async function handleBulkOperation(
    operation:
      | "change_stage"
      | "add_tag"
      | "assign_category"
      | "assign_day"
      | "assign_collection"
      | "set_qualification"
      | "archive",
    value?: string
  ) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk_update_leads",
        payload: { ids, operation, value },
      }),
    });
    if (res.ok) {
      setSelectedIds(new Set());
      setBulkTagInput("");
      await fetchLeads();
      await onMutated();
      notify(`Updated ${ids.length} selected lead(s)`, "success");
    }
  }

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      rows.forEach((r) => next.delete(r.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      rows.forEach((r) => next.add(r.id));
      setSelectedIds(next);
    }
  }

  function toggleRowSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  // Group by country for Map View (Section 22)
  const countryBreakdown = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const c = r.country || "Unknown Location";
    if (!acc[c]) acc[c] = [];
    acc[c].push(r);
    return acc;
  }, {});

  // Combine category names for inline dropdowns
  const allCategoryNames = Array.from(
    new Set([
      ...availableCategories.map((c) => String(c.name)),
      ...categories.map((c) => String(c.name)),
    ].filter(Boolean))
  );

  const activeSwipeLead = rows[swipeIndex] || rows[0] || null;
  const activeDayObj = availableDays.find((d) => d.dayKey === selectedDay);

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleDirectFileImport}
        className="sr-only"
      />

      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-heading font-bold shadow-sm"
            style={{
              backgroundColor: onlyQualified
                ? "#10B981"
                : activeCol?.color || "#7958F5",
            }}
          >
            {onlyQualified
              ? "QL"
              : activeCol
              ? activeCol.name.slice(0, 2).toUpperCase()
              : "AL"}
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">
              {onlyQualified
                ? "Qualified Leads"
                : activeCol
                ? activeCol.name
                : "All Leads Database"}
            </h1>
            <p className="text-xs text-text-secondary font-mono">
              {totalCount} {onlyQualified ? "qualified leads" : "leads"} numbered 001 →{" "}
              {totalCount > 0 ? formatLeadSequenceNumber(totalCount) : "∞"} •{" "}
              {selectedDay
                ? `Showing Day ${activeDayObj?.formattedDayNumber || "001"} (${selectedDay})`
                : "All Daily Spreadsheets"}{" "}
              {categoryFilter ? `• Category: ${categoryFilter}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-app-surface p-1 rounded-lg border border-app-border text-xs">
            {[
              { id: "table", label: "Table", icon: TableIcon },
              { id: "swipe", label: "Swipe Deck", icon: Sparkles },
              { id: "cards", label: "Cards", icon: LayoutGrid },
              { id: "kanban", label: "Kanban", icon: Columns },
              { id: "map", label: "Map", icon: MapPin },
            ].map((vm) => {
              const Icon = vm.icon;
              return (
                <button
                  key={vm.id}
                  type="button"
                  onClick={() => setViewMode(vm.id as typeof viewMode)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition ${
                    viewMode === vm.id
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {vm.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={runningDedup}
            onClick={handleRunDeduplicateScript}
            title="Erases duplicate leads (same content) and gives A, B, C suffixes (001A, 001B...) when numbers are duplicated with different content"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-app-surface hover:bg-app-elevated border border-status-warning/50 text-xs font-semibold text-status-warning hover:text-text-primary transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {runningDedup ? "Scanning..." : "Clean Duplicates & Code (001A/B/C)"}
          </button>

          <button
            type="button"
            disabled={importingFile}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-app-surface hover:bg-app-elevated border border-accent/50 text-xs font-semibold text-accent hover:text-text-primary transition"
          >
            <Upload className="w-3.5 h-3.5" />
            {importingFile
              ? "Importing..."
              : selectedDay
              ? `Import Spreadsheet for ${selectedDay}`
              : "Import .XLSX / .CSV"}
          </button>

          <button
            type="button"
            onClick={() => triggerLocalBrowserFileDownload("csv", collectionId)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={onOpenQuickAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            + Add Lead
          </button>
        </div>
      </div>

      {/* DEDUPLICATION & NUMBER COLLISION SCRIPT REPORT BANNER */}
      {dedupReport && (
        <div className="bg-app-surface border border-accent/40 rounded-2xl p-4 flex flex-wrap items-start justify-between gap-4 text-xs shadow-sm">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-heading font-bold text-text-primary">
              <Sparkles className="w-4 h-4 text-status-success" />
              <span>
                Duplicate &amp; Number Code Script Report — {dedupReport.erasedCount} Duplicate(s) Erased •{" "}
                {dedupReport.disambiguatedCount} Colliding Number(s) Coded (A, B, C...)
              </span>
            </div>
            <p className="text-text-secondary">
              Leads with identical content are erased automatically. Leads that share the same number but have different names &amp; details are preserved and given letter suffixes (<span className="font-mono text-accent font-semibold">001A, 001B, 001C...</span>).
            </p>
            {Array.isArray(dedupReport.erasedDuplicates) && dedupReport.erasedDuplicates.length > 0 && (
              <div className="text-status-error font-mono text-[11px]">
                Erased Duplicates:{" "}
                {dedupReport.erasedDuplicates
                  .slice(0, 6)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((d: any) => `${d.name} (${d.reason})`)
                  .join(" • ")}
                {dedupReport.erasedDuplicates.length > 6
                  ? ` +${dedupReport.erasedDuplicates.length - 6} more`
                  : ""}
              </div>
            )}
            {Array.isArray(dedupReport.disambiguatedLeads) && dedupReport.disambiguatedLeads.length > 0 && (
              <div className="text-accent font-mono text-[11px]">
                Assigned A/B/C Codes:{" "}
                {dedupReport.disambiguatedLeads
                  .slice(0, 8)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((c: any) => `#${c.sequenceCode} (${c.name})`)
                  .join(" • ")}
                {dedupReport.disambiguatedLeads.length > 8
                  ? ` +${dedupReport.disambiguatedLeads.length - 8} more`
                  : ""}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDedupReport(null)}
            className="p-1.5 rounded-lg bg-app-secondary hover:bg-app-elevated text-text-secondary hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. DAILY SPREADSHEET / DAY SELECTOR BAR ("WHICH DAY DO YOU WANT TO SEE?") */}
      {/* Numbered 001, 002, 003 ... till Infinity for each day's spreadsheet */}
      {/* ==================================================================== */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-3.5 space-y-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <span className="font-heading font-bold text-xs uppercase tracking-wider text-text-primary">
              Which Day Do You Want to See? (Daily Spreadsheets • 001 → ∞)
            </span>
            <span className="text-[11px] text-text-muted font-mono">
              Each day has its own spreadsheet &amp; leads numbered 001, 002, 003...
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddDayForm(!showAddDayForm)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border text-xs font-medium text-text-primary transition"
            >
              <Plus className="w-3.5 h-3.5 text-accent" />
              {showAddDayForm ? "Close Day Picker" : "+ New Day / Select Date"}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent text-accent hover:text-white border border-accent/30 text-xs font-semibold transition"
            >
              <Upload className="w-3.5 h-3.5" />
              {selectedDay ? `Upload Spreadsheet to ${selectedDay}` : "Upload Today's Spreadsheet"}
            </button>
          </div>
        </div>

        {showAddDayForm && (
          <form
            onSubmit={handleCreateDaySlot}
            className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-app-secondary border border-app-border text-xs"
          >
            <span className="font-mono text-text-secondary">Date:</span>
            <input
              type="date"
              value={newDayDate}
              onChange={(e) => setNewDayDate(e.target.value)}
              className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1 text-xs text-text-primary font-mono"
            />
            <input
              type="text"
              placeholder="Spreadsheet / Day label (optional, e.g. US Shopify Leads)..."
              value={newDayLabel}
              onChange={(e) => setNewDayLabel(e.target.value)}
              className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1 text-xs text-text-primary flex-1 min-w-[200px]"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-accent text-white font-semibold"
            >
              Add / Open Day
            </button>
          </form>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setSelectedDay("");
              setPage(1);
            }}
            className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${
              !selectedDay
                ? "bg-accent text-white border-accent shadow-sm"
                : "bg-app-secondary hover:bg-app-elevated border-app-border text-text-secondary hover:text-text-primary"
            }`}
          >
            <span className="font-mono px-1.5 py-0.5 rounded bg-black/20 text-[11px]">ALL</span>
            <span>All Days</span>
            <span className="font-mono text-[11px] opacity-80">
              ({availableDays.reduce((acc, d) => acc + (d.leadCount || 0), 0)})
            </span>
          </button>

          {availableDays.map((d) => {
            const isSelected = selectedDay === d.dayKey;
            return (
              <button
                key={d.dayKey}
                type="button"
                onClick={() => {
                  setSelectedDay(isSelected ? "" : d.dayKey);
                  setPage(1);
                }}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs transition ${
                  isSelected
                    ? "bg-accent text-white border-accent font-semibold shadow-sm"
                    : "bg-app-secondary hover:bg-app-elevated border-app-border text-text-primary"
                }`}
              >
                <span
                  className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] tabular-nums ${
                    isSelected ? "bg-white/20 text-white" : "bg-accent/15 text-accent"
                  }`}
                >
                  #{d.formattedDayNumber}
                </span>
                <div className="text-left">
                  <div className="font-mono font-semibold text-xs leading-tight">{d.dayKey}</div>
                  <div
                    className={`text-[10px] truncate max-w-[160px] ${
                      isSelected ? "text-white/85" : "text-text-muted"
                    }`}
                  >
                    {d.label}
                  </div>
                </div>
                <span
                  className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-full tabular-nums ${
                    isSelected ? "bg-black/25 text-white" : "bg-app-surface text-text-secondary"
                  }`}
                >
                  {d.leadCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. CATEGORIES ORGANIZER & CREATOR DIRECTLY IN LEADS (001, 002 ... ∞) */}
      {/* View categories, create new categories, and store leads inside them */}
      {/* ==================================================================== */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-3.5 space-y-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-accent" />
            <span className="font-heading font-bold text-xs uppercase tracking-wider text-text-primary">
              Lead Categories ({selectedDay ? `Day ${selectedDay}` : "All Days"} • 001 → ∞)
            </span>
            <span className="text-[11px] text-text-muted font-mono">
              Click any category to view stored leads, or create a new category below to store leads in it
            </span>
          </div>

          <form onSubmit={handleCreateCategoryInLeads} className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder={
                selectedIds.size > 0
                  ? `Create category & store ${selectedIds.size} lead(s)...`
                  : "New category name (e.g. Shopify Plus, AI Agency)..."
              }
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="bg-app-secondary border border-app-border rounded-lg px-3 py-1.5 text-xs text-text-primary w-64"
            />
            <button
              type="submit"
              disabled={creatingCategory || !newCategoryName.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              {selectedIds.size > 0 ? "Create & Store Selected" : "+ Create Category"}
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("");
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              !categoryFilter
                ? "bg-accent text-white border-accent font-semibold"
                : "bg-app-secondary hover:bg-app-elevated border-app-border text-text-secondary hover:text-text-primary"
            }`}
          >
            <span>All Categories</span>
          </button>

          {availableCategories.map((cat) => {
            const isCatActive = categoryFilter.toLowerCase() === String(cat.name).toLowerCase();
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => {
                  setCategoryFilter(isCatActive ? "" : cat.name);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition ${
                  isCatActive
                    ? "bg-accent text-white border-accent font-semibold"
                    : "bg-app-secondary hover:bg-app-elevated border-app-border text-text-primary"
                }`}
              >
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                    isCatActive ? "bg-white/20 text-white" : "bg-accent/15 text-accent"
                  }`}
                >
                  {cat.formattedCategoryNumber}
                </span>
                <span>{cat.name}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                    isCatActive ? "bg-black/25 text-white" : "bg-app-surface text-text-muted"
                  }`}
                >
                  {cat.leadCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Saved Views Strip (Section 10.2 & 13.2) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-app-surface border border-app-border rounded-xl p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={resetFilters}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              !marketFilter && !verificationFilter && !qualificationFilter && !warningsOnly && !categoryFilter
                ? "bg-accent text-white"
                : "bg-app-secondary text-text-secondary hover:text-text-primary"
            }`}
          >
            All Leads
          </button>
          <button
            type="button"
            onClick={() => {
              resetFilters();
              setMarketFilter("India");
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              marketFilter === "India"
                ? "bg-accent text-white"
                : "bg-app-secondary text-text-secondary hover:text-text-primary"
            }`}
          >
            India Market
          </button>
          <button
            type="button"
            onClick={() => {
              resetFilters();
              setMarketFilter("International");
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              marketFilter === "International"
                ? "bg-accent text-white"
                : "bg-app-secondary text-text-secondary hover:text-text-primary"
            }`}
          >
            International Market
          </button>
          <button
            type="button"
            onClick={() => {
              resetFilters();
              setVerificationFilter("directory listing only");
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              verificationFilter === "directory listing only"
                ? "bg-status-warning text-black font-semibold"
                : "bg-app-secondary text-text-secondary hover:text-text-primary"
            }`}
          >
            Needs Verification (Directory-Only)
          </button>
          <button
            type="button"
            onClick={() => {
              resetFilters();
              setWarningsOnly(true);
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              warningsOnly
                ? "bg-status-error text-white"
                : "bg-app-secondary text-text-secondary hover:text-text-primary"
            }`}
          >
            Flagged Anomalies
          </button>
          {savedViews
            .filter((v) => !collectionId || v.collectionId === collectionId)
            .slice(0, 4)
            .map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => applySavedView(v)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-app-secondary text-text-secondary hover:text-text-primary"
              >
                <Bookmark className="w-3 h-3 text-accent" />
                {v.name}
              </button>
            ))}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Save current filter view..."
            value={saveViewName}
            onChange={(e) => setSaveViewName(e.target.value)}
            className="bg-app-secondary border border-app-border rounded-lg px-2.5 py-1 text-xs text-text-primary w-40"
          />
          {saveViewName.trim() && (
            <button
              type="button"
              onClick={handleSaveCurrentView}
              className="px-2.5 py-1 rounded-lg bg-accent text-white text-xs font-medium"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Search & Multi-Filter Controls Bar */}
      <div className="flex flex-wrap items-center gap-2.5 bg-app-surface border border-app-border rounded-xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search #001, company, domain, Lead ID, category, contact..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full h-9 bg-app-secondary border border-app-border rounded-lg pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted"
          />
        </div>

        <select
          aria-label="Filter by Pipeline Stage"
          value={stageFilter}
          onChange={(e) => {
            setStageFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 bg-app-secondary border border-app-border rounded-lg px-3 text-xs text-text-primary min-w-[155px]"
        >
          <option value="">All Pipeline Stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              Stage: {s.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by Verification Level"
          value={verificationFilter}
          onChange={(e) => {
            setVerificationFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 bg-app-secondary border border-app-border rounded-lg px-3 text-xs text-text-primary min-w-[165px]"
        >
          <option value="">All Verification Levels</option>
          <option value="site description">Site Description</option>
          <option value="directory listing only">Directory Listing Only</option>
          <option value="manually verified">Manually Verified</option>
        </select>

        {!onlyQualified && (
          <select
            aria-label="Filter by Qualification Decision"
            value={qualificationFilter}
            onChange={(e) => {
              setQualificationFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 bg-app-secondary border border-app-border rounded-lg px-3 text-xs text-text-primary min-w-[165px]"
          >
            <option value="">All Qualification States</option>
            <option value="not reviewed">not reviewed</option>
            <option value="qualified">qualified</option>
            <option value="needs research">needs research</option>
            <option value="disqualified">disqualified</option>
          </select>
        )}

        <select
          aria-label="Sort Leads"
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [sb, sd] = e.target.value.split(":");
            setSortBy(sb as typeof sortBy);
            setSortDir(sd as typeof sortDir);
          }}
          className="h-9 bg-app-secondary border border-app-border rounded-lg px-3 text-xs text-text-primary font-mono min-w-[185px]"
        >
          <option value="sequenceNumber:asc">Sort: Number (001 → ∞)</option>
          <option value="sequenceNumber:desc">Sort: Number (∞ → 001)</option>
          <option value="updatedAt:desc">Sort: Recently Updated</option>
          <option value="name:asc">Sort: Name (A → Z)</option>
          <option value="name:desc">Sort: Name (Z → A)</option>
          <option value="score:desc">Sort: Highest Score</option>
          <option value="country:asc">Sort: Country (A → Z)</option>
        </select>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <div
            className="h-9 flex items-center gap-1 bg-app-secondary border border-app-border rounded-lg px-1.5 text-xs font-mono shrink-0"
            role="group"
            aria-label="Leads per page"
          >
            <span className="px-1.5 text-[10px] uppercase text-text-muted">
              Per Page:
            </span>
            {(
              [
                { value: 50, label: "50" },
                { value: 100, label: "100" },
                { value: "unlimited", label: "Unlimited" },
              ] as const
            ).map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  setPageSize(opt.value);
                  setPage(1);
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold tabular-nums transition ${
                  pageSize === opt.value
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              title="Customize Columns"
              aria-label="Customize visible table columns"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border text-text-secondary hover:text-text-primary transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-app-surface border border-app-border rounded-xl p-3 shadow-xl z-30 space-y-1.5 text-xs">
                <div className="font-mono text-[10px] uppercase text-text-muted pb-1 border-b border-app-border">
                  Visible Columns
                </div>
                {Object.entries(visibleCols).map(([colKey, isVis]) => {
                  const colLabels: Record<string, string> = {
                    number: "Number (001→∞)",
                    website: "Website & Contact",
                    country: "Country / Market",
                    niche: "Category",
                    verification: "Verification",
                    score: "Score",
                    stage: "Pipeline Stage",
                    qualification: "Qualification",
                    outreach: "Outreach Approval",
                    nextAction: "Next Action",
                    quickActions: "Quick Actions",
                  };
                  return (
                    <label
                      key={colKey}
                      className="flex items-center gap-2 text-text-primary cursor-pointer py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={isVis}
                        onChange={(e) =>
                          setVisibleCols((prev) => ({
                            ...prev,
                            [colKey]: e.target.checked,
                          }))
                        }
                      />
                      <span>{colLabels[colKey] || colKey}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar when rows are selected (Section 10.4) */}
      {selectedIds.size > 0 && (
        <div className="bg-accent/15 border border-accent/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-accent">
              {selectedIds.size} record(s) selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-text-secondary hover:underline ml-2"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Bulk Store in Category"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkOperation("assign_category", e.target.value);
                  e.target.value = "";
                }
              }}
              className="bg-app-surface border border-accent/50 rounded-lg px-2.5 py-1.5 text-text-primary font-semibold"
            >
              <option value="">Store in Category...</option>
              {allCategoryNames.map((catName) => (
                <option key={catName} value={catName}>
                  Store in: {catName}
                </option>
              ))}
            </select>

            <select
              aria-label="Bulk Move to Day"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkOperation("assign_day", e.target.value);
                  e.target.value = "";
                }
              }}
              className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary font-mono"
            >
              <option value="">Move to Day...</option>
              {availableDays.map((d) => (
                <option key={d.dayKey} value={d.dayKey}>
                  Day #{d.formattedDayNumber} ({d.dayKey})
                </option>
              ))}
            </select>

            <select
              aria-label="Bulk Move Stage"
              onChange={(e) => {
                if (e.target.value) handleBulkOperation("change_stage", e.target.value);
              }}
              className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
            >
              <option value="">Bulk Move Stage...</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  Move to {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Bulk Assign Collection"
              onChange={(e) => {
                if (e.target.value) handleBulkOperation("assign_collection", e.target.value);
              }}
              className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
            >
              <option value="">Assign to Collection...</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  + {c.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Bulk Qualification Decision"
              onChange={(e) => {
                if (e.target.value) handleBulkOperation("set_qualification", e.target.value);
              }}
              className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-text-primary"
            >
              <option value="">Set Qualification...</option>
              <option value="qualified">Mark Qualified</option>
              <option value="needs research">Needs Research</option>
              <option value="not reviewed">Not Reviewed</option>
            </select>

            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Add tag..."
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                className="bg-app-surface border border-app-border rounded-lg px-2 py-1.5 text-text-primary w-28"
              />
              {bulkTagInput.trim() && (
                <button
                  type="button"
                  onClick={() => handleBulkOperation("add_tag", bulkTagInput)}
                  className="px-2.5 py-1.5 rounded-lg bg-accent text-white font-medium"
                >
                  Tag
                </button>
              )}
            </div>

            <a
              href={`/api/export?format=csv&ids=${Array.from(selectedIds).join(",")}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-app-surface border border-app-border text-text-primary"
            >
              <Download className="w-3.5 h-3.5" />
              Export Selected
            </a>

            <button
              type="button"
              onClick={() => handleBulkOperation("archive")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-status-error/15 text-status-error font-medium"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
          </div>
        </div>
      )}

      {/* VIEW 0: TINDER-STYLE CENTERED SWIPE DECK VIEW (MUCH BIGGER, UNCLUTTERED & IN-TAB SITE VIEWER) */}
      {viewMode === "swipe" && (
        <div className="py-6 flex flex-col items-center justify-center">
          {rows.length === 0 ? (
            <div className="max-w-lg w-full bg-app-surface border border-app-border rounded-3xl p-10 text-center space-y-4 shadow-xl">
              <p className="font-heading font-bold text-lg text-text-primary">
                No Leads in Deck Yet
              </p>
              <p className="text-sm text-text-secondary">
                Import your `.xlsx` or `.csv` spreadsheet or add a lead to start swiping and reviewing cards in the center.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-app-secondary hover:bg-app-elevated border border-accent/50 text-xs font-semibold text-accent"
                >
                  <Upload className="w-4 h-4" />
                  Import .XLSX / .CSV
                </button>
                <button
                  type="button"
                  onClick={onOpenQuickAdd}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  + Add Lead
                </button>
              </div>
            </div>
          ) : (
            activeSwipeLead && (() => {
              const swipeUrls = resolveLeadWebPages(activeSwipeLead);
              const activeSwipePreviewUrl =
                swipeSiteMode === "contact"
                  ? swipeUrls.contactPageUrl || swipeUrls.websitePageUrl
                  : swipeUrls.websitePageUrl || swipeUrls.contactPageUrl;
              const swipeLeadNumber =
                activeSwipeLead.displayNumber ||
                formatLeadSequenceNumber(swipeIndex + 1);

              return (
                <div className="w-full max-w-4xl bg-app-surface border border-app-border rounded-3xl shadow-2xl overflow-hidden transition-all">
                  {/* Card Top Banner */}
                  <div className="p-7 bg-gradient-to-br from-app-sidebar via-app-surface to-app-secondary border-b border-app-border space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono text-text-muted">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-accent text-white font-bold tabular-nums text-xs">
                          #{swipeLeadNumber}
                        </span>
                        <span>
                          LEAD {swipeLeadNumber} OF {formatLeadSequenceNumber(rows.length)} • DAY{" "}
                          {activeSwipeLead.dayKey || activeSwipeLead.discoveryDate || "TODAY"} •{" "}
                          {activeSwipeLead.externalId || activeSwipeLead.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSwipeSiteMode("none");
                            setSwipeIndex((p) => (p - 1 >= 0 ? p - 1 : rows.length - 1));
                          }}
                          className="p-1.5 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border text-text-secondary"
                          title="Previous Lead"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSwipeSiteMode("none");
                            setSwipeIndex((p) => (p + 1 < rows.length ? p + 1 : 0));
                          }}
                          className="p-1.5 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border text-text-secondary"
                          title="Next Lead"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/40 text-accent font-mono font-bold text-lg flex flex-col items-center justify-center shrink-0 tabular-nums">
                          <span className="text-[10px] opacity-75">NO.</span>
                          <span>{swipeLeadNumber}</span>
                        </div>
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => onOpenLead(activeSwipeLead.id)}
                            className="text-2xl font-heading font-bold text-text-primary hover:text-accent text-left"
                          >
                            {activeSwipeLead.name}
                          </button>
                          <div className="flex flex-wrap items-center gap-2.5 text-sm text-text-secondary">
                            <span>{activeSwipeLead.country || "Global"}</span>
                            <span>•</span>
                            <select
                              aria-label="Store lead in category"
                              value={
                                activeSwipeLead.industry ||
                                activeSwipeLead.categories?.[0] ||
                                ""
                              }
                              onChange={(e) =>
                                handleAssignLeadCategory(
                                  activeSwipeLead.id,
                                  activeSwipeLead.name,
                                  e.target.value,
                                  e
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/30 text-accent text-xs font-semibold"
                            >
                              <option value="">
                                {activeSwipeLead.industry ||
                                  activeSwipeLead.categories?.[0] ||
                                  "Store in Category..."}
                              </option>
                              {allCategoryNames.map((catName) => (
                                <option key={catName} value={catName}>
                                  {catName}
                                </option>
                              ))}
                            </select>

                            {/* Both Website Page and Contact Page Buttons Side-by-Side (Open in This Tab Only) */}
                            {swipeUrls.websitePageUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSwipeSiteMode(
                                    swipeSiteMode === "website" ? "none" : "website"
                                  )
                                }
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold transition ${
                                  swipeSiteMode === "website"
                                    ? "bg-accent text-white border-accent"
                                    : "bg-accent/15 hover:bg-accent text-accent hover:text-white border-accent/40"
                                }`}
                              >
                                <Globe className="w-3.5 h-3.5" />
                                Website Page ({swipeUrls.displayDomain || "In-Tab"})
                              </button>
                            )}

                            {swipeUrls.contactPageUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSwipeSiteMode(
                                    swipeSiteMode === "contact" ? "none" : "contact"
                                  )
                                }
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold transition ${
                                  swipeSiteMode === "contact"
                                    ? "bg-accent text-white border-accent"
                                    : "bg-app-surface hover:bg-app-elevated text-text-primary border-app-border"
                                }`}
                              >
                                <Compass className="w-3.5 h-3.5 text-accent" />
                                Contact Page
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) =>
                          handleToggleBookmark(activeSwipeLead.id, activeSwipeLead.name, e)
                        }
                        title="Bookmark Website to Design Inspirations"
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${
                          activeSwipeLead.isBookmarked
                            ? "bg-accent text-white border-accent"
                            : "bg-app-secondary hover:bg-app-elevated border-app-border text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        <Bookmark
                          className={`w-4 h-4 ${
                            activeSwipeLead.isBookmarked ? "fill-current" : ""
                          }`}
                        />
                        {activeSwipeLead.isBookmarked ? "Bookmarked" : "Bookmark Site"}
                      </button>
                    </div>
                  </div>

                  {/* Embedded In-Tab Website / Contact Page Viewer inside Swipe Card when toggled */}
                  {swipeSiteMode !== "none" && activeSwipePreviewUrl && (
                    <div className="border-b border-app-border bg-app-sidebar">
                      <div className="px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-app-border text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSwipeSiteMode("website")}
                            className={`px-3 py-1 rounded-lg font-semibold ${
                              swipeSiteMode === "website"
                                ? "bg-accent text-white"
                                : "bg-app-surface text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            Website Page
                          </button>
                          <button
                            type="button"
                            onClick={() => setSwipeSiteMode("contact")}
                            className={`px-3 py-1 rounded-lg font-semibold ${
                              swipeSiteMode === "contact"
                                ? "bg-accent text-white"
                                : "bg-app-surface text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            Contact Page
                          </button>
                          <span className="font-mono text-text-muted truncate max-w-md ml-2">
                            {activeSwipePreviewUrl}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={activeSwipePreviewUrl}
                            target="_self"
                            className="px-2.5 py-1 rounded-lg bg-app-surface border border-app-border text-text-secondary hover:text-text-primary"
                          >
                            Navigate This Tab
                          </a>
                          <button
                            type="button"
                            onClick={() => setSwipeSiteMode("none")}
                            className="px-2.5 py-1 rounded-lg bg-app-surface border border-app-border text-text-secondary hover:text-text-primary"
                          >
                            Hide Preview
                          </button>
                        </div>
                      </div>
                      <div className="h-[460px] bg-white">
                        <iframe
                          src={`/api/site-preview?url=${encodeURIComponent(activeSwipePreviewUrl)}`}
                          title={`${activeSwipeLead.name} preview`}
                          className="w-full h-full border-0"
                          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                        />
                      </div>
                    </div>
                  )}

                  {/* Card Body — Spacious & Uncluttered */}
                  <div className="p-7 space-y-5">
                    <div className="p-5 rounded-2xl bg-app-secondary border border-app-border space-y-2">
                      <span className="text-xs font-mono uppercase text-text-muted block">
                        Observed Facts (from Website)
                      </span>
                      <p className="text-text-primary leading-relaxed text-base">
                        {activeSwipeLead.observedFacts || "No site description recorded yet."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-app-secondary border border-app-border">
                        <span className="text-xs font-mono uppercase text-text-muted block">
                          Published Contact
                        </span>
                        <span className="font-mono text-sm text-text-primary mt-1 block truncate">
                          {activeSwipeLead.publishedContact || "Not listed"}
                        </span>
                      </div>
                      <div className="p-4 rounded-2xl bg-app-secondary border border-app-border">
                        <span className="text-xs font-mono uppercase text-text-muted block">
                          Verification &amp; Qualification
                        </span>
                        <span className="font-mono text-sm text-text-primary mt-1 block">
                          {activeSwipeLead.verificationLevel} •{" "}
                          {activeSwipeLead.qualificationDecision}
                        </span>
                      </div>
                    </div>

                    {/* Simple Message Operations Block right inside the card */}
                    <div className="p-5 rounded-2xl bg-app-secondary border border-app-border flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono text-xs uppercase text-text-muted flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-accent" />
                        Outreach Message Status
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { id: "not_messaged", label: "Not Messaged" },
                          { id: "message_sent", label: "✓ Message Sent" },
                          { id: "followup_sent", label: "✓ Follow-up Sent" },
                          { id: "replied", label: "★ Replied" },
                        ].map((st) => {
                          const active =
                            (activeSwipeLead.messageStatus || "not_messaged") === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={(e) =>
                                handleQuickMessageStatus(
                                  activeSwipeLead.id,
                                  activeSwipeLead.name,
                                  st.id as
                                    | "not_messaged"
                                    | "message_sent"
                                    | "followup_sent"
                                    | "replied",
                                  "Outreach",
                                  e
                                )
                              }
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition ${
                                active
                                  ? "bg-accent text-white border-accent font-semibold"
                                  : "bg-app-surface border-app-border text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Tinder-Style Bottom Action Bar */}
                  <div className="px-7 py-5 bg-app-sidebar border-t border-app-border flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        handleSwipeDecision(activeSwipeLead.id, activeSwipeLead.name, "pass")
                      }
                      className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-status-error/15 hover:bg-status-error/25 border border-status-error/30 text-status-error text-sm font-semibold transition"
                    >
                      <X className="w-4 h-4" />
                      Pass / Skip
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenLead(activeSwipeLead.id)}
                      className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-app-surface hover:bg-app-elevated border border-app-border text-text-primary text-sm font-semibold transition"
                    >
                      Open Full Card
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSwipeDecision(
                          activeSwipeLead.id,
                          activeSwipeLead.name,
                          "qualify"
                        )
                      }
                      className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-status-success/15 hover:bg-status-success/25 border border-status-success/40 text-status-success text-sm font-semibold transition"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                      Qualify &amp; Approve
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* VIEW 1: SPREADSHEET-LIKE DATA TABLE */}
      {viewMode === "table" && (
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-app-secondary text-text-muted font-sans font-semibold uppercase text-[11px] border-b border-app-border">
                <tr>
                  <th className="py-2 px-3 w-9">
                    <button
                      type="button"
                      onClick={toggleSelectAllOnPage}
                      aria-label="Select all rows on page"
                      className="text-text-muted hover:text-text-primary"
                    >
                      {allOnPageSelected ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  {visibleCols.number && (
                    <th className="py-2 px-3 w-20 font-mono">
                      <span className="inline-flex items-center gap-1">
                        <Hash className="w-3 h-3 text-accent" />
                        No. (001→∞)
                      </span>
                    </th>
                  )}
                  <th className="py-2 px-3">Company / Organization</th>
                  {visibleCols.website && <th className="py-2 px-3">Website &amp; Contact Page (In-Tab)</th>}
                  {visibleCols.country && <th className="py-2 px-3">Country / Market</th>}
                  {visibleCols.niche && <th className="py-2 px-3">Category (Store / Filter)</th>}
                  {visibleCols.verification && <th className="py-2 px-3">Verification</th>}
                  {visibleCols.score && <th className="py-2 px-3">Score</th>}
                  {visibleCols.stage && <th className="py-2 px-3">Pipeline Stage</th>}
                  {visibleCols.qualification && <th className="py-2 px-3">Qualification</th>}
                  {visibleCols.outreach && <th className="py-2 px-3">Outreach Approval</th>}
                  {visibleCols.nextAction && <th className="py-2 px-3">Next Action</th>}
                  {visibleCols.quickActions && (
                    <th className="py-2 px-3">Message &amp; Bookmark</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={13} className="py-3.5 px-4">
                        <div className="h-4 bg-app-secondary rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-text-secondary">
                      <div className="max-w-md mx-auto space-y-2.5">
                        <p className="font-heading font-semibold text-sm text-text-primary">
                          No leads in this view yet
                        </p>
                        <p className="text-xs text-text-muted">
                          Import your `.xlsx` or `.csv` spreadsheet directly here, or add a new lead manually. All leads are automatically numbered 001, 002, 003... till Infinity.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-app-secondary hover:bg-app-elevated border border-accent/50 text-accent text-xs font-semibold"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Import .XLSX / .CSV
                          </button>
                          <button
                            type="button"
                            onClick={onOpenQuickAdd}
                            className="px-3.5 py-2 rounded-lg bg-accent text-white text-xs font-semibold"
                          >
                            + Add Lead
                          </button>
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="px-3 py-2 rounded-lg bg-app-secondary text-text-primary text-xs"
                          >
                            Reset Filters
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r, rowIdx) => {
                    const isSelected = selectedIds.has(r.id);
                    const isDirOnly = (r.verificationLevel || "")
                      .toLowerCase()
                      .includes("directory");
                    const hasEvidenceAnomaly = !r.contactEvidenceValid;
                    const msgStatus = r.messageStatus || "not_messaged";
                    const rowUrls = resolveLeadWebPages(r);
                    const numericPageSize =
                      pageSize === "unlimited" ? Math.max(1, rows.length) : pageSize;
                    const rowNumStr =
                      r.displayNumber ||
                      formatLeadSequenceNumber((page - 1) * numericPageSize + rowIdx + 1);
                    const currentCat = r.industry || r.categories?.[0] || "General";

                    return (
                      <tr
                        key={r.id}
                        onClick={() => onOpenLead(r.id)}
                        className={`transition group cursor-pointer ${
                          isSelected
                            ? "bg-accent/10"
                            : "hover:bg-app-secondary/70"
                        }`}
                      >
                        <td
                          className="py-2 px-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => toggleRowSelection(r.id)}
                            aria-label={`Select ${r.name}`}
                            className="text-text-muted hover:text-text-primary"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-accent" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {visibleCols.number && (
                          <td className="py-2 px-3 font-mono">
                            <div className="flex flex-col">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-accent/15 border border-accent/30 text-accent font-bold text-xs tabular-nums w-fit">
                                {rowNumStr}
                              </span>
                              <span className="text-[10px] text-text-muted mt-0.5 tabular-nums">
                                {r.dayKey || r.discoveryDate || "Today"}
                              </span>
                            </div>
                          </td>
                        )}

                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 text-accent font-heading font-bold text-[11px] flex items-center justify-center shrink-0">
                              {r.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenLead(r.id);
                                }}
                                className="font-sans font-semibold text-text-primary group-hover:text-accent text-left truncate block"
                              >
                                {r.name}
                              </button>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
                                <span>#{rowNumStr}</span>
                                <span>•</span>
                                <span>{r.externalId || r.id.slice(0, 8)}</span>
                                <span>•</span>
                                <span>{r.sourceLeadStatus || "candidate"}</span>
                                {hasEvidenceAnomaly && (
                                  <span
                                    title={r.contactEvidenceWarning}
                                    className="inline-flex items-center gap-0.5 text-status-error font-semibold"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    URL Anomaly ({r.contactEvidenceUrl})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {visibleCols.website && (
                          <td
                            className="py-2 px-3 font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {rowUrls.websitePageUrl || rowUrls.contactPageUrl ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {rowUrls.websitePageUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setInTabPreview({ lead: r, mode: "website" })
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-status-info/10 hover:bg-status-info/20 text-status-info text-[11px] font-medium transition"
                                    title="Open Website Page in this tab"
                                  >
                                    <Globe className="w-3 h-3" />
                                    {rowUrls.displayDomain || "Website Page"}
                                  </button>
                                )}
                                {rowUrls.contactPageUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setInTabPreview({ lead: r, mode: "contact" })
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-app-secondary hover:bg-app-elevated border border-app-border text-text-secondary hover:text-text-primary text-[11px] font-sans font-medium transition"
                                    title="Open Contact Page in this tab"
                                  >
                                    <Compass className="w-3 h-3 text-accent" />
                                    Contact Page
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-text-muted font-sans">Unresolved</span>
                            )}
                          </td>
                        )}

                        {visibleCols.country && (
                          <td className="py-2 px-3">
                            <span className="text-text-primary">{r.country || "—"}</span>
                            {r.market && (
                              <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-app-secondary text-text-muted">
                                {r.market}
                              </span>
                            )}
                          </td>
                        )}

                        {visibleCols.niche && (
                          <td
                            className="py-2 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              aria-label={`Category for ${r.name}`}
                              value={currentCat}
                              onChange={(e) =>
                                handleAssignLeadCategory(r.id, r.name, e.target.value, e)
                              }
                              className="px-2 py-1 rounded-md bg-accent/15 border border-accent/30 text-accent font-medium text-[11px] max-w-[160px]"
                            >
                              <option value={currentCat}>{currentCat}</option>
                              {allCategoryNames
                                .filter((cName) => cName !== currentCat)
                                .map((catName) => (
                                  <option key={catName} value={catName}>
                                    {catName}
                                  </option>
                                ))}
                            </select>
                          </td>
                        )}

                        {visibleCols.verification && (
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium ${
                                isDirOnly
                                  ? "bg-status-warning/15 text-status-warning border border-status-warning/30"
                                  : "bg-status-success/10 text-status-success"
                              }`}
                            >
                              {isDirOnly && <AlertTriangle className="w-3 h-3" />}
                              {r.verificationLevel}
                            </span>
                          </td>
                        )}

                        {visibleCols.score && (
                          <td className="py-2 px-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenLead(r.id);
                              }}
                              className={`px-2 py-0.5 rounded font-heading font-semibold tabular-nums text-xs ${
                                r.effectiveScore !== null && r.effectiveScore >= 75
                                  ? "bg-status-success/15 text-status-success"
                                  : r.effectiveScore !== null && r.effectiveScore >= 50
                                  ? "bg-status-warning/15 text-status-warning"
                                  : r.effectiveScore !== null
                                  ? "bg-status-error/15 text-status-error"
                                  : "bg-app-secondary text-text-muted hover:text-text-primary"
                              }`}
                            >
                              {r.effectiveScore !== null ? r.effectiveScore : "Score"}
                            </button>
                          </td>
                        )}

                        {visibleCols.stage && (
                          <td
                            className="py-2 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              aria-label={`Pipeline stage for ${r.name}`}
                              value={r.primaryStageId || "stg_new"}
                              onChange={(e) => handleInlineStageChange(r.id, e.target.value)}
                              className="bg-app-secondary border border-app-border rounded-md px-2 py-1 text-[11px] font-medium text-text-primary"
                            >
                              {stages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}

                        {visibleCols.qualification && (
                          <td
                            className="py-2 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              aria-label={`Qualification status for ${r.name}`}
                              value={
                                r.primaryStageId === "stg_qualified" &&
                                (r.qualificationDecision || "").toLowerCase() !== "qualified"
                                  ? "qualified"
                                  : r.qualificationDecision || "not reviewed"
                              }
                              onChange={(e) =>
                                handleInlineQualificationChange(r.id, r.name, e.target.value)
                              }
                              className={`border rounded-md px-2 py-1 text-[11px] font-mono font-medium ${
                                (r.qualificationDecision || "").toLowerCase() === "qualified" ||
                                r.primaryStageId === "stg_qualified"
                                  ? "bg-status-success/15 border-status-success/40 text-status-success"
                                  : (r.qualificationDecision || "").toLowerCase() === "disqualified"
                                  ? "bg-status-error/15 border-status-error/40 text-status-error"
                                  : "bg-app-secondary border-app-border text-text-secondary"
                              }`}
                            >
                              <option value="not reviewed">not reviewed</option>
                              <option value="qualified">qualified</option>
                              <option value="needs research">needs research</option>
                              <option value="disqualified">disqualified</option>
                            </select>
                          </td>
                        )}

                        {visibleCols.outreach && (
                          <td className="py-2 px-3">
                            <span
                              className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                                r.outreachApproval === "approved"
                                  ? "bg-status-success/15 text-status-success"
                                  : r.outreachApproval === "do not contact"
                                  ? "bg-status-error/15 text-status-error"
                                  : "bg-app-secondary text-text-muted"
                              }`}
                            >
                              {r.outreachApproval}
                            </span>
                          </td>
                        )}

                        {visibleCols.nextAction && (
                          <td className="py-2 px-3 text-text-secondary truncate max-w-[160px]">
                            {r.nextAction || "Review"}
                          </td>
                        )}

                        {visibleCols.quickActions && (
                          <td
                            className="py-2 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleInlineQualificationChange(
                                    r.id,
                                    r.name,
                                    (r.qualificationDecision || "").toLowerCase() === "qualified" ||
                                      r.primaryStageId === "stg_qualified"
                                      ? "not reviewed"
                                      : "qualified",
                                    e
                                  )
                                }
                                title="Click to toggle Qualified Lead status"
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition ${
                                  (r.qualificationDecision || "").toLowerCase() === "qualified" ||
                                  r.primaryStageId === "stg_qualified"
                                    ? "bg-status-success/20 border-status-success/40 text-status-success font-semibold"
                                    : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                                }`}
                              >
                                {(r.qualificationDecision || "").toLowerCase() === "qualified" ||
                                r.primaryStageId === "stg_qualified"
                                  ? "✓ Qualified"
                                  : "Qualify"}
                              </button>

                              <button
                                type="button"
                                onClick={(e) =>
                                  handleQuickMessageStatus(
                                    r.id,
                                    r.name,
                                    msgStatus === "not_messaged"
                                      ? "message_sent"
                                      : msgStatus === "message_sent"
                                      ? "followup_sent"
                                      : msgStatus === "followup_sent"
                                      ? "replied"
                                      : "not_messaged",
                                    "Outreach",
                                    e
                                  )
                                }
                                title="Click to cycle Message Status (Not Messaged → Message Sent → Follow-up Sent → Replied)"
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition ${
                                  msgStatus === "replied"
                                    ? "bg-status-success/20 border-status-success/40 text-status-success"
                                    : msgStatus === "message_sent" ||
                                      msgStatus === "followup_sent"
                                    ? "bg-accent/20 border-accent/40 text-accent"
                                    : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                                }`}
                              >
                                <Send className="w-3 h-3" />
                                {msgStatus === "message_sent"
                                  ? "Sent"
                                  : msgStatus === "followup_sent"
                                  ? "Follow-up"
                                  : msgStatus === "replied"
                                  ? "Replied"
                                  : "Message"}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleToggleBookmark(r.id, r.name, e)}
                                title="Bookmark Website to Design Inspirations"
                                className={`p-1.5 rounded border transition ${
                                  r.isBookmarked
                                    ? "bg-accent text-white border-accent"
                                    : "bg-app-secondary hover:bg-app-elevated border-app-border text-text-secondary hover:text-text-primary"
                                }`}
                              >
                                <Bookmark
                                  className={`w-3.5 h-3.5 ${
                                    r.isBookmarked ? "fill-current" : ""
                                  }`}
                                />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 py-3 bg-app-secondary border-t border-app-border flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                Showing{" "}
                <strong className="font-mono font-semibold tabular-nums text-text-primary">
                  {rows.length === 0
                    ? "000"
                    : pageSize === "unlimited"
                    ? `001–${formatLeadSequenceNumber(rows.length)}`
                    : `${formatLeadSequenceNumber((page - 1) * pageSize + 1)}–${formatLeadSequenceNumber(
                        Math.min(totalCount, page * pageSize)
                      )}`}
                </strong>{" "}
                of{" "}
                <strong className="font-mono font-semibold tabular-nums text-text-primary">
                  {formatLeadSequenceNumber(totalCount || 0)}
                </strong>{" "}
                numbered records
              </div>

              <div
                className="flex items-center gap-1 bg-app-surface border border-app-border rounded-lg p-1 font-mono"
                role="group"
                aria-label="Choose leads per page"
              >
                <span className="px-2 text-[10px] uppercase text-text-muted">
                  Show per page:
                </span>
                {(
                  [
                    { value: 50, label: "50" },
                    { value: 100, label: "100" },
                    { value: "unlimited", label: "Unlimited" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      setPageSize(opt.value);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tabular-nums transition ${
                      pageSize === opt.value
                        ? "bg-accent text-white shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1 || pageSize === "unlimited"}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-app-surface border border-app-border disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(8, totalPages) }).map((_, idx) => {
                const pNum = idx + 1;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setPage(pNum)}
                    className={`w-7 h-7 rounded-lg font-sans tabular-nums text-xs ${
                      page === pNum
                        ? "bg-accent text-white font-semibold"
                        : "bg-app-surface border border-app-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={page >= totalPages || pageSize === "unlimited"}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-app-surface border border-app-border disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KANBAN PIPELINE VIEW */}
      {viewMode === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.slice(0, 7).map((stg) => {
            const stageRows = rows.filter((r) => (r.primaryStageId || "stg_new") === stg.id);
            return (
              <div
                key={stg.id}
                className="w-72 shrink-0 bg-app-surface border border-app-border rounded-xl p-3 flex flex-col max-h-[620px]"
              >
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-app-border">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: stg.color }}
                    />
                    <span className="font-heading font-semibold text-xs text-text-primary">
                      {stg.name}
                    </span>
                  </div>
                  <span className="font-heading font-semibold tabular-nums text-[11px] px-2 py-0.5 rounded bg-app-secondary text-text-secondary">
                    {stageRows.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {stageRows.map((r) => {
                    const msgStatus = r.messageStatus || "not_messaged";
                    const numStr = r.displayNumber || r.formattedSequenceNumber || "001";
                    return (
                      <div
                        key={r.id}
                        onClick={() => onOpenLead(r.id)}
                        className="p-3 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border cursor-pointer transition space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent tabular-nums shrink-0">
                              #{numStr}
                            </span>
                            <span className="font-sans font-semibold text-xs text-text-primary truncate">
                              {r.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {r.effectiveScore !== null && (
                              <span className="px-1.5 py-0.5 rounded bg-status-success/15 text-status-success font-heading font-semibold tabular-nums text-[10px]">
                                {r.effectiveScore}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleToggleBookmark(r.id, r.name, e)}
                              title="Bookmark Website to Design Inspirations"
                              className={`p-1 rounded ${
                                r.isBookmarked
                                  ? "text-accent"
                                  : "text-text-muted hover:text-text-primary"
                              }`}
                            >
                              <Bookmark
                                className={`w-3.5 h-3.5 ${
                                  r.isBookmarked ? "fill-current" : ""
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                        <div className="text-[11px] font-mono text-text-secondary truncate">
                          {r.normalizedDomain || "No domain"} • {r.country}
                        </div>
                        <div
                          className="flex items-center justify-between pt-1.5 border-t border-app-border/60 text-[10px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) =>
                              handleQuickMessageStatus(
                                r.id,
                                r.name,
                                msgStatus === "not_messaged" ? "message_sent" : "replied",
                                "Outreach",
                                e
                              )
                            }
                            className={`px-2 py-0.5 rounded font-medium border ${
                              msgStatus !== "not_messaged"
                                ? "bg-accent/20 border-accent/40 text-accent"
                                : "bg-app-surface border-app-border text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            {msgStatus === "message_sent"
                              ? "✓ Message Sent"
                              : msgStatus === "followup_sent"
                              ? "✓ Follow-up Sent"
                              : msgStatus === "replied"
                              ? "★ Replied"
                              : "Send / Mark Sent"}
                          </button>
                          <span className="text-text-muted font-mono">{r.industry || "General"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: CARDS GRID VIEW */}
      {viewMode === "cards" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((r, idx) => {
              const msgStatus = r.messageStatus || "not_messaged";
              const cardUrls = resolveLeadWebPages(r);
              const numericPageSize =
                pageSize === "unlimited" ? Math.max(1, rows.length) : pageSize;
              const numStr =
                r.displayNumber ||
                formatLeadSequenceNumber((page - 1) * numericPageSize + idx + 1);
              return (
                <div
                  key={r.id}
                  onClick={() => onOpenLead(r.id)}
                  className="bg-app-surface hover:bg-app-secondary border border-app-border rounded-xl p-4 cursor-pointer transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="font-mono font-bold text-xs px-2 py-1 rounded-lg bg-accent/15 border border-accent/30 text-accent tabular-nums">
                          #{numStr}
                        </span>
                        <div>
                          <h3 className="font-heading font-semibold text-sm text-text-primary">
                            {r.name}
                          </h3>
                          <div className="text-xs font-mono text-accent">
                            {cardUrls.displayDomain || "Directory-only record"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-app-secondary font-mono text-[11px] text-text-secondary">
                          {r.country}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleBookmark(r.id, r.name, e)}
                          title="Bookmark Website to Design Inspirations"
                          className={`p-1.5 rounded-lg border transition ${
                            r.isBookmarked
                              ? "bg-accent text-white border-accent"
                              : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          <Bookmark
                            className={`w-3.5 h-3.5 ${r.isBookmarked ? "fill-current" : ""}`}
                          />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {r.observedFacts || "No site observations recorded."}
                    </p>
                  </div>

                  <div
                    className="pt-2.5 border-t border-app-border flex flex-wrap items-center justify-between gap-2 text-[11px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) =>
                          handleInlineQualificationChange(
                            r.id,
                            r.name,
                            (r.qualificationDecision || "").toLowerCase() === "qualified" ||
                              r.primaryStageId === "stg_qualified"
                              ? "not reviewed"
                              : "qualified",
                            e
                          )
                        }
                        className={`px-2 py-1 rounded-md font-medium border ${
                          (r.qualificationDecision || "").toLowerCase() === "qualified" ||
                          r.primaryStageId === "stg_qualified"
                            ? "bg-status-success/20 border-status-success/40 text-status-success font-semibold"
                            : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {(r.qualificationDecision || "").toLowerCase() === "qualified" ||
                        r.primaryStageId === "stg_qualified"
                          ? "✓ Qualified"
                          : "Qualify"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) =>
                          handleQuickMessageStatus(
                            r.id,
                            r.name,
                            msgStatus === "not_messaged" ? "message_sent" : "followup_sent",
                            "Outreach",
                            e
                          )
                        }
                        className={`px-2 py-1 rounded-md font-medium border ${
                          msgStatus === "message_sent" || msgStatus === "followup_sent"
                            ? "bg-accent text-white border-accent"
                            : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {msgStatus === "message_sent"
                          ? "✓ Message Sent"
                          : msgStatus === "followup_sent"
                          ? "✓ Follow-up Sent"
                          : "Mark Message Sent"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) =>
                          handleQuickMessageStatus(r.id, r.name, "replied", "Outreach", e)
                        }
                        className={`px-2 py-1 rounded-md font-medium border ${
                          msgStatus === "replied"
                            ? "bg-status-success text-black border-status-success font-semibold"
                            : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        Replied
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {cardUrls.websitePageUrl && (
                        <button
                          type="button"
                          onClick={() => setInTabPreview({ lead: r, mode: "website" })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent/15 hover:bg-accent text-accent hover:text-white font-medium transition"
                        >
                          <Globe className="w-3 h-3" />
                          Website Page
                        </button>
                      )}
                      {cardUrls.contactPageUrl && (
                        <button
                          type="button"
                          onClick={() => setInTabPreview({ lead: r, mode: "contact" })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-app-secondary hover:bg-app-elevated border border-app-border text-text-secondary hover:text-text-primary font-medium transition"
                        >
                          <Compass className="w-3 h-3 text-accent" />
                          Contact Page
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cards Grid Pagination Footer */}
          <div className="px-4 py-3 bg-app-surface border border-app-border rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                Showing{" "}
                <strong className="font-mono font-semibold tabular-nums text-text-primary">
                  {rows.length === 0
                    ? "000"
                    : pageSize === "unlimited"
                    ? `001–${formatLeadSequenceNumber(rows.length)}`
                    : `${formatLeadSequenceNumber((page - 1) * pageSize + 1)}–${formatLeadSequenceNumber(
                        Math.min(totalCount, page * pageSize)
                      )}`}
                </strong>{" "}
                of{" "}
                <strong className="font-mono font-semibold tabular-nums text-text-primary">
                  {formatLeadSequenceNumber(totalCount || 0)}
                </strong>{" "}
                cards
              </div>

              <div
                className="flex items-center gap-1 bg-app-secondary border border-app-border rounded-lg p-1 font-mono"
                role="group"
                aria-label="Choose cards per page"
              >
                <span className="px-2 text-[10px] uppercase text-text-muted">
                  Show per page:
                </span>
                {(
                  [
                    { value: 50, label: "50" },
                    { value: 100, label: "100" },
                    { value: "unlimited", label: "Unlimited" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      setPageSize(opt.value);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tabular-nums transition ${
                      pageSize === opt.value
                        ? "bg-accent text-white shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1 || pageSize === "unlimited"}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-app-secondary border border-app-border disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(8, totalPages) }).map((_, idx) => {
                const pNum = idx + 1;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setPage(pNum)}
                    className={`w-7 h-7 rounded-lg font-sans tabular-nums text-xs ${
                      page === pNum
                        ? "bg-accent text-white font-semibold"
                        : "bg-app-secondary border border-app-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={page >= totalPages || pageSize === "unlimited"}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-app-secondary border border-app-border disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: OPTIONAL MAP & LOCATION GROUPING VIEW (Section 22) */}
      {viewMode === "map" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-heading font-semibold text-text-primary">
                  Geographic Distribution (Country-Level Grouping)
                </h2>
                <p className="text-xs text-text-secondary">
                  Represents leads accurately at their verified country level without inventing street coordinates. Click any country cluster to filter.
                </p>
              </div>
              {countryFilter && (
                <button
                  type="button"
                  onClick={() => setCountryFilter("")}
                  className="px-2.5 py-1 rounded bg-accent text-white text-xs"
                >
                  Clear Country: {countryFilter}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {Object.entries(countryBreakdown).map(([countryName, list]) => (
                <div
                  key={countryName}
                  onClick={() =>
                    setCountryFilter(countryFilter === countryName ? "" : countryName)
                  }
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    countryFilter === countryName
                      ? "border-accent bg-accent/15"
                      : "border-app-border bg-app-secondary hover:border-text-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-semibold text-sm text-text-primary flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-accent" />
                      {countryName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent font-mono text-xs font-bold">
                      {list.length}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-secondary mt-2 truncate">
                    {list
                      .slice(0, 3)
                      .map((l) => l.name)
                      .join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-4 space-y-3 max-h-[500px] overflow-y-auto">
            <h3 className="text-xs font-mono uppercase text-text-muted">
              Leads in {countryFilter || "All Locations"} ({rows.length})
            </h3>
            {rows.map((r) => (
              <div
                key={r.id}
                onClick={() => onOpenLead(r.id)}
                className="p-3 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border cursor-pointer text-xs"
              >
                <div className="font-semibold text-text-primary">{r.name}</div>
                <div className="text-text-secondary font-mono text-[11px]">
                  {r.country} • {r.normalizedDomain || "No domain"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IN-TAB WEBSITE & CONTACT PAGE OVERLAY VIEWER (OPENS IN THIS TAB ONLY) */}
      {inTabPreview && (() => {
        const previewUrls = resolveLeadWebPages(inTabPreview.lead);
        const targetUrl =
          inTabPreview.mode === "contact"
            ? previewUrls.contactPageUrl || previewUrls.websitePageUrl
            : previewUrls.websitePageUrl || previewUrls.contactPageUrl;

        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
            onClick={() => setInTabPreview(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-[96vw] max-w-[1440px] h-[90vh] bg-app-surface border border-app-border rounded-3xl flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-4 bg-app-sidebar border-b border-app-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading font-bold text-base text-text-primary mr-2">
                    {inTabPreview.lead.name}
                  </span>

                  {previewUrls.websitePageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setInTabPreview({ lead: inTabPreview.lead, mode: "website" })
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                        inTabPreview.mode === "website"
                          ? "bg-accent text-white border-accent"
                          : "bg-app-surface hover:bg-app-elevated border-app-border text-text-primary"
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      Website Page
                    </button>
                  )}

                  {previewUrls.contactPageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setInTabPreview({ lead: inTabPreview.lead, mode: "contact" })
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                        inTabPreview.mode === "contact"
                          ? "bg-accent text-white border-accent"
                          : "bg-app-surface hover:bg-app-elevated border-app-border text-text-primary"
                      }`}
                    >
                      <Compass className="w-4 h-4" />
                      Contact Page
                    </button>
                  )}

                  <span className="font-mono text-xs text-text-muted truncate max-w-md ml-2">
                    {targetUrl}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleBookmark(inTabPreview.lead.id, inTabPreview.lead.name)
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold ${
                      inTabPreview.lead.isBookmarked
                        ? "bg-accent text-white border-accent"
                        : "bg-app-surface border-app-border text-text-primary"
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    Bookmark Site
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const id = inTabPreview.lead.id;
                      setInTabPreview(null);
                      onOpenLead(id);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-semibold text-text-primary"
                  >
                    Open Lead Card
                  </button>

                  {targetUrl && (
                    <a
                      href={targetUrl}
                      target="_self"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      Navigate This Tab
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setInTabPreview(null)}
                    className="p-2 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-text-secondary hover:text-text-primary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-white">
                {targetUrl ? (
                  <iframe
                    key={`${targetUrl}-${inTabPreview.mode}`}
                    src={`/api/site-preview?url=${encodeURIComponent(targetUrl)}`}
                    title={`${inTabPreview.lead.name} in-tab preview`}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-text-secondary">
                    No website URL available.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
