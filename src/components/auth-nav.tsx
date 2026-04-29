import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertBell } from "@/components/alert-bell";
import { supabase } from "@/integrations/supabase/client";

/**
 * Open /auth in a new tab. After successful auth, the popup tab posts
 * `get-auth-success` and closes itself; this tab refreshes its session.
 *
 * If the popup is blocked, save the current URL to sessionStorage and
 * navigate /auth in the same tab — the auth page reads that value and
 * offers a "Back to where you were" button after success.
 */
function openAuthPopup() {
  if (typeof window === "undefined") return;

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    const data = e?.data;
    if (data && typeof data === "object" && data.type === "get-auth-success") {
      void supabase.auth.getSession();
    }
  };
  window.addEventListener("message", onMessage);
  setTimeout(() => window.removeEventListener("message", onMessage), 10 * 60 * 1000);

  const w = window.open("/auth?popup=1", "_blank", "noopener=no,noreferrer=no");
  if (!w || w.closed || typeof w.closed === "undefined") {
    try {
      const here = window.location.pathname + window.location.search + window.location.hash;
      sessionStorage.setItem("auth:return-to", here);
    } catch {}
    window.location.href = "/auth";
  }
}

export function AuthNav() {
  const { user, signOut, loading } = useAuth();
  if (loading) return <div className="w-16" />;
  if (!user) {
    return (
      <a
        href="/auth?popup=1"
        target="_blank"
        rel="noopener"
        onClick={(e) => { e.preventDefault(); openAuthPopup(); }}
        className="px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider border border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
      >
        Sign in
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link
        to="/"
        className="hidden sm:inline text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
        title="Back to landing page"
      >
        Home
      </Link>
      <AlertBell />
      <span className="hidden md:inline text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">
        {user.email}
      </span>
      <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  );
}
