import ExcelJS from "exceljs";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, DEFAULT_WORKSPACE_ID, DEFAULT_PIPELINE_ID } from "@/db";
import {
  organizations,
  collectionMemberships,
  importBatches,
  sourceRecords,
  contactSuppressions,
  activities,
  fieldDefinitions,
  notes,
  tasks,
  opportunities,
} from "@/db/schema";
import {
  normalizeOrganizationName,
  normalizeDomain,
  validateUrlField,
} from "./domain-utils";

export interface SheetInspection {
  name: string;
  sheetRole: "leads" | "run_log" | "do_not_contact" | "general";
  headerRowNumber: number;
  totalDataRows: number;
  emptyRowsCount: number;
  headers: string[];
  duplicateHeaders: string[];
  suggestedMapping: Record<string, string>;
  sampleRows: Record<string, unknown>[];
  columnStats: Array<{
    header: string;
    inferredType: "text" | "url" | "date" | "number" | "country" | "status";
    nonEmptyCount: number;
    missingCount: number;
    malformedUrlCount: number;
    sampleValues: string[];
  }>;
}

export interface WorkbookInspectionResult {
  filename: string;
  fileFormat: "xlsx" | "csv";
  fileSizeBytes: number;
  sheets: SheetInspection[];
  recommendedLeadSheet: string;
  runLogSheet?: string;
  doNotContactSheet?: string;
}

export type DuplicateMatchStatus =
  | "new"
  | "exact_match"
  | "possible_match"
  | "conflict"
  | "invalid";

export interface PreviewRowResult {
  rowNumber: number;
  status: DuplicateMatchStatus;
  matchReason?: string;
  matchedOrganizationId?: string;
  matchedOrganizationName?: string;
  conflicts: Array<{
    field: string;
    existingValue: string;
    importedValue: string;
  }>;
  warnings: Array<{
    field: string;
    value: string;
    message: string;
  }>;
  isSuppressed: boolean;
  mappedData: {
    externalId: string | null;
    discoveryDate: string | null;
    market: string | null;
    country: string | null;
    city: string | null;
    name: string;
    industry: string | null;
    websiteUrl: string | null;
    normalizedDomain: string | null;
    observedFacts: string | null;
    sourceUrl: string | null;
    publishedContact: string | null;
    contactEvidenceUrl: string | null;
    contactEvidenceValid: boolean;
    contactEvidenceWarning: string | null;
    sourceLeadStatus: string | null;
    qualificationDecision: string;
    outreachApproval: string;
    optOutStatus: string;
    priorContactCheck: string;
    verificationLevel: string;
    sourceNotes: string | null;
    customValues: Record<string, unknown>;
  };
  rawValues: Record<string, unknown>;
}

export interface ImportPreviewSummary {
  filename: string;
  sheetName: string;
  totalRows: number;
  newCount: number;
  exactMatchCount: number;
  possibleMatchCount: number;
  conflictCount: number;
  invalidCount: number;
  warningsCount: number;
  directoryOnlyCount: number;
  siteDescriptionCount: number;
  indiaMarketCount: number;
  internationalMarketCount: number;
  runLogRows: Record<string, unknown>[];
  suppressionRows: Record<string, unknown>[];
  rows: PreviewRowResult[];
}

export const CRM_STANDARD_FIELDS: Array<{ key: string; label: string; category: string }> = [
  { key: "name", label: "Company Name", category: "Core" },
  { key: "externalId", label: "Source External ID", category: "Provenance" },
  { key: "discoveryDate", label: "Discovery Date", category: "Provenance" },
  { key: "market", label: "Market", category: "Location" },
  { key: "country", label: "Country", category: "Location" },
  { key: "city", label: "City", category: "Location" },
  { key: "industry", label: "Niche / Industry", category: "Core" },
  { key: "websiteUrl", label: "Website", category: "Core" },
  { key: "observedFacts", label: "Observed Business Facts", category: "Research" },
  { key: "sourceUrl", label: "Discovery Source URL", category: "Provenance" },
  { key: "publishedContact", label: "Published Contact Information", category: "Contact" },
  { key: "contactEvidenceUrl", label: "Contact Evidence URL", category: "Contact" },
  { key: "sourceLeadStatus", label: "Source Lead Status", category: "Governance" },
  { key: "qualificationDecision", label: "Qualification Decision", category: "Governance" },
  { key: "outreachApproval", label: "Outreach Approval", category: "Governance" },
  { key: "optOutStatus", label: "Opt-Out Status", category: "Governance" },
  { key: "priorContactCheck", label: "Prior Contact Check", category: "Governance" },
  { key: "verificationLevel", label: "Verification Level", category: "Governance" },
  { key: "sourceNotes", label: "Source Notes", category: "Research" },
  { key: "__ignore__", label: "Ignore Column", category: "System" },
];

