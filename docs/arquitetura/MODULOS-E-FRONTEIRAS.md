# Arquitetura de módulos e fronteiras

## Regra central

Cada módulo é proprietário da própria interface, componentes específicos, casos de uso, contratos de dados e adaptadores. Arquivos de um módulo não podem ser armazenados em uma pasta genérica apenas por compartilharem tecnologia ou tabelas.

As rotas em `src/routes` são adaptadores finos. Elas podem declarar URL, metadados, loader e o componente principal, mas não podem conter estado de tela, formulários, consultas React Query, chamadas ao Supabase ou regras de negócio.

## Mapeamento de propriedade

| Rota                       | Módulo proprietário                            |
| -------------------------- | ---------------------------------------------- |
| `/`                        | `src/features/dashboard`                       |
| `/acessos`                 | `src/modules/access-control`                   |
| `/ativos`                  | redireciona para `/patrimonio-licencas`        |
| `/patrimonio-licencas`     | `src/modules/company/assets`                   |
| `/atendimento`             | `src/features/support`                         |
| `/auditoria`               | `src/features/audit`                           |
| `/contabilidade`           | `src/features/accounting`                      |
| `/contratos`               | `src/features/contracts`                       |
| `/crm`                     | `src/features/crm`                             |
| `/estrutura`               | `src/features/corporate-structure`             |
| `/juridico`                | `src/modules/governance/legal`                 |
| `/compliance-politicas`    | `src/modules/governance/compliance`            |
| `/nota-fiscal`             | `src/features/fiscal`                          |
| `/participacoes`           | `src/features/participations`                  |
| `/propriedade-intelectual` | `src/modules/governance/intellectual-property` |
| `/rateio`                  | `src/features/allocations`                     |
| `/relatorios`              | `src/features/reports`                         |
| `/rh`                      | `src/features/hr`                              |
| `/transacoes`              | `src/features/transactions`                    |
| `/unidades`                | `src/features/business-units`                  |

## Estrutura interna de um módulo

Um módulo pode conter:

- `index.ts`: API pública do módulo;
- `*-page.tsx`: entrypoint visual;
- componentes, diálogos e formulários específicos;
- `api.ts` e `*-api.ts`: adaptadores gerais de dados;
- `*-queries.ts`: consultas de leitura do módulo;
- `*-mutations.ts`: comandos e mutações do módulo;
- `types.ts`: contratos do domínio;
- `*.functions.ts`: funções executadas no servidor.

Componentes reutilizáveis sem regra de negócio permanecem em `src/components/ui`. Utilitários puros permanecem em `src/lib`. Contextos globais de shell permanecem em `src/components` somente quando não pertencem a um domínio específico.

## Núcleos compartilhados

`governance-registry` foi removido: Ativos, Jurídico, Compliance/Políticas e Propriedade Intelectual possuem owners canônicos independentes. Núcleos transversais não podem voltar a concentrar interfaces, contratos ou workflows desses domínios.

`financial-operations` é um adaptador temporário de compatibilidade e deve conter apenas reexportações para `transactions`; nenhuma implementação pode ser adicionada ali.

## Backend e Edge Functions

Cada Edge Function deve ocupar `supabase/functions/<nome>/`, contendo `index.ts` e `deno.json`. Não são permitidos arquivos executáveis soltos na raiz de `supabase/functions`.

As operações administrativas devem validar Authorization, MFA `aal2` e permissão antes de executar mutações. Funções de banco, políticas RLS e migrations continuam versionadas em `supabase/migrations`.

## Storage

Chamadas a `storage.from(...)` pertencem à camada de dados do módulo (`api.ts`, `*-api.ts` ou função de servidor). Páginas, componentes visuais e rotas não podem acessar buckets diretamente.

Caminhos de objetos devem ser derivados pelo módulo proprietário e nunca conter credenciais, tokens ou dados secretos. Políticas de storage são controladas por migrations e verificadas nos testes do banco.

## Autenticação e autorização

A infraestrutura de sessão permanece em:

- `src/components/auth/auth-context.tsx`;
- `src/components/auth/auth-gate.tsx`;
- `src/config/authentication.ts`.

Autorização de domínio pertence às APIs dos módulos e às Edge Functions. Nenhuma página deve confiar somente em ocultação visual; toda mutação protegida precisa ser validada novamente no backend e no banco.

A autenticação está desativada apenas no runtime de desenvolvimento atual. Essa condição bloqueia promoção para produção no CI.

## Aplicação automática

`bun run test:repository` executa `scripts/audit-module-boundaries.ts`. O gate reprova:

- implementação em pasta de outro módulo;
- rota com lógica de página ou acesso a dados;
- acesso direto ao Supabase/storage fora da camada de dados;
- retorno de arquivos legados às pastas genéricas;
- Edge Function fora da estrutura obrigatória;
- ausência da infraestrutura central de autenticação.
