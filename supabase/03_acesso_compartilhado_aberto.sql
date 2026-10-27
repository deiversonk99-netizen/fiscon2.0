-- Execute manualmente no SQL Editor do seu projeto Supabase.
-- ATENÇÃO: este espaço é compartilhado SEM LOGIN. Qualquer pessoa com o link/chave
-- pública pode ler e alterar seus registros e baixar anexos. Não afeta tabelas anteriores.
-- O acesso aberto pode ser desligado: update public.gmb_open_workspace set public_access=false;
begin;
create table if not exists public.gmb_open_workspace (
 id boolean primary key default true check(id),
 version bigint not null default 0,
 public_access boolean not null default true,
 stores jsonb not null default '{"intakes":[],"versions":[],"submissions":[],"analysis":[],"operations":[]}',
 updated_at timestamptz not null default now()
);
create table if not exists public.gmb_open_members (
 user_id uuid primary key references auth.users(id),
 role text not null check(role in ('reader','writer'))
);
alter table public.gmb_open_workspace enable row level security;
alter table public.gmb_open_members enable row level security;
revoke all on public.gmb_open_workspace,public.gmb_open_members from anon,authenticated;
insert into public.gmb_open_workspace(id) values(true) on conflict do nothing;
create or replace function public.gmb_open_allowed(p_write boolean default false)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.gmb_open_workspace where id and public_access)
 or exists(select 1 from public.gmb_open_members where user_id=auth.uid() and (not p_write or role='writer'));
$$;
create or replace function public.gmb_open_read(p_stores text[])
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare data jsonb; rev bigint; result jsonb='{}'; k text;
begin
 if not public.gmb_open_allowed(false) then raise exception 'acesso negado'; end if;
 if p_stores is null or cardinality(p_stores)=0 then raise exception 'coleções inválidas'; end if;
 select stores,version into data,rev from public.gmb_open_workspace where id;
 foreach k in array p_stores loop
  if k is null or not k=any(array['intakes','versions','submissions','analysis','operations']) then raise exception 'coleção inválida'; end if;
  result=result||jsonb_build_object(k,data->k);
 end loop;
 return jsonb_build_object('version',rev,'stores',result);
end $$;
create or replace function public.gmb_open_write(p_expected bigint,p_stores jsonb)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare current_version bigint; current_stores jsonb; k text; rows jsonb; next_version bigint;
begin
 if not public.gmb_open_allowed(true) then raise exception 'acesso negado'; end if;
 select version,stores into current_version,current_stores from public.gmb_open_workspace where id for update;
 if p_expected is null or current_version<>p_expected then raise exception 'conflito de versão'; end if;
 if p_stores is null or jsonb_typeof(p_stores)<>'object' or p_stores='{}' then raise exception 'dados inválidos'; end if;
 if octet_length(p_stores::text)>16777216 then raise exception 'metadados excedem 16 MB'; end if;
 for k,rows in select * from jsonb_each(p_stores) loop
  if not k=any(array['intakes','versions','submissions','analysis','operations']) or jsonb_typeof(rows)<>'array' then raise exception 'coleção inválida'; end if;
  if exists(select 1 from jsonb_array_elements(rows) x where jsonb_typeof(x)<>'object' or x->>'id' is null or length(x->>'id')=0) then raise exception 'registro inválido'; end if;
  if exists(select 1 from jsonb_array_elements(current_stores->k) old where not exists(select 1 from jsonb_array_elements(rows) fresh where fresh->>'id'=old->>'id')) then raise exception 'exclusão de registros não permitida'; end if;
  if k in ('submissions','analysis') and exists(select 1 from jsonb_array_elements(current_stores->k) old join jsonb_array_elements(rows) fresh on fresh->>'id'=old->>'id' where fresh<>old) then raise exception 'histórico imutável'; end if;
  if (select count(*) from jsonb_array_elements(rows))<>(select count(distinct x->>'id') from jsonb_array_elements(rows) x) then raise exception 'identificador duplicado'; end if;
 end loop;
 update public.gmb_open_workspace set stores=stores||p_stores,version=version+1,updated_at=now() where id returning version into next_version;
 return next_version;
end $$;
revoke all on function public.gmb_open_allowed(boolean),public.gmb_open_read(text[]),public.gmb_open_write(bigint,jsonb) from public;
grant execute on function public.gmb_open_allowed(boolean),public.gmb_open_read(text[]),public.gmb_open_write(bigint,jsonb) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gmb-open-documents','gmb-open-documents',false,20971520,array['application/pdf','image/png','image/jpeg','application/acad','image/vnd.dxf']) on conflict(id) do nothing;
drop policy if exists gmb_open_read_files on storage.objects;
create policy gmb_open_read_files on storage.objects for select to anon,authenticated
using(bucket_id='gmb-open-documents' and public.gmb_open_allowed(false));
drop policy if exists gmb_open_upload_files on storage.objects;
create policy gmb_open_upload_files on storage.objects for insert to anon,authenticated
with check(bucket_id='gmb-open-documents' and public.gmb_open_allowed(true));
-- Sem UPDATE/DELETE em arquivos: cada envio cria uma nova versão.
commit;
