create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'operator', 'viewer');
create type public.user_status as enum ('pending', 'active', 'suspended');
create type public.transaction_status as enum ('created', 'processing', 'completed', 'partial_failure', 'failed');
create type public.part_status as enum ('pending', 'processing', 'sent', 'failed', 'not_requested');
create type public.rating_status as enum ('not_applicable', 'pending', 'received');

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  avatar_url text,
  role public.app_role not null default 'viewer',
  status public.user_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_profiles_email_uq on public.user_profiles (lower(email));

create table public.zalo_oa_accounts (
  id uuid primary key default gen_random_uuid(),
  oa_id text not null unique,
  app_id text not null,
  oa_name text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_active_oa on public.zalo_oa_accounts (is_active) where is_active;

create table public.rating_templates (
  id uuid primary key default gen_random_uuid(),
  oa_account_id uuid not null references public.zalo_oa_accounts(id) on delete cascade,
  template_id text not null,
  name text not null,
  parameters jsonb not null default '[]'::jsonb,
  default_values jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (oa_account_id, template_id)
);

create table public.followers (
  id uuid primary key default gen_random_uuid(),
  oa_account_id uuid not null references public.zalo_oa_accounts(id) on delete cascade,
  zalo_uid text not null,
  name text,
  phone text,
  updated_at timestamptz not null default now(),
  unique (oa_account_id, zalo_uid)
);
create index followers_name_idx on public.followers (name);
create index followers_phone_idx on public.followers (phone);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  created_by uuid not null references auth.users(id),
  oa_account_id uuid not null references public.zalo_oa_accounts(id),
  zalo_uid text not null,
  customer_name text,
  file_name text not null,
  file_content_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  storage_path text not null unique,
  storage_expires_at timestamptz not null,
  storage_deleted_at timestamptz,
  status public.transaction_status not null default 'created',
  file_status public.part_status not null default 'pending',
  vote_status public.part_status not null default 'pending',
  rating_status public.rating_status not null default 'pending',
  template_id text,
  template_name text,
  template_data jsonb not null default '{}'::jsonb,
  file_message_id text,
  vote_message_id text unique,
  rating_payload jsonb,
  rating_received_at timestamptz,
  last_error_code text,
  last_error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, idempotency_key)
);
create index transactions_created_by_idx on public.transactions (created_by, created_at desc);
create index transactions_status_idx on public.transactions (status, rating_status);
create index transactions_uid_idx on public.transactions (zalo_uid);

create table public.transaction_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  event_type text not null,
  part text,
  status text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index transaction_events_tx_idx on public.transaction_events (transaction_id, created_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

create or replace function public.is_active_user() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_profiles where id = auth.uid() and status = 'active');
$$;
create or replace function public.has_role(required_role public.app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_profiles where id = auth.uid() and status = 'active' and (role = required_role or role = 'admin'));
$$;

alter table public.user_profiles enable row level security;
alter table public.zalo_oa_accounts enable row level security;
alter table public.rating_templates enable row level security;
alter table public.followers enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_events enable row level security;
alter table public.audit_logs enable row level security;

create policy user_profiles_self_read on public.user_profiles for select using (id = auth.uid() or public.has_role('admin'));
create policy admin_manage_users on public.user_profiles for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy active_read_oa on public.zalo_oa_accounts for select using (public.is_active_user());
create policy admin_manage_oa on public.zalo_oa_accounts for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy active_read_templates on public.rating_templates for select using (public.is_active_user());
create policy admin_manage_templates on public.rating_templates for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy active_read_followers on public.followers for select using (public.is_active_user());
create policy active_read_transactions on public.transactions for select using (public.is_active_user() and (created_by = auth.uid() or public.has_role('admin')));
create policy operator_insert_transactions on public.transactions for insert with check (public.has_role('operator') and created_by = auth.uid());
create policy active_read_events on public.transaction_events for select using (public.is_active_user() and exists(select 1 from public.transactions t where t.id = transaction_id and (t.created_by = auth.uid() or public.has_role('admin'))));
create policy admin_read_audit on public.audit_logs for select using (public.has_role('admin'));

insert into storage.buckets (id, name, public) values ('oavote-files', 'oavote-files', false) on conflict (id) do nothing;
create policy oavote_files_read on storage.objects for select to authenticated using (bucket_id = 'oavote-files' and (owner_id = auth.uid()::text or public.is_active_user()));
create policy oavote_files_insert on storage.objects for insert to authenticated with check (bucket_id = 'oavote-files' and owner_id = auth.uid()::text and public.has_role('operator'));
create policy oavote_files_delete on storage.objects for delete to authenticated using (bucket_id = 'oavote-files' and (owner_id = auth.uid()::text or public.has_role('admin')));
