import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RepositoryAnalysis } from "./types.js";
import { analyzeCodeFile } from "./code-intelligence.js";
import { buildDependencyGraph } from "./dependency-graph.js";
import { buildArchitectureModel } from "./architecture.js";
import { analyzeBehaviorFile, detectDatabaseSignals } from "./behavior.js";

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
  ".mts": "TypeScript",
  ".cts": "TypeScript",
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

function normalizeDependencyName(name: string): string {
  return name.toLowerCase().replace(/[_.]+/g, "-");
}

function parsePythonRequirement(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || /^-(?:r|c|e|f|i|index-url|extra-index-url)\b/i.test(trimmed)) {
    const egg = trimmed.match(/#egg=([A-Za-z0-9_.-]+)/i);
    return egg ? normalizeDependencyName(egg[1]) : null;
  }

  const egg = trimmed.match(/#egg=([A-Za-z0-9_.-]+)/i);
  if (egg) return normalizeDependencyName(egg[1]);

  const match = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)(?:\[[^\]]+\])?(?=\s*(?:[<>=!~;\s]|$))/);
  return match ? normalizeDependencyName(match[1]) : null;
}

async function readPythonDependencies(root: string, files: string[]): Promise<string[]> {
  const dependencies = new Set<string>();
  const requirementFiles = files.filter((file) =>
    !file.includes("/") && /^requirements(?:[-_.][A-Za-z0-9_.-]+)?\.txt$/i.test(file)
  );

  for (const file of requirementFiles) {
    const source = await readFile(path.join(root, file), "utf8");
    for (const line of source.split(/\r?\n/)) {
      const dependency = parsePythonRequirement(line);
      if (dependency) dependencies.add(dependency);
    }
  }

  if (files.includes("pyproject.toml")) {
    const source = await readFile(path.join(root, "pyproject.toml"), "utf8");
    let section = "";
    let inProjectDependencyArray = false;

    for (const line of source.split(/\r?\n/)) {
      const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
      if (sectionMatch) {
        section = sectionMatch[1].toLowerCase();
        inProjectDependencyArray = false;
        continue;
      }

      if (section === "tool.poetry.dependencies" || section === "tool.poetry.dev-dependencies") {
        const keyMatch = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=/);
        if (keyMatch && keyMatch[1].toLowerCase() !== "python") {
          dependencies.add(normalizeDependencyName(keyMatch[1]));
        }
      }

      const inProjectSection = section === "project" || section.startsWith("project.optional-dependencies");
      if (inProjectSection && /(?:dependencies|[A-Za-z0-9_.-]+)\s*=\s*\[/.test(line)) {
        inProjectDependencyArray = true;
      }

      if (inProjectSection && inProjectDependencyArray) {
        for (const match of line.matchAll(/["']([^"']+)["']/g)) {
          const dependency = parsePythonRequirement(match[1]);
          if (dependency) dependencies.add(dependency);
        }
        if (line.includes("]")) inProjectDependencyArray = false;
      }
    }
  }

  if (files.includes("Pipfile")) {
    const source = await readFile(path.join(root, "Pipfile"), "utf8");
    let inPackages = false;
    for (const line of source.split(/\r?\n/)) {
      const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
      if (section) {
        inPackages = ["packages", "dev-packages"].includes(section[1].toLowerCase());
        continue;
      }
      if (inPackages) {
        const key = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=/);
        if (key) dependencies.add(normalizeDependencyName(key[1]));
      }
    }
  }

  return [...dependencies].sort();
}

async function detectPythonPackageManager(root: string, files: string[]): Promise<string | null> {
  if (files.includes("uv.lock")) return "uv";
  if (files.includes("Pipfile")) return "pipenv";
  if (files.includes("pyproject.toml")) {
    const source = await readFile(path.join(root, "pyproject.toml"), "utf8");
    if (/^\s*\[tool\.poetry\]/m.test(source)) return "poetry";
    if (/^\s*\[project\]/m.test(source)) return "pip";
  }
  if (files.some((file) => !file.includes("/") && /^requirements(?:[-_.][A-Za-z0-9_.-]+)?\.txt$/i.test(file))) {
    return "pip";
  }
  return null;
}

function detectFramework(files: string[], dependencies: string[]): string | null {
  const deps = new Set(dependencies.map(normalizeDependencyName));
  const hasPythonFiles = files.some((file) => path.extname(file).toLowerCase() === ".py");

  // Prefer a Python backend framework when the repository actually contains Python source.
  if (hasPythonFiles || ["fastapi", "flask", "django"].some((dependency) => deps.has(dependency))) {
    if (deps.has("fastapi")) return "FastAPI";
    if (deps.has("flask")) return "Flask";
    if (deps.has("django")) return "Django";
  }

  if (deps.has("next") || files.some((f) => f === "next.config.js" || f === "next.config.ts")) return "Next.js";
  if (deps.has("react") || deps.has("react-dom")) return "React";
  if (deps.has("vue")) return "Vue";
  if (deps.has("@angular/core")) return "Angular";
  if (deps.has("express")) return "Express";
  if (deps.has("fastify")) return "Fastify";

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

  const { dependencies: javascriptDependencies, packageManager: javascriptPackageManager } =
    await readJsonDependencies(root);
  const pythonDependencies = await readPythonDependencies(root, files);
  const dependencies = [...new Set([...javascriptDependencies, ...pythonDependencies])].sort();
  const packageManager = javascriptPackageManager ?? await detectPythonPackageManager(root, files);
  const framework = detectFramework(files, dependencies);
  const codeFiles = (await Promise.all(
    files.map((file) => analyzeCodeFile(root, file))
  )).filter((file): file is NonNullable<typeof file> => file !== null);
  const dependencyGraph = buildDependencyGraph(codeFiles);
  const architecture = buildArchitectureModel(dependencyGraph);
  const behavior = await Promise.all(files.map((file) => analyzeBehaviorFile(root, file, framework)));
  const apiEndpoints = behavior.flatMap((item) => item.endpoints);
  const components = behavior.flatMap((item) => item.components);
  const databaseSignals = detectDatabaseSignals(files, dependencies);

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
    codeFiles,
    dependencyGraph,
    architecture,
    apiEndpoints,
    databaseSignals,
    components
  };
}
