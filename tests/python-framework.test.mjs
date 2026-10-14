import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeRepository } from "../dist/analyzer.js";

async function withProject(files, callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitreverse-python-"));
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
  repo: "python-sample",
  url: "https://github.com/test/python-sample"
};

test("detects FastAPI from requirements.txt and discovers its route", async () => {
  await withProject({
    "requirements.txt": "fastapi[standard]>=0.110\nuvicorn>=0.25\n# flask is only a comment\n",
    "app.py": 'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/health")\nasync def health():\n    return {"ok": True}\n'
  }, async (root) => {
    const analysis = await analyzeRepository(root, repository);
    assert.equal(analysis.framework, "FastAPI");
    assert.equal(analysis.packageManager, "pip");
    assert.ok(analysis.dependencies.includes("fastapi"));
    assert.ok(analysis.dependencies.includes("uvicorn"));
    assert.deepEqual(
      analysis.apiEndpoints.map(({ method, path }) => ({ method, path })),
      [{ method: "GET", path: "/health" }]
    );
  });
});

test("detects Flask from PEP 621 pyproject dependencies", async () => {
  await withProject({
    "pyproject.toml": '[project]\nname = "flask-sample"\nversion = "0.1.0"\ndependencies = [\n  "Flask>=3.0",\n  "requests>=2.0"\n]\n',
    "app.py": 'from flask import Flask\napp = Flask(__name__)\n@app.route("/status")\ndef status():\n    return "ok"\n'
  }, async (root) => {
    const analysis = await analyzeRepository(root, repository);
    assert.equal(analysis.framework, "Flask");
    assert.equal(analysis.packageManager, "pip");
    assert.ok(analysis.dependencies.includes("flask"));
    assert.ok(analysis.dependencies.includes("requests"));
    assert.ok(analysis.apiEndpoints.some((endpoint) => endpoint.path === "/status"));
  });
});

test("detects Django from Poetry dependency declarations", async () => {
  await withProject({
    "pyproject.toml": '[tool.poetry]\nname = "django-sample"\nversion = "0.1.0"\n[tool.poetry.dependencies]\npython = "^3.12"\nDjango = "^5.0"\nrequests = "^2.0"\n',
    "manage.py": "import django\n"
  }, async (root) => {
    const analysis = await analyzeRepository(root, repository);
    assert.equal(analysis.framework, "Django");
    assert.equal(analysis.packageManager, "poetry");
    assert.ok(analysis.dependencies.includes("django"));
    assert.ok(analysis.dependencies.includes("requests"));
  });
});
