# Plano canônico — Governança, Patrimônio, Jurídico e Operações Financeiras

Data de referência: 2026-08-05  
Repositório: `landersolucoestech-maker/lander-solutions`  
Branch autorizada: `dev`  
Supabase autorizado: `jodzhcktrlwinywqgbab`  
Produção proibida: GitHub `main` e Supabase `giiwiwjerzavtwocxltz`

## 1. Condições de execução

- Modo: `REFATORAÇÃO_CONTROLADA_SEQUENCIAL`.
- Nenhuma promoção, merge ou escrita em produção.
- A inspeção local do worktree não pôde ser realizada porque o ambiente de execução não resolveu `github.com`; por isso, branch, commits e arquivos foram inspecionados pela API conectada do GitHub.
- A branch remota `dev` foi confirmada antes das alterações.
- Não será declarado resultado de instalação, lint, teste ou build sem execução verificável por CI ou ambiente conectado.

## 2. Evidências do estado anterior

### 2.1 Navegação e frontend

A navegação anterior expunha os seguintes blocos ambíguos:

- `Ativos` (`/ativos`);
- `Estrutura Corporativa` (`/estrutura`);
- `Jurídico e Compliance` (`/juridico`);
- `Rateio` (`/rateio`);
- `Participações e Repasses` (`/participacoes`);
- `Propriedade Intelectual` (`/propriedade-intelectual`).

As páginas combinavam responsabilidades independentes. Foram identificadas páginas monolíticas, incluindo aproximadamente 95 KB no módulo jurídico/compliance, 57 KB em rateios e 53 KB em ativos.

### 2.2 Fontes de verdade duplicadas

- Equipamentos: `corporate_assets` e `equipment` eram cadastros mestres graváveis; `equipment_assignments` referenciava apenas o cadastro legado.
- Jurídico: `legal_cases` e `legal_matters` eram fontes graváveis concorrentes; `governance_documents` referenciava `legal_cases`.
- Patrimônio versus propriedade intelectual: o catálogo de `corporate_assets.asset_type` aceitava `trademark`, `copyright` e `contractual_right`.
- Domínios: havia domínio cadastrado simultaneamente em `corporate_assets` e `intellectual_property_assets`.
- Permissões: coexistiam gerações incompatíveis, incluindo `corporate.*`, `allocation.*`, `participation.*`, `participations.*`, `payout.*` e `payouts.*`.

### 2.3 Contagens de referência antes da migração

- `corporate_assets`: 4 registros.
- `equipment`: 2 registros.
- `equipment_assignments`: 1 registro.
- `legal_cases`: 2 registros.
- `legal_matters`: 2 registros.
- `legal_matter_events`: 3 registros.
- `governance_documents`: 3 registros.
- `compliance_obligations`: 3 registros.
- `compliance_occurrences`: 3 registros.
- `corporate_policies`: 2 registros.
- `corporate_policy_versions`: 0 registros.
- `intellectual_property_assets`: 3 registros.
- `intellectual_property_events`: 3 registros.

Os dois equipamentos legados não eram duplicatas exatas dos quatro ativos existentes e deverão ser preservados como novos registros canônicos. Os dois `legal_cases` não eram duplicatas dos dois `legal_matters` e deverão ser migrados sem perda.

## 3. Modelo canônico aprovado

### 3.1 Estrutura Organizacional

Mantém como fontes canônicas:

- `legal_entities`;
- `business_units`;
- `departments`;
- `positions`;
- `products`;
- `service_lines`;
- `projects`;
- `cost_centers`;
- `revenue_centers`.

Não armazenará capital, quotas, processos jurídicos, ativos, propriedade intelectual, rateios, participações contratuais ou repasses.

### 3.2 Estrutura Societária

Não havia modelo normalizado equivalente. Será criada uma estrutura temporal e não destrutiva com:

- estruturas de capital por entidade e vigência;
- classes de quotas/participação;
- posições societárias por titular;
- papéis societários e beneficiários finais;
- alterações societárias e linhas de alteração;
- deliberações;
- documentos e evidências;
- percentual derivado de quotas;
- validações de quantidade, vigência e soma máxima;
- trilha de auditoria.

`contract_version_participants` não será reutilizada.

### 3.3 Patrimônio e Licenças

Fonte mestre única:

- `corporate_assets`;
- `asset_events`;
- nova `asset_assignments` referenciando `corporate_assets` e `employees`.

Plano de consolidação:

1. ampliar os campos operacionais de `corporate_assets`;
2. migrar os dois equipamentos preservando IDs quando não houver colisão;
3. migrar a atribuição preservando histórico;
4. mudar consultas, Edge Functions e funções SQL de RH;
5. validar contagens e referências;
6. bloquear escrita legada;
7. descontinuar `equipment` e `equipment_assignments` apenas após consumidores zerados.

`trademark` e `copyright` serão removidos do catálogo permitido. `contractual_right` ficará proibido até existir definição de negócio formal e distinta.

### 3.4 Jurídico

Fonte mestre única:

- `legal_matters`;
- `legal_matter_events`.

Plano:

