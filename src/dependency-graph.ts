import path from "node:path";
import type { CodeFileAnalysis } from "./types.js";

export interface DependencyEdge {
  from: string;
  to: string;
  source: string;
  resolved: boolean;
}

export interface DependencyGraph {
  nodes: string[];
  edges: DependencyEdge[];
}

function normalize(file: string): string {
  return file.replaceAll(path.sep, "/");
}

function resolveRelativeImport(
  importer: string,
  source: string,
  files: Set<string>
): string | null {
  if (!source.startsWith(".")) return null;

  const base = normalize(path.posix.normalize(
    path.posix.join(path.posix.dirname(normalize(importer)), source)
  ));
  const candidates = new Set<string>([base]);

  const extension = path.posix.extname(base);
  const extensionReplacements: Record<string, string[]> = {
    ".js": [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    ".jsx": [".tsx", ".jsx"],
    ".mjs": [".mts", ".mjs", ".js"],
    ".cjs": [".cts", ".cjs", ".js"],
    ".ts": [".ts", ".tsx", ".mts", ".cts"],
    ".tsx": [".tsx", ".ts"],
    ".mts": [".mts", ".ts"],
    ".cts": [".cts", ".ts"]
  };

  // TypeScript projects commonly write runtime .js extensions while the source
  // file is .ts/.tsx; NodeNext projects may also use .mjs/.cjs for .mts/.cts.
  if (extension && extensionReplacements[extension]) {
    const stem = base.slice(0, -extension.length);
    for (const replacement of extensionReplacements[extension]) {
      candidates.add(`${stem}${replacement}`);
    }
  } else if (!extension) {
    for (const candidateExtension of [
      ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"
    ]) {
      candidates.add(`${base}${candidateExtension}`);
    }
    for (const indexName of [
      "index.ts", "index.tsx", "index.mts", "index.cts",
      "index.js", "index.jsx", "index.mjs", "index.cjs"
    ]) {
      candidates.add(`${base}/${indexName}`);
    }
  }

  return [...candidates].find((candidate) => files.has(candidate)) ?? null;
}

export function buildDependencyGraph(
  codeFiles: CodeFileAnalysis[]
): DependencyGraph {
  const nodes = codeFiles.map((file) => normalize(file.file)).sort();
  const files = new Set(nodes);
  const edges: DependencyEdge[] = [];

  for (const file of codeFiles) {
    for (const reference of file.imports) {
      if (!reference.isRelative) continue;

      const target = resolveRelativeImport(file.file, reference.source, files);
      edges.push({
        from: normalize(file.file),
        to: target ?? normalize(
          path.posix.join(path.posix.dirname(normalize(file.file)), reference.source)
        ),
        source: reference.source,
        resolved: target !== null
      });
    }
  }

  return { nodes, edges };
}
