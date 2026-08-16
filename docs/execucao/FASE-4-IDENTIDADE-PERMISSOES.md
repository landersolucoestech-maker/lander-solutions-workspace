# Fase 4 — Identidade e permissões

Data: 30 de julho de 2026  
Branch GitHub: `dev`  
Supabase: `jodzhcktrlwinywqgbab`  
Pull request: `#1` em modo rascunho

## 1. Objetivo

Implementar autenticação, MFA, perfis, papéis, permissões, escopos por unidade, proteção de sessão, RLS, auditoria e o primeiro módulo CRUD real do sistema corporativo.

## 2. Banco de dados

Foram criadas as tabelas:

- `public.profiles`;
- `public.app_roles`;
- `public.permissions`;
- `public.role_permissions`;
- `public.user_role_assignments`;
- `public.audit_events`.

Todas as tabelas possuem RLS.

Foram cadastrados:

- 14 papéis iniciais;
- 33 permissões iniciais;
- matriz básica de permissões;
- papel `owner` com todas as permissões.

## 3. Autenticação

O frontend passou a utilizar Supabase Auth com:

- login por e-mail e senha;
- validação server-side da identidade por `getUser`;
- persistência de sessão no navegador;
- PKCE;
- encerramento de sessão;
- bloqueio de usuário pendente;
- bloqueio de usuário suspenso ou inativo;
- proteção da aplicação por `AuthGate`;
- cliente Supabase criado somente no navegador para evitar vazamento de estado durante SSR.

Não existe cadastro público no frontend.

## 4. MFA

Foi implementado:

- matrícula TOTP;
- apresentação do QR Code;
- chave manual;
- desafio MFA;
- verificação do código;
- exigência de sessão `aal2` para operações administrativas;
- bloqueio de desativação de MFA para proprietário ativo.

## 5. Sessões e autorização

A autorização utiliza:

- perfil ativo;
- sessão existente em `auth.sessions`;
- papel;
- permissão;
- escopo por unidade;
- validade da atribuição;
- MFA `aal2` para operações administrativas.

Dados de autorização não dependem de `user_metadata`.

## 6. Auditoria

Foi criada trilha de auditoria contendo:

- usuário;
- sessão;
- ação;
- schema;
- tabela;
- identificador;
- dados anteriores;
- dados posteriores;
- metadados;
- data e hora.

Usuários autenticados possuem somente leitura condicionada à permissão `audit.read`.

Os usuários autenticados não possuem `INSERT`, `UPDATE` ou `DELETE` direto em `audit_events`.

## 7. Edge Function administrativa

Foi implantada na branch Supabase `dev` a função:

`admin-users`

Configuração:

- versão 3;
- JWT obrigatório;
- status ativo;
- `service_role` restrito ao servidor.

Operações implementadas:

- convite de usuário;
- alteração auditada de status;
- exclusão física controlada;
- atribuição de papel;
- revogação de papel.

Cada operação verifica:

- JWT;
- usuário válido;
- permissão correspondente;
- MFA `aal2`;
- tipos e formatos de entrada;
- versão esperada quando aplicável;
- regras de preservação de histórico.

## 8. Proteções contra contorno

Foram revogadas do papel `authenticated` as permissões diretas para:

- inserir perfil;
- alterar status do perfil;
- inserir atribuição de papel;
- atualizar atribuição de papel;
- excluir atribuição de papel.

O cliente pode alterar diretamente apenas os campos permitidos do perfil:

- `display_name`;
- `mfa_required`;
- `last_seen_at`.

Status e papéis passam obrigatoriamente pela Edge Function administrativa.

Verificação aplicada:

| Privilégio                          | Resultado         |
| ----------------------------------- | ----------------- |
| Inserir perfil como `authenticated` | Bloqueado         |
| Alterar nome do perfil              | Permitido com RLS |
| Alterar status diretamente          | Bloqueado         |
| Inserir atribuição diretamente      | Bloqueado         |
| Atualizar atribuição diretamente    | Bloqueado         |
| Consultar atribuições autorizadas   | Permitido com RLS |

