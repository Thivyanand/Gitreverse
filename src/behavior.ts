import { readFile } from "node:fs/promises";
import path from "node:path";

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

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function extractEndpoints(source: string, file: string, framework: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const add = (method: string, route: string, index: number) =>
    endpoints.push({ method: method.toUpperCase(), path: route, file, line: lineNumber(source, index), framework });

  if (framework === "Express" || framework === "Fastify") {
    const pattern = /\.(get|post|put|patch|delete|options|head)\s*\(\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) add(match[1], match[2], match.index);
  }

  if (framework === "Next.js" && /app[\\/]api|pages[\\/]api/.test(file)) {
    const route = "/" + file
      .replace(/^.*?(?:app[\\/]api|pages[\\/]api)[\\/]/, "")
      .replace(/\\/g, "/")
      .replace(/\.(ts|tsx|js|jsx)$/, "")
      .replace(/\/route$/, "");
    add("ROUTE", route, 0);
  }

  if (framework === "Flask" || framework === "FastAPI") {
    const pattern = /@(?:app|router)\.(?:route|get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      const decorator = source.slice(match.index, match.index + match[0].length);
      const method = decorator.match(/\.(get|post|put|patch|delete)\s*\(/)?.[1] ?? "ROUTE";
      add(method, match[1], match.index);
    }
  }

  return endpoints;
}

function extractComponents(source: string, file: string, framework: string): ComponentInfo[] {
  if (framework !== "React" && framework !== "Next.js" && framework !== "Vue") return [];

  const components: ComponentInfo[] = [];
  const pattern = /(?:export\s+)?(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    components.push({
      name: match[1],
      file,
      framework,
      props: [],
      line: lineNumber(source, match.index)
    });
  }

  return components;
}

export async function analyzeBehaviorFile(
  root: string,
  file: string,
  framework: string | null
): Promise<{ endpoints: ApiEndpoint[]; components: ComponentInfo[] }> {
  const extension = path.extname(file).toLowerCase();
  if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"].includes(extension)) {
    return { endpoints: [], components: [] };
  }

  const source = await readFile(path.join(root, file), "utf8");
  return {
    endpoints: extractEndpoints(source, file, framework ?? ""),
    components: extractComponents(source, file, framework ?? "")
  };
}

export function detectDatabaseSignals(files: string[], dependencies: string[]): DatabaseSignal[] {
  const signals: DatabaseSignal[] = [];
  const deps = new Set(dependencies);
  const add = (technology: string, evidence: string[]) => signals.push({ technology, evidence });

  if (deps.has("prisma") || deps.has("@prisma/client") || files.some((f) => f.includes("schema.prisma"))) {
    add("Prisma", ["Prisma dependency or schema.prisma detected"]);
  }
  if (deps.has("mongoose")) add("MongoDB / Mongoose", ["mongoose dependency detected"]);
  if (deps.has("pg")) add("PostgreSQL", ["pg dependency detected"]);
  if (deps.has("mysql2") || deps.has("mysql")) add("MySQL", ["mysql dependency detected"]);
  if (deps.has("sequelize")) add("SQL / Sequelize", ["sequelize dependency detected"]);
  if (deps.has("typeorm")) add("SQL / TypeORM", ["typeorm dependency detected"]);
  if (deps.has("drizzle-orm")) add("SQL / Drizzle", ["drizzle-orm dependency detected"]);
  if (deps.has("redis") || deps.has("ioredis")) add("Redis", ["Redis client dependency detected"]);
  if (files.some((f) => /(^|\/)(migrations?|prisma|models?)(\/|$)/i.test(f))) {
    add("Database layer", ["database-related directory detected"]);
  }

  return signals;
}
