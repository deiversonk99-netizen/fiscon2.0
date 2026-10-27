> Fase atual: acesso aberto, sem login e com dados locais por navegador. O Supabase permanece privado. Para ativar o fluxo autenticado futuramente, configure também `NEXT_PUBLIC_ACCESS_MODE=authenticated` e faça novo deploy. Empresa, empreendimento e cidade/UF podem ser informados em cada projeto; esse contexto descritivo não concede permissões no banco.

# Implantar o fluxo de projetos no Supabase

Supabase utiliza PostgreSQL. Este pacote não é SQL para MySQL. Nenhuma configuração ou chave veio na mensagem e nenhum projeto remoto foi alterado.

## Ordem de implantação

1. Crie um projeto de desenvolvimento no Supabase. Para um banco novo, abra o SQL Editor, cole **supabase/01_instalar_banco_novo.sql** inteiro e execute uma única vez. Esse arquivo reúne a base existente e a nova migração. Não execute também as migrações individuais no mesmo banco.
2. Se a base `202610200001_portal_base.sql` já foi aplicada, execute somente `supabase/migrations/202610260001_project_workflow.sql`. Não use o antigo `schema-proposal.sql`. Os scripts não apagam dados, mas não devem ser reaplicados: a criação de objetos existentes aborta a transação.
3. Em Authentication > Users, crie ou convide o administrador. Edite os valores de `supabase/02_configurar_administrador.sql` e execute. O script recusa os placeholders e verifica a existência do usuário antes de criar a organização.
4. Configure Authentication > URL Configuration: Site URL para o domínio final e Redirect URLs para `http://127.0.0.1:3001/acesso` no desenvolvimento e `https://SEU-DOMINIO/acesso` na produção. Configure o envio de e-mail do Supabase antes de testar links de acesso. O sistema não cria usuários anônimos nem promove usuários a administrador por cadastro.
5. Copie `.env.example` para `.env.local`. Preencha a URL pública, a chave publishable (ou anon legada) e altere `NEXT_PUBLIC_DATA_MODE=supabase`. Nunca coloque `service_role` ou senha do banco em variável `NEXT_PUBLIC_*`.
6. Reinicie o servidor. Entre por `/acesso`, depois abra `/portal-cliente`. Convide profissionais e analistas no Auth e vincule-os por SQL conforme o exemplo comentado no segundo script.
7. Antes de dados reais, teste com duas contas: profissional e analista. O profissional cria um projeto, anexa os arquivos e registra uma entrega. O analista confere, solicita correções e conclui a análise. Uma terceira conta de outra organização não deve conseguir ler o projeto nem baixar seus arquivos.

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_ACCESS_MODE=authenticated
```

## O que foi implementado

- Projetos separados por organização e usuário criador, com versões para detectar gravações concorrentes.
- Arquivos em bucket privado `gmb-documents`, limite de 20 MB e tipos permitidos. Cada upload recebe uma reserva de caminho único. A confirmação verifica a existência e os metadados no Storage e invalida a declaração anterior.
- Entregas com cópia preservada dos dados e metadados dos anexos, numeração por projeto e repetição segura da mesma entrega.
- Validação no PostgreSQL de campos obrigatórios, CPF/CNPJ numéricos, contatos, áreas, cotas, ambientes, duplicidades, checklist e arquivos exigidos. A validação do navegador continua ajudando o preenchimento, mas não é a única barreira.
- Análises e decisões com autoria de `auth.uid()`, sequência e horário do banco. O nome digitado no navegador não determina o autor remoto.
- Profissional lê e altera seus próprios projetos e responde a pendências. Admin/analista acessam os projetos da organização e registram avaliações e decisões. Profissional não pode conceder acesso, avaliar critérios nem concluir análise.
- RLS para leitura e RPCs para escrita. Não há INSERT/UPDATE/DELETE direto das tabelas pelo cliente, nem atualização ou exclusão de objetos do bucket pelo cliente.
- Histórico de análise independente por revisão, bloqueio de conclusão incompleta e reabertura justificada.

## Limites e operação

O escopo é o fluxo de cadastro, documentação e análise já existente. Vistorias, certificados, assinatura digital, notificações de e-mail do processo e configuração do Código Interno não foram transformados em funcionalidades operacionais por esta migração. A conclusão continua sem efeito de aprovação oficial. Os parâmetros urbanísticos exigem conferência humana; o servidor registra esse requisito explicitamente e não aceita resultados de cálculo fornecidos pelo cliente como prova de conformidade.

O novo cadastro completo é separado das tabelas legadas `portal_*` de lotes/processos. Na tela remota, o imóvel é informado manualmente; não há migração automática dos exemplos locais ou sincronização dos cadastros legados. A organização é selecionada pelo UUID nesta primeira interface conectada. Perfis owner/inspector não recebem acesso ao novo fluxo até existir uma atribuição explícita de projetos. Admin e analista têm acesso à organização inteira; se precisar restringir por empreendimento, amplie o modelo de atribuições antes de produção.

As revisões de prancha remotas usam letras ASCII, números, ponto, hífen e sublinhado (ex.: R00, R01). Isso garante a correspondência entre as exigências e os arquivos no servidor.

Storage valida tipo declarado e tamanho; a inspeção básica de assinatura de arquivo ocorre no cliente. Não há antivírus ou verificação profunda de PDF/DWG no servidor. Para arquivos de origem não confiável em produção, acrescente inspeção em serviço de backend antes da liberação. Uploads interrompidos podem deixar reservas/objetos não confirmados: ficam invisíveis no fluxo e exigem limpeza administrativa via API de Storage; não apague manualmente linhas de storage.objects.

O portal baixa as versões autorizadas ao abrir os anexos. Para acervos grandes, substituir por carregamento sob demanda. Backups de banco não substituem backup dos objetos do Storage: planeje ambos. Nenhuma cópia local foi enviada automaticamente.

## Verificação e referências

O SQL é exercitado em PostgreSQL local por PGlite, com Auth e Storage simulados. Os testes cobrem instalação, isolamento, permissões de escrita, reserva/confirmação de arquivo, declaração vinculada às versões, entrega, idempotência e decisões. Isso não substitui um teste real de login, e-mail e upload no seu projeto Supabase.

Referências oficiais: https://supabase.com/docs/guides/database/postgres/row-level-security e https://supabase.com/docs/guides/storage/security/access-control.
