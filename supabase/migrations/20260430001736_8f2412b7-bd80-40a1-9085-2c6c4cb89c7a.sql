drop policy if exists "Anyone can insert error logs" on public.error_logs;

create policy "Insert own or anonymous error logs"
  on public.error_logs for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());