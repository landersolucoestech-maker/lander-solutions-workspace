# Aderência financeira, fiscal, conciliação e fechamento

## Situação

**Implementada e validada tecnicamente no ambiente de desenvolvimento.**

Esta etapa amplia o núcleo financeiro das Fases 8 a 10 sem criar um segundo ledger. Todos os efeitos econômicos continuam sendo registrados em `financial_documents`, `financial_settlements`, `journal_entries` e `journal_lines`.

A implementação foi executada exclusivamente:

- no repositório `landersolucoestech-maker/lander-solutions`;
- na branch `dev`;
- no Supabase de desenvolvimento `jodzhcktrlwinywqgbab`;
- no PR nº 1, mantido em rascunho.

A branch `main` e o Supabase de produção não foram alterados.

## Lacunas corrigidas

A auditoria confirmou que o núcleo existente reconhecia genericamente:

- invoice;
- documento fiscal;
- reembolso;
- chargeback;
- investimento;
- ressarcimento.

Entretanto, faltavam estruturas próprias para:

- metadados e eventos fiscais;
- cancelamentos e ajustes financeiros versionados;
- reconciliação bancária;
- extratos OFX;
- checklist de fechamento;
- aprovação e reabertura mensal segregadas.

Essas lacunas foram corrigidas mantendo o documento financeiro e o ledger como fontes contábeis únicas.

## Estrutura persistida

Foram implementadas as tabelas:

- `financial_fiscal_documents`;
- `financial_fiscal_events`;
- `financial_adjustments`;
- `bank_statement_imports`;
- `bank_statement_lines`;
- `bank_reconciliations`;
- `financial_period_close_runs`;
- `financial_period_close_items`.

## Invoices e documentos fiscais

Os metadados fiscais são vinculados individualmente a um documento financeiro cuja origem seja `invoice` ou `fiscal_document`.

Tipos suportados:

- invoice comercial;
- NF-e;
- NFS-e;
- recibo de serviço;
- nota de crédito;
- nota de débito.

São preservados:

- número e série;
- chave de acesso;
- CPF ou CNPJ de emissor e destinatário;
- código do serviço;
- regime tributário;
- protocolo de autorização;
- referências dos objetos XML e PDF;
- checksum SHA-256 do XML.

O XML fiscal é permitido como exceção documental. Dados tabulares manuais continuam proibidos em CSV, TSV, XLS, JSON tabular ou formatos equivalentes.

## Eventos fiscais

Eventos suportados:

- autorização;
- cancelamento;
- correção;
- denegação;
- inutilização;
- protocolo;
- retorno oficial.

Um evento pendente pode ser aceito ou rejeitado pela ação administrativa. Quando aceito, atualiza o estado do documento fiscal correspondente.

Eventos processados são imutáveis.

## Ajustes financeiros

Tipos implementados:

- cancelamento;
- reembolso;
- chargeback;
- ressarcimento;
- nota de crédito;
- nota de débito;
- ajuste tributário.

O ajuste:

1. referencia o documento financeiro original;
2. preserva a moeda original;
3. não pode exceder o saldo econômico disponível do documento;
4. exige conta de contrapartida compatível;
5. passa por submissão e aprovação segregada;
6. gera um documento financeiro de natureza inversa;
7. copia proporcionalmente a classificação e as linhas do documento original;
8. utiliza o fluxo existente de aprovação e postagem do núcleo financeiro.

Não existe lançamento paralelo ou segundo ledger.

O criador ou solicitante não pode aprovar o próprio ajuste.

## Conciliação OFX

A importação manual de extrato aceita exclusivamente o formato OFX.

O banco armazena somente:

- conta financeira;
- período;
- saldos;
- moeda;
- referência do objeto OFX;
- checksum SHA-256;
- linhas normalizadas para conciliação.

O arquivo bruto permanece no storage configurado.

Cada linha pode ser:

- não conciliada;
- conciliada com liquidação postada ou lançamento do ledger;
- ignorada com justificativa obrigatória.

Linhas conciliadas ou ignoradas tornam-se imutáveis.

A conciliação somente pode ser submetida quando:

- não existem linhas sem tratamento;
- o saldo do banco corresponde ao saldo do razão;
- o extrato pertence à mesma conta financeira;
- valores e moedas são compatíveis.

A aprovação exige usuário diferente do criador e solicitante.

## Fechamento mensal

O fechamento possui execução própria por período financeiro e checklist versionado.

