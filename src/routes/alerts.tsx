import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listAlerts, addAlert, deleteAlert, toggleAlert, evaluateMyAlerts, type AlertType } from "@/server/alerts.functions";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { AuthNav } from "@/components/auth-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const TYPES: { v: AlertType; label: string; hint: string }[] = [
  { v: "price_above", label: "Price ≥", hint: "Triggers when last price crosses above the threshold." },
  { v: "price_below", label: "Price ≤", hint: "Triggers when last price drops below the threshold." },
  { v: "rsi_above", label: "RSI ≥", hint: "Overbought signal (e.g. 70)." },
  { v: "rsi_below", label: "RSI ≤", hint: "Oversold signal (e.g. 30)." },
  { v: "near_52w_high", label: "Near 52w high (within %)", hint: "Triggers when within X% of 52-week high." },
  { v: "near_52w_low", label: "Near 52w low (within %)", hint: "Triggers when within X% of 52-week low." },
  { v: "pct_change_above", label: "5d perf ≥ %", hint: "5-day performance crosses above threshold." },
  { v: "pct_change_below", label: "5d perf ≤ %", hint: "5-day performance drops below threshold." },
];

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — Global Equity Terminal" },
      { name: "description", content: "Set price, RSI, and 52w-range alerts on any global ticker. Get notified in-app the moment they trigger." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  if (loading || !user) return null;
  return <AlertsContent />;
}

function AlertsContent() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  const { data, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      if (!authHeaders) return { alerts: [] } as any;
      try {
        return await listAlerts({ headers: authHeaders });
      } catch {
        return { alerts: [] } as any;
      }
    },
    enabled: !!token,
    retry: false,
  });

  const evalMut = useMutation({
    mutationFn: () => authHeaders ? evaluateMyAlerts({ data: undefined as any, headers: authHeaders }) : Promise.resolve({ fired: 0 }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["alert-events"] });
      toast.success(r.fired === 0 ? "Checked — nothing triggered" : `${r.fired} alert${r.fired === 1 ? "" : "s"} triggered`);
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav right={<AuthNav />} />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-xl font-mono uppercase tracking-widest text-primary">Alerts</h1>
            <p className="text-xs text-muted-foreground mt-1">Custom alerts on price, RSI, 52w range, and momentum. Triggered alerts appear in the bell icon.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => evalMut.mutate()} disabled={evalMut.isPending}>
              {evalMut.isPending ? "Checking…" : "Check now"}
            </Button>
            <Link to="/portfolio" className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded border border-border hover:bg-muted self-center">Portfolio</Link>
          </div>
        </div>

        <Card className="mb-5">
          <CardHeader><CardTitle className="text-sm font-mono uppercase tracking-widest">New alert</CardTitle></CardHeader>
          <CardContent><NewAlertForm headers={authHeaders} onCreated={() => qc.invalidateQueries({ queryKey: ["alerts"] })} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-mono uppercase tracking-widest">Active alerts</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
            ) : !data?.alerts.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No alerts yet. Create one above.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b border-border">
                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left font-mono uppercase tracking-wider">
                      <th>Symbol</th><th>Condition</th><th>Threshold</th><th>Last fired</th><th>Active</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alerts.map((a: any) => <AlertRow key={a.id} a={a} headers={authHeaders} />)}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <Disclaimer />
      </main>
    </div>
  );
}

function AlertRow({ a, headers }: { a: any; headers?: HeadersInit }) {
  const qc = useQueryClient();
  const tog = useMutation({
    mutationFn: (active: boolean) => toggleAlert({ data: { id: a.id, active }, headers }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
  const del = useMutation({
    mutationFn: () => deleteAlert({ data: { id: a.id }, headers }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); toast.success("Alert removed"); },
  });
  const typeMeta = TYPES.find((t) => t.v === a.alert_type);
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30">
      <td className="px-3 py-2 font-mono">
        <Link to="/terminal/$symbol" params={{ symbol: a.symbol } as any} className="text-primary hover:underline">{a.symbol}</Link>
      </td>
      <td className="px-3 py-2">{typeMeta?.label ?? a.alert_type}</td>
      <td className="px-3 py-2 font-mono">{a.threshold}</td>
      <td className="px-3 py-2 text-muted-foreground">{a.last_fired_at ? new Date(a.last_fired_at).toLocaleString() : "—"}</td>
      <td className="px-3 py-2"><Switch checked={a.active} onCheckedChange={(v) => tog.mutate(v)} /></td>
      <td className="px-3 py-2">
        <button onClick={() => del.mutate()} className="text-muted-foreground hover:text-[color:var(--bear)]" aria-label="Remove">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

function NewAlertForm({ headers, onCreated }: { headers?: HeadersInit; onCreated: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<AlertType>("price_above");
  const [threshold, setThreshold] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = TYPES.find((t) => t.v === type);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addAlert({ data: { symbol: symbol.trim().toUpperCase(), alertType: type, threshold: Number(threshold) }, headers });
      toast.success(`Alert created for ${symbol.toUpperCase()}`);
      setSymbol(""); setThreshold("");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create alert");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
      <div className="space-y-1.5">
        <Label htmlFor="sym">Symbol</Label>
        <Input id="sym" required value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="AAPL" />
      </div>
      <div className="space-y-1.5">
        <Label>Condition</Label>
        <Select value={type} onValueChange={(v) => setType(v as AlertType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="th">Threshold</Label>
        <Input id="th" required type="number" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy}><Plus className="w-3.5 h-3.5 mr-1" /> {busy ? "Creating…" : "Create alert"}</Button>
      {meta && <p className="md:col-span-4 text-[11px] text-muted-foreground -mt-1">{meta.hint}</p>}
    </form>
  );
}
