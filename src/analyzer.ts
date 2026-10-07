import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RepositoryAnalysis } from "./types.js";
import { analyzeCodeFile } from "./code-intelligence.js";\nimport { buildDependencyGraph } from "./dependency-graph.js";\nimport { buildArchitectureModel } from "./architecture.js";

const IGNORED = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  "__pycache__",
  ".venv",
  "venv"
]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".java": "Java",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".cs": "C#",
  ".go": "Go",
  ".rs": "Rust",
  ".php": "PHP",
  ".rb": "Ruby",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sql": "SQL",
  ".sh": "Shell"
};

async function walk(
  root: string,
  current: string,
  files: string[],
  directories: string[]
): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;

    const fullPath = path.join(current, entry.name);
    const relativePath = path.relative(root, fullPath);

    if (entry.isDirectory()) {
      directories.push(relativePath);
      await walk(root, fullPath, files, directories);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
}

function detectFramework(files: string[], dependencies: string[]): string | null {
  const deps = new Set(dependencies);

  if (deps.has("next") || files.some((f) => f === "next.config.js" || f === "next.config.ts")) return "Next.js";
  if (deps.has("react") || deps.has("react-dom")) return "React";
  if (deps.has("vue")) return "Vue";
  if (deps.has("@angular/core")) return "Angular";
  if (deps.has("express")) return "Express";
  if (deps.has("fastify")) return "Fastify";
  if (deps.has("flask")) return "Flask";
  if (deps.has("django")) return "Django";

  return null;
}

async function readJsonDependencies(root: string): Promise<{
  dependencies: string[];
  packageManager: string | null;
}> {
  try {
    const raw = await readFile(path.join(root, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      packageManager?: string;
    };

    const dependencies = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {})
    ].sort();

    let packageManager: string | null = null;
    if (pkg.packageManager) packageManager = pkg.packageManager.split("@")[0];
    else if (await exists(path.join(root, "pnpm-lock.yaml"))) packageManager = "pnpm";
    else if (await exists(path.join(root, "yarn.lock"))) packageManager = "yarn";
    else if (await exists(path.join(root, "package-lock.json"))) packageManager = "npm";
    else if (await exists(path.join(root, "bun.lockb"))) packageManager = "bun";

    return { dependencies, packageManager };
  } catch {
    return { dependencies: [], packageManager: null };
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

export async function analyzeRepository(
  root: string,
  repository: RepositoryAnalysis["repository"]
): Promise<RepositoryAnalysis> {
  const files: string[] = [];
  const directories: string[] = [];

  await walk(root, root, files, directories);

  const languages: Record<string, number> = {};
  for (const file of files) {
    const language = LANGUAGE_BY_EXTENSION[path.extname(file).toLowerCase()];
    if (language) languages[language] = (languages[language] ?? 0) + 1;
  }

  const { dependencies, packageManager } = await readJsonDependencies(root);
  const framework = detectFramework(files, dependencies);
  const codeFiles = (await Promise.all(
    files.map((file) => analyzeCodeFile(root, file))
  )).filter((file): file is NonNullable<typeof file> => file !== null);

  return {
    repository,
    analyzedAt: new Date().toISOString(),
    root,
    fileCount: files.length,
    directories: directories.sort(),
    files: files.sort(),
    languages,
    framework,
    packageManager,
    dependencies,
    codeFiles
  };
}
