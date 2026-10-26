-- Base v0.2. Apply instead of the obsolete schema-proposal.sql.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.portal_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) > 0),
  next_process_number bigint not null default 1
);
create table public.portal_members (
  organization_id uuid not null references public.portal_organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check(role in ('admin','analyst','inspector','professional','owner')),
  primary key(organization_id,user_id)
);
create function private.portal_admin(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.portal_members
    where organization_id=org and user_id=(select auth.uid()) and role='admin');
$$;
revoke all on function private.portal_admin(uuid) from public;
grant execute on function private.portal_admin(uuid) to authenticated;

create function private.portal_text(j jsonb, k text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(j->k)='string',false);
$$;
create function private.portal_person(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select private.portal_text(j,'name') and private.portal_text(j,'email') and private.portal_text(j,'phone');
$$;

create table public.portal_developments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.portal_organizations(id),
  payload jsonb not null,
  version integer not null default 1,
  unique(organization_id,id),
  check(private.portal_text(payload,'name') and length(trim(payload->>'name')) > 0),
  check(private.portal_text(payload,'city') and length(trim(payload->>'city')) > 0),
  check(private.portal_text(payload,'state') and payload->>'state' ~ '^[A-Z]{2}$'),
  check(private.portal_text(payload,'address'))
);
create table public.portal_lots (
  id uuid primary key,
  organization_id uuid not null,
  development_id uuid not null,
  payload jsonb not null,
  version integer not null default 1,
  unique(organization_id,id),
  foreign key(organization_id,development_id) references public.portal_developments(organization_id,id),
  check(private.portal_text(payload,'block') and length(trim(payload->>'block')) > 0),
  check(private.portal_text(payload,'number') and length(trim(payload->>'number')) > 0),
  check(coalesce(jsonb_typeof(payload->'area')='number' and (payload->>'area')::numeric > 0,false)),
  check(private.portal_person(payload->'owner')),
  check(coalesce(payload->>'status'='Disponível',false))
);
create unique index portal_lots_code on public.portal_lots(development_id,lower(trim(payload->>'block')),lower(trim(payload->>'number')));
create table public.portal_processes (
  id uuid primary key,
  organization_id uuid not null,
  lot_id uuid not null,
  code text not null,
  payload jsonb not null,
  status text not null default 'Rascunho' check(status='Rascunho'),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  version integer not null default 1,
  unique(organization_id,code),
  foreign key(organization_id,lot_id) references public.portal_lots(organization_id,id),
  check(private.portal_text(payload,'title') and length(trim(payload->>'title')) > 0),
  check(coalesce(payload->>'kind' in ('Construção','Reforma','Regularização'),false)),
  check(coalesce(jsonb_typeof(payload->'disciplines')='array'
    and jsonb_array_length(payload->'disciplines') > 0
    and payload->'disciplines' <@ '["Arquitetônico","Estrutural"]'::jsonb,false)),
  check(private.portal_person(payload->'professional')),
  check(length(trim(payload->'professional'->>'name')) > 0),
  check(private.portal_text(payload->'professional','registration') and length(trim(payload->'professional'->>'registration')) > 0),
  check(coalesce(payload->'professional'->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$',false))
);
create table public.portal_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.portal_organizations(id),
  process_id uuid references public.portal_processes(id),
  actor_id uuid not null references auth.users(id),
  at timestamptz not null default now(),
  title text not null,
  detail text not null
);
create index portal_lots_org on public.portal_lots(organization_id);
create index portal_processes_org on public.portal_processes(organization_id);
create index portal_events_org on public.portal_events(organization_id,process_id);

alter table public.portal_organizations enable row level security;
alter table public.portal_members enable row level security;
alter table public.portal_developments enable row level security;
alter table public.portal_lots enable row level security;
alter table public.portal_processes enable row level security;
alter table public.portal_events enable row level security;
create policy members_self on public.portal_members for select to authenticated using(user_id=(select auth.uid()));
create policy organizations_admin on public.portal_organizations for select to authenticated using(private.portal_admin(id));
create policy developments_admin on public.portal_developments for select to authenticated using(private.portal_admin(organization_id));
create policy lots_admin on public.portal_lots for select to authenticated using(private.portal_admin(organization_id));
create policy processes_admin on public.portal_processes for select to authenticated using(private.portal_admin(organization_id));
create policy events_admin on public.portal_events for select to authenticated using(private.portal_admin(organization_id));
-- No direct DML; every mutation must enforce role, tenant and optimistic version.
revoke all on public.portal_organizations,public.portal_members,public.portal_developments,public.portal_lots,public.portal_processes,public.portal_events from anon,authenticated;
grant select on public.portal_members,public.portal_developments,public.portal_lots,public.portal_processes,public.portal_events to authenticated;
grant select(id,name) on public.portal_organizations to authenticated;

create function public.portal_save(p_org uuid,p_development uuid,p_kind text,p_entity jsonb,p_version integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_number bigint;
  v_owner text;
  v_title text;
  v_payload jsonb;
  v_lot uuid;
begin
  if auth.uid() is null or not private.portal_admin(p_org) then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if not exists(select 1 from public.portal_developments where id=p_development and organization_id=p_org) then
    raise exception 'Empreendimento não autorizado.' using errcode='42501';
  end if;
  if p_kind='development' then
    v_payload=jsonb_build_object('name',p_entity->'name','city',p_entity->'city','state',p_entity->'state','address',p_entity->'address');
    update public.portal_developments set payload=v_payload,version=version+1
      where id=p_development and organization_id=p_org and version=p_version;
    if not found then raise exception 'Registro atualizado por outra sessão. Recarregue antes de salvar.' using errcode='40001'; end if;
    insert into public.portal_events(organization_id,actor_id,title,detail)
      values(p_org,auth.uid(),'Empreendimento atualizado','Cadastro alterado por administrador.');
  elsif p_kind='lot' then
    v_id=(p_entity->>'id')::uuid;
    v_payload=jsonb_build_object('block',p_entity->'block','number',p_entity->'number','area',p_entity->'area','owner',p_entity->'owner','status','Disponível');
    if p_version is null then
      insert into public.portal_lots(id,organization_id,development_id,payload) values(v_id,p_org,p_development,v_payload);
    else
      update public.portal_lots set payload=v_payload,version=version+1
        where id=v_id and organization_id=p_org and development_id=p_development and version=p_version;
      if not found then raise exception 'Registro atualizado por outra sessão. Recarregue antes de salvar.' using errcode='40001'; end if;
    end if;
    insert into public.portal_events(organization_id,actor_id,title,detail)
      values(p_org,auth.uid(),'Lote salvo','Cadastro do lote '||v_id::text||' atualizado.');
  elsif p_kind='process' then
    v_id=(p_entity->>'id')::uuid;
    v_lot=(p_entity->>'lotId')::uuid;
    select payload->'owner'->>'name' into v_owner from public.portal_lots
      where id=v_lot and organization_id=p_org and development_id=p_development for share;
    if not found or coalesce(length(trim(v_owner)),0)=0 then
      raise exception 'Lote não autorizado ou sem proprietário.' using errcode='42501';
    end if;
    v_payload=jsonb_build_object('title',p_entity->'title','kind',p_entity->'kind','disciplines',p_entity->'disciplines','professional',p_entity->'professional');
    if p_version is null then
      update public.portal_organizations set next_process_number=next_process_number+1
        where id=p_org returning next_process_number-1 into v_number;
      insert into public.portal_processes(id,organization_id,lot_id,code,payload,created_by)
        values(v_id,p_org,v_lot,'PR-'||lpad(v_number::text,6,'0'),v_payload,auth.uid());
      v_title='Rascunho criado';
    else
      update public.portal_processes set lot_id=v_lot,payload=v_payload,version=version+1
        where id=v_id and organization_id=p_org and version=p_version and status='Rascunho'
        and exists(select 1 from public.portal_lots l where l.id=portal_processes.lot_id and l.development_id=p_development);
      if not found then raise exception 'Registro atualizado por outra sessão. Recarregue antes de salvar.' using errcode='40001'; end if;
      v_title='Cadastro atualizado';
    end if;
    insert into public.portal_events(organization_id,process_id,actor_id,title,detail)
      values(p_org,v_id,auth.uid(),v_title,'Rascunho salvo pelo administrador. Nenhuma notificação foi enviada.');
  else raise exception 'Operação desconhecida.' using errcode='22023';
  end if;
end;
$$;
revoke all on function public.portal_save(uuid,uuid,text,jsonb,integer) from public,anon;
grant execute on function public.portal_save(uuid,uuid,text,jsonb,integer) to authenticated;
commit;
