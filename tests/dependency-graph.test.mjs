import test from "node:test";
import assert from "node:assert/strict";
import { buildDependencyGraph } from "../dist/dependency-graph.js";

test("resolves extensionless relative imports to known source files", () => {
  const graph = buildDependencyGraph([
    {
      file: "src/index.ts",
      imports: [{ source: "./utils", file: "src/index.ts", names: [], isRelative: true }]
    },
    { file: "src/utils.ts", imports: [] }
  ]);

  assert.deepEqual(graph.nodes, ["src/index.ts", "src/utils.ts"]);
  assert.equal(graph.edges.length, 1);
  assert.deepEqual(graph.edges[0], {
    from: "src/index.ts",
    to: "src/utils.ts",
    source: "./utils",
    resolved: true
  });
});

test("resolves explicit .js imports to TypeScript source files", () => {
  const graph = buildDependencyGraph([
    {
      file: "src/index.ts",
      imports: [{ source: "./utils.js", file: "src/index.ts", names: [], isRelative: true }]
    },
    { file: "src/utils.ts", imports: [] }
  ]);

  assert.equal(graph.edges[0].to, "src/utils.ts");
  assert.equal(graph.edges[0].resolved, true);
});

test("resolves NodeNext .mjs and .cjs specifiers to .mts and .cts files", () => {
  const graph = buildDependencyGraph([
    {
      file: "src/index.mts",
      imports: [{ source: "./worker.mjs", file: "src/index.mts", names: [], isRelative: true }]
    },
    {
      file: "src/legacy.cjs",
      imports: [{ source: "./compat.cjs", file: "src/legacy.cjs", names: [], isRelative: true }]
    },
    { file: "src/worker.mts", imports: [] },
    { file: "src/compat.cts", imports: [] }
  ]);

  const bySource = new Map(graph.edges.map((edge) => [edge.source, edge]));
  assert.equal(bySource.get("./worker.mjs")?.to, "src/worker.mts");
  assert.equal(bySource.get("./worker.mjs")?.resolved, true);
  assert.equal(bySource.get("./compat.cjs")?.to, "src/compat.cts");
  assert.equal(bySource.get("./compat.cjs")?.resolved, true);
});

test("resolves index files for extensionless imports", () => {
  const graph = buildDependencyGraph([
    {
      file: "src/index.ts",
      imports: [{ source: "./helpers", file: "src/index.ts", names: [], isRelative: true }]
    },
    { file: "src/helpers/index.mts", imports: [] }
  ]);

  assert.equal(graph.edges[0].to, "src/helpers/index.mts");
  assert.equal(graph.edges[0].resolved, true);
});

test("retains unresolved relative imports as unresolved edges", () => {
  const graph = buildDependencyGraph([
    {
      file: "src/index.ts",
      imports: [{ source: "./missing", file: "src/index.ts", names: [], isRelative: true }]
    }
  ]);

  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].resolved, false);
  assert.equal(graph.edges[0].to, "src/missing");
});

test("does not add external packages as local dependency edges", () => {
  const graph = buildDependencyGraph([
    {
      file: "src/index.ts",
      imports: [{ source: "commander", file: "src/index.ts", names: ["Command"], isRelative: false }]
    }
  ]);

  assert.deepEqual(graph.edges, []);
});
