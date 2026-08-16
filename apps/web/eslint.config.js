import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: [
      "src/app/providers/auth-context.tsx",
      "src/app/providers/workspace-context.tsx",
      "src/shared/components/ui/badge.tsx",
      "src/shared/components/ui/button.tsx",
      "src/shared/components/ui/form.tsx",
      "src/shared/components/ui/navigation-menu.tsx",
      "src/shared/components/ui/sidebar.tsx",
      "src/shared/components/ui/toggle.tsx",
      "src/modules/contracts/pages/contracts-page.tsx",
      "src/features/crm/lead-dialog.tsx",
      "src/features/finance/documents-page.tsx",
      "src/features/hr/hr-management-fields.tsx",
      "src/modules/customer-support/support-inbox-filters.tsx",
    ],
    rules: {
      // These modules intentionally colocate React components with stable hooks,
      // variants or form helpers that are imported by sibling feature modules.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/features/financial-operations/fiscal-page.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/features/hr/hr-action-dialogs.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  eslintPluginPrettier,
);
