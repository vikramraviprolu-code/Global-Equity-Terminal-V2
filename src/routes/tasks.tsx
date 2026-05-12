import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, memo } from "react";
import {
  listTasks,
  addTask,
  updateTaskStatus,
  deleteTask,
  TASK_STATUSES,
  type TaskStatus,
} from "@/server/tasks.functions";
import {
  getAlertsForTask,
  linkAlertToTask,
  unlinkAlertFromTask,
  addAlert,
  type AlertType,
} from "@/server/alerts.functions";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { AuthNav } from "@/components/auth-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, ListTodo, Bell, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, TableSkeleton } from "@/components/feedback-states";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To-do",
  in_progress: "In progress",
  done: "Done",
};

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Global Equity Terminal" },
      {
        name: "description",
        content:
          "Track research tasks and to-dos linked to tickers. Create, assign symbols, and mark complete.",
      },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);
  if (loading || !user) return null;
  return <TasksContent />;
}

function TasksContent() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      if (!authHeaders) return { tasks: [] } as any;
      try {
        return await listTasks({ headers: authHeaders });
      } catch {
        return { tasks: [] } as any;
      }
    },
    enabled: !!token,
    retry: false,
    staleTime: 60 * 1000, // Cache tasks for 1 minute
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
  });

  const tasks = (data?.tasks ?? []) as any[];
  const grouped: Record<TaskStatus, any[]> = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done"),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav right={<AuthNav />} />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-xl font-mono uppercase tracking-widest text-primary">
              Tasks
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Track research to-dos and assign them to tickers. Move them across
              the board as you work.
            </p>
          </div>
        </div>

        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase tracking-widest">
              New task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NewTaskForm
              headers={authHeaders}
              onCreated={() => qc.invalidateQueries({ queryKey: ["tasks"] })}
            />
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="p-0">
              <TableSkeleton columns={4} rows={4} />
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<ListTodo className="w-8 h-8" />}
                title="No tasks yet"
                description="Use the form above to capture research follow-ups, due-diligence items, or trade ideas. Optionally link a ticker."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(TASK_STATUSES as readonly TaskStatus[]).map((status) => (
              <Card key={status} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono uppercase tracking-widest flex items-center justify-between">
                    <span>{STATUS_LABEL[status]}</span>
                    <span className="text-muted-foreground">
                      {grouped[status].length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {grouped[status].length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">
                      Nothing here.
                    </p>
                  ) : (
                    grouped[status].map((t) => (
                      <TaskCard key={t.id} t={t} headers={authHeaders} />
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Disclaimer />
      </main>
    </div>
  );
}

const TaskCard = memo(function TaskCard({ t, headers }: { t: any; headers?: HeadersInit }) {
  const qc = useQueryClient();
  const [showAlertCreate, setShowAlertCreate] = useState(false);
  const [showRelatedAlerts, setShowRelatedAlerts] = useState(false);

  const { data: alertsData } = useQuery({
    queryKey: ["task-alerts", t.id],
    queryFn: () => getAlertsForTask({ data: { taskId: t.id }, headers }),
    enabled: showRelatedAlerts,
  });

  const upd = useMutation({
    mutationFn: (status: TaskStatus) =>
      updateTaskStatus({ data: { id: t.id, status }, headers }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const del = useMutation({
    mutationFn: () => deleteTask({ data: { id: t.id }, headers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task removed");
    },
  });

  const unlinkAlert = useMutation({
    mutationFn: (alertId: string) =>
      unlinkAlertFromTask({ data: { alertId }, headers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-alerts", t.id] });
      toast.success("Alert unlinked from task");
    },
  });

  return (
    <div className="border border-border rounded-sm p-2.5 bg-card/50 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {t.symbol && (
              <Link
                to="/terminal/$symbol"
                params={{ symbol: t.symbol } as any}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary hover:bg-primary/20"
              >
                {t.symbol}
              </Link>
            )}
            <p className="text-xs font-medium leading-tight break-words">
              {t.title}
            </p>
            {t.symbol && (
              <button
                onClick={() => setShowAlertCreate(true)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-green-500/10 text-green-500 hover:bg-green-500/20 flex items-center gap-1"
              >
                <Bell className="w-3 h-3" /> Alert
              </button>
            )}
          </div>
          {t.description && (
            <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap break-words">
              {t.description}
            </p>
          )}
          {t.due_date && (
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">
              Due {new Date(t.due_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          onClick={() => del.mutate()}
          className="text-muted-foreground hover:text-[color:var(--bear)] shrink-0"
          aria-label="Remove"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Related Alerts Section */}
      <div className="mt-2 pt-2 border-t border-border/50">
        <button
          onClick={() => setShowRelatedAlerts(!showRelatedAlerts)}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Bell className="w-3 h-3" />
          {showRelatedAlerts ? "Hide" : "Show"} related alerts
        </button>

        {showRelatedAlerts && (
          <div className="mt-2 space-y-1">
            {alertsData?.alerts && alertsData.alerts.length > 0 ? (
              alertsData.alerts.map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between text-[10px] bg-muted/30 rounded px-2 py-1">
                  <span className="text-muted-foreground">
                    {alert.alert_type} @ {alert.threshold}
                  </span>
                  <button
                    onClick={() => unlinkAlert.mutate(alert.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Unlink
                  </button>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-muted-foreground italic">No linked alerts</p>
            )}
          </div>
        )}
      </div>

      {/* Quick Alert Creation */}
      {showAlertCreate && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <QuickAlertForm
            symbol={t.symbol}
            taskId={t.id}
            headers={headers}
            onClose={() => setShowAlertCreate(false)}
            onSuccess={() => {
              setShowAlertCreate(false);
              toast.success("Alert created for this task");
            }}
          />
        </div>
      )}

      <div className="mt-2">
        <Select
          value={t.status}
          onValueChange={(v) => upd.mutate(v as TaskStatus)}
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-[11px]">
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});

function NewTaskForm({
  headers,
  onCreated,
}: {
  headers?: HeadersInit;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [symbol, setSymbol] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [disableAlertsOnComplete, setDisableAlertsOnComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addTask({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          symbol: symbol.trim() ? symbol.trim().toUpperCase() : null,
          status,
          dueDate: dueDate || null,
          disableAlertsOnComplete,
        },
        headers,
      });
      toast.success("Task created");
      setTitle("");
      setDescription("");
      setSymbol("");
      setStatus("todo");
      setDueDate("");
      setDisableAlertsOnComplete(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Review Q3 earnings"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-sym">Ticker (optional)</Label>
        <Input
          id="task-sym"
          maxLength={20}
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="AAPL"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="due">Due</Label>
        <Input
          id="due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy}>
        <Plus className="w-3.5 h-3.5 mr-1" />
        {busy ? "Creating…" : "Add task"}
      </Button>
      <div className="space-y-1.5 md:col-span-6">
        <Label htmlFor="desc">Notes (optional)</Label>
        <Textarea
          id="desc"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details, links, key questions…"
          rows={2}
        />
      </div>
      <div className="space-y-1.5 md:col-span-6 flex items-center gap-2">
        <Switch
          id="disable-alerts"
          checked={disableAlertsOnComplete}
          onCheckedChange={setDisableAlertsOnComplete}
        />
        <Label htmlFor="disable-alerts" className="text-[11px] text-muted-foreground">
          Auto-disable linked alerts when task is completed
        </Label>
      </div>
    </form>
  );
}

function QuickAlertForm({
  symbol,
  taskId,
  headers,
  onClose,
  onSuccess,
}: {
  symbol: string;
  taskId: string;
  headers?: HeadersInit;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<AlertType>("price_above");
  const [threshold, setThreshold] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      if (!headers) return { tasks: [] } as any;
      try {
        return await listTasks({ headers });
      } catch {
        return { tasks: [] } as any;
      }
    },
    enabled: !!headers,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addAlert({
        data: {
          symbol: symbol.trim().toUpperCase(),
          alertType: type,
          threshold: Number(threshold),
          taskId: taskId,
        },
        headers,
      });
      onSuccess();
      qc.invalidateQueries({ queryKey: ["task-alerts", taskId] });
      setThreshold("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create alert");
    } finally {
      setBusy(false);
    }
  };

  const ALERT_TYPES = [
    { v: "price_above" as const, label: "Price ≥" },
    { v: "price_below" as const, label: "Price ≤" },
    { v: "rsi_above" as const, label: "RSI ≥" },
    { v: "rsi_below" as const, label: "RSI ≤" },
    { v: "near_52w_high" as const, label: "Near 52w high %" },
    { v: "near_52w_low" as const, label: "Near 52w low %" },
    { v: "pct_change_above" as const, label: "5d perf ≥ %" },
    { v: "pct_change_below" as const, label: "5d perf ≤ %" },
  ];

  return (
    <form onSubmit={submit} className="flex gap-2 items-end">
      <div className="flex-1 space-y-1">
        <Label className="text-[10px]">Condition</Label>
        <Select value={type} onValueChange={(v) => setType(v as AlertType)}>
          <SelectTrigger className="h-6 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALERT_TYPES.map((t) => (
              <SelectItem key={t.v} value={t.v} className="text-[10px]">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-20 space-y-1">
        <Label className="text-[10px]">Threshold</Label>
        <Input
          required
          type="number"
          step="any"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="h-6 text-[10px]"
        />
      </div>
      <Button type="submit" size="sm" disabled={busy} className="h-6 text-[10px]">
        {busy ? "Creating…" : "Create"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-6 text-[10px]">
        Cancel
      </Button>
    </form>
  );
}
