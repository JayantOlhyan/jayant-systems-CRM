"use client";

import React, { useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  RotateCcw,
  Layers,
  ShieldAlert,
  Sparkles,
  Plus,
  Search,
} from "lucide-react";
import { CRM_STANDARD_FIELDS } from "@/lib/domain-utils";
import { triggerLocalBrowserFileDownload } from "@/lib/browser-storage";
import type {
  WorkbookInspectionResult,
  ImportPreviewSummary,
  DuplicateHandlingPolicy,
} from "@/lib/importer";

interface CollectionItem {
  id: string;
  name: string;
  color: string;
}

interface ImportBatchRecord {
  id: string;
  filename: string;
  fileFormat: string;
  selectedSheet: string;
  collectionId: string | null;
  status: string;
  totalRows: number;
  newRecordsCreated: number;
  existingMatched: number;
  recordsUpdated: number;
  duplicatesSkipped: number;
  rowsRequiringReview: number;
  validationWarningsCount: number;
  failedRowsCount: number;
  runLogProvenance: Record<string, unknown>[];
  suppressionRowsCount: number;
  warningsSummary: Array<{
    rowNumber: number;
    externalId?: string;
    business?: string;
    field: string;
    value: string;
    message: string;
  }>;
  createdAt: string;
}

interface ImportCenterProps {
  collections: CollectionItem[];
  importBatches: ImportBatchRecord[];
  customFields: Array<{ id: string; name: string; key: string; fieldType: string }>;
  savedMappings: Array<{ id: string; name: string; mapping: Record<string, string> }>;
  onImportComplete: (collectionId?: string) => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
  initialSubTab?: "wizard" | "history" | "export";
}

