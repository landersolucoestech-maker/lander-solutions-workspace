# Fase 0 — Auditoria inicial

Data da auditoria: 30 de julho de 2026  
Repositório: `landersolucoestech-maker/lander-solutions`  
Branch auditada: `dev`  
Supabase de produção: `giiwiwjerzavtwocxltz`  
Supabase de desenvolvimento: branch `dev`, project ref `jodzhcktrlwinywqgbab`

## 1. Escopo executado

A auditoria avaliou:

- repositório e branches;
- stack e dependências;
- estrutura de rotas;
- arquitetura atual do frontend;
- persistência de dados;
- autenticação e autorização;
- estrutura Supabase de desenvolvimento e produção;
- migrations;
- riscos de segurança e performance sinalizados pelo Supabase;
- aderência do protótipo ao Prompt Mestre atualizado;
- existência de CRUD, modais e ações Criar, Ver, Editar e Excluir;
- divergências entre os dados atuais e as unidades oficiais da LANDER SOLUTIONS.

Nenhuma tabela funcional, migration de domínio ou funcionalidade de negócio foi criada nesta fase.

## 2. Estado do GitHub

### 2.1 Repositório

- Repositório privado e acessível.
- Permissões administrativas, de manutenção e escrita confirmadas.
- Branch padrão: `main`.
- Branch `dev` existente.
- Não foi encontrada branch GitHub denominada `prod`.
- Antes do commit da documentação desta auditoria, `main` e `dev` apontavam para o mesmo commit.

### 2.2 Risco de fluxo de branches

O fluxo atual não fornece isolamento efetivo porque `main` e `dev` estavam idênticas. A partir desta auditoria, os documentos foram adicionados somente à `dev`, iniciando a separação.

Antes da implementação deverão ser definidos formalmente:

- `dev`: desenvolvimento;
- `staging` ou `homologacao`: validação;
- `main` ou `prod`: produção;
- regras de pull request;
- revisão obrigatória;
- proteção de branch;
- execução de CI antes de merge;
- política de promoção de migrations Supabase.

Não deverá ser criada uma branch GitHub adicional sem decisão explícita registrada na fase de especificação.

## 3. Stack atual

O projeto utiliza atualmente:

- React `19.2.0`;
- TypeScript `5.8.3`;
- TanStack Start;
- TanStack Router;
- TanStack Query;
- Vite `8.1.5`;
- Tailwind CSS `4.2.1`;
- Radix UI;
- React Hook Form;
- Zod;
- Recharts;
- Sonner;
- Lucide React.

### 3.1 Lacunas da fundação

O `package.json` não possui atualmente:

- dependência `@supabase/supabase-js`;
- cliente Supabase configurado;
- script explícito de `typecheck`;
- script de testes unitários;
- script de testes de integração;
- script de testes E2E;
- script de auditoria de segurança;
- script de validação de migrations.

Foi encontrado script de lint e build, mas não foi identificada pipeline de CI em `.github/workflows/ci.yml`.

A existência de outros arquivos de workflow com nomes diferentes não foi confirmada pelo conector e deverá ser validada na fase de fundação.

## 4. Arquitetura atual do frontend

O projeto possui estrutura de rotas TanStack e os seguintes módulos principais:

- Dashboard;
- Acessos;
- Ativos;
- Auditoria;
- Centros de custo;
- Clientes e fornecedores;
- Contas a pagar;
- Contas a receber;
- Contratos;
- Estrutura;
- Jurídico;
- Ledger;
- Rateio;
- Unidades.

A estrutura atual é um protótipo visual com consultas locais a arquivos em `src/data`.

Não existe camada de repositório, serviço de domínio ou persistência remota implementada.

## 5. Dados atuais

Os registros exibidos nas telas são arrays TypeScript hardcoded.

Foram identificados exemplos de:

- clientes;
- fornecedores;
- contratos;
- unidades;
- ativos;
- lançamentos;
- usuários;
- permissões;
- dados financeiros.

Embora commits anteriores utilizem a descrição “dados reais”, os dados estão definidos diretamente no código-fonte e não possuem origem persistente ou auditável.

Esses dados não poderão ser migrados automaticamente para produção como dados oficiais sem validação individual.

## 6. Divergência das unidades

Os dados atuais ainda utilizam unidades e produtos superados pelo requisito vigente, incluindo:

- `DISPATCH-SOFTWARE`;
- `DISPATCH-SERVICE`;
- `TECH-SERVICES`;
- `CLEANING-BPO`;
- `DJSTAY-EAD`.

Também existem contratos e clientes relacionados a um software Lander Dispatch, que não deverá existir segundo a definição atual.

