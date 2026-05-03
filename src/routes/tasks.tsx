import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listTasks,
  addTask,
  updateTaskStatus,
  deleteTask,
  TASK_STATUSES,
  type TaskStatus,
} from "@/server/tasks.functions";
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
import { Trash2, Plus, ListTodo } from "lucide-react";
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

function TaskCard({ t, headers }: { t: any; headers?: HeadersInit }) {
  const qc = useQueryClient();
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
}

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
        },
        headers,
      });
      toast.success("Task created");
      setTitle("");
      setDescription("");
      setSymbol("");
      setStatus("todo");
      setDueDate("");
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
    </form>
  );
}
