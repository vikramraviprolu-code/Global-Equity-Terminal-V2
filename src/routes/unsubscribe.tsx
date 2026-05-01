import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: z.object({ token: z.string().optional() }),
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe — Global Equity Terminal" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "invalid"; reason: string }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; reason: string };

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", reason: "Missing token" });
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setState({ kind: "invalid", reason: j.error ?? "Invalid token" });
          return;
        }
        if (j.valid === false && j.reason === "already_unsubscribed") {
          setState({ kind: "already" });
        } else if (j.valid) {
          setState({ kind: "ready" });
        } else {
          setState({ kind: "invalid", reason: "Invalid token" });
        }
      })
      .catch((e) => setState({ kind: "invalid", reason: e.message }));
  }, [token]);

  const submit = async () => {
    if (!token) return;
    setState({ kind: "submitting" });
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState({ kind: "error", reason: j.error ?? "Failed" });
        return;
      }
      if (j.success) setState({ kind: "done" });
      else if (j.reason === "already_unsubscribed") setState({ kind: "already" });
      else setState({ kind: "error", reason: "Failed" });
    } catch (e: any) {
      setState({ kind: "error", reason: e?.message ?? "Failed" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full panel">
        <div className="panel-header">Email preferences</div>
        <div className="p-6 space-y-4">
          {state.kind === "loading" && (
            <p className="text-sm text-muted-foreground">Verifying your link…</p>
          )}
          {state.kind === "ready" && (
            <>
              <h1 className="text-lg font-semibold">Unsubscribe from emails</h1>
              <p className="text-sm text-muted-foreground">
                Click below to stop receiving emails from Global Equity Terminal at this address.
              </p>
              <button
                onClick={submit}
                className="text-[11px] font-mono uppercase tracking-wider bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90"
              >
                Confirm unsubscribe
              </button>
            </>
          )}
          {state.kind === "submitting" && (
            <p className="text-sm text-muted-foreground">Processing…</p>
          )}
          {state.kind === "done" && (
            <>
              <h1 className="text-lg font-semibold">You're unsubscribed</h1>
              <p className="text-sm text-muted-foreground">
                We'll no longer send emails to this address. You can still use the terminal in-app.
              </p>
            </>
          )}
          {state.kind === "already" && (
            <>
              <h1 className="text-lg font-semibold">Already unsubscribed</h1>
              <p className="text-sm text-muted-foreground">
                This address is no longer receiving emails from us.
              </p>
            </>
          )}
          {state.kind === "invalid" && (
            <>
              <h1 className="text-lg font-semibold">Link invalid or expired</h1>
              <p className="text-sm text-muted-foreground">{state.reason}</p>
            </>
          )}
          {state.kind === "error" && (
            <>
              <h1 className="text-lg font-semibold">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">{state.reason}</p>
              <button
                onClick={submit}
                className="text-[11px] font-mono uppercase tracking-wider bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
