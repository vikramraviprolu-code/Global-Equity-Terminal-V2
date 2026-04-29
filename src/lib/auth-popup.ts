import { supabase } from "@/integrations/supabase/client";

/**
 * Opens the /auth page in a new browser tab in "popup" mode.
 *
 * The popup tab will close itself after a successful sign-in / sign-up and
 * post a `get-auth-success` message to this (opener) tab. We listen for that
 * message and refresh the local Supabase session so the original tab updates
 * its UI without a full reload.
 *
 * Fallback: if the browser blocks the popup, we save the current URL to
 * sessionStorage as `auth:return-to` and navigate the current tab to /auth
 * (without the popup flag). After successful auth, the auth page reads that
 * value and offers the user a "Back to where you were" button so they can
 * return to their original screen without losing their session.
 */
export function openAuthPopup() {
  const onMessage = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    const data = e?.data;
    if (data && typeof data === "object" && data.type === "get-auth-success") {
      void supabase.auth.getSession();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("message", onMessage);
    setTimeout(() => window.removeEventListener("message", onMessage), 10 * 60 * 1000);
  }

  const w = window.open("/auth?popup=1", "_blank", "noopener=no,noreferrer=no");
  // Detect blocked popup: w is null, undefined, or closed immediately.
  if (!w || w.closed || typeof w.closed === "undefined") {
    try {
      const here = window.location.pathname + window.location.search + window.location.hash;
      sessionStorage.setItem("auth:return-to", here);
    } catch {}
    window.location.href = "/auth";
  }
}
