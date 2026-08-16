# Sistema Central — LANDER SOLUTIONS

Sistema corporativo para controle operacional, financeiro, gerencial, contratual e de governança da LANDER SOLUTIONS em um único ambiente.

## Estrutura empresarial vigente

A LANDER SOLUTIONS é a única pessoa jurídica responsável por receber receitas, pagar despesas, recolher tributos, contratar pessoas e fornecedores e manter a titularidade dos ativos.

As operações são separadas gerencialmente pelas seguintes unidades oficiais:

| Código           | Unidade           | Natureza                                              |
| ---------------- | ----------------- | ----------------------------------------------------- |
| `CORPORATIVO`    | LANDER SOLUTIONS  | Administração e consolidação corporativa              |
| `MUSICOS360`     | Music OS 360      | Produto SaaS, implantação e serviços relacionados     |
| `VIVENDOMUSICA`  | Vivendo da Música | Cursos, conteúdos e produtos digitais                 |
| `DICADECRIA`     | Dica de Cria      | Cursos, conteúdos e produtos digitais                 |
| `LANDERSERVICES` | Lander Services   | Serviços tecnológicos, administrativos e operacionais |

Os serviços de dispatch são somente uma linha de serviço operacional dentro de `LANDERSERVICES`. Não existe sistema Lander Dispatch nem integração com uma aplicação de dispatch nesta etapa.

## Princípios financeiros

- uma única empresa e uma única responsabilidade jurídica, contábil e tributária;
- identificação obrigatória da unidade, produto, serviço, projeto, contrato e centros aplicáveis em cada lançamento;
- partidas dobradas no ledger gerencial;
- valores originais e moeda funcional BRL preservados;
- rateios versionados e auditáveis;
- despesas exclusivas e compartilhadas separadas;
- apuração específica de participações e repasses por produto ou contrato;
- documentos postados e eventos sensíveis imutáveis;
- estornos formais em vez de edição retroativa;
- períodos financeiros com fechamento e reabertura controlados.

## Módulos

### Fundação corporativa

- autenticação, sessões e MFA;
- usuários, papéis e permissões por unidade;
- unidades, produtos e linhas de serviço;
- departamentos, projetos e centros de custo e receita;
- clientes, fornecedores e demais contrapartes;
- contratos, versões, participantes, obrigações e aprovações.

### Financeiro

- contas a pagar e receber;
- documentos, linhas, aprovações e liquidações;
- ledger de partidas dobradas;
- rateios e alocações;
- participações, apurações e repasses;
- documentos fiscais;
- reembolsos, chargebacks e ajustes;
- conciliação bancária por OFX;
- fechamento e reabertura de períodos.

### Comercial e projetos

- leads e oportunidades;
- pipeline;
- propostas versionadas;
- custos, receita, lucro e margem previstos;
- aprovação, aceite e conversão em projeto;
- rentabilidade prevista e realizada.

### Governança

- ativos corporativos;
- processos jurídicos;
- propriedade intelectual;
- obrigações de compliance;
- políticas corporativas versionadas;
- trilha de auditoria imutável.

### Gestão e BI

- dashboard financeiro por unidade e competência;
- DRE gerencial;
- resultado por unidade;
- aging de contas a pagar e receber;
- fluxo de caixa realizado;
- exportação XLSX real em múltiplas planilhas.

### SaaS e assinaturas

- planos comerciais para produtos `product_type = 'saas'`;
- entitlements;
- assinaturas e assentos;
- testes, ativação, suspensão, inadimplência, retomada, cancelamento e expiração;
- uso medido;
- ciclos de cobrança vinculados aos documentos financeiros corporativos;
- MRR e ARR em BRL;
- eventos imutáveis de ciclo de vida.

## Stack

- React 19;
- TypeScript;
- Vite;
- TanStack Router;
- TanStack Query;
- Tailwind CSS;
- Supabase Auth e PostgreSQL;
- Supabase Edge Functions;
- Vitest;
- pgTAP;
- GitHub Actions;
- Bun.

## Ambientes

| Ambiente        | Branch Git | Supabase                           |
| --------------- | ---------- | ---------------------------------- |
| Desenvolvimento | `dev`      | projeto de desenvolvimento isolado |
| Produção        | `main`     | projeto de produção separado       |

Regras obrigatórias:

- todo desenvolvimento ocorre em `dev`;
- `main` e o Supabase de produção não recebem alterações durante desenvolvimento;
- nenhuma promoção ocorre antes da homologação;
- o PR de `dev` para `main` permanece em rascunho até a conclusão dos gates humanos e técnicos;
- nunca reutilizar credenciais, referências ou secrets de produção em desenvolvimento.

## Integrações desta etapa

As únicas integrações estruturais previstas inicialmente são:

- GitHub, para versionamento, revisão e CI;
- Supabase, para banco, autenticação e Edge Functions.

Não existem integrações automáticas entre as unidades de negócio nesta etapa.

## Execução local da aplicação

```bash
bun install --frozen-lockfile
bun run dev
```

Variáveis necessárias:

```bash
cp .env.example .env.local
```

Preencha somente as credenciais do Supabase de desenvolvimento.

## Validação da aplicação

```bash
bun run check
```

O comando executa:

- verificação de formatação;
- lint;
- typecheck;
- testes unitários;
- auditoria estrutural do repositório;
- build.

## Validação local do banco

Requisitos:

- Docker disponível;
- Supabase CLI na versão fixada pelo projeto.

```bash
bun run supabase:local:start
bun run test:database
bun run supabase:local:stop
```

A validação do banco executa sequencialmente:

- reconstrução pelas migrations;
- lint das funções PostgreSQL;
- testes pgTAP;
- backup lógico;
- restauração em banco separado;
- verificação de tabelas, histórico de migrations, RLS, privilégios anônimos e exposição de RPCs administrativas.

## Segurança

- RLS em todas as tabelas públicas;
- ausência de privilégios para `anon` nas tabelas corporativas;
- permissões por unidade;
- MFA `aal2` nas ações administrativas;
- RPCs sensíveis restritas ao `service_role`;
- Edge Functions administrativas com JWT obrigatório;
- concorrência otimista por versão;
- trilha de auditoria imutável;
- nenhuma credencial real versionada.

## Estrutura principal

```text
src/
  components/
  features/
  lib/
  routes/
supabase/
  functions/
  migrations/
  tests/database/
scripts/
docs/
  auditoria/
  especificacoes/
  execucao/
  runbooks/
```

## Gates antes da produção

A promoção para produção exige, no mínimo:

- proprietário real cadastrado;
- MFA `aal2` configurado;
- testes com usuários de papéis distintos;
- CI integralmente verde;
- backup e restauração aprovados;
- advisor de segurança sem alertas;
- homologação financeira e contábil;
- homologação jurídica e de privacidade;
- plano de rollback aprovado;
- aprovação explícita para promover `dev` para `main`.

## Documentação

As decisões normativas, implementações por fase e procedimentos operacionais estão em `docs/`.