export function ImportCenterView({
  collections,
  importBatches,
  customFields,
  savedMappings,
  onImportComplete,
  notify,
  initialSubTab = "wizard",
}: ImportCenterProps) {
  const [subTab, setSubTab] = useState<"wizard" | "history" | "export">(initialSubTab);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [inspection, setInspection] = useState<WorkbookInspectionResult | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("Leads");
  const [headerRowNumber, setHeaderRowNumber] = useState<number>(1);
  const [collectionId, setCollectionId] = useState<string>(
    collections[0]?.id || "col_global_ecommerce"
  );
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [activePreviewCol, setActivePreviewCol] = useState<string | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] =
    useState<DuplicateHandlingPolicy>("fill_blanks");
  const [previewData, setPreviewData] = useState<ImportPreviewSummary | null>(null);
  const [previewFilter, setPreviewFilter] = useState<
    "all" | "new" | "exact_match" | "warnings" | "directory_only"
  >("all");
  const [previewSearch, setPreviewSearch] = useState("");
  const [completedBatch, setCompletedBatch] = useState<ImportBatchRecord | null>(null);
  const [newCustomFieldName, setNewCustomFieldName] = useState("");
  const [templateName, setTemplateName] = useState("");

  async function handleFileSelect(file: File | null, useFixture = false) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.set("mode", "inspect");
      if (useFixture) {
        formData.set("useFixture", "true");
      } else if (file) {
        formData.set("file", file);
      } else {
        return;
      }

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to inspect workbook");
      }

      const insp: WorkbookInspectionResult = data.inspection;
      setInspection(insp);
      setFileBase64(data.fileBase64);
      const defaultSheet = insp.recommendedLeadSheet || insp.sheets[0]?.name || "Leads";
      setSelectedSheet(defaultSheet);

      const sheetObj = insp.sheets.find((s) => s.name === defaultSheet) || insp.sheets[0];
      if (sheetObj) {
        setHeaderRowNumber(sheetObj.headerRowNumber);
        setMapping(sheetObj.suggestedMapping);
        setActivePreviewCol(sheetObj.headers[0] || null);
      }
      setStep(2);
      notify(`Inspected "${insp.filename}" (${insp.sheets.length} sheets detected)`, "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setErrorMsg(msg);
      notify(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSheet(sheetName: string) {
    setSelectedSheet(sheetName);
    const s = inspection?.sheets.find((sh) => sh.name === sheetName);
    if (s) {
      setHeaderRowNumber(s.headerRowNumber);
      setMapping(s.suggestedMapping);
      setActivePreviewCol(s.headers[0] || null);
    }
  }

  async function handleRunPreview() {
    if (!inspection || !fileBase64) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          filename: inspection.filename,
          fileBase64,
          selectedSheet,
          mapping,
          headerRowNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreviewData(data.preview);
      setStep(4);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validation preview failed";
      setErrorMsg(msg);
      notify(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteImport() {
    if (!inspection || !fileBase64) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "execute",
          filename: inspection.filename,
          fileBase64,
          selectedSheet,
          collectionId,
          mapping,
          duplicatePolicy,
          headerRowNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setCompletedBatch(data.batch);
      setStep(5);
      await onImportComplete(collectionId);
      notify(
        `Import completed: ${data.batch.newRecordsCreated} new leads created, ${data.batch.existingMatched} existing matched.`,
        "success"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import execution failed";
      setErrorMsg(msg);
      notify(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRollback(batchId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "rollback", batchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rollback failed");
      await onImportComplete();
      notify(
        `Rollback completed: ${data.deletedCount} untouched records removed, ${data.preservedCount} user-modified records safely preserved.`,
        "info"
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Rollback error", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCustomFieldInline() {
    if (!newCustomFieldName.trim()) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_custom_field",
        payload: {
          collectionId,
          name: newCustomFieldName.trim(),
          fieldType: "text",
        },
      }),
    });
    const data = await res.json();
    if (res.ok && data.key) {
      if (activePreviewCol) {
        setMapping((prev) => ({ ...prev, [activePreviewCol]: `custom:${data.key}` }));
      }
      setNewCustomFieldName("");
      await onImportComplete();
      notify(`Custom field "${newCustomFieldName.trim()}" created and mapped`, "success");
    }
  }

  async function handleSaveMappingTemplate() {
    if (!templateName.trim()) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_mapping_template",
        payload: { name: templateName.trim(), mapping },
      }),
    });
    if (res.ok) {
      setTemplateName("");
      await onImportComplete();
      notify("Column mapping template saved", "success");
    }
  }

  const currentSheetObj = inspection?.sheets.find((s) => s.name === selectedSheet);

  const filteredPreviewRows = (previewData?.rows || []).filter((r) => {
    if (previewFilter === "new" && r.status !== "new") return false;
    if (previewFilter === "exact_match" && r.status !== "exact_match" && r.status !== "possible_match")
      return false;
    if (previewFilter === "warnings" && r.warnings.length === 0) return false;
    if (
      previewFilter === "directory_only" &&
      !r.mappedData.verificationLevel.toLowerCase().includes("directory")
    )
      return false;
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase();
      return (
        r.mappedData.name.toLowerCase().includes(q) ||
        (r.mappedData.externalId || "").toLowerCase().includes(q) ||
        (r.mappedData.websiteUrl || "").toLowerCase().includes(q) ||
        (r.mappedData.country || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-app-border pb-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">
            Data & Spreadsheet Import Center
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Inspect multi-sheet workbooks, map columns to collections, validate URL anomalies, and preserve provenance.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-app-surface p-1 rounded-lg border border-app-border">
          <button
            type="button"
            onClick={() => setSubTab("wizard")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              subTab === "wizard"
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Import Spreadsheet
          </button>
          <button
            type="button"
            onClick={() => setSubTab("history")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              subTab === "history"
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Import History ({importBatches.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("export")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              subTab === "export"
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Export Center
          </button>
        </div>
      </div>

      {subTab === "wizard" && (
        <div className="space-y-6">
          {/* 5-Step Progress Bar matching UI Mockup 6 & 5 */}
          <div className="grid grid-cols-5 gap-2 bg-app-surface border border-app-border rounded-xl p-3">
            {[
              { n: 1, label: "1. Upload File" },
              { n: 2, label: "2. Select Sheet" },
              { n: 3, label: "3. Map Columns" },
              { n: 4, label: "4. Review & Validate" },
              { n: 5, label: "5. Import Report" },
            ].map((s) => {
              const active = step === s.n;
              const done = step > s.n;
              return (
                <button
                  key={s.n}
                  type="button"
                  disabled={s.n > step}
                  onClick={() => s.n < step && setStep(s.n as 1 | 2 | 3 | 4 | 5)}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition ${
                    active
                      ? "bg-accent text-white shadow-sm"
                      : done
                      ? "bg-accent/15 text-accent hover:bg-accent/25 cursor-pointer"
                      : "bg-app-secondary text-text-muted cursor-not-allowed"
                  }`}
                >
                  <span className="font-mono font-semibold">{s.label}</span>
                </button>
              );
            })}
          </div>

          {errorMsg && (
            <div className="bg-status-error/10 border border-status-error/40 rounded-lg p-3.5 flex items-start gap-3 text-sm text-status-error">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Import Validation Notice</div>
                <div className="text-xs mt-0.5 opacity-90">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* STEP 1: UPLOAD FILE */}
          {step === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[280px]">
                <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center mb-4">
                  <Upload className="w-6 h-6" />
                </div>
                <h2 className="text-base font-heading font-semibold text-text-primary">
                  Upload Excel (.xlsx) or CSV (.csv) Spreadsheet
                </h2>
                <p className="text-xs text-text-secondary max-w-md mt-1 mb-5">
                  Formulas and macros are never executed. Source row identities, sheets, and raw values are preserved for full provenance.
                </p>

                <label
                  htmlFor="crm-spreadsheet-upload"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer transition"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {loading ? "Inspecting Workbook..." : "Choose .XLSX or .CSV File"}
                </label>
                <input
                  id="crm-spreadsheet-upload"
                  name="file"
                  type="file"
                  accept=".xlsx,.csv"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f) handleFileSelect(f, false);
                  }}
                />
              </div>

              <div className="bg-app-surface border border-app-border rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/15 text-accent text-[11px] font-mono font-medium mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    Verified Master Ledger Fixture
                  </div>
                  <h3 className="text-sm font-heading font-semibold text-text-primary">
                    Global E-Commerce Lead Ledger (2026).xlsx
                  </h3>
                  <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                    Load or download the verified 3-sheet workbook containing 200 candidate leads (100 India, 100 International; 192 site description, 8 directory-only; plus Run Log &amp; Do Not Contact sheets and Contact Evidence URL anomalies <code className="font-mono text-status-warning">49</code> &amp; <code className="font-mono text-status-warning">sent</code>).
                  </p>
                </div>

                <div className="space-y-2.5 mt-6">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleFileSelect(null, true)}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-app-elevated hover:bg-accent hover:text-white text-text-primary border border-app-border text-xs font-semibold transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {loading ? "Loading Workbook..." : "Inspect 200-Lead Ledger in Wizard"}
                  </button>
                  <a
                    href="/api/export?format=ledger_fixture"
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-app-secondary hover:bg-app-elevated text-text-secondary hover:text-text-primary text-xs font-medium transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Workbook (.xlsx)
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INSPECT WORKBOOK & SELECT SHEET */}
          {step === 2 && inspection && (
            <div className="space-y-5">
              <div className="bg-app-surface border border-app-border rounded-xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-app-border">
                  <div>
                    <div className="text-xs font-mono text-text-muted uppercase">
                      Workbook Inspection
                    </div>
                    <h2 className="text-base font-heading font-semibold text-text-primary mt-0.5">
                      {inspection.filename}
                    </h2>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-secondary font-mono">
                    <span>Format: {inspection.fileFormat.toUpperCase()}</span>
                    <span>Size: {(inspection.fileSizeBytes / 1024).toFixed(1)} KB</span>
                    <span>Sheets: {inspection.sheets.length}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {inspection.sheets.map((s) => {
                    const isSelected = selectedSheet === s.name;
                    return (
                      <div
                        key={s.name}
                        onClick={() => handleSelectSheet(s.name)}
                        className={`p-4 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? "border-accent bg-accent/10"
                            : "border-app-border bg-app-secondary hover:border-text-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-heading font-semibold text-sm text-text-primary">
                            {s.name}
                          </span>
                          <span
                            className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                              s.sheetRole === "leads"
                                ? "bg-status-success/15 text-status-success"
                                : s.sheetRole === "run_log"
                                ? "bg-status-info/15 text-status-info"
                                : s.sheetRole === "do_not_contact"
                                ? "bg-status-warning/15 text-status-warning"
                                : "bg-app-elevated text-text-secondary"
                            }`}
                          >
                            {s.sheetRole === "leads"
                              ? "Lead Sheet"
                              : s.sheetRole === "run_log"
                              ? "Run Log Provenance"
                              : s.sheetRole === "do_not_contact"
                              ? "Exclusion Registry"
                              : "General Sheet"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-text-secondary">
                          <div>Data Rows: <strong className="text-text-primary font-mono">{s.totalDataRows}</strong></div>
                          <div>Columns: <strong className="text-text-primary font-mono">{s.headers.length}</strong></div>
                          <div>Header Row: <strong className="text-text-primary font-mono">Row {s.headerRowNumber}</strong></div>
                        </div>
                        {s.sheetRole === "run_log" && (
                          <p className="mt-2 text-[11px] text-status-info">
                            Automatically captured as batch-level provenance metadata without creating fake lead rows.
                          </p>
                        )}
                        {s.sheetRole === "do_not_contact" && (
                          <p className="mt-2 text-[11px] text-status-warning">
                            Synced to Contact Suppression Registry. Empty suppression list is never treated as outreach permission.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {currentSheetObj && (
                  <div className="mt-5 pt-4 border-t border-app-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-mono uppercase text-text-secondary">
                        Detected Columns in &ldquo;{currentSheetObj.name}&rdquo; ({currentSheetObj.headers.length} Columns)
                      </h3>
                      <div className="flex items-center gap-3">
                        <label htmlFor="dest-col-select" className="text-xs text-text-secondary">
                          Destination Collection:
                        </label>
                        <select
                          id="dest-col-select"
                          value={collectionId}
                          onChange={(e) => setCollectionId(e.target.value)}
                          className="bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
                        >
                          {collections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-56 border border-app-border rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-app-secondary text-text-muted font-mono uppercase sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Column Header</th>
                            <th className="py-2 px-3">Detected Type</th>
                            <th className="py-2 px-3">Populated</th>
                            <th className="py-2 px-3">URL Warnings</th>
                            <th className="py-2 px-3">Sample Values</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border">
                          {currentSheetObj.columnStats.map((cs) => (
                            <tr key={cs.header} className="hover:bg-app-secondary/50">
                              <td className="py-2 px-3 font-medium text-text-primary">{cs.header}</td>
                              <td className="py-2 px-3 font-mono text-text-secondary">{cs.inferredType}</td>
                              <td className="py-2 px-3 font-mono text-text-secondary">
                                {cs.nonEmptyCount} / {currentSheetObj.totalDataRows}
                              </td>
                              <td className="py-2 px-3">
                                {cs.malformedUrlCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-status-warning/15 text-status-warning font-mono text-[11px]">
                                    <AlertTriangle className="w-3 h-3" />
                                    {cs.malformedUrlCount} anomalous value(s)
                                  </span>
                                ) : (
                                  <span className="text-text-muted">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-text-secondary truncate max-w-xs">
                                {cs.sampleValues.slice(0, 3).join(", ") || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-5 pt-4 border-t border-app-border">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-app-secondary text-text-secondary hover:text-text-primary text-xs font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
                  >
                    Next: Map Columns
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: MAP COLUMNS (Matches Mockup 6) */}
          {step === 3 && currentSheetObj && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-app-border">
                  <div>
                    <h2 className="text-base font-heading font-semibold text-text-primary">
                      Map Columns
                    </h2>
                    <p className="text-xs text-text-secondary">
                      Map your spreadsheet columns to CRM fields or create custom fields. Source &ldquo;Status&rdquo; is preserved separately from your sales pipeline stage.
                    </p>
                  </div>
                  {savedMappings.length > 0 && (
                    <select
                      aria-label="Load saved mapping template"
                      onChange={(e) => {
                        const found = savedMappings.find((m) => m.id === e.target.value);
                        if (found) setMapping(found.mapping);
                      }}
                      className="bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
                    >
                      <option value="">Load Saved Template...</option>
                      {savedMappings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="max-h-[420px] overflow-y-auto pr-1 space-y-2">
                  {currentSheetObj.headers.map((header) => {
                    const currentTarget = mapping[header] || "__ignore__";
                    const isFocused = activePreviewCol === header;
                    return (
                      <div
                        key={header}
                        onClick={() => setActivePreviewCol(header)}
                        className={`grid grid-cols-12 items-center gap-3 p-2.5 rounded-lg border transition cursor-pointer ${
                          isFocused
                            ? "border-accent bg-accent/10"
                            : "border-app-border bg-app-secondary/60 hover:border-text-muted"
                        }`}
                      >
                        <div className="col-span-5 text-xs font-medium text-text-primary truncate">
                          {header}
                        </div>
                        <div className="col-span-1 text-center text-text-muted">→</div>
                        <div className="col-span-6">
                          <select
                            aria-label={`Map ${header}`}
                            value={currentTarget}
                            onChange={(e) =>
                              setMapping((prev) => ({ ...prev, [header]: e.target.value }))
                            }
                            className="w-full bg-app-surface border border-app-border rounded-md px-2.5 py-1.5 text-xs text-text-primary"
                          >
                            <optgroup label="Standard CRM Fields">
                              {CRM_STANDARD_FIELDS.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label} ({f.category})
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Custom Fields">
                              {customFields.map((cf) => (
                                <option key={cf.key} value={`custom:${cf.key}`}>
                                  Custom: {cf.name}
                                </option>
                              ))}
                              {currentTarget.startsWith("custom:") &&
                                !customFields.some(
                                  (cf) => `custom:${cf.key}` === currentTarget
                                ) && (
                                  <option value={currentTarget}>
                                    Auto-Create Custom Field ({currentTarget.replace("custom:", "")})
                                  </option>
                                )}
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-app-border">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-app-secondary text-text-secondary hover:text-text-primary text-xs font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Save mapping template as..."
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
                    />
                    {templateName.trim() && (
                      <button
                        type="button"
                        onClick={handleSaveMappingTemplate}
                        className="px-2.5 py-1.5 rounded-lg bg-app-elevated text-xs text-text-primary border border-app-border"
                      >
                        Save Template
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleRunPreview}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
                    >
                      {loading ? "Validating Rows..." : "Next: Review Data"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Column Preview & Custom Field Creator */}
              <div className="bg-app-surface border border-app-border rounded-xl p-5 flex flex-col justify-between space-y-5">
                <div>
                  <div className="text-xs font-mono uppercase text-text-muted">
                    Column Preview
                  </div>
                  <h3 className="text-sm font-heading font-semibold text-text-primary mt-1">
                    {activePreviewCol || "Select a column"}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {activePreviewCol &&
                      currentSheetObj.sampleRows.map((r, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-app-secondary border border-app-border text-xs text-text-primary truncate font-mono"
                        >
                          {String(r[activePreviewCol] || "—")}
                        </div>
                      ))}
                    <div className="text-[11px] text-text-muted pt-1">
                      ... ({Math.max(0, currentSheetObj.totalDataRows - currentSheetObj.sampleRows.length)} more rows)
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-app-border">
                  <h4 className="text-xs font-semibold text-text-primary mb-2">
                    Create &amp; Map New Custom Field
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Storefront Platform"
                      value={newCustomFieldName}
                      onChange={(e) => setNewCustomFieldName(e.target.value)}
                      className="flex-1 bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCustomFieldInline}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: VALIDATE DATA & REVIEW IMPORT (Matches Mockup 5) */}
          {step === 4 && previewData && (
            <div className="space-y-5">
              <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-heading font-semibold text-text-primary">
                      Review Import &amp; Duplicate Analysis
                    </h2>
                    <p className="text-xs text-text-secondary">
                      Verify record counts, market breakdown, verification levels, and flagged URL anomalies before committing.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label htmlFor="dup-policy" className="text-xs text-text-secondary">
                      When Matching Existing Records:
                    </label>
                    <select
                      id="dup-policy"
                      value={duplicatePolicy}
                      onChange={(e) =>
                        setDuplicatePolicy(e.target.value as DuplicateHandlingPolicy)
                      }
                      className="bg-app-secondary border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
                    >
                      <option value="fill_blanks">
                        Fill Blank Fields Only (Conservative Default — Preserves Notes &amp; Scores)
                      </option>
                      <option value="keep_existing">Keep Existing Only (Record Provenance)</option>
                      <option value="use_imported">
                        Update Source Metadata (Still Preserves Notes, Tasks &amp; Manual Scores)
                      </option>
                      <option value="skip_existing">Skip Matched Records Entirely</option>
                    </select>
                  </div>
                </div>

                {/* Summary KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                    <div className="text-xl font-heading font-bold text-text-primary">
                      {previewData.totalRows}
                    </div>
                    <div className="text-[11px] text-text-secondary">Total Rows</div>
                  </div>
                  <div className="p-3 rounded-lg bg-status-success/10 border border-status-success/30">
                    <div className="text-xl font-heading font-bold text-status-success">
                      {previewData.newCount}
                    </div>
                    <div className="text-[11px] text-text-secondary">New Records</div>
                  </div>
                  <div className="p-3 rounded-lg bg-status-info/10 border border-status-info/30">
                    <div className="text-xl font-heading font-bold text-status-info">
                      {previewData.exactMatchCount + previewData.possibleMatchCount}
                    </div>
                    <div className="text-[11px] text-text-secondary">Existing Matches</div>
                  </div>
                  <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/30">
                    <div className="text-xl font-heading font-bold text-status-warning">
                      {previewData.warningsCount}
                    </div>
                    <div className="text-[11px] text-text-secondary">Validation Warnings</div>
                  </div>
                  <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                    <div className="text-sm font-mono font-semibold text-text-primary">
                      {previewData.indiaMarketCount} IN / {previewData.internationalMarketCount} INTL
                    </div>
                    <div className="text-[11px] text-text-secondary mt-1">Market Split</div>
                  </div>
                  <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                    <div className="text-sm font-mono font-semibold text-text-primary">
                      {previewData.siteDescriptionCount} Site / {previewData.directoryOnlyCount} Dir
                    </div>
                    <div className="text-[11px] text-text-secondary mt-1">Verification Level</div>
                  </div>
                </div>

                {/* Filter tabs for preview rows */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: "all", label: `All Rows (${previewData.totalRows})` },
                      { id: "new", label: `New (${previewData.newCount})` },
                      {
                        id: "exact_match",
                        label: `Matches (${previewData.exactMatchCount + previewData.possibleMatchCount})`,
                      },
                      { id: "warnings", label: `Flagged Warnings (${previewData.warningsCount})` },
                      {
                        id: "directory_only",
                        label: `Directory-Only (${previewData.directoryOnlyCount})`,
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() =>
                          setPreviewFilter(
                            tab.id as "all" | "new" | "exact_match" | "warnings" | "directory_only"
                          )
                        }
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                          previewFilter === tab.id
                            ? "bg-accent text-white"
                            : "bg-app-secondary text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Filter preview rows..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className="bg-app-secondary border border-app-border rounded-lg pl-8 pr-3 py-1 text-xs text-text-primary"
                    />
                  </div>
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto max-h-80 border border-app-border rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-app-secondary text-text-muted font-mono uppercase sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Match Status</th>
                        <th className="py-2 px-3">Lead ID</th>
                        <th className="py-2 px-3">Business</th>
                        <th className="py-2 px-3">Website</th>
                        <th className="py-2 px-3">Country</th>
                        <th className="py-2 px-3">Source Status</th>
                        <th className="py-2 px-3">Verification Level</th>
                        <th className="py-2 px-3">Validation / Evidence Warnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border">
                      {filteredPreviewRows.slice(0, 100).map((r) => (
                        <tr key={r.rowNumber} className="hover:bg-app-secondary/50">
                          <td className="py-2 px-3 font-mono text-text-muted">#{r.rowNumber}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] uppercase ${
                                r.status === "new"
                                  ? "bg-status-success/15 text-status-success"
                                  : r.status === "exact_match"
                                  ? "bg-status-info/15 text-status-info"
                                  : r.status === "conflict"
                                  ? "bg-status-warning/15 text-status-warning"
                                  : "bg-status-error/15 text-status-error"
                              }`}
                            >
                              {r.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-text-secondary">
                            {r.mappedData.externalId || "—"}
                          </td>
                          <td className="py-2 px-3 font-medium text-text-primary">
                            {r.mappedData.name}
                          </td>
                          <td className="py-2 px-3 font-mono text-text-secondary">
                            {r.mappedData.normalizedDomain || "— (Missing)"}
                          </td>
                          <td className="py-2 px-3 text-text-secondary">
                            {r.mappedData.country || "—"}
                          </td>
                          <td className="py-2 px-3 font-mono text-text-secondary">
                            {r.mappedData.sourceLeadStatus}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                                r.mappedData.verificationLevel
                                  .toLowerCase()
                                  .includes("directory")
                                  ? "bg-status-warning/15 text-status-warning"
                                  : "bg-status-success/15 text-status-success"
                              }`}
                            >
                              {r.mappedData.verificationLevel}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {r.warnings.length > 0 ? (
                              <div className="space-y-1">
                                {r.warnings.map((w, idx) => (
                                  <div
                                    key={idx}
                                    className="text-[11px] text-status-warning flex items-start gap-1"
                                  >
                                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>
                                      <strong>{w.field}</strong> ({w.value}): {w.message}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-status-success font-mono text-[11px]">
                                Verified OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-app-border">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-app-secondary text-text-secondary hover:text-text-primary text-xs font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Column Mapping
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleExecuteImport}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    {loading
                      ? "Importing Records..."
                      : `Confirm & Import ${previewData.totalRows} Records`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: IMPORT COMPLETED REPORT */}
          {step === 5 && completedBatch && (
            <div className="bg-app-surface border border-app-border rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-status-success/15 text-status-success flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-heading font-bold text-text-primary">
                    Import Completed — {completedBatch.filename}
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Batch ID: <span className="font-mono">{completedBatch.id}</span> • Sheet:{" "}
                    <span className="font-mono">{completedBatch.selectedSheet}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-app-secondary border border-app-border">
                  <div className="text-xs text-text-secondary">Rows Processed</div>
                  <div className="text-xl font-heading font-bold text-text-primary mt-1">
                    {completedBatch.totalRows}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-status-success/10 border border-status-success/30">
                  <div className="text-xs text-text-secondary">New Records Created</div>
                  <div className="text-xl font-heading font-bold text-status-success mt-1">
                    {completedBatch.newRecordsCreated}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-status-info/10 border border-status-info/30">
                  <div className="text-xs text-text-secondary">Existing Matched / Updated</div>
                  <div className="text-xl font-heading font-bold text-status-info mt-1">
                    {completedBatch.existingMatched} ({completedBatch.recordsUpdated} updated)
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-status-warning/10 border border-status-warning/30">
                  <div className="text-xs text-text-secondary">Rows Flagged for Review</div>
                  <div className="text-xl font-heading font-bold text-status-warning mt-1">
                    {completedBatch.rowsRequiringReview} ({completedBatch.validationWarningsCount} warnings)
                  </div>
                </div>
              </div>

              {completedBatch.warningsSummary && completedBatch.warningsSummary.length > 0 && (
                <div className="border border-app-border rounded-lg p-4 bg-app-secondary/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase text-status-warning flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Row-Level Validation Warnings ({completedBatch.warningsSummary.length})
                    </h3>
                    <a
                      href={`/api/export?format=import_warnings&batchId=${completedBatch.id}`}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Warning Report (.CSV)
                    </a>
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-1.5 text-xs">
                    {completedBatch.warningsSummary.map((w, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-app-surface border border-app-border flex items-center justify-between gap-2"
                      >
                        <span>
                          <strong className="font-mono text-text-primary">Row #{w.rowNumber}</strong>{" "}
                          ({w.externalId || w.business}): <span className="text-status-warning">{w.field}</span> ={" "}
                          <code className="font-mono px-1 py-0.5 bg-app-secondary rounded">{w.value || "empty"}</code>
                        </span>
                        <span className="text-text-secondary text-[11px]">{w.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setCompletedBatch(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-app-secondary text-text-primary text-xs font-medium"
                >
                  Import Another Spreadsheet
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("history")}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold"
                >
                  View Full Import History &amp; Provenance
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: IMPORT HISTORY */}
      {subTab === "history" && (
        <div className="space-y-4">
          {importBatches.length === 0 ? (
            <div className="bg-app-surface border border-app-border rounded-xl p-8 text-center">
              <p className="text-sm text-text-secondary">No spreadsheet imports recorded yet.</p>
            </div>
          ) : (
            importBatches.map((b) => (
              <div
                key={b.id}
                className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-semibold text-sm text-text-primary">
                        {b.filename}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                          b.status === "completed"
                            ? "bg-status-success/15 text-status-success"
                            : "bg-status-warning/15 text-status-warning"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted font-mono mt-0.5">
                      Batch {b.id} • Sheet: {b.selectedSheet} • Imported{" "}
                      {new Date(b.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {b.warningsSummary && b.warningsSummary.length > 0 && (
                      <a
                        href={`/api/export?format=import_warnings&batchId=${b.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-secondary hover:bg-app-elevated text-text-secondary hover:text-text-primary text-xs font-medium border border-app-border"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Warnings CSV ({b.validationWarningsCount})
                      </a>
                    )}
                    {b.status === "completed" && (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleRollback(b.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-status-error/15 hover:bg-status-error/25 text-status-error text-xs font-medium"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Safe Rollback Batch
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-app-secondary">
                    <span className="text-text-muted block">Processed</span>
                    <strong className="font-mono text-sm text-text-primary">{b.totalRows}</strong>
                  </div>
                  <div className="p-2.5 rounded bg-app-secondary">
                    <span className="text-text-muted block">New Created</span>
                    <strong className="font-mono text-sm text-status-success">
                      {b.newRecordsCreated}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded bg-app-secondary">
                    <span className="text-text-muted block">Matched</span>
                    <strong className="font-mono text-sm text-status-info">
                      {b.existingMatched}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded bg-app-secondary">
                    <span className="text-text-muted block">Updated</span>
                    <strong className="font-mono text-sm text-text-primary">
                      {b.recordsUpdated}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded bg-app-secondary">
                    <span className="text-text-muted block">Need Review</span>
                    <strong className="font-mono text-sm text-status-warning">
                      {b.rowsRequiringReview}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded bg-app-secondary">
                    <span className="text-text-muted block">Warnings</span>
                    <strong className="font-mono text-sm text-status-warning">
                      {b.validationWarningsCount}
                    </strong>
                  </div>
                </div>

                {b.runLogProvenance && b.runLogProvenance.length > 0 && (
                  <div className="p-3 rounded-lg bg-app-secondary/70 border border-app-border text-xs">
                    <div className="font-mono text-[11px] uppercase text-status-info mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Captured Workbook Run Log Provenance (Not Imported as Lead Rows)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-text-secondary font-mono">
                      {Object.entries(b.runLogProvenance[0]).map(([k, v]) => (
                        <div key={k} className="truncate">
                          <span className="text-text-muted">{k}:</span>{" "}
                          <strong className="text-text-primary">{String(v)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* SUBTAB: EXPORT CENTER */}
      {subTab === "export" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-app-surface border border-app-border rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-heading font-semibold text-text-primary">
                Export All Leads (Formula-Safe CSV)
              </h3>
              <p className="text-xs text-text-secondary mt-1.5">
                Exports all active organizations from Local Browser Storage with categories, tags, scores, verification status, and governance fields. Protected against CSV formula injection.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerLocalBrowserFileDownload("csv")}
              className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
            >
              <Download className="w-4 h-4" />
              Download Leads (.CSV)
            </button>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-heading font-semibold text-text-primary">
                Export Structured Leads (.JSON)
              </h3>
              <p className="text-xs text-text-secondary mt-1.5">
                Structured JSON export of all leads, custom field values, score breakdowns, and collection memberships from Local Browser Storage.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerLocalBrowserFileDownload("json")}
              className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-app-elevated hover:bg-accent hover:text-white text-text-primary border border-app-border text-xs font-semibold transition"
            >
              <Download className="w-4 h-4" />
              Download Structured (.JSON)
            </button>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-heading font-semibold text-text-primary">
                Full Local Browser Storage Backup
              </h3>
              <p className="text-xs text-text-secondary mt-1.5">
                Complete portable snapshot of collections, custom field definitions, leads, opportunities, contacts, notes, tasks, references, and import history stored in your browser.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerLocalBrowserFileDownload("workspace_backup_json")}
              className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-app-elevated hover:bg-accent hover:text-white text-text-primary border border-app-border text-xs font-semibold transition"
            >
              <ShieldAlert className="w-4 h-4" />
              Export Full Browser Backup (.JSON)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
