-- Execute after installation, as postgres in SQL Editor.
-- First create/invite the user under Authentication > Users.
-- Replace the four values below. Never paste passwords or service_role keys here.
begin;
do $$
declare
 admin_email text='SUBSTITUA_PELO_EMAIL_DO_ADMIN';
 organization_name text='SUBSTITUA_PELO_NOME_DA_EMPRESA';
 development_name text='SUBSTITUA_PELO_NOME_DO_EMPREENDIMENTO';
 city_name text='SUBSTITUA_PELA_CIDADE';
 state_code text='MG';
 user_id_value uuid;org_id uuid;dev_id uuid;
begin
 if admin_email like 'SUBSTITUA%' or organization_name like 'SUBSTITUA%' or development_name like 'SUBSTITUA%' or city_name like 'SUBSTITUA%' then raise exception 'Substitua os valores de configuração antes de executar.';end if;
 select id into user_id_value from auth.users where lower(email)=lower(admin_email);
 if user_id_value is null then raise exception 'Crie ou convide primeiro o usuário no Authentication.';end if;
 if exists(select 1 from public.portal_members where user_id=user_id_value and role='admin') then raise exception 'Administrador já vinculado. Consulte portal_members antes de criar outra organização.';end if;
 insert into public.portal_organizations(name) values(organization_name) returning id into org_id;
 insert into public.portal_members(organization_id,user_id,role) values(org_id,user_id_value,'admin');
 insert into public.portal_developments(organization_id,payload) values(org_id,jsonb_build_object('name',development_name,'city',city_name,'state',state_code,'address','')) returning id into dev_id;
 raise notice 'Organização: %, empreendimento: %',org_id,dev_id;
end;$$;
commit;

-- Additional users: invite them in Auth, then run the following separately,
-- substituting an EXISTING organization UUID and the invited email.
-- Roles enabled in project workflow: admin, analyst, professional.
-- insert into public.portal_members(organization_id,user_id,role)
-- select 'UUID_DA_ORGANIZACAO'::uuid,id,'professional'
-- from auth.users where lower(email)=lower('EMAIL_DO_PROFISSIONAL');
