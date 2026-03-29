-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles
create table profiles (
  id uuid references auth.users primary key,
  email text,
  full_name text,
  role text default 'lawyer', -- 'admin' or 'lawyer'
  created_at timestamptz default now()
);

-- Enable RLS on profiles
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Service role can do all on profiles" on profiles using (true);

-- Fonts
create table fonts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  font_file_url text,
  is_active boolean default true,
  language text,  -- language code this font is for (gu, hi, mr, etc.)
  created_at timestamptz default now()
);

-- Migration for existing databases:
-- ALTER TABLE fonts ADD COLUMN IF NOT EXISTS language text;

alter table fonts enable row level security;
create policy "Everyone can view fonts" on fonts for select using (true);
create policy "Admin can manage fonts" on fonts using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Template Groups
create table template_groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  is_free boolean default false,
  price numeric default 0,
  created_at timestamptz default now()
);

alter table template_groups enable row level security;
create policy "Everyone can view template_groups" on template_groups for select using (true);
create policy "Admin can manage template_groups" on template_groups using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Templates
create table templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  file_url text,
  variables jsonb default '[]',
  template_group_id uuid references template_groups(id),
  is_free boolean default true,
  price numeric default 0,
  language text default 'en',        -- language code: en, gu, hi, mr, ta, te, kn, ml, bn, pa
  font_family text default 'Times New Roman',  -- font name used in this template's .docx
  created_at timestamptz default now()
);

-- Migration for existing databases:
-- ALTER TABLE templates ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';
-- ALTER TABLE templates ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'Times New Roman';

alter table templates enable row level security;
create policy "Everyone can view templates" on templates for select using (true);
create policy "Admin can manage templates" on templates using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Clients
create table clients (
  id uuid default gen_random_uuid() primary key,
  lawyer_id uuid references auth.users not null,
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now()
);

alter table clients enable row level security;
create policy "Lawyers can manage own clients" on clients using (auth.uid() = lawyer_id);
create policy "Admin can view all clients" on clients for select using (public.get_my_role() = 'admin');

-- Cases
create table cases (
  id uuid default gen_random_uuid() primary key,
  lawyer_id uuid references auth.users not null,
  client_id uuid references clients(id),
  title text not null,
  case_type text,
  status text default 'Drafting',
  notes text,
  case_data jsonb default '{}',
  created_at timestamptz default now()
);

alter table cases enable row level security;
create policy "Lawyers can manage own cases" on cases using (auth.uid() = lawyer_id);
create policy "Admin can view all cases" on cases for select using (public.get_my_role() = 'admin');

-- Documents
create table documents (
  id uuid default gen_random_uuid() primary key,
  lawyer_id uuid references auth.users not null,
  case_id uuid references cases(id),
  template_id uuid references templates(id),
  file_url text,
  file_name text,
  variables_used jsonb default '{}',
  created_at timestamptz default now()
);

alter table documents enable row level security;
create policy "Lawyers can manage own documents" on documents using (auth.uid() = lawyer_id);
create policy "Admin can view all documents" on documents for select using (public.get_my_role() = 'admin');
create policy "Admin can update all documents" on documents for update using (public.get_my_role() = 'admin');
create policy "Admin can delete all documents" on documents for delete using (public.get_my_role() = 'admin');

-- Purchases
-- Either template_group_id (whole group) or template_id (individual template) is set, not both.
create table purchases (
  id uuid default gen_random_uuid() primary key,
  lawyer_id uuid references auth.users not null,
  template_group_id uuid references template_groups(id),
  template_id uuid references templates(id),
  amount_paid numeric default 0,
  purchase_date timestamptz default now(),
  expiry_date timestamptz,
  is_active boolean default true
);

-- Migration for existing databases:
-- ALTER TABLE purchases ADD COLUMN IF NOT EXISTS template_id uuid references templates(id);
-- ALTER TABLE purchases ADD COLUMN IF NOT EXISTS duration_months int default 1;
-- ALTER TABLE template_groups ADD COLUMN IF NOT EXISTS is_restricted boolean DEFAULT false;
-- ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_restricted boolean DEFAULT false;

-- User-specific access grants (run in Supabase SQL Editor):
/*
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
create policy "Lawyers can view own access" on template_access for select using (auth.uid() = lawyer_id);
create policy "Admin can manage access" on template_access using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
*/

-- Purchase Plans (duration-based pricing: 1 / 3 / 6 months)
-- Run this migration in Supabase SQL Editor:
/*
create table if not exists purchase_plans (
  id uuid default gen_random_uuid() primary key,
  template_group_id uuid references template_groups(id) on delete cascade,
  template_id uuid references templates(id) on delete cascade,
  duration_months int not null check (duration_months in (1, 3, 6)),
  price numeric not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table purchase_plans enable row level security;
create policy "Everyone can view plans" on purchase_plans for select using (true);
create policy "Admin can manage plans" on purchase_plans using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
alter table purchases add column if not exists duration_months int default 1;
*/

alter table purchases enable row level security;
create policy "Lawyers can view own purchases" on purchases for select using (auth.uid() = lawyer_id);
create policy "Lawyers can insert own purchases" on purchases for insert with check (auth.uid() = lawyer_id);
create policy "Admin can manage purchases" on purchases using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Helper: returns current user's role without RLS recursion (security definer bypasses RLS)
create or replace function public.get_my_role()
returns text as $$
  select role from public.profiles where id = auth.uid()
$$ language sql security definer stable;

-- Migration: add admin select policy on profiles (run if upgrading existing DB)
-- create policy "Admin can view all profiles" on profiles for select using (public.get_my_role() = 'admin');

-- Admin select policy for profiles
create policy "Admin can view all profiles" on profiles for select using (public.get_my_role() = 'admin');

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'lawyer'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Storage bucket for templates
insert into storage.buckets (id, name, public) values ('templates', 'templates', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('generated-documents', 'generated-documents', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('fonts', 'fonts', true) on conflict do nothing;

-- Storage policies
create policy "Anyone can read templates bucket" on storage.objects for select using (bucket_id = 'templates');
create policy "Admin can upload templates" on storage.objects for insert with check (
  bucket_id = 'templates' and
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Lawyers can read own documents" on storage.objects for select using (
  bucket_id = 'generated-documents' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Lawyers can upload own documents" on storage.objects for insert with check (
  bucket_id = 'generated-documents' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Anyone can read fonts bucket" on storage.objects for select using (bucket_id = 'fonts');
create policy "Admin can upload fonts" on storage.objects for insert with check (
  bucket_id = 'fonts' and
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can delete fonts" on storage.objects for delete using (
  bucket_id = 'fonts' and
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
