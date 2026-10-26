-- PROPOSTA NÃO APLICADA. Revisar e testar em Supabase de desenvolvimento.
-- Escopo: base administrativa; profissionais terão políticas específicas posteriormente.
begin;
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('admin','analyst','inspector','professional','owner')),
  primary key (organization_id,user_id)
);
create table public.developments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null, city text not null, state char(2) not null, address text,
  created_at timestamptz not null default now(),
  unique (organization_id,id)
);
create table public.lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  development_id uuid not null,
  block text not null check (length(trim(block)) > 0),
  number text not null check (length(trim(number)) > 0),
  area numeric(14,2) not null check (area > 0),
  owner_name text, owner_email text, owner_phone text,
  created_at timestamptz not null default now(),
  foreign key (organization_id,development_id) references public.developments(organization_id,id),
  unique (organization_id,id)
);
create unique index lots_code_unique on public.lots(development_id,lower(trim(block)),lower(trim(number)));
create table public.processes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lot_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  kind text not null check (kind in ('construction','renovation','regularization')),
  status text not null default 'draft' check (status = 'draft'),
  professional_name text not null,
  professional_email text not null,
  professional_registration text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id,lot_id) references public.lots(organization_id,id)
);
-- Only draft is modeled here. Future transitions require transactions and audit.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create function private.is_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = (select auth.uid()) and m.role = 'admin');
$$;
revoke all on function private.is_org_admin(uuid) from public;
grant execute on function private.is_org_admin(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.developments enable row level security;
alter table public.lots enable row level security;
alter table public.processes enable row level security;

create policy own_membership_read on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy admin_org_read on public.organizations for select to authenticated
  using (private.is_org_admin(id));
create policy admin_development_read on public.developments for select to authenticated
  using (private.is_org_admin(organization_id));
create policy admin_development_insert on public.developments for insert to authenticated
  with check (private.is_org_admin(organization_id));
create policy admin_development_update on public.developments for update to authenticated
  using (private.is_org_admin(organization_id)) with check (private.is_org_admin(organization_id));
create policy admin_lot_read on public.lots for select to authenticated
  using (private.is_org_admin(organization_id));
create policy admin_lot_insert on public.lots for insert to authenticated
  with check (private.is_org_admin(organization_id));
create policy admin_lot_update on public.lots for update to authenticated
  using (private.is_org_admin(organization_id)) with check (private.is_org_admin(organization_id));
create policy admin_process_read on public.processes for select to authenticated
  using (private.is_org_admin(organization_id));
create policy admin_process_insert on public.processes for insert to authenticated
  with check (private.is_org_admin(organization_id) and created_by = (select auth.uid()));
create policy admin_process_update on public.processes for update to authenticated
  using (private.is_org_admin(organization_id)) with check (private.is_org_admin(organization_id));
-- No deletion or self-enrollment policies. Organization bootstrap is a trusted operation.
revoke all on public.organizations,public.organization_members,public.developments,public.lots,public.processes from anon,authenticated;
grant select on public.organizations,public.organization_members to authenticated;
grant select,insert,update on public.developments,public.lots,public.processes to authenticated;
commit;
