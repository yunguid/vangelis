-- Piano-roll patterns: single-user cloud store, owner-only via RLS.
create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patterns enable row level security;

create policy "patterns owner select" on public.patterns
  for select using (auth.uid() = user_id);
create policy "patterns owner insert" on public.patterns
  for insert with check (auth.uid() = user_id);
create policy "patterns owner update" on public.patterns
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "patterns owner delete" on public.patterns
  for delete using (auth.uid() = user_id);

create index patterns_user_updated on public.patterns (user_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger patterns_set_updated_at
  before update on public.patterns
  for each row execute function public.set_updated_at();
