import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeRepository } from "../dist/analyzer.js";

async function withProject(files, callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitreverse-fullstack-"));
  try {
    for (const [relativePath, source] of Object.entries(files)) {
      const target = path.join(root, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, source, "utf8");
    }
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const repository = {
  owner: "test",
  repo: "fullstack-sample",
  url: "https://github.com/test/fullstack-sample"
};

test("retains both Python backend and JavaScript frontend frameworks", async () => {
  await withProject({
    "package.json": JSON.stringify({
      dependencies: { next: "^15.0.0", react: "^19.0.0", "react-dom": "^19.0.0" }
    }),
    "requirements.txt": "fastapi>=0.110\nuvicorn>=0.25\n",
    "backend/app.py": 'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/health")\nasync def health():\n    return {"ok": True}\n',
    "app/page.tsx": 'export default function HomePage() { return <main>Hello</main>; }\n'
  }, async (root) => {
    const analysis = await analyzeRepository(root, repository);
    assert.deepEqual(analysis.frameworks, ["FastAPI", "Next.js"]);
    assert.equal(analysis.framework, "FastAPI");
    assert.ok(analysis.apiEndpoints.some((endpoint) =>
      endpoint.framework === "FastAPI" && endpoint.path === "/health"
    ));
    assert.ok(analysis.components.some((component) =>
      component.framework === "Next.js" && component.name === "HomePage"
    ));
  });
});

test("returns an empty framework list when no supported framework is detected", async () => {
  await withProject({
    "README.md": "A plain repository",
    "main.py": "print('hello')\n"
  }, async (root) => {
    const analysis = await analyzeRepository(root, repository);
    assert.deepEqual(analysis.frameworks, []);
    assert.equal(analysis.framework, null);
  });
});

test("detects frameworks from configuration files when manifests are missing", async () => {
  await withProject({
    "manage.py": "import os\\n",
    "web/angular.json": "{ }\\n",
    "frontend/svelte.config.js": "export default {};\\n",
    "site/astro.config.mjs": "export default {};\\n"
  }, async (root) => {
    const analysis = await analyzeRepository(root, repository);
    assert.deepEqual(analysis.frameworks, ["Django", "Angular", "Svelte", "Astro"]);
  });
});

test("detects Django from separate settings and URL configuration files", async () => {
  await withProject({
    "project/settings.py": "SECRET_KEY = 'test'\\n",
    "project/urls.py": "urlpatterns = []\\n"
  }, async (root) => {
    const analysis = await analyzeRepository(root, repository);
    assert.deepEqual(analysis.frameworks, ["Django"]);
  });
});
