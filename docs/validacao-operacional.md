# Validação operacional — 27/10/2026

## Resultado
O ciclo integrado automatizado passou em PostgreSQL isolado com o SQL de produção. Isso aumenta a cobertura, mas não constitui certificação de operação definitiva ou garantia de ausência de erros.

## Evidências
- Cadastro persistido com controle de versão; gravação desatualizada recusada.
- Upload dos documentos exigidos, nova confirmação e entrega imutável; repetição da mesma entrega não duplica protocolo.
- Checklist completo e conclusão da análise.
- Aprovação da revisão, alvará, autorização da construção.
- Bloqueio de certificado antes das vistorias.
- Vistorias inicial e final, fotos vinculadas aos itens, preenchimento parcial e relatórios.
- Emissão do certificado, releitura da obra e recuperação do conteúdo do arquivo.
- Falha de rede simulada não confirma gravação e mantém o cadastro anterior.
- SQL executado sob o papel anon no banco isolado. Os testes existentes cobrem conflito, fechamento do espaço e membros futuros.
- Produção: leitura do RPC respondeu HTTP 200; cinco coleções vazias e versão zero. Página inicial e portal responderam HTTP 200; /acervo redirecionou corretamente. Nenhum registro de teste foi criado em produção.

## Limites da validação
O teste integrado usa fake-indexeddb, PostgreSQL PGlite e transporte de arquivos simulado em memória; não usa Storage remoto nem reproduz um navegador real. Não foram comprovados uploads/downloads e ciclo completo em Supabase de produção. Os testes não simulam indisponibilidade prolongada, dispositivos diversos, grandes volumes ou recuperação de desastre.

O transporte atual carrega os arquivos do espaço ao ler a coleção versions, e as gravações usam uma versão global. O volume e o uso simultâneo precisam ser medidos antes de crescimento operacional. A infraestrutura continua sujeita a limites de serviço e de armazenamento.

## Pendências para homologação definitiva
- Validar o Código Interno oficial e as exigências documentais com a responsável técnica; os parâmetros numéricos atuais são demonstrativos.
- Homologar um processo real ou usar um projeto Supabase de homologação para testar Storage real e fluxo completo na interface.
- Definir emissão e assinatura dos documentos, e serviço de e-mail quando forem exigidos.
- Definir recuperação de dados na infraestrutura, pois o fluxo manual de backup foi removido por solicitação.
- Acesso aberto é a escolha atual: a identificação do responsável é declarada e qualquer visitante acessa o espaço. Autenticação e permissões individuais permanecem para fase posterior.

## Reprodução
npm test
npm run build

Teste integrado: tests/shared-lifecycle.test.ts. Não utiliza credenciais de produção nem envia registros a serviços externos.
