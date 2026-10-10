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
  ExternalLink,
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
  RefreshCw,
} from "lucide-react";
import { triggerLocalBrowserFileDownload } from "@/lib/browser-storage";
import { resolveLeadWebPages } from "./LeadProfileModal";

interface LeadsDatabaseViewProps {
  collectionId?: string;
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
  collections,
  stages,
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

  const [search, setSearch] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
  const [qualificationFilter, setQualificationFilter] = useState("");
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [minScoreFilter, setMinScoreFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"updatedAt" | "name" | "score" | "country">("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [saveViewName, setSaveViewName] = useState("");
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
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
      if (search.trim()) sp.set("search", search.trim());
      if (marketFilter) sp.set("market", marketFilter);
      if (countryFilter) sp.set("country", countryFilter);
      if (categoryFilter) sp.set("category", categoryFilter);
      if (stageFilter) sp.set("stageId", stageFilter);
      if (verificationFilter) sp.set("verificationLevel", verificationFilter);
      if (qualificationFilter) sp.set("qualificationDecision", qualificationFilter);
      if (minScoreFilter !== "") sp.set("minScore", minScoreFilter);
      if (warningsOnly) sp.set("hasWarning", "true");

      const res = await fetch(`/api/workspace?${sp.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
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
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    setSwipeIndex(0);
  }, [rows.length, collectionId, search, marketFilter]);

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
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok && json.batch) {
        await fetchLeads();
        await onMutated();
        notify(
          `Imported ${json.batch.newRecordsCreated} new leads (${json.batch.existingMatched} matched) from ${file.name}`,
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

  async function handleBulkOperation(
    operation:
      | "change_stage"
      | "add_tag"
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

  const activeSwipeLead = rows[swipeIndex] || rows[0] || null;

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
            style={{ backgroundColor: activeCol?.color || "#7958F5" }}
          >
            {activeCol ? activeCol.name.slice(0, 2).toUpperCase() : "AL"}
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">
              {activeCol ? activeCol.name : "All Leads Database"}
            </h1>
            <p className="text-xs text-text-secondary font-mono">
              {totalCount} leads matching current filters • Click any lead to open Centered Card
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
            disabled={importingFile}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-app-surface hover:bg-app-elevated border border-accent/50 text-xs font-semibold text-accent hover:text-text-primary transition"
          >
            <Upload className="w-3.5 h-3.5" />
            {importingFile ? "Importing..." : "Import .XLSX / .CSV"}
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

      {/* Saved Views Strip (Section 10.2 & 13.2) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-app-surface border border-app-border rounded-xl p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={resetFilters}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              !marketFilter && !verificationFilter && !qualificationFilter && !warningsOnly
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 bg-app-surface border border-app-border rounded-xl p-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search company, domain, Lead ID, facts, contact..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full bg-app-secondary border border-app-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-text-primary"
          />
        </div>

        <select
          aria-label="Filter by Pipeline Stage"
          value={stageFilter}
          onChange={(e) => {
            setStageFilter(e.target.value);
            setPage(1);
          }}
          className="bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
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
          className="bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
        >
          <option value="">All Verification Levels</option>
          <option value="site description">Site Description</option>
          <option value="directory listing only">Directory Listing Only</option>
          <option value="manually verified">Manually Verified</option>
        </select>

        <select
          aria-label="Filter by Qualification Decision"
          value={qualificationFilter}
          onChange={(e) => {
            setQualificationFilter(e.target.value);
            setPage(1);
          }}
          className="bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
        >
          <option value="">All Qualification States</option>
          <option value="not reviewed">not reviewed</option>
          <option value="qualified">qualified</option>
          <option value="needs research">needs research</option>
          <option value="disqualified">disqualified</option>
        </select>

        <div className="flex items-center gap-2">
          <select
            aria-label="Sort Leads"
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [sb, sd] = e.target.value.split(":");
              setSortBy(sb as typeof sortBy);
              setSortDir(sd as typeof sortDir);
            }}
            className="flex-1 bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
          >
            <option value="updatedAt:desc">Sort: Recently Updated</option>
            <option value="name:asc">Sort: Name (A → Z)</option>
            <option value="name:desc">Sort: Name (Z → A)</option>
            <option value="score:desc">Sort: Highest Score</option>
            <option value="country:asc">Sort: Country (A → Z)</option>
          </select>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              title="Customize Columns"
              className="p-2 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border text-text-secondary hover:text-text-primary"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-app-surface border border-app-border rounded-xl p-3 shadow-xl z-30 space-y-1.5 text-xs">
                <div className="font-mono text-[10px] uppercase text-text-muted pb-1 border-b border-app-border">
                  Visible Columns
                </div>
                {Object.entries(visibleCols).map(([colKey, isVis]) => (
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
                    <span className="capitalize">{colKey}</span>
                  </label>
                ))}
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

              return (
                <div className="w-full max-w-4xl bg-app-surface border border-app-border rounded-3xl shadow-2xl overflow-hidden transition-all">
                  {/* Card Top Banner */}
                  <div className="p-7 bg-gradient-to-br from-app-sidebar via-app-surface to-app-secondary border-b border-app-border space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono text-text-muted">
                      <span>
                        LEAD CARD {swipeIndex + 1} OF {rows.length} •{" "}
                        {activeSwipeLead.externalId || activeSwipeLead.id.slice(0, 8)}
                      </span>
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
                        <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/40 text-accent font-heading font-bold text-xl flex items-center justify-center shrink-0">
                          {activeSwipeLead.name.slice(0, 2).toUpperCase()}
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
                            <span className="px-2.5 py-0.5 rounded-lg bg-accent/15 text-accent text-xs font-semibold">
                              {activeSwipeLead.industry || "E-Commerce"}
                            </span>

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
                  <th className="py-2 px-3">Company / Organization</th>
                  {visibleCols.website && <th className="py-2 px-3">Website &amp; Contact Page (In-Tab)</th>}
                  {visibleCols.country && <th className="py-2 px-3">Country / Market</th>}
                  {visibleCols.niche && <th className="py-2 px-3">Niche / Category</th>}
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
                      <td colSpan={12} className="py-3.5 px-4">
                        <div className="h-4 bg-app-secondary rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-text-secondary">
                      <div className="max-w-md mx-auto space-y-2.5">
                        <p className="font-heading font-semibold text-sm text-text-primary">
                          No leads in this view yet
                        </p>
                        <p className="text-xs text-text-muted">
                          Import your `.xlsx` or `.csv` spreadsheet directly here, or add a new lead manually. Clicking any lead opens its centered card.
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
                  rows.map((r) => {
                    const isSelected = selectedIds.has(r.id);
                    const isDirOnly = (r.verificationLevel || "")
                      .toLowerCase()
                      .includes("directory");
                    const hasEvidenceAnomaly = !r.contactEvidenceValid;
                    const msgStatus = r.messageStatus || "not_messaged";
                    const rowUrls = resolveLeadWebPages(r);

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
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-accent/15 text-accent font-medium text-[11px]">
                              {r.industry || r.categories?.[0] || "General"}
                            </span>
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
                          <td className="py-2 px-3 font-mono text-[11px] text-text-secondary">
                            {r.qualificationDecision}
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
            <div>
              Showing{" "}
              <strong className="font-sans font-semibold tabular-nums text-text-primary">
                {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}–
                {Math.min(totalCount, page * pageSize)}
              </strong>{" "}
              of <strong className="font-sans font-semibold tabular-nums text-text-primary">{totalCount}</strong> records
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-app-surface border border-app-border disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(6, totalPages) }).map((_, idx) => {
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
                disabled={page >= totalPages}
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
                    return (
                      <div
                        key={r.id}
                        onClick={() => onOpenLead(r.id)}
                        className="p-3 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border cursor-pointer transition space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-sans font-semibold text-xs text-text-primary">
                            {r.name}
                          </span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => {
            const msgStatus = r.messageStatus || "not_messaged";
            const cardUrls = resolveLeadWebPages(r);
            return (
              <div
                key={r.id}
                onClick={() => onOpenLead(r.id)}
                className="bg-app-surface hover:bg-app-secondary border border-app-border rounded-xl p-4 cursor-pointer transition space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-heading font-semibold text-sm text-text-primary">
                        {r.name}
                      </h3>
                      <div className="text-xs font-mono text-accent">
                        {cardUrls.displayDomain || "Directory-only record"}
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
            {rows.slice(0, 25).map((r) => (
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
