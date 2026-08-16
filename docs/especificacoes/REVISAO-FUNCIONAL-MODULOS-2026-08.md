# Revisão funcional dos módulos — agosto de 2026

## Objetivo

Esta revisão define as responsabilidades operacionais de Rateio, Participações e Repasses, Jurídico e Propriedade Intelectual, Contabilidade e SaaS e Assinaturas. Nenhum desses módulos deve existir apenas por convenção visual ou pela existência prévia de telas.

## Princípios obrigatórios

1. Cada dado possui um único módulo proprietário.
2. Módulos relacionados podem consumir referências, mas não duplicar cadastros mestres.
3. Transações concentra movimentações financeiras operacionais; Contabilidade apresenta exclusivamente o Profit & Loss/DRE gerencial calculado a partir dos dados postados.
4. Contratos concentra os instrumentos e suas versões; módulos especializados consomem os termos aprovados.
5. Toda receita, despesa, rateio, participação, repasse, conta financeira e movimentação bancária deve manter unidade de negócio válida.
6. Processos com beneficiários, aprovação, memória de cálculo ou trilha de auditoria não podem ser reduzidos a categorias financeiras.

---

# 1. Rateio

## Decisão

**Manter como módulo independente.**

## Problema resolvido

Distribuir internamente receitas, despesas ou custos compartilhados entre dimensões gerenciais, sem criar uma obrigação financeira direta com um terceiro.

## Entidades proprietárias

- Regras de rateio;
- Versões das regras;
- Critérios e direcionadores;
- Alvos de distribuição;
- Valores dos direcionadores;
- Execuções e simulações;
- Fontes da execução;
- Distribuições calculadas;
- Aprovações e estornos do rateio.

## Processos

1. Definir origem do valor;
2. Definir critério de distribuição;
3. Definir unidades, projetos, produtos, serviços ou centros destinatários;
4. Simular o cálculo;
5. Submeter para aprovação;
6. Postar as alocações;
7. Estornar preservando o histórico, quando necessário.

## Cálculos

- Percentual fixo;
- Valor fixo;
- Proporção por direcionador;
- Distribuição do saldo residual;
- Validação de total distribuído igual ao valor de origem.

## Permissões

- Consultar regras;
- Criar e editar rascunhos;
- Simular;
- Submeter;
- Aprovar;
- Postar;
- Estornar.

## Integrações

- Recebe valores de Transações e do Ledger já classificados;
- Utiliza unidades, projetos, produtos, serviços e centros como dimensões;
- Entrega lançamentos gerenciais ao Ledger;
- Pode alterar a base gerencial usada posteriormente em Participações e Repasses.

## Limite do módulo

Rateio **não cria beneficiário, obrigação de pagamento ou repasse a terceiro**. Seu resultado é uma redistribuição interna.

---

# 2. Participações e Repasses

## Decisão

**Manter como módulo independente de Rateio.**

## Problema resolvido

Calcular e controlar obrigações financeiras destinadas a terceiros com base em contratos, percentuais, bases econômicas, períodos e regras aprovadas.

## Beneficiários possíveis

- Sócios;
- Artistas;
- Produtores;
- Compositores;
- Parceiros;
- Afiliados;
- Prestadores;
- Titulares de direitos;
- Outros participantes contratuais.

## Entidades proprietárias

- Cálculos de participação;
- Linhas da memória de cálculo;
- Participantes contratuais;
- Bases e deduções aplicadas;
- Obrigações de repasse;
- Pagamentos de repasse;
- Aprovações;
- Postagens e estornos.

## Processos

1. Selecionar contrato e versão econômica vigente;
2. Determinar período e base de cálculo;
3. Aplicar deduções e regras de elegibilidade;
4. Calcular valor de cada beneficiário;
5. Submeter memória para aprovação;
6. Gerar obrigação financeira;
7. Liquidar o repasse em Transações;
8. Conciliar e preservar o histórico.

## Cálculos

- Percentual sobre receita bruta ou líquida;
- Valor mínimo, teto ou faixa;
- Deduções contratuais;
- Recuperação de adiantamentos, quando prevista;
- Participação por item, obra, produto, projeto ou unidade;
- Arredondamento e saldo residual auditáveis.

## Permissões

- Consultar cálculos;
- Preparar memória;
- Submeter;
- Aprovar;
- Postar obrigação;
- Registrar pagamento;
- Estornar.

## Integrações

