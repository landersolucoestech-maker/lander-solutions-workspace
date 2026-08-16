# Fase 6 — Cadastros corporativos

## Situação

**Concluída e validada no ambiente de desenvolvimento.**

Esta fase criou o cadastro corporativo unificado de organizações e pessoas da LANDER SOLUTIONS. Nenhuma alteração foi executada no projeto Supabase de produção.

## Ambiente utilizado

- Repositório: `landersolucoestech-maker/lander-solutions`
- Branch GitHub: `dev`
- Supabase de desenvolvimento: `jodzhcktrlwinywqgbab`
- Edge Function: `admin-parties`
- Verificação JWT da função: habilitada
- PR: rascunho nº 1, sem promoção para `main`

## Escopo entregue

### Cadastro principal

A tabela `public.parties` representa organizações e pessoas sem duplicar entidades por papel comercial.

Cada cadastro pode registrar:

- tipo: organização ou pessoa;
- nome legal;
- nome alternativo ou nome comercial;
- documento fiscal;
- país;
- moeda preferencial;
- idioma;
- unidade gerencial principal;
- situação;
- observações;
- versão para controle de concorrência.

### Papéis comerciais e econômicos

A tabela `public.party_roles` permite que um mesmo cadastro possua múltiplos papéis simultâneos:

- cliente;
- fornecedor;
- parceiro;
- prestador de serviço;
- participante econômico;
- investidor;
- carrier;
- cliente internacional;
- cliente de tecnologia;
- cliente educacional;
- cliente de serviços.

O papel pode ser global ou vinculado a uma unidade gerencial específica.

### Contatos

A tabela `public.party_contacts` armazena:

- e-mail;
- telefone;
- celular;
- website;
- outros canais.

A normalização é executada no banco. E-mails são convertidos para minúsculas, telefones são reduzidos ao formato numérico aplicável e websites são normalizados. Contatos principais ativos possuem unicidade por cadastro e tipo.

### Endereços

A tabela `public.party_addresses` suporta endereços:

- jurídicos;
- de cobrança;
- de atendimento;
- residenciais;
- outros.

Endereços principais ativos possuem unicidade por cadastro e tipo.

### Relacionamentos

A tabela `public.party_relationships` vincula pessoas a organizações como:

- contato;
- representante;
- funcionário;
- proprietário;
- parceiro;
- outro vínculo.

O banco valida que o lado organizacional seja uma organização e que o lado pessoal seja uma pessoa.

### Documentos

A tabela `public.party_documents` armazena somente metadados e referências de armazenamento:

- tipo e rótulo;
- número mascarado;
- datas de emissão e validade;
- provedor de armazenamento;
- bucket e chave do objeto;
- referência externa;
- situação e verificação.

A leitura e a mutação exigem permissões sensíveis próprias.

### Referências restritas

A tabela `private.party_restricted_references` não é exposta diretamente ao frontend nem ao papel `authenticated`.

Ela armazena somente:

- tipo da referência;
- rótulo;
- valor mascarado;
- identificador de cofre;
- situação;
- responsáveis e timestamps.

Não são armazenados senha, token, PIN, chave privada, credencial de internet banking ou segredo operacional.

O campo `vault_reference` é removido do conteúdo enviado para a trilha de auditoria.

## Autorização

Foram criadas as permissões:

- `parties.read`;
- `parties.manage`;
- `parties.sensitive.read`;
- `parties.sensitive.manage`.

As políticas RLS consideram:

- usuário ativo;
- sessão válida;
- permissão aplicável;
- escopo de unidade;
- MFA no nível `aal2` para mutações;
- permissão sensível para documentos e referências restritas.

Todas as seis tabelas públicas da fase possuem quatro políticas: seleção, inclusão, alteração e exclusão. A tabela privada possui política explícita de negação de acesso direto.

O papel `anon` não possui privilégios nas tabelas da fase.

## Edge Function

A função `admin-parties` foi publicada na versão 2 e exige JWT válido.

Ela é responsável pelas operações com referências restritas e executa:

1. validação da sessão;
2. identificação do cadastro e da unidade;
3. verificação de permissão sensível;
4. verificação de MFA `aal2`;
5. chamada de RPC disponível exclusivamente ao `service_role`;
6. resposta sem cache.

O `service_role` não é enviado ao navegador.

## Interface entregue

A rota `/clientes` foi substituída pelo diretório corporativo persistido.

A interface possui:

- busca e filtros;
- indicadores de organizações, pessoas, clientes e fornecedores;
- criação de organização ou pessoa;
- visualização detalhada;
- edição;
- inativação e exclusão física segura;
- abas para papéis, contatos, endereços, relacionamentos, documentos e referências restritas;
- modais explícitos para Criar, Ver, Editar e Excluir ou equivalente seguro;
- mensagens de erro e estados de carregamento;
- controle de concorrência por versão.

Também foi corrigida a implementação de unidades, produtos e serviços para remover hooks condicionais e preservar os mesmos fluxos CRUD.

## Migrations

Foram aplicadas no Supabase `dev` e versionadas no repositório:

- `20260731025828_party_directory_foundation.sql`;
- `20260731025918_party_restricted_reference_lookup.sql`;
- `20260731030751_explicit_deny_private_party_references.sql`;
- `20260731030818_index_party_preferred_currency.sql`.

## Validações executadas

### Pipeline GitHub

A execução nº 97 concluiu com sucesso:

- formatação no runner;
- lint;
- typecheck;
- testes unitários;
- build.

### Banco de dados

Foi executada uma transação de teste integralmente revertida. Ela confirmou:

- normalização de `TEST.USER@EXAMPLE.COM` para `test.user@example.com`;
- criação de vínculo válido entre organização e pessoa;
- bloqueio de vínculo com os tipos invertidos;
- bloqueio de exclusão física de cadastro ativo;
- criação de auditoria de referência restrita;
- ausência de `vault_reference` no evento de auditoria.

Nenhum dado de teste permaneceu no banco.

### Segurança

O advisor de segurança ficou sem alertas após a política explícita de negação da tabela privada.

Foi confirmado que:

- todas as tabelas da fase possuem RLS habilitada;
- `anon` possui zero privilégios;
- referências restritas não são acessíveis diretamente por `authenticated`;
- RPCs administrativas de referências restritas são executáveis apenas por `postgres` e `service_role`;
- a Edge Function exige JWT;
- produção não foi alterada.

### Performance

A FK de moeda preferencial recebeu índice dedicado. Os avisos restantes são informativos sobre índices ainda não utilizados porque o banco de desenvolvimento não possui carga operacional suficiente, além da configuração global de conexões do Auth a revisar antes da produção.

## Ressalvas operacionais

A homologação autenticada completa depende do bootstrap de um proprietário real, com sessão ativa e MFA `aal2`. Não foram criados e-mails, senhas ou usuários fictícios.

A fase está tecnicamente concluída, mas permanece no PR em rascunho e não deve ser promovida para `main` ou produção antes da homologação funcional com o proprietário real.
