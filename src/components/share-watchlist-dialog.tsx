import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createShare, listShares, revokeShare } from "@/server/share.functions";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";

interface ShareWatchlistDialogProps {
  open: boolean;
  onClose: () => void;
  listName: string;
  symbols: string[];
}

export function ShareWatchlistDialog({ open, onClose, listName, symbols }: ShareWatchlistDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expiresInDays, setExpiresInDays] = useState<string>("never");

  const sharesQ = useQuery({
    queryKey: ["shares"],
    queryFn: () => listShares(),
    enabled: open && !!user,
  });

  const createMut = useMutation({
    mutationFn: () => createShare({
      data: {
        name: listName,
        symbols,
        expiresInDays: expiresInDays === "never" ? null : Number(expiresInDays),
      },
    }),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: ["shares"] });
      const url = `${window.location.origin}/w/${row.token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied", { description: url });
      } catch {
        toast.success("Share link created", { description: url });
      }
    },
    onError: (e: any) => toast.error("Couldn't create share", { description: e?.message }),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeShare({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
      toast.success("Share revoked");
    },
  });

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const activeShares = (sharesQ.data ?? []).filter((s) => !s.revoked_at);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="panel w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header flex items-center justify-between">
          <span>Share "{listName}"</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>
        <div className="p-4 space-y-4 text-xs">
          {!user ? (
            <div className="text-muted-foreground">
              <p>Sign in to create a shareable link for this watchlist.</p>
              <Link to="/auth" className="inline-block mt-3 font-mono text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-3 py-2 rounded hover:opacity-90">
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <div>
                <p className="text-muted-foreground leading-relaxed">
                  Creates a read-only public link. Recipients see live metrics for these {symbols.length} ticker{symbols.length === 1 ? "" : "s"} but can't edit or copy the list back to you. The snapshot is fixed at share time — adding/removing tickers later won't update existing links.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground">Expires</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 font-mono text-[11px]"
                >
                  <option value="never">Never</option>
                  <option value="1">In 1 day</option>
                  <option value="7">In 7 days</option>
                  <option value="30">In 30 days</option>
                  <option value="90">In 90 days</option>
                </select>
                <button
                  disabled={createMut.isPending || symbols.length === 0}
                  onClick={() => createMut.mutate()}
                  className="ml-auto font-mono text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
                >
                  {createMut.isPending ? "Creating…" : "Create link"}
                </button>
              </div>

              <div className="border-t border-border pt-3">
                <div className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground mb-2">Your active shares</div>
                {sharesQ.isLoading ? (
                  <div className="text-muted-foreground">Loading…</div>
                ) : activeShares.length === 0 ? (
                  <div className="text-muted-foreground">None yet.</div>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto">
                    {activeShares.map((s) => {
                      const url = `${window.location.origin}/w/${s.token}`;
                      const expired = s.expires_at && new Date(s.expires_at) < new Date();
                      return (
                        <li key={s.id} className="flex items-center gap-2 text-[11px]">
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-mono">{s.name}</div>
                            <div className="text-muted-foreground text-[10px]">
                              {s.symbols?.length ?? 0} tickers · {s.view_count} views
                              {s.expires_at && (
                                <span className={expired ? "text-destructive ml-1" : "ml-1"}>
                                  · {expired ? "expired" : `expires ${new Date(s.expires_at).toLocaleDateString()}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}
                            className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => { if (confirm("Revoke this share link?")) revokeMut.mutate(s.id); }}
                            disabled={revokeMut.isPending}
                            className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-destructive hover:text-destructive disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
