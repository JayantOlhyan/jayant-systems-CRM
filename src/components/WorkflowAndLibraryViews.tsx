"use client";

import React, { useState } from "react";
import {
  Plus,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Video,
  Bookmark,
  ShieldAlert,
  TrendingUp,
  BarChart3,
  Globe,
  Search,
  Layers,
  UserCheck,
  ArrowUpRight,
  Send,
  MessageSquare,
  Upload,
  Trash2,
  X,
} from "lucide-react";

/* ============================================================================
   1. PIPELINES & OPPORTUNITIES KANBAN VIEW (Section 15)
   ============================================================================ */
interface PipelineKanbanProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stages: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opportunities: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organizations: any[];
  onOpenLead: (id: string) => void;
  onMutated: () => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function PipelineKanbanView({
  stages,
  opportunities,
  organizations,
  onOpenLead,
  onMutated,
  notify,
}: PipelineKanbanProps) {
  const [boardMode, setBoardMode] = useState<"opportunities" | "leads">("leads");
  const [search, setSearch] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [showAddOpp, setShowAddOpp] = useState(false);

  const [oppOrgId, setOppOrgId] = useState(organizations[0]?.id || "");
  const [oppName, setOppName] = useState("");
  const [oppService, setOppService] = useState("Website Redesign & Optimization");
  const [oppStage, setOppStage] = useState(stages[0]?.id || "stg_new");
  const [oppVal, setOppVal] = useState("");
  const [oppPriority, setOppPriority] = useState("high");
  const [oppNextAction, setOppNextAction] = useState("");

  const orgMap = new Map(organizations.map((o) => [o.id, o]));

  // Calculate real pipeline value only from non-null opportunity values (Section 6.2)
  const confirmedTotalValue = opportunities.reduce((sum, opp) => {
    if (
      opp.estimatedValue !== null &&
      opp.estimatedValue !== undefined &&
      opp.estimatedValue !== "" &&
      opp.outcome !== "lost"
    ) {
      return sum + Number(opp.estimatedValue);
    }
    return sum;
  }, 0);

  const unknownValueCount = opportunities.filter(
    (opp) => opp.estimatedValue === null || opp.estimatedValue === undefined || opp.estimatedValue === ""
  ).length;

  async function handleMoveItem(itemId: string, targetStageId: string) {
    if (boardMode === "opportunities") {
      await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_opportunity",
          payload: { id: itemId, stageId: targetStageId },
        }),
      });
    } else {
      await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "inline_update_lead",
          payload: { id: itemId, updates: { primaryStageId: targetStageId } },
        }),
      });
    }
    await onMutated();
    notify("Pipeline stage updated and logged", "success");
  }

  async function handleBlockMessageStatus(
    orgId: string,
    orgName: string,
    messageStatus: "not_messaged" | "message_sent" | "followup_sent" | "replied",
    e?: React.MouseEvent
  ) {
    if (e) e.stopPropagation();
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_message_operation",
        payload: { organizationId: orgId, messageStatus, channel: "Pipeline Outreach" },
      }),
    });
    if (res.ok) {
      await onMutated();
      const labels: Record<string, string> = {
        not_messaged: `Reset ${orgName} to Not Messaged`,
        message_sent: `Marked Message Sent to ${orgName}`,
        followup_sent: `Marked Follow-up Sent to ${orgName}`,
        replied: `Marked ${orgName} as Replied`,
      };
      notify(labels[messageStatus] || "Message status updated", "success");
    }
  }

  async function handleBlockBookmark(orgId: string, orgName: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_bookmark_inspiration",
        payload: { organizationId: orgId },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      await onMutated();
      notify(
        data.isBookmarked
          ? `Bookmarked ${orgName} website to Design Inspirations`
          : `Removed ${orgName} from Design Inspirations`,
        data.isBookmarked ? "success" : "info"
      );
    }
  }

  async function handleCreateOpp(e: React.FormEvent) {
    e.preventDefault();
    if (!oppName.trim() || !oppOrgId) return;
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_opportunity",
        payload: {
          organizationId: oppOrgId,
          name: oppName.trim(),
          serviceType: oppService,
          stageId: oppStage,
          estimatedValue: oppVal === "" ? null : oppVal,
          priority: oppPriority,
          nextAction: oppNextAction || null,
        },
      }),
    });
    if (res.ok) {
      setShowAddOpp(false);
      setOppName("");
      setOppVal("");
      setOppNextAction("");
      await onMutated();
      notify("Opportunity added to pipeline", "success");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-app-border pb-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">
            Sales &amp; Qualification Pipeline
          </h1>
          <p className="text-xs text-text-secondary font-mono mt-0.5">
            {opportunities.length} Opportunities • Confirmed Value: ₹
            {confirmedTotalValue.toLocaleString("en-IN")}{" "}
            {unknownValueCount > 0 && `(${unknownValueCount} with unestimated/unknown value)`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search pipeline..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-app-surface border border-app-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary"
            />
          </div>

          <div className="flex items-center bg-app-surface p-1 rounded-lg border border-app-border text-xs">
            <button
              type="button"
              onClick={() => setBoardMode("leads")}
              className={`px-3 py-1 rounded-md font-medium ${
                boardMode === "leads"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              All Leads ({organizations.length})
            </button>
            <button
              type="button"
              onClick={() => setBoardMode("opportunities")}
              className={`px-3 py-1 rounded-md font-medium ${
                boardMode === "opportunities"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Opportunities ({opportunities.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddOpp(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            + Add Opportunity
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stg) => {
          const items =
            boardMode === "opportunities"
              ? opportunities.filter((opp) => {
                  if (opp.stageId !== stg.id) return false;
                  if (!search.trim()) return true;
                  const org = orgMap.get(opp.organizationId);
                  const q = search.toLowerCase();
                  return (
                    opp.name.toLowerCase().includes(q) ||
                    (org?.name || "").toLowerCase().includes(q)
                  );
                })
              : organizations
                  .filter((o) => {
                    if ((o.primaryStageId || "stg_new") !== stg.id) return false;
                    if (!search.trim()) return true;
                    return o.name.toLowerCase().includes(search.toLowerCase());
                  })
                  .slice(0, 60);

          const stageConfirmedVal =
            boardMode === "opportunities"
              ? items.reduce((s, item) => {
                  return item.estimatedValue ? s + Number(item.estimatedValue) : s;
                }, 0)
              : 0;

          return (
            <div
              key={stg.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedItemId) {
                  handleMoveItem(draggedItemId, stg.id);
                  setDraggedItemId(null);
                }
              }}
              className="w-72 shrink-0 bg-app-surface border border-app-border rounded-xl p-3 flex flex-col min-h-[520px] max-h-[680px]"
            >
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-app-border">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: stg.color }}
                  />
                  <span className="font-heading font-semibold text-xs text-text-primary">
                    {stg.name}
                  </span>
                </div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-app-secondary text-text-secondary">
                  {items.length}
                </span>
              </div>

              {boardMode === "opportunities" && stageConfirmedVal > 0 && (
                <div className="text-[11px] font-mono text-text-muted mb-2.5 px-1">
                  Stage Value:{" "}
                  <strong className="text-text-primary">
                    ₹{stageConfirmedVal.toLocaleString("en-IN")}
                  </strong>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {items.map((item) => {
                  const org =
                    boardMode === "opportunities"
                      ? orgMap.get(item.organizationId)
                      : item;
                  const msgStatus = org?.messageStatus || "not_messaged";
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedItemId(item.id)}
                      onClick={() => org && onOpenLead(org.id)}
                      className="p-3.5 rounded-xl bg-app-secondary hover:bg-app-elevated border border-app-border transition space-y-2.5 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (org) onOpenLead(org.id);
                          }}
                          className="font-heading font-semibold text-xs text-text-primary hover:text-accent text-left"
                        >
                          {org?.name || item.name}
                        </button>
                        <div className="flex items-center gap-1">
                          {org?.score !== null && org?.score !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-status-success/15 text-status-success font-mono text-[10px] font-semibold">
                              {org.score}
                            </span>
                          )}
                          {org && (
                            <button
                              type="button"
                              onClick={(e) => handleBlockBookmark(org.id, org.name, e)}
                              title="Bookmark Website to Design Inspirations"
                              className={`p-1 rounded ${
                                org.isBookmarked
                                  ? "text-accent"
                                  : "text-text-muted hover:text-text-primary"
                              }`}
                            >
                              <Bookmark
                                className={`w-3.5 h-3.5 ${
                                  org.isBookmarked ? "fill-current" : ""
                                }`}
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      {boardMode === "opportunities" && (
                        <div className="text-xs text-text-secondary font-medium">
                          {item.name}
                        </div>
                      )}

                      {org?.normalizedDomain && (
                        <div
                          className="flex items-center justify-between text-[11px] font-mono text-text-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={
                              org.websiteUrl?.startsWith("http")
                                ? org.websiteUrl
                                : `https://${org.websiteUrl}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline truncate inline-flex items-center gap-1"
                          >
                            {org.normalizedDomain}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {/* Simple Message Operations right on the Pipeline block */}
                      {org && (
                        <div
                          className="p-2 rounded-lg bg-app-surface border border-app-border space-y-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-accent" />
                              MESSAGES
                            </span>
                            <span>
                              {msgStatus === "message_sent"
                                ? "Sent"
                                : msgStatus === "followup_sent"
                                ? "Follow-up"
                                : msgStatus === "replied"
                                ? "Replied"
                                : "Not Sent"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={(e) =>
                                handleBlockMessageStatus(org.id, org.name, "message_sent", e)
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                msgStatus === "message_sent"
                                  ? "bg-accent text-white border-accent"
                                  : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              ✓ Sent
                            </button>
                            <button
                              type="button"
                              onClick={(e) =>
                                handleBlockMessageStatus(org.id, org.name, "followup_sent", e)
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                msgStatus === "followup_sent"
                                  ? "bg-accent text-white border-accent"
                                  : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              Follow-up
                            </button>
                            <button
                              type="button"
                              onClick={(e) =>
                                handleBlockMessageStatus(org.id, org.name, "replied", e)
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                msgStatus === "replied"
                                  ? "bg-status-success text-black border-status-success font-semibold"
                                  : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              Replied
                            </button>
                          </div>
                        </div>
                      )}

                      {boardMode === "opportunities" && (
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-text-primary font-semibold">
                            {item.estimatedValue !== null &&
                            item.estimatedValue !== undefined &&
                            item.estimatedValue !== ""
                              ? `₹${Number(item.estimatedValue).toLocaleString("en-IN")}`
                              : "Value: Unknown"}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded uppercase text-[10px] ${
                              item.priority === "high"
                                ? "bg-status-error/15 text-status-error"
                                : "bg-app-surface text-text-secondary"
                            }`}
                          >
                            {item.priority}
                          </span>
                        </div>
                      )}

                      {/* Accessible keyboard stage switcher */}
                      <div
                        className="pt-1 flex items-center justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] text-text-muted font-mono">
                          {org?.country || ""}
                        </span>
                        <select
                          aria-label={`Change stage for ${item.name}`}
                          value={stg.id}
                          onChange={(e) => handleMoveItem(item.id, e.target.value)}
                          className="bg-app-surface border border-app-border rounded px-1.5 py-0.5 text-[10px] text-text-secondary"
                        >
                          {stages.map((s) => (
                            <option key={s.id} value={s.id}>
                              → {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Opportunity Modal */}
      {showAddOpp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateOpp}
            className="w-full max-w-lg bg-app-surface border border-app-border rounded-xl p-6 space-y-4 shadow-xl"
          >
            <h2 className="text-base font-heading font-bold text-text-primary">
              Create Sales Opportunity
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Organization *</label>
                <select
                  value={oppOrgId}
                  onChange={(e) => setOppOrgId(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                >
                  {organizations.slice(0, 100).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.country || "—"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Opportunity Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Headless Storefront Redesign"
                  value={oppName}
                  onChange={(e) => setOppName(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">Service Type</label>
                  <input
                    type="text"
                    value={oppService}
                    onChange={(e) => setOppService(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Stage</label>
                  <select
                    value={oppStage}
                    onChange={(e) => setOppStage(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">
                    Estimated Value (INR — optional)
                  </label>
                  <input
                    type="number"
                    placeholder="Leave empty if unknown"
                    value={oppVal}
                    onChange={(e) => setOppVal(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Priority</label>
                  <select
                    value={oppPriority}
                    onChange={(e) => setOppPriority(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Next Action</label>
                <input
                  type="text"
                  placeholder="e.g. Send technical audit Loom video"
                  value={oppNextAction}
                  onChange={(e) => setOppNextAction(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-app-border">
              <button
                type="button"
                onClick={() => setShowAddOpp(false)}
                className="px-4 py-2 rounded-lg bg-app-secondary text-text-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold"
              >
                Save Opportunity
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   2. TASKS, FOLLOW-UPS & CALENDAR VIEW (Section 16)
   ============================================================================ */
interface TasksViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organizations: any[];
  initialMode?: "tasks" | "followups" | "calendar";
  onOpenLead: (id: string) => void;
  onMutated: () => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function TasksAndFollowUpsView({
  tasks,
  organizations,
  initialMode = "tasks",
  onOpenLead,
  onMutated,
  notify,
}: TasksViewProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const next7Str = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const [bucket, setBucket] = useState<
    "all" | "overdue" | "today" | "tomorrow" | "week" | "later" | "completed"
  >(initialMode === "followups" ? "today" : "all");
  const [displayMode, setDisplayMode] = useState<"list" | "calendar">(
    initialMode === "calendar" ? "calendar" : "list"
  );
  const [showNewTask, setShowNewTask] = useState(false);

  const [title, setTitle] = useState("");
  const [orgId, setOrgId] = useState(organizations[0]?.id || "");
  const [taskType, setTaskType] = useState("Follow-up");
  const [priority, setPriority] = useState("high");
  const [dueDate, setDueDate] = useState(todayStr);
  const [dueTime, setDueTime] = useState("11:00");

  const orgMap = new Map(organizations.map((o) => [o.id, o]));

  const overdueCount = tasks.filter(
    (t) => t.status !== "Completed" && t.dueDate < todayStr
  ).length;
  const todayCount = tasks.filter(
    (t) => t.status !== "Completed" && t.dueDate === todayStr
  ).length;
  const tomorrowCount = tasks.filter(
    (t) => t.status !== "Completed" && t.dueDate === tomorrowStr
  ).length;
  const weekCount = tasks.filter(
    (t) => t.status !== "Completed" && t.dueDate > todayStr && t.dueDate <= next7Str
  ).length;

  const filteredTasks = tasks.filter((t) => {
    if (bucket === "completed") return t.status === "Completed";
    if (t.status === "Completed" && bucket !== "all") return false;
    if (bucket === "overdue") return t.dueDate < todayStr;
    if (bucket === "today") return t.dueDate === todayStr;
    if (bucket === "tomorrow") return t.dueDate === tomorrowStr;
    if (bucket === "week") return t.dueDate >= todayStr && t.dueDate <= next7Str;
    if (bucket === "later") return t.dueDate > next7Str;
    return true;
  });

  async function handleToggleTask(id: string) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_task_status", payload: { id } }),
    });
    await onMutated();
    notify("Task status updated", "success");
  }

  async function handleQuickMessage(
    organizationId: string,
    operation: "message_sent" | "followup_sent" | "replied"
  ) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_message_operation",
        payload: { organizationId, operation, channel: "Outreach" },
      }),
    });
    await onMutated();
    notify(
      operation === "message_sent"
        ? "Marked as Message Sent"
        : operation === "followup_sent"
        ? "Marked as Follow-up Sent"
        : "Marked as Replied!",
      "success"
    );
  }

  async function handleToggleBookmark(organizationId: string) {
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_bookmark_inspiration",
        payload: { organizationId },
      }),
    });
    const json = await res.json();
    await onMutated();
    notify(
      json.bookmarked
        ? "Bookmarked website to Design Inspirations!"
        : "Removed from Design Inspirations",
      "success"
    );
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_task",
        payload: {
          title: title.trim(),
          organizationId: orgId || null,
          taskType,
          priority,
          dueDate,
          dueTime,
        },
      }),
    });
    setTitle("");
    setShowNewTask(false);
    await onMutated();
    notify("Task scheduled", "success");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-app-border pb-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">
            Tasks, Follow-ups &amp; Schedule
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Track overdue actions, daily follow-up queues, and quick message operations (Timezone: Asia/Kolkata).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-app-surface p-1 rounded-lg border border-app-border text-xs">
            <button
              type="button"
              onClick={() => setDisplayMode("list")}
              className={`px-3 py-1 rounded-md font-medium ${
                displayMode === "list"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Task Queue
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("calendar")}
              className={`px-3 py-1 rounded-md font-medium ${
                displayMode === "calendar"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Calendar View
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNewTask(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            + New Task
          </button>
        </div>
      </div>

      {/* Bucket Tabs matching Mockup 7 */}
      <div className="flex flex-wrap items-center gap-1.5 bg-app-surface border border-app-border rounded-xl p-2">
        {[
          { id: "all", label: `All Tasks (${tasks.length})` },
          { id: "overdue", label: `Overdue (${overdueCount})`, alert: overdueCount > 0 },
          { id: "today", label: `Today (${todayCount})` },
          { id: "tomorrow", label: `Tomorrow (${tomorrowCount})` },
          { id: "week", label: `Next 7 Days (${weekCount})` },
          { id: "later", label: "Later" },
          {
            id: "completed",
            label: `Completed (${tasks.filter((t) => t.status === "Completed").length})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setBucket(tab.id as typeof bucket)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              bucket === tab.id
                ? "bg-accent text-white"
                : tab.alert
                ? "bg-status-error/15 text-status-error hover:bg-status-error/25"
                : "bg-app-secondary text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {displayMode === "list" ? (
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-app-secondary text-text-muted font-mono uppercase">
              <tr>
                <th className="py-2.5 px-4 w-10">Done</th>
                <th className="py-2.5 px-4">Task / Follow-up</th>
                <th className="py-2.5 px-4">Related Organization</th>
                <th className="py-2.5 px-4">Message &amp; Bookmark Ops</th>
                <th className="py-2.5 px-4">Due Date</th>
                <th className="py-2.5 px-4">Priority</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-text-secondary">
                    No tasks in this queue.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const org = orgMap.get(t.organizationId);
                  const isOverdue = t.status !== "Completed" && t.dueDate < todayStr;
                  return (
                    <tr key={t.id} className="hover:bg-app-secondary/60">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={t.status === "Completed"}
                          onChange={() => handleToggleTask(t.id)}
                          aria-label={`Mark ${t.title} complete`}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div
                          className={
                            t.status === "Completed"
                              ? "line-through text-text-muted"
                              : "font-medium text-text-primary"
                          }
                        >
                          {t.title}
                        </div>
                        {t.description && (
                          <div className="text-[11px] text-text-muted mt-0.5">
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {org ? (
                          <button
                            type="button"
                            onClick={() => onOpenLead(org.id)}
                            className="text-accent hover:underline font-medium"
                          >
                            {org.name}
                          </button>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {org ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuickMessage(org.id, "message_sent")}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border transition ${
                                org.outreachStatus === "message_sent" ||
                                org.primaryStageId === "stg_contacted"
                                  ? "bg-status-info text-white border-status-info"
                                  : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              ✓ Sent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickMessage(org.id, "followup_sent")}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border transition ${
                                org.outreachStatus === "followup_sent"
                                  ? "bg-accent text-white border-accent"
                                  : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              Follow-up
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickMessage(org.id, "replied")}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border transition ${
                                org.outreachStatus === "replied" ||
                                org.primaryStageId === "stg_replied"
                                  ? "bg-status-success text-white border-status-success"
                                  : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              Replied
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleBookmark(org.id)}
                              title="Bookmark Website to Design Inspirations"
                              className={`p-1 rounded border transition ${
                                org.isBookmarkedInspiration
                                  ? "bg-status-warning/20 border-status-warning/40 text-status-warning"
                                  : "bg-app-secondary border-app-border text-text-muted hover:text-status-warning"
                              }`}
                            >
                              <Bookmark className="w-3 h-3 fill-current" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-text-muted font-mono text-[11px]">{t.taskType}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span
                          className={
                            isOverdue
                              ? "text-status-error font-semibold"
                              : t.dueDate === todayStr
                              ? "text-status-warning font-semibold"
                              : "text-text-secondary"
                          }
                        >
                          {t.dueDate === todayStr ? "Today" : t.dueDate}{" "}
                          {t.dueTime ? `• ${t.dueTime}` : ""}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase ${
                            t.priority === "high"
                              ? "bg-status-error/15 text-status-error"
                              : t.priority === "medium"
                              ? "bg-status-warning/15 text-status-warning"
                              : "bg-status-success/15 text-status-success"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                            t.status === "Completed"
                              ? "bg-status-success/15 text-status-success"
                              : t.status === "In Progress"
                              ? "bg-status-info/15 text-status-info"
                              : "bg-app-secondary text-text-secondary"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Calendar Schedule Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from(new Set(tasks.map((t) => t.dueDate)))
            .sort()
            .map((dateStr) => {
              const dayTasks = tasks.filter((t) => t.dueDate === dateStr);
              return (
                <div
                  key={dateStr}
                  className="bg-app-surface border border-app-border rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-app-border">
                    <span className="font-mono text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-accent" />
                      {dateStr === todayStr ? `Today (${dateStr})` : dateStr}
                    </span>
                    <span className="text-xs font-mono text-text-muted">
                      {dayTasks.length} item(s)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {dayTasks.map((t) => {
                      const org = orgMap.get(t.organizationId);
                      return (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-lg bg-app-secondary border border-app-border text-xs space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium text-text-primary">{t.title}</div>
                              <div className="text-[11px] font-mono text-text-muted">
                                {t.dueTime || "All day"} • {t.taskType}
                              </div>
                              {org && (
                                <button
                                  type="button"
                                  onClick={() => onOpenLead(org.id)}
                                  className="text-[11px] text-accent hover:underline font-medium mt-0.5"
                                >
                                  {org.name}
                                </button>
                              )}
                            </div>
                            <input
                              type="checkbox"
                              checked={t.status === "Completed"}
                              onChange={() => handleToggleTask(t.id)}
                            />
                          </div>
                          {org && (
                            <div className="flex items-center gap-1 pt-1.5 border-t border-app-border/70">
                              <button
                                type="button"
                                onClick={() => handleQuickMessage(org.id, "message_sent")}
                                className="flex-1 py-1 rounded bg-app-surface border border-app-border text-[10px] font-semibold text-text-secondary hover:text-text-primary"
                              >
                                ✓ Sent
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickMessage(org.id, "followup_sent")}
                                className="flex-1 py-1 rounded bg-app-surface border border-app-border text-[10px] font-semibold text-text-secondary hover:text-text-primary"
                              >
                                Follow-up
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickMessage(org.id, "replied")}
                                className="flex-1 py-1 rounded bg-app-surface border border-app-border text-[10px] font-semibold text-text-secondary hover:text-text-primary"
                              >
                                Replied
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {showNewTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-md bg-app-surface border border-app-border rounded-xl p-6 space-y-4 shadow-xl"
          >
            <h2 className="text-base font-heading font-bold text-text-primary">
              Schedule Task or Follow-up
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Follow up with Apex Furniture Studio"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Related Organization</label>
                <select
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                >
                  <option value="">None (General Task)</option>
                  {organizations.slice(0, 100).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  >
                    <option value="Follow-up">Follow-up</option>
                    <option value="Research">Research / Audit</option>
                    <option value="Email">Email</option>
                    <option value="Call">Call</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Content">Content</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Time</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-app-border">
              <button
                type="button"
                onClick={() => setShowNewTask(false)}
                className="px-4 py-2 rounded-lg bg-app-secondary text-text-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold"
              >
                Save Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   3. DESIGN INSPIRATIONS, BOOKMARKED WEBSITES & CONTENT IDEAS VIEW (Sections 18 & 19)
   ============================================================================ */
interface LibraryViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  references: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentIdeas: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organizations: any[];
  initialTab?: "references" | "content";
  onOpenLead: (id: string) => void;
  onMutated: () => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function ReferencesAndContentView({
  references,
  contentIdeas,
  organizations,
  initialTab = "references",
  onOpenLead,
  onMutated,
  notify,
}: LibraryViewProps) {
  const [tab, setTab] = useState<"references" | "content">(initialTab);
  const [refCatFilter, setRefCatFilter] = useState("");
  const [contentStatusFilter, setContentStatusFilter] = useState("");
  const [previewImage, setPreviewImage] = useState<{ title: string; url: string } | null>(null);

  // Add Reference / Design Inspiration state
  const [showAddRef, setShowAddRef] = useState(false);
  const [refTitle, setRefTitle] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [refCategory, setRefCategory] = useState("Design Inspiration");
  const [refDesc, setRefDesc] = useState("");
  const [refScreenshotUrl, setRefScreenshotUrl] = useState("");
  const [refOrgId, setRefOrgId] = useState("");

  // Add Content Idea state
  const [showAddIdea, setShowAddIdea] = useState(false);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaHook, setIdeaHook] = useState("");
  const [ideaPlatform, setIdeaPlatform] = useState("Instagram Reels");
  const [ideaStatus, setIdeaStatus] = useState("Idea");
  const [ideaOrgId, setIdeaOrgId] = useState("");

  const orgMap = new Map(organizations.map((o) => [o.id, o]));

  const filteredRefs = references.filter(
    (r) => !refCatFilter || r.category === refCatFilter
  );
  const filteredIdeas = contentIdeas.filter(
    (c) => !contentStatusFilter || c.status === contentStatusFilter
  );

  function handleScreenshotFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setRefScreenshotUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateRef(e: React.FormEvent) {
    e.preventDefault();
    if (!refTitle.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_reference",
        payload: {
          title: refTitle.trim(),
          url: refUrl.trim() || refScreenshotUrl.trim() || "https://localhost:3000",
          category: refCategory,
          description: refDesc.trim(),
          screenshotUrl: refScreenshotUrl.trim() || null,
          organizationId: refOrgId || null,
        },
      }),
    });
    setRefTitle("");
    setRefUrl("");
    setRefDesc("");
    setRefScreenshotUrl("");
    setShowAddRef(false);
    await onMutated();
    notify("Design Inspiration / Website Bookmark saved!", "success");
  }

  async function handleDeleteRef(id: string) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_reference",
        payload: { id },
      }),
    });
    await onMutated();
    notify("Removed from Design Inspirations", "info");
  }

  async function handleCreateIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!ideaTitle.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_content_idea",
        payload: {
          title: ideaTitle.trim(),
          hook: ideaHook.trim(),
          platform: ideaPlatform,
          status: ideaStatus,
          organizationId: ideaOrgId || null,
        },
      }),
    });
    setIdeaTitle("");
    setIdeaHook("");
    setShowAddIdea(false);
    await onMutated();
    notify("Content idea created", "success");
  }

  async function handleIdeaStatusChange(
    id: string,
    currentIdea: Record<string, unknown>,
    nextStatus: string
  ) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_content_idea",
        payload: { ...currentIdea, id, status: nextStatus },
      }),
    });
    await onMutated();
    notify(`Content status updated to ${nextStatus}`, "info");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-app-border pb-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-status-warning fill-status-warning" />
            Design Inspirations, Website Bookmarks &amp; Content Ideas
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Your saved UI/UX design inspirations, bookmarked lead websites, and content hooks — stored 100% in Local Browser Storage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-app-surface p-1 rounded-lg border border-app-border text-xs">
            <button
              type="button"
              onClick={() => setTab("references")}
              className={`px-3 py-1.5 rounded-md font-medium ${
                tab === "references"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Design Inspirations ({references.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("content")}
              className={`px-3 py-1.5 rounded-md font-medium ${
                tab === "content"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Content Ideas ({contentIdeas.length})
            </button>
          </div>

          {tab === "references" ? (
            <button
              type="button"
              onClick={() => setShowAddRef(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              + Add Design Inspiration
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddIdea(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              + Add Content Idea
            </button>
          )}
        </div>
      </div>

      {tab === "references" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              "",
              "Design Inspiration",
              "Good Website Design",
              "Landing Page Inspiration",
              "Good Reel",
              "For Reference",
              "Good, Need to Work With It",
              "Competitor",
            ].map((cat) => (
              <button
                key={cat || "all"}
                type="button"
                onClick={() => setRefCatFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  refCatFilter === cat
                    ? "bg-accent text-white shadow-sm"
                    : "bg-app-surface border border-app-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {cat || `All Inspirations (${references.length})`}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRefs.map((ref) => {
              const linkedOrg = orgMap.get(ref.organizationId);
              return (
                <div
                  key={ref.id}
                  className="bg-app-surface border border-app-border hover:border-accent/50 rounded-2xl overflow-hidden flex flex-col justify-between transition group shadow-sm"
                >
                  <div>
                    {/* Visual Image Preview or Gradient Header */}
                    {ref.screenshotUrl ? (
                      <div className="relative h-52 bg-app-secondary border-b border-app-border overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ref.screenshotUrl}
                          alt={ref.title}
                          onClick={() =>
                            setPreviewImage({ title: ref.title, url: ref.screenshotUrl })
                          }
                          className="w-full h-full object-cover object-top cursor-zoom-in group-hover:scale-[1.02] transition duration-300"
                        />
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-status-warning font-mono text-[11px] font-semibold inline-flex items-center gap-1 border border-white/10">
                            <Bookmark className="w-3 h-3 fill-status-warning" />
                            {ref.category}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({ title: ref.title, url: ref.screenshotUrl })
                            }
                            className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-white text-[11px] font-medium hover:bg-accent transition"
                          >
                            Expand Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRef(ref.id)}
                            title="Delete Reference"
                            className="p-1.5 rounded-lg bg-black/75 backdrop-blur-md text-white/70 hover:text-status-error transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-36 bg-gradient-to-br from-accent/15 via-app-secondary to-app-elevated border-b border-app-border p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-full bg-status-warning/20 text-status-warning font-mono text-[11px] font-semibold inline-flex items-center gap-1">
                            <Bookmark className="w-3 h-3 fill-status-warning" />
                            {ref.category}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewImage({ title: ref.title, url: ref.url })
                              }
                              className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-mono"
                            >
                              Open in This Tab <ExternalLink className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRef(ref.id)}
                              title="Remove Bookmark"
                              className="text-text-muted hover:text-status-error transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({ title: ref.title, url: ref.url })
                          }
                          className="font-mono text-xs text-text-primary hover:text-accent truncate block text-left"
                        >
                          {ref.url}
                        </button>
                      </div>
                    )}

                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-heading font-bold text-sm text-text-primary">
                          {ref.title}
                        </h3>
                        {ref.url && !ref.url.startsWith("/") && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({ title: ref.title, url: ref.url })
                            }
                            className="text-xs text-accent hover:underline inline-flex items-center gap-1 shrink-0 font-medium"
                          >
                            Open in Tab <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {ref.description || "Saved design inspiration and website reference."}
                      </p>
                      {Array.isArray(ref.tags) && ref.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {ref.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded bg-app-secondary border border-app-border text-[10px] font-mono text-text-muted"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-app-secondary/50 border-t border-app-border flex items-center justify-between text-xs">
                    {linkedOrg ? (
                      <button
                        type="button"
                        onClick={() => onOpenLead(linkedOrg.id)}
                        className="text-accent hover:underline font-medium"
                      >
                        Lead: {linkedOrg.name}
                      </button>
                    ) : (
                      <span className="text-text-muted font-medium">Design Inspiration Library</span>
                    )}
                    <span className="font-mono text-[10px] text-text-muted">
                      {new Date(ref.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "content" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              "",
              "Idea",
              "Researching",
              "Scripting",
              "Ready to Record",
              "Recorded",
              "Editing",
              "Published",
            ].map((st) => (
              <button
                key={st || "all"}
                type="button"
                onClick={() => setContentStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  contentStatusFilter === st
                    ? "bg-accent text-white"
                    : "bg-app-surface border border-app-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {st || "All Stages"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIdeas.map((idea) => {
              const linkedOrg = orgMap.get(idea.organizationId);
              return (
                <div
                  key={idea.id}
                  className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-accent/15 text-accent font-mono text-[11px]">
                        {idea.platform} • {idea.contentType}
                      </span>
                      <select
                        aria-label={`Status for ${idea.title}`}
                        value={idea.status}
                        onChange={(e) =>
                          handleIdeaStatusChange(idea.id, idea, e.target.value)
                        }
                        className="bg-app-secondary border border-app-border rounded px-2 py-1 text-xs font-mono text-text-primary"
                      >
                        {[
                          "Idea",
                          "Researching",
                          "Scripting",
                          "Ready to Record",
                          "Recorded",
                          "Editing",
                          "Ready to Publish",
                          "Published",
                        ].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <h3 className="font-heading font-semibold text-sm text-text-primary">
                      {idea.title}
                    </h3>

                    {idea.hook && (
                      <div className="p-2.5 rounded-lg bg-app-secondary border border-app-border text-xs text-text-primary">
                        <span className="text-[10px] font-mono uppercase text-accent block mb-0.5">
                          HOOK
                        </span>
                        &ldquo;{idea.hook}&rdquo;
                      </div>
                    )}

                    {idea.description && (
                      <p className="text-xs text-text-secondary">{idea.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-app-border flex items-center justify-between text-xs">
                    {linkedOrg ? (
                      <button
                        type="button"
                        onClick={() => onOpenLead(linkedOrg.id)}
                        className="text-accent hover:underline font-medium"
                      >
                        Source Lead: {linkedOrg.name}
                      </button>
                    ) : (
                      <span className="text-text-muted">General Agency Content</span>
                    )}
                    <span className="font-mono text-[11px] text-text-muted">
                      Target: {idea.targetPublicationDate || "Unscheduled"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox for Design Inspiration Image or Live Website In-Tab */}
      {previewImage && (() => {
        const isWebPage =
          previewImage.url.startsWith("http") &&
          !/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(previewImage.url);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="w-[96vw] max-w-[1440px] h-[90vh] bg-app-surface border border-app-border rounded-3xl flex flex-col overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-app-border bg-app-sidebar flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-heading font-bold text-base text-text-primary">
                    {previewImage.title}
                  </h3>
                  {isWebPage && (
                    <span className="font-mono text-xs text-text-muted truncate max-w-md">
                      {previewImage.url}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isWebPage && (
                    <a
                      href={previewImage.url}
                      target="_self"
                      className="px-3 py-1.5 rounded-xl bg-app-surface hover:bg-app-elevated border border-app-border text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                      Navigate This Tab
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewImage(null)}
                    className="p-2 rounded-xl bg-app-surface text-text-secondary hover:text-text-primary border border-app-border"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {isWebPage ? (
                <div className="flex-1 bg-white">
                  <iframe
                    src={`/api/site-preview?url=${encodeURIComponent(previewImage.url)}`}
                    title={previewImage.title}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  />
                </div>
              ) : (
                <div className="flex-1 p-6 bg-app-bg overflow-y-auto flex justify-center items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewImage.url}
                    alt={previewImage.title}
                    className="max-w-full h-auto rounded-2xl border border-app-border"
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add Design Inspiration / Reference Modal */}
      {showAddRef && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRef}
            className="w-full max-w-md bg-app-surface border border-app-border rounded-xl p-6 space-y-4 shadow-xl"
          >
            <h2 className="text-base font-heading font-bold text-text-primary">
              Save Design Inspiration or Website Bookmark
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Minimalist Dark Mode CRM Dashboard"
                  value={refTitle}
                  onChange={(e) => setRefTitle(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Website URL (optional if uploading image)</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">
                  Upload Design Screenshot (saved in Browser Storage)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotFileUpload}
                  className="w-full text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-accent/15 file:text-accent file:font-semibold"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Category</label>
                <select
                  value={refCategory}
                  onChange={(e) => setRefCategory(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                >
                  <option value="Design Inspiration">Design Inspiration</option>
                  <option value="Good Website Design">Good Website Design</option>
                  <option value="Landing Page Inspiration">Landing Page Inspiration</option>
                  <option value="Good Reel">Good Reel</option>
                  <option value="For Reference">For Reference</option>
                  <option value="Good, Need to Work With It">Good, Need to Work With It</option>
                  <option value="Competitor">Competitor</option>
                </select>
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Linked Organization</label>
                <select
                  value={refOrgId}
                  onChange={(e) => setRefOrgId(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                >
                  <option value="">None (Standalone Inspiration)</option>
                  {organizations.slice(0, 100).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Design Notes / Why Bookmarked</label>
                <textarea
                  rows={2}
                  value={refDesc}
                  onChange={(e) => setRefDesc(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg p-2.5 text-text-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-app-border">
              <button
                type="button"
                onClick={() => setShowAddRef(false)}
                className="px-4 py-2 rounded-lg bg-app-secondary text-text-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold"
              >
                Save Inspiration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Content Idea Modal */}
      {showAddIdea && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateIdea}
            className="w-full max-w-md bg-app-surface border border-app-border rounded-xl p-6 space-y-4 shadow-xl"
          >
            <h2 className="text-base font-heading font-bold text-text-primary">
              Create Content Idea
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3 Checkout Fixes for Indian D2C Brands"
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Opening Hook</label>
                <input
                  type="text"
                  placeholder="Attention-grabbing first sentence..."
                  value={ideaHook}
                  onChange={(e) => setIdeaHook(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">Platform</label>
                  <select
                    value={ideaPlatform}
                    onChange={(e) => setIdeaPlatform(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  >
                    <option value="Instagram Reels">Instagram Reels</option>
                    <option value="YouTube Shorts">YouTube Shorts</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="YouTube Long-form">YouTube Long-form</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Status</label>
                  <select
                    value={ideaStatus}
                    onChange={(e) => setIdeaStatus(e.target.value)}
                    className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                  >
                    <option value="Idea">Idea</option>
                    <option value="Researching">Researching</option>
                    <option value="Scripting">Scripting</option>
                    <option value="Ready to Record">Ready to Record</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Linked Lead</label>
                <select
                  value={ideaOrgId}
                  onChange={(e) => setIdeaOrgId(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                >
                  <option value="">None</option>
                  {organizations.slice(0, 100).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-app-border">
              <button
                type="button"
                onClick={() => setShowAddIdea(false)}
                className="px-4 py-2 rounded-lg bg-app-secondary text-text-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold"
              >
                Create Idea
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   4. CONTACTS & DO NOT CONTACT SUPPRESSION REGISTRY (Section 17)
   ============================================================================ */
interface ContactsViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contacts: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suppressions: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organizations: any[];
  onOpenLead: (id: string) => void;
  onMutated: () => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function ContactsAndSuppressionView({
  contacts,
  suppressions,
  organizations,
  onOpenLead,
  onMutated,
  notify,
}: ContactsViewProps) {
  const [subTab, setSubTab] = useState<"contacts" | "suppression">("contacts");
  const [dncDomain, setDncDomain] = useState("");
  const [dncReason, setDncReason] = useState("");
  const orgMap = new Map(organizations.map((o) => [o.id, o]));

  async function handleQuickMessage(
    organizationId: string,
    operation: "message_sent" | "followup_sent" | "replied"
  ) {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_message_operation",
        payload: { organizationId, operation, channel: "Outreach" },
      }),
    });
    await onMutated();
    notify(
      operation === "message_sent"
        ? "Marked as Message Sent"
        : operation === "followup_sent"
        ? "Marked as Follow-up Sent"
        : "Marked as Replied!",
      "success"
    );
  }

  async function handleAddSuppression(e: React.FormEvent) {
    e.preventDefault();
    if (!dncDomain.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_suppression",
        payload: {
          businessOrDomain: dncDomain.trim(),
          reasonOrSource: dncReason.trim() || "Manual exclusion entry",
        },
      }),
    });
    setDncDomain("");
    setDncReason("");
    await onMutated();
    notify("Added to Do Not Contact suppression registry", "info");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-app-border pb-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">
            Contacts &amp; Do Not Contact Registry
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage decision-maker contacts, trigger message operations, and enforce strict outreach suppression rules.
          </p>
        </div>

        <div className="flex items-center bg-app-surface p-1 rounded-lg border border-app-border text-xs">
          <button
            type="button"
            onClick={() => setSubTab("contacts")}
            className={`px-3 py-1.5 rounded-md font-medium ${
              subTab === "contacts"
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Contacts ({contacts.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("suppression")}
            className={`px-3 py-1.5 rounded-md font-medium ${
              subTab === "suppression"
                ? "bg-status-error text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Do Not Contact Registry ({suppressions.length})
          </button>
        </div>
      </div>

      {subTab === "contacts" ? (
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-app-secondary text-text-muted font-mono uppercase">
              <tr>
                <th className="py-2.5 px-4">Full Name</th>
                <th className="py-2.5 px-4">Role / Title</th>
                <th className="py-2.5 px-4">Organization</th>
                <th className="py-2.5 px-4">Email / Phone</th>
                <th className="py-2.5 px-4">Message Operations</th>
                <th className="py-2.5 px-4">Outreach Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {contacts.map((c) => {
                const org = orgMap.get(c.organizationId);
                return (
                  <tr key={c.id} className="hover:bg-app-secondary/50">
                    <td className="py-3 px-4 font-semibold text-text-primary">{c.fullName}</td>
                    <td className="py-3 px-4 text-text-secondary">{c.jobTitle || "—"}</td>
                    <td className="py-3 px-4">
                      {org ? (
                        <button
                          type="button"
                          onClick={() => onOpenLead(org.id)}
                          className="text-accent hover:underline font-medium"
                        >
                          {org.name}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-text-secondary">
                      <div>{c.email || "—"}</div>
                      {c.phone && <div className="text-[11px] text-text-muted">{c.phone}</div>}
                    </td>
                    <td className="py-3 px-4">
                      {org ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuickMessage(org.id, "message_sent")}
                            className={`px-2 py-1 rounded text-[10px] font-semibold border transition ${
                              org.outreachStatus === "message_sent"
                                ? "bg-status-info text-white border-status-info"
                                : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            ✓ Sent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickMessage(org.id, "followup_sent")}
                            className={`px-2 py-1 rounded text-[10px] font-semibold border transition ${
                              org.outreachStatus === "followup_sent"
                                ? "bg-accent text-white border-accent"
                                : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            Follow-up
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickMessage(org.id, "replied")}
                            className={`px-2 py-1 rounded text-[10px] font-semibold border transition ${
                              org.outreachStatus === "replied"
                                ? "bg-status-success text-white border-status-success"
                                : "bg-app-secondary border-app-border text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            Replied
                          </button>
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {c.doNotContact ? (
                        <span className="px-2 py-0.5 rounded bg-status-error/15 text-status-error font-mono text-[11px]">
                          DO NOT CONTACT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-app-secondary text-text-secondary font-mono text-[11px]">
                          {c.approvalStatus}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-status-error" />
              Active Suppression &amp; Exclusion List
            </h3>
            <p className="text-xs text-text-secondary">
              Note: An empty or partial suppression list never implies affirmative outreach permission. All 200 imported ledger leads retain their explicit <code className="font-mono">not approved</code> outreach status until manually reviewed.
            </p>
            {suppressions.length === 0 ? (
              <div className="p-6 text-center bg-app-secondary rounded-lg text-xs text-text-muted">
                No domains or contacts currently in the Do Not Contact exclusion list.
              </div>
            ) : (
              <div className="space-y-2">
                {suppressions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-lg bg-app-secondary border border-status-error/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-text-primary font-mono">
                        {s.businessOrDomain}
                      </strong>
                      <span className="text-text-secondary ml-2">
                        ({s.reasonOrSource || "Excluded"})
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-status-error/15 text-status-error font-mono text-[10px]">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={handleAddSuppression}
            className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-heading font-semibold text-text-primary">
              + Add Do Not Contact Entry
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">
                  Business Name or Domain *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. example.com or Brand Name"
                  value={dncDomain}
                  onChange={(e) => setDncDomain(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary mb-1">Reason / Source</label>
                <input
                  type="text"
                  placeholder="e.g. Requested opt-out, Competitor, Existing client"
                  value={dncReason}
                  onChange={(e) => setDncReason(e.target.value)}
                  className="w-full bg-app-secondary border border-app-border rounded-lg px-3 py-2 text-text-primary"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-status-error text-white text-xs font-semibold"
            >
              Add to Exclusion Registry
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   5. ANALYTICS & ACTIVITY HISTORY VIEW (Section 21, Mockup 9)
   ============================================================================ */
interface AnalyticsViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organizations: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collections: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stages: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opportunities: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importBatches: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activities: any[];
  initialMode?: "analytics" | "activity";
}

export function AnalyticsAndActivityView({
  organizations,
  collections,
  stages,
  opportunities,
  importBatches,
  activities,
  initialMode = "analytics",
}: AnalyticsViewProps) {
  const [mode, setMode] = useState<"analytics" | "activity">(initialMode);
  const [dateRange, setDateRange] = useState("all");

  // Compute real metrics from actual database records (Section 21)
  const totalLeads = organizations.length;
  const indiaCount = organizations.filter((o) => o.market === "India").length;
  const intlCount = organizations.filter((o) => o.market === "International").length;
  const siteDescCount = organizations.filter(
    (o) => o.verificationLevel === "site description"
  ).length;
  const dirOnlyCount = organizations.filter((o) =>
    (o.verificationLevel || "").toLowerCase().includes("directory")
  ).length;
  const highPriorityCount = organizations.filter(
    (o) => o.score !== null && o.score >= 75
  ).length;
  const qualifiedCount = organizations.filter(
    (o) => o.qualificationDecision === "qualified" || o.primaryStageId === "stg_qualified"
  ).length;

  const confirmedPipelineValue = opportunities.reduce((sum, opp) => {
    return opp.estimatedValue && opp.outcome !== "lost"
      ? sum + Number(opp.estimatedValue)
      : sum;
  }, 0);

  // Country counts
  const byCountry: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const o of organizations) {
    const c = o.country || "Unknown";
    byCountry[c] = (byCountry[c] || 0) + 1;
    const cat = o.industry || "Uncategorized";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  const sortedCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-app-border pb-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">
            CRM Analytics &amp; Audit Trail
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Derived strictly from real database records — zero fabricated percentages or mock charts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-app-surface p-1 rounded-lg border border-app-border text-xs">
            <button
              type="button"
              onClick={() => setMode("analytics")}
              className={`px-3 py-1.5 rounded-md font-medium ${
                mode === "analytics"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Analytics Overview
            </button>
            <button
              type="button"
              onClick={() => setMode("activity")}
              className={`px-3 py-1.5 rounded-md font-medium ${
                mode === "activity"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Activity History ({activities.length})
            </button>
          </div>

          <select
            aria-label="Date Range Filter"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="year">This Year (2026)</option>
          </select>
        </div>
      </div>

      {mode === "analytics" ? (
        <div className="space-y-6">
          {/* Top KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-app-surface border border-app-border rounded-xl p-4">
              <div className="text-xs text-text-secondary">Total Leads</div>
              <div className="text-2xl font-heading font-bold text-text-primary mt-1">
                {totalLeads}
              </div>
              <div className="text-[11px] font-mono text-text-muted mt-1">
                {indiaCount} IN • {intlCount} INTL
              </div>
            </div>

            <div className="bg-app-surface border border-app-border rounded-xl p-4">
              <div className="text-xs text-text-secondary">Site-Verified</div>
              <div className="text-2xl font-heading font-bold text-status-success mt-1">
                {siteDescCount}
              </div>
              <div className="text-[11px] font-mono text-text-muted mt-1">
                {totalLeads > 0 ? `${((siteDescCount / totalLeads) * 100).toFixed(1)}%` : "0%"} of ledger
              </div>
            </div>

            <div className="bg-app-surface border border-app-border rounded-xl p-4">
              <div className="text-xs text-text-secondary">Directory-Only</div>
              <div className="text-2xl font-heading font-bold text-status-warning mt-1">
                {dirOnlyCount}
              </div>
              <div className="text-[11px] font-mono text-text-muted mt-1">
                Awaiting domain check
              </div>
            </div>

            <div className="bg-app-surface border border-app-border rounded-xl p-4">
              <div className="text-xs text-text-secondary">High Priority</div>
              <div className="text-2xl font-heading font-bold text-accent mt-1">
                {highPriorityCount}
              </div>
              <div className="text-[11px] font-mono text-text-muted mt-1">
                Score &ge; 75
              </div>
            </div>

            <div className="bg-app-surface border border-app-border rounded-xl p-4">
              <div className="text-xs text-text-secondary">Qualified</div>
              <div className="text-2xl font-heading font-bold text-status-info mt-1">
                {qualifiedCount}
              </div>
              <div className="text-[11px] font-mono text-text-muted mt-1">
                Reviewed &amp; qualified
              </div>
            </div>

            <div className="bg-app-surface border border-app-border rounded-xl p-4">
              <div className="text-xs text-text-secondary">Confirmed Pipeline</div>
              <div className="text-xl font-heading font-bold text-status-success mt-1">
                ₹{confirmedPipelineValue.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] font-mono text-text-muted mt-1">
                {opportunities.length} active deals
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Leads by Country */}
            <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-heading font-semibold text-text-primary">
                Leads by Country
              </h3>
              <div className="space-y-2.5">
                {sortedCountries.map(([country, count]) => {
                  const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                  return (
                    <div key={country} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-primary font-medium">{country}</span>
                        <span className="font-mono text-text-secondary">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-app-secondary overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leads by Niche / Category */}
            <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-heading font-semibold text-text-primary">
                Leads by Niche / Category
              </h3>
              <div className="space-y-2.5">
                {sortedCategories.map(([cat, count]) => {
                  const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-primary font-medium">{cat}</span>
                        <span className="font-mono text-text-secondary">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-app-secondary overflow-hidden">
                        <div
                          className="h-full bg-status-info rounded-full"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pipeline Stage Distribution */}
            <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-heading font-semibold text-text-primary">
                Pipeline Stage Distribution
              </h3>
              <div className="space-y-2.5">
                {stages.map((s) => {
                  const count = organizations.filter(
                    (o) => (o.primaryStageId || "stg_new") === s.id
                  ).length;
                  const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                  return (
                    <div key={s.id} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-primary font-medium">{s.name}</span>
                        <span className="font-mono text-text-secondary">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-app-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(2, pct)}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Import Analytics Summary */}
          <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-heading font-semibold text-text-primary">
              Spreadsheet Import Provenance Statistics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                <span className="text-text-muted block">Completed Batches</span>
                <strong className="font-mono text-lg text-text-primary">
                  {importBatches.length}
                </strong>
              </div>
              <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                <span className="text-text-muted block">Rows Processed</span>
                <strong className="font-mono text-lg text-text-primary">
                  {importBatches.reduce((s, b) => s + b.totalRows, 0)}
                </strong>
              </div>
              <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                <span className="text-text-muted block">Records Created</span>
                <strong className="font-mono text-lg text-status-success">
                  {importBatches.reduce((s, b) => s + b.newRecordsCreated, 0)}
                </strong>
              </div>
              <div className="p-3 rounded-lg bg-app-secondary border border-app-border">
                <span className="text-text-muted block">Anomalies Flagged</span>
                <strong className="font-mono text-lg text-status-warning">
                  {importBatches.reduce((s, b) => s + b.validationWarningsCount, 0)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-2.5">
          {activities.map((a) => (
            <div
              key={a.id}
              className="p-3.5 rounded-lg bg-app-secondary border border-app-border flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-medium text-text-primary">{a.title}</div>
                {a.description && (
                  <div className="text-text-secondary mt-0.5">{a.description}</div>
                )}
              </div>
              <div className="font-mono text-[11px] text-text-muted">
                <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border mr-2 uppercase">
                  {a.actorOrigin}
                </span>
                {new Date(a.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
