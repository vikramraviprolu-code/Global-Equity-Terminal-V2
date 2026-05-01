import { useEffect } from "react";
import { toast } from "sonner";
import { APP_VERSION, APP_CODENAME } from "@/lib/version";

const STORAGE_KEY = "et:lastSeenVersion";

/**
 * Shows a one-time toast when APP_VERSION changes for this user.
 *
 * - First-ever visit (no stored version): silent — we don't toast newcomers.
 * - Stored version differs from current: show toast, link to /changelog.
 * - Stored version matches: no-op.
 *
 * Stored under localStorage["et:lastSeenVersion"]. Clearing it re-shows the toast.
 */
export function WhatsNewToast() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return; // private mode / storage disabled — skip
    }

    if (stored === APP_VERSION) return;

    // First visit: stamp current version and stay silent.
    if (!stored) {
      try {
        window.localStorage.setItem(STORAGE_KEY, APP_VERSION);
      } catch {}
      return;
    }

    // Defer slightly so it doesn't compete with route-load toasts.
    const id = window.setTimeout(() => {
      toast(`What's new in v${APP_VERSION} "${APP_CODENAME}"`, {
        description: "Tap to see the full changelog.",
        duration: 8000,
        action: {
          label: "View",
          onClick: () => {
            window.location.href = "/changelog";
          },
        },
        onDismiss: () => {
          try {
            window.localStorage.setItem(STORAGE_KEY, APP_VERSION);
          } catch {}
        },
        onAutoClose: () => {
          try {
            window.localStorage.setItem(STORAGE_KEY, APP_VERSION);
          } catch {}
        },
      });
      // Stamp immediately too — if the user navigates away before
      // dismiss/autoClose fires, we still don't want to nag again.
      try {
        window.localStorage.setItem(STORAGE_KEY, APP_VERSION);
      } catch {}
    }, 1200);

    return () => window.clearTimeout(id);
  }, []);

  return null;
}
