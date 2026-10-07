export interface RepositoryInput {
  owner: string;
  repo: string;
  url: string;
}

export interface CodeSymbol {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "constant" | "variable";
  file: string;
  exported: boolean;
  line: number;
}

export interface ImportReference {
  source: string;
  file: string;
  names: string[];
  isRelative: boolean;
}

export interface CodeFileAnalysis {
  file: string;
  language: string;
  imports: ImportReference[];
  symbols: CodeSymbol[];
  exports: string[];
}

export interface DependencyEdge {\n  from: string;\n  to: string;\n  source: string;\n  resolved: boolean;\n}\n\nexport interface DependencyGraph {\n  nodes: string[];\n  edges: DependencyEdge[];\n}\n\nexport interface ArchitectureModel {\n  entryPoints: string[];\n  mostImported: Array<{ file: string; incomingEdges: number }>;\n  isolatedFiles: string[];\n  connectedComponents: string[][];\n}\n\nexport interface RepositoryAnalysis {
  repository: RepositoryInput;
  analyzedAt: string;
  root: string;
  fileCount: number;
  directories: string[];
  files: string[];
  languages: Record<string, number>;
  framework: string | null;
  packageManager: string | null;
  dependencies: string[];
  codeFiles: CodeFileAnalysis[];\n  dependencyGraph: DependencyGraph;\n  architecture: ArchitectureModel;
}
