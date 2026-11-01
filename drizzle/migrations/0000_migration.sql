create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create type public.app_role as enum ('admin', 'analyst', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  source_label text not null default 'User upload (unverified)',
  is_verified boolean not null default false,
  row_count integer not null default 0,
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.datasets to authenticated;
grant all on public.datasets to service_role;
alter table public.datasets enable row level security;
create policy "Own datasets read" on public.datasets for select to authenticated using (auth.uid() = user_id);
create policy "Own datasets insert" on public.datasets for insert to authenticated with check (auth.uid() = user_id and is_verified = false);
create policy "Own datasets update" on public.datasets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and (is_verified = false or public.has_role(auth.uid(), 'admin')));
create policy "Own datasets delete" on public.datasets for delete to authenticated using (auth.uid() = user_id);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  inputs jsonb not null,
  predicted_label text not null,
  probabilities jsonb not null default '{}'::jsonb,
  model_version text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.predictions to authenticated;
grant all on public.predictions to service_role;
alter table public.predictions enable row level security;
create policy "Own predictions read" on public.predictions for select to authenticated using (auth.uid() = user_id);
create policy "Own predictions delete" on public.predictions for delete to authenticated using (auth.uid() = user_id);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  phone text not null,
  relation text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.emergency_contacts to authenticated;
grant all on public.emergency_contacts to service_role;
alter table public.emergency_contacts enable row level security;
create policy "Own contacts all" on public.emergency_contacts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.sos_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'simulated',
  contacts_count integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.sos_logs to authenticated;
grant all on public.sos_logs to service_role;
alter table public.sos_logs enable row level security;
create policy "Own sos read" on public.sos_logs for select to authenticated using (auth.uid() = user_id);
create policy "Own sos insert" on public.sos_logs for insert to authenticated with check (auth.uid() = user_id and status = 'simulated');
create policy "Own sos delete" on public.sos_logs for delete to authenticated using (auth.uid() = user_id);