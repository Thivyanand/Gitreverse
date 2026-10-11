import test from "node:test";
import assert from "node:assert/strict";
import { buildDependencyGraph } from "../dist/dependency-graph.js";

test("resolves relative imports to known source files", () => {
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
