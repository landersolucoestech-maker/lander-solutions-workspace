# Runbook — Rollback e Recuperação

## Princípio

Migrations aplicadas não devem ser apagadas, renomeadas ou reescritas. Correções são realizadas por nova migration forward-only.

## Aplicação

### Falha antes da promoção

- interromper a promoção;
- manter o PR em rascunho;
- corrigir na branch `dev`;
- reaplicar todos os gates;
- não tocar em `main` ou produção.

### Falha de aplicação

- preservar logs e request IDs;
- desabilitar a funcionalidade afetada por configuração, quando possível;
- reverter o deploy do frontend ou Edge Function para a versão anterior;
- não editar dados financeiros postados diretamente;
- utilizar ações formais de cancelamento, estorno ou reversão.

### Falha de migration

- não remover a migration aplicada;
- criar migration corretiva idempotente;
- testar reconstrução integral em banco local vazio;
- testar restauração de backup;
- validar RLS, privilégios e RPCs novamente.

### Corrupção ou perda de dados

- bloquear novas gravações no escopo afetado;
- registrar incidente e janela temporal;
- restaurar o backup em banco isolado;
- comparar migrations, contagens, ledger e eventos imutáveis;
- somente substituir o ambiente após aprovação formal do proprietário e responsável técnico.

## Financeiro

É proibido apagar ou editar diretamente:

- lançamentos postados;
- liquidações postadas;
- apurações aprovadas;
- repasses concluídos;
- eventos imutáveis;
- trilhas de auditoria.

A correção deve utilizar lançamento de reversão, documento de ajuste, cancelamento formal ou estorno vinculado ao registro original.

## Edge Functions

- localizar a última versão funcional;
- redeployar o código versionado no repositório;
- manter `verify_jwt=true`;
- confirmar MFA `aal2` e permissões;
- executar smoke test da ação administrativa sem dados produtivos.

## Critério de encerramento

O rollback somente é encerrado após:

- causa raiz registrada;
- banco e aplicação consistentes;
- CI verde;
- segurança sem alertas críticos;
- dados financeiros reconciliados;
- incidente e ação corretiva documentados.