## 9. Proteção do proprietário

O banco impede:

- desativar MFA de proprietário ativo;
- suspender ou inativar o último proprietário ativo;
- remover a última atribuição ativa de proprietário;
- revogar a própria atribuição pela Edge Function;
- excluir a própria conta pela Edge Function.

## 10. CRUD de acessos

A rota `/acessos` deixou de usar dados hardcoded e passou a consultar o Supabase.

Foram implementados:

- botão **Criar usuário**;
- botão **Ver** por registro;
- botão **Editar** por registro;
- botão **Excluir** por registro;
- modal de criação e convite;
- modal de visualização somente leitura;
- modal de edição;
- modal de exclusão ou inativação;
- busca;
- loading;
- estado vazio;
- estado de erro;
- feedback global por toast;
- atualização da listagem após mutações;
- controle de concorrência por coluna `version`;
- atribuição de papel;
- escopo global ou por unidade;
- revogação auditada;
- exclusão física apenas quando permitida;
- inativação quando o histórico precisa ser preservado.

## 11. Exclusão segura

A ação **Excluir** não significa exclusão física incondicional.

- usuário pendente ou inativo, sem atribuições: exclusão física permitida;
- usuário com histórico ou vínculos: inativação;
- usuário já inativo com histórico: exclusão física bloqueada;
- próprio usuário: ação destrutiva bloqueada;
- último proprietário: protegido pelo banco.

## 12. Bootstrap do primeiro proprietário

Foi criado o runbook:

`docs/runbooks/BOOTSTRAP-PRIMEIRO-PROPRIETARIO.md`

O ambiente de desenvolvimento ainda não possui usuários reais.

Não foram inventados e-mail, senha ou credenciais.

O bootstrap deverá ser executado quando o e-mail real do proprietário estiver confirmado.

## 13. Migrations

Migrations relacionadas à fase:

- `20260731012217_identity_rbac_audit_foundation`;
- `20260731012413_optimize_identity_rbac_policies`;
- `20260731012533_harden_private_and_audit_privileges`;
- `20260731013519_expose_safe_authorization_checks`;
- `20260731014815_harden_identity_mutation_boundaries`.

Todas foram aplicadas somente ao Supabase `dev` e registradas no repositório.

Produção não foi alterada.

## 14. Testes e validações

Execução CI validada:

- instalação de dependências: aprovada;
- formatação no workspace de validação: aprovada;
- lint: aprovado;
- typecheck: aprovado;
- testes unitários: aprovados;
- build: aprovado.

Execução utilizada para validação final da implementação funcional:

`30597468081`

Advisor de segurança do Supabase:

- nenhum alerta.

## 15. Ressalvas

- ainda não existe proprietário real no ambiente `dev`;
- a aplicação não pode ser homologada funcionalmente com login real até o bootstrap;
- CORS da Edge Function está temporariamente aberto para origens e protegido por JWT, permissão e MFA; deverá ser limitado aos domínios aprovados antes da produção;
- a dívida de formatação histórica do protótipo permanece registrada;
- o lockfile ainda deverá ser consolidado antes da homologação.

## 16. Critérios de aceite

| Critério                                     | Resultado            |
| -------------------------------------------- | -------------------- |
| Supabase Auth conectado                      | Aprovado             |
| Perfis persistidos                           | Aprovado             |
| Papéis e permissões                          | Aprovado             |
| Escopo por unidade                           | Aprovado             |
| RLS                                          | Aprovado             |
| MFA                                          | Aprovado             |
| Validação de sessão                          | Aprovado             |
| Auditoria imutável para usuários             | Aprovado             |
| CRUD com Criar, Ver, Editar e Excluir seguro | Aprovado             |
| Concorrência otimista                        | Aprovado             |
| Edge Function administrativa                 | Aprovado             |
| Advisor de segurança                         | Aprovado             |
| Bootstrap de proprietário real               | Pendente operacional |

## 17. Status

**Aprovado com ressalvas.**

A Fase 5 pode começar no ambiente de desenvolvimento. Nenhuma promoção para produção está autorizada.
