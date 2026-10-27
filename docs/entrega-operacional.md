# Entrega operacional — 27/10/2026

O painel inicial usa os projetos cadastrados no portal, sem semear lotes fictícios. O acervo anterior continua acessível em /acervo. Empresa, empreendimento e cidade/UF pertencem a cada cadastro.

## Fluxo implementado
1. Cadastro e documentação, validação de dados, arquivos versionados e entrega imutável.
2. Conferência técnica por critério, pendências, respostas, resolução, conclusão e reabertura.
3. Aprovação interna vinculada à revisão concluída e à referência técnica informada.
4. Upload e conferência do alvará PDF com número e validade; autorização da construção.
5. Agenda, cancelamento, preenchimento parcial e conclusão de vistorias inicial, intermediária e final. Fotos solo/drone vinculadas ao item; observações e correções registradas.
6. Parecer, aprovação, autorização, relatório de vistoria com fotos e certificado para imprimir/salvar PDF. Histórico e revogação preservados.
7. Busca de projetos, avisos de pendências, acervo de versões, backup completo e restauração sem sobrescrever IDs existentes.

A certificação exige aprovação da revisão vigente, alvará vigente, vistoria final, ausência de pendências e encerramento de todos os agendamentos. Uma nova entrega exige nova aprovação. A obra certificada precisa ser revogada antes de alterações.

## Armazenamento e limites desta entrega
O modo atual permanece local até instalar o SQL 03 e ativar a variável abaixo. O acesso compartilhado foi implementado e testado em ambiente simulado/PostgreSQL local; a validação no projeto remoto aguarda a execução do SQL pelo usuário.

Ainda dependem de configuração/implementação adicional: e-mails, assinatura digital, autenticação e parametrização pelo Código Interno real. Identificação do responsável nesta fase é declarada. Relatórios exigem conferência e assinatura técnica; não substituem atos municipais.

## Validação
Testes de unidade e IndexedDB cobrem o ciclo de obra e a importação sem sobrescrita. Testes existentes cobrem cadastro, documentos, concorrência, revisão, RLS e migrações PostgreSQL. Build de produção verificado antes da publicação.

## Atualização: espaço compartilhado autorizado
Após a autorização para manter tudo aberto, foi acrescentado um armazenamento compartilhado opcional, separado das tabelas autenticadas anteriores.

1. Execute supabase/03_acesso_compartilhado_aberto.sql no SQL Editor.
2. Na Vercel, adicione NEXT_PUBLIC_OPEN_STORAGE=supabase em Production e Preview. Mantenha NEXT_PUBLIC_ACCESS_MODE=open, a URL e a chave pública já configuradas.
3. Faça Redeploy para incorporar a variável pública ao build.
4. Os projetos locais não são enviados automaticamente. Exporte o backup ANTES de ativar; depois use Restaurar para transferir ao espaço compartilhado.

O SQL cria somente um espaço compartilhado, membros para uso futuro e bucket separado. A migração é repetível sem apagar dados ou reabrir um espaço que foi fechado. Não altera as tabelas anteriores. Nesse modo todas as pessoas com o link/chave pública podem consultar e alterar os projetos. As regras de negócio são aplicadas pelo aplicativo, e não constituem controle de autorização enquanto o espaço está aberto.

As gravações usam versão global e rejeitam conflitos entre computadores; não fazem merge silencioso. Arquivos são imutáveis e metadados persistem somente após upload bem-sucedido. Não há fallback local em falhas de rede. Uploads sem metadados após conflito podem deixar arquivos órfãos no bucket, para limpeza administrativa futura.

Para preparar acesso restrito: preencher gmb_open_members e desativar public_access. A tela de autenticação e a aplicação integral das regras no servidor serão a próxima fase solicitada. Não desative acesso antes de configurar a autenticação da interface.
