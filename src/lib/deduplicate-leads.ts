import { normalizeDomain, normalizeOrganizationName } from "./domain-utils";

export interface ErasedDuplicateEntry {
  erasedId: string;
  mergedIntoId: string;
  name: string;
  domain: string | null;
  externalId: string | null;
  reason: string;
}

export interface DisambiguatedCodeEntry {
  id: string;
  name: string;
  baseNumber: number;
  codeSuffix: string;
  sequenceCode: string;
  previousExternalId: string | null;
  newExternalId: string | null;
}

export interface DeduplicationReport {
  totalBefore: number;
  totalAfter: number;
  erasedCount: number;
  erasedDuplicates: ErasedDuplicateEntry[];
  disambiguatedCount: number;
  disambiguatedLeads: DisambiguatedCodeEntry[];
}

const GENERIC_DIRECTORY_DOMAINS = new Set([
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "wa.me",
  "whatsapp.com",
  "indiamart.com",
  "justdial.com",
  "tradeindia.com",
  "alibaba.com",
  "amazon.com",
  "amazon.in",
  "flipkart.com",
  "etsy.com",
  "shopify.com",
  "myshopify.com",
]);

/**
 * Converts a 0-based collision index into an alphabetic syllable/code suffix:
 * 0 -> "A", 1 -> "B", 2 -> "C", ..., 25 -> "Z", 26 -> "AA", 27 -> "AB", ... till infinity.
 */
export function indexToAlphaSuffix(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let suffix = "";
  while (n >= 0) {
    suffix = String.fromCharCode(65 + (n % 26)) + suffix;
    n = Math.floor(n / 26) - 1;
  }
  return suffix;
}

/**
 * Formats a positive integer as 001, 002, ..., 999, 1000, ... with optional letter suffix (e.g. 001A, 001B).
 */
export function formatLeadCode(num: number, suffix?: string | null): string {
  const safe = Number.isFinite(num) && num >= 1 ? Math.floor(num) : 1;
  const padded = String(safe).padStart(3, "0");
  return suffix ? `${padded}${suffix}` : padded;
}

/**
 * Extracts the base numeric sequence from a lead record.
 * Checks explicit baseNumber, numeric suffix of externalId (e.g. "ECOM-IN-001" -> 1, "005" -> 5),
 * daySequenceNumber, or sequenceNumber.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractBaseNumberFromLead(org: Record<string, any>, fallbackIndex = 1): number {
  if (typeof org.baseNumber === "number" && Number.isFinite(org.baseNumber) && org.baseNumber >= 1) {
    return Math.floor(org.baseNumber);
  }
  if (org.externalId) {
    const ext = String(org.externalId).trim();
    const match = ext.match(/(\d+)[A-Za-z]*$/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed >= 1) {
        return parsed;
      }
    }
  }
  if (
    typeof org.daySequenceNumber === "number" &&
    Number.isFinite(org.daySequenceNumber) &&
    org.daySequenceNumber >= 1
  ) {
    return Math.floor(org.daySequenceNumber);
  }
  if (
    typeof org.sequenceNumber === "number" &&
    Number.isFinite(org.sequenceNumber) &&
    org.sequenceNumber >= 1
  ) {
    return Math.floor(org.sequenceNumber);
  }
  return Math.max(1, Math.floor(fallbackIndex));
}

/**
 * Strips any previously appended trailing disambiguation letter(s) from an externalId
 * when re-computing suffixes on numeric IDs (e.g. "ECOM-IN-001A" -> "ECOM-IN-001", "001B" -> "001").
 */
export function stripTrailingSuffixFromExternalId(externalId: string): string {
  return externalId.replace(/(\d+)[A-Z]+$/, "$1");
}

/**
 * Determines whether two lead records have duplicated content (same business & details).
 * Returns { isDuplicate: false } when two leads share a number/ID but have different names and details.
 */
