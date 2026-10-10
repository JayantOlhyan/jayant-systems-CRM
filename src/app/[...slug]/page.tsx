import { CrmWorkspaceShell, NavSection } from "@/components/CrmWorkspaceShell";

const SLUG_TO_SECTION: Record<string, NavSection> = {
  dashboard: "dashboard",
  leads: "leads",
  companies: "companies",
  contacts: "contacts",
  collections: "collections",
  pipelines: "pipelines",
  tasks: "tasks",
  "follow-ups": "followups",
  followups: "followups",
  calendar: "calendar",
  references: "references",
  content: "content",
  attachments: "attachments",
  imports: "imports",
  "import-history": "import_history",
  exports: "exports",
  analytics: "analytics",
  activity: "activity",
  settings: "settings",
  "collection-settings": "collection_settings",
  "field-management": "field_management",
  "scoring-rules": "scoring_rules",
  "data-management": "data_management",
};

export default async function DynamicWorkspaceRoutePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolved = await params;
  const segments = resolved.slug || [];
  const root = (segments[0] || "dashboard").toLowerCase();
  const subId = segments[1];

  if (root === "collections" && subId) {
    return (
      <CrmWorkspaceShell
        initialSection="collection_detail"
        initialCollectionId={subId}
      />
    );
  }

  if (root === "leads" && subId) {
    return (
      <CrmWorkspaceShell
        initialSection="leads"
        initialLeadId={subId}
      />
    );
  }

  const section = SLUG_TO_SECTION[root] || "dashboard";
  return <CrmWorkspaceShell initialSection={section} />;
}
