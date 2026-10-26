# Requisitos iniciais — entrega 0.1

Data: 20/10/2026. Fonte: plano de desenvolvimento, inspeção do sistema e áudios fornecidos. Não representa fechamento de toda a etapa de descoberta.

| ID | Requisito | Origem | Situação |
|---|---|---|---|
| CAD-01 | Cadastrar empreendimento, cidade e referência | F02 / M1 | Implementado em demonstração local |
| CAD-02 | Listar e pesquisar 50 lotes por quadra/proprietário | Áudio 7 / M1 | Implementado; exemplos fictícios |
| CAD-03 | Impedir duplicidade de quadra/lote e área inválida | Regra proposta | Implementado e teste automatizado |
| CAD-04 | Vincular nome, e-mail e telefone do proprietário | Áudio 11 | Implementado localmente |
| PRO-01 | Criar processo com lote, tipo e disciplinas | Áudio 11 | Implementado localmente |
| PRO-02 | Exigir proprietário e responsável técnico para abrir processo | Regra proposta | Implementado e teste automatizado |
| PRO-03 | Novo processo inicia em rascunho sem prazo inventado | Áudio 9 / regra proposta | Implementado e teste automatizado |
| PRO-04 | Editar somente rascunhos | Preservação de histórico | Implementado na interface local |
| PRO-05 | Registrar criação e alterações no histórico | Áudios 6/11 | Implementado localmente; não é auditoria segura |
| PRO-06 | Filtrar por situação e buscar lote/responsável | F05 | Implementado |
| DOC-01 | Documentos obrigatórios por disciplina/etapa | Áudio 6 | Catálogo ilustrativo; exige definição |
| DOC-02 | Upload, armazenamento privado e versões | M2 | Próxima entrega |
| ANA-01 | Checklist ao lado do PDF, observações e publicação | Áudios 6/9/11 | Planejado |
| REV-01 | Resposta por pendência e nova rodada | Áudio 11 | Planejado |
| SEG-01 | Auth, convites, acesso por organização/lote e RLS | Arquitetura | Cliente preparado; integração ainda não ativa |
| VIS-01 | Agenda, fiscalização e fotos por item | Áudio 8 | Planejado; original ainda precisa de descoberta |
| CER-01 | Separar autorização de construção e certificado final | M6 / ambiguidade do áudio 11 | Proposta a confirmar |
| MIG-01 | Importar acervo sem duplicação e sem emitir avisos | Áudio 5 | Planejado; exportação local disponível |

## Decisões desta entrega

- PostgreSQL no Supabase continua a arquitetura proposta. Banco remoto não conectado.
- Identidade visual provisória: Fiscon 2.0, verde profundo e tons claros; não é marca definitiva.
- Reserva das Palmeiras, pessoas, e-mails example.com, prazos e situações são fictícios.
- Não há login fictício: o ambiente identifica explicitamente que é demonstração local.
- Não há botões de aprovação, emissão, upload ou envio sem implementação. Módulos futuros abrem o plano de evolução.
- Um lote pode ter vários processos. Tipo de processo e situação são campos separados.
- O cadastro atual permite um responsável principal; múltiplos responsáveis por disciplina dependem da próxima evolução do modelo.
- Mudança de situação da obra não é editável pelo cadastro. Estados demonstrativos não produzem documentos nem efeitos oficiais.

## A confirmar antes das próximas entregas

Código Interno e checklists reais; documentos exigidos; responsáveis e signatários; lista de lotes; regras de taxa/prazo; amostra de legado; acesso a fluxos administrativos e de obras do original; contas GitHub/Supabase/Vercel.

## Separação entre entrega e operação

Persistência local serve para testar interação. Não substitui banco, backup, autenticação, autorização, integridade de auditoria ou operação multiusuário. Não inserir dados pessoais reais. Somente habilitar uso operacional após integração remota, testes de acesso, recuperação e homologação.
