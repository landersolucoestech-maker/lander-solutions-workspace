# Revisão de Centro de Custo e Ledger

## Decisão de produto

Os conceitos de **Centro de Custo** e **Ledger** não serão apresentados como módulos principais, itens de sidebar ou etapas obrigatórias do fluxo operacional comum.

Ambos permanecem como mecanismos internos de apoio contábil e gerencial. O usuário operacional trabalhará com termos compreensíveis: unidade de negócio, categoria financeira, projeto, transação, receita, despesa, pagamento, recebimento e Profit & Loss.

## Centro de Custo

### Problema que resolve

Identificar a finalidade interna de uma despesa quando a unidade de negócio, o projeto ou a categoria financeira não são suficientes para explicar o consumo do recurso.

Exemplos válidos:

- despesa corporativa compartilhada entre várias unidades;
- estrutura administrativa central;
- campanha, departamento ou iniciativa temporária sem projeto próprio;
- base de cálculo para um rateio gerencial previamente configurado.

### Quem utiliza

- responsável financeiro;
- responsável contábil;
- administrador autorizado a configurar critérios de rateio.

O usuário comum não deverá preencher Centro de Custo em toda transação.

### Onde será utilizado

- configuração avançada de classificação financeira;
- regras de rateio;
- auditoria de despesas compartilhadas;
- relatórios administrativos específicos, quando necessários.

Não será exibido na sidebar. Também não será apresentado como filtro principal quando unidade, projeto ou categoria forem suficientes.

### Dados vinculados

- pessoa jurídica;
- unidade de negócio, quando aplicável;
- produto, serviço ou projeto, quando aplicável;
- transação ou linha financeira;
- regra de rateio.

### Impacto nos relatórios

O Centro de Custo pode detalhar a origem administrativa de uma despesa, mas não substitui a unidade de negócio nem a categoria financeira. O Profit & Loss continuará sendo apresentado prioritariamente por unidade e categoria.

### Regra de interação

- preenchimento opcional;
- configuração restrita;
- oculto no fluxo simplificado;
- não deve impedir a criação de uma transação válida;
- deve ser utilizado somente quando houver finalidade gerencial documentada.

## Ledger

### Problema que resolve

Registrar os efeitos contábeis imutáveis das operações por partidas dobradas, preservando rastreabilidade, competência, débitos, créditos, estornos e origem do lançamento.

### Quem utiliza

- o próprio sistema, automaticamente;
- responsável contábil, em revisão ou ajuste autorizado;
- auditor, em consulta técnica.

### Onde será utilizado

- processamento interno de transações aprovadas;
- liquidações, pagamentos e recebimentos;
- estornos;
- fechamento de período;
- geração do Profit & Loss e demais demonstrativos;
- trilha de auditoria.

### Dados vinculados

- documento financeiro de origem;
- data de competência e data de postagem;
- contas contábeis gerenciais;
- unidade de negócio;
- categoria, projeto, contato e contrato, quando aplicáveis;
- linhas de débito e crédito;
- lançamento original e lançamento de reversão.

### Impacto nos relatórios

O Ledger é a fonte técnica dos valores contábeis consolidados. O usuário não precisa compreender ou manipular débitos e créditos para registrar uma receita ou uma despesa comum.

### Regra de interação

- oculto da navegação principal;
- lançamentos automáticos gerados a partir dos fluxos operacionais;
- ajustes manuais somente em área avançada e mediante permissão específica;
- lançamentos postados não podem ser editados; correções são realizadas por estorno e novo lançamento;
- nenhum fluxo comum deve exigir que o usuário selecione manualmente uma conta de débito ou crédito.

## Relação entre os conceitos

1. A **Transação** representa o fato operacional compreendido pelo usuário.
2. A **Unidade de Negócio** identifica onde o resultado econômico será apurado.
3. A **Categoria Financeira** explica a natureza gerencial da receita ou despesa.
4. O **Projeto**, quando existente, identifica uma operação com escopo próprio.
5. O **Centro de Custo**, opcional, detalha uma finalidade administrativa ou compartilhada.
6. O **Ledger** registra internamente o efeito contábil da operação.
7. O **Profit & Loss** consolida os lançamentos postados e os apresenta em linguagem gerencial.

## Critérios para remoção futura

O Centro de Custo poderá ser removido definitivamente caso, durante a homologação operacional, todas as despesas sejam classificadas de forma suficiente por unidade, categoria e projeto e nenhuma regra de rateio dependa dele.

O Ledger não deve ser removido do backend porque sustenta consistência contábil, estornos, auditoria e Profit & Loss. O que deve permanecer removido é sua exposição como módulo operacional comum.

## Resultado aplicado à interface

- Centro de Custo removido da sidebar;
- Ledger removido da sidebar;
- Contabilidade concentra Profit & Loss;
- Transações concentra receitas e despesas;
- configurações técnicas permanecem internas e condicionadas a permissões;
- linguagem operacional substitui terminologia contábil nas telas comuns.
