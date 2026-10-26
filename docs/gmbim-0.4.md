# GM BIM — entrega 0.4: formulário e conferência local

## Acessar

`/portal-cliente`: portal GM BIM, formulários em preparação e processos existentes. A gestão mantém os registros anteriores em `/` e agora oferece acesso ao novo portal. As alterações foram implementadas com base no plano de mudanças de 20/10/2026.

## Implementado

- Identidade GM BIM: marca e banner fornecidos, paleta sálvia, gestão com sidebar clara e portal com navegação escura.
- Cadastro complementar por projeto com múltiplos proprietários PF/PJ, endereços completos, matrículas separadas de inscrições imobiliárias e vários responsáveis por disciplina.
- Salvamento automático local e manual, recuperação de rascunhos, controle de versão e conflito entre abas. Rascunhos incompletos são permitidos.
- Remoção reversível de proprietários, imóveis, profissionais, superfícies, coberturas, ambientes e pranchas: itens ficam preservados fora da entrega.
- Pavimentos dinâmicos: reduzir a quantidade não apaga dados. Novos campos usam IDs estáveis.
- Cálculos demonstrativos de área total, soma de pavimentos, ocupação, permeabilidade e cotas. Campo vazio não vira zero; parâmetros não cadastrados são sinalizados. A base da área técnica não esconde coberturas mais altas.
- Documentos no contexto do proprietário, imóvel e profissional; pranchas com PDF e CAD opcional na demonstração. Aceita PDF/PNG/JPEG e, nas exigências CAD, DWG/DXF com validação inicial de assinatura. Limite de 20 MB por arquivo.
- Arquivos novos preservam versões anteriores e invalidam a confirmação da entrega. Alterar a revisão da prancha gera uma exigência distinta, sem reaproveitar automaticamente o arquivo de outra revisão.
- Checklist com justificativa de não aplicabilidade. Declaração vinculada às versões atuais; mudanças posteriores exigem nova confirmação.
- Revisão de pendências cadastrais com navegação por seção; justificativa obrigatória para parâmetros sem configuração ou divergências antes de registrar entrega.
- Submissão local com protocolo DEMO, cópia dos dados, versão das regras, resultados e referências imutáveis aos arquivos. Duplo envio da mesma versão retorna o mesmo registro.
- Conferência de entrega com visualizador PDF, referência de item/página, pendências, respostas e resoluções em histórico separado. Resposta não resolve automaticamente uma pendência.
- Backup completo em JSON com conteúdo binário dos anexos codificado em base64, cadastros antigos, formulários, submissões e eventos. Exportação simples de rascunho continua separada dos anexos.

## Preservação de dados

O armazenamento de documentos foi ampliado de IndexedDB v1 para v2, adicionando três coleções: intakes, submissions e analysis. A coleção versions e seus identificadores foram mantidos. Não foi regravado o cadastro legado do localStorage. Os formulários complementares vinculam sourceProcessId; portanto, a contagem de processos antiga e a contagem de formulários ainda são conceitos distintos e aparecem identificadas na interface.

Anexos legados ou de itens retirados permanecem acessíveis na área de arquivos preservados. Cada submissão guarda os metadados da conferência de seus arquivos; alterações posteriores não reescrevem esse registro.

O backup completo pode ser guardado como cópia de recuperação; a importação/restauração por interface ainda não foi implementada. Não há sincronização entre navegadores/dispositivos. O ambiente deve conter apenas dados fictícios até ativação e homologação do armazenamento remoto.

## O que ainda precisa evoluir

1. Regras oficiais e editor administrativo por empreendimento/lote. Nesta versão, o conjunto demonstrativo fica explicitamente identificado; o limite de 12 linhas é operacional e não autoriza 12 pavimentos.
2. Parametrização integral do catálogo documental, regras de pessoa jurídica, tipos de obra, anexos opcionais e foto de identificação do projeto.
3. Vínculo completo de múltiplas matrículas à situação urbanística do conjunto. O usuário informa área total; o sistema não consulta cartório nem prefeitura.
4. Importador de backup, comparação gráfica entre revisões e anotação sobre a prancha. Atualmente a referência é por arquivo/versão e texto de página/item.
5. Checklist técnico administrável e encerramento formal do parecer. A conferência atual registra itens e comentários; não emite aprovação oficial.
6. Separação real de perfis, notificações, armazenamento Supabase privado e validação de servidor. O portal completo fica bloqueado em modo Supabase até seu adaptador estar pronto.
7. Transições oficiais entre análise, reanálise e aprovação. A nova entrega preserva a anterior, mas o vínculo de pendências entre entregas ainda será aprofundado; histórico permanece por submissão.
8. Conciliação dos cadastros complementares com as listas legadas, mantendo histórico e evitando atualizar um proprietário de todos os projetos automaticamente.

## Verificações

Suíte ampliada para 13 testes: cadastros, PostgreSQL/RLS, documentos, regras numéricas, preservação de pavimentos, cotas, assinaturas iniciais, conflitos de edição, declaração vinculada a arquivos, mudança de revisão de prancha, submissão idempotente e imutável, respostas sem resolução automática e leitura do backup. Testes de IndexedDB utilizam fake-indexeddb; não substituem homologação em todos os navegadores.

Verificação de navegador: abertura do portal, preenchimento com dados fictícios, cálculos visíveis, salvamento manual e recuperação após recarregar. Credenciais, contas e serviços externos não foram ativados. Não houve envio de e-mails nem modificação do Seehaus ou Fiscon original.