- Consome Contratos e suas versões aprovadas;
- Consome receita, despesa e rateios postados;
- Gera documento financeiro em Transações;
- Gera lançamento no Ledger;
- Pode ser associado a obras, fonogramas, projetos, produtos e unidades.

## Limite do módulo

Participações e Repasses **não executa distribuição gerencial interna**. Quando um valor precisa apenas mudar de dimensão, pertence ao Rateio.

## Ausência de duplicidade

- Regra interna de distribuição: Rateio;
- Regra econômica de beneficiário: Participações e Repasses;
- Instrumento jurídico e percentuais aprovados: Contratos;
- Pagamento e conciliação: Transações;
- Escrituração técnica: Ledger interno.

---

# 3. Jurídico e Propriedade Intelectual

## Decisão

Manter provisoriamente um único item no menu principal, com **submódulos operacionais separados**:

1. Jurídico;
2. Propriedade Intelectual;
3. Compliance e Políticas.

A separação é obrigatória dentro da página porque as entidades, fluxos, prazos e responsáveis são diferentes.

## 3.1. Jurídico

### Responsabilidades

- Processos judiciais e administrativos;
- Notificações;
- Procurações;
- Contencioso;
- Demandas administrativas;
- Prazos e audiências;
- Partes e escritórios externos;
- Risco, probabilidade e exposição;
- Documentos comprobatórios;
- Histórico de eventos e decisões.

### Entidades

- Assuntos jurídicos;
- Eventos jurídicos;
- Contrapartes;
- Responsáveis;
- Prazos;
- Evidências e documentos.

### Permissões

Leitura jurídica, gestão de assuntos, gestão de prazos, encerramento, gestão documental e acesso a conteúdo restrito.

## 3.2. Propriedade Intelectual

### Responsabilidades

- Marcas e classes;
- Pedidos e registros;
- Titularidade;
- Direitos autorais;
- Obras e fonogramas;
- Licenças, cessões e autorizações;
- Protocolos, oposições e exigências;
- Renovações e vencimentos;
- Histórico de titularidade e eventos;
- Documentos comprobatórios.

### Entidades

- Ativos de propriedade intelectual;
- Eventos de PI;
- Titulares e criadores;
- Classificações;
- Números de pedido e registro;
- Autoridades e jurisdições;
- Prazos e evidências.

### Permissões

Leitura de PI, criação e edição, submissão de eventos, aprovação, gestão documental e alteração de titularidade.

## 3.3. Compliance e Políticas

### Responsabilidades

- Obrigações regulatórias e corporativas;
- Ocorrências periódicas;
- Evidências;
- Dispensas justificadas;
- Políticas internas;
- Versionamento, aprovação e publicação.

## Limites e integrações

- Contratos continua proprietário dos instrumentos contratuais;
- Jurídico pode referenciar um contrato, mas não duplicá-lo;
- PI pode referenciar contratos de licença, cessão ou edição;
- Financeiro recebe apenas obrigações e pagamentos aprovados;
- Ativos patrimoniais não substituem o cadastro especializado de PI.

Não devem existir telas genéricas denominadas apenas “processo”, “documento” ou “registro” sem fluxo e entidade definidos.

---

# 4. Contabilidade

## Decisão

**Manter como submódulo de Financeiro destinado exclusivamente ao Profit & Loss/DRE gerencial.**

## Responsabilidade

Calcular e apresentar o desempenho econômico da organização por competência e por unidade de negócio, utilizando exclusivamente lançamentos reais e postados no sistema.

## Conteúdo obrigatório

- Receita bruta;
- Deduções da receita;
- Receita líquida;
- Despesas;
- Lucro ou prejuízo operacional;
- Margem operacional;
- Detalhamento por conta;
- Resultado consolidado;
- Resultado por unidade de negócio;
- Filtro por competência;
- Filtro por unidade;
- Exportação em CSV e XLSX;
- Impressão ou geração de PDF;
- Importação CSV somente como pré-visualização e conferência, sem substituir silenciosamente os dados persistidos.

## Funcionamento

- O cálculo deve utilizar lançamentos contábeis postados;
- O escopo deve respeitar a competência e a unidade selecionadas;
- A visualização consolidada deve manter a identificação das unidades;
- Valores positivos e negativos devem ser classificados corretamente;
- Na ausência de dados, deve ser apresentado apenas um estado vazio objetivo;
- Não podem ser exibidos valores fictícios, demonstrativos ou preenchidos manualmente.

