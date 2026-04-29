import { supabase } from "@/integrations/supabase/client";

/**
 * Opens the /auth page in a new browser tab in "popup" mode.
 *
 * The popup tab will close itself after a successful sign-in / sign-up and
 * post a `get-auth-success` message to this (opener) tab. We listen for that
 * message and refresh the local Supabase session so the original tab updates
 * its UI without a full reload.
 *
 * Falls back gracefully:
 *  - If the browser blocks the popup, we navigate the current tab to /auth.
 *  - If postMessage doesn't fire (e.g. cross-origin), the next supabase
 *    `onAuthStateChange` will still pick up the session via shared storage.
 */
export function openAuthPopup() {
  let listenerAttached = false;

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    const data = e?.data;
    if (data && typeof data === "object" && data.type === "get-auth-success") {
      // Refresh session in this tab so AuthProvider picks it up immediately.
      void supabase.auth.getSession();
    }
  };

  if (typeof window !== "undefined" && !listenerAttached) {
    window.addEventListener("message", onMessage);
    listenerAttached = true;
    // Auto-cleanup after a few minutes.
    setTimeout(() => window.removeEventListener("message", onMessage), 10 * 60 * 1000);
  }

  const w = window.open("/auth?popup=1", "_blank", "noopener=no,noreferrer=no");
  if (!w) {
    // Popup blocked — fall back to in-tab navigation (no popup flag).
    window.location.href = "/auth";
  }
}
