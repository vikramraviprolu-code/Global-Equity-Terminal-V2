import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertBell } from "@/components/alert-bell";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserCog, ChevronDown } from "lucide-react";
import { toast } from "sonner";

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

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out");
    } catch (e: any) {
      toast.error(e?.message ?? "Sign-out failed");
    }
  };

  // Sign out the current user, then open the auth popup so they can sign in
  // as a different user — without losing the current tab.
  const handleSwitchUser = async () => {
    try {
      await signOut();
      openAuthPopup();
    } catch (e: any) {
      toast.error(e?.message ?? "Switch user failed");
    }
  };

  const initial = (user.email ?? "?").trim().charAt(0).toUpperCase();

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px] font-mono"
            aria-label="Account menu"
          >
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
              {initial}
            </span>
            <span className="hidden md:inline truncate max-w-[140px] normal-case">
              {user.email}
            </span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Signed in as
          </DropdownMenuLabel>
          <div className="px-2 pb-2 text-xs truncate" title={user.email ?? ""}>
            {user.email}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void handleSwitchUser()}>
            <UserCog className="w-3.5 h-3.5 mr-2" />
            Switch user…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleSignOut()}>
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