## Limites obrigatórios

O submódulo Contabilidade **não deve possuir**:

- Visão geral contábil genérica;
- Competências como tela operacional própria;
- Plano de contas como área de navegação;
- Formulários de lançamentos contábeis;
- Conciliações;
- Obrigações;
- Gestão documental;
- Integração com contador;
- Pendências de fechamento;
- Fechamentos;
- Histórico contábil;
- Abas ou submódulos que desviem da finalidade de Profit & Loss.

Esses processos pertencem ao motor financeiro, ao Ledger interno ou a módulos específicos e não devem ser expostos dentro da página de Profit & Loss.

---

# 5. SaaS e Assinaturas

## Decisão

**Manter como módulo independente**, porque o banco e o domínio já possuem fluxo próprio que não é adequadamente representado apenas por Contratos ou Transações.

## Justificativa

O módulo controla aspectos operacionais recorrentes que ultrapassam o lançamento de uma despesa:

- Plano contratado;
- Quantidade de licenças;
- Usuários vinculados;
- Uso e limites;
- Ciclo de cobrança;
- Próxima cobrança;
- Renovação;
- Reajuste;
- Fidelidade;
- Alterações de plano;
- Suspensão e cancelamento;
- Alertas;
- Histórico de eventos;
- Custo por unidade e por usuário;
- Identificação de ferramentas duplicadas.

## Entidades proprietárias

- Planos SaaS;
- Assinaturas;
- Registros de uso;
- Ciclos de cobrança;
- Eventos do ciclo de vida.

## Referências obrigatórias

- Fornecedor: Contatos;
- Contrato: Contratos;
- Unidade responsável: Unidades de Negócio;
- Conta financeira e pagamento: Transações;
- Classificação de custo: categoria financeira;
- Responsável interno: Acessos e Permissões.

## Ausência de duplicidade

- Dados jurídicos, prazo e versão do instrumento: Contratos;
- Cobrança, pagamento e conciliação: Transações;
- Equipamento ou licença patrimonial controlável: Ativos, quando aplicável;
- Uso, usuários, plano, renovação e custo unitário: SaaS e Assinaturas.

Caso uma assinatura não possua usuários, uso, plano, renovação ou regras próprias, ela pode ser registrada apenas como contrato e despesa recorrente. O módulo SaaS deve conter somente serviços que exigem esse controle operacional adicional.

---

# 6. Ordem provisória da navegação

Até nova homologação, a ordem obrigatória é:

1. Dashboard;
2. CRM;
3. Contratos;
4. Financeiro;
5. Unidades de Negócio;
6. Rateio;
7. Participações e Repasses;
8. SaaS e Assinaturas;
9. Ativos;
10. Estrutura Corporativa;
11. Jurídico e Propriedade Intelectual;
12. Integrações;
13. Acessos e Permissões;
14. Auditoria.

Financeiro contém exclusivamente os submódulos visíveis:

- Transações;
- Contabilidade — Profit & Loss;
- Nota Fiscal.

---

# 7. Matriz resumida de propriedade

| Processo                                           | Módulo proprietário               |
| -------------------------------------------------- | --------------------------------- |
| Receita, despesa, transferência e conta financeira | Transações                        |
| Importação OFX e movimentação bancária             | Transações                        |
| Categoria financeira                               | Transações, em página interna     |
| Distribuição interna entre dimensões               | Rateio                            |
| Obrigação econômica a beneficiário                 | Participações e Repasses          |
| Instrumento e versão contratual                    | Contratos                         |
| Profit & Loss / DRE gerencial                      | Contabilidade                     |
| Ledger e escrituração técnica                      | Infraestrutura financeira interna |
| Documento fiscal                                   | Nota Fiscal                       |
| Processo, prazo e risco jurídico                   | Jurídico                          |
| Marca, obra, fonograma, licença e registro         | Propriedade Intelectual           |
| Plano, licença, uso e renovação de software        | SaaS e Assinaturas                |
| Pagamento de assinatura ou repasse                 | Transações                        |

## Critério de homologação

Um módulo somente permanece aprovado quando:

- Possui responsabilidade exclusiva;
- Possui entidades próprias;
- Possui fluxo operacional verificável;
- Possui permissões coerentes;
- Mantém integração por referências, sem duplicação;
- Não apresenta campos ou telas sem uso real;
- Opera apenas com dados persistidos.