A estrutura oficial deverá ser:

- `MUSICOS360` — Music OS 360;
- `VIVENDOMUSICA` — Vivendo da Música;
- `DICADECRIA` — Dica de Cria;
- `LANDERSERVICES` — Lander Services;
- `CORPORATIVO` somente como centro administrativo e camada de consolidação, não como quinto produto.

As linhas de tecnologia, suporte administrativo e serviços de dispatch deverão ser cadastradas dentro de `LANDERSERVICES`.

Os dados hardcoded incompatíveis deverão ser removidos ou convertidos em fixtures de desenvolvimento claramente identificadas, sem migração automática para produção.

## 7. CRUD e interface

O frontend atual apresenta tabelas, KPIs, filtros e busca, porém não implementa CRUD funcional.

### 7.1 Ausências confirmadas

- botão Criar nas páginas de cadastro;
- ação Ver por registro;
- ação Editar por registro;
- ação Excluir por registro;
- modais de criação;
- modais de visualização;
- modais de edição;
- confirmação de exclusão;
- persistência após operação;
- validação server-side;
- tratamento de concorrência;
- auditoria das alterações;
- autorização real por operação.

O arquivo `docs/REQUISITOS-UI-CRUD.md` foi criado na branch `dev` para tornar obrigatório o padrão de modais e ações.

### 7.2 Regra de exclusão

O botão Excluir deverá existir nos módulos aplicáveis, mas a ação executada dependerá da natureza do registro:

- exclusão física para cadastros sem dependências e sem exigência de retenção;
- inativação ou encerramento para cadastros vinculados;
- cancelamento para obrigações ainda não consolidadas;
- estorno ou reversão para registros financeiros consolidados;
- proibição de exclusão para auditoria e períodos encerrados.

## 8. Autenticação e autorização

O shell principal renderiza diretamente a aplicação e as rotas sem guard de autenticação funcional.

Não foi identificado:

- login integrado ao Supabase Auth;
- validação de sessão;
- MFA funcional;
- RBAC persistido;
- escopo por unidade persistido;
- RLS baseado em permissões;
- revogação de sessão;
- proteção server-side das rotas;
- segregação de funções aplicada pelo banco.

As telas de acessos e matriz de permissões são demonstrativas e utilizam dados locais.

## 9. Supabase

### 9.1 Projetos

Produção:

- nome: `LANDER SOLUTIONS`;
- project ref: `giiwiwjerzavtwocxltz`;
- status: ativo e saudável;
- região: São Paulo;
- PostgreSQL 17.

Desenvolvimento:

- branch: `dev`;
- project ref: `jodzhcktrlwinywqgbab`;
- parent: `giiwiwjerzavtwocxltz`;
- status: ativo e saudável;
- sem cópia de dados de produção;
- branch marcada pelo Supabase como não persistente.

### 9.2 Banco

Nos projetos de desenvolvimento e produção:

- nenhuma tabela funcional foi encontrada no schema `public`;
- existe apenas a migration `20260731004319_remote_schema`;
- não existe esquema corporativo implementado;
- não existem tabelas das unidades;
- não existem tabelas financeiras;
- não existem políticas RLS de domínio;
- não existe ledger;
- não existem rateios;
- não existem contratos de participação;
- não existem contas-correntes gerenciais;
- não existem repasses;
- não existem relatórios persistidos.

## 10. Risco de segurança Supabase

O advisor de segurança identificou que a função:

`public.rls_auto_enable()`

possui as seguintes características:

- `SECURITY DEFINER`;
- localizada no schema público exposto;
- permissão de execução para `anon`;
- permissão de execução para `authenticated`;
- permissão de execução para `service_role`;
- criada como função de event trigger para ativar RLS em novas tabelas públicas.

Mesmo sendo uma função de event trigger, a exposição de uma função `SECURITY DEFINER` no schema público foi corretamente sinalizada como risco.

Antes da criação do esquema funcional deverá ser aplicada uma migration específica para:

- revogar `EXECUTE` de `PUBLIC`, `anon` e `authenticated`;
- avaliar se a função deve permanecer no schema `public`;
- avaliar migração para schema interno não exposto;
- manter apenas os privilégios estritamente necessários;
- executar novamente os advisors de segurança.

Nenhuma correção foi aplicada nesta fase porque o Prompt Mestre determina que a Fase 0 seja exclusivamente de auditoria.

## 11. Advisor de performance

O Supabase informou que o Auth utiliza limite absoluto de 10 conexões de banco em vez de alocação percentual.

