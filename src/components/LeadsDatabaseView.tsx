"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Plus,
  Download,
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
  Tag,
  FolderKanban,
} from "lucide-react";
import { triggerLocalBrowserFileDownload } from "@/lib/browser-storage";

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
  categories,
  savedViews,
  onOpenLead,
  onOpenQuickAdd,
  onMutated,
  notify,
}: LeadsDatabaseViewProps) {
  const activeCol = collections.find((c) => c.id === collectionId);

  const [viewMode, setViewMode] = useState<"table" | "kanban" | "cards" | "map">("table");
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

  return (
    <div className="space-y-4">
      {/* Top Header Bar (Matches Mockup 3) */}
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
              {totalCount} leads matching current filters • Page {page} of {totalPages}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-app-surface p-1 rounded-lg border border-app-border text-xs">
            {[
              { id: "table", label: "Table", icon: TableIcon },
              { id: "kanban", label: "Kanban", icon: Columns },
              { id: "cards", label: "Cards", icon: LayoutGrid },
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
          <option value="site description">Site Description (192)</option>
          <option value="directory listing only">Directory Listing Only (8)</option>
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

      {/* VIEW 1: SPREADSHEET-LIKE DATA TABLE (Matches Mockup 3 & Mockup 2) */}
      {viewMode === "table" && (
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-app-secondary text-text-muted font-mono uppercase text-[11px] border-b border-app-border">
                <tr>
                  <th className="py-2.5 px-3 w-9">
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
                  <th className="py-2.5 px-3">Company / Organization</th>
                  {visibleCols.website && <th className="py-2.5 px-3">Website</th>}
                  {visibleCols.country && <th className="py-2.5 px-3">Country / Market</th>}
                  {visibleCols.niche && <th className="py-2.5 px-3">Niche / Category</th>}
                  {visibleCols.verification && <th className="py-2.5 px-3">Verification</th>}
                  {visibleCols.score && <th className="py-2.5 px-3">Score</th>}
                  {visibleCols.stage && <th className="py-2.5 px-3">Pipeline Stage</th>}
                  {visibleCols.qualification && <th className="py-2.5 px-3">Qualification</th>}
                  {visibleCols.outreach && <th className="py-2.5 px-3">Outreach Approval</th>}
                  {visibleCols.nextAction && <th className="py-2.5 px-3">Next Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={11} className="py-3.5 px-4">
                        <div className="h-4 bg-app-secondary rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-text-secondary">
                      <div className="max-w-sm mx-auto space-y-2">
                        <p className="font-heading font-semibold text-sm text-text-primary">
                          No leads match the active filters
                        </p>
                        <p className="text-xs text-text-muted">
                          Reset your filters, add a new lead manually, or import a spreadsheet.
                        </p>
                        <div className="flex justify-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="px-3 py-1.5 rounded-lg bg-app-secondary text-text-primary text-xs"
                          >
                            Reset Filters
                          </button>
                          <button
                            type="button"
                            onClick={onOpenQuickAdd}
                            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold"
                          >
                            + Add Lead
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

                    return (
                      <tr
                        key={r.id}
                        className={`transition group ${
                          isSelected
                            ? "bg-accent/10"
                            : "hover:bg-app-secondary/70"
                        }`}
                      >
                        <td className="py-2.5 px-3">
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

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 text-accent font-heading font-bold text-[11px] flex items-center justify-center shrink-0">
                              {r.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => onOpenLead(r.id)}
                                className="font-heading font-semibold text-text-primary hover:text-accent text-left truncate block"
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
                          <td className="py-2.5 px-3 font-mono">
                            {r.normalizedDomain ? (
                              <a
                                href={
                                  r.websiteUrl?.startsWith("http")
                                    ? r.websiteUrl
                                    : `https://${r.websiteUrl}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-status-info hover:underline"
                              >
                                {r.normalizedDomain}
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                            ) : (
                              <span className="text-text-muted italic">Unresolved</span>
                            )}
                          </td>
                        )}

                        {visibleCols.country && (
                          <td className="py-2.5 px-3">
                            <span className="text-text-primary">{r.country || "—"}</span>
                            {r.market && (
                              <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-app-secondary text-text-muted">
                                {r.market}
                              </span>
                            )}
                          </td>
                        )}

                        {visibleCols.niche && (
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-accent/15 text-accent font-medium text-[11px]">
                              {r.industry || r.categories?.[0] || "General"}
                            </span>
                          </td>
                        )}

                        {visibleCols.verification && (
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
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
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => onOpenLead(r.id)}
                              className={`px-2 py-0.5 rounded font-mono font-semibold text-xs ${
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
                          <td className="py-2.5 px-3">
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
                          <td className="py-2.5 px-3 font-mono text-[11px] text-text-secondary">
                            {r.qualificationDecision}
                          </td>
                        )}

                        {visibleCols.outreach && (
                          <td className="py-2.5 px-3">
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
                          <td className="py-2.5 px-3 text-text-secondary truncate max-w-[180px]">
                            {r.nextAction || "Review"}
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
              <strong className="font-mono text-text-primary">
                {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}–
                {Math.min(totalCount, page * pageSize)}
              </strong>{" "}
              of <strong className="font-mono text-text-primary">{totalCount}</strong> records
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
                    className={`w-7 h-7 rounded-lg font-mono text-xs ${
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
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-app-secondary text-text-secondary">
                    {stageRows.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {stageRows.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => onOpenLead(r.id)}
                      className="p-3 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border cursor-pointer transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-heading font-semibold text-xs text-text-primary">
                          {r.name}
                        </span>
                        {r.effectiveScore !== null && (
                          <span className="px-1.5 py-0.5 rounded bg-status-success/15 text-status-success font-mono text-[10px]">
                            {r.effectiveScore}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-text-secondary truncate">
                        {r.normalizedDomain || "No domain"} • {r.country}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[10px] text-text-muted">
                        <span>{r.industry || "General"}</span>
                        <span>{r.verificationLevel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: CARDS GRID VIEW */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div
              key={r.id}
              onClick={() => onOpenLead(r.id)}
              className="bg-app-surface hover:bg-app-secondary border border-app-border rounded-xl p-4 cursor-pointer transition space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading font-semibold text-sm text-text-primary">
                    {r.name}
                  </h3>
                  <div className="text-xs font-mono text-accent">
                    {r.normalizedDomain || "Directory-only record"}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-app-secondary font-mono text-[11px] text-text-secondary">
                  {r.country}
                </span>
              </div>
              <p className="text-xs text-text-secondary line-clamp-2">
                {r.observedFacts || "No site observations recorded."}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-app-border text-[11px] font-mono text-text-muted">
                <span>{r.industry}</span>
                <span>{r.verificationLevel}</span>
              </div>
            </div>
          ))}
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
    </div>
  );
}