export function areLeadsContentIdentical(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b: Record<string, any>
): { isDuplicate: boolean; reason: string } {
  const nameA = normalizeOrganizationName(String(a.name || ""));
  const nameB = normalizeOrganizationName(String(b.name || ""));

  const domA =
    a.normalizedDomain ||
    (a.websiteUrl && String(a.websiteUrl).toLowerCase() !== "unknown"
      ? normalizeDomain(String(a.websiteUrl))
      : null);
  const domB =
    b.normalizedDomain ||
    (b.websiteUrl && String(b.websiteUrl).toLowerCase() !== "unknown"
      ? normalizeDomain(String(b.websiteUrl))
      : null);

  const isSpecificDomA = Boolean(domA && !GENERIC_DIRECTORY_DOMAINS.has(domA));
  const isSpecificDomB = Boolean(domB && !GENERIC_DIRECTORY_DOMAINS.has(domB));

  // If both have valid, specific business domains and those domains are different AND names are different -> definitely NOT duplicates
  if (isSpecificDomA && isSpecificDomB && domA !== domB) {
    return { isDuplicate: false, reason: "" };
  }

  // Case 1: Identical specific business domain AND (identical normalized name OR one name contains the other OR identical facts/contact)
  if (isSpecificDomA && isSpecificDomB && domA === domB) {
    if (!nameA || !nameB || nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA)) {
      return {
        isDuplicate: true,
        reason: `Identical domain (${domA}) and matching business identity (${a.name})`,
      };
    }
    const factsA = String(a.observedFacts || "").trim().toLowerCase();
    const factsB = String(b.observedFacts || "").trim().toLowerCase();
    if (factsA && factsA === factsB) {
      return {
        isDuplicate: true,
        reason: `Identical domain (${domA}) and identical observed facts`,
      };
    }
  }

  // Case 2: Identical normalized business name
  if (nameA && nameB && nameA === nameB) {
    const countryA = String(a.country || "").trim().toLowerCase();
    const countryB = String(b.country || "").trim().toLowerCase();
    const industryA = String(a.industry || "").trim().toLowerCase();
    const industryB = String(b.industry || "").trim().toLowerCase();
    const factsA = String(a.observedFacts || "").trim().toLowerCase();
    const factsB = String(b.observedFacts || "").trim().toLowerCase();
    const contactA = String(a.publishedContact || "").trim().toLowerCase();
    const contactB = String(b.publishedContact || "").trim().toLowerCase();

    // Same name and same specific domain
    if (isSpecificDomA && isSpecificDomB && domA === domB) {
      return {
        isDuplicate: true,
        reason: `Identical business name (${a.name}) and domain (${domA})`,
      };
    }

    // Same name, no conflicting domain, and matching country + (industry or facts or contact or both empty)
    if (!isSpecificDomA || !isSpecificDomB) {
      if (
        (!countryA || !countryB || countryA === countryB) &&
        (industryA === industryB ||
          (factsA && factsA === factsB) ||
          (contactA && contactA === contactB) ||
          (!factsA && !factsB))
      ) {
        return {
          isDuplicate: true,
          reason: `Identical business name (${a.name})${countryA ? ` in ${a.country}` : ""}`,
        };
      }
    }
  }

  return { isDuplicate: false, reason: "" };
}

/**
 * Runs across a workspace state (or array of lead records):
 * 1. Detects any content-duplicated leads and ERASES the duplicates (merging notes/tasks/fields into the kept record).
 * 2. Detects any remaining leads that have DUPLICATED NUMBERS (e.g. 001 & 001) but DIFFERENT CONTENT
 *    (different names and details), and assigns them disambiguated letter codes: 001A, 001B, 001C...
 */
