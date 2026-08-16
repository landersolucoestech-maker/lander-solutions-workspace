# Baseline da refatoração de governança e operações financeiras

Data de inspeção: 2026-08-04  
Branch GitHub autorizada: `dev`  
Head inspecionado antes deste documento: `aa9fdd17b552e0fa9483aee8e694aa5f29307407`  
Supabase autorizado: `jodzhcktrlwinywqgbab`  
Produção proibida: `giiwiwjerzavtwocxltz`

## Estado da execução

Modo: `REFATORAÇÃO_CONTROLADA_SEQUENCIAL`.

Este documento registra evidências das etapas iniciais antes de novas alterações de schema. Nenhuma conclusão de produção é derivada deste baseline.

## 1. Inspeção do repositório

- A branch remota ativa e autorizada é `dev`.
- O acesso foi realizado pelo conector GitHub, sem worktree local; portanto, não existe saída local de `git status --short` a declarar.
- Foram preservadas alterações já existentes na branch.
- Commits preexistentes relevantes encontrados no início da execução:
  - `aa9fdd17` — alinhamento de RLS patrimonial por unidade;
  - `8fc1c3c` — consolidação inicial de equipamentos no patrimônio;
  - `445833e` — RLS e menor privilégio societário;
  - `f52f4c8` — integridade e auditoria societária.

## 2. Scripts técnicos existentes

O projeto possui scripts reais para `lint`, `typecheck`, testes Vitest, auditorias de repositório/banco e `build`. Não existem atualmente scripts denominados `test:integration` ou `test:e2e` no `package.json`; equivalentes deverão ser implementados ou documentados antes do aceite final.

## 3. Navegação atual incompatível com o modelo final

O menu ainda expõe nomenclaturas ambíguas ou agregadas:

- `Rateio`;
- `Participações e Repasses`;
- `Ativos`;
- `Estrutura Corporativa`;
- `Jurídico e Compliance`.

A navegação final ainda não foi aplicada. Nenhum nome legado deverá permanecer simultaneamente no menu definitivo.

## 4. Fronteiras de frontend observadas

- `src/features/legal/legal-compliance-page.tsx` possui aproximadamente 95 KB e agrega Jurídico e Compliance em uma página monolítica.
- A separação por domínio, serviços, componentes, formulários, schemas, hooks e testes ainda precisa ser executada.
- As rotas legadas atuais incluem `/ativos`, `/estrutura`, `/juridico`, `/rateio` e `/participacoes`.

## 5. Estruturas canônicas já existentes no banco de desenvolvimento

Foram encontradas as estruturas organizacionais solicitadas:

- `legal_entities`;
- `business_units`;
- `departments`;
- `positions`;
- `products`;
- `service_lines`;
- `projects`;
- `cost_centers`;
- `revenue_centers`.

Também existem as estruturas principais para patrimônio, Jurídico, Compliance, propriedade intelectual, rateios, participações contratuais e repasses.

## 6. Estrutura societária já iniciada

As migrations já aplicadas criaram:

- `corporate_ownership_roles`;
- `corporate_ownership_positions`;
- `corporate_ownership_changes`;
- `corporate_ownership_change_lines`.

Na inspeção, todas estavam vazias. O modelo deverá ser validado contra os requisitos de capital, quotas, vigência, histórico, evidência e soma máxima de 100% antes de receber consumidores de frontend.

## 7. Duplicação patrimonial ativa

Contagens observadas:

| Tabela                  | Registros |
| ----------------------- | --------: |
| `corporate_assets`      |         6 |
| `asset_assignments`     |         1 |
| `equipment`             |         2 |
| `equipment_assignments` |         1 |

A migration inicial de consolidação criou rastreabilidade por `legacy_source` e `legacy_source_id`, mas as tabelas legadas continuam existentes e graváveis/leituráveis. A descontinuação somente poderá ocorrer após validação de correspondência, FKs, consumidores, contagens e ausência de órfãos.

## 8. Duplicação jurídica ativa

Contagens observadas:

| Tabela                | Registros |
| --------------------- | --------: |
| `legal_cases`         |         2 |
| `legal_matters`       |         2 |
| `legal_matter_events` |         3 |

As duas tabelas possuem sobreposição material de entidade jurídica, unidade, projeto, contrato, contraparte, responsável, risco, exposição, datas, resultado e auditoria. `legal_matters` possui cobertura mais ampla e será a candidata canônica, mas nenhuma descontinuação de `legal_cases` será feita antes do mapeamento registro a registro e das referências externas.

## 9. Falha de segurança encontrada

Foram encontradas policies `dev_public_read` para o papel `anon` em tabelas afetadas, incluindo:

- `corporate_assets`;
- `equipment`;
- `equipment_assignments`;
- `legal_cases`;
- `legal_matters`.

Essa exposição não será aceita como estado final. A correção deverá ser feita por migration versionada, com teste de negação anônima e validação das policies autenticadas. RLS não será desativado.

## 10. Modelo canônico adotado para a próxima etapa

- Estrutura Organizacional: entidades, unidades, departamentos, cargos, produtos, serviços, projetos e centros financeiros.
- Estrutura Societária: sócios, administradores, beneficiários finais, capital, quotas e alterações históricas.
- Patrimônio e Licenças: `corporate_assets`, `asset_events` e `asset_assignments`.
- Jurídico: `legal_matters` e `legal_matter_events`.
- Compliance e Políticas: obrigações, ocorrências, políticas, versões e documentos de governança.
- Propriedade Intelectual: `intellectual_property_assets` e `intellectual_property_events` como única fonte mestre de marcas e direitos autorais.
- Rateio de Custos: regras, versões, direcionadores, execuções, distribuições e aprovações.
- Participações Contratuais: contratos, versões, fórmulas, participantes, cálculos e aprovações.
- Repasses a Participantes: obrigações, pagamentos, liquidações e conciliação.

## 11. Próximas validações obrigatórias antes da primeira nova migration

1. Mapear constraints, FKs, triggers, functions e consumers das tabelas duplicadas.
2. Comparar registro a registro equipamentos e atribuições já migrados.
3. Comparar registro a registro `legal_cases` e `legal_matters`.
4. Identificar tipos ainda permitidos em `corporate_assets`, especialmente `trademark`, `copyright` e `contractual_right`.
5. Verificar referências cruzadas entre Jurídico, Compliance e propriedade intelectual.
6. Validar o modelo societário existente contra todos os invariantes solicitados.
7. Fechar o plano de migrations em ordem segura e sem duas fontes graváveis.

## Garantias desta etapa

- O projeto Supabase de produção `giiwiwjerzavtwocxltz` não foi alterado.
- A branch `main` do GitHub não foi alterada.
- Nenhuma promoção para produção foi realizada.
- Nenhuma tabela foi excluída.
- Nenhum dado foi alterado ou removido.
