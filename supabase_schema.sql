-- =========================
-- RÊVE CRM (Formato A) — Supabase SQL
-- =========================
create extension if not exists pgcrypto;

create table if not exists public.checklist (
  user_id uuid not null,
  key text not null,
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.notes (
  user_id uuid not null,
  note_id text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, note_id)
);

create table if not exists public.photos (
  user_id uuid not null,
  photo_key text not null,
  public_url text not null,
  week int not null,
  period text not null check (period in ('manha','noite')),
  updated_at timestamptz not null default now(),
  primary key (user_id, photo_key)
);

create table if not exists public.crm_patients (
  user_id uuid primary key,
  full_name text not null,
  email text unique,
  phone text,
  birth_date date,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.crm_patients(user_id) on delete cascade,
  title text not null default 'Plano',
  content jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_plans_user_id_idx on public.crm_plans(user_id);

create table if not exists public.crm_admins (
  user_id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

alter table public.checklist enable row level security;
alter table public.notes enable row level security;
alter table public.photos enable row level security;

drop policy if exists checklist_select_own on public.checklist;
create policy checklist_select_own on public.checklist for select using (auth.uid() = user_id);
drop policy if exists checklist_insert_own on public.checklist;
create policy checklist_insert_own on public.checklist for insert with check (auth.uid() = user_id);
drop policy if exists checklist_update_own on public.checklist;
create policy checklist_update_own on public.checklist for update using (auth.uid() = user_id);

drop policy if exists notes_select_own on public.notes;
create policy notes_select_own on public.notes for select using (auth.uid() = user_id);
drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own on public.notes for insert with check (auth.uid() = user_id);
drop policy if exists notes_update_own on public.notes;
create policy notes_update_own on public.notes for update using (auth.uid() = user_id);

drop policy if exists photos_select_own on public.photos;
create policy photos_select_own on public.photos for select using (auth.uid() = user_id);
drop policy if exists photos_insert_own on public.photos;
create policy photos_insert_own on public.photos for insert with check (auth.uid() = user_id);
drop policy if exists photos_update_own on public.photos;
create policy photos_update_own on public.photos for update using (auth.uid() = user_id);

alter table public.crm_patients enable row level security;
alter table public.crm_plans enable row level security;
alter table public.crm_admins enable row level security;

drop policy if exists crm_patients_select_own on public.crm_patients;
create policy crm_patients_select_own on public.crm_patients for select using (auth.uid() = user_id);
drop policy if exists crm_plans_select_own_active on public.crm_plans;
create policy crm_plans_select_own_active on public.crm_plans for select using (auth.uid() = user_id and is_active = true);
