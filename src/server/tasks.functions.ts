import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAuthHeaders } from "./supabase-auth-headers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const TaskInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  symbol: z.string().trim().max(20).optional().nullable(),
  status: z.enum(TASK_STATUSES).default("todo"),
  dueDate: z.string().optional().nullable(),
  disableAlertsOnComplete: z.boolean().optional().default(false),
});

export const listTasks = createServerFn({ method: "GET" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tasks: data ?? [] };
  });

export const addTask = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => TaskInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tasks")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description ?? null,
        symbol: data.symbol ? data.symbol.toUpperCase() : null,
        status: data.status,
        due_date: data.dueDate || null,
        disable_alerts_on_complete: data.disableAlertsOnComplete,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { task: row };
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(TASK_STATUSES) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    // First, get the task to check if we should disable alerts
    const { data: task, error: taskError } = await context.supabase
      .from("tasks")
      .select("disable_alerts_on_complete")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (taskError) throw new Error(taskError.message);

    // Update the task status
    const { error } = await context.supabase
      .from("tasks")
      .update({
        status: data.status,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);

    // Auto-disable alerts if task is completed and the setting is enabled
    if (data.status === "done" && task?.disable_alerts_on_complete) {
      await context.supabase
        .from("alerts")
        .update({ active: false })
        .eq("task_id", data.id)
        .eq("user_id", context.userId);
    }

    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([supabaseAuthHeaders, requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
