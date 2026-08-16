# Checklist de Homologação Final

## Legenda

- `[x]` concluído e comprovado tecnicamente na branch `dev`;
- `[ ]` depende de credencial real, ambiente autorizado, conferência humana ou aprovação formal.

## Contexto do ambiente auditado

- branch auditada: `dev`;
- Supabase de desenvolvimento: `jodzhcktrlwinywqgbab`;
- autenticação da aplicação: deliberadamente desativada no ambiente de desenvolvimento;
- runtime público temporário: ativo e proibido em produção;
- branch `main`: não alterada nesta execução;
- Supabase produtivo: não alterado nesta execução.

## Identidade e segurança

- [ ] proprietário real criado pelo fluxo de bootstrap;
- [ ] MFA `aal2` configurado e testado pelo proprietário real;
- [ ] usuário financeiro, gestor de unidade, auditor e usuário somente leitura criados separadamente;
- [ ] segregação de funções homologada com usuários reais distintos;
- [x] estrutura de sessões, dispositivos, MFA e RBAC implementada;
- [x] nenhuma credencial real presente no repositório;
- [x] todas as Edge Functions ativas exigem JWT;
- [x] nenhuma função `SECURITY DEFINER` no schema `public` permanece executável por `anon` ou `authenticated`;
- [x] implementações privilegiadas temporárias foram isoladas no schema não exposto `development_private`;
- [x] nenhuma tabela em `private` ou `development_private` possui grant direto para `anon` ou `authenticated`;
- [x] nenhuma view pública acessível a clientes permanece sem `security_invoker=true`;
- [x] funções futuras criadas por `postgres` não herdam `EXECUTE` para `PUBLIC`, `anon` ou `authenticated`;
- [x] papéis clientes não possuem `TRUNCATE`, `REFERENCES` ou `TRIGGER` em tabelas públicas ou privadas;
- [ ] proteção contra senhas vazadas habilitada no Supabase Auth;
- [ ] runtime público temporário, grants e políticas de `anon` revogados;
- [ ] autenticação reativada e validada antes da promoção.

## Estrutura corporativa

- [x] unidades corporativas, produtos, serviços, projetos e centros gerenciais possuem modelos persistentes;
- [x] Dispatch permanece como linha de serviço e não como sistema independente neste projeto;
- [x] registros de sistema são protegidos por trigger genérico;
- [x] criação, edição e exclusão usam controle de versão e permissões;
- [ ] estrutura real cadastrada e conferida pelo proprietário.

## Cadastros e contratos

- [x] fluxos de clientes, fornecedores, participantes e contrapartes implementados;
- [x] dados restritos permanecem em schema privado;
- [x] templates de contrato possuem engine versionado, variáveis, papéis e snapshots;
- [x] versão contratual aprovada fica imutável;
- [x] autoaprovação é bloqueada;
- [x] encerramento e cancelamento formal estão implementados;
- [ ] cadastros, templates e contratos reais conferidos pelo responsável jurídico.

## Financeiro, fiscal e ledger

- [x] documentos a pagar e a receber possuem ciclo de criação, submissão, aprovação, liquidação e postagem;
- [x] partidas dobradas e balanceamento são validados;
- [x] período fechado bloqueia postagem e a reabertura exige ação formal;
- [x] estorno preserva vínculo com o lançamento original;
- [x] moeda original e funcional são preservadas sem câmbio fictício;
- [x] conciliação OFX possui proteção contra duplicidade;
- [x] módulo de Nota Fiscal é independente da antiga página de Operações Financeiras;
- [x] documentos fiscais, itens, PDF e RPC de criação estão materializados;
- [x] políticas dos itens fiscais foram separadas por ação, sem overlap de leitura;
- [x] itens fiscais autenticados não concedem `TRUNCATE`, `REFERENCES` ou `TRIGGER`;
- [ ] plano de contas, saldos iniciais e regras fiscais reais conferidos pelo contador.

## Rateios, participações e repasses

- [x] simulação de rateio não gera lançamento definitivo;
- [x] rateio aprovado fecha o valor de origem;
- [x] arredondamento determinístico está implementado;
- [x] participações possuem apuração, aprovação, postagem e reversão;
- [x] repasse não ultrapassa a obrigação aprovada;
- [x] pagamentos preservam rastreabilidade e versão;
- [ ] fórmulas, contratos e participantes reais aprovados juridicamente.

## CRM, projetos e rentabilidade

- [x] leads, serviços de interesse e diagnósticos estão persistidos;
- [x] lead pode ser convertido em oportunidade;
- [x] proposta versionada possui aprovação e aceite;
- [x] oportunidade pode ser convertida em projeto;
- [x] previsto e realizado podem ser comparados por receita, custo, lucro e margem;
- [ ] pipeline e propostas reais homologados pela operação comercial.

## Atendimento

- [x] caixa de entrada com busca, paginação e filtros avançados;
- [x] filtros por fila, agente, canal, categoria, SLA, prioridade, status e período;
- [x] função de inbox usa CTE compartilhado válido para contagem e paginação;
- [x] conversas, tickets, eventos, mensagens, notas internas e atribuições persistidos;
- [x] SLA, horários de atendimento, filas, templates e escalonamentos implementados;
- [x] automações versionadas com validação, preview e publicação;
- [x] Edge Function `admin-support` protegida por JWT;
- [ ] canais e integrações reais de atendimento configurados e homologados.

## SaaS removido do escopo

- [x] nenhuma tabela `saas_%` permanece no banco;
- [x] nenhuma página SaaS permanece no runtime canônico;
- [x] Edge Function histórica `admin-saas` foi neutralizada, exige JWT e retorna `410`;
- [x] o projeto não declara planos, assinaturas, MRR ou ARR como funcionalidades ativas.

