import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CodeFileAnalysis, CodeSymbol, ImportReference } from "./types.js";

const EXTENSIONS: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript"
};

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function isExported(source: string, index: number): boolean {
  const lineStart = source.lastIndexOf("\n", index) + 1;
  return /^\s*export\b/.test(source.slice(lineStart));
}

function extractImports(source: string, file: string): ImportReference[] {
  const imports: ImportReference[] = [];
  const pattern = /(?:import\s+(.*?)\s+from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    const clause = match[1] ?? "";
    const moduleSource = match[2];
    const names = clause
      .replace(/[{}]/g, "")
      .split(",")
      .map((name) => name.trim().split(/\s+as\s+/)[0])
      .filter(Boolean);

    imports.push({
      source: moduleSource,
      file,
      names,
      isRelative: moduleSource.startsWith(".")
    });
  }

  return imports;
}

function extractExports(source: string): string[] {
  const exports = new Set<string>();

  const named = /export\s+(?:const|let|var|function|class|interface|type)\s+([A-Za-z_$][\w$]*)/g;
  let match: RegExpExecArray | null;

  while ((match = named.exec(source))) exports.add(match[1]);

  const defaultExport = /export\s+default\s+(?:async\s+)?(?:function|class)?\s*([A-Za-z_$][\w$]*)?/g;
  while ((match = defaultExport.exec(source))) {
    exports.add(match[1] ?? "default");
  }

  const exportList = /export\s*{([^}]+)}/g;
  while ((match = exportList.exec(source))) {
    for (const item of match[1].split(",")) {
      const name = item.trim().split(/\s+as\s+/)[0];
      if (name) exports.add(name);
    }
  }

  return [...exports].sort();
}

function extractSymbols(source: string, file: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const patterns: Array<[CodeSymbol["kind"], RegExp]> = [
    ["function", /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g],
    ["class", /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g],
    ["interface", /(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/g],
    ["type", /(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/g],
    ["constant", /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)/g],
    ["variable", /(?:export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*)/g]
  ];

  for (const [kind, pattern] of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      symbols.push({
        name: match[1],
        kind,
        file,
        exported: isExported(source, match.index),
        line: lineNumber(source, match.index)
      });
    }
  }

  return symbols.sort((a, b) => a.line - b.line);
}

export async function analyzeCodeFile(
  root: string,
  relativeFile: string
): Promise<CodeFileAnalysis | null> {
  const extension = path.extname(relativeFile).toLowerCase();
  const language = EXTENSIONS[extension];
  if (!language) return null;

  const fullPath = path.join(root, relativeFile);
  const source = await readFile(fullPath, "utf8");

  return {
    file: relativeFile,
    language,
    imports: extractImports(source, relativeFile),
    symbols: extractSymbols(source, relativeFile),
    exports: extractExports(source)
  };
}
