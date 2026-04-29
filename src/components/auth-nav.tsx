import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertBell } from "@/components/alert-bell";

export function AuthNav() {
  const { user, signOut, loading } = useAuth();
  if (loading) return <div className="w-16" />;
  if (!user) {
    return (
      <Link
        to="/auth"
        className="px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider border border-primary/40 text-primary hover:bg-primary/10"
      >
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
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
