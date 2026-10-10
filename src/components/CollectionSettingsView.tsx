"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Sliders,
  Tag,
  Layers,
  Settings,
  CheckCircle2,
  FolderPlus,
} from "lucide-react";
import { DEFAULT_SCORING_CONFIG, type ScoringConfigJSON } from "@/db/schema";

const SUPPORTED_FIELD_TYPES = [
  { value: "text", label: "Text (Short text)" },
  { value: "long_text", label: "Long Text (Extended notes)" },
  { value: "number", label: "Number (Numeric values)" },
  { value: "currency", label: "Currency (Monetary amounts)" },
  { value: "percentage", label: "Percentage (%)" },
  { value: "date", label: "Date (Calendar date)" },
  { value: "datetime", label: "Date & Time (Timestamp)" },
  { value: "checkbox", label: "Checkbox (Boolean)" },
  { value: "single_select", label: "Single Select (Dropdown)" },
  { value: "multi_select", label: "Multi Select (Multiple values)" },
  { value: "url", label: "URL (Website or link)" },
  { value: "email", label: "Email (Validated email)" },
  { value: "phone", label: "Phone (Phone number)" },
  { value: "rating", label: "Rating (1-5 Rating)" },
  { value: "relation", label: "Relation (Link to record)" },
  { value: "file", label: "File (Attachment)" },
  { value: "country", label: "Country (Country selection)" },
  { value: "formula", label: "Formula (Derived expression)" },
];

