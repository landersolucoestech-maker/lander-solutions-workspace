# Relatório de Prontidão para Produção

## Classificação atual

**Implementação técnica na branch `dev`: validada para o escopo atualmente versionado.**

**Promoção para produção: bloqueada.**

O ambiente de desenvolvimento opera deliberadamente sem autenticação e com acesso anônimo amplo para permitir implementação e homologação. Esse modo é incompatível com produção.

A branch `main` e o Supabase produtivo não foram alterados nesta execução. Nenhuma promoção deve ocorrer até a restauração integral da autenticação, revogação do runtime público temporário, homologação humana e aprovação operacional.

## Escopo técnico versionado

- identidade, sessões, dispositivos, MFA e RBAC por unidade;
- estrutura corporativa multiproduto e multisserviço;
- clientes, fornecedores, participantes e demais contrapartes;
- contratos, templates versionados, obrigações, aprovações e documentos;
- contas a pagar, contas a receber e liquidações;
- ledger de partidas dobradas, postagem, estorno e imutabilidade;
- rateios, simulações, aprovações, postagem e reversão;
- participações, apurações, obrigações e repasses;
- documentos fiscais, itens, anexos e fluxo de registro;
- ajustes, importação OFX, conciliação e fechamento financeiro;
- CRM, propostas, projetos e rentabilidade;
- ativos, jurídico, propriedade intelectual e compliance;
- Recursos Humanos com modelos seguros de leitura e mutação administrativa;
- Atendimento com inbox, tickets, SLA, filas, templates e automações;
- auditoria imutável;
- dashboard, DRE, aging, fluxo de caixa e exportação XLSX;
- registro técnico simplificado de integrações;
- runbooks de backup, restauração e rollback;
- CI com bloqueio explícito de promoção insegura.

O módulo SaaS foi removido do escopo operacional. Não existem tabelas `saas_%`, página SaaS ativa ou ciclo de assinatura no runtime canônico. A Edge Function histórica `admin-saas` permanece apenas como tombstone autenticado que retorna `410`.

## Estado auditado do Supabase de desenvolvimento

Projeto auditado: `jodzhcktrlwinywqgbab`.

Estado verificado em 4 de agosto de 2026:

- 138 tabelas públicas;
- 133 migrations registradas;
- 0 tabelas públicas sem RLS;
- 121 concessões de tabela ao papel `anon`, introduzidas deliberadamente pelo runtime público temporário;
- 0 funções `SECURITY DEFINER` no schema `public` executáveis por `anon` ou `authenticated`;
- 0 chaves estrangeiras sem índice de cobertura nos schemas `public` e `private`;
- 0 grupos de políticas permissivas duplicadas considerando todos os schemas, papéis e ações;
- 0 privilégios `TRUNCATE`, `REFERENCES` ou `TRIGGER` concedidos a `anon` ou `authenticated`;
- 0 grants diretos de tabela para clientes nos schemas `private` e `development_private`;
- 0 views públicas acessíveis a clientes sem `security_invoker=true`;
- funções futuras criadas por `postgres` não herdam `EXECUTE` para `PUBLIC`, `anon` ou `authenticated`;
- 0 tabelas `saas_%`;
- todas as Edge Functions ativas configuradas com `verify_jwt: true`;
- produção não alterada nesta execução.

## Reconciliação e hardening de migrations

O repositório e o histórico remoto divergiam por sete aliases de timestamp, três migrations fundacionais aplicadas fora do histórico e uma migration duplicada.

### Aliases alinhados

Os arquivos locais foram renomeados para os timestamps já registrados remotamente, sem executar DDL:

- `20260802004436_transaction_workspace_unit_scope.sql`;
- `20260802045629_crm_lead_intake_lander_services.sql`;
- `20260802063233_crm_contact_directory_expansion.sql`;
- `20260804005656_backfill_dev_contact_profiles.sql`;
- `20260804012312_complete_contract_template_engine_dev.sql`;
- `20260804013444_link_contracts_to_templates_dev.sql`;
- `20260804052432_managerial_account_reporting_groups.sql`.

### Histórico fundacional reparado

As seguintes versões foram registradas no catálogo `supabase_migrations.schema_migrations` somente após uma transação validar que o schema atual contém a implementação equivalente ou evoluída:

- `20260802084000_contract_templates_manual_configuration.sql`;
- `20260802090000_unify_fiscal_module_and_real_form.sql`;
- `20260802091500_allow_authorized_business_unit_deletion.sql`.

Os DDLs históricos não foram reexecutados no Supabase remoto. O engine de contratos atual substitui snapshots e triggers antigos por um modelo versionado mais completo; a proteção específica de unidades foi substituída pelo trigger genérico `private.protect_system_directory_record`; o módulo fiscal, itens, bucket e RPC isolada já estavam materializados.

