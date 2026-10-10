# JAYANT CRM — Personal Lead Intelligence & Relationship Management Workspace

A private, customizable, production-grade CRM and Lead Intelligence Workspace engineered for **Jayant Web & AI Systems** (Web Development, AI Systems, Automation, and Digital Solutions Agency).

---

## 1. Product Overview

**JAYANT CRM** is a single-user-first, high-density agency operating workspace designed to replace fragmented spreadsheets with a structured, customizable relational database while preserving spreadsheet speed and provenance.

### Core Capabilities
- **Unlimited Custom Collections**: Organize leads into independent collections (`Global E-Commerce Leads`, `India D2C Brands`, `Schools & Education`, `AI Automation Prospects`, etc.), each with its own categories, custom fields, default view, and weighted scoring formula.
- **Shared Company Identity vs. Scoped Collection Membership**: A company (`Organization`) exists once globally by canonical domain (`tldts` public-suffix-aware normalization) while belonging to one or more collections with collection-specific categories, stages, custom field values, and scores.
- **Multi-Sheet Spreadsheet Import Engine (`.xlsx` & `.csv`)**:
  - Automatically inspects workbooks with multiple sheets (`Leads`, `Run Log`, `Do Not Contact`).
  - Imports `Leads` with intelligent column mapping, saved mapping templates, and duplicate policies (`fill_blanks`, `keep_existing`, `use_imported`, `skip_existing`).
  - Records `Run Log` rows as batch provenance metadata rather than lead records.
  - Syncs `Do Not Contact` sheets into the workspace-wide **Contact Suppression Registry**.
  - Preserves raw source rows in `source_records` and flags anomalous URL values (such as `49` or `sent` in `Contact Evidence URL`) without fabricating clickable URLs or false outreach history.
  - Supports safe **Import Batch Rollback** that removes unmodified batch records while preserving any leads where user notes, tasks, opportunities, or manual scores were added.
- **18 Custom Field Types**: Text, Long Text, Number, Currency, Percentage, Boolean, Single Select, Multi Select, Date, URL, Email, Phone, Rating, Score, Status, Tag List, JSON Metadata, and Relation.
- **Configurable Opportunity Scoring**: Per-collection weighted scoring dimensions (`0–100`) with missing-value policies, plus manual score overrides with audit logging.
- **8-Tab Lead & Company Profile**: Overview, Contacts, Opportunities (multiple deals per company), Notes & Research, Tasks & Follow-ups, Website & Socials, Attachments, and Source Data Provenance.
- **Kanban Pipelines, Tasks, Follow-ups, Calendar, Reference Library, Content Ideas (`[Create Content Idea From Lead]`), Real Analytics, and Command Palette (`Cmd/Ctrl + K`)**.

---

## 2. Architecture & Technology Stack

- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript
- **Styling**: Tailwind CSS + CSS Custom Properties for Dark Mode (`#0B0D12` primary reference theme) and Light Mode (`Manrope`, `Inter`, and `IBM Plex Mono` typography)
- **Database & ORM**:
  - **PostgreSQL** via **Drizzle ORM** ([`src/db/schema.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/agency/CRM%20System/src/db/schema.ts))
  - Supports external PostgreSQL / Supabase via `DATABASE_URL` (`pg` driver) **and** zero-config embedded PostgreSQL 16 (`@electric-sql/pglite` persisted in `./data/pgdata`) out of the box.
- **Spreadsheet Engine**: `ExcelJS` (multi-sheet `.xlsx` parsing and generation) + `PapaParse` (`.csv` parsing and export with formula-injection sanitization)
- **Domain Normalization**: `tldts` (ICANN + multi-tenant public suffix extraction)
- **Testing**: `Vitest` unit, integration, and end-to-end workflow test suite ([`src/__tests__/crm-core.test.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/agency/CRM%20System/src/__tests__/crm-core.test.ts))

---

## 3. Local Setup & Commands