Contagens impeditivas:

- documentos em rascunho ou aguardando aprovação;
- liquidações em rascunho ou aguardando postagem;
- ajustes ainda não concluídos;
- extratos sobrepostos não conciliados;
- lançamentos do ledger em rascunho ou validados, mas não postados.

Checklist inicial:

1. documentos classificados e submetidos;
2. liquidações revisadas;
3. contas e extratos OFX conciliados;
4. documentos e eventos fiscais revisados;
5. ledger balanceado e sem lançamentos pendentes;
6. rateios definitivos postados;
7. participações consolidadas;
8. evidências anexadas ou referenciadas.

Itens obrigatórios devem ser concluídos ou formalmente dispensados, com responsável, data e justificativa.

O preparador ou solicitante não pode aprovar o próprio fechamento.

O período fechado bloqueia novas postagens. A reabertura exige permissão específica e motivo formal, preservando a trilha de auditoria.

## Permissões

Foram implementadas:

- `fiscal.read`;
- `fiscal.manage`;
- `finance.adjustments.read`;
- `finance.adjustments.manage`;
- `finance.adjustments.approve`;
- `finance.adjustments.post`;
- `reconciliation.read`;
- `reconciliation.manage`;
- `reconciliation.approve`;
- `period_close.read`;
- `period_close.manage`;
- `period_close.approve`;
- `period_close.reopen`.

Proprietário e administrador corporativo recebem todas as permissões. O gestor financeiro recebe as operações financeiras usuais. Auditoria e perfis somente leitura recebem apenas consulta.

## Segurança

- RLS ativa em todas as tabelas;
- nenhum privilégio para `anon`;
- RPCs administrativas revogadas de `public`, `anon` e `authenticated`;
- execução privilegiada somente por `service_role` dentro da Edge Function;
- JWT obrigatório;
- MFA `aal2` obrigatório;
- concorrência otimista por `version`;
- trilha de auditoria;
- autoaprovação bloqueada;
- eventos e linhas conciliadas imutáveis;
- todas as novas chaves estrangeiras cobertas por índices;
- advisor de segurança do Supabase sem alertas.

## Edge Function

A função `admin-financial-operations`, versão 1, está ativa com JWT obrigatório.

Ações disponíveis:

- processar evento fiscal;
- submeter, aprovar, rejeitar e postar ajuste;
- submeter, aprovar e rejeitar conciliação;
- preparar fechamento;
- submeter fechamento;
- fechar período;
- reabrir período.

A função temporária utilizada exclusivamente para exportar migrations foi neutralizada após a exportação. Sua versão atual exige JWT e responde somente `410 — Exportação encerrada`.

## Interface

A rota `/operacoes-financeiras` contém:

- indicadores de documentos fiscais, ajustes, extratos e fechamentos;
- aba Fiscal;
- aba Ajustes;
- aba Conciliação;
- aba Fechamento;
- ações explícitas **Criar**, **Ver**, **Editar** e **Excluir** para registros em estados permitidos;
- processamento de eventos fiscais;
- aprovação e postagem de ajustes;
- registro de extratos OFX e linhas;
- conciliação contra liquidações reais;
- checklist mensal;
- fechamento e reabertura segregados.

## Migrations

Foram versionadas na `dev`, com os mesmos números e conteúdos aplicados no Supabase:

- `financial_compliance_and_closing_foundation`;
- `financial_compliance_and_closing_actions`;
- `index_financial_compliance_foreign_keys`.

## Teste transacional

Foi executado um cenário completo dentro de `BEGIN` e `ROLLBACK`, com dois usuários temporários distintos:

- invoice de R$ 1.000,00 emitido;
- autorização fiscal aceita;
- reembolso parcial de R$ 200,00;
- autoaprovação do ajuste bloqueada;
- aprovação por segundo usuário;
- documento financeiro inverso de R$ 200,00 gerado e postado;
- liquidação de R$ 1.000,00 postada;
- extrato OFX de R$ 1.000,00 conciliado;
- diferença bancária igual a zero;
- checklist concluído;
- período fechado por segundo usuário;
- período reaberto com motivo formal.

O `ROLLBACK` foi confirmado. Não permaneceram usuários, documentos, ajustes, extratos ou fechamentos de teste.

## Validação da aplicação

A aplicação foi validada com:

- formatação;
- lint;
- typecheck;
- testes unitários;
- build de produção;
- ausência de workflows temporários no repositório.