A migration duplicada `20260804110600_support_inbox_advanced_filters.sql` foi removida porque repetia a versão já registrada `20260804110148`.

### Cadeia final de hardening

- `20260804123237`: implementações privilegiadas isoladas em `development_private`;
- `20260804135042`: políticas permissivas restantes separadas por ação;
- `20260804135559`: políticas públicas de leitura de documentos consolidadas;
- `20260804172805`: CTE da função de inbox corrigido para uma única instrução SQL;
- `20260804173803`: registro de integrações restringido a leitura autenticada direta;
- `20260804174904`: políticas dos itens fiscais separadas em `SELECT`, `INSERT`, `UPDATE` e `DELETE`;
- `20260804174953`: itens fiscais autenticados limitados a `SELECT`, `INSERT`, `UPDATE` e `DELETE`;
- `20260804183943`: `TRUNCATE`, `REFERENCES` e `TRIGGER` revogados globalmente das tabelas públicas e privadas para papéis clientes;
- `20260804184721`: defaults de funções por schema explicitamente restringidos;
- `20260804185320`: default global de funções de `postgres` corrigido para remover o `EXECUTE` implícito de `PUBLIC`.

A validação comportamental demonstrou que a alteração apenas por schema não removia o default global nativo do PostgreSQL. A migration `20260804185320` corrigiu essa diferença e o CI passou a provar o comportamento efetivo criando uma função temporária como `postgres` dentro de uma transação, verificando as ACLs e executando `ROLLBACK`.

Resultado final: 133 arquivos locais e 133 versões remotas.

## Reconstrução integral do banco

O CI executa um segundo job estritamente sequencial após a validação da aplicação.

Esse job:

1. inicia um Supabase local descartável em portas isoladas;
2. aplica as 133 migrations desde o zero;
3. executa lint do schema;
4. executa 53 testes pgTAP em 4 arquivos;
5. gera dump em formato custom;
6. restaura o dump em um banco novo;
7. compara a quantidade de migrations restauradas com os arquivos locais;
8. valida RLS, grants, RPCs administrativas, FKs, `SECURITY DEFINER`, políticas permissivas e schemas privados;
9. rejeita privilégios `TRUNCATE`, `REFERENCES` e `TRIGGER` para papéis clientes;
10. rejeita grants diretos de tabela nos schemas privados;
11. rejeita views acessíveis a clientes sem `security_invoker=true`;
12. executa probe transacional do default global de funções de `postgres`;
13. encerra e remove o ambiente descartável.

A execução `30941487663`, CI `#2260`, concluiu os dois jobs com `success`.

## Isolamento de funções privilegiadas

A migration `20260804123237_isolate_public_development_security_definers.sql` criou o schema não exposto `development_private` e moveu para ele nove implementações privilegiadas do runtime temporário.

Os endpoints públicos mantiveram suas assinaturas, mas agora são wrappers `SECURITY INVOKER`. O advisor deixou de apontar funções públicas `SECURITY DEFINER` executáveis por usuários anônimos ou autenticados.

Não existem grants diretos de tabela para clientes em `private` ou `development_private`. Os acessos restantes nesses schemas são apenas funções auxiliares explicitamente concedidas e os nove wrappers temporários necessários ao ambiente público de desenvolvimento.

Esse isolamento reduz a superfície exposta, mas não torna o runtime público apropriado para produção. Os grants e políticas de desenvolvimento ainda devem ser revogados.

## Estado dos advisors

### Segurança

Resta um aviso conhecido:

- proteção contra senhas vazadas do Supabase Auth desativada.

Os avisos anteriores de funções públicas `SECURITY DEFINER` executáveis foram eliminados. A integração disponível nesta execução não expõe operação para modificar a configuração do Supabase Auth.

### Performance

Foram eliminados:

- avisos de chaves estrangeiras sem índice;
- grupos de políticas permissivas sobrepostas em tabelas públicas;
- overlap das políticas anônimas de leitura em `storage.objects`;
- overlap entre `fiscal_items_manage` e `fiscal_items_select`;
- privilégios históricos `TRUNCATE`, `REFERENCES` e `TRIGGER` em registros de integrações e itens fiscais;
- privilégios `TRUNCATE`, `REFERENCES` e `TRIGGER` restantes em todas as tabelas públicas e privadas para papéis clientes.

Permanecem:

- avisos `INFO` de índices sem uso em um banco de desenvolvimento sem carga representativa;
- recomendação para substituir a quantidade absoluta de conexões do Auth por estratégia percentual antes de aumento de capacidade.

Índices não devem ser removidos apenas por ausência de uso neste ambiente. A decisão exige telemetria representativa e análise dos planos de execução.

## Qualidade da aplicação

Estado validado pelo CI:

