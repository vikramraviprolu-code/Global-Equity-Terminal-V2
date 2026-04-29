import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const supabaseAuthHeaders = createMiddleware({ type: "function" }).client(async ({ next }) => {
  if (typeof window === "undefined") return next();

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return next(
    token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  );
});