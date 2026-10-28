# Produção compartilhada

NEXT_PUBLIC_OPEN_STORAGE=supabase está configurada em Production na Vercel. O SQL 03 foi instalado pelo usuário e a leitura remota confirmou espaço vazio antes da ativação.

O portal inicia sem dados de demonstração. Não importa os dados locais antigos. Empresa, empreendimento e cidade/UF são informados em cada projeto. Os arquivos e registros novos são gravados no Supabase. Falhas de rede são apresentadas ao usuário, sem fallback local silencioso.

As funções de exportação/restauração manual foram retiradas da interface e do fluxo. A rota /acervo redireciona ao painel atual.

Acesso temporariamente aberto conforme solicitado. A autenticação permanece para etapa posterior. Regras oficiais do Código Interno, e-mails e assinatura digital seguem dependentes de configuração específica.
