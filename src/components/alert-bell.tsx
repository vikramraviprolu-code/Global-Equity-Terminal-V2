import { Bell, BellRing } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { listAlertEvents, evaluateMyAlerts, markAlertEventsRead } from "@/server/alerts.functions";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AlertBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const lastSeenIds = useRef<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["alert-events", user?.id],
    queryFn: () => listAlertEvents(),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Periodically evaluate alerts server-side while the user is active
  const evalMut = useMutation({
    mutationFn: () => evaluateMyAlerts({ data: undefined as any }),
    onSuccess: (r) => { if (r.fired > 0) qc.invalidateQueries({ queryKey: ["alert-events"] }); },
  });
  useEffect(() => {
    if (!user) return;
    evalMut.mutate();
    const t = setInterval(() => evalMut.mutate(), 5 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Toast on newly arriving unread events
  useEffect(() => {
    if (!data?.events) return;
    const fresh = data.events.filter((e: any) => !e.read && !lastSeenIds.current.has(e.id));
    fresh.forEach((e: any) => {
      toast(e.message, {
        action: { label: "View", onClick: () => navigate({ to: "/terminal/$symbol", params: { symbol: e.symbol } as any }) },
      });
      lastSeenIds.current.add(e.id);
    });
  }, [data?.events, navigate]);

  const markRead = useMutation({
    mutationFn: () => markAlertEventsRead({ data: undefined as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-events"] }),
  });

  if (!user) return null;
  const unread = data?.unreadCount ?? 0;
  const events = data?.events ?? [];

  return (
    <Popover onOpenChange={(o) => { if (o && unread > 0) markRead.mutate(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center w-7 h-7 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label={`Notifications (${unread} unread)`}
        >
          {unread > 0 ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-mono text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider">Alerts</span>
          <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => navigate({ to: "/alerts" })}>
            Manage
          </Button>
        </div>
        <div className="max-h-80 overflow-auto">
          {events.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No alerts yet. Create one on the <button className="underline" onClick={() => navigate({ to: "/alerts" })}>Alerts page</button>.
            </div>
          ) : events.map((e: any) => (
            <button
              key={e.id}
              onClick={() => navigate({ to: "/terminal/$symbol", params: { symbol: e.symbol } as any })}
              className="w-full text-left px-3 py-2 border-b border-border last:border-0 hover:bg-muted/40"
            >
              <div className="text-xs">{e.message}</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {new Date(e.created_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
