# Runbook — Bootstrap do primeiro proprietário

## Objetivo

Criar e ativar o primeiro usuário proprietário do Sistema Corporativo da LANDER SOLUTIONS sem cadastro público, sem credenciais hardcoded e sem expor `service_role` no frontend.

Este procedimento deverá ser executado separadamente em cada ambiente.

## Pré-condições

- migrations da Fase 4 aplicadas;
- tabela `public.profiles` criada;
- papel `owner` criado;
- função `private.bootstrap_first_owner(uuid)` existente;
- nenhum proprietário ativo no ambiente;
- acesso administrativo ao projeto Supabase correspondente;
- e-mail real do proprietário confirmado.

## Restrições

- nunca cadastrar usuário fictício;
- nunca inserir senha em migration;
- nunca colocar `service_role` em variável `VITE_*`;
- nunca executar o bootstrap de desenvolvimento no projeto de produção;
- nunca criar um segundo proprietário por alteração manual das tabelas;
- nunca remover auditoria para repetir o procedimento.

## Ambiente de desenvolvimento

Projeto Supabase obrigatório:

`jodzhcktrlwinywqgbab`

## Ambiente de produção

Projeto Supabase obrigatório:

`giiwiwjerzavtwocxltz`

A produção somente poderá receber o bootstrap depois da homologação e da promoção formal das migrations.

## Procedimento

### 1. Confirmar ausência de proprietário

Executar no SQL Editor do ambiente correto:

```sql
select
  u.email,
  p.status,
  r.code as role_code,
  ura.status as assignment_status
from public.user_role_assignments ura
join public.profiles p on p.id = ura.user_id
join auth.users u on u.id = p.id
join public.app_roles r on r.id = ura.role_id
where r.code = 'owner'
  and ura.status = 'active';
```

O resultado deverá ser vazio antes do primeiro bootstrap.

### 2. Criar o usuário no Supabase Auth

Criar o usuário pelo painel administrativo do Supabase Auth ou por ferramenta administrativa aprovada.

Requisitos:

- utilizar e-mail real;
- marcar o e-mail como confirmado somente quando a propriedade estiver validada;
- não utilizar senha temporária compartilhada em texto simples;
- preferir convite ou fluxo seguro de definição de senha;
- não cadastrar papel em `user_metadata`.

A criação do usuário acionará o trigger `on_auth_user_created`, que criará um perfil com status `pending`.

### 3. Obter o UUID

```sql
select id, email, created_at
from auth.users
where lower(email) = lower('EMAIL_REAL_DO_PROPRIETARIO');
```

Confirmar que existe exatamente um registro.

### 4. Executar o bootstrap

Substituir o UUID pelo identificador confirmado:

```sql
select private.bootstrap_first_owner('UUID_DO_USUARIO'::uuid);
```

A função deverá:

- verificar que não existe proprietário ativo;
- ativar o perfil;
- manter MFA obrigatório;
- criar uma atribuição global do papel `owner`;
- impedir uma segunda execução quando já existir proprietário.

### 5. Validar o resultado

```sql
select
  u.id,
  u.email,
  p.display_name,
  p.status,
  p.mfa_required,
  r.code as role_code,
  ura.unit_code,
  ura.status as assignment_status
from auth.users u
join public.profiles p on p.id = u.id
join public.user_role_assignments ura on ura.user_id = u.id
join public.app_roles r on r.id = ura.role_id
where u.id = 'UUID_DO_USUARIO'::uuid;
```

Resultado esperado:

- `profiles.status = active`;
- `profiles.mfa_required = true`;
- `app_roles.code = owner`;
- `user_role_assignments.unit_code is null`;
- `user_role_assignments.status = active`.

### 6. Primeiro acesso

No primeiro acesso:

1. autenticar com o método configurado;
2. o sistema deverá exigir matrícula TOTP;
3. ler o QR Code em aplicativo autenticador;
4. confirmar o código;
5. receber sessão `aal2`;
6. acessar o sistema corporativo.

## Verificações de segurança

Depois do bootstrap, confirmar:

```sql
select
  has_function_privilege('anon', 'private.bootstrap_first_owner(uuid)', 'execute') as anon_execute,
  has_function_privilege('authenticated', 'private.bootstrap_first_owner(uuid)', 'execute') as authenticated_execute,
  has_function_privilege('service_role', 'private.bootstrap_first_owner(uuid)', 'execute') as service_role_execute;
```

Resultado esperado:

- `anon_execute = false`;
- `authenticated_execute = false`;
- `service_role_execute = true`.

## Recuperação

Se o e-mail estiver incorreto e o bootstrap ainda não tiver sido executado, excluir o usuário incorreto pelo painel administrativo e reiniciar o procedimento.

Se o bootstrap já tiver sido executado, não apagar diretamente o perfil, a atribuição ou a auditoria. Registrar incidente e executar procedimento formal de transferência de controle, com revisão técnica e documental.