- instalação com lockfile congelado;
- Bun fixado em `1.3.14`;
- Prettier aprovado;
- ESLint aprovado sem warnings;
- TypeScript aprovado sem erros;
- 18 testes unitários aprovados em 5 arquivos;
- 53 testes pgTAP aprovados em 4 arquivos;
- auditoria estrutural aprovada;
- auditoria específica da cadeia de hardening do banco implementada;
- build cliente, SSR e Nitro aprovado;
- árvore de rotas gerada e versionada;
- `checkout@v6` e `upload-artifact@v6` em uso;
- workflow mutador one-shot removido;
- jobs de aplicação e banco executados sequencialmente.

O bundle principal do cliente foi reduzido de aproximadamente 531,09 kB para 65,56 kB. O maior chunk do cliente ficou em aproximadamente 189,80 kB.

Permanece um warning não bloqueante do Nitro: `inlineDynamicImports` é ignorado quando `codeSplitting` está configurado. O cliente e o servidor são gerados corretamente; esse warning deve ser revisitado quando o wrapper Nitro/Vite expuser configuração separada por ambiente.

## Evidência técnica

- baseline integralmente validada: commit `3707d7c2f79b12865c0823b267741bb864449df1`;
- CI: run `30941487663`, número `2260`, conclusão `success` nos dois jobs;
- aplicação: formatação, lint, typecheck, 18 testes, auditoria e build aprovados;
- banco: 138 tabelas públicas, 133 migrations, 53 testes pgTAP, reconstrução integral, dump, restore, 0 tabelas sem RLS, 0 FKs sem índice, 0 funções públicas `SECURITY DEFINER` executáveis, 0 grupos de políticas permissivas duplicadas, 0 privilégios DDL para clientes, 0 grants privados diretos e 0 views inseguras;
- runtime público temporário: 121 concessões de tabela ao papel `anon`;
- advisor de segurança pendente: proteção contra senhas vazadas.

## Controles automatizados atuais

- instalação pelo lockfile congelado;
- formatação, lint, typecheck, testes, auditoria do repositório e build;
- auditoria dos fragmentos obrigatórios da cadeia final de migrations;
- geração e conferência da árvore de rotas;
- validação da arquitetura independente de Nota Fiscal;
- bloqueio da antiga página de Operações Financeiras;
- empacotamento dos arquivos validados com hashes SHA-256;
- reconstrução integral do Supabase local;
- lint, pgTAP, dump, restauração e validação pós-restore;
- rejeição de privilégios DDL de tabela para papéis clientes;
- rejeição de grants diretos nos schemas privados;
- rejeição de views públicas inseguras;
- probe comportamental do default global de funções de `postgres`;
- perfil de validação separado para desenvolvimento e produção;
- bloqueio de referência produtiva no runtime de desenvolvimento;
- bloqueio de promoção enquanto a autenticação estiver desativada;
- exigência de migration posterior marcada com `PRODUCTION_AUTH_RESTORED`.

## Bloqueios obrigatórios antes da produção

1. Reativar a autenticação na aplicação.
2. Criar migration posterior com o marcador `PRODUCTION_AUTH_RESTORED`.
3. Revogar concessões, políticas e wrappers públicos temporários do papel `anon`.
4. Remover o schema `development_private` ou restringi-lo ao desenho definitivo de produção.
5. Habilitar e validar a proteção contra senhas vazadas.
6. Ajustar a estratégia de conexões do Supabase Auth para percentual quando aplicável.
7. Executar o bootstrap do proprietário real.
8. Exigir MFA `aal2` do proprietário e dos papéis privilegiados.
9. Homologar a segregação de funções com usuários distintos.
10. Configurar credenciais reais exclusivamente no cofre apropriado.
11. Validar conexões reais e assinaturas de webhook.
12. Definir formalmente RPO, RTO e retenção de backups.
13. Executar backup, restauração e rollback do ambiente remoto em janela formal autorizada.
14. Realizar conferência contábil, fiscal e jurídica.
15. Executar pentest e revisão de segurança pré-lançamento.
16. Aprovar e assinar o checklist final de homologação.

## Produção preservada

- branch `main` não promovida nesta execução;
- Supabase produtivo não alterado nesta execução;
- nenhum segredo ou dado real foi criado artificialmente;
- o CI impede promoção enquanto a autenticação e a migration de restauração produtiva não estiverem presentes.

## Decisão

A branch `dev` está tecnicamente consistente, compilável, testada, reconstruível e reconciliada com o Supabase de desenvolvimento. O sistema não está autorizado para produção enquanto operar sem autenticação e com acesso anônimo amplo.

A promoção somente poderá ocorrer após o preenchimento integral de `docs/homologacao/CHECKLIST-HOMOLOGACAO-FINAL.md`, restauração dos controles de segurança, execução dos testes humanos e aprovação formal da janela de mudança, backup e rollback remoto.
