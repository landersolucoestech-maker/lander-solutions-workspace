# Requisitos obrigatórios de interface e CRUD

Este documento complementa o Prompt Mestre do Sistema Corporativo da LANDER SOLUTIONS e deverá ser tratado como requisito funcional obrigatório em todas as fases de implementação.

## 1. Ações obrigatórias

Todo módulo que gerencie entidades deverá disponibilizar, conforme a permissão do usuário e o estado do registro:

- botão **Criar** no cabeçalho da página ou do painel principal;
- botão ou ação **Ver** em cada registro;
- botão ou ação **Editar** em cada registro;
- botão ou ação **Excluir** em cada registro quando a exclusão for juridicamente, financeiramente e tecnicamente permitida.

As ações não poderão ser apenas visuais. Deverão executar operações reais no Supabase, possuir validação server-side, atualizar a listagem, exibir feedback de sucesso ou erro e registrar auditoria quando aplicável.

## 2. Modais obrigatórios

As operações deverão utilizar modais consistentes:

- **Modal Criar**: formulário completo para cadastro;
- **Modal Ver**: visualização detalhada em modo somente leitura;
- **Modal Editar**: formulário preenchido com os dados atuais e controle de concorrência;
- **Modal Excluir**: confirmação explícita antes da operação.

O modal de exclusão deverá informar o nome do registro, o impacto da ação e se a operação será exclusão física, inativação, cancelamento, estorno ou reversão.

## 3. Regras para exclusão

A presença do botão **Excluir** não autoriza apagar registros que precisam manter histórico.

- Cadastros sem dependências poderão permitir exclusão física, conforme regra do domínio.
- Unidades, produtos, serviços, clientes, fornecedores, participantes, contratos e ativos que possuam vínculos deverão utilizar inativação ou encerramento controlado.
- Lançamentos financeiros consolidados, rateios definitivos, apurações aprovadas, repasses realizados, períodos encerrados e registros de auditoria não poderão ser apagados.
- Para registros imutáveis, o botão **Excluir** deverá ser substituído funcionalmente por **Cancelar**, **Estornar**, **Reverter** ou **Inativar**, mantendo a ação no menu do registro e explicando por que a exclusão física não é permitida.
- Toda operação destrutiva deverá exigir permissão específica e confirmação.

## 4. Padrão das listagens

Cada listagem deverá possuir:

- título e descrição;
- botão **Criar**;
- busca;
- filtros;
- ordenação;
- paginação;
- estado de carregamento;
- estado vazio;
- estado de erro;
- coluna ou menu de **Ações**;
- ações **Ver**, **Editar** e **Excluir/Inativar/Cancelar/Estornar**, conforme o domínio;
- atualização imediata após a operação;
- tratamento de concorrência e registros alterados por outro usuário.

## 5. Formulários

Todos os formulários deverão possuir:

- labels explícitas;
- campos obrigatórios identificados;
- validação client-side e server-side;
- mensagens de erro por campo;
- bloqueio contra envio duplicado;
- botão **Cancelar**;
- botão **Salvar** ou **Criar**;
- estado de processamento;
- preservação dos dados quando ocorrer erro recuperável;
- máscara e validação adequadas para valores, moedas, datas, documentos e percentuais.

## 6. Permissões

A visibilidade e a execução das ações deverão respeitar RBAC, RLS, escopo por unidade e segregação de funções.

Ocultar um botão no frontend não substitui autorização no banco ou no backend.

## 7. Auditoria

Criar, editar, excluir, inativar, cancelar, estornar e reverter deverão registrar, quando aplicável:

- usuário;
- data e hora;
- entidade;
- identificador;
- valores anteriores;
- valores posteriores;
- justificativa;
- origem da ação.

## 8. Critério de aceite

Nenhum módulo CRUD poderá ser considerado concluído enquanto não possuir operações reais de **Criar**, **Ver**, **Editar** e **Excluir ou ação equivalente segura**, com modais, permissões, validações, persistência, feedback e testes.
