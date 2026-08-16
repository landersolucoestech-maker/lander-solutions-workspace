# Fase 5 — Estrutura corporativa

Data: 30 de julho de 2026  
Branch GitHub: `dev`  
Supabase: `jodzhcktrlwinywqgbab`  
Pull request: `#1` em modo rascunho

## 1. Objetivo

Implementar a estrutura corporativa e gerencial da LANDER SOLUTIONS, substituindo os diretórios demonstrativos por dados persistidos no Supabase.

A fase contempla:

- pessoa jurídica;
- moedas;
- unidades de negócio;
- produtos;
- linhas de serviço;
- departamentos;
- projetos;
- centros de custo;
- centros de receita;
- categorias financeiras;
- períodos financeiros;
- RLS;
- auditoria;
- controle de concorrência;
- modais e operações Criar, Ver, Editar e Excluir ou ação segura equivalente.

## 2. Estrutura empresarial aplicada

A única pessoa jurídica cadastrada é:

- `LANDER_SOLUTIONS` — LANDER SOLUTIONS LTDA.

As unidades gerenciais oficiais são:

- `CORPORATIVO` — camada administrativa e de consolidação;
- `MUSICOS360` — Music OS 360;
- `VIVENDOMUSICA` — Vivendo da Música;
- `DICADECRIA` — Dica de Cria;
- `LANDERSERVICES` — Lander Services.

`CORPORATIVO` não representa um quinto produto.

## 3. Remoção conceitual das unidades legadas

Não foram cadastradas as unidades superadas:

- `DISPATCH-SOFTWARE`;
- `DISPATCH-SERVICE`;
- `TECH-SERVICES`;
- `CLEANING-BPO`;
- `DJSTAY-EAD`.

A validação no banco confirmou zero unidades com esses códigos.

Serviços tecnológicos, apoio administrativo e dispatch são linhas cadastráveis dentro de `LANDERSERVICES`.

`DISPATCH_SERVICES` foi criado exclusivamente como linha de serviço operacional. Nenhum software, aplicação ou banco Lander Dispatch foi criado.

## 4. Produtos iniciais

Foram cadastrados:

- `MUSIC_OS_360` — Music OS 360;
- `VIVENDO_DA_MUSICA` — Vivendo da Música;
- `DICA_DE_CRIA` — Dica de Cria.

Os produtos permanecem vinculados às respectivas unidades gerenciais.

## 5. Linhas de serviço iniciais

Foram cadastradas em `LANDERSERVICES`:

- desenvolvimento de sistemas;
- websites e portais;
- automações;
- consultoria tecnológica;
- suporte técnico;
- apoio administrativo;
- serviços de dispatch;
- outros serviços.

As linhas podem ser administradas pela interface e não dependem de enumerações fixas no frontend.

## 6. Banco de dados

Foram criadas as tabelas:

- `public.currencies`;
- `public.legal_entities`;
- `public.business_units`;
- `public.products`;
- `public.service_lines`;
- `public.departments`;
- `public.projects`;
- `public.cost_centers`;
- `public.revenue_centers`;
- `public.financial_categories`;
- `public.financial_periods`.

Todas as onze tabelas possuem RLS habilitada.

## 7. Moedas

Foram cadastradas inicialmente:

- `BRL` — Real brasileiro;
- `USD` — Dólar dos Estados Unidos.

A estrutura permite novas moedas.

Moedas protegidas não podem ter o código alterado nem ser excluídas fisicamente. A ação Excluir é convertida em inativação.

## 8. Categorias financeiras

Foram cadastradas categorias estruturais para:

- receita bruta;
- descontos;
- cancelamentos;
- reembolsos;
- chargebacks;
- impostos sobre receita;
- taxas dos meios de pagamento;
- custos diretos;
- despesas exclusivas;
- despesas compartilhadas;
- investimentos;
- reservas e contingências;
- transferências internas.

Categorias de sistema preservam o código e não podem ser excluídas fisicamente.

## 9. Centros gerenciais

Foram implementados:

- centros de custo;
- centros de receita;
- vínculo opcional com produto, linha de serviço ou projeto;
- vínculo com unidade;
- centro corporativo sem unidade específica;
- classificação do centro de custo como corporativo, direto ou compartilhado.

A estrutura impede que um centro seja relacionado simultaneamente a produto, serviço e projeto.

## 10. Períodos financeiros

Foram implementados os estados:

- aberto;
- em fechamento;
- fechado;
- reaberto.

Regras aplicadas:

- período fechado exige usuário e data de fechamento;
- período reaberto exige usuário, data e justificativa;
- períodos fechados e reabertos não podem ser excluídos;
- fechamento e reabertura exigem `finance.approve` e MFA `aal2`;
- a interface restringe transições inválidas;
- o botão Excluir permanece visível, mas explica e bloqueia a exclusão quando o período é imutável.

## 11. Proteções de registros estruturais

Registros marcados como sistema possuem proteção contra:

- alteração do código;
- exclusão física.

Unidades encerradas exigem data de encerramento.

Produtos e linhas de serviço preservam vigência por data inicial e final.

Projetos impedem vínculo simultâneo com produto e linha de serviço.

