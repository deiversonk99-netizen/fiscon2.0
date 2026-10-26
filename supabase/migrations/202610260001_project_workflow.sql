-- Apply AFTER 202610200001_portal_base.sql. PostgreSQL / Supabase, not MySQL.
begin;
create table public.gmb_projects (
 id uuid primary key, organization_id uuid not null references public.portal_organizations(id),
 created_by uuid not null references auth.users(id), payload jsonb not null,
 version integer not null default 1, updated_at timestamptz not null default now(),
 check(jsonb_typeof(payload)='object'), check(version>0)
);
create table public.gmb_files (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.gmb_projects(id),
 requirement_id text not null, number integer not null, name text not null,
 mime text not null check(mime in ('application/pdf','image/jpeg','image/png','application/acad','image/vnd.dxf')),
 size bigint not null check(size between 1 and 20971520), path text unique not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 ready boolean not null default false, unique(project_id,requirement_id,number)
);
create table public.gmb_submissions (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.gmb_projects(id),
 number integer not null, draft_version integer not null, snapshot jsonb not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 closed boolean not null default false, event_version integer not null default 0,
 unique(project_id,number), unique(project_id,draft_version)
);
create table public.gmb_analysis (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.gmb_submissions(id),
 sequence integer not null, actor_id uuid not null references auth.users(id), payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(), unique(submission_id,sequence)
);
create index gmb_projects_org on public.gmb_projects(organization_id,created_by);
create index gmb_files_project on public.gmb_files(project_id);
create index gmb_submissions_project on public.gmb_submissions(project_id);

