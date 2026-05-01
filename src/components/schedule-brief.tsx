import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBriefSchedule, upsertBriefSchedule } from "@/server/v17.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lets a signed-in user opt in to a daily AI Morning Brief generation
 * over the symbols currently in view. Stored in brief_schedules; the
 * hourly pg_cron hits /api/public/hooks/run-scheduled-briefs and writes
 * a new row to brief_runs at the selected UTC hour.
 *
 * v1.8 — optional email delivery to the user's auth email (or override).
 */
export function ScheduleBrief({ symbols }: { symbols: string[] }) {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.session);
      setAuthEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s);
      setAuthEmail(s?.user?.email ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["brief-schedule"],
    queryFn: () => getBriefSchedule(),
    enabled: authed === true,
    staleTime: 30_000,
  });

  const schedule = data?.schedule as any;
  const [enabled, setEnabled] = useState<boolean>(false);
  const [hour, setHour] = useState<number>(13);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(false);
  const [emailTo, setEmailTo] = useState<string>("");

  useEffect(() => {
    if (schedule) {
      setEnabled(!!schedule.enabled);
      setHour(typeof schedule.hour_utc === "number" ? schedule.hour_utc : 13);
      setEmailEnabled(!!schedule.email_enabled);
      setEmailTo(schedule.email_to ?? "");
    }
  }, [schedule?.id, schedule?.hour_utc, schedule?.enabled, schedule?.email_enabled, schedule?.email_to]);

  const save = useMutation({
    mutationFn: () =>
      upsertBriefSchedule({
        data: {
          enabled,
          hourUtc: hour,
          symbols: symbols.slice(0, 30),
          emailEnabled,
          emailTo: emailEnabled && emailTo.trim() ? emailTo.trim() : null,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brief-schedule"] }),
  });

  if (authed !== true) return null;

  const localPreview = (() => {
    const d = new Date();
    d.setUTCHours(hour, 0, 0, 0);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  })();

  const effectiveEmail = emailTo.trim() || authEmail || "(no address)";

  return (
    <div className="panel mt-4">
      <div className="panel-header flex items-center justify-between">
        <span>Scheduled Morning Brief</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {schedule?.last_run_at ? `last run ${new Date(schedule.last_run_at).toLocaleString()}` : "not run yet"}
        </span>
      </div>
      <div className="p-5 grid gap-3 md:grid-cols-[auto_auto_1fr_auto] items-center">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-primary"
          />
          <span>Generate daily for these {symbols.length} ticker{symbols.length === 1 ? "" : "s"}</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Hour (UTC)</span>
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            disabled={!enabled}
            className="bg-background border border-border rounded px-2 py-1 text-sm font-mono disabled:opacity-50"
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </select>
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">
          ≈ {localPreview} your local time
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || isLoading || symbols.length === 0}
          className="text-[10px] font-mono uppercase tracking-wider bg-primary text-primary-foreground px-3 py-2 rounded hover:opacity-90 disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : schedule ? "Update" : "Save"}
        </button>
      </div>

      {/* v1.8 — Email delivery */}
      <div className="px-5 pb-3 grid gap-2 md:grid-cols-[auto_1fr] items-center border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
            disabled={!enabled}
            className="accent-primary disabled:opacity-50"
          />
          <span>Also email it to me</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="email"
            placeholder={authEmail ?? "you@example.com"}
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            disabled={!enabled || !emailEnabled}
            className="bg-background border border-border rounded px-2 py-1 text-sm font-mono w-full max-w-xs disabled:opacity-50"
          />
          <span className="text-[10px] text-muted-foreground font-mono">
            {emailEnabled ? `→ ${effectiveEmail}` : "uses your account email"}
          </span>
        </div>
      </div>

      <div className="px-5 pb-4 text-[10px] text-muted-foreground font-mono">
        Each day at the chosen hour we generate a fresh brief over your saved tickers and store it in your brief history.
        {emailEnabled ? " A copy is also delivered by email." : ""}
      </div>
    </div>
  );
}
