export function renderErrorPage(): string {
  const homeHref = import.meta.env.BASE_URL || "/";
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Esta página não carregou | Lander Solutions</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 Inter, system-ui, -apple-system, sans-serif; background: #f7f7f8; color: #1f2937; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font: 600 1.25rem/1.3 Poppins, Inter, system-ui, sans-serif; margin: 0 0 0.5rem; }
      p { color: #64748b; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #0b6a4f; color: #fff; }
      .secondary { background: #fff; color: #1f2937; border-color: #e5e7eb; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Esta página não carregou</h1>
      <p>Ocorreu uma falha ao carregar esta tela. Tente novamente ou volte ao dashboard.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar novamente</button>
        <a class="secondary" href="${homeHref}">Ir para o dashboard</a>
      </div>
    </div>
  </body>
</html>`;
}
