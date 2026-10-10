import { NextRequest, NextResponse } from "next/server";
import {
  parseWorkbookSheets,
  previewSpreadsheetImport,
  executeSpreadsheetImport,
  rollbackImportBatch,
  type DuplicateHandlingPolicy,
} from "@/lib/importer";
import { generateLedgerWorkbookBuffer, LEDGER_FILENAME } from "@/lib/ledger-fixture";
import { DEFAULT_WORKSPACE_ID, GLOBAL_ECOM_COLLECTION_ID } from "@/db";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let mode = "inspect";
    let filename = LEDGER_FILENAME;
    let buffer: Buffer | null = null;
    let selectedSheet = "Leads";
    let collectionId = GLOBAL_ECOM_COLLECTION_ID;
    let mapping: Record<string, string> = {};
    let duplicatePolicy: DuplicateHandlingPolicy = "fill_blanks";
    let headerRowNumber: number | undefined;
    let batchId: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      mode = String(formData.get("mode") || "inspect");
      const file = formData.get("file") as File | null;
      const useFixture = formData.get("useFixture") === "true";

      if (useFixture) {
        buffer = await generateLedgerWorkbookBuffer();
        filename = LEDGER_FILENAME;
      } else if (file) {
        filename = file.name;
        const lower = filename.toLowerCase();
        if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
          return NextResponse.json(
            {
              error:
                "Unsupported file format. Please upload a valid .xlsx workbook or .csv file.",
            },
            { status: 400 }
          );
        }
        const ab = await file.arrayBuffer();
        buffer = Buffer.from(ab);
      }

      if (formData.get("selectedSheet")) {
        selectedSheet = String(formData.get("selectedSheet"));
      }
      if (formData.get("collectionId")) {
        collectionId = String(formData.get("collectionId"));
      }
      if (formData.get("mapping")) {
        mapping = JSON.parse(String(formData.get("mapping")));
      }
      if (formData.get("duplicatePolicy")) {
        duplicatePolicy = String(formData.get("duplicatePolicy")) as DuplicateHandlingPolicy;
      }
      if (formData.get("headerRowNumber")) {
        headerRowNumber = Number(formData.get("headerRowNumber"));
      }
    } else {
      const body = await req.json();
      mode = body.mode || "inspect";
      selectedSheet = body.selectedSheet || "Leads";
      collectionId = body.collectionId || GLOBAL_ECOM_COLLECTION_ID;
      mapping = body.mapping || {};
      duplicatePolicy = body.duplicatePolicy || "fill_blanks";
      headerRowNumber = body.headerRowNumber ? Number(body.headerRowNumber) : undefined;
      batchId = body.batchId;

      if (body.useFixture) {
        buffer = await generateLedgerWorkbookBuffer();
        filename = LEDGER_FILENAME;
      } else if (body.fileBase64 && body.filename) {
        filename = String(body.filename);
        buffer = Buffer.from(String(body.fileBase64), "base64");
      }
    }

    if (mode === "rollback") {
      if (!batchId) {
        return NextResponse.json({ error: "Missing batchId for rollback" }, { status: 400 });
      }
      const res = await rollbackImportBatch(batchId, DEFAULT_WORKSPACE_ID);
      return NextResponse.json({ ok: true, ...res });
    }

    if (!buffer) {
      return NextResponse.json(
        { error: "No spreadsheet file provided for import." },
        { status: 400 }
      );
    }

    if (mode === "inspect") {
      const { inspection } = await parseWorkbookSheets(buffer, filename, headerRowNumber);
      return NextResponse.json({
        ok: true,
        inspection,
        fileBase64: buffer.toString("base64"),
      });
    }

    if (mode === "preview") {
      const preview = await previewSpreadsheetImport({
        buffer,
        filename,
        selectedSheet,
        mapping,
        headerRowNumber,
        workspaceId: DEFAULT_WORKSPACE_ID,
      });
      return NextResponse.json({ ok: true, preview });
    }

    if (mode === "execute") {
      const batch = await executeSpreadsheetImport({
        buffer,
        filename,
        selectedSheet,
        collectionId,
        mapping,
        duplicatePolicy,
        headerRowNumber,
        workspaceId: DEFAULT_WORKSPACE_ID,
      });
      return NextResponse.json({ ok: true, batch });
    }

    return NextResponse.json({ error: `Unknown import mode: ${mode}` }, { status: 400 });
  } catch (err) {
    console.error("POST /api/import error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unable to parse spreadsheet. Ensure the file is a valid .xlsx or .csv document.",
      },
      { status: 500 }
    );
  }
}
