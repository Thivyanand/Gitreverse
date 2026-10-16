import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeCodeFile } from "../dist/code-intelligence.js";

test("extracts imports, exported symbols, and source locations", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitreverse-code-"));
  try {
    await writeFile(
      path.join(root, "sample.ts"),
      'import { readFile as read } from "node:fs";\nexport const answer = 42;\nexport function greet() { return "hi"; }\n',
      "utf8"
    );

    const result = await analyzeCodeFile(root, "sample.ts");
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

test("recognizes side-effect, default, namespace, dynamic, CommonJS, and re-export imports", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gitreverse-imports-"));
  try {
    await writeFile(
      path.join(root, "sample.ts"),
      [
        'import "./polyfills.js";',
        'import React, { useState as use, type Props } from "react";',
        'import * as pathTools from "node:path";',
        'const lazy = import("./lazy.js");',
        'const legacy = require("legacy-package");',
        'export { helper } from "./helpers.js";'
      ].join("\n"),
      "utf8"
    );

    const result = await analyzeCodeFile(root, "sample.ts");
    assert.ok(result);
    const bySource = new Map(result.imports.map((item) => [item.source, item]));

    assert.deepEqual(bySource.get("./polyfills.js")?.names, []);
    assert.equal(bySource.get("./polyfills.js")?.isRelative, true);
    assert.deepEqual(bySource.get("react")?.names, ["React", "useState", "Props"]);
    assert.deepEqual(bySource.get("node:path")?.names, ["pathTools"]);
    assert.deepEqual(bySource.get("./lazy.js")?.names, []);
    assert.deepEqual(bySource.get("legacy-package")?.names, []);
    assert.ok(bySource.has("./helpers.js"));
    assert.equal(bySource.get("./helpers.js")?.isRelative, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("skips unsupported file extensions", async () => {
  const result = await analyzeCodeFile("/does/not/matter", "README.md");
  assert.equal(result, null);
});