create function private.gmb_role(org uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.portal_members where organization_id=org and user_id=auth.uid();
$$;
create function private.gmb_access(project uuid, edit boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(bool_or(private.gmb_role(organization_id) in ('admin','analyst') or
 (created_by=auth.uid() and private.gmb_role(organization_id)='professional')),false)
 from public.gmb_projects where id=project;
$$;
-- Staff can see organization projects; professionals see only their own projects.
-- Owner and inspector access is intentionally absent until explicit assignment is implemented.
alter table public.gmb_projects enable row level security;
alter table public.gmb_files enable row level security;
alter table public.gmb_submissions enable row level security;
alter table public.gmb_analysis enable row level security;
create policy gmb_projects_read on public.gmb_projects for select to authenticated using(private.gmb_access(id));
create policy gmb_files_read on public.gmb_files for select to authenticated using(private.gmb_access(project_id) and ready);
create policy gmb_submissions_read on public.gmb_submissions for select to authenticated using(private.gmb_access(project_id));
create policy gmb_analysis_read on public.gmb_analysis for select to authenticated using(exists(select 1 from public.gmb_submissions s where s.id=submission_id and private.gmb_access(s.project_id)));
revoke all on public.gmb_projects,public.gmb_files,public.gmb_submissions,public.gmb_analysis from public,anon,authenticated;
grant select on public.gmb_projects,public.gmb_files,public.gmb_submissions,public.gmb_analysis to authenticated;

create function private.gmb_requirements(d jsonb) returns table(id text,format text) language sql immutable set search_path='' as $$
 select 'owner:'||(j->>'id'),'document' from jsonb_array_elements(d->'owners') j where j->>'active'='true'
 union all select 'property:'||(j->>'id')||':'||i,'document' from jsonb_array_elements(d->'properties') j cross join generate_series(0,1) i where j->>'active'='true'
 union all select 'urban-restriction','document'
 union all select 'tech:'||(j->>'id'),'document' from jsonb_array_elements(d->'technicians') j where j->>'active'='true'
 union all select 'sheet:'||(j->>'id')||':'||(j->>'revision')||':pdf','pdf' from jsonb_array_elements(d->'sheets') j where j->>'active'='true'
 union all select 'sheet:'||(j->>'id')||':'||(j->>'revision')||':cad','cad' from jsonb_array_elements(d->'sheets') j where j->>'active'='true' and j->>'cadRequired'='true';
$$;
create function private.gmb_number(v text) returns numeric language plpgsql immutable set search_path='' as $$
begin
 if v is null or v !~ '^-?[0-9]+([.,][0-9]{1,2})?$' then raise exception 'Número ausente ou inválido.'; end if;
 return replace(v,',','.')::numeric;
end;$$;
create function private.gmb_document(v text) returns boolean language plpgsql immutable set search_path='' as $$
declare s text=regexp_replace(v,'[./[:space:]-]','','g'); n int; i int; total int; digit int;
begin
 if s is null or s !~ '^([0-9]{11}|[0-9]{14})$' or s ~ '^([0-9])\1+$' then return false; end if;
 for n in length(s)-2..length(s)-1 loop
 total=0;
 for i in 1..n loop total=total+substring(s,i,1)::int * case when length(s)=11 then n+2-i else ((n-i)%8)+2 end; end loop;
 digit=case when length(s)=11 then (total*10)%11 else case when total%11<2 then 0 else 11-total%11 end end;
 if digit=10 then digit=0;end if;
 if digit<>substring(s,n+1,1)::int then return false;end if;
 end loop;return true;
end;$$;
create function private.gmb_shape(d jsonb) returns void language plpgsql set search_path='' as $$
declare k text; field text; fields text[]; x jsonb;
begin
 if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>1000000 then raise exception 'Cadastro inválido ou muito grande.';end if;
 if d->'schemaVersion' is distinct from '1'::jsonb then raise exception 'Versão de cadastro inválida.';end if;
 foreach field in array array['id','title','kind','landArea','declaredArea','floorCount','technicalBase','technicalTop','justification','notes'] loop if jsonb_typeof(d->field) is distinct from 'string' then raise exception 'Campo inválido: %',field;end if;end loop;
 foreach field in array array['hasTechnical','declared','finalConfirmed'] loop if jsonb_typeof(d->field) is distinct from 'boolean' then raise exception 'Confirmação inválida: %',field;end if;end loop;
 if jsonb_typeof(d->'version') is distinct from 'number' then raise exception 'Versão ausente.';end if;
 foreach k in array array['owners','properties','technicians','floors','surfaces','roofs','rooms','sheets','checks','verifiedFiles'] loop
 if jsonb_typeof(d->k) is distinct from 'array' or jsonb_array_length(d->k)>200 then raise exception 'Lista inválida: %',k;end if;
 end loop;
 foreach k in array array['owners','properties','technicians','floors','surfaces','roofs','rooms','sheets'] loop
 for x in select value from jsonb_array_elements(d->k) loop
 if jsonb_typeof(x) is distinct from 'object' or coalesce(x->>'id','')='' then raise exception 'Item inválido: %',k;end if;
 fields=case k when 'owners' then array['id','kind','name','document','phone','email','street','number','neighborhood','zip','state','city'] when 'properties' then array['id','lotId','registry','registration','block','lot','street','number','complement'] when 'technicians' then array['id','name','document','council','registration','discipline','art','email','phone'] when 'floors' then array['id','area','base','top'] when 'surfaces' then array['id','name','area','factor'] when 'roofs' then array['id','name','level'] when 'rooms' then array['id','floorId','name','area','category'] else array['id','title','revision'] end;
 foreach field in array fields loop if jsonb_typeof(x->field) is distinct from 'string' then raise exception 'Campo inválido: %.%',k,field;end if;end loop;
 if k<>'floors' and jsonb_typeof(x->'active') is distinct from 'boolean' then raise exception 'Estado inválido: %',k;end if;
 if k='sheets' and jsonb_typeof(x->'cadRequired') is distinct from 'boolean' then raise exception 'Exigência CAD inválida.';end if;
 end loop;
 if (select count(*)<>count(distinct j->>'id') from jsonb_array_elements(d->k) j) then raise exception 'IDs repetidos: %',k;end if;
 end loop;
 -- Revision identifiers are canonical ASCII to match encodeURIComponent in the portal.
 if exists(select 1 from jsonb_array_elements(d->'sheets') j where coalesce(j->>'revision','') !~ '^[A-Za-z0-9_.-]{1,40}$') then raise exception 'Use revisão com letras, números, ponto, hífen ou sublinhado.';end if;
end;$$;
create function private.gmb_validate(d jsonb) returns void language plpgsql set search_path='' as $$
declare x jsonb; k text; n int; land numeric; total numeric; area numeric=0; previous numeric; base numeric; top numeric; roomarea numeric;
begin
 perform private.gmb_shape(d);
 if coalesce(trim(d->>'title'),'')='' or coalesce(d->>'kind','') not in ('Construção','Reforma','Regularização') then raise exception 'Nome ou tipo de projeto inválido.';end if;
 foreach k in array array['owners','properties','technicians','sheets','surfaces','roofs'] loop
 if not exists(select 1 from jsonb_array_elements(d->k) j where j->>'active'='true') then raise exception 'Inclua ao menos um item em %.',k;end if;
 end loop;
 for x in select value from jsonb_array_elements(d->'owners') where value->>'active'='true' loop
 foreach k in array array['name','street','number','neighborhood','city'] loop if coalesce(trim(x->>k),'')='' then raise exception 'Proprietário: campo obrigatório %.',k;end if;end loop;
 if not private.gmb_document(x->>'document') or length(regexp_replace(x->>'document','\D','','g'))<>(case x->>'kind' when 'CPF' then 11 when 'CNPJ' then 14 else 0 end) then raise exception 'CPF/CNPJ inválido.';end if;
 if coalesce(x->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or regexp_replace(coalesce(x->>'phone',''),'\D','','g') !~ '^[0-9]{10,13}$' then raise exception 'Contato inválido.';end if;
 if regexp_replace(coalesce(x->>'zip',''),'\D','','g') !~ '^[0-9]{8}$' or not coalesce(x->>'state','')=any(string_to_array('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO',' ')) then raise exception 'CEP ou UF inválidos.';end if;
 end loop;
 for x in select value from jsonb_array_elements(d->'properties') where value->>'active'='true' loop
 foreach k in array array['registry','registration','block','lot','street'] loop if coalesce(trim(x->>k),'')='' then raise exception 'Imóvel: campo obrigatório %.',k;end if;end loop;
 end loop;
 for x in select value from jsonb_array_elements(d->'technicians') where value->>'active'='true' loop
 foreach k in array array['name','registration','art'] loop if coalesce(trim(x->>k),'')='' then raise exception 'Responsável: campo obrigatório %.',k;end if;end loop;
 if not private.gmb_document(x->>'document') or coalesce(x->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or regexp_replace(coalesce(x->>'phone',''),'\D','','g') !~ '^[0-9]{10,13}$' or coalesce(x->>'council','') not in ('CAU','CREA') or coalesce(x->>'discipline','') not in ('Arquitetônico','Estrutural') then raise exception 'Responsável técnico inválido.';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'owners') j where j->>'active'='true' group by regexp_replace(j->>'document','\D','','g') having count(*)>1) or exists(select 1 from jsonb_array_elements(d->'properties') j where j->>'active'='true' group by trim(j->>'registry') having count(*)>1) then raise exception 'Proprietário ou matrícula repetidos.';end if;
 if exists(select 1 from jsonb_array_elements(d->'properties') j where j->>'active'='true' group by j->>'block',j->>'lot' having count(*)>1) or exists(select 1 from jsonb_array_elements(d->'technicians') j where j->>'active'='true' group by regexp_replace(j->>'document','\D','','g'),j->>'discipline' having count(*)>1) then raise exception 'Lote ou responsável repetido.';end if;
 land=private.gmb_number(d->>'landArea');total=private.gmb_number(d->>'declaredArea');
 if land<=0 or total<=0 or coalesce(d->>'floorCount','') !~ '^([1-9]|1[0-2])$' then raise exception 'Área ou quantidade de pavimentos inválida.';end if;
 n=(d->>'floorCount')::int;if jsonb_array_length(d->'floors')<n then raise exception 'Pavimentos incompletos.';end if;
 for x in select value from jsonb_array_elements(d->'floors') with ordinality f(value,i) where i<=n loop
 base=private.gmb_number(x->>'base');top=private.gmb_number(x->>'top');
 if private.gmb_number(x->>'area')<=0 or base<0 or top<=base or base<previous then raise exception 'Área ou cotas incompatíveis.';end if;
 area=area+private.gmb_number(x->>'area');previous=top;
 select coalesce(sum(private.gmb_number(r->>'area')),0) into roomarea from jsonb_array_elements(d->'rooms') r where r->>'active'='true' and r->>'floorId'=x->>'id';
 if roomarea>private.gmb_number(x->>'area') then raise exception 'Ambientes ultrapassam o pavimento.';end if;
 end loop;
 if abs(area-total)>0.05 then raise exception 'Soma dos pavimentos diverge da área declarada.';end if;
 area=0;for x in select value from jsonb_array_elements(d->'surfaces') where value->>'active'='true' loop
 if coalesce(trim(x->>'name'),'')='' or coalesce(x->>'factor','') not in ('0','0.5','1') or private.gmb_number(x->>'area')<0 then raise exception 'Superfície inválida.';end if;
 area=area+private.gmb_number(x->>'area');end loop;
 if area>land then raise exception 'Superfícies ultrapassam o terreno.';end if;
 for x in select value from jsonb_array_elements(d->'roofs') where value->>'active'='true' loop
 if coalesce(trim(x->>'name'),'')='' or private.gmb_number(x->>'level')<0 then raise exception 'Cobertura inválida.';end if;
 previous=greatest(previous,private.gmb_number(x->>'level'));end loop;
 if d->>'hasTechnical'='true' and (private.gmb_number(d->>'technicalBase')<previous or private.gmb_number(d->>'technicalTop')<=private.gmb_number(d->>'technicalBase')) then raise exception 'Volume técnico incompatível.';end if;
 for x in select value from jsonb_array_elements(d->'rooms') where value->>'active'='true' loop
 if coalesce(trim(x->>'name'),'')='' or coalesce(trim(x->>'category'),'')='' or private.gmb_number(x->>'area')<=0 or not exists(select 1 from jsonb_array_elements(d->'floors') with ordinality f(v,i) where i<=n and v->>'id'=x->>'floorId') then raise exception 'Ambiente inválido.';end if;end loop;
 for x in select value from jsonb_array_elements(d->'sheets') where value->>'active'='true' loop if coalesce(trim(x->>'title'),'')='' then raise exception 'Título de prancha obrigatório.';end if;end loop;
 if jsonb_array_length(d->'checks')<>11 then raise exception 'Checklist incompleto.';end if;
 for n in 0..10 loop if d->'checks'->n is distinct from 'true'::jsonb and coalesce(trim(d->'notApplicable'->>n::text),'')='' then raise exception 'Conclua a autoconferência.';end if;end loop;
 if d->'declared' is distinct from 'true'::jsonb or d->'finalConfirmed' is distinct from 'true'::jsonb or coalesce(trim(d->>'justification'),'')='' then raise exception 'Confirmação ou justificativa obrigatória.';end if;
end;$$;

create function public.gmb_save(p_data jsonb,p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.gmb_projects; v int; ident uuid=(p_data->>'id')::uuid; result jsonb;
begin
 perform private.gmb_shape(p_data);
 select * into p from public.gmb_projects where id=ident for update;
 if found then
 if not private.gmb_access(ident,true) or p.organization_id is distinct from p_org then raise exception 'Acesso negado.' using errcode='42501';end if;
 if p.version is distinct from (p_data->>'version')::int then raise exception 'Registro alterado em outra aba.' using errcode='40001';end if;v=p.version+1;
 else
 if coalesce(private.gmb_role(p_org),'') not in ('admin','analyst','professional') or (p_data->>'version')::int is distinct from 0 then raise exception 'Acesso negado.' using errcode='42501';end if;v=1;
 end if;
 result=(p_data-'sourceProcessId')||jsonb_build_object('id',ident,'organizationId',p_org,'version',v,'updatedAt',clock_timestamp());
 if p.id is not null and (p.payload-array['version','updatedAt','checks','notApplicable','declared','finalConfirmed','verifiedFiles']) is distinct from (result-array['version','updatedAt','checks','notApplicable','declared','finalConfirmed','verifiedFiles']) then
 result=result||jsonb_build_object('checks','[false,false,false,false,false,false,false,false,false,false,false]'::jsonb,'declared',false,'finalConfirmed',false,'verifiedFiles','[]'::jsonb);
 end if;
 if p.id is null then
 insert into public.gmb_projects(id,organization_id,created_by,payload,version) values(ident,p_org,auth.uid(),result,v);
 else update public.gmb_projects set payload=result,version=v,updated_at=clock_timestamp() where id=ident;end if;return result;
end;$$;

create function public.gmb_reserve_file(p_project uuid,p_version int,p_requirement text,p_name text,p_mime text,p_size bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.gmb_projects; f public.gmb_files; form text; ident uuid=gen_random_uuid();num int;
begin
 select * into p from public.gmb_projects where id=p_project for update;
 if not private.gmb_access(p_project,true) then raise exception 'Acesso negado.' using errcode='42501';end if;
 if p.version is distinct from p_version then raise exception 'Registro alterado em outra aba.' using errcode='40001';end if;
 select format into form from private.gmb_requirements(p.payload) where id=p_requirement;
 if form is null or (form='pdf' and p_mime<>'application/pdf') or (form='cad' and p_mime not in ('application/acad','image/vnd.dxf')) or (form='document' and p_mime not in ('application/pdf','image/png','image/jpeg')) then raise exception 'Exigência ou formato inválido.';end if;
 select coalesce(max(number),0)+1 into num from public.gmb_files where project_id=p_project and requirement_id=p_requirement;
 insert into public.gmb_files(id,project_id,requirement_id,number,name,mime,size,path,created_by) values(ident,p_project,p_requirement,num,left(p_name,240),p_mime,p_size,p_project::text||'/'||ident::text,auth.uid()) returning * into f;
 return to_jsonb(f);
end;$$;
create function public.gmb_finish_file(p_file uuid,p_version int) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.gmb_files;p public.gmb_projects; result jsonb; meta jsonb;
begin
 select * into f from public.gmb_files where id=p_file;
 select * into p from public.gmb_projects where id=f.project_id for update;
 if not private.gmb_access(f.project_id,true) or f.created_by<>auth.uid() then raise exception 'Acesso negado.' using errcode='42501';end if;
 if p.version is distinct from p_version then raise exception 'Registro alterado em outra aba.' using errcode='40001';end if;
 if f.ready then raise exception 'Arquivo já confirmado.';end if;
 select metadata into meta from storage.objects where bucket_id='gmb-documents' and name=f.path;
 if meta is null or coalesce((meta->>'size')::bigint,-1)<>f.size or coalesce(meta->>'mimetype','')<>f.mime then raise exception 'Upload ausente ou metadados incompatíveis.';end if;
 update public.gmb_files set ready=true where id=f.id;
 result=p.payload||jsonb_build_object('version',p.version+1,'updatedAt',clock_timestamp(),'checks','[false,false,false,false,false,false,false,false,false,false,false]'::jsonb,'declared',false,'finalConfirmed',false,'verifiedFiles','[]'::jsonb);
 update public.gmb_projects set payload=result,version=version+1,updated_at=clock_timestamp() where id=p.id;return result;
end;$$;

create function public.gmb_submit(p_project uuid,p_version int) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.gmb_projects;s public.gmb_submissions; files jsonb;verified jsonb;num int;ident uuid=gen_random_uuid();snap jsonb;
begin
 select * into p from public.gmb_projects where id=p_project for update;
 if not private.gmb_access(p_project,true) then raise exception 'Acesso negado.' using errcode='42501';end if;
 if p.version is distinct from p_version then raise exception 'Registro alterado em outra aba.' using errcode='40001';end if;
 select * into s from public.gmb_submissions where project_id=p_project and draft_version=p_version;if found then return s.snapshot;end if;
 perform private.gmb_validate(p.payload);
 if exists(select 1 from private.gmb_requirements(p.payload) r where not exists(select 1 from public.gmb_files f where f.project_id=p.id and f.requirement_id=r.id and f.ready)) then raise exception 'Há documentos obrigatórios ausentes.';end if;
 select jsonb_agg(id order by id) into verified from (select distinct on (f.requirement_id) f.id::text id from public.gmb_files f join private.gmb_requirements(p.payload) r on r.id=f.requirement_id where f.project_id=p.id and f.ready order by f.requirement_id,f.number desc) q;
 if verified is distinct from (select jsonb_agg(value order by value) from jsonb_array_elements_text(p.payload->'verifiedFiles')) then raise exception 'Arquivos mudaram. Renove a declaração.';end if;
 select jsonb_agg(jsonb_build_object('id',f.id,'processId',f.project_id,'requirementId',f.requirement_id,'number',f.number,'name',f.name,'size',f.size,'type',f.mime,'at',f.created_at,'reviews','[]'::jsonb)) into files from public.gmb_files f where f.project_id=p.id and f.ready;
 select coalesce(max(number),0)+1 into num from public.gmb_submissions where project_id=p.id;
 snap=jsonb_build_object('id',ident,'intakeId',p.id,'number',num,'at',clock_timestamp(),'protocol','GMB-'||ident::text,'data',p.payload,'files',files,
 'results',jsonb_build_array(jsonb_build_object('label','Parâmetros urbanísticos oficiais','section','urban','status','unconfigured','detail','Conferir coeficiente, ocupação, permeabilidade, recuos, altura e ambientes no Código Interno. Sem aprovação automática.')),
 'rules',jsonb_build_object('id','manual-v1','official',false,'permeability',20,'coefficient',1,'floorPct',jsonb_build_array(60,60,30),'groundBaseMax',0.8,'heightMax',10));
 insert into public.gmb_submissions(id,project_id,number,draft_version,snapshot,created_by) values(ident,p.id,num,p.version,snap,auth.uid());return snap;
end;$$;

create function public.gmb_record(p_input jsonb,p_expected int default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.gmb_submissions;p public.gmb_projects;k text=p_input->>'kind';item text=p_input->>'item'; decision text=p_input->>'decision';parent public.gmb_analysis; ident uuid=gen_random_uuid(); reviewer text;required text[];valid_count int;open_count int;
begin
 select * into s from public.gmb_submissions where id=(p_input->>'submissionId')::uuid for update;
 if not private.gmb_access(s.project_id) then raise exception 'Acesso negado.' using errcode='42501';end if;
 select * into p from public.gmb_projects where id=s.project_id;
 if k<>'Resposta' and coalesce(private.gmb_role(p.organization_id),'') not in ('admin','analyst') then raise exception 'Somente equipe técnica pode analisar.' using errcode='42501';end if;
 if p_expected is not null and p_expected<>s.event_version then raise exception 'Análise alterada em outra aba.' using errcode='40001';end if;
 if coalesce(length(trim(p_input->>'comment')),0)<10 or coalesce(trim(item),'')='' then raise exception 'Informe item e justificativa com pelo menos 10 caracteres.';end if;
 if s.closed and (k<>'Decisão' or decision is distinct from 'Reabrir análise') then raise exception 'Reabra a análise antes de alterá-la.';end if;
 select array_agg('doc:'||r.id) into required from private.gmb_requirements(s.snapshot->'data') r;
 required=required||array['technical:0','technical:1','technical:2','technical:3','technical:4','calculation:0'];
 if k='Validação' then
 if not item=any(required) or coalesce(p_input->>'verdict','') not in ('Conforme','Não conforme','Não se aplica') or (p_input->>'verdict'='Não se aplica' and item<>'technical:3') then raise exception 'Critério ou resultado inválido.';end if;
 elsif k in ('Resposta','Resolvida') then
 select * into parent from public.gmb_analysis where id=(p_input->>'parentId')::uuid and submission_id=s.id and payload->>'kind'='Pendência';
 if not found then raise exception 'Pendência inválida.';end if;
 if exists(select 1 from public.gmb_analysis where submission_id=s.id and payload->>'kind'='Resolvida' and payload->>'parentId'=parent.id::text) then raise exception 'Pendência já resolvida.';end if;
 item=parent.payload->>'item';
 elsif k='Decisão' then
 select count(*) into open_count from public.gmb_analysis a where a.submission_id=s.id and a.payload->>'kind'='Pendência' and not exists(select 1 from public.gmb_analysis b where b.submission_id=s.id and b.payload->>'kind'='Resolvida' and b.payload->>'parentId'=a.id::text);
 select count(*) into valid_count from (select distinct on(payload->>'item') payload from public.gmb_analysis where submission_id=s.id and payload->>'kind'='Validação' order by payload->>'item',sequence desc) q where q.payload->>'verdict' in ('Conforme','Não se aplica');
 if decision='Concluir análise local' then
 if valid_count<>cardinality(required) or open_count>0 then raise exception 'Checklist incompleto ou pendências abertas.';end if;
 update public.gmb_submissions set closed=true where id=s.id;
 elsif decision='Reabrir análise' then
 if not s.closed then raise exception 'Análise já aberta.';end if;update public.gmb_submissions set closed=false where id=s.id;
 elsif decision='Solicitar correções' then
 if open_count=0 and not exists(select 1 from (select distinct on(payload->>'item') payload from public.gmb_analysis where submission_id=s.id and payload->>'kind'='Validação' order by payload->>'item',sequence desc) q where payload->>'verdict'='Não conforme') then raise exception 'Registre a pendência antes de solicitar correções.';end if;
 else raise exception 'Decisão inválida.';end if;
 elsif k not in ('Pendência','Conforme') or k is null then raise exception 'Ação inválida.';end if;
 reviewer=auth.uid()::text;
 insert into public.gmb_analysis(id,submission_id,sequence,actor_id,payload) values(ident,s.id,s.event_version+1,auth.uid(),(p_input-'reviewer'-'id'-'at')||jsonb_build_object('id',ident,'at',clock_timestamp(),'reviewer',reviewer,'actorId',auth.uid(),'item',item));
 update public.gmb_submissions set event_version=event_version+1 where id=s.id;
end;$$;

-- Private bucket: append-only uploads with a prior reservation, no client delete/update.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gmb-documents','gmb-documents',false,20971520,array['application/pdf','image/jpeg','image/png','application/acad','image/vnd.dxf']);
create function private.gmb_storage(path text,writing boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.gmb_files f where f.path=$1 and private.gmb_access(f.project_id) and
 case when writing then f.created_by=auth.uid() and not f.ready and f.created_at>now()-interval '1 hour' else f.ready end);
$$;
create policy gmb_storage_read on storage.objects for select to authenticated using(bucket_id='gmb-documents' and private.gmb_storage(name,false));
create policy gmb_storage_insert on storage.objects for insert to authenticated with check(bucket_id='gmb-documents' and private.gmb_storage(name,true));

-- Explicit permissions for all functions, including private security definers.
revoke all on function private.gmb_role(uuid),private.gmb_access(uuid,boolean),private.gmb_requirements(jsonb),private.gmb_number(text),private.gmb_document(text),private.gmb_shape(jsonb),private.gmb_validate(jsonb),private.gmb_storage(text,boolean) from public,anon,authenticated;
grant execute on function private.gmb_access(uuid,boolean),private.gmb_storage(text,boolean) to authenticated;
revoke all on function public.gmb_save(jsonb,uuid),public.gmb_reserve_file(uuid,int,text,text,text,bigint),public.gmb_finish_file(uuid,int),public.gmb_submit(uuid,int),public.gmb_record(jsonb,int) from public,anon,authenticated;
grant execute on function public.gmb_save(jsonb,uuid),public.gmb_reserve_file(uuid,int,text,text,text,bigint),public.gmb_finish_file(uuid,int),public.gmb_submit(uuid,int),public.gmb_record(jsonb,int) to authenticated;
commit;
