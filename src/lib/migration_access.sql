-- Run this in Supabase SQL Editor

alter table template_groups add column if not exists is_restricted boolean default false;

alter table templates add column if not exists is_restricted boolean default false;

create table if not exists template_access (
  id uuid default gen_random_uuid() primary key,
  lawyer_id uuid references auth.users not null,
  template_group_id uuid references template_groups(id) on delete cascade,
  template_id uuid references templates(id) on delete cascade,
  granted_by uuid references auth.users,
  granted_at timestamptz default now()
);

alter table template_access enable row level security;

create policy "Lawyers can view own access" on template_access
  for select using (auth.uid() = lawyer_id);

create policy "Admin can manage access" on template_access
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

alter table purchases add column if not exists duration_months int default 1;
