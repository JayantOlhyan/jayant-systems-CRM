"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Database,
  Building2,
  Users,
  FolderKanban,
  Columns,
  CheckSquare,
  Clock,
  Calendar,
  Bookmark,
  Video,
  Paperclip,
  Upload,
  History,
  Download,
  BarChart3,
  Activity,
  Settings,
  Sliders,
  Layers,
  Shield,
  Search,
  Plus,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Pin,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  X,
  LogOut,
  ShoppingBag,
  Globe,
  GraduationCap,
  Bot,
} from "lucide-react";
import { LeadsDatabaseView } from "./LeadsDatabaseView";
import { LeadProfileModal } from "./LeadProfileModal";
import { ImportCenterView } from "./ImportCenterView";
import { CollectionSettingsView } from "./CollectionSettingsView";
import {
  PipelineKanbanView,
  TasksAndFollowUpsView,
  ReferencesAndContentView,
  ContactsAndSuppressionView,
  AnalyticsAndActivityView,
} from "./WorkflowAndLibraryViews";
import {
  installLocalBrowserStorageInterceptor,
  getLocalBrowserStorageStats,
  triggerLocalBrowserFileDownload,
  LOCAL_STORAGE_DB_KEY,
} from "@/lib/browser-storage";

export type NavSection =
  | "dashboard"
  | "leads"
  | "companies"
  | "contacts"
  | "collections"
  | "collection_detail"
  | "pipelines"
  | "tasks"
  | "followups"
  | "calendar"
  | "references"
  | "content"
  | "attachments"
  | "imports"
  | "import_history"
  | "exports"
  | "analytics"
  | "activity"
  | "settings"
  | "collection_settings"
  | "field_management"
  | "scoring_rules"
  | "data_management";

interface ToastMessage {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
}

