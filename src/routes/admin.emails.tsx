import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getEmailDashboard, isCurrentUserAdmin } from "@/server/admin-emails.functions";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/emails")({
  head: () => ({
    meta: [
      { title: "Email Monitoring — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminEmailsPage,
});

const RANGES = [
  { v: 24, label: "Last 24h" },
  { v: 24 * 7, label: "Last 7d" },
  { v: 24 * 30, label: "Last 30d" },
];

function fmtMs(ms: number) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    sent: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    pending: "bg-muted text-muted-foreground border-border",
    suppressed: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
    dlq: "bg-destructive/20 text-destructive border-destructive/40",
    bounced: "bg-destructive/15 text-destructive border-destructive/30",
    complained: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border font-mono text-[10px] uppercase tracking-widest ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

function AdminEmailsPage() {
  const { user, loading: authLoading } = useAuth();
  const [rangeHours, setRangeHours] = useState(24 * 7);
  const [template, setTemplate] = useState<string>("");
  const [status, setStatus] = useState<"all" | "sent" | "failed" | "dlq" | "suppressed" | "pending">("all");

  const adminCheck = useQuery({
    queryKey: ["isAdmin", user?.id],
    queryFn: () => isCurrentUserAdmin(),
    enabled: !!user,
  });

  const isAdmin = !!adminCheck.data?.isAdmin;

  const dash = useQuery({
    queryKey: ["emailDashboard", rangeHours, template, status],
    queryFn: () => getEmailDashboard({ data: { rangeHours, template: template || undefined, status, limit: 200 } }),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  if (authLoading || adminCheck.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-[1400px] mx-auto px-4 py-12 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-[1400px] mx-auto px-4 py-12">
          <Card className="max-w-md">
            <CardHeader><CardTitle>Sign in required</CardTitle></CardHeader>
            <CardContent>
              <Link to="/auth" className="text-primary underline">Go to sign in</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-[1400px] mx-auto px-4 py-12">
          <Card className="max-w-md border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-4 w-4" /> Admins only
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This page contains sensitive deliverability data and is restricted to administrators.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const data = dash.data;
  const stats = data?.stats;
  const latency = data?.latency;
  const retries = data?.retries;
  const rows = data?.rows ?? [];
  const templates = data?.templates ?? [];

  const failureRate = stats && stats.totalUnique > 0 ? ((stats.failed / stats.totalUnique) * 100).toFixed(1) : "0.0";
  const showAlert = (stats?.recentFailures ?? 0) >= 3 || (latency?.p95_ms ?? 0) > 30_000;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Admin · Email Monitoring</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Deliverability, queue latency, and retries from <code className="font-mono">email_send_log</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(rangeHours)} onValueChange={(v) => setRangeHours(Number(v))}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => <SelectItem key={r.v} value={String(r.v)}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={template || "all"} onValueChange={(v) => setTemplate(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="All templates" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="dlq">DLQ</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        {showAlert && (
          <div className="flex items-start gap-3 rounded border border-destructive/40 bg-destructive/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-destructive">Deliverability alert</div>
              <div className="text-muted-foreground">
                {stats?.recentFailures ?? 0} failures in the last 24h
                {latency && latency.p95_ms > 30_000 ? ` · queue p95 latency ${fmtMs(latency.p95_ms)}` : ""}.
                Investigate failing rows below.
              </div>
            </div>
          </div>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Unique emails" value={stats?.totalUnique ?? 0} />
          <StatCard label="Sent" value={stats?.sent ?? 0} tone="ok" />
          <StatCard label="Failed / DLQ" value={stats?.failed ?? 0} tone={(stats?.failed ?? 0) > 0 ? "bad" : undefined} />
          <StatCard label="Suppressed" value={stats?.suppressed ?? 0} tone="warn" />
          <StatCard label="Pending" value={stats?.pending ?? 0} />
          <StatCard label="Failure rate" value={`${failureRate}%`} tone={Number(failureRate) > 5 ? "bad" : undefined} />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Queue latency (pending → final)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 font-mono">
              <Stat tag="p50" v={fmtMs(latency?.p50_ms ?? 0)} />
              <Stat tag="p95" v={fmtMs(latency?.p95_ms ?? 0)} tone={(latency?.p95_ms ?? 0) > 30_000 ? "bad" : undefined} />
              <Stat tag="max" v={fmtMs(latency?.max_ms ?? 0)} />
              <div className="col-span-3 text-[11px] text-muted-foreground">
                Sample size: {latency?.count ?? 0} messages
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Retries</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 font-mono">
              <Stat tag="retried" v={String(retries?.retried ?? 0)} />
              <Stat tag="total retries" v={String(retries?.totalRetries ?? 0)} />
              <Stat tag="max attempts" v={String((retries?.maxRetries ?? 0) + 1)} />
              <div className="col-span-3 text-[11px] text-muted-foreground">
                Of {retries?.totalMessages ?? 0} unique messages
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent emails ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Template</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px]">Attempts</TableHead>
                  <TableHead className="w-[180px]">Time</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">No emails for this filter.</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.template}</TableCell>
                    <TableCell className="font-mono text-xs">{r.recipient}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.attempts > 1 ? <Badge variant="outline" className="font-mono">{r.attempts}</Badge> : r.attempts}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-destructive max-w-[320px] truncate" title={r.error ?? undefined}>
                      {r.error ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Disclaimer />
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" | "bad" }) {
  const toneClass = tone === "ok" ? "text-emerald-500" : tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return (
    <div className="rounded border border-border bg-card px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono text-2xl mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

function Stat({ tag, v, tone }: { tag: string; v: string; tone?: "bad" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{tag}</div>
      <div className={`text-lg ${tone === "bad" ? "text-destructive" : "text-foreground"}`}>{v}</div>
    </div>
  );
}