### Prerequisites
- Node.js `>= 18.18.0`
- npm `>= 9.0.0`

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (optional for local development; sensible defaults are preconfigured):
```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | Optional PostgreSQL / Supabase connection URI. When omitted, uses persistent local PostgreSQL (`./data/pgdata`). | *(Embedded PGlite)* |
| `PGLITE_DATA_DIR` | Directory for local embedded PostgreSQL data persistence. | `./data/pgdata` |
| `CRM_ADMIN_EMAIL` | Single-user operator login email. | `jayant@jayant.systems` |
| `CRM_ADMIN_PASSWORD` | Single-user operator login password. | `jayant-crm-2026` |
| `CRM_SESSION_SECRET` | HMAC-SHA256 secret used to sign HTTP-only session cookies. | *(Built-in dev secret)* |

### 3. Generate the 200-Lead Workbook Fixture & Seed the Workspace
```bash
npm run generate:fixture
npm run seed
```
- Generates `fixtures/Jayant Solution — Global E-Commerce Lead Ledger (2026).xlsx` (containing the `Leads` sheet with 200 leads across 18 columns, `Run Log` provenance sheet, and `Do Not Contact` exclusion sheet).
- Seeds the workspace idempotently with all 200 leads, starter collections, pipeline stages, and sample tasks/opportunities/references.

### 4. Start the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 5. Run Typecheck, Automated Tests, and Production Build
```bash
npm run lint     # Runs tsc --noEmit
npm test         # Runs Vitest unit + integration + Workflows A-F suite
npm run build    # Builds production Next.js bundle
```

---

## 4. Importing `Global E-Commerce Lead Ledger (2026).xlsx`

1. Navigate to **DATA → Import Center** (`/imports`) or click **Import Spreadsheet** in the top bar.
2. Upload `fixtures/Jayant Solution — Global E-Commerce Lead Ledger (2026).xlsx` (or click **Load 200-Lead Global E-Commerce Ledger Fixture**).
3. **Workbook Sheet Inspection**:
   - `Leads` (200 rows, 18 columns: `100 India`, `100 International`, `192 site description`, `8 directory listing only`) is selected as the primary import sheet.
   - `Run Log` is automatically detected and stored as batch provenance metadata.
   - `Do Not Contact` is automatically detected and synced into the **Contact Suppression Registry**.
4. **Governance & Anomaly Preservation**:
   - Source `Status = candidate` is preserved in `sourceLeadStatus` while CRM Pipeline Stage starts cleanly at `New`.
   - `Qualification Decision = not reviewed`, `Outreach Approval = not approved`, and `Opt-Out = unknown` are preserved accurately.
   - Anomalous values in `Contact Evidence URL` (`49` on `ECOM-IN-049` and `sent` on `ECOM-INTL-012`) are flagged with validation warnings, stored in `contactEvidenceUrl` with `contactEvidenceValid = false`, and **never** rendered as broken links or false outreach events.

---

## 5. Creating Custom Collections, Fields & Scoring Rules

1. Navigate to **SYSTEM → Collection Settings** (`/collection-settings`) or click **New Collection**.
2. Specify the collection name, icon, accent color, default view (`Table`, `Kanban`, `Cards`), custom categories, and custom fields (any of the 18 supported field types).
3. Configure collection-specific **Opportunity Scoring Rules** (`0–100` weighted dimensions summing to `100%`, High/Medium thresholds, and missing-value policy).
4. Any company can belong to multiple collections simultaneously without duplicating the underlying organization record.

---

## 6. Backup, Export & Data Management

- **Export Center (`/exports`)**: Export filtered leads, collections, or full workspace records to `.xlsx` or formula-sanitized `.csv`.
- **Full JSON Workspace Backup**: Download a complete relational JSON snapshot of all collections, organizations, contacts, opportunities, notes, tasks, references, content ideas, and import provenance from **Export Center** or **Settings → Data Management**.
