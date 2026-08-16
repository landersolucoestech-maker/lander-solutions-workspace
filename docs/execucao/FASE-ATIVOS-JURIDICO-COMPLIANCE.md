# Fase — Ativos, Jurídico e Compliance

## Situação

Implementação funcional conectada ao Supabase de desenvolvimento e sincronizada com o repositório na branch `dev`.

O registro agregado usado originalmente nesta fase foi substituído pelos owners canônicos de Ativos, Jurídico, Compliance/Políticas e Propriedade Intelectual.

Nenhuma alteração foi executada na branch `main` ou no Supabase de produção.

## Escopo implementado

### Ativos corporativos

- cadastro patrimonial por pessoa jurídica e unidade;
- vínculo opcional com produto, linha de serviço, projeto, contrato, fornecedor e documento financeiro;
- categoria, etiqueta, número de série, quantidade e valores de aquisição e atual;
- custódia, localização, garantia, renovação e vencimento;
- referências documentais externas e checksum SHA-256;
- eventos de transferência, manutenção, retorno ao serviço, renovação, baixa e perda;
- submissão, aprovação segregada e aplicação do evento;
- autoaprovação bloqueada.

### Jurídico

- processos e demandas vinculados a unidade, produto, serviço, projeto, contrato e contraparte;
- tipo, jurisdição, autoridade, número do processo, risco e probabilidade;
- exposição financeira por moeda;
- responsáveis internos e assessoria externa;
- eventos, prazos, evidências e resultados;
- encerramento formal com resultado obrigatório.

### Propriedade intelectual

- marcas, direitos autorais e demais ativos de propriedade intelectual;
- jurisdição, autoridade, pedido, registro, classificações e datas;
- vencimento e renovação;
- eventos de protocolo, registro, deferimento, rejeição, renovação, cancelamento e expiração;
- decisão administrativa com atualização do estado do ativo.

### Compliance

- obrigações por pessoa jurídica e unidade;
- vínculo com produto, serviço, projeto e contrato;
- categoria, autoridade, base legal, frequência e regra de vencimento;
- nível de risco e exigência de evidência;
- ocorrências por competência e vencimento;
- conclusão com evidência obrigatória quando configurada;
- dispensa formal com motivo.

### Políticas corporativas

- políticas por pessoa jurídica e unidade;
- versões numeradas;
- arquivo externo obrigatório e checksum;
- submissão, aprovação segregada, rejeição e publicação;
- autoaprovação bloqueada;
- publicação substitui a versão anteriormente publicada sem apagar o histórico.

## Segurança

- RLS habilitada em todas as tabelas expostas;
- nenhum privilégio concedido ao papel `anon`;
- autorizações por unidade gerencial;
- operações administrativas isoladas nas Edge Functions `admin-assets`, `admin-legal`, `admin-compliance` e `admin-intellectual-property`;
- JWT e MFA `aal2` obrigatórios;
- RPCs sensíveis restritas ao `service_role`;
- controle de concorrência otimista por `version`;
- auditoria de inclusão, alteração e exclusão;
- advisor de segurança do Supabase sem alertas.

## Tabelas principais

- `corporate_assets`;
- `asset_events`;
- `legal_matters`;
- `legal_matter_events`;
- `intellectual_property_assets`;
- `intellectual_property_events`;
- `compliance_obligations`;
- `compliance_occurrences`;
- `corporate_policies`;
- `corporate_policy_versions`.

## Ações administrativas

- `admin_submit_asset_event`;
- `admin_decide_asset_event`;
- `admin_apply_asset_event`;
- `admin_apply_ip_event`;
- `admin_complete_compliance_occurrence`;
- `admin_waive_compliance_occurrence`;
- `admin_submit_policy_version`;
- `admin_decide_policy_version`;
- `admin_publish_policy_version`;
- `admin_close_legal_matter`.

## Migrations sincronizadas

- `20260731181222_assets_legal_compliance_foundation`;
- `20260731181426_align_governance_registry_with_application`;
- `20260731181615_governance_administrative_actions`;
- `20260731185040_remove_temporary_governance_migration_export`;
- `20260731185123_assert_governance_export_removed`.

Os SQLs aplicados no Supabase de desenvolvimento estão registrados em `supabase/migrations`.

## Limpeza do mecanismo de sincronização

- o workflow descartável de exportação foi removido automaticamente da branch `dev`;
- a RPC temporária `admin_export_governance_migrations` foi removida do banco;
- a Edge Function temporária `governance-migration-export` foi substituída por uma versão inerte, com JWT obrigatório e resposta permanente `410 Gone`;
- nenhum mecanismo temporário mantém acesso ao histórico de migrations.

## Validação executada

- Edge Functions específicas de cada domínio ativas com JWT obrigatório;
- todas as RPCs administrativas localizadas no banco;
- tabelas esperadas pelo frontend disponíveis;
- advisor de segurança sem alertas;
- lint aprovado;
- typecheck aprovado;
- testes aprovados;
- build aprovado;
- histórico remoto e arquivos locais de migration sincronizados;
- produção não alterada.