## Integrações

- [ ] conexão GitHub real configurada por referência de segredo;
- [ ] conexão Supabase real configurada por referência de segredo;
- [ ] assinatura de webhook real validada;
- [x] registro técnico simplificado de integrações preservado;
- [x] usuário autenticado possui somente leitura direta no registro de integrações;
- [x] `TRUNCATE`, `REFERENCES`, `TRIGGER` e mutações diretas foram revogados de `authenticated`;
- [x] nenhuma credencial real está hardcoded;
- [x] nenhuma integração direta com bancos operacionais dos produtos foi adicionada.

## Relatórios e auditoria

- [x] dashboard por unidade e competência implementado;
- [x] DRE utiliza dados do ledger;
- [x] aging utiliza documentos e liquidações;
- [x] exportação XLSX real implementada e testada;
- [x] trilha de auditoria registra ator, sessão, request ID, antes e depois;
- [x] eventos imutáveis não podem ser atualizados ou excluídos;
- [ ] relatórios conferidos contra dados reais pelo responsável financeiro.

## Banco e migrations

- [x] 133 arquivos de migration locais;
- [x] 133 versões registradas no Supabase de desenvolvimento;
- [x] sete aliases históricos de timestamp foram alinhados ao histórico remoto;
- [x] três migrations fundacionais tiveram o histórico reparado após validação explícita do schema evoluído;
- [x] migration duplicada de filtros de Atendimento removida;
- [x] 138 tabelas públicas com RLS habilitado;
- [x] zero chaves estrangeiras sem índice de cobertura nos schemas `public` e `private`;
- [x] zero funções públicas `SECURITY DEFINER` executáveis por `anon` ou `authenticated`;
- [x] zero grupos de políticas permissivas duplicadas considerando todos os schemas, papéis e ações;
- [x] zero privilégios `TRUNCATE`, `REFERENCES` ou `TRIGGER` para papéis clientes;
- [x] zero grants diretos de tabela nos schemas privados para papéis clientes;
- [x] zero views públicas acessíveis a clientes sem `security_invoker=true`;
- [x] default global de funções de `postgres` validado por probe transacional;
- [x] reconstrução integral das 133 migrations executada em Supabase local isolado e descartável;
- [x] 53 testes pgTAP aprovados após reconstrução integral;
- [x] dump, restauração e validação pós-restore executados no banco descartável;
- [ ] backup e restauração do ambiente remoto executados em janela formal autorizada.

## Qualidade da aplicação

- [x] instalação com lockfile congelado;
- [x] Prettier aprovado;
- [x] ESLint aprovado sem warnings;
- [x] TypeScript aprovado sem erros;
- [x] 18 testes unitários aprovados em 5 arquivos;
- [x] auditoria estrutural do repositório aprovada;
- [x] auditoria específica da cadeia de hardening do banco implementada;
- [x] build cliente, SSR e Nitro aprovado;
- [x] árvore de rotas gerada e versionada;
- [x] bundle principal do cliente reduzido para aproximadamente 65,56 kB;
- [x] maior chunk do cliente abaixo de 200 kB;
- [x] CI usa `checkout@v6`, `upload-artifact@v6` e Bun `1.3.14` fixado;
- [x] CI executa aplicação e banco sequencialmente, sem paralelismo entre os gates.

## Advisors do Supabase

- [x] zero alertas de função pública `SECURITY DEFINER` executável;
- [x] zero alertas de chave estrangeira sem índice;
- [x] políticas permissivas sobrepostas eliminadas sem ampliar os acessos existentes;
- [ ] proteção contra senhas vazadas habilitada;
- [ ] estratégia de conexões do Auth convertida para percentual antes de aumento de capacidade;
- [ ] índices sem uso avaliados somente após telemetria representativa.

## Evidência técnica atual

- baseline validada: commit `3707d7c2f79b12865c0823b267741bb864449df1`;
- CI: run `30941487663`, número `2260`, conclusão `success` nos dois jobs;
- aplicação: formatação, lint, typecheck, 18 testes, auditoria e build aprovados;
- banco: 138 tabelas públicas, 133 migrations, 53 testes pgTAP, reconstrução integral, dump, restore, 0 tabelas sem RLS, 0 FKs sem índice, 0 funções públicas `SECURITY DEFINER` executáveis, 0 grupos de políticas permissivas duplicadas, 0 privilégios DDL para clientes, 0 grants privados diretos e 0 views inseguras;
- desenvolvimento público: 121 concessões de tabela ao papel `anon`, deliberadas e bloqueadoras de produção;
- segurança pendente no advisor: proteção contra senhas vazadas desativada.

## Gate de promoção

A implementação da branch `dev` está tecnicamente validada, mas a promoção continua bloqueada enquanto a autenticação estiver desativada, o runtime público temporário permanecer ativo ou qualquer item humano obrigatório estiver pendente.

A liberação exige, no mínimo:

1. reativação da autenticação;
2. migration posterior com o marcador `PRODUCTION_AUTH_RESTORED`;
3. revogação de grants, políticas e wrappers públicos temporários;
4. proteção contra senhas vazadas habilitada;
5. proprietário real e MFA `aal2` homologados;
6. segregação de funções validada com usuários distintos;
7. backup, restauração e rollback do ambiente remoto testados em janela formal;
8. validação contábil, fiscal, jurídica e operacional;
9. pentest e revisão pré-lançamento;
10. aprovação formal do proprietário e do responsável técnico.
