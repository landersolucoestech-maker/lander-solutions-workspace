import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = "apps/web/src";
const ROUTE_TREE = join(ROOT, "routeTree.gen.ts");
const PROJECT_EXPLORER = join(ROOT, "app/navigation/project-explorer.tsx");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const files: string[] = [];
  for (const name of entries) {
    const full = join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(tsx?|jsx?)$/.test(name)) files.push(full);
  }
  return files;
}

function normalizeRoute(value: string) {
  if (!value.startsWith("/")) return value;
  const clean = value.split(/[?#]/, 1)[0] || "/";
  return clean.replace(/\/+/g, "/");
}

function isDynamicMatch(target: string, known: string) {
  const a = target.split("/").filter(Boolean);
  const b = known.split("/").filter(Boolean);
  if (a.length !== b.length) return false;
  return a.every((segment, index) => b[index]?.startsWith("$") || b[index] === segment);
}

const routeTree = await readFile(ROUTE_TREE, "utf8");
const knownRoutes = new Set<string>();
for (const match of routeTree.matchAll(/^\s*'([^']+)'\s*:/gm)) {
  const route = match[1];
  if (route.startsWith("/")) knownRoutes.add(route);
}
knownRoutes.add("/");

const explorerSource = await readFile(PROJECT_EXPLORER, "utf8");
const explorerRoutes = new Set<string>();
for (const match of explorerSource.matchAll(/\[\s*["'][^"']+["']\s*,\s*["'](\/[^"']*)["']\s*\]/g)) {
  explorerRoutes.add(normalizeRoute(match[1]));
}

const files = await walk(ROOT);
const violations: string[] = [];
const dispatched = new Map<string, string[]>();
const listened = new Map<string, string[]>();

for (const route of knownRoutes) {
  if (route.includes("$")) continue;
  if (!explorerRoutes.has(route)) {
    violations.push(
      `registered static route '${route}' is not exposed in the global page explorer.`,
    );
  }
}

for (const file of files) {
  const source = await readFile(file, "utf8");
  const name = relative(".", file);

  for (const match of source.matchAll(/<a\b[^>]*\bhref=["'](\/[^"']*)["']/g)) {
    violations.push(
      `${name}: internal plain anchor '${match[1]}' must use TanStack Link/navigation so GitHub Pages basepath is preserved.`,
    );
  }
  for (const match of source.matchAll(/\bhref\s*=\s*["']#["']/g)) {
    violations.push(`${name}: placeholder href="#" is not an actionable destination.`);
  }
  for (const match of source.matchAll(
    /(?:window\.)?location\.(?:href\s*=|assign\(|replace\()\s*["'](\/[^"']*)/g,
  )) {
    violations.push(
      `${name}: direct browser navigation '${match[1]}' bypasses the application router.`,
    );
  }

  const candidates = [
    ...source.matchAll(/\bto=["'](\/[^"']*)["']/g),
    ...source.matchAll(/\bnavigate\(\s*\{[^}]*\bto\s*:\s*["'](\/[^"']*)["']/g),
    ...source.matchAll(/\bredirect\(\s*\{[^}]*\bto\s*:\s*["'](\/[^"']*)["']/g),
  ];
  for (const match of candidates) {
    const target = normalizeRoute(match[1]);
    if (
      !knownRoutes.has(target) &&
      ![...knownRoutes].some((route) => isDynamicMatch(target, route))
    ) {
      violations.push(`${name}: route target '${target}' does not exist in routeTree.gen.ts.`);
    }
  }

  for (const match of source.matchAll(/dispatchPageEvent\(["']([^"']+)["']\)/g)) {
    const event = match[1];
    dispatched.set(event, [...(dispatched.get(event) ?? []), name]);
  }
  for (const match of source.matchAll(/(?:window\.)?addEventListener\(["']([^"']+)["']/g)) {
    const event = match[1];
    listened.set(event, [...(listened.get(event) ?? []), name]);
  }
}

for (const [event, origins] of dispatched) {
  if (!listened.has(event)) {
    violations.push(
      `event '${event}' dispatched by ${origins.join(", ")} has no listener in apps/web/src.`,
    );
  }
}

console.log(
  `Navigation audit: ${files.length} source files, ${knownRoutes.size} registered routes, ${explorerRoutes.size} globally exposed routes, ${dispatched.size} dispatched page events.`,
);
if (violations.length) {
  console.error(`Navigation audit failed with ${violations.length} issue(s):`);
  for (const issue of violations) console.error(`- ${issue}`);
  process.exit(1);
}
console.log("Navigation audit passed.");
