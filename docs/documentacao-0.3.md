# Documentação — entrega 0.3

## Fluxo disponível

Abrir Projetos → selecionar processo → Documentação. Cada processo exibe uma lista inicial conforme as disciplinas cadastradas. A lista precisa de validação da responsável técnica antes de uso real.

1. Selecionar PDF, PNG ou JPEG de até 20 MB (somente arquivos fictícios).
2. Anexo gravado no IndexedDB, incluindo conteúdo, processo, exigência, data e número da versão.
3. Adicionar outro arquivo na mesma exigência cria uma nova versão e mantém as anteriores.
4. Baixar qualquer versão para guardar uma cópia.
5. Conferir a versão: Conforme, Correção necessária ou A conferir. Correção exige observação. Cada conferência é acrescentada ao histórico da versão, sem apagar registros anteriores.

Uma nova versão não herda a conferência anterior. Conferências em abas concorrentes rejeitam uma versão desatualizada do histórico. A numeração é atribuída dentro da transação do IndexedDB para evitar sobrescrita concorrente.

## Limites claros

- Não envia e-mails, não protocola processo e não aprova projetos.
- Não há sincronização entre dispositivos nem autenticação no modo demo.
- Limpar dados do navegador remove anexos. A exportação JSON do painel NÃO inclui arquivos, versões ou conferências documentais. Baixe os anexos individualmente.
- Validação de tamanho, extensão e assinatura inicial não é antivírus nem validação completa do conteúdo. Anexos são oferecidos como download; não há renderização embutida nesta etapa.
- Lista obrigatória ainda é uma proposta fixa por disciplina. Editor de exigências, visualizador de projetos, checklist técnico e avisos ao profissional permanecem próximos incrementos.
- No modo remoto, o módulo bloqueia anexos até o adaptador Supabase Storage ser implementado. Não grava arquivos reais na demonstração como alternativa.
- A linha do tempo do processo contém cadastros; a trilha documental está no histórico de cada versão.

## Contrato para integração futura

`DocumentRepository` define `list`, `upload` e `review`. O adaptador atual é `localDocuments`. O adaptador Supabase deverá usar bucket privado, autorização por organização/processo, URLs temporárias e validação no servidor; definir estratégia de compensação entre upload do objeto e metadados; manter versões imutáveis e eventos auditados pelo servidor. Não criar bucket público nem aceitar identidade/organização informadas pelo navegador sem autorização.

## Validação

9 testes automatizados aprovados incluindo migração PostgreSQL, regras de cadastro e testes do repositório documental via fake-indexeddb. Cobertura documental: arquivo vazio, tamanho, assinatura inicial, disciplinas, integridade do conteúdo salvo, separação por processo, numeração concorrente, histórico e conflito de conferência. Compilação de produção validada. Supabase remoto continua desativado.
