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

const files = await walk(ROOT);
const candidates: string[] = [];
const actionMarkers = [
  "onClick=",
  "onSelect=",
  "asChild",
  'type="submit"',
  "type={'submit'}",
  'type="reset"',
  "type={'reset'}",
];
const wrapperMarkers = [
  "DropdownMenuTrigger",
  "DialogClose",
  "AlertDialogAction",
  "AlertDialogCancel",
  "PopoverTrigger",
  "SheetTrigger",
  "TooltipTrigger",
  "CollapsibleTrigger",
];

for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/<(Button|button)\b([^>]*)>/g)) {
    const attrs = match[2] ?? "";
    if (actionMarkers.some((marker) => attrs.includes(marker))) continue;
    if (/\bdisabled\b/.test(attrs) && !/disabled\s*=\s*\{/.test(attrs)) continue;

    const start = match.index ?? 0;
    const before = source.slice(Math.max(0, start - 220), start);
    if (wrapperMarkers.some((marker) => before.includes(`<${marker}`) && !before.includes(`</${marker}>`))) {
      continue;
    }

    const line = source.slice(0, start).split("\n").length;
    const snippet = match[0].replace(/\s+/g, " ").slice(0, 180);
    candidates.push(`${relative(".", file)}:${line}: ${snippet}`);
  }
}

console.log(`Interactive action inventory: ${files.length} TSX files scanned.`);
if (candidates.length === 0) {
  console.log("No potentially inert Button/button elements found.");
} else {
  console.log(`Potentially inert controls requiring review: ${candidates.length}`);
  for (const candidate of candidates) console.log(`- ${candidate}`);
}
