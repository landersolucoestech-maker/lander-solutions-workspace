import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = "apps/web/src";

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const files: string[] = [];
  for (const name of entries) {
    const full = join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) files.push(...(await walk(full)));
    else if (/\.tsx$/.test(name)) files.push(full);
  }
  return files;
}

function readOpeningTag(source: string, start: number): string | null {
  let braceDepth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") {
      braceDepth += 1;
      continue;
    }
    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (char === ">" && braceDepth === 0) return source.slice(start, index + 1);
  }

  return null;
}

const files = await walk(ROOT);
const candidates: string[] = [];
const actionMarkers = [
  "onClick=",
  "onSelect=",
  "onPointerDown=",
  "onMouseDown=",
  "onKeyDown=",
  "asChild",
  'type="submit"',
  "type={'submit'}",
  "type=\"reset\"",
  "type={'reset'}",
];
const wrapperMarkers = [
  "DropdownMenuTrigger",
  "DialogTrigger",
  "DialogClose",
  "AlertDialogTrigger",
  "AlertDialogAction",
  "AlertDialogCancel",
  "PopoverTrigger",
  "SheetTrigger",
  "TooltipTrigger",
  "CollapsibleTrigger",
  "ContextMenuTrigger",
  "MenubarTrigger",
  "NavigationMenuTrigger",
];

for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/<(Button|button)\b/g)) {
    const start = match.index ?? 0;
    const tag = readOpeningTag(source, start);
    if (!tag) {
      candidates.push(`${relative(".", file)}:${source.slice(0, start).split("\n").length}: malformed button opening tag`);
      continue;
    }

    if (actionMarkers.some((marker) => tag.includes(marker))) continue;
    if (/\bdisabled(?:\s|\/?>)/.test(tag) && !/disabled\s*=\s*\{/.test(tag)) continue;

    const before = source.slice(Math.max(0, start - 500), start);
    if (
      wrapperMarkers.some((marker) => {
        const open = before.lastIndexOf(`<${marker}`);
        const close = before.lastIndexOf(`</${marker}>`);
        return open > close;
      })
    ) {
      continue;
    }

    const line = source.slice(0, start).split("\n").length;
    const snippet = tag.replace(/\s+/g, " ").slice(0, 220);
    candidates.push(`${relative(".", file)}:${line}: ${snippet}`);
  }
}

console.log(`Interactive action audit: ${files.length} TSX files scanned.`);
if (candidates.length === 0) {
  console.log("Interactive action audit passed: no potentially inert Button/button elements found.");
  process.exit(0);
}

console.error(`Interactive action audit failed: ${candidates.length} potentially inert control(s) require review.`);
for (const candidate of candidates) console.error(`- ${candidate}`);
process.exit(1);
