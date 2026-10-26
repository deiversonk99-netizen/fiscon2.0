# Validação da entrega 0.1

Executada em 20/10/2026.

## Automatizada

- TypeScript: sem erros.
- Testes de domínio: 5 aprovados, nenhum reprovado.
- Build Next.js 16.4.2: concluído; página inicial gerada com sucesso.
- A primeira tentativa de build foi bloqueada por permissões do ambiente; repetida com acesso adequado e concluída.

## Navegador

- Painel renderizado com 50 lotes e 5 processos de exemplo.
- Formulário de novo processo preenchido com informações fictícias.
- Processo PR-2026-006 criado em Rascunho, sem envio de avisos.
- Ficha exibiu lote, proprietário, responsável e disciplina corretos.
- Histórico mostrou evento de criação e horário.
- Após recarregar, listagem continuou com 6 processos: persistência local confirmada.
- Busca pelo responsável fictício retornou somente o processo de teste.
- Captura da ficha salva em `../fiscon-2-processo.png`, fora desta pasta do código, na pasta outputs do trabalho.

## Limites

- Inspeção visual executada em janela de aproximadamente 1265 px. Breakpoints mobile implementados, mas não houve emulação independente de tela estreita pela ferramenta disponível.
- Cadastro/edição de lotes possuem validações testadas no domínio; os demais fluxos de edição e exportação não receberam teste completo no navegador nesta rodada.
- SQL é proposta não executada. Sem testes de banco, Auth, RLS ou integração remota.
- Sem testes de upload, aprovação, notificações reais, geração de PDF e certificados, pois essas funções ainda não foram implementadas.
- Armazenamento local não oferece isolamento entre usuários, trilha de auditoria segura ou sincronização entre dispositivos.
