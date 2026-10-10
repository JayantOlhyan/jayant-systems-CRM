import { parse as parseDomain } from "tldts";
import type { ScoringConfigJSON } from "@/db/schema";

const UNKNOWN_WEBSITE_TOKENS = new Set([
  "",
  "n/a",
  "na",
  "none",
  "null",
  "unknown",
  "not available",
  "not found",
  "no website",
  "directory only",
  "directory-only",
  "tbd",
  "-",
  "—",
]);

export function normalizeOrganizationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(pvt\.?\s*ltd\.?|private\s+limited|llc|inc\.?|ltd\.?|co\.?|corp\.?|llp)\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Public-suffix-aware domain normalization using `tldts`.
 * Strips `www.` while preserving meaningful tenant subdomains on known shared platforms
 * (e.g., `brand.myshopify.com` stays `brand.myshopify.com`, while `www.example.co.uk/about` -> `example.co.uk`).
 * Returns `null` if the input is missing, unknown, or not a valid domain.
 */
export function normalizeDomain(rawInput?: string | null): string | null {
  if (!rawInput || typeof rawInput !== "string") return null;
  const trimmed = rawInput.trim();
  if (!trimmed || UNKNOWN_WEBSITE_TOKENS.has(trimmed.toLowerCase())) {
    return null;
  }

  // Must not be a bare integer or single word without dots
  if (!trimmed.includes(".") || /^\d+$/.test(trimmed)) {
    return null;
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    const parsed = parseDomain(url.hostname, { allowPrivateDomains: true });
    if (!parsed.domain || (!parsed.isIcann && !parsed.isPrivate)) {
      return null;
    }

    const sub = (parsed.subdomain || "").toLowerCase();
    // Strip standard web prefixes ('www', 'm', 'shop', '') to normalize root org domain
    if (!sub || sub === "www" || sub === "m") {
      return parsed.domain.toLowerCase();
    }

    // If hosted on multi-tenant storefront or subdomain, preserve hostname without www.
    const cleanHost = url.hostname.toLowerCase().replace(/^www\./, "");
    return cleanHost;
  } catch {
    return null;
  }
}

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string | null;
  rawValue: string | null;
  warning: string | null;
}

/**
 * Validates URL fields such as Official Website, Source URL, and Contact Evidence URL.
 * Flags anomalies like `49` or `sent` in Contact Evidence URL without converting them into links
 * or interpreting them as outreach activity.
 */
export function validateUrlField(value: unknown, fieldLabel = "URL"): UrlValidationResult {
  if (value === null || value === undefined) {
    return { isValid: true, normalizedUrl: null, rawValue: null, warning: null };
  }

  const raw = String(value).trim();
  if (!raw || UNKNOWN_WEBSITE_TOKENS.has(raw.toLowerCase())) {
    return { isValid: true, normalizedUrl: null, rawValue: raw || null, warning: null };
  }

  // Detect anomalous non-URL tokens (e.g. "49", "sent", "yes", "done", bare numbers)
  if (/^\d+$/.test(raw)) {
    return {
      isValid: false,
      normalizedUrl: null,
      rawValue: raw,
      warning: `${fieldLabel} contains numeric value "${raw}" instead of a valid URL. Preserved raw value without link activation.`,
    };
  }

  if (/^(sent|contacted|emailed|called|yes|no|done|pending|approved)$/i.test(raw)) {
    return {
      isValid: false,
      normalizedUrl: null,
      rawValue: raw,
      warning: `${fieldLabel} contains status-like token "${raw}" instead of a valid URL. Not interpreted as outreach activity.`,
    };
  }

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsedUrl = new URL(candidate);
    const domainInfo = parseDomain(parsedUrl.hostname, { allowPrivateDomains: true });
    if (!domainInfo.domain || (!domainInfo.isIcann && !domainInfo.isPrivate)) {
      return {
        isValid: false,
        normalizedUrl: null,
        rawValue: raw,
        warning: `${fieldLabel} "${raw}" does not contain a valid public domain.`,
      };
    }

    return {
      isValid: true,
      normalizedUrl: parsedUrl.toString(),
      rawValue: raw,
      warning: null,
    };
  } catch {
    return {
      isValid: false,
      normalizedUrl: null,
      rawValue: raw,
      warning: `${fieldLabel} "${raw}" is malformed and cannot be parsed as a valid web address.`,
    };
  }
}

export function calculateLeadScore(
  inputs: Record<string, number | null | undefined>,
  config: ScoringConfigJSON
): {
  score: number | null;
  method: string;
  normalizedBreakdown: Record<string, number>;
} {
  const dimensions = config.dimensions || [];
  if (dimensions.length === 0) {
    return { score: null, method: "unscored", normalizedBreakdown: {} };
  }

  const normalizedBreakdown: Record<string, number> = {};
  let providedWeightSum = 0;
  let weightedTotal = 0;
  let missingCount = 0;

  for (const dim of dimensions) {
    const rawVal = inputs[dim.key];
    if (rawVal === undefined || rawVal === null || Number.isNaN(Number(rawVal))) {
      missingCount++;
      if (config.missingValuePolicy === "zero") {
        normalizedBreakdown[dim.key] = 0;
        providedWeightSum += dim.weight;
      }
      continue;
    }

    const clamped = Math.max(0, Math.min(100, Number(rawVal)));
    normalizedBreakdown[dim.key] = clamped;
    weightedTotal += clamped * (dim.weight / 100);
    providedWeightSum += dim.weight;
  }

  if (Object.keys(normalizedBreakdown).length === 0) {
    return { score: null, method: "unscored", normalizedBreakdown: {} };
  }

  if (missingCount > 0 && config.missingValuePolicy === "unscored") {
    return { score: null, method: "incomplete_inputs", normalizedBreakdown };
  }

  if (config.missingValuePolicy === "exclude" && providedWeightSum > 0) {
    const scaled = Math.round((weightedTotal / providedWeightSum) * 100);
    return {
      score: Math.max(0, Math.min(100, scaled)),
      method: `weighted_v${config.version}_partial`,
      normalizedBreakdown,
    };
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(weightedTotal))),
    method: `weighted_v${config.version}`,
    normalizedBreakdown,
  };
}

export function getScorePriorityLabel(
  score: number | null | undefined,
  config: ScoringConfigJSON
): { label: "High Priority" | "Medium Priority" | "Low Priority" | "Unscored"; tone: "success" | "warning" | "error" | "muted" } {
  if (score === null || score === undefined) {
    return { label: "Unscored", tone: "muted" };
  }
  if (score >= config.highThreshold) {
    return { label: "High Priority", tone: "success" };
  }
  if (score >= config.mediumThreshold) {
    return { label: "Medium Priority", tone: "warning" };
  }
  return { label: "Low Priority", tone: "error" };
}

/**
 * Protects exported CSV/spreadsheet cells against formula injection (Section 26.3).
 */
export function sanitizeSpreadsheetCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
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
