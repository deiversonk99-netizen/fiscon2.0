> Atualização de 26/10/2026: para implantar cadastro, arquivos e análise, siga [o guia atualizado](implantacao-supabase.md). As instruções abaixo descrevem apenas a base administrativa anterior.

# Integração Supabase futura

Status: estrutura preparada, integração desativada. Supabase utiliza PostgreSQL. Não há banco remoto configurado nesta entrega.

## Quando for ativar

1. Criar um projeto Supabase de desenvolvimento.
2. Aplicar somente `supabase/migrations/202610200001_portal_base.sql` pelo SQL Editor com acesso administrativo. Não aplicar `schema-proposal.sql`.
3. Criar/convidar o administrador em Authentication. Configurar envio de e-mail, Site URL e a URL permitida de retorno `/acesso` para o domínio usado. Validar entrega e expiração de links no ambiente de desenvolvimento.
4. Provisionar organização, empreendimento e vínculo administrativo em transação confiável, usando o UUID real do usuário de Authentication. Exemplo abaixo é um modelo, não executado.
5. Copiar `.env.example` para `.env.local`, definir a URL pública e chave pública do projeto e mudar `NEXT_PUBLIC_DATA_MODE` para `supabase`. Nunca incluir senha de banco ou service_role no frontend. Reiniciar/recompilar após alterar variáveis.
6. Testar login, expiração, saída, duas sessões editando simultaneamente e isolamento entre duas organizações no Supabase real antes de qualquer uso operacional.

```sql
begin;
with org as (
  insert into public.portal_organizations(name) values ('Nome da organização') returning id
), dev as (
  insert into public.portal_developments(organization_id,payload)
  select id, '{"name":"Nome do empreendimento","city":"Cidade","state":"MG","address":"Endereço"}'::jsonb from org
)
insert into public.portal_members(organization_id,user_id,role)
select id, 'SUBSTITUIR_PELO_UUID_DO_USUARIO'::uuid, 'admin' from org;
commit;
```

Nenhum lote é criado automaticamente no banco remoto. Os 50 lotes são exemplos exclusivos da demonstração.

## Limites desta base

Somente administradores possuem acesso remoto a cadastros. Perfis profissional, proprietário, analista e fiscal estão reservados no modelo, sem acesso aos dados até implementação das regras por lote/processo. Administradores da mesma organização enxergam seus empreendimentos.

RLS impede leitura entre organizações. Gravações passam pela função `portal_save`, que confere associação administrativa, empreendimento, versão esperada e campos permitidos. Status, código e eventos são definidos pelo banco; o cliente não pode promover um rascunho a aprovado. Exclusões não estão habilitadas.

O controle de versão rejeita alterações sobre uma versão antiga. Após conflito, atualizar os dados e revisar antes de salvar. O log atual registra ação, usuário e data, mas não substitui o futuro histórico de versões dos projetos/documentos.

Testes locais com PGlite validam PostgreSQL e políticas usando uma implementação local de `auth.uid()`. Não validam serviços reais de Auth, PostgREST, e-mail, Storage ou Vercel. Estes testes devem ser feitos na ativação. Uploads e armazenamento privado serão implementados na etapa documental.

Referências: https://supabase.com/docs/guides/database/postgres/row-level-security e https://supabase.com/docs/guides/auth/auth-email-passwordless
