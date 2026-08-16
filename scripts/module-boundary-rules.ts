export interface SourceUnit {
  path: string;
  content: string;
}

const featureImportPattern = /(?:from\s*|import\s*\()?["'](@\/features\/[^"']+)["']/g;

export function featureImports(content: string): string[] {
  return [...content.matchAll(featureImportPattern)].map((match) => match[1]);
}

export function modulesToFeaturesViolations(sources: SourceUnit[]): string[] {
  return sources.flatMap((source) => {
    if (!source.path.startsWith("apps/web/src/modules/")) return [];
    return featureImports(source.content).map(
      (target) => `${source.path} imports legacy owner ${target}`,
    );
  });
}

export function featureRouteViolations(sources: SourceUnit[]): string[] {
  return sources.flatMap((source) => {
    if (!source.path.startsWith("apps/web/src/routes/")) return [];
    return featureImports(source.content).map(
      (target) => `${source.path} routes to business feature ${target}`,
    );
  });
}

export function reverseBarrelViolations(sources: SourceUnit[]): string[] {
  return sources.flatMap((source) => {
    if (!source.path.startsWith("apps/web/src/features/")) return [];
    if (!/export\s+(?:type\s+)?(?:\*|\{)[\s\S]*?from\s+["']@\/modules\//m.test(source.content)) {
      return [];
    }
    return [`${source.path} keeps a reverse feature-to-module barrel`];
  });
}

const businessGlobalRoots = [
  "apps/web/src/components/",
  "apps/web/src/lib/",
  "apps/web/src/shared/",
] as const;

const allowedInfrastructureFiles = new Set([
  "apps/web/src/lib/env.ts",
  "apps/web/src/lib/env-schema.ts",
  "apps/web/src/lib/env-schema.test.ts",
  "apps/web/src/lib/error-page.ts",
  "apps/web/src/lib/error-capture.ts",
  "apps/web/src/lib/supabase/client.ts",
  "apps/web/src/lib/supabase/development-read-fallback.ts",
  "apps/web/src/lib/supabase/development-read-fallback.test.ts",
  "apps/web/src/shared/workspace/api.ts",
]);

export function misplacedBusinessFiles(sources: SourceUnit[]): string[] {
  return sources.flatMap((source) => {
    if (!businessGlobalRoots.some((root) => source.path.startsWith(root))) return [];
    if (allowedInfrastructureFiles.has(source.path)) return [];
    if (source.path.startsWith("apps/web/src/shared/components/ui/")) return [];
    const importsDomain = /["']@\/modules\//.test(source.content);
    const accessesBusinessData =
      source.content.includes("getSupabaseBrowserClient") ||
      source.content.includes(".functions.invoke(");
    const globalComponent = source.path.startsWith("apps/web/src/components/");
    if (!importsDomain && !accessesBusinessData && !globalComponent) return [];
    return [`${source.path} contains business ownership outside modules/`];
  });
}

export function aggregateFacadeViolations(sources: SourceUnit[]): string[] {
  const forbidden = ["corporate-directory", "governance-registry", "financial-operations"];
  return sources.flatMap((source) => {
    const hits = forbidden.filter(
      (marker) => source.path.includes(`/${marker}/`) || source.content.includes(`/${marker}`),
    );
    return hits.map((marker) => `${source.path} references aggregate/transitional owner ${marker}`);
  });
}

export function singleDomainSharedViolations(sources: SourceUnit[]): string[] {
  const shared = sources.filter(
    (source) =>
      source.path.startsWith("apps/web/src/shared/") &&
      !source.path.startsWith("apps/web/src/shared/components/ui/"),
  );
  return shared.flatMap((candidate) => {
    const alias = `@/${candidate.path.replace("apps/web/src/", "").replace(/\.(tsx?|jsx?)$/, "")}`;
    const consumers = sources.filter((source) => source.content.includes(alias));
    const moduleConsumers = consumers
      .map((source) => source.path.match(/^apps\/web\/src\/modules\/([^/]+(?:\/[^/]+)?)/)?.[1])
      .filter((owner): owner is string => Boolean(owner));
    const owners = new Set(moduleConsumers);
    const looksDomainSpecific = /["']@\/modules\//.test(candidate.content);
    if (!looksDomainSpecific || owners.size !== 1) return [];
    return [
      `${candidate.path} is shared but has one domain owner (${[...owners][0]}) and imports module code`,
    ];
  });
}