export function CrmWorkspaceShell({
  initialSection = "dashboard",
  initialCollectionId,
  initialLeadId,
}: {
  initialSection?: NavSection;
  initialCollectionId?: string;
  initialLeadId?: string;
}) {
  const [activeNav, setActiveNav] = useState<NavSection>(initialSection);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(
    initialCollectionId
  );
  const [activeLeadProfileId, setActiveLeadProfileId] = useState<string | null>(
    initialLeadId || null
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Quick-Add Lead form
  const [qaName, setQaName] = useState("");
  const [qaWebsite, setQaWebsite] = useState("");
  const [qaCollectionId, setQaCollectionId] = useState("col_global_ecommerce");
  const [qaCountry, setQaCountry] = useState("India");
  const [qaIndustry, setQaIndustry] = useState("");
  const [qaNote, setQaNote] = useState("");

  // Settings form
  const [wsName, setWsName] = useState("Jayant Web & AI Systems");
  const [wsCurrency, setWsCurrency] = useState("INR");
  const [wsTimezone, setWsTimezone] = useState("Asia/Kolkata");
  const [storageStats, setStorageStats] = useState({
    leadCount: 200,
    collectionCount: 5,
    taskCount: 3,
    opportunityCount: 0,
    sizeKB: 0,
    lastSavedAt: "",
  });

  const notify = useCallback(
    (message: string, tone: "success" | "error" | "info" = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const loadWorkspace = useCallback(async () => {
    try {
      installLocalBrowserStorageInterceptor();
      const res = await fetch("/api/workspace");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setStorageStats(getLocalBrowserStorageStats());
        if (json.workspace) {
          setWsName(json.workspace.name || "Jayant Web & AI Systems");
          setWsCurrency(json.workspace.defaultCurrency || "INR");
          setWsTimezone(json.workspace.timezone || "Asia/Kolkata");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    installLocalBrowserStorageInterceptor();
    loadWorkspace();
    const onStorageUpdate = () => setStorageStats(getLocalBrowserStorageStats());
    window.addEventListener("jayant-crm-local-storage-updated", onStorageUpdate);
    return () => window.removeEventListener("jayant-crm-local-storage-updated", onStorageUpdate);
  }, [loadWorkspace]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Global keyboard shortcuts (Section 29.3)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        setCommandOpen(false);
        setQuickAddOpen(false);
        return;
      }

      if (!isTyping) {
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          setQuickAddOpen(true);
        } else if (e.key === "/") {
          e.preventDefault();
          setCommandOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleQuickAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qaName.trim()) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_lead",
        payload: {
          name: qaName.trim(),
          websiteUrl: qaWebsite.trim() || null,
          country: qaCountry.trim() || null,
          industry: qaIndustry.trim() || null,
          collectionIds: [qaCollectionId],
          initialNote: qaNote.trim() || undefined,
        },
      }),
    });
    const out = await res.json();
    if (res.ok) {
      setQaName("");
      setQaWebsite("");
      setQaIndustry("");
      setQaNote("");
      setQuickAddOpen(false);
      await loadWorkspace();
      notify(`Lead "${qaName.trim()}" added`, "success");
      if (out.id) setActiveLeadProfileId(out.id);
    }
  }

  async function handleToggleDashboardTask(taskId: string) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_task_status", payload: { id: taskId } }),
    });
    await loadWorkspace();
    notify("Task completed", "success");
  }

  function renderCollectionIcon(iconName: string) {
    switch (iconName) {
      case "ShoppingBag":
        return <ShoppingBag className="w-4 h-4" />;
      case "Globe":
        return <Globe className="w-4 h-4" />;
      case "GraduationCap":
        return <GraduationCap className="w-4 h-4" />;
      case "Bot":
        return <Bot className="w-4 h-4" />;
      case "Video":
        return <Video className="w-4 h-4" />;
      default:
        return <FolderKanban className="w-4 h-4" />;
    }
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-app-bg text-text-primary flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center mx-auto animate-pulse font-heading font-bold">
            JC
          </div>
          <div className="text-sm font-heading font-semibold">
            Loading JAYANT CRM Workspace...
          </div>
          <div className="text-xs font-mono text-text-muted">
            Initializing Local Browser Storage workspace
          </div>
        </div>
      </div>
    );
  }

  const organizations = data.organizations || [];
  const collections = data.collections || [];
  const stages = data.pipelineStages || [];
  const opportunities = data.opportunities || [];
  const tasks = data.tasks || [];
  const activities = data.activities || [];
  const references = data.references || [];
  const contentIdeas = data.contentIdeas || [];
  const contacts = data.contacts || [];
  const suppressions = data.suppressions || [];
  const importBatches = data.importBatches || [];
  const fieldDefinitions = data.fieldDefinitions || [];
  const categories = data.categories || [];
  const savedViews = data.savedViews || [];
  const savedMappings = data.savedMappings || [];

  // Dashboard Metrics (Section 6.2 — 100% live counts from Local Browser Storage)
  const todayStr = new Date().toISOString().split("T")[0];
  const totalLeadsCount = organizations.length;
  const indiaLeadsCount = organizations.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (o: any) =>
      (o.market || "").toLowerCase() === "india" ||
      (o.country || "").toLowerCase() === "india"
  ).length;
  const intlLeadsCount = Math.max(0, totalLeadsCount - indiaLeadsCount);
  const highPriorityLeadsCount = organizations.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (o: any) => o.score !== null && o.score >= 75
  ).length;
  const siteDescriptionLeadsCount = organizations.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (o: any) => (o.verificationLevel || "").toLowerCase().includes("site")
  ).length;
  const directoryOnlyLeadsCount = organizations.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (o: any) => (o.verificationLevel || "").toLowerCase().includes("directory")
  ).length;
  const flaggedEvidenceLeadsCount = organizations.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (o: any) => o.contactEvidenceValid === false
  ).length;
  const followUpsDueCount = tasks.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => t.status !== "Completed" && t.dueDate <= todayStr
  ).length;
  const overdueTasksCount = tasks.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => t.status !== "Completed" && t.dueDate < todayStr
  ).length;
  const confirmedPipelineValue = opportunities.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, opp: any) =>
      opp.estimatedValue && opp.outcome !== "lost"
        ? sum + Number(opp.estimatedValue)
        : sum,
    0
  );

  // Command palette filtered items
  const cmdQueryLower = commandQuery.trim().toLowerCase();
  const cmdLeads = cmdQueryLower
    ? organizations
        .filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (o: any) =>
            o.name.toLowerCase().includes(cmdQueryLower) ||
            (o.normalizedDomain || "").toLowerCase().includes(cmdQueryLower) ||
            (o.externalId || "").toLowerCase().includes(cmdQueryLower)
        )
        .slice(0, 6)
    : organizations.slice(0, 4);

  return (
    <div className="min-h-screen bg-app-bg text-text-primary flex">
      {/* LEFT SIDEBAR NAVIGATION (Section 5) */}
      <aside
        className={`${
          sidebarCollapsed ? "w-16" : "w-60"
        } shrink-0 bg-app-sidebar border-r border-app-border flex flex-col justify-between transition-all duration-150 select-none`}
      >
        <div className="p-3 space-y-5 overflow-y-auto flex-1">
          {/* Brand Logo Header */}
          <div className="flex items-center justify-between px-1.5 pt-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-accent text-white font-heading font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                JC
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <div className="font-heading font-bold text-sm text-text-primary leading-tight">
                    JAYANT CRM
                  </div>
                  <div className="text-[10px] font-mono text-text-muted truncate">
                    Jayant Web &amp; AI Systems
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label="Toggle sidebar"
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-app-surface"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* WORKSPACE */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-2.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Workspace
              </div>
            )}
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              {
                id: "leads",
                label: "All Leads",
                icon: Database,
                badge: totalLeadsCount,
              },
              { id: "companies", label: "Companies", icon: Building2 },
              { id: "contacts", label: "Contacts", icon: Users, badge: contacts.length },
              {
                id: "collections",
                label: "My Collections",
                icon: FolderKanban,
                badge: collections.length,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive =
                activeNav === item.id &&
                !(item.id === "leads" && selectedCollectionId);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === "leads" || item.id === "companies") {
                      setSelectedCollectionId(undefined);
                    }
                    setActiveNav(item.id as NavSection);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-app-surface"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!sidebarCollapsed && item.badge !== undefined && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-app-surface text-text-muted"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* PINNED COLLECTIONS IN SIDEBAR */}
          {!sidebarCollapsed && collections.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-text-muted">
                <span>Collections</span>
                <button
                  type="button"
                  onClick={() => setActiveNav("collection_settings")}
                  className="text-accent hover:underline"
                >
                  + New
                </button>
              </div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {collections.map((col: any) => {
                const isSelected =
                  activeNav === "collection_detail" && selectedCollectionId === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => {
                      setSelectedCollectionId(col.id);
                      setActiveNav("collection_detail");
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                      isSelected
                        ? "bg-accent/20 text-accent font-semibold"
                        : "text-text-secondary hover:text-text-primary hover:bg-app-surface"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: col.color || "#7958F5" }}
                      />
                      <span className="truncate">{col.name}</span>
                    </span>
                    <span className="font-mono text-[10px] text-text-muted">
                      {col.leadCount || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* WORKFLOWS */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-2.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Workflows
              </div>
            )}
            {[
              { id: "pipelines", label: "Pipelines", icon: Columns },
              { id: "tasks", label: "Tasks", icon: CheckSquare },
              {
                id: "followups",
                label: "Follow-ups",
                icon: Clock,
                alertBadge: followUpsDueCount,
              },
              { id: "calendar", label: "Calendar", icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id as NavSection)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text-primary hover:bg-app-surface"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </span>
                  {!sidebarCollapsed &&
                    item.alertBadge !== undefined &&
                    item.alertBadge > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-status-error text-white font-mono text-[10px] font-bold">
                        {item.alertBadge}
                      </span>
                    )}
                </button>
              );
            })}
          </div>

          {/* LIBRARY */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-2.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Library &amp; Bookmarks
              </div>
            )}
            {[
              {
                id: "references",
                label: "Design Inspirations",
                icon: Bookmark,
                badge: references.length,
              },
              { id: "content", label: "Content Ideas", icon: Video },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id as NavSection)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text-primary hover:bg-app-surface"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!sidebarCollapsed && item.badge !== undefined && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-app-surface text-text-muted"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* DATA & INSIGHTS & SYSTEM */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-2.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Data &amp; System
              </div>
            )}
            {[
              { id: "imports", label: "Import Center", icon: Upload },
              { id: "import_history", label: "Import History", icon: History },
              { id: "exports", label: "Export Center", icon: Download },
              { id: "analytics", label: "Analytics", icon: BarChart3 },
              { id: "activity", label: "Activity History", icon: Activity },
              { id: "collection_settings", label: "Collection & Fields", icon: Sliders },
              { id: "settings", label: "Workspace Settings", icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id as NavSection)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text-primary hover:bg-app-surface"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom User Profile Pill (Matches Mockup 1) */}
        <div className="p-3 border-t border-app-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 text-accent font-heading font-bold text-xs flex items-center justify-center shrink-0">
              JO
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <div className="text-xs font-semibold text-text-primary truncate">
                  Jayant Olhyan
                </div>
                <div className="text-[10px] text-text-muted truncate">Founder</div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <a
              href="/login"
              title="Account & Sign In"
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-app-surface"
            >
              <LogOut className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Header */}
        <header className="h-14 border-b border-app-border bg-app-sidebar/60 px-6 flex items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="w-full max-w-md flex items-center justify-between px-3 py-1.5 rounded-lg bg-app-surface border border-app-border text-xs text-text-muted hover:border-text-muted transition"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              Search leads, companies, contacts, or run action...
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-app-secondary border border-app-border font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveNav("settings")}
              title={`All CRM data & analytics run on your Local Browser Storage (${LOCAL_STORAGE_DB_KEY})`}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-status-success/10 border border-status-success/30 text-[11px] font-mono text-status-success hover:bg-status-success/20 transition"
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                Browser Storage: {storageStats.leadCount} Leads ({storageStats.sizeKB} KB)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("imports")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              <Upload className="w-3.5 h-3.5 text-accent" />
              Import .XLSX
            </button>

            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Lead
            </button>

            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Switch color theme"
              className="p-2 rounded-lg bg-app-surface hover:bg-app-elevated border border-app-border text-text-secondary hover:text-text-primary"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
          {/* =================================================================
              SECTION 1: DASHBOARD (Section 6 & Mockup 1)
              ================================================================= */}
          {activeNav === "dashboard" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-heading font-bold text-text-primary">
                    Good evening, Jayant
                  </h1>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Here&apos;s your live CRM intelligence &amp; relationship overview across{" "}
                    <strong>{wsName}</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-app-surface border border-app-border text-text-secondary">
                    Ledger Integrity: <strong className="text-status-success">Verified</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollectionId("col_global_ecommerce");
                      setActiveNav("collection_detail");
                    }}
                    className="px-3 py-1 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 font-sans font-medium tabular-nums"
                  >
                    Open Global E-Commerce Ledger ({totalLeadsCount}) →
                  </button>
                </div>
              </div>

              {/* 4 Primary KPI Cards matching Mockup 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => {
                    setSelectedCollectionId(undefined);
                    setActiveNav("leads");
                  }}
                  className="bg-app-surface hover:bg-app-secondary border border-app-border rounded-xl p-4 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-medium text-text-secondary">Total Leads</div>
                    <div className="text-2xl font-heading font-bold text-text-primary tabular-nums mt-1">
                      {totalLeadsCount}
                    </div>
                    <div className="text-[11px] font-sans text-status-info tabular-nums mt-1">
                      {indiaLeadsCount} India • {intlLeadsCount} International
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-status-info/15 text-status-info flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setSelectedCollectionId(undefined);
                    setActiveNav("leads");
                  }}
                  className="bg-app-surface hover:bg-app-secondary border border-app-border rounded-xl p-4 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-medium text-text-secondary">
                      Needs Verification / Action
                    </div>
                    <div className="text-2xl font-heading font-bold text-status-warning tabular-nums mt-1">
                      {directoryOnlyLeadsCount + flaggedEvidenceLeadsCount}
                    </div>
                    <div className="text-[11px] font-sans text-text-muted tabular-nums mt-1">
                      {directoryOnlyLeadsCount} directory-only • {highPriorityLeadsCount} scored high
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-status-warning/15 text-status-warning flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveNav("followups")}
                  className="bg-app-surface hover:bg-app-secondary border border-app-border rounded-xl p-4 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-medium text-text-secondary">Follow-ups Due</div>
                    <div className="text-2xl font-heading font-bold text-status-error tabular-nums mt-1">
                      {followUpsDueCount}
                    </div>
                    <div className="text-[11px] font-sans text-text-muted tabular-nums mt-1">
                      {overdueTasksCount} overdue • {tasks.length} total tasks
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-status-error/15 text-status-error flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveNav("pipelines")}
                  className="bg-app-surface hover:bg-app-secondary border border-app-border rounded-xl p-4 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-medium text-text-secondary">Pipeline Value</div>
                    <div className="text-2xl font-heading font-bold text-status-success tabular-nums mt-1">
                      ₹{(confirmedPipelineValue / 100000).toFixed(2)}L
                    </div>
                    <div className="text-[11px] font-sans text-text-muted tabular-nums mt-1">
                      {opportunities.length} open opportunities
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-status-success/15 text-status-success flex items-center justify-center">
                    <Columns className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Middle Row: Today's Priorities & Pipeline / Collections Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Today's Priorities (Complete tasks directly from dashboard per Section 6.3) */}
                <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-heading font-semibold text-text-primary">
                        Today&apos;s Priorities &amp; Follow-up Queue
                      </h2>
                      <p className="text-xs text-text-secondary">
                        Complete tasks directly or click a company to open its profile.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav("tasks")}
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      View All Tasks →
                    </button>
                  </div>

                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {tasks.filter((t: any) => t.status !== "Completed").length === 0 ? (
                    <div className="p-6 rounded-lg bg-app-secondary/50 border border-app-border text-center text-xs text-text-muted">
                      No open follow-up tasks scheduled yet. Create tasks from any lead profile or the{" "}
                      <button
                        type="button"
                        onClick={() => setActiveNav("tasks")}
                        className="text-accent hover:underline font-medium"
                      >
                        Tasks
                      </button>{" "}
                      view.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .filter((t: any) => t.status !== "Completed")
                        .slice(0, 5)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .map((t: any) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const org = organizations.find((o: any) => o.id === t.organizationId);
                          const isOverdue = t.dueDate < todayStr;
                          return (
                            <div
                              key={t.id}
                              className="p-3 rounded-lg bg-app-secondary border border-app-border flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={t.status === "Completed"}
                                  onChange={() => handleToggleDashboardTask(t.id)}
                                  aria-label={`Complete task ${t.title}`}
                                />
                                <div className="truncate">
                                  <div className="font-medium text-text-primary truncate">
                                    {t.title}
                                  </div>
                                  {org && (
                                    <button
                                      type="button"
                                      onClick={() => setActiveLeadProfileId(org.id)}
                                      className="text-[11px] text-accent hover:underline"
                                    >
                                      {org.name} ({org.country})
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border font-sans text-[10px] font-medium text-text-secondary">
                                  {t.taskType}
                                </span>
                                <span
                                  className={`font-mono text-[11px] tabular-nums ${
                                    isOverdue
                                      ? "text-status-error font-semibold"
                                      : "text-status-warning"
                                  }`}
                                >
                                  {isOverdue ? `Overdue (${t.dueDate})` : t.dueTime || t.dueDate}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Leads by Collection & Ledger Status */}
                <div className="bg-app-surface border border-app-border rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <h2 className="text-sm font-heading font-semibold text-text-primary">
                      Leads by Collection
                    </h2>
                    <div className="space-y-2.5 mt-3">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {collections.map((c: any) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCollectionId(c.id);
                            setActiveNav("collection_detail");
                          }}
                          className="p-2.5 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border flex items-center justify-between cursor-pointer text-xs transition"
                        >
                          <span className="flex items-center gap-2 font-medium text-text-primary">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: c.color }}
                            />
                            {c.name}
                          </span>
                          <span className="font-sans font-semibold tabular-nums text-text-secondary">
                            {c.leadCount || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-app-secondary border border-app-border text-xs space-y-1">
                    <div className="font-mono text-[10px] uppercase text-accent">
                      Ledger Governance Summary
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Site Description Verified:</span>
                      <strong className="font-heading tabular-nums text-status-success">
                        {siteDescriptionLeadsCount}
                      </strong>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Directory-Only Unresolved:</span>
                      <strong className="font-heading tabular-nums text-status-warning">
                        {directoryOnlyLeadsCount}
                      </strong>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Flagged URL Anomalies:</span>
                      <strong className="font-heading tabular-nums text-status-error">
                        {flaggedEvidenceLeadsCount}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Recent Activity & Recently Updated Leads */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-heading font-semibold text-text-primary">
                      Recent Activity
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveNav("activity")}
                      className="text-xs text-accent hover:underline"
                    >
                      All History
                    </button>
                  </div>
                  {activities.length === 0 ? (
                    <div className="p-5 rounded-lg bg-app-secondary/50 border border-app-border text-center text-xs text-text-muted">
                      No activity recorded yet. Import a spreadsheet or add a lead to start tracking activity.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {activities.slice(0, 6).map((act: any) => (
                        <div
                          key={act.id}
                          className="text-xs border-l-2 border-accent pl-3 py-0.5 space-y-0.5"
                        >
                          <div className="font-medium text-text-primary">{act.title}</div>
                          <div className="font-mono text-[10px] text-text-muted tabular-nums">
                            {act.actorOrigin.toUpperCase()} •{" "}
                            {new Date(act.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-heading font-semibold text-text-primary">
                      Recently Updated Leads
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCollectionId(undefined);
                        setActiveNav("leads");
                      }}
                      className="text-xs text-accent hover:underline"
                    >
                      Open Lead Database →
                    </button>
                  </div>

                  {organizations.length === 0 ? (
                    <div className="p-6 rounded-lg bg-app-secondary/50 border border-app-border text-center space-y-3">
                      <div className="text-xs text-text-secondary">
                        Your Local Browser Storage contains <strong>0 leads</strong> (no dummy data). Upload your Excel/CSV spreadsheet or add a lead manually to begin.
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveNav("imports")}
                          className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
                        >
                          Upload .XLSX / .CSV Spreadsheet
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickAddOpen(true)}
                          className="px-3.5 py-1.5 rounded-lg bg-app-surface hover:bg-app-elevated border border-app-border text-text-primary text-xs font-medium"
                        >
                          + Add Lead Manually
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-app-secondary text-text-muted font-sans font-semibold uppercase text-[11px]">
                          <tr>
                            <th className="py-2 px-3">Company</th>
                            <th className="py-2 px-3">Market / Country</th>
                            <th className="py-2 px-3">Niche</th>
                            <th className="py-2 px-3">Verification</th>
                            <th className="py-2 px-3">Outreach Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {organizations.slice(0, 6).map((o: any) => (
                            <tr
                              key={o.id}
                              onClick={() => setActiveLeadProfileId(o.id)}
                              className="hover:bg-app-secondary/60 cursor-pointer"
                            >
                              <td className="py-2 px-3 font-medium text-text-primary">
                                {o.name}
                              </td>
                              <td className="py-2 px-3 text-text-secondary">
                                {o.country} ({o.market})
                              </td>
                              <td className="py-2 px-3 text-text-secondary">{o.industry}</td>
                              <td className="py-2 px-3 font-sans text-[11px]">
                                <span
                                  className={
                                    (o.verificationLevel || "").includes("directory")
                                      ? "text-status-warning font-medium"
                                      : "text-status-success font-medium"
                                  }
                                >
                                  {o.verificationLevel}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-text-muted">
                                {o.outreachApproval}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              SECTION 2: ALL LEADS / COMPANIES / COLLECTION DETAIL TABLE
              ================================================================= */}
          {(activeNav === "leads" ||
            activeNav === "companies" ||
            activeNav === "collection_detail") && (
            <LeadsDatabaseView
              collectionId={
                activeNav === "collection_detail" ? selectedCollectionId : undefined
              }
              collections={collections}
              stages={stages}
              categories={categories}
              savedViews={savedViews}
              onOpenLead={(id) => setActiveLeadProfileId(id)}
              onOpenQuickAdd={() => setQuickAddOpen(true)}
              onMutated={loadWorkspace}
              notify={notify}
            />
          )}

          {/* =================================================================
              SECTION 3: MY COLLECTIONS GRID (Section 7 & Mockup 2)
              ================================================================= */}
          {activeNav === "collections" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-app-border pb-4">
                <div>
                  <h1 className="text-xl font-heading font-bold text-text-primary">
                    My Collections
                  </h1>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Organize your leads into custom collections with dedicated fields, categories, and scoring rules.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav("collection_settings")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  + New Collection / Schema
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {collections.map((col: any) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const colCats = categories.filter((c: any) => c.collectionId === col.id);
                  return (
                    <div
                      key={col.id}
                      className="bg-app-surface hover:bg-app-secondary/80 border border-app-border rounded-xl p-5 flex flex-col justify-between transition group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                            style={{ backgroundColor: col.color || "#7958F5" }}
                          >
                            {renderCollectionIcon(col.icon)}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCollectionId(col.id);
                              setActiveNav("collection_settings");
                            }}
                            className="text-xs text-text-muted hover:text-text-primary"
                          >
                            Configure
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCollectionId(col.id);
                            setActiveNav("collection_detail");
                          }}
                          className="mt-4 text-left block"
                        >
                          <h2 className="text-base font-heading font-bold text-text-primary group-hover:text-accent transition">
                            {col.name}
                          </h2>
                          <div className="text-xs font-sans text-text-secondary tabular-nums mt-0.5">
                            {col.leadCount || 0} leads • Default view: {col.defaultView}
                          </div>
                        </button>

                        <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                          {col.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-app-border">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {colCats.slice(0, 4).map((c: any) => (
                          <span
                            key={c.id}
                            className="px-2 py-0.5 rounded bg-app-secondary border border-app-border text-[10px] font-mono text-text-secondary"
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              SECTION 4: PIPELINES KANBAN
              ================================================================= */}
          {activeNav === "pipelines" && (
            <PipelineKanbanView
              stages={stages}
              opportunities={opportunities}
              organizations={organizations}
              onOpenLead={(id) => setActiveLeadProfileId(id)}
              onMutated={loadWorkspace}
              notify={notify}
            />
          )}

          {/* =================================================================
              SECTION 5: TASKS, FOLLOW-UPS & CALENDAR
              ================================================================= */}
          {(activeNav === "tasks" ||
            activeNav === "followups" ||
            activeNav === "calendar") && (
            <TasksAndFollowUpsView
              tasks={tasks}
              organizations={organizations}
              initialMode={activeNav}
              onOpenLead={(id) => setActiveLeadProfileId(id)}
              onMutated={loadWorkspace}
              notify={notify}
            />
          )}

          {/* =================================================================
              SECTION 6: CONTACTS & DO NOT CONTACT SUPPRESSION
              ================================================================= */}
          {activeNav === "contacts" && (
            <ContactsAndSuppressionView
              contacts={contacts}
              suppressions={suppressions}
              organizations={organizations}
              onOpenLead={(id) => setActiveLeadProfileId(id)}
              onMutated={loadWorkspace}
              notify={notify}
            />
          )}

          {/* =================================================================
              SECTION 7: REFERENCES & CONTENT IDEAS
              ================================================================= */}
          {(activeNav === "references" ||
            activeNav === "content" ||
            activeNav === "attachments") && (
            <ReferencesAndContentView
              references={references}
              contentIdeas={contentIdeas}
              organizations={organizations}
              initialTab={activeNav === "content" ? "content" : "references"}
              onOpenLead={(id) => setActiveLeadProfileId(id)}
              onMutated={loadWorkspace}
              notify={notify}
            />
          )}

          {/* =================================================================
              SECTION 8: IMPORT CENTER / HISTORY / EXPORTS
              ================================================================= */}
          {(activeNav === "imports" ||
            activeNav === "import_history" ||
            activeNav === "exports") && (
            <ImportCenterView
              collections={collections}
              importBatches={importBatches}
              customFields={fieldDefinitions}
              savedMappings={savedMappings}
              initialSubTab={
                activeNav === "import_history"
                  ? "history"
                  : activeNav === "exports"
                  ? "export"
                  : "wizard"
              }
              onImportComplete={async (colId) => {
                await loadWorkspace();
                if (colId) setSelectedCollectionId(colId);
              }}
              notify={notify}
            />
          )}

          {/* =================================================================
              SECTION 9: ANALYTICS & ACTIVITY HISTORY
              ================================================================= */}
          {(activeNav === "analytics" || activeNav === "activity") && (
            <AnalyticsAndActivityView
              organizations={organizations}
              collections={collections}
              stages={stages}
              opportunities={opportunities}
              importBatches={importBatches}
              activities={activities}
              initialMode={activeNav}
            />
          )}

          {/* =================================================================
              SECTION 10: COLLECTION SETTINGS, CUSTOM FIELDS & SCORING RULES
              ================================================================= */}
          {(activeNav === "collection_settings" ||
            activeNav === "field_management" ||
            activeNav === "scoring_rules") && (
            <CollectionSettingsView
              collections={collections}
              categories={categories}
              fieldDefinitions={fieldDefinitions}
              stages={stages}
              savedViews={savedViews}
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={(id) => setSelectedCollectionId(id)}
              onMutated={loadWorkspace}
              notify={notify}
            />
          )}

          {/* =================================================================
              SECTION 11: WORKSPACE SETTINGS & DATA MANAGEMENT (Section 30)
              ================================================================= */}
          {(activeNav === "settings" || activeNav === "data_management") && (
            <div className="space-y-6 max-w-3xl">
              <div className="border-b border-app-border pb-4">
                <h1 className="text-xl font-heading font-bold text-text-primary">
                  Workspace Settings &amp; Data Governance
                </h1>
                <p className="text-xs text-text-secondary mt-0.5">
                  Configure workspace defaults, timezone, appearance, and database recovery controls.
                </p>
              </div>

              <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-heading font-semibold text-text-primary">
                  General Workspace Preferences
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-text-secondary mb-1">Workspace Name</label>
                    <input
                      type="text"
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary mb-1">Default Currency</label>
                    <select
                      value={wsCurrency}
                      onChange={(e) => setWsCurrency(e.target.value)}
                      className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-text-secondary mb-1">Default Timezone</label>
                    <select
                      value={wsTimezone}
                      onChange={(e) => setWsTimezone(e.target.value)}
                      className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Europe/London">Europe/London</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/workspace", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "update_workspace_settings",
                        payload: {
                          name: wsName,
                          defaultCurrency: wsCurrency,
                          timezone: wsTimezone,
                          theme,
                        },
                      }),
                    });
                    await loadWorkspace();
                    notify("Workspace settings saved", "success");
                  }}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold"
                >
                  Save Settings
                </button>
              </div>

              <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2">
                      <Database className="w-4 h-4 text-status-success" />
                      Local Browser Storage Engine (`localStorage` + `IndexedDB`)
                    </h2>
                    <p className="text-xs text-text-secondary mt-0.5">
                      100% of your leads, collections, custom fields, scores, notes, tasks, opportunities, spreadsheet imports, and analytics run and persist directly in your local browser storage (`{LOCAL_STORAGE_DB_KEY}`).
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-status-success/15 text-status-success font-mono text-[11px] font-semibold">
                    Active • {storageStats.sizeKB} KB Used
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                    <span className="text-text-muted block">Stored Leads</span>
                    <strong className="font-mono text-base text-text-primary">
                      {storageStats.leadCount}
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                    <span className="text-text-muted block">Collections</span>
                    <strong className="font-mono text-base text-text-primary">
                      {storageStats.collectionCount}
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                    <span className="text-text-muted block">Tasks &amp; Follow-ups</span>
                    <strong className="font-mono text-base text-text-primary">
                      {storageStats.taskCount}
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                    <span className="text-text-muted block">Opportunities</span>
                    <strong className="font-mono text-base text-text-primary">
                      {storageStats.opportunityCount}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/workspace", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "reset_to_empty_workspace" }),
                      });
                      await loadWorkspace();
                      notify("Local Browser Storage reset to 0 leads", "info");
                    }}
                    className="px-4 py-2 rounded-lg bg-status-error/15 text-status-error border border-status-error/30 text-xs font-semibold"
                  >
                    Clear Browser Storage (0 Leads)
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerLocalBrowserFileDownload("workspace_backup_json")}
                    className="px-4 py-2 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border text-text-primary text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-accent" />
                    Export Browser Storage (.JSON)
                  </button>

                  <label className="px-4 py-2 rounded-lg bg-app-secondary hover:bg-app-elevated border border-app-border text-text-primary text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-accent" />
                    Restore JSON Backup to Browser Storage
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const parsed = JSON.parse(text);
                          const res = await fetch("/api/workspace", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "restore_json_backup",
                              payload: { backupData: parsed },
                            }),
                          });
                          if (res.ok) {
                            await loadWorkspace();
                            notify("Restored JSON backup into Local Browser Storage", "success");
                          } else {
                            notify("Invalid backup JSON file", "error");
                          }
                        } catch {
                          notify("Failed to parse JSON backup file", "error");
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* LEAD PROFILE MODAL / DRAWER */}
      {activeLeadProfileId && (
        <LeadProfileModal
          organizationId={activeLeadProfileId}
          allOrganizationIds={organizations.map((o: { id: string }) => o.id)}
          onSelectOrganization={(id) => setActiveLeadProfileId(id)}
          collections={collections}
          stages={stages}
          fieldDefinitions={fieldDefinitions}
          onClose={() => setActiveLeadProfileId(null)}
          onMutated={loadWorkspace}
          notify={notify}
        />
      )}

      {/* QUICK-ADD LEAD MODAL (Shortcut: N) */}
      {quickAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleQuickAddSubmit}
            className="w-full max-w-md bg-app-surface border border-app-border rounded-xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-heading font-bold text-text-primary">
                Quick-Add Lead
              </h2>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">
                  Company / Record Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Studio Oak Craft"
                  value={qaName}
                  onChange={(e) => setQaName(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Website</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={qaWebsite}
                  onChange={(e) => setQaWebsite(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">Collection</label>
                  <select
                    value={qaCollectionId}
                    onChange={(e) => setQaCollectionId(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-2.5 py-2 text-text-primary"
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {collections.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Country</label>
                  <input
                    type="text"
                    value={qaCountry}
                    onChange={(e) => setQaCountry(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Category / Niche</label>
                <input
                  type="text"
                  placeholder="e.g. Home & Furniture, D2C Brand"
                  value={qaIndustry}
                  onChange={(e) => setQaIndustry(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Initial Note</label>
                <textarea
                  rows={2}
                  placeholder="Initial site observation or research note..."
                  value={qaNote}
                  onChange={(e) => setQaNote(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg p-2.5 text-text-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-app-border">
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="px-4 py-2 rounded-lg bg-app-secondary text-text-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold"
              >
                Save Lead
              </button>
            </div>
          </form>
        </div>
      )}

      {/* COMMAND PALETTE (Cmd/Ctrl + K — Matches Mockup 12) */}
      {commandOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
          <div className="w-full max-w-xl bg-app-surface border border-app-border rounded-xl overflow-hidden shadow-2xl">
            <div className="p-3.5 border-b border-app-border flex items-center gap-3">
              <Search className="w-4 h-4 text-accent" />
              <input
                type="text"
                autoFocus
                placeholder="Search leads, domains, Lead IDs, or execute command..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-text-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="text-xs font-mono text-text-muted px-1.5 py-0.5 rounded bg-app-secondary"
              >
                ESC
              </button>
            </div>

            <div className="p-3 max-h-96 overflow-y-auto space-y-4 text-xs">
              <div>
                <div className="px-2 text-[10px] font-mono uppercase text-text-muted mb-1">
                  Quick Actions
                </div>
                <div className="space-y-1">
                  {[
                    {
                      label: "Add a new lead",
                      shortcut: "N",
                      action: () => {
                        setCommandOpen(false);
                        setQuickAddOpen(true);
                      },
                    },
                    {
                      label: "Import spreadsheet (.XLSX / .CSV)",
                      shortcut: "I",
                      action: () => {
                        setCommandOpen(false);
                        setActiveNav("imports");
                      },
                    },
                    {
                      label: "Create or configure collection",
                      shortcut: "C",
                      action: () => {
                        setCommandOpen(false);
                        setActiveNav("collection_settings");
                      },
                    },
                    {
                      label: "Open follow-ups due today",
                      shortcut: "F",
                      action: () => {
                        setCommandOpen(false);
                        setActiveNav("followups");
                      },
                    },
                    {
                      label: "Switch Dark / Light Theme",
                      shortcut: "T",
                      action: () => {
                        setTheme(theme === "dark" ? "light" : "dark");
                        setCommandOpen(false);
                      },
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-app-secondary text-text-primary"
                    >
                      <span>{item.label}</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-app-secondary border border-app-border font-mono text-[10px] text-text-muted">
                        {item.shortcut}
                      </kbd>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="px-2 text-[10px] font-mono uppercase text-text-muted mb-1">
                  Matching Leads ({cmdLeads.length})
                </div>
                <div className="space-y-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {cmdLeads.map((o: any) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setCommandOpen(false);
                        setActiveLeadProfileId(o.id);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-app-secondary text-left"
                    >
                      <div>
                        <span className="font-semibold text-text-primary">{o.name}</span>
                        <span className="ml-2 font-mono text-text-muted">
                          {o.normalizedDomain || o.externalId}
                        </span>
                      </div>
                      <span className="text-text-secondary">{o.country}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESTRAINED TOAST NOTIFICATIONS (Section 29.4) */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl border shadow-lg text-xs font-medium flex items-center gap-2 ${
              t.tone === "success"
                ? "bg-app-surface border-status-success/40 text-status-success"
                : t.tone === "error"
                ? "bg-app-surface border-status-error/40 text-status-error"
                : "bg-app-surface border-app-border text-text-primary"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
