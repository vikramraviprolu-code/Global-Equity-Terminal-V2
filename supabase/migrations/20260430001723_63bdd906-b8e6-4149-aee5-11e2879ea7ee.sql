create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  message text not null,
  stack text,
  component_stack text,
  route text,
  user_agent text,
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.error_logs enable row level security;

-- Anyone (including anon) can insert their own error report
create policy "Anyone can insert error logs"
  on public.error_logs for insert
  to anon, authenticated
  with check (true);

-- Users can read their own error logs
create policy "Users view own error logs"
  on public.error_logs for select
  to authenticated
  using (auth.uid() = user_id);

create index error_logs_created_at_idx on public.error_logs (created_at desc);
create index error_logs_user_id_idx on public.error_logs (user_id) where user_id is not null;