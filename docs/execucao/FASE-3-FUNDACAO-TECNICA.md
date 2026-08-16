# Fase 3 — Fundação técnica

Data: 30 de julho de 2026  
Branch: `dev`  
Pull request de validação: `#1`

## 1. Objetivo

Estabelecer a base técnica mínima para continuar a construção do Sistema Corporativo da LANDER SOLUTIONS com ambientes isolados, validação automatizada e conexão segura ao Supabase.

## 2. Alterações realizadas

### Dependências e scripts

O `package.json` passou a incluir:

- `@supabase/supabase-js` com versão fixada;
- Supabase CLI como dependência de desenvolvimento;
- Vitest;
- script de typecheck;
- scripts de teste;
- script de verificação de formatação;
- comando consolidado de validação;
- comandos de inspeção de migrations.

### Ambiente

Foi criado `.env.example` contendo somente o contrato das variáveis públicas:

- ambiente da aplicação;
- URL do projeto Supabase;
- referência esperada do projeto;
- chave publicável.

Nenhuma chave secreta, `service_role` ou credencial de banco foi adicionada ao repositório.

### Proteção contra ambiente incorreto

Foi implementado um guard que:

- valida a URL Supabase;
- compara a referência extraída com a referência esperada;
- impede desenvolvimento de utilizar produção;
- obriga desenvolvimento a utilizar `jodzhcktrlwinywqgbab`;
- obriga produção a utilizar `giiwiwjerzavtwocxltz`;
- falha imediatamente quando a configuração é inconsistente.

### Cliente Supabase

Foi criado um cliente Supabase utilizando somente chave publicável e configuração de sessão suportada pelo cliente oficial.

### Segurança de banco

Na branch Supabase `dev`, foi aplicada a migration:

`20260731010612_restrict_rls_auto_enable_execution`

Ela removeu de `public`, `anon` e `authenticated` a permissão de executar `public.rls_auto_enable()` e restringiu privilégios padrão de novas funções.

A verificação retornou:

- `anon_can_execute = false`;
- `authenticated_can_execute = false`;
- `service_role_can_execute = true`.

A produção não foi modificada.

### CI

Foi criada pipeline com:

- instalação de dependências;
- normalização de formatação no workspace de validação;
- lint;
- typecheck;
- testes unitários;
- build;
- aviso explícito de dívida de formatação não commitada.

## 3. Testes executados

A execução CI `30595906905` concluiu com sucesso:

- instalação: aprovada;
- formatação do workspace de validação: aprovada;
- lint: aprovado;
- typecheck: aprovado;
- testes unitários: aprovados;
- build: aprovado.

Os testes de ambiente confirmaram:

- aceitação da branch Supabase de desenvolvimento;
- bloqueio do projeto de produção em ambiente de desenvolvimento;
- bloqueio de divergência entre URL e referência esperada;
- extração correta da referência do projeto.

## 4. Riscos e ressalvas

### Formatação preexistente

O protótipo possuía 297 erros mecânicos de Prettier distribuídos em arquivos anteriores à fundação.

A pipeline formata o workspace antes das verificações para separar dívida mecânica de erros funcionais. As alterações de formatação ainda deverão ser consolidadas em commit próprio antes da homologação.

### Lockfile

A instalação no CI atualiza o lockfile no workspace do runner. O lockfile definitivo deverá ser atualizado e validado em commit próprio antes da homologação.

### Dados hardcoded

Os arquivos `src/data` permanecem temporariamente no frontend e ainda contêm unidades superadas. Eles não serão migrados automaticamente para o Supabase e deverão ser removidos conforme os módulos reais forem implantados.

## 5. Segurança

- produção não alterada;
- chave secreta não versionada;
- projeto dev protegido contra execução pública da função de event trigger;
- guard de ambiente testado;
- CI configurado;
- PR mantido como rascunho.

## 6. Critérios de aceite

| Critério                           | Resultado |
| ---------------------------------- | --------- |
| Projeto e scripts de validação     | Aprovado  |
| Cliente Supabase                   | Aprovado  |
| Isolamento dev/prod                | Aprovado  |
| Testes de ambiente                 | Aprovado  |
| CI                                 | Aprovado  |
| Segurança inicial do Supabase dev  | Aprovado  |
| Formatação commitada               | Ressalva  |
| Lockfile atualizado no repositório | Ressalva  |

## 7. Status

**Aprovado com ressalvas.**

As ressalvas são mecânicas e não bloqueiam a Fase 4. Nenhuma promoção para produção está autorizada.
