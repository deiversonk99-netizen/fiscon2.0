# GM BIM — portal 0.4

Portal Next.js / TypeScript para aprovação de projetos e fiscalização de obras. O modo padrão continua sendo uma demonstração local com dados fictícios. A pedido do usuário, a integração Supabase foi preparada, mas não ativada.

## Executar

```sh
npm ci
npm run dev
```

Abrir http://127.0.0.1:3000. A rota `/acesso` apresenta a preparação da integração enquanto o modo demo estiver ativo.

```sh
npm run typecheck
npm test
npm run build
```

## Implementado

- Painel, 50 lotes de exemplo, filtros, cadastros de lote/proprietário/empreendimento.
- Criação e edição de rascunhos, responsáveis técnicos e linha do tempo.
- Demonstração persistida no navegador e exportação JSON.
- Estrutura opcional para autenticação por link enviado por e-mail, sem cadastro automático.
- Repositório Supabase para cadastros administrativos, migração com RLS, auditoria e controle de versão concorrente.
- Separação entre demonstração e dados remotos. Sem configuração, o modo remoto bloqueia o acesso em vez de simular sucesso.

O módulo documental local está disponível na entrega 0.3 descrita abaixo. Análise técnica, revisões de projeto, vistorias, emissão oficial e notificações continuam planejados.

## Integração futura

Ver `docs/integracao-supabase.md`. Não é necessário criar conta ou configurar credenciais para continuar o desenvolvimento local. Nenhuma migração foi aplicada remotamente, nenhum e-mail foi enviado e nenhum projeto GitHub/Vercel foi criado.

O arquivo `supabase/schema-proposal.sql` é histórico e obsoleto: não aplicá-lo. A base atual está em `supabase/migrations/202610200001_portal_base.sql` e ainda cobre apenas cadastros administrativos.

## Arquitetura

- `src/components/portal.tsx`: interface e formulários.
- `src/components/access-gate.tsx`: seleção de modo, sessão e empreendimento.
- `src/lib/domain.ts`: validações e modelo inicial.
- `src/lib/remote-repository.ts`: leitura e gravação remota.
- `src/lib/changes.ts`: alteração isolada e mensagens de erro.
- `tests/database.test.ts`: PostgreSQL local via PGlite para testar migração e permissões.

Dados demo ficam em `localStorage`, chave `fiscon-2-demo-v1`; limpar o navegador os remove. Utilize somente dados fictícios. O modo remoto não copia registros do banco para esse armazenamento.

## Incremento 0.3 — documentação local

Anexos por processo e disciplina, versões preservadas, download e conferência com observações estão disponíveis na aba Documentação. Os arquivos ficam no IndexedDB, separados da exportação JSON. Consulte `docs/documentacao-0.3.md` para funcionamento, testes e limites. Upload remoto, checklist técnico e notificações ainda não estão implementados.

## Incremento 0.4 — GM BIM

O portal de preenchimento em `/portal-cliente` agora segue os protótipos GM BIM. Inclui formulário ampliado, autosave, cálculos preliminares, arquivos por titular/prancha, checklist, entregas locais preservadas e conferência de PDF com pendências. Ver `docs/gmbim-0.4.md` para detalhes e limites. Os dados legados continuam preservados e Supabase permanece desativado.

## Integração do fluxo completo de cadastro e análise — 26/10/2026

O modo Supabase agora usa projetos, documentos privados, entregas e análises no PostgreSQL. Consulte [implantação](docs/implantacao-supabase.md). Para banco novo use `supabase/01_instalar_banco_novo.sql`; para base já instalada use somente a migração `202610260001_project_workflow.sql`. Configure o administrador com `supabase/02_configurar_administrador.sql`. Nenhum ambiente remoto foi ativado automaticamente.