const HEADER_TO_FIELD_SYNONYMS: Record<string, string> = {
  "lead id": "externalId",
  "lead_id": "externalId",
  "id": "externalId",
  "external id": "externalId",
  "discovery date": "discoveryDate",
  "date discovered": "discoveryDate",
  "market": "market",
  "region": "market",
  "country": "country",
  "city": "city",
  "business": "name",
  "company": "name",
  "company name": "name",
  "business name": "name",
  "organization": "name",
  "niche": "industry",
  "industry": "industry",
  "vertical": "industry",
  "official website": "websiteUrl",
  "website": "websiteUrl",
  "website url": "websiteUrl",
  "domain": "websiteUrl",
  "observed fact (from site)": "observedFacts",
  "observed fact": "observedFacts",
  "observed facts": "observedFacts",
  "source url": "sourceUrl",
  "discovery source url": "sourceUrl",
  "published business contact": "publishedContact",
  "published contact": "publishedContact",
  "contact": "publishedContact",
  "contact evidence url": "contactEvidenceUrl",
  "evidence url": "contactEvidenceUrl",
  "status": "sourceLeadStatus",
  "lead status": "sourceLeadStatus",
  "qualification decision": "qualificationDecision",
  "qualification": "qualificationDecision",
  "outreach approval": "outreachApproval",
  "opt-out": "optOutStatus",
  "opt out": "optOutStatus",
  "prior contact check": "priorContactCheck",
  "verification level": "verificationLevel",
  "verification": "verificationLevel",
  "notes": "sourceNotes",
  "source notes": "sourceNotes",
};

