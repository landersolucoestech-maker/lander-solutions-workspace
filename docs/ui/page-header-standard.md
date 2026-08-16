# Padrão global de cabeçalhos de página

- O título e o subtítulo de cada rota devem ser definidos exclusivamente em `PAGE_HEADERS`, no componente `Topbar`.
- A identidade da página deve aparecer apenas na barra branca superior, alinhada à esquerda.
- O componente legado `PageHeader` preserva somente ações, filtros e comandos contextuais; ele não renderiza título nem subtítulo.
- Páginas e estados de erro não devem criar uma segunda ocorrência do título ou do subtítulo da rota.
- Novas rotas devem receber uma entrada em `PAGE_HEADERS`, preservando a mesma hierarquia tipográfica, espaçamento e alinhamento das rotas existentes.
