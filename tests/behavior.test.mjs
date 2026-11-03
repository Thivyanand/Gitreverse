import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeBehaviorFile, detectDatabaseSignals } from "../dist/behavior.js";

test("detects Express routes with method, path, and line number", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitreverse-api-"));
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "server.ts"), 'const app = express();\napp.get("/health", handler);\n', "utf8");

    const result = await analyzeBehaviorFile(root, "src/server.ts", "Express");
    assert.equal(result.endpoints.length, 1);
    assert.deepEqual(result.endpoints[0], {
      method: "GET",
      path: "/health",
      file: "src/server.ts",
      line: 2,
      framework: "Express"
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("detects database technologies from dependencies and paths", () => {
  const signals = detectDatabaseSignals(
    ["prisma/schema.prisma", "src/models/user.ts"],
    ["@prisma/client", "pg", "ioredis"]
  );
  const technologies = signals.map((signal) => signal.technology);
  assert.ok(technologies.includes("Prisma"));
  assert.ok(technologies.includes("PostgreSQL"));
  assert.ok(technologies.includes("Redis"));
  assert.ok(technologies.includes("Database layer"));
});

test("detects Django path and re_path URL patterns with source locations", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitreverse-django-"));
  try {
    await mkdir(path.join(root, "project"), { recursive: true });
    await writeFile(
      path.join(root, "project", "urls.py"),
      'from django.urls import path, re_path\nurlpatterns = [\n    path("api/health/", health),\n    re_path(r"^api/users/(?P<id>[0-9]+)/$", detail),\n]\n',
      "utf8"
    );

    const result = await analyzeBehaviorFile(root, "project/urls.py", "Django");
    assert.deepEqual(result.endpoints.map(({ method, path, line, framework }) => ({
      method, path, line, framework
    })), [
      { method: "ROUTE", path: "api/health/", line: 3, framework: "Django" },
      { method: "ROUTE", path: "^api/users/(?P<id>[0-9]+)/$", line: 4, framework: "Django" }
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("extracts all configured Flask and FastAPI HTTP methods", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitreverse-python-methods-"));
  try {
    await mkdir(path.join(root, "api"), { recursive: true });
    await writeFile(
      path.join(root, "api", "routes.py"),
      '@app.route("/items", methods=["GET", "POST"])\\n' +
      '@router.api_route("/records", methods=["GET", "DELETE"])\\n',
      "utf8"
    );

    const flask = await analyzeBehaviorFile(root, "api/routes.py", "Flask");
    const fastapi = await analyzeBehaviorFile(root, "api/routes.py", "FastAPI");
    assert.deepEqual(flask.endpoints.map(({ method, path }) => ({ method, path })), [
      { method: "GET", path: "/items" },
      { method: "POST", path: "/items" }
    ]);
    assert.deepEqual(fastapi.endpoints.map(({ method, path }) => ({ method, path })), [
      { method: "GET", path: "/records" },
      { method: "DELETE", path: "/records" }
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
