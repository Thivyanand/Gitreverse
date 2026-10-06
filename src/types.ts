export interface RepositoryInput {
  owner: string;
  repo: string;
  url: string;
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
}