interface CollectionSettingsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collections: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fieldDefinitions: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stages: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  savedViews: any[];
  selectedCollectionId?: string;
  onSelectCollection: (id: string) => void;
  onMutated: () => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function CollectionSettingsView({
  collections,
  categories,
  fieldDefinitions,
  stages,
  savedViews,
  selectedCollectionId,
  onSelectCollection,
  onMutated,
  notify,
}: CollectionSettingsProps) {
  const activeCol =
    collections.find((c) => c.id === selectedCollectionId) || collections[0];
  const [subTab, setSubTab] = useState<
    "general" | "fields" | "categories" | "pipeline" | "scoring" | "views"
  >("fields");

  // Create Collection Modal state
  const [showNewColModal, setShowNewColModal] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");
  const [newColColor, setNewColColor] = useState("#7958F5");
  const [newColRecordType, setNewColRecordType] = useState("company");
  const [newColDefaultView, setNewColDefaultView] = useState("table");
  const [newColCats, setNewColCats] = useState("Fashion, Electronics, D2C Brand");

  // Field form
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState("single_select");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("");

  // Category form
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#7958F5");

  // Pipeline stage form
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#659BFA");
  const [stageClassification, setStageClassification] = useState("open");

  // Scoring weights state
  const currentScoring: ScoringConfigJSON =
    activeCol?.scoringConfig || DEFAULT_SCORING_CONFIG;
  const [dimensions, setDimensions] = useState(currentScoring.dimensions);
  const [highThreshold, setHighThreshold] = useState(currentScoring.highThreshold);
  const [mediumThreshold, setMediumThreshold] = useState(currentScoring.mediumThreshold);

  const colFields = fieldDefinitions.filter(
    (f) => !f.collectionId || f.collectionId === activeCol?.id
  );
  const colCats = categories.filter((c) => c.collectionId === activeCol?.id);
  const colViews = savedViews.filter((v) => v.collectionId === activeCol?.id);

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newColName.trim()) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_collection",
        payload: {
          name: newColName.trim(),
          description: newColDesc.trim(),
          color: newColColor,
          recordType: newColRecordType,
          defaultView: newColDefaultView,
          categories: newColCats
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
        },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowNewColModal(false);
      setNewColName("");
      setNewColDesc("");
      await onMutated();
      if (data.id) onSelectCollection(data.id);
      notify("Collection created", "success");
    }
  }

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    if (!fieldName.trim() || !activeCol) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_custom_field",
        payload: {
          collectionId: activeCol.id,
          name: fieldName.trim(),
          fieldType,
          isRequired: fieldRequired,
          options: fieldOptions
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean),
        },
      }),
    });
    if (res.ok) {
      setFieldName("");
      setFieldOptions("");
      setFieldRequired(false);
      await onMutated();
      notify(`Custom field "${fieldName.trim()}" added to ${activeCol.name}`, "success");
    }
  }

  async function handleArchiveField(id: string) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive_custom_field", payload: { id } }),
    });
    await onMutated();
    notify("Custom field archived safely", "info");
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim() || !activeCol) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_category",
        payload: {
          collectionId: activeCol.id,
          name: catName.trim(),
          color: catColor,
        },
      }),
    });
    setCatName("");
    await onMutated();
    notify(`Category "${catName.trim()}" created`, "success");
  }

  async function handleAddStage(e: React.FormEvent) {
    e.preventDefault();
    if (!stageName.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_pipeline_stage",
        payload: {
          name: stageName.trim(),
          color: stageColor,
          classification: stageClassification,
          sortOrder: stages.length + 1,
        },
      }),
    });
    setStageName("");
    await onMutated();
    notify(`Pipeline stage "${stageName.trim()}" added`, "success");
  }

  async function handleSaveScoringRules() {
    if (!activeCol) return;
    const totalWeight = dimensions.reduce((sum, d) => sum + Number(d.weight || 0), 0);
    if (totalWeight !== 100) {
      notify(
        `Dimension weights must total 100% (currently ${totalWeight}%). Adjust weights before saving.`,
        "error"
      );
      return;
    }
    const nextConfig: ScoringConfigJSON = {
      version: (currentScoring.version || 1) + 1,
      highThreshold: Number(highThreshold),
      mediumThreshold: Number(mediumThreshold),
      missingValuePolicy: currentScoring.missingValuePolicy || "unscored",
      dimensions,
    };
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_collection",
        payload: { id: activeCol.id, scoringConfig: nextConfig },
      }),
    });
    await onMutated();
    notify("Scoring configuration saved", "success");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-app-border pb-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">
            Collection Settings &amp; Custom Schema
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Configure custom fields, categories, pipelines, and weighted scoring dimensions per collection without writing code.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            aria-label="Select Collection to Configure"
            value={activeCol?.id || ""}
            onChange={(e) => {
              onSelectCollection(e.target.value);
              const found = collections.find((c) => c.id === e.target.value);
              if (found?.scoringConfig) {
                setDimensions(found.scoringConfig.dimensions);
                setHighThreshold(found.scoringConfig.highThreshold);
                setMediumThreshold(found.scoringConfig.mediumThreshold);
              }
            }}
            className="bg-app-surface border border-app-border rounded-lg px-3 py-2 text-xs font-medium text-text-primary"
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                Collection: {c.name} ({c.leadCount || 0} records)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowNewColModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
          >
            <FolderPlus className="w-4 h-4" />
            + New Collection
          </button>
        </div>
      </div>

      {/* Sub-navigation matching Screenshot 10 */}
      <div className="flex items-center gap-1 border-b border-app-border">
        {[
          { id: "general", label: "General" },
          { id: "fields", label: `Fields (${colFields.length})` },
          { id: "categories", label: `Categories (${colCats.length})` },
          { id: "pipeline", label: `Pipeline (${stages.length})` },
          { id: "scoring", label: "Scoring Rules" },
          { id: "views", label: `Saved Views (${colViews.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              subTab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: FIELDS (Matches Screenshot 10) */}
      {subTab === "fields" && activeCol && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-app-border flex items-center justify-between">
              <h2 className="text-sm font-heading font-semibold text-text-primary">
                Custom Fields for {activeCol.name}
              </h2>
              <span className="text-xs font-mono text-text-muted">
                18 Field Types Supported
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-app-secondary text-text-muted font-mono uppercase">
                <tr>
                  <th className="py-2.5 px-4">Field Name</th>
                  <th className="py-2.5 px-4">Internal Key</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Required</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {colFields.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-text-secondary">
                      No custom fields added to this collection yet. Use the form on the right to add one.
                    </td>
                  </tr>
                ) : (
                  colFields.map((f) => (
                    <tr key={f.id} className="hover:bg-app-secondary/50">
                      <td className="py-3 px-4 font-medium text-text-primary">{f.name}</td>
                      <td className="py-3 px-4 font-mono text-text-muted">{f.key}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-app-secondary border border-app-border font-mono text-text-secondary">
                          {f.fieldType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {f.isRequired ? (
                          <span className="text-status-warning font-mono">Required</span>
                        ) : (
                          <span className="text-text-muted">Optional</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleArchiveField(f.id)}
                          className="text-text-muted hover:text-status-error transition"
                          title="Archive custom field"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={handleAddField}
            className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-heading font-semibold text-text-primary">
              + Add Custom Field
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="cf-name" className="block text-text-secondary mb-1">
                  Display Name *
                </label>
                <input
                  id="cf-name"
                  type="text"
                  required
                  placeholder="e.g. Institution Type, Tech Stack"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label htmlFor="cf-type" className="block text-text-secondary mb-1">
                  Field Type
                </label>
                <select
                  id="cf-type"
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                >
                  {SUPPORTED_FIELD_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>
                      {ft.label}
                    </option>
                  ))}
                </select>
              </div>
              {(fieldType === "single_select" || fieldType === "multi_select") && (
                <div>
                  <label htmlFor="cf-opts" className="block text-text-secondary mb-1">
                    Dropdown Options (comma-separated)
                  </label>
                  <input
                    id="cf-opts"
                    type="text"
                    placeholder="Shopify, WooCommerce, Custom"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
              )}
              <label className="inline-flex items-center gap-2 text-text-secondary pt-1">
                <input
                  type="checkbox"
                  checked={fieldRequired}
                  onChange={(e) => setFieldRequired(e.target.checked)}
                />
                Require this field on new records
              </label>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
            >
              Create Custom Field
            </button>
          </form>
        </div>
      )}

      {/* TAB: GENERAL */}
      {subTab === "general" && activeCol && (
        <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-heading font-semibold text-text-primary">
                {activeCol.name}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {activeCol.description || "Custom lead collection"}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-app-secondary font-mono text-xs text-text-secondary">
              Record Type: {activeCol.recordType}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-app-border">
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/workspace", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "duplicate_collection",
                    payload: { id: activeCol.id },
                  }),
                });
                await onMutated();
                notify("Collection configuration duplicated", "success");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border text-xs font-medium text-text-primary"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate Collection Configuration
            </button>

            {activeCol.id !== "col_global_ecommerce" && (
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/workspace", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "delete_collection",
                      payload: { id: activeCol.id },
                    }),
                  });
                  await onMutated();
                  onSelectCollection("col_global_ecommerce");
                  notify(
                    "Collection deleted. Shared company records in other collections were preserved.",
                    "info"
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-status-error/15 hover:bg-status-error/25 text-status-error text-xs font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Collection (Keep Shared Companies)
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB: CATEGORIES */}
      {subTab === "categories" && activeCol && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-heading font-semibold text-text-primary">
              Categories in {activeCol.name}
            </h3>
            <p className="text-xs text-text-secondary">
              Categories describe what kind of business or reference a record is (separate from pipeline stages).
            </p>
            <div className="space-y-2 pt-2">
              {colCats.map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded-lg bg-app-secondary border border-app-border flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="font-medium text-text-primary">{c.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/workspace", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "delete_category",
                          payload: { id: c.id },
                        }),
                      });
                      await onMutated();
                    }}
                    className="text-text-muted hover:text-status-error"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddCategory}
            className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-heading font-semibold text-text-primary">
              + Add Category
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. D2C Brand, Wholesale, Good Reel"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Accent Color</label>
                <input
                  type="color"
                  value={catColor}
                  onChange={(e) => setCatColor(e.target.value)}
                  className="h-9 w-20 bg-app-secondary border border-app-border rounded"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-accent text-white text-xs font-semibold"
            >
              Add Category
            </button>
          </form>
        </div>
      )}

      {/* TAB: PIPELINE STAGES */}
      {subTab === "pipeline" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-heading font-semibold text-text-primary">
              Pipeline Stages (Progress Workflow)
            </h3>
            <div className="space-y-2">
              {stages.map((s, idx) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-lg bg-app-secondary border border-app-border flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-text-muted">{idx + 1}.</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="font-medium text-text-primary">{s.name}</span>
                  </div>
                  <span className="font-mono text-[11px] uppercase px-2 py-0.5 rounded bg-app-surface border border-app-border text-text-secondary">
                    {s.classification}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddStage}
            className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-heading font-semibold text-text-primary">
              + Add Pipeline Stage
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Stage Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Technical Audit, Contract Sent"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Stage Classification</label>
                <select
                  value={stageClassification}
                  onChange={(e) => setStageClassification(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                >
                  <option value="open">Open / Active Progress</option>
                  <option value="won">Won / Closed Success</option>
                  <option value="lost">Lost / Disqualified</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-accent text-white text-xs font-semibold"
            >
              Add Stage
            </button>
          </form>
        </div>
      )}

      {/* TAB: SCORING RULES */}
      {subTab === "scoring" && activeCol && (
        <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-5 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-heading font-semibold text-text-primary">
                Weighted Opportunity Scoring Dimensions ({activeCol.name})
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Weights must sum to 100%. Unknown inputs never receive automatic positive scores.
              </p>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-app-secondary border border-app-border">
              Total Weight: {dimensions.reduce((s, d) => s + Number(d.weight || 0), 0)}%
            </span>
          </div>

          <div className="space-y-2.5">
            {dimensions.map((dim, idx) => (
              <div
                key={dim.key}
                className="grid grid-cols-12 items-center gap-3 p-3 rounded-lg bg-app-secondary border border-app-border text-xs"
              >
                <div className="col-span-5">
                  <input
                    type="text"
                    value={dim.label}
                    onChange={(e) => {
                      const next = [...dimensions];
                      next[idx] = { ...dim, label: e.target.value };
                      setDimensions(next);
                    }}
                    className="w-full bg-app-surface border border-app-border rounded px-2.5 py-1 text-text-primary font-medium"
                  />
                </div>
                <div className="col-span-5 text-text-secondary truncate">
                  {dim.description || dim.key}
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={dim.weight}
                    onChange={(e) => {
                      const next = [...dimensions];
                      next[idx] = { ...dim, weight: Number(e.target.value) };
                      setDimensions(next);
                    }}
                    className="w-16 bg-app-surface border border-app-border rounded px-2 py-1 font-mono text-text-primary text-right"
                  />
                  <span className="font-mono text-text-muted">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-app-border text-xs">
            <div>
              <label className="block text-text-secondary mb-1">
                High Priority Threshold (&ge;)
              </label>
              <input
                type="number"
                value={highThreshold}
                onChange={(e) => setHighThreshold(Number(e.target.value))}
                className="w-32 bg-app-secondary border border-app-border rounded px-2.5 py-1.5 font-mono text-text-primary"
              />
            </div>
            <div>
              <label className="block text-text-secondary mb-1">
                Medium Priority Threshold (&ge;)
              </label>
              <input
                type="number"
                value={mediumThreshold}
                onChange={(e) => setMediumThreshold(Number(e.target.value))}
                className="w-32 bg-app-secondary border border-app-border rounded px-2.5 py-1.5 font-mono text-text-primary"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveScoringRules}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
          >
            Save Scoring Configuration
          </button>
        </div>
      )}

      {/* TAB: SAVED VIEWS */}
      {subTab === "views" && (
        <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3 max-w-2xl">
          <h3 className="text-sm font-heading font-semibold text-text-primary">
            Saved Views for {activeCol?.name}
          </h3>
          {colViews.length === 0 ? (
            <p className="text-xs text-text-secondary">
              No saved views configured yet. Save any filter combination from the Leads Database table.
            </p>
          ) : (
            <div className="space-y-2">
              {colViews.map((v) => (
                <div
                  key={v.id}
                  className="p-3 rounded-lg bg-app-secondary border border-app-border flex items-center justify-between text-xs"
                >
                  <div>
                    <strong className="text-text-primary">{v.name}</strong>
                    <span className="ml-2 font-mono text-text-muted">
                      Filters: {JSON.stringify(v.filters)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/workspace", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "delete_saved_view",
                          payload: { id: v.id },
                        }),
                      });
                      await onMutated();
                    }}
                    className="text-text-muted hover:text-status-error"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Collection Modal */}
      {showNewColModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCollection}
            className="w-full max-w-lg bg-app-surface border border-app-border rounded-xl p-6 space-y-4 shadow-xl"
          >
            <h2 className="text-base font-heading font-bold text-text-primary">
              Create New Lead Collection
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Collection Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. School Website Leads, SaaS AI Prospects"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Purpose and target criteria..."
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">Record Type</label>
                  <select
                    value={newColRecordType}
                    onChange={(e) => setNewColRecordType(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-2.5 py-2 text-text-primary"
                  >
                    <option value="company">Company</option>
                    <option value="person">Person</option>
                    <option value="opportunity">Opportunity</option>
                    <option value="reference">Reference</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Default View</label>
                  <select
                    value={newColDefaultView}
                    onChange={(e) => setNewColDefaultView(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-2.5 py-2 text-text-primary"
                  >
                    <option value="table">Table</option>
                    <option value="kanban">Kanban</option>
                    <option value="cards">Cards</option>
                    <option value="map">Map</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Accent Color</label>
                  <input
                    type="color"
                    value={newColColor}
                    onChange={(e) => setNewColColor(e.target.value)}
                    className="w-full h-9 bg-app-secondary border border-app-border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-text-secondary mb-1">
                  Initial Categories (comma-separated)
                </label>
                <input
                  type="text"
                  value={newColCats}
                  onChange={(e) => setNewColCats(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-app-border">
              <button
                type="button"
                onClick={() => setShowNewColModal(false)}
                className="px-4 py-2 rounded-lg bg-app-secondary text-text-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold"
              >
                Create Collection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
