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

export interface ArchitectureModel {
  entryPoints: string[];
  mostImported: Array<{ file: string; incomingEdges: number }>;
  isolatedFiles: string[];
  connectedComponents: string[][];
}

export interface ApiEndpoint {
  method: string;
  path: string;
  file: string;
  line: number;
  framework: string;
}

export interface DatabaseSignal {
  technology: string;
  evidence: string[];
}

export interface ComponentInfo {
  name: string;
  file: string;
  framework: string;
  props: string[];
  line: number;
}

export interface RepositoryAnalysis {
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
  codeFiles: CodeFileAnalysis[];
  dependencyGraph: DependencyGraph;
  architecture: ArchitectureModel;
  apiEndpoints: ApiEndpoint[];
  databaseSignals: DatabaseSignal[];
  components: ComponentInfo[];
}
