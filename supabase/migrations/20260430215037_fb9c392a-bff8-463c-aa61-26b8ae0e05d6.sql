-- v1.6 "Differentiator": Theses tracker + AI brief runs

create table if not exists public.theses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  symbol text not null,
  thesis text not null,
  status text not null default 'unknown',
  rationale text,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists theses_user_idx on public.theses(user_id, created_at desc);
create unique index if not exists theses_user_symbol_uq on public.theses(user_id, symbol);

alter table public.theses enable row level security;

create policy "Users view own theses" on public.theses
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own theses" on public.theses
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own theses" on public.theses
  for update to authenticated using (auth.uid() = user_id);
create policy "Users delete own theses" on public.theses
  for delete to authenticated using (auth.uid() = user_id);

create trigger theses_set_updated_at
  before update on public.theses
  for each row execute procedure public.set_updated_at();

create table if not exists public.brief_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  symbols text[] not null,
  summary text not null,
  highlights jsonb,
  created_at timestamptz not null default now()
);

create index if not exists brief_runs_user_idx on public.brief_runs(user_id, created_at desc);

alter table public.brief_runs enable row level security;

create policy "Users view own briefs" on public.brief_runs
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own briefs" on public.brief_runs
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own briefs" on public.brief_runs
  for delete to authenticated using (auth.uid() = user_id);