## 12. Concorrência

Todas as tabelas utilizam a coluna `version`.

As operações de edição enviam a versão esperada. Quando outro usuário altera o registro antes da gravação, a atualização retorna vazia e a interface exige recarregamento.

## 13. Auditoria

Todas as tabelas estruturais possuem triggers de auditoria para:

- criação;
- edição;
- exclusão;
- inativação;
- cancelamento;
- fechamento;
- reabertura.

A trilha registra dados anteriores e posteriores, usuário e sessão quando disponíveis.

## 14. RLS e permissões

A leitura e as mutações são controladas por:

- sessão válida;
- perfil ativo;
- papel;
- permissão;
- escopo da unidade;
- MFA `aal2` para operações administrativas.

Permissões utilizadas:

- `corporate.read`;
- `corporate.manage`;
- `finance.read`;
- `finance.manage`;
- `finance.approve`.

Ocultar botões no frontend não é utilizado como mecanismo de segurança.

## 15. CRUD e interface

### Rota `/unidades`

Implementa CRUD real de:

- unidades;
- produtos;
- linhas de serviço.

Possui:

- Criar;
- Ver;
- Editar;
- Excluir;
- modais;
- busca;
- filtro global por unidade;
- loading;
- estado vazio;
- estado de erro;
- feedback por toast;
- concorrência otimista;
- exclusão ou inativação segura.

### Rota `/centros-de-custo`

Implementa CRUD real de:

- centros de custo;
- centros de receita.

Possui vínculo com unidade, produto, linha de serviço ou projeto.

### Rota `/estrutura`

Implementa CRUD real de:

- pessoa jurídica;
- moedas;
- departamentos;
- projetos;
- categorias financeiras;
- períodos financeiros.

Todas as operações utilizam dados do Supabase, sem arrays financeiros hardcoded.

## 16. Exclusão segura

A presença do botão Excluir não autoriza remoção física incondicional.

Regras aplicadas:

- registro de sistema: inativação;
- unidade, produto ou serviço com dependências: inativação;
- departamento ativo: inativação;
- projeto ativo ou planejado: cancelamento;
- moeda ativa ou protegida: inativação;
- categoria ativa ou protegida: inativação;
- período aberto sem dependências: exclusão física permitida;
- período fechado ou reaberto: exclusão bloqueada;
- registro inativo sem dependências: exclusão física tentada e protegida por FKs.

## 17. Migrations

Migrations aplicadas somente no Supabase `dev` e registradas no GitHub:

- `20260731015957_corporate_structure_foundation`;
- `20260731020116_optimize_corporate_structure_indexes`.

A produção `giiwiwjerzavtwocxltz` não foi alterada.

## 18. Índices

Foram criados índices para:

- todas as FKs relevantes;
- unidade de negócio;
- produto;
- linha de serviço;
- projeto;
- departamento;
- responsáveis;
- categorias superiores;
- situação e intervalo dos períodos;
- moedas funcionais e principais.

## 19. Validações executadas

Foram executados:

- instalação limpa de dependências;
- lint;
- typecheck;
- testes unitários;
- build de produção;
- advisor de segurança do Supabase;
- advisor de performance do Supabase;
- verificação das unidades oficiais;
- verificação de ausência das unidades legadas;
- verificação de RLS em todas as tabelas;
- verificação de `DISPATCH_SERVICES` como linha de serviço.

Não foram encontrados bloqueios de segurança para encerramento da fase.

## 20. Ressalvas

- o ambiente de desenvolvimento ainda não possui proprietário real para teste manual autenticado de ponta a ponta;
- departamentos, projetos e centros estão inicialmente vazios e deverão ser cadastrados com dados reais;
- o fechamento financeiro completo ainda dependerá do ledger e dos módulos financeiros das fases posteriores;
- as telas legadas de outros módulos continuarão sendo substituídas sequencialmente;
- nenhuma promoção para produção está autorizada.

## 21. Critérios de aceite

| Critério                            | Resultado |
| ----------------------------------- | --------- |
| Pessoa jurídica persistida          | Aprovado  |
| Unidades oficiais persistidas       | Aprovado  |
| Produtos persistidos                | Aprovado  |
| Serviços persistidos                | Aprovado  |
| Dispatch somente como serviço       | Aprovado  |
| Moedas                              | Aprovado  |
| Departamentos                       | Aprovado  |
| Projetos                            | Aprovado  |
| Centros de custo e receita          | Aprovado  |
| Categorias financeiras              | Aprovado  |
| Períodos financeiros                | Aprovado  |
| RLS                                 | Aprovado  |
| Auditoria                           | Aprovado  |
| Concorrência otimista               | Aprovado  |
| Criar, Ver, Editar e Excluir seguro | Aprovado  |
| Lint                                | Aprovado  |
| Typecheck                           | Aprovado  |
| Testes                              | Aprovado  |
| Build                               | Aprovado  |
| Produção preservada                 | Aprovado  |

## 22. Status

**Aprovado com ressalvas.**

A Fase 6 — Cadastros corporativos pode começar no Supabase de desenvolvimento. Nenhuma alteração de produção foi autorizada.
