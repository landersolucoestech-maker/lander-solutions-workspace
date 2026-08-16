import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption, type UserConfig } from "vite";

const codeSplitting = {
  groups: [
    {
      name: "vendor-react",
      test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
      priority: 50,
    },
    {
      name: "vendor-tanstack",
      test: /node_modules[\\/]@tanstack[\\/]/,
      maxSize: 250_000,
      priority: 40,
    },
    {
      name: "vendor-supabase",
      test: /node_modules[\\/]@supabase[\\/]/,
      maxSize: 250_000,
      priority: 35,
    },
    {
      name: "vendor-radix",
      test: /node_modules[\\/]@radix-ui[\\/]/,
      maxSize: 250_000,
      priority: 30,
    },
    {
      name: "vendor-ui",
      test: /node_modules[\\/](?:lucide-react|sonner|tailwind-merge|class-variance-authority|clsx)[\\/]/,
      maxSize: 250_000,
      priority: 20,
    },
    {
      name: "vendor",
      test: /node_modules[\\/]/,
      entriesAware: true,
      minSize: 20_000,
      maxSize: 250_000,
      priority: 10,
    },
  ],
};

export default defineConfig(async ({ command }): Promise<UserConfig> => {
  const isGitHubPages = process.env.GITHUB_PAGES === "true";
  const plugins: PluginOption[] = [
    tailwindcss(),
    tanstackStart({
      ...(isGitHubPages
        ? {
            spa: { enabled: true },
            prerender: {
              enabled: true,
              autoStaticPathsDiscovery: true,
              crawlLinks: true,
              failOnError: true,
              retryCount: 1,
            },
          }
        : {}),
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
  ];

  if (command === "build" && !isGitHubPages) {
    plugins.push(nitro({ defaultPreset: "cloudflare-module" }));
  }

  plugins.push(viteReact());

  return {
    base: isGitHubPages ? "/lander-solutions-workspace/" : "/",
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
    },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
      tsconfigPaths: true,
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    plugins,
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: { codeSplitting },
          },
        },
      },
    },
  };
});
