import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CodeFileAnalysis, CodeSymbol, ImportReference } from "./types.js";

const EXTENSIONS: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".mts": "TypeScript",
  ".cts": "TypeScript",
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

function importedNames(clause: string): string[] {
  const names: string[] = [];
  const cleaned = clause.replace(/^\s*type\s+/, "").trim();
  if (!cleaned) return names;

  // Default imports: import thing from "module"
  const defaultMatch = cleaned.match(/^([A-Za-z_$][\w$]*)/);
  if (defaultMatch && defaultMatch[1] !== "type") names.push(defaultMatch[1]);

  // Namespace imports: import * as namespace from "module"
  const namespaceMatch = cleaned.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespaceMatch) names.push(namespaceMatch[1]);

  // Named imports: import { original, original as alias } from "module"
  const namedMatch = cleaned.match(/\{([^}]*)\}/);
  if (namedMatch) {
    for (const entry of namedMatch[1].split(",")) {
      const item = entry.trim().replace(/^type\s+/, "");
      if (!item) continue;
      const original = item.split(/\s+as\s+/)[0].trim();
      if (original) names.push(original);
    }
  }

  return [...new Set(names)];
}

function extractImports(source: string, file: string): ImportReference[] {
  const imports: ImportReference[] = [];
  const seen = new Set<string>();

  const addImport = (moduleSource: string, clause = "") => {
    const key = `${moduleSource}\u0000${clause}`;
    if (seen.has(key)) return;
    seen.add(key);
    imports.push({
      source: moduleSource,
      file,
      names: importedNames(clause),
      isRelative: moduleSource.startsWith(".")
    });
  };

  // Static imports, including side-effect imports without a "from" clause.
  const staticPattern = /\bimport\s+(?:type\s+)?(?:(.*?)\s+from\s+)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = staticPattern.exec(source))) {
    addImport(match[2], match[1] ?? "");
  }

  // Dynamic imports and CommonJS require calls.
  const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((match = dynamicPattern.exec(source))) {
    addImport(match[1] ?? match[2]);
  }

  // Re-exports also establish a module dependency.
  const reExportPattern = /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g;
  while ((match = reExportPattern.exec(source))) {
    addImport(match[1]);
  }

  return imports.sort((a, b) => a.source.localeCompare(b.source));
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