export function deduplicateAndDisambiguateWorkspaceState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: Record<string, any>
): DeduplicationReport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgs: Array<Record<string, any>> = Array.isArray(state.organizations)
    ? state.organizations
    : [];

  const totalBefore = orgs.length;
  const erasedDuplicates: ErasedDuplicateEntry[] = [];
  const disambiguatedLeads: DisambiguatedCodeEntry[] = [];

  // Order by ascending sequenceNumber (or original array index) so first occurrence is kept / gets 'A'
  const chronological = orgs
    .map((org, idx) => ({ org, idx }))
    .sort((a, b) => {
      const seqA = typeof a.org.sequenceNumber === "number" ? a.org.sequenceNumber : a.idx + 1;
      const seqB = typeof b.org.sequenceNumber === "number" ? b.org.sequenceNumber : b.idx + 1;
      if (seqA !== seqB) return seqA - seqB;
      return a.idx - b.idx;
    })
    .map((entry) => entry.org);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keptChronological: Array<Record<string, any>> = [];
  const erasedToPrimaryId = new Map<string, string>();

  for (const candidate of chronological) {
    let matchedPrimary: Record<string, any> | null = null;
    let matchReason = "";

    for (const existing of keptChronological) {
      // Do not deduplicate archived leads against active leads unless both have same status
      if (Boolean(existing.archivedAt) !== Boolean(candidate.archivedAt)) continue;
      const check = areLeadsContentIdentical(existing, candidate);
      if (check.isDuplicate) {
        matchedPrimary = existing;
        matchReason = check.reason;
        break;
      }
    }

    if (matchedPrimary) {
      // Merge any missing fields from candidate into matchedPrimary before erasing candidate
      const fillFields = [
        "websiteUrl",
        "normalizedDomain",
        "country",
        "city",
        "market",
        "industry",
        "observedFacts",
        "sourceUrl",
        "publishedContact",
        "contactEvidenceUrl",
        "nextAction",
      ];
      for (const f of fillFields) {
        if (!matchedPrimary[f] && candidate[f]) {
          matchedPrimary[f] = candidate[f];
        }
      }
      if (matchedPrimary.score === null || matchedPrimary.score === undefined) {
        if (candidate.score !== null && candidate.score !== undefined) {
          matchedPrimary.score = candidate.score;
          matchedPrimary.scoreBreakdown = candidate.scoreBreakdown;
        }
      }
      if (candidate.isBookmarked) {
        matchedPrimary.isBookmarked = true;
      }
      matchedPrimary.tags = Array.from(
        new Set([...(matchedPrimary.tags || []), ...(candidate.tags || [])])
      );
      matchedPrimary.categories = Array.from(
        new Set([...(matchedPrimary.categories || []), ...(candidate.categories || [])])
      );
      matchedPrimary.customValues = {
        ...(candidate.customValues || {}),
        ...(matchedPrimary.customValues || {}),
      };

      erasedToPrimaryId.set(candidate.id, matchedPrimary.id);
      erasedDuplicates.push({
        erasedId: candidate.id,
        mergedIntoId: matchedPrimary.id,
        name: String(candidate.name || ""),
        domain: candidate.normalizedDomain || null,
        externalId: candidate.externalId || null,
        reason: matchReason,
      });
    } else {
      keptChronological.push(candidate);
    }
  }

  // If any duplicates were erased, re-point related entities so user notes/tasks/history are never lost
  if (erasedToPrimaryId.size > 0) {
    const relatedArrays = [
      "notes",
      "tasks",
      "opportunities",
      "contacts",
      "activities",
      "attachments",
      "references",
      "contentIdeas",
      "sourceRecords",
      "stageHistory",
    ];
    for (const key of relatedArrays) {
      if (Array.isArray(state[key])) {
        for (const item of state[key]) {
          if (item && item.organizationId && erasedToPrimaryId.has(item.organizationId)) {
            item.organizationId = erasedToPrimaryId.get(item.organizationId);
          }
        }
      }
    }

    if (Array.isArray(state.memberships)) {
      const seenColOrg = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cleanedMemberships: Array<Record<string, any>> = [];
      for (const m of state.memberships) {
        if (m.organizationId && erasedToPrimaryId.has(m.organizationId)) {
          m.organizationId = erasedToPrimaryId.get(m.organizationId);
        }
        const pairKey = `${m.collectionId}|${m.organizationId}`;
        if (!seenColOrg.has(pairKey)) {
          seenColOrg.add(pairKey);
          cleanedMemberships.push(m);
        }
      }
      state.memberships = cleanedMemberships;
    }
  }

  // Phase 2: Disambiguate leads that have DUPLICATED NUMBERS but DIFFERENT CONTENT
  // Assign baseNumber and group by baseNumber
  const byBaseNumber = new Map<number, Array<Record<string, any>>>();
  keptChronological.forEach((org, idx) => {
    const baseNum = extractBaseNumberFromLead(org, idx + 1);
    org.baseNumber = baseNum;
    const list = byBaseNumber.get(baseNum) || [];
    list.push(org);
    byBaseNumber.set(baseNum, list);
  });

  for (const [baseNum, group] of byBaseNumber.entries()) {
    if (group.length === 1) {
      const single = group[0];
      single.codeSuffix = "";
      single.sequenceCode = formatLeadCode(baseNum, "");
    } else {
      // Multiple leads with DIFFERENT content share the exact same number (e.g. 001)!
      // Give each one a letter suffix code based on that number: 001A, 001B, 001C...
      group.forEach((org, collisionIdx) => {
        const suffix = indexToAlphaSuffix(collisionIdx);
        const newSeqCode = formatLeadCode(baseNum, suffix);
        const prevSeqCode = org.sequenceCode || formatLeadCode(baseNum, "");
        org.codeSuffix = suffix;
        org.sequenceCode = newSeqCode;

        if (prevSeqCode !== newSeqCode) {
          disambiguatedLeads.push({
            id: org.id,
            name: String(org.name || ""),
            baseNumber: baseNum,
            codeSuffix: suffix,
            sequenceCode: newSeqCode,
            previousExternalId: org.externalId || null,
            newExternalId: org.externalId || null,
          });
        }
      });
    }
  }

  // Also check if any surviving leads with DIFFERENT content have the exact same externalId string
  // (e.g., two different companies both having externalId "ECOM-IN-001" or "001")
  const byBaseExternalId = new Map<string, Array<Record<string, any>>>();
  for (const org of keptChronological) {
    if (!org.externalId) continue;
    const rawExt = stripTrailingSuffixFromExternalId(String(org.externalId).trim());
    const key = rawExt.toLowerCase();
    const list = byBaseExternalId.get(key) || [];
    list.push(org);
    byBaseExternalId.set(key, list);
  }

  for (const [, group] of byBaseExternalId.entries()) {
    if (group.length > 1) {
      group.forEach((org, idx) => {
        const suffix = org.codeSuffix || indexToAlphaSuffix(idx);
        const baseExt = stripTrailingSuffixFromExternalId(String(org.externalId).trim());
        const prevExt = String(org.externalId);
        const nextExt = `${baseExt}${suffix}`;
        org.externalId = nextExt;
        if (!org.codeSuffix) {
          org.codeSuffix = suffix;
          org.sequenceCode = formatLeadCode(org.baseNumber || 1, suffix);
        }
        const existingReport = disambiguatedLeads.find((d) => d.id === org.id);
        if (existingReport) {
          existingReport.previousExternalId = prevExt;
          existingReport.newExternalId = nextExt;
        } else if (prevExt !== nextExt) {
          disambiguatedLeads.push({
            id: org.id,
            name: String(org.name || ""),
            baseNumber: org.baseNumber || 1,
            codeSuffix: suffix,
            sequenceCode: org.sequenceCode,
            previousExternalId: prevExt,
            newExternalId: nextExt,
          });
        }
      });
    }
  }

  // Restore original array ordering (newest-first in state.organizations)
  const survivingSet = new Set(keptChronological.map((o) => o.id));
  state.organizations = orgs.filter((o) => survivingSet.has(o.id));

  return {
    totalBefore,
    totalAfter: state.organizations.length,
    erasedCount: erasedDuplicates.length,
    erasedDuplicates,
    disambiguatedCount: disambiguatedLeads.length,
    disambiguatedLeads,
  };
}