Esse item é informativo no estágio atual, mas deverá ser revisado antes de produção e antes de qualquer aumento de capacidade da instância.

## 12. Testes e qualidade

Não foi confirmada infraestrutura funcional de testes.

O projeto não possui scripts explícitos para:

- testes unitários;
- testes de integração;
- testes E2E;
- testes RLS;
- testes financeiros;
- testes de invariantes do ledger;
- testes de rateio;
- testes do motor de participação;
- testes de repasses;
- testes de importação XLSX.

O código atual também não possui persistência suficiente para validar esses fluxos.

## 13. Principais riscos

### Críticos

1. Aplicação sem persistência e apresentada como sistema funcional.
2. Dados hardcoded incompatíveis com a estrutura empresarial atual.
3. Ausência de autenticação e autorização reais.
4. Função `SECURITY DEFINER` exposta a `anon` e `authenticated`.
5. Ausência de schema financeiro e de regras de integridade.
6. Ausência de versionamento contratual e motor de participação.
7. Ausência de testes para cálculos financeiros.
8. Ausência de CRUD funcional e auditoria das operações.

### Altos

1. `main` e `dev` originalmente sem isolamento.
2. Ausência de CI identificada.
3. Ausência de typecheck explícito.
4. Branch Supabase `dev` marcada como não persistente.
5. README contém requisitos empresariais antigos e conflitantes.
6. Contratos e unidades antigas podem induzir implementação incorreta.
7. Números financeiros demonstrativos podem ser interpretados como dados oficiais.

### Médios

1. Forte acoplamento entre páginas e arquivos de dados locais.
2. Ausência de camada de domínio.
3. Ausência de política de tratamento de erro por operação.
4. Ausência de paginação server-side.
5. Ausência de controle de concorrência.
6. Ausência de estratégia formal para arquivos e documentos.

## 14. Dependências para a próxima fase

Antes de iniciar implementação funcional deverão ser definidos e documentados:

- modelo empresarial definitivo;
- entidades e relacionamentos;
- tabela de unidades oficiais;
- produtos e linhas de serviço;
- modelo de participantes econômicos;
- contratos de participação versionados;
- base de cálculo configurável;
- ledger gerencial;
- regime de caixa e competência;
- rateios;
- fechamento de período;
- contas-correntes gerenciais;
- reservas;
- prejuízos acumulados;
- repasses;
- regras de exclusão, cancelamento, estorno e reversão;
- matriz de permissões;
- padrão de modais e CRUD;
- fluxo GitHub e Supabase por ambiente.

## 15. Recomendação técnica

A implementação não deverá tentar adaptar diretamente os arrays atuais.

O caminho recomendado é:

1. preservar o layout e componentes que forem reutilizáveis;
2. remover o vínculo das páginas com `src/data`;
3. concluir o modelo de domínio;
4. corrigir a fundação de segurança Supabase;
5. criar migrations no projeto `dev`;
6. gerar tipos TypeScript do banco;
7. criar camada de acesso a dados;
8. implementar autenticação, RBAC e RLS;
9. implementar CRUD real módulo por módulo;
10. substituir gradualmente os dados demonstrativos;
11. criar testes antes de implementar cálculos financeiros críticos;
12. promover migrations para produção somente após homologação.

## 16. Entregas desta fase

- auditoria do GitHub concluída;
- auditoria do Supabase concluída;
- riscos de segurança identificados;
- divergências de domínio identificadas;
- lacunas de CRUD identificadas;
- requisito obrigatório de modais e ações registrado em `docs/REQUISITOS-UI-CRUD.md`;
- este relatório registrado na branch `dev`.

## 17. Critérios de aceite da Fase 0

- Repositório examinado: aprovado.
- Branches identificadas: aprovado com ressalvas.
- Stack identificada: aprovado.
- Banco e migrations identificados: aprovado.
- Autenticação atual identificada: aprovado.
- Testes identificados: aprovado com ausência crítica registrada.
- Dívidas técnicas identificadas: aprovado.
- Riscos identificados: aprovado.
- Relatório consolidado produzido: aprovado.
- Nenhuma implementação funcional executada antes da auditoria: aprovado.

## 18. Status

**FASE 0: APROVADA COM RESSALVAS.**

**PRONTIDÃO PARA IMPLEMENTAÇÃO FINANCEIRA: BLOQUEADA** até a conclusão das Fases 1 e 2 de especificação e da correção da fundação de segurança no início da Fase 3.

A próxima etapa permitida pelo Prompt Mestre é a **Fase 1 — Especificação empresarial e financeira**. Nenhuma migration de domínio ou CRUD funcional deverá ser criada antes da conclusão dessa especificação.
