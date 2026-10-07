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

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`
  ];

  return candidates.find((candidate) => files.has(candidate)) ?? null;
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
