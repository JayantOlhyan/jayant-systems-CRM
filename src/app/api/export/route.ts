import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, DEFAULT_WORKSPACE_ID } from "@/db";
import { importBatches } from "@/db/schema";
import { queryLeadsPaginated, getFullWorkspaceData } from "@/lib/crm-service";
import { sanitizeSpreadsheetCell } from "@/lib/domain-utils";
import { generateLedgerWorkbookBuffer, LEDGER_FILENAME } from "@/lib/ledger-fixture";

function toCsvLine(cells: unknown[]): string {
  return cells
    .map((cell) => {
      const safe = sanitizeSpreadsheetCell(cell);
      if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
        return `"${safe.replace(/"/g, '""')}"`;
      }
      return safe;
    })
    .join(",");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    const collectionId = searchParams.get("collectionId") || undefined;
    const market = searchParams.get("market") || undefined;
    const idsParam = searchParams.get("ids") || undefined;
    const batchId = searchParams.get("batchId") || undefined;

    if (format === "ledger_fixture") {
      const buf = await generateLedgerWorkbookBuffer();
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="Global-E-Commerce-Lead-Ledger-2026.xlsx"`,
        },
      });
    }

    if (format === "import_warnings" && batchId) {
      const db = await getDb();
      const batches = await db
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, batchId));
      const batch = batches[0];
      const warnings = batch?.warningsSummary || [];
      const lines = [
        toCsvLine(["Row Number", "Lead ID", "Business", "Field", "Raw Value", "Validation Warning"]),
        ...warnings.map((w) =>
          toCsvLine([w.rowNumber, w.externalId || "", w.business || "", w.field, w.value, w.message])
        ),
      ];
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="import-warnings-${batchId}.csv"`,
        },
      });
    }

    if (format === "workspace_backup_json") {
      const full = await getFullWorkspaceData(DEFAULT_WORKSPACE_ID);
      return new NextResponse(JSON.stringify(full, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="jayant-crm-backup-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    const { rows } = await queryLeadsPaginated(
      {
        collectionId,
        market,
        page: 1,
        pageSize: 5000,
      },
      DEFAULT_WORKSPACE_ID
    );

    const selectedIds = idsParam ? new Set(idsParam.split(",").filter(Boolean)) : null;
    const exportRows = selectedIds ? rows.filter((r) => selectedIds.has(r.id)) : rows;

    if (format === "json") {
      return new NextResponse(JSON.stringify(exportRows, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="jayant-crm-leads-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    const headers = [
      "Lead ID",
      "Company Name",
      "Website",
      "Normalized Domain",
      "Market",
      "Country",
      "Niche / Industry",
      "Categories",
      "Tags",
      "Score",
      "Pipeline Stage ID",
      "Source Lead Status",
      "Qualification Decision",
      "Outreach Approval",
      "Opt-Out Status",
      "Verification Level",
      "Published Contact",
      "Contact Evidence URL",
      "Contact Evidence Valid",
      "Observed Facts",
      "Discovery Date",
      "Next Action",
    ];

    const csvLines = [
      toCsvLine(headers),
      ...exportRows.map((r) =>
        toCsvLine([
          r.externalId || r.id,
          r.name,
          r.websiteUrl || "",
          r.normalizedDomain || "",
          r.market || "",
          r.country || "",
          r.industry || "",
          (r.categories || []).join("; "),
          (r.tags || []).join("; "),
          r.effectiveScore ?? "",
          r.primaryStageId || "",
          r.sourceLeadStatus || "",
          r.qualificationDecision || "",
          r.outreachApproval || "",
          r.optOutStatus || "",
          r.verificationLevel || "",
          r.publishedContact || "",
          r.contactEvidenceUrl || "",
          r.contactEvidenceValid ? "Valid" : "Invalid / Flagged",
          r.observedFacts || "",
          r.discoveryDate || "",
          r.nextAction || "",
        ])
      ),
    ];

    return new NextResponse(csvLines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="jayant-crm-leads-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
