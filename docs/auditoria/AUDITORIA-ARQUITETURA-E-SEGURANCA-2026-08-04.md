# Auditoria de arquitetura, módulos e segurança — 4 de agosto de 2026

## Escopo

Auditoria executada sobre a branch `dev` do Sistema Central Lander Solutions, cobrindo frontend, rotas, módulos, camadas de dados, Supabase, migrations, storage, autenticação, autorização e Edge Functions administrativas.

A branch `main` e o ambiente de produção não foram alterados.

## Organização modular aplicada

As rotas permanecem em `src/routes` como adaptadores finos. Implementações visuais, formulários, diálogos, consultas, mutações e contratos pertencem ao módulo correspondente em `src/features`.

Foram isolados os seguintes domínios:

- `transactions`: workspace, editor, importação OFX e operações bancárias;
- `access`: gestão de usuários, papéis e escopos;
- `assets`: ativos corporativos;
- `legal`: jurídico e compliance;
- `accounting`: contabilidade e Profit & Loss;
- `business-units`: unidades de negócio;
- `corporate-structure`: estrutura corporativa.

As implementações duplicadas ou armazenadas em pastas genéricas foram removidas. `financial-operations` permanece somente como adaptador temporário de compatibilidade para `transactions`.

## Fronteiras automáticas

O gate `scripts/audit-module-boundaries.ts` reprova:

- lógica de tela ou acesso ao Supabase dentro de rotas;
- páginas armazenadas em pastas de outro domínio;
- acesso a Supabase ou storage fora de `api.ts`, `*-api.ts`, `*-queries.ts`, `*-mutations.ts` ou funções de servidor;
- Edge Functions sem pasta, `index.ts` ou `deno.json`;
- CORS administrativo irrestrito;
- bypass de MFA condicionado ao ambiente;
- códigos de unidade hard-coded;
- bucket de storage obtido de metadados não confiáveis.

## Banco e autorização

O histórico contém 135 migrations.

A função central `authorization_private.current_user_has_permission` foi corrigida para impedir que uma atribuição restrita a uma unidade seja aceita como permissão global. Quando a operação não informa unidade, somente uma atribuição global pode autorizá-la. Quando informa unidade, uma atribuição global ou da mesma unidade pode autorizá-la.

O CI reconstrói o banco do zero, executa pgTAP, valida RLS, políticas, grants, funções privilegiadas, índices, dump e restauração.

## Storage

A leitura anônima foi reduzida ao prefixo:

`financial-fiscal-documents/public-dev/`

O bucket `hr-documents` não possui leitura anônima. Documentos privados devem ser entregues por URL assinada.

Chamadas a storage pertencem à camada de dados do módulo. A Edge Function de partes não confia mais no nome de bucket armazenado no registro e valida que o objeto esteja dentro do prefixo da parte correspondente.

## Edge Functions

As 13 Edge Functions administrativas foram revisadas.

Correções aplicadas:

- remoção de CORS com origem `*`;
- origem controlada por `APP_ORIGIN`, com fallback para o endereço estável da branch `dev`;
- remoção de bypass de MFA no projeto de desenvolvimento;
- remoção de códigos fixos de unidades;
- validação dinâmica de unidades ativas;
- resolução do escopo da unidade antes da autorização de conversões e conciliações;
- retorno `404` quando o recurso usado para determinar o escopo não existe;
- bucket fixo e caminho restrito nas operações de documentos de partes.

Todas mantêm `verify_jwt = true` e validação de Authorization, sessão, MFA `aal2` e permissão antes de mutações administrativas.

## Autenticação

A autenticação permanece intencionalmente desativada no runtime de desenvolvimento por `AUTHENTICATION_ENABLED = false`.

Essa configuração é um bloqueador explícito de produção. O CI impede promoção enquanto não existirem:

- autenticação reativada;
- migration de restauração do modelo privado de produção;
- revogação do acesso anônimo temporário;
- bootstrap e MFA dos usuários administrativos.

## Pendências externas

Os itens abaixo dependem de configuração operacional ou humana e não tornam o ambiente atual apto à produção:

- ativar proteção contra senhas comprometidas no Supabase Auth;
- definir `APP_ORIGIN` no ambiente das Edge Functions;
- reativar autenticação e MFA;
- configurar credenciais e integrações reais;
- executar pentest;
- validar backup, restauração e rollback em janela remota;
- validar processos contábeis, jurídicos e operacionais.