1. ampliar `legal_matters` com campos necessários existentes apenas em `legal_cases`;
2. migrar os dois casos preservando IDs e vínculos;
3. adicionar `governance_documents.legal_matter_id`;
4. migrar documentos;
5. criar vínculo explícito entre assuntos jurídicos e ativos de propriedade intelectual;
6. alterar frontend, API e Edge Function;
7. bloquear escrita e posteriormente descontinuar `legal_cases`.

### 3.5 Compliance e Políticas

Fontes canônicas existentes:

- `compliance_obligations`;
- `compliance_occurrences`;
- `corporate_policies`;
- `corporate_policy_versions`;
- `governance_documents`.

Obrigações de propriedade intelectual deverão referenciar `intellectual_property_assets`; não haverá novo cadastro do ativo.

### 3.6 Propriedade Intelectual

Fontes canônicas:

- `intellectual_property_assets`;
- `intellectual_property_events`.

Marcas e direitos autorais serão exclusivos deste domínio. Domínios operacionais serão exclusivos de `corporate_assets`; o registro de domínio duplicado em propriedade intelectual terá histórico transferido antes da descontinuação.

### 3.7 Rateio de Custos

As tabelas existentes já separam regra, versão, destino, direcionador, execução, fonte, distribuição e aprovação. Serão mantidas e terão nomenclatura, permissões, serviços e interface alinhados ao domínio `cost-allocation`.

O rateio apenas reclassifica custos gerenciais; não cria participante, contrato ou pagamento.

### 3.8 Participações Contratuais

As tabelas existentes de contratos, versões, fórmulas, participantes, cálculos, linhas e aprovações serão mantidas. O frontend combinado será dividido e o domínio passará a se chamar `contractual-participations`.

A versão contratual usada no cálculo permanecerá identificada e a interface exibirá que participação contratual não representa sociedade, quotas, capital social ou voto.

### 3.9 Repasses a Participantes

`payout_obligations` e `payout_payments` continuarão separados de `participation_calculations`. A interface combinada será dividida e o módulo passará a se chamar `payouts`.

A restrição existente que impede pagamento acima do valor devido será preservada e coberta por testes.

## 4. Sequência de migrations

1. `canonical_corporate_ownership_foundation` — domínio societário, integridade, RLS inicial e auditoria.
2. `consolidate_assets_and_assignments` — estrutura canônica patrimonial e migração aditiva.
3. `consolidate_legal_matters_and_documents` — consolidação jurídica aditiva.
4. `align_compliance_ip_and_policy_versions` — referências de IP, políticas versionadas e eliminação controlada de duplicação de domínio.
5. `canonical_domain_permissions` — códigos canônicos, cópia de vínculos de papéis e políticas.
6. Após serviços/frontend: `retire_legacy_governance_sources` — somente depois de provar ausência de consumidores.
7. Após autenticação e testes: `harden_governance_rls` — remover políticas públicas de desenvolvimento e aplicar menor privilégio.

Cada migration será aplicada primeiro no Supabase `jodzhcktrlwinywqgbab`, seguida de consultas de contagem, integridade, duplicidade e orfandade. O SQL versionado no GitHub deverá ser idêntico ao aplicado.

## 5. Permissões canônicas

- `organizational_structure.read`, `organizational_structure.manage`;
- `corporate_ownership.read`, `corporate_ownership.manage`, `corporate_ownership.apply_changes`;
- `assets.read`, `assets.manage`, `assets.approve_events`;
- `legal.read`, `legal.manage`, `legal.close`;
- `compliance.read`, `compliance.manage`, `compliance.complete`, `compliance.waive`;
- `intellectual_property.read`, `intellectual_property.manage`;
- `cost_allocations.read`, `cost_allocations.manage`, `cost_allocations.approve`, `cost_allocations.post`, `cost_allocations.reverse`;
- `contractual_participations.read`, `contractual_participations.calculate`, `contractual_participations.approve`, `contractual_participations.post`, `contractual_participations.reverse`;
- `payouts.read`, `payouts.manage`, `payouts.pay`, `payouts.reverse`.

Códigos antigos só poderão existir temporariamente durante a migração dos consumidores; não serão aliases permanentes.

## 6. Navegação final

### Governança

- Estrutura Organizacional;
- Estrutura Societária;
- Patrimônio e Licenças;
- Jurídico;
- Compliance e Políticas;
- Propriedade Intelectual.

### Financeiro

- Documentos Financeiros;
- Contas a Pagar e Receber;
- Rateio de Custos;
- Participações Contratuais;
- Repasses a Participantes;
- Tesouraria;
- Conciliação Bancária.

Rotas antigas serão redirecionamentos temporários documentados e testados; não haverá nomes antigos e novos simultaneamente no menu.

## 7. Critérios para retirar estruturas legadas

Uma tabela, rota ou permissão legada só poderá ser retirada após:

1. migração e reconciliação de contagens;
2. ausência de campos obrigatórios nulos inesperados;
3. ausência de duplicatas indevidas;
4. ausência de FKs órfãs;
5. substituição de todas as consultas e escritas;
6. testes de integração e RLS;
7. build verificável;
8. relatório de evidências.

## 8. Invariantes de produção

- O Supabase de produção `giiwiwjerzavtwocxltz` permanecerá intacto.
- A branch GitHub `main` permanecerá intacta.
- Nenhuma migration será promovida.
- Nenhum deployment será promovido a produção.
