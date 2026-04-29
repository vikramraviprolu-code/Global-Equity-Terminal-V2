import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getPortfolio, addHolding, deleteHolding } from "@/server/portfolio.functions";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav, Disclaimer } from "@/components/site-nav";
import { AuthNav } from "@/components/auth-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtPrice, fmtPct, colorFor } from "@/lib/format";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { MetricLabel } from "@/components/metric-label";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Global Equity Terminal" },
      { name: "description", content: "Track your holdings with live P&L, allocation by sector and region, and custom alerts." },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  if (loading || !user) return null;
  return <PortfolioContent />;
}

function PortfolioContent() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => getPortfolio(),
    refetchInterval: 5 * 60 * 1000,
  });
  const [open, setOpen] = useState(false);

  const removeMut = useMutation({
    mutationFn: (id: string) => deleteHolding({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portfolio"] }); toast.success("Holding removed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove"),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav right={<AuthNav />} />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-xl font-mono uppercase tracking-widest text-primary">Portfolio</h1>
            <p className="text-xs text-muted-foreground mt-1">Live valuation, P&L, and allocation across your holdings.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/alerts" className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded border border-border hover:bg-muted">Alerts</Link>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Add holding</Button></DialogTrigger>
              <DialogContent>
                <AddHoldingForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["portfolio"] }); }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Stat label="Cost basis" value={fmtPrice(data?.totals.cost ?? 0, "USD")} mono />
          <Stat label="Market value" value={fmtPrice(data?.totals.value ?? 0, "USD")} mono />
          <Stat label="Unrealized P&L" value={fmtPrice(data?.totals.pnl ?? 0, "USD")} cls={colorFor(data?.totals.pnl ?? 0)} mono />
          <Stat label="Return" value={fmtPct(data?.totals.pnlPct ?? 0)} cls={colorFor(data?.totals.pnlPct ?? 0)} mono />
        </div>

        {/* Allocation */}
        {data && data.positions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <AllocationCard title="By sector" rows={data.allocation.bySector} />
            <AllocationCard title="By region" rows={data.allocation.byRegion} />
          </div>
        )}

        {/* Positions */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-mono uppercase tracking-widest">Positions</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
            ) : !data || data.positions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">No holdings yet.</p>
                <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add your first holding</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b border-border">
                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left font-mono uppercase tracking-wider">
                      <th>Symbol</th><th>Shares</th><th className="text-right"><MetricLabel term="costBasis">Cost</MetricLabel></th>
                      <th className="text-right">Price</th><th className="text-right"><MetricLabel term="allocation">Value</MetricLabel></th>
                      <th className="text-right"><MetricLabel term="unrealizedPnl">P&L</MetricLabel></th><th className="text-right">%</th>
                      <th>Sector</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.positions.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono">
                          <Link to="/terminal/$symbol" params={{ symbol: p.symbol } as any} className="text-primary hover:underline">{p.symbol}</Link>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{p.name}</div>
                        </td>
                        <td className="px-3 py-2 font-mono">{p.shares}</td>
                        <td className="px-3 py-2 font-mono text-right">{fmtPrice(p.costBasis, p.currency)}</td>
                        <td className="px-3 py-2 font-mono text-right">{p.price != null ? fmtPrice(p.price, p.currency) : "—"}</td>
                        <td className="px-3 py-2 font-mono text-right">{p.value != null ? fmtPrice(p.value, p.currency) : "—"}</td>
                        <td className={`px-3 py-2 font-mono text-right ${colorFor(p.pnl)}`}>{p.pnl != null ? fmtPrice(p.pnl, p.currency) : "—"}</td>
                        <td className={`px-3 py-2 font-mono text-right ${colorFor(p.pnlPct)}`}>{p.pnlPct != null ? fmtPct(p.pnlPct) : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.sector}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => { if (confirm(`Remove ${p.symbol}?`)) removeMut.mutate(p.id); }}
                            className="text-muted-foreground hover:text-[color:var(--bear)]"
                            aria-label="Remove"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
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

function Stat({ label, value, cls, mono }: { label: string; value: string; cls?: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border bg-card px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg ${mono ? "font-mono" : ""} ${cls ?? ""}`}>{value}</div>
    </div>
  );
}

function AllocationCard({ title, rows }: { title: string; rows: { key: string; value: number; pct: number }[] }) {
  const top = rows.slice(0, 8);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-mono uppercase tracking-widest">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {top.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <div className="w-24 truncate font-mono">{r.key}</div>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, r.pct)}%` }} />
            </div>
            <div className="w-14 text-right font-mono text-muted-foreground">{r.pct.toFixed(1)}%</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AddHoldingForm({ onDone }: { onDone: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addHolding({ data: {
        symbol: symbol.trim().toUpperCase(),
        shares: Number(shares),
        costBasis: Number(costBasis),
        currency: currency.toUpperCase(),
      }});
      toast.success(`${symbol.toUpperCase()} added`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add holding");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <DialogHeader><DialogTitle>Add holding</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="sym">Symbol</Label>
          <Input id="sym" required placeholder="AAPL or RELIANCE.NS" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sh">Shares</Label>
          <Input id="sh" required type="number" step="any" min="0.0001" value={shares} onChange={(e) => setShares(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cb">Cost basis / share</Label>
          <Input id="cb" required type="number" step="any" min="0" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="ccy">Currency</Label>
          <Input id="ccy" required value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD, EUR, INR…" />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
      </DialogFooter>
    </form>
  );
}