export function suggestColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const clean = h.trim().toLowerCase();
    if (HEADER_TO_FIELD_SYNONYMS[clean]) {
      mapping[h] = HEADER_TO_FIELD_SYNONYMS[clean];
    } else {
      mapping[h] = `custom:${clean.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    }
  }
  return mapping;
}

function extractCellValue(cellValue: ExcelJS.CellValue): string {
  if (cellValue === null || cellValue === undefined) return "";
  if (typeof cellValue === "string" || typeof cellValue === "number" || typeof cellValue === "boolean") {
    return String(cellValue).trim();
  }
  if (cellValue instanceof Date) {
    return cellValue.toISOString().split("T")[0];
  }
  if (typeof cellValue === "object") {
    if ("hyperlink" in cellValue && "text" in cellValue) {
      return String(cellValue.text || cellValue.hyperlink || "").trim();
    }
    if ("richText" in cellValue && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((rt) => rt.text).join("").trim();
    }
    // Safe formula result extraction without executing formulas
    if ("result" in cellValue && cellValue.result !== undefined) {
      return String(cellValue.result).trim();
    }
  }
  return String(cellValue).trim();
}

export function parseCsvToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (ch === "\r" && next === "\n") {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
        i++;
      } else if (ch === "\n") {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += ch;
      }
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }
  return rows;
}

function classifySheetRole(name: string, headers: string[]): SheetInspection["sheetRole"] {
  const lowerName = name.trim().toLowerCase();
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  if (
    lowerName.includes("run log") ||
    lowerName.includes("run_log") ||
    lowerHeaders.includes("india candidates") ||
    lowerHeaders.includes("total candidates")
  ) {
    return "run_log";
  }
  if (
    lowerName.includes("do not contact") ||
    lowerName.includes("suppression") ||
    lowerName.includes("exclusion") ||
    lowerHeaders.includes("do not contact status")
  ) {
    return "do_not_contact";
  }
  if (
    lowerName.includes("lead") ||
    lowerHeaders.includes("business") ||
    lowerHeaders.includes("official website") ||
    lowerHeaders.includes("company name")
  ) {
    return "leads";
  }
  return "general";
}

function inferColumnType(
  header: string,
  values: string[]
): "text" | "url" | "date" | "number" | "country" | "status" {
  const h = header.toLowerCase();
  if (h.includes("url") || h.includes("website") || h.includes("link")) return "url";
  if (h.includes("date")) return "date";
  if (h.includes("country")) return "country";
  if (h.includes("status") || h.includes("decision") || h.includes("approval")) return "status";
  const nonEmpty = values.filter(Boolean);
  if (nonEmpty.length > 0 && nonEmpty.every((v) => /^-?\d+(\.\d+)?$/.test(v))) {
    return "number";
  }
  return "text";
}

export async function parseWorkbookSheets(
  buffer: Buffer,
  filename: string,
  customHeaderRow?: number
): Promise<{
  inspection: WorkbookInspectionResult;
  rawSheetsData: Record<string, Array<{ rowNumber: number; values: Record<string, string> }>>;
}> {
  const ext = filename.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
  const rawSheetsData: Record<string, Array<{ rowNumber: number; values: Record<string, string> }>> = {};
  const sheets: SheetInspection[] = [];

  if (ext === "csv") {
    const text = buffer.toString("utf8");
    const grid = parseCsvToRows(text);
    const headerIdx = (customHeaderRow ? customHeaderRow - 1 : 0);
    const rawHeaders = grid[headerIdx] || [];
    const headers: string[] = [];
    const seen = new Set<string>();
    const duplicates: string[] = [];

    rawHeaders.forEach((h, idx) => {
      const clean = h || `Column_${idx + 1}`;
      if (seen.has(clean)) duplicates.push(clean);
      seen.add(clean);
      headers.push(clean);
    });

    const dataRows: Array<{ rowNumber: number; values: Record<string, string> }> = [];
    let emptyRowsCount = 0;

    for (let r = headerIdx + 1; r < grid.length; r++) {
      const rowArr = grid[r];
      if (!rowArr || rowArr.every((cell) => !cell || !cell.trim())) {
        emptyRowsCount++;
        continue;
      }
      const obj: Record<string, string> = {};
      headers.forEach((colName, cIdx) => {
        obj[colName] = rowArr[cIdx] ?? "";
      });
      dataRows.push({ rowNumber: r + 1, values: obj });
    }

    rawSheetsData["CSV Data"] = dataRows;
    sheets.push(buildSheetInspection("CSV Data", headers, duplicates, dataRows, emptyRowsCount, headerIdx + 1));
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    for (const worksheet of workbook.worksheets) {
      // Detect first non-empty row as header unless customHeaderRow specified
      let headerRowNum = customHeaderRow || 1;
      if (!customHeaderRow) {
        for (let r = 1; r <= Math.min(10, worksheet.rowCount || 1); r++) {
          const row = worksheet.getRow(r);
          let nonEmptyCells = 0;
          row.eachCell({ includeEmpty: false }, (cell) => {
            if (extractCellValue(cell.value)) nonEmptyCells++;
          });
          if (nonEmptyCells >= 2) {
            headerRowNum = r;
            break;
          }
        }
      }

      const headerRow = worksheet.getRow(headerRowNum);
      const headers: string[] = [];
      const colIndexMap: Array<{ colNumber: number; header: string }> = [];
      const seen = new Set<string>();
      const duplicates: string[] = [];

      const maxCol = Math.max(headerRow.cellCount, worksheet.columnCount || 0);
      for (let c = 1; c <= maxCol; c++) {
        const val = extractCellValue(headerRow.getCell(c).value);
        if (!val) continue;
        if (seen.has(val)) duplicates.push(val);
        seen.add(val);
        headers.push(val);
        colIndexMap.push({ colNumber: c, header: val });
      }

      const dataRows: Array<{ rowNumber: number; values: Record<string, string> }> = [];
      let emptyRowsCount = 0;

      for (let r = headerRowNum + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const obj: Record<string, string> = {};
        let hasValue = false;

        for (const { colNumber, header } of colIndexMap) {
          const v = extractCellValue(row.getCell(colNumber).value);
          if (v !== "") hasValue = true;
          obj[header] = v;
        }

        if (!hasValue) {
          emptyRowsCount++;
          continue;
        }
        dataRows.push({ rowNumber: r, values: obj });
      }

      rawSheetsData[worksheet.name] = dataRows;
      sheets.push(
        buildSheetInspection(
          worksheet.name,
          headers,
          duplicates,
          dataRows,
          emptyRowsCount,
          headerRowNum
        )
      );
    }
  }

  const leadSheet =
    sheets.find((s) => s.sheetRole === "leads")?.name ||
    sheets[0]?.name ||
    "Leads";
  const runLogSheet = sheets.find((s) => s.sheetRole === "run_log")?.name;
  const doNotContactSheet = sheets.find((s) => s.sheetRole === "do_not_contact")?.name;

  return {
    inspection: {
      filename,
      fileFormat: ext,
      fileSizeBytes: buffer.byteLength,
      sheets,
      recommendedLeadSheet: leadSheet,
      runLogSheet,
      doNotContactSheet,
    },
    rawSheetsData,
  };
}

function buildSheetInspection(
  name: string,
  headers: string[],
  duplicateHeaders: string[],
  dataRows: Array<{ rowNumber: number; values: Record<string, string> }>,
  emptyRowsCount: number,
  headerRowNumber: number
): SheetInspection {
  const sheetRole = classifySheetRole(name, headers);
  const suggestedMapping = suggestColumnMapping(headers);

  const columnStats = headers.map((header) => {
    const colValues = dataRows.map((r) => r.values[header] || "");
    const nonEmpty = colValues.filter((v) => v !== "");
    const inferredType = inferColumnType(header, colValues);
    let malformedUrlCount = 0;
    if (inferredType === "url") {
      for (const v of nonEmpty) {
        const res = validateUrlField(v, header);
        if (!res.isValid) malformedUrlCount++;
      }
    }
    return {
      header,
      inferredType,
      nonEmptyCount: nonEmpty.length,
      missingCount: dataRows.length - nonEmpty.length,
      malformedUrlCount,
      sampleValues: nonEmpty.slice(0, 5),
    };
  });

  return {
    name,
    sheetRole,
    headerRowNumber,
    totalDataRows: dataRows.length,
    emptyRowsCount,
    headers,
    duplicateHeaders,
    suggestedMapping,
    sampleRows: dataRows.slice(0, 6).map((r) => r.values),
    columnStats,
  };
}

export async function previewSpreadsheetImport(params: {
  buffer: Buffer;
  filename: string;
  selectedSheet: string;
  mapping: Record<string, string>;
  headerRowNumber?: number;
  workspaceId?: string;
}): Promise<ImportPreviewSummary> {
  const workspaceId = params.workspaceId || DEFAULT_WORKSPACE_ID;
  const db = await getDb();

  const { inspection, rawSheetsData } = await parseWorkbookSheets(
    params.buffer,
    params.filename,
    params.headerRowNumber
  );

  const sheetRows = rawSheetsData[params.selectedSheet] || [];
  const runLogRows = inspection.runLogSheet
    ? (rawSheetsData[inspection.runLogSheet] || []).map((r) => r.values)
    : [];
  const suppressionRows = inspection.doNotContactSheet
    ? (rawSheetsData[inspection.doNotContactSheet] || []).map((r) => r.values)
    : [];

  // Load existing organizations and suppressions for duplicate & suppression checks
  const existingOrgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.workspaceId, workspaceId));

  const existingSuppressions = await db
    .select()
    .from(contactSuppressions)
    .where(eq(contactSuppressions.workspaceId, workspaceId));

  const suppressedDomains = new Set<string>();
  const suppressedNames = new Set<string>();
  for (const sup of existingSuppressions) {
    if (sup.normalizedDomain) suppressedDomains.add(sup.normalizedDomain);
    if (sup.businessOrDomain) {
      suppressedNames.add(normalizeOrganizationName(sup.businessOrDomain));
    }
  }
  for (const supRow of suppressionRows) {
    const val = String(supRow["Business / Domain"] || supRow["Business"] || supRow["Domain"] || "").trim();
    if (val) {
      const d = normalizeDomain(val);
      if (d) suppressedDomains.add(d);
      suppressedNames.add(normalizeOrganizationName(val));
    }
  }

  const byExternalId = new Map<string, typeof existingOrgs[number]>();
  const byDomain = new Map<string, typeof existingOrgs[number]>();
  const byNameAndCountry = new Map<string, typeof existingOrgs[number]>();

  for (const org of existingOrgs) {
    if (org.externalId) {
      byExternalId.set(org.externalId.toLowerCase(), org);
    }
    if (org.normalizedDomain) {
      byDomain.set(org.normalizedDomain, org);
    }
    const nameKey = `${org.normalizedName}::${(org.country || "").toLowerCase()}`;
    byNameAndCountry.set(nameKey, org);
  }

  // Also track within-sheet duplicates
  const seenDomainsInBatch = new Map<string, number>();
  const seenExternalIdsInBatch = new Map<string, number>();

  const previewRows: PreviewRowResult[] = [];
  let newCount = 0;
  let exactMatchCount = 0;
  let possibleMatchCount = 0;
  let conflictCount = 0;
  let invalidCount = 0;
  let warningsCount = 0;
  let directoryOnlyCount = 0;
  let siteDescriptionCount = 0;
  let indiaMarketCount = 0;
  let internationalMarketCount = 0;

  for (const row of sheetRows) {
    const mapped: Record<string, string> = {};
    const customValues: Record<string, unknown> = {};

    for (const [sourceCol, targetField] of Object.entries(params.mapping)) {
      if (!targetField || targetField === "__ignore__") continue;
      const cellVal = (row.values[sourceCol] ?? "").trim();
      if (targetField.startsWith("custom:")) {
        const customKey = targetField.slice("custom:".length);
        if (cellVal !== "") customValues[customKey] = cellVal;
      } else {
        mapped[targetField] = cellVal;
      }
    }

    const warnings: Array<{ field: string; value: string; message: string }> = [];

    const name = mapped.name || "";
    const externalId = mapped.externalId || null;
    const discoveryDate = mapped.discoveryDate || null;
    const market = mapped.market || null;
    const country = mapped.country || null;
    const city = mapped.city || null;
    const industry = mapped.industry || null;
    const observedFacts = mapped.observedFacts || null;
    const publishedContact = mapped.publishedContact || null;
    const sourceLeadStatus = mapped.sourceLeadStatus || "candidate";
    const qualificationDecision = mapped.qualificationDecision || "not reviewed";
    const outreachApproval = mapped.outreachApproval || "not approved";
    const optOutStatus = mapped.optOutStatus || "unknown";
    const priorContactCheck = mapped.priorContactCheck || "not checked";
    const verificationLevel = mapped.verificationLevel || "unverified";
    const sourceNotes = mapped.sourceNotes || null;

    if (market?.toLowerCase() === "india" || country?.toLowerCase() === "india") {
      indiaMarketCount++;
    } else if (market || country) {
      internationalMarketCount++;
    }

    if (verificationLevel.toLowerCase().includes("directory")) {
      directoryOnlyCount++;
      warnings.push({
        field: "Verification Level",
        value: verificationLevel,
        message: "Directory-only listing: requires independent website and business identity verification.",
      });
    } else if (verificationLevel.toLowerCase().includes("site description")) {
      siteDescriptionCount++;
    }

    // Validate Website URL
    const websiteCheck = validateUrlField(mapped.websiteUrl, "Official Website");
    const normDomain = websiteCheck.isValid ? normalizeDomain(mapped.websiteUrl) : null;
    if (!websiteCheck.isValid && websiteCheck.warning) {
      warnings.push({
        field: "Official Website",
        value: mapped.websiteUrl || "",
        message: websiteCheck.warning,
      });
    }

    // Validate Source URL
    const sourceUrlCheck = validateUrlField(mapped.sourceUrl, "Source URL");
    if (!sourceUrlCheck.isValid && sourceUrlCheck.warning) {
      warnings.push({
        field: "Source URL",
        value: mapped.sourceUrl || "",
        message: sourceUrlCheck.warning,
      });
    }

    // Validate Contact Evidence URL (Section 13.5: flag "49", "sent", etc.)
    const evidenceCheck = validateUrlField(mapped.contactEvidenceUrl, "Contact Evidence URL");
    if (!evidenceCheck.isValid && evidenceCheck.warning) {
      warnings.push({
        field: "Contact Evidence URL",
        value: mapped.contactEvidenceUrl || "",
        message: evidenceCheck.warning,
      });
    }

    const normName = normalizeOrganizationName(name);
    const isSuppressed =
      (normDomain ? suppressedDomains.has(normDomain) : false) ||
      (normName ? suppressedNames.has(normName) : false);

    if (isSuppressed) {
      warnings.push({
        field: "Suppression Status",
        value: name,
        message: "Matches an entry in the Do Not Contact suppression registry.",
      });
    }

    // Check within-file duplicates
    if (externalId) {
      const prevRow = seenExternalIdsInBatch.get(externalId.toLowerCase());
      if (prevRow !== undefined) {
        warnings.push({
          field: "Lead ID",
          value: externalId,
          message: `Duplicate Lead ID "${externalId}" within same sheet (first seen at row ${prevRow}).`,
        });
      } else {
        seenExternalIdsInBatch.set(externalId.toLowerCase(), row.rowNumber);
      }
    }

    if (normDomain) {
      const prevRow = seenDomainsInBatch.get(normDomain);
      if (prevRow !== undefined) {
        warnings.push({
          field: "Official Website",
          value: normDomain,
          message: `Duplicate normalized domain "${normDomain}" within same sheet (first seen at row ${prevRow}).`,
        });
      } else {
        seenDomainsInBatch.set(normDomain, row.rowNumber);
      }
    }

    // Determine duplicate status against existing database records
    let status: DuplicateMatchStatus = "new";
    let matchReason: string | undefined;
    let matchedOrg: typeof existingOrgs[number] | undefined;
    const conflicts: Array<{ field: string; existingValue: string; importedValue: string }> = [];

    if (!name) {
      status = "invalid";
      warnings.push({
        field: "Company Name",
        value: "",
        message: "Missing Business / Company Name. Row cannot be imported as a valid organization.",
      });
    } else {
      if (externalId && byExternalId.has(externalId.toLowerCase())) {
        matchedOrg = byExternalId.get(externalId.toLowerCase());
        status = "exact_match";
        matchReason = `Matched existing Lead ID (${externalId})`;
      } else if (normDomain && byDomain.has(normDomain)) {
        matchedOrg = byDomain.get(normDomain);
        status = "exact_match";
        matchReason = `Matched normalized domain (${normDomain})`;
      } else {
        const nameKey = `${normName}::${(country || "").toLowerCase()}`;
        if (normName && byNameAndCountry.has(nameKey)) {
          matchedOrg = byNameAndCountry.get(nameKey);
          status = "possible_match";
          matchReason = `Matched normalized business name & country (${name})`;
        }
      }

      if (matchedOrg) {
        if (
          matchedOrg.websiteUrl &&
          mapped.websiteUrl &&
          normalizeDomain(matchedOrg.websiteUrl) !== normDomain &&
          normDomain !== null
        ) {
          conflicts.push({
            field: "Website",
            existingValue: matchedOrg.websiteUrl,
            importedValue: mapped.websiteUrl,
          });
        }
        if (
          matchedOrg.country &&
          country &&
          matchedOrg.country.toLowerCase() !== country.toLowerCase()
        ) {
          conflicts.push({
            field: "Country",
            existingValue: matchedOrg.country,
            importedValue: country,
          });
        }
        if (conflicts.length > 0) {
          status = "conflict";
        }
      }
    }

    if (status === "new") newCount++;
    else if (status === "exact_match") exactMatchCount++;
    else if (status === "possible_match") possibleMatchCount++;
    else if (status === "conflict") conflictCount++;
    else if (status === "invalid") invalidCount++;

    warningsCount += warnings.length;

    previewRows.push({
      rowNumber: row.rowNumber,
      status,
      matchReason,
      matchedOrganizationId: matchedOrg?.id,
      matchedOrganizationName: matchedOrg?.name,
      conflicts,
      warnings,
      isSuppressed,
      mappedData: {
        externalId,
        discoveryDate,
        market,
        country,
        city,
        name,
        industry,
        websiteUrl: websiteCheck.isValid ? (websiteCheck.normalizedUrl || mapped.websiteUrl || null) : (mapped.websiteUrl || null),
        normalizedDomain: normDomain,
        observedFacts,
        sourceUrl: sourceUrlCheck.isValid ? (sourceUrlCheck.normalizedUrl || mapped.sourceUrl || null) : (mapped.sourceUrl || null),
        publishedContact,
        contactEvidenceUrl: mapped.contactEvidenceUrl || null,
        contactEvidenceValid: evidenceCheck.isValid,
        contactEvidenceWarning: evidenceCheck.warning,
        sourceLeadStatus,
        qualificationDecision,
        outreachApproval,
        optOutStatus: isSuppressed ? "opted out / suppressed" : optOutStatus,
        priorContactCheck,
        verificationLevel,
        sourceNotes,
        customValues,
      },
      rawValues: row.values,
    });
  }

  return {
    filename: params.filename,
    sheetName: params.selectedSheet,
    totalRows: sheetRows.length,
    newCount,
    exactMatchCount,
    possibleMatchCount,
    conflictCount,
    invalidCount,
    warningsCount,
    directoryOnlyCount,
    siteDescriptionCount,
    indiaMarketCount,
    internationalMarketCount,
    runLogRows,
    suppressionRows,
    rows: previewRows,
  };
}

export type DuplicateHandlingPolicy =
  | "fill_blanks"
  | "keep_existing"
  | "use_imported"
  | "skip_existing";

export async function executeSpreadsheetImport(params: {
  buffer: Buffer;
  filename: string;
  selectedSheet: string;
  collectionId: string;
  mapping: Record<string, string>;
  duplicatePolicy?: DuplicateHandlingPolicy;
  headerRowNumber?: number;
  workspaceId?: string;
}) {
  const workspaceId = params.workspaceId || DEFAULT_WORKSPACE_ID;
  const duplicatePolicy = params.duplicatePolicy || "fill_blanks";
  const db = await getDb();

  const preview = await previewSpreadsheetImport({
    buffer: params.buffer,
    filename: params.filename,
    selectedSheet: params.selectedSheet,
    mapping: params.mapping,
    headerRowNumber: params.headerRowNumber,
    workspaceId,
  });

  // Ensure any custom fields mapped (`custom:xyz`) exist in field_definitions
  const existingFields = await db
    .select()
    .from(fieldDefinitions)
    .where(eq(fieldDefinitions.workspaceId, workspaceId));
  const existingFieldKeys = new Set(existingFields.map((f) => f.key));

  for (const [sourceHeader, target] of Object.entries(params.mapping)) {
    if (target.startsWith("custom:")) {
      const key = target.slice("custom:".length);
      if (!existingFieldKeys.has(key)) {
        await db.insert(fieldDefinitions).values({
          id: `fld_${crypto.randomUUID().slice(0, 8)}`,
          workspaceId,
          collectionId: params.collectionId,
          name: sourceHeader,
          key,
          fieldType: "text",
          description: `Created during import of ${params.filename}`,
          isRequired: false,
          isVisible: true,
        });
        existingFieldKeys.add(key);
      }
    }
  }

  const batchId = `imp_${crypto.randomUUID().slice(0, 10)}`;
  let newRecordsCreated = 0;
  let existingMatched = 0;
  let recordsUpdated = 0;
  let duplicatesSkipped = 0;
  let rowsRequiringReview = 0;
  let failedRowsCount = 0;
  const createdOrganizationIds: string[] = [];
  const warningsSummary: Array<{
    rowNumber: number;
    externalId?: string;
    business?: string;
    field: string;
    value: string;
    message: string;
  }> = [];

  // Process Do Not Contact sheet rows into suppression registry if present
  let suppressionRowsInserted = 0;
  for (const supRow of preview.suppressionRows) {
    const bizOrDomain = String(
      supRow["Business / Domain"] || supRow["Business"] || supRow["Domain"] || ""
    ).trim();
    if (!bizOrDomain) continue;
    await db.insert(contactSuppressions).values({
      id: `dnc_${crypto.randomUUID().slice(0, 10)}`,
      workspaceId,
      businessOrDomain: bizOrDomain,
      normalizedDomain: normalizeDomain(bizOrDomain),
      contactOrChannel: String(supRow["Contact / Channel"] || "").trim() || null,
      optOutDate: String(supRow["Opt-Out Date"] || "").trim() || null,
      reasonOrSource: String(supRow["Reason / Source"] || "").trim() || null,
      status: String(supRow["Do Not Contact Status"] || "Do Not Contact").trim(),
      notes: String(supRow["Notes"] || "").trim() || null,
    });
    suppressionRowsInserted++;
  }

  // Create the import batch record first so source_records can reference it
  await db.insert(importBatches).values({
    id: batchId,
    workspaceId,
    filename: params.filename,
    fileFormat: params.filename.toLowerCase().endsWith(".csv") ? "csv" : "xlsx",
    fileSizeBytes: params.buffer.byteLength,
    selectedSheet: params.selectedSheet,
    collectionId: params.collectionId,
    status: "completed",
    totalRows: preview.totalRows,
    mappingConfig: params.mapping,
    runLogProvenance: preview.runLogRows,
    suppressionRowsCount: suppressionRowsInserted,
  });

  for (const row of preview.rows) {
    for (const w of row.warnings) {
      warningsSummary.push({
        rowNumber: row.rowNumber,
        externalId: row.mappedData.externalId || undefined,
        business: row.mappedData.name || undefined,
        field: w.field,
        value: w.value,
        message: w.message,
      });
    }

    if (row.status === "invalid") {
      failedRowsCount++;
      continue;
    }

    if (
      row.mappedData.verificationLevel.toLowerCase().includes("directory") ||
      !row.mappedData.contactEvidenceValid ||
      row.status === "conflict" ||
      row.status === "possible_match"
    ) {
      rowsRequiringReview++;
    }

    const d = row.mappedData;
    let targetOrgId = row.matchedOrganizationId;

    if (!targetOrgId) {
      // Create new organization record
      targetOrgId = `org_${crypto.randomUUID().slice(0, 10)}`;
      const initialTags: string[] = [];
      if (d.verificationLevel.toLowerCase().includes("directory")) {
        initialTags.push("Needs Research");
      }
      if (!d.contactEvidenceValid) {
        initialTags.push("Evidence Anomaly");
      }

      const initialCategories = d.industry ? [d.industry] : [];

      await db.insert(organizations).values({
        id: targetOrgId,
        workspaceId,
        name: d.name,
        normalizedName: normalizeOrganizationName(d.name),
        websiteUrl: d.websiteUrl,
        normalizedDomain: d.normalizedDomain,
        market: d.market,
        country: d.country,
        city: d.city,
        industry: d.industry,
        observedFacts: d.observedFacts,
        sourceUrl: d.sourceUrl,
        publishedContact: d.publishedContact,
        contactEvidenceUrl: d.contactEvidenceUrl,
        contactEvidenceValid: d.contactEvidenceValid,
        contactEvidenceWarning: d.contactEvidenceWarning,
        sourceLeadStatus: d.sourceLeadStatus || "candidate",
        qualificationDecision: d.qualificationDecision || "not reviewed",
        outreachApproval: d.outreachApproval || "not approved",
        optOutStatus: d.optOutStatus || "unknown",
        priorContactCheck: d.priorContactCheck || "not checked",
        verificationLevel: d.verificationLevel || "unverified",
        sourceNotes: d.sourceNotes,
        primaryPipelineId: DEFAULT_PIPELINE_ID,
        primaryStageId: "stg_new",
        categories: initialCategories,
        tags: initialTags,
        customValues: d.customValues,
        discoveryDate: d.discoveryDate,
        externalId: d.externalId,
        externalNamespace: params.filename,
        nextAction: d.verificationLevel.toLowerCase().includes("directory")
          ? "Verify official website & domain"
          : "Review qualification & site evidence",
      });

      createdOrganizationIds.push(targetOrgId);
      newRecordsCreated++;
    } else {
      existingMatched++;
      if (duplicatePolicy === "skip_existing" || duplicatePolicy === "keep_existing") {
        duplicatesSkipped++;
      } else {
        // Fetch current record to preserve user edits (Section 12.8 & 32.1)
        const existingRows = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, targetOrgId));
        const current = existingRows[0];

        if (current) {
          const mergedCustom =
            duplicatePolicy === "use_imported"
              ? { ...current.customValues, ...d.customValues }
              : { ...d.customValues, ...current.customValues };

          const updates: Partial<typeof organizations.$inferInsert> = {
            websiteUrl:
              duplicatePolicy === "use_imported"
                ? d.websiteUrl || current.websiteUrl
                : current.websiteUrl || d.websiteUrl,
            normalizedDomain:
              duplicatePolicy === "use_imported"
                ? d.normalizedDomain || current.normalizedDomain
                : current.normalizedDomain || d.normalizedDomain,
            market: current.market || d.market,
            country:
              duplicatePolicy === "use_imported"
                ? d.country || current.country
                : current.country || d.country,
            industry: current.industry || d.industry,
            observedFacts: current.observedFacts || d.observedFacts,
            sourceUrl: current.sourceUrl || d.sourceUrl,
            publishedContact: current.publishedContact || d.publishedContact,
            contactEvidenceUrl: current.contactEvidenceUrl || d.contactEvidenceUrl,
            contactEvidenceValid: d.contactEvidenceValid,
            contactEvidenceWarning: d.contactEvidenceWarning || current.contactEvidenceWarning,
            sourceNotes: current.sourceNotes || d.sourceNotes,
            customValues: mergedCustom,
            updatedAt: new Date(),
          };

          await db
            .update(organizations)
            .set(updates)
            .where(eq(organizations.id, targetOrgId));
          recordsUpdated++;
        }
      }
    }

    // Ensure collection membership exists (idempotent on (collectionId, organizationId))
    if (params.collectionId && targetOrgId) {
      const existingMem = await db
        .select()
        .from(collectionMemberships)
        .where(
          and(
            eq(collectionMemberships.collectionId, params.collectionId),
            eq(collectionMemberships.organizationId, targetOrgId)
          )
        );

      if (existingMem.length === 0) {
        await db.insert(collectionMemberships).values({
          id: `mem_${crypto.randomUUID().slice(0, 10)}`,
          workspaceId,
          collectionId: params.collectionId,
          organizationId: targetOrgId,
          collectionCategories: d.industry ? [d.industry] : [],
          stageId: "stg_new",
          customValues: d.customValues,
        });
      }
    }

    // Record row-level source provenance
    if (targetOrgId) {
      await db.insert(sourceRecords).values({
        id: `src_${crypto.randomUUID().slice(0, 10)}`,
        workspaceId,
        importBatchId: batchId,
        organizationId: targetOrgId,
        sourceFilename: params.filename,
        sheetName: params.selectedSheet,
        rowNumber: row.rowNumber,
        externalLeadId: d.externalId,
        rawValues: row.rawValues,
        mappedValues: d as unknown as Record<string, unknown>,
        validationWarnings: row.warnings.map((w) => `${w.field}: ${w.message}`),
      });
    }
  }

  // Update batch summary metrics
  await db
    .update(importBatches)
    .set({
      newRecordsCreated,
      existingMatched,
      recordsUpdated,
      duplicatesSkipped,
      rowsRequiringReview,
      validationWarningsCount: warningsSummary.length,
      failedRowsCount,
      warningsSummary,
      createdOrganizationIds,
    })
    .where(eq(importBatches.id, batchId));

  // Record a single batch-level activity if new records were created or updated
  if (newRecordsCreated > 0 || recordsUpdated > 0) {
    await db.insert(activities).values({
      id: `act_${crypto.randomUUID().slice(0, 10)}`,
      workspaceId,
      collectionId: params.collectionId,
      actorOrigin: "import",
      activityType: "lead_imported",
      title: `${newRecordsCreated} new leads imported (${existingMatched} matched) from ${params.filename}`,
      description: `Sheet "${params.selectedSheet}" processed. ${warningsSummary.length} validation warnings flagged.`,
      metadata: {
        batchId,
        filename: params.filename,
        newRecordsCreated,
        existingMatched,
        recordsUpdated,
        duplicatesSkipped,
        warningsCount: warningsSummary.length,
      },
    });
  }

  const finalBatch = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId));

  return finalBatch[0];
}

/**
 * Safe Import Rollback (Section 32.3):
 * Reverses records created by an import batch ONLY if they do not have user-created notes,
 * tasks, opportunities, or manual score overrides. Preserves modified records safely.
 */
export async function rollbackImportBatch(batchId: string, workspaceId = DEFAULT_WORKSPACE_ID) {
  const db = await getDb();
  const batches = await db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.workspaceId, workspaceId)));

  if (batches.length === 0) {
    throw new Error("Import batch not found");
  }
  const batch = batches[0];
  if (batch.status === "rolled_back") {
    return { status: "already_rolled_back", deletedCount: 0, preservedCount: 0, preservedReasons: [] };
  }

  const createdIds = batch.createdOrganizationIds || [];
  let deletedCount = 0;
  let preservedCount = 0;
  const preservedReasons: Array<{ organizationId: string; name: string; reason: string }> = [];

  for (const orgId of createdIds) {
    const orgRows = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (orgRows.length === 0) continue;
    const org = orgRows[0];

    const userNotes = await db.select().from(notes).where(eq(notes.organizationId, orgId));
    const orgTasks = await db.select().from(tasks).where(eq(tasks.organizationId, orgId));
    const orgOpps = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.organizationId, orgId));

    if (userNotes.length > 0 || orgTasks.length > 0 || orgOpps.length > 0 || org.scoreIsManual) {
      preservedCount++;
      preservedReasons.push({
        organizationId: orgId,
        name: org.name,
        reason: "Preserved because user notes, tasks, opportunities, or manual scores were added after import.",
      });
      continue;
    }

    await db.delete(organizations).where(eq(organizations.id, orgId));
    deletedCount++;
  }

  await db
    .update(importBatches)
    .set({ status: "rolled_back" })
    .where(eq(importBatches.id, batchId));

  await db.insert(activities).values({
    id: `act_${crypto.randomUUID().slice(0, 10)}`,
    workspaceId,
    actorOrigin: "user",
    activityType: "import_rollback",
    title: `Rolled back import batch ${batch.filename} (${deletedCount} removed, ${preservedCount} preserved)`,
    metadata: { batchId, deletedCount, preservedCount },
  });

  return {
    status: "rolled_back",
    deletedCount,
    preservedCount,
    preservedReasons,
  };
}
