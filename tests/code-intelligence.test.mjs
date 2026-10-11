import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeCodeFile } from "../dist/code-intelligence.js";

test("extracts imports, exported symbols, and source locations", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitreverse-code-"));
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(
      path.join(root, "src", "sample.ts"),
      'import { readFile as read } from "node:fs";\nexport const answer = 42;\nexport function greet() { return "hi"; }\n',
      "utf8"
    );

    const result = await analyzeCodeFile(root, "src/sample.ts");
    assert.ok(result);
    assert.equal(result.language, "TypeScript");
    assert.equal(result.imports.length, 1);
    assert.equal(result.imports[0].source, "node:fs");
    assert.deepEqual(result.imports[0].names, ["readFile"]);
    assert.deepEqual(result.exports, ["answer", "greet"]);

    const answer = result.symbols.find((symbol) => symbol.name === "answer");
    const greet = result.symbols.find((symbol) => symbol.name === "greet");
    assert.equal(answer?.kind, "constant");
    assert.equal(answer?.exported, true);
    assert.equal(answer?.line, 2);
    assert.equal(greet?.kind, "function");
    assert.equal(greet?.exported, true);
    assert.equal(greet?.line, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("skips unsupported file extensions", async () => {
  const result = await analyzeCodeFile("/does/not/matter", "README.md");
  assert.equal(result, null);
});
