import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RepositoryAnalysis } from "./types.js";
import {
  generateApiMarkdown,
  generateArchitectureMarkdown,
  generateDatabaseMarkdown,
  generateProjectSpecMarkdown,
  generateReconstructionPrompt
} from "./specification.js";

export async function writeAnalysis(
  analysis: RepositoryAnalysis,
  outputRoot: string
): Promise<string> {
  await mkdir(outputRoot, { recursive: true });
  const { root: _root, ...serializable } = analysis;
  const outputFile = path.join(outputRoot, "repository.json");

  await writeFile(outputFile, JSON.stringify(serializable, null, 2) + "\n", "utf8");
  const reports: Array<[string, string]> = [
    ["architecture.md", generateArchitectureMarkdown(analysis)],
    ["api-spec.md", generateApiMarkdown(analysis)],
    ["database-schema.md", generateDatabaseMarkdown(analysis)],
    ["project-spec.md", generateProjectSpecMarkdown(analysis)],
    ["reconstruction-prompt.md", generateReconstructionPrompt(analysis)]
  ];

  for (const [fileName, content] of reports) {
    await writeFile(path.join(outputRoot, fileName), content, "utf8");
  }

  return outputFile;
}

export function printAnalysis(analysis: RepositoryAnalysis): void {
  const languages = Object.entries(analysis.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} (${count})`)
    .join(", ") || "None detected";

  console.log("");
  console.log("GitReverse Analysis");
  console.log("───────────────────");
  console.log(`Repository:      ${analysis.repository.owner}/${analysis.repository.repo}`);
  console.log(`Files:           ${analysis.fileCount}`);
  console.log(`Languages:       ${languages}`);
  console.log(`Framework:       ${analysis.framework ?? "Not detected"}`);
  console.log(`Package manager: ${analysis.packageManager ?? "Not detected"}`);
  console.log(`Dependencies:    ${analysis.dependencies.length}`);
  console.log(`Code files:      ${analysis.codeFiles.length}`);
  console.log(`Symbols:         ${analysis.codeFiles.reduce((total, file) => total + file.symbols.length, 0)}`);
  console.log(`Imports:         ${analysis.codeFiles.reduce((total, file) => total + file.imports.length, 0)}`);
  console.log(`Exports:         ${analysis.codeFiles.reduce((total, file) => total + file.exports.length, 0)}`);
  console.log(`Graph nodes:     ${analysis.dependencyGraph.nodes.length}`);
  console.log(`Graph edges:     ${analysis.dependencyGraph.edges.length}`);
  console.log(`Entry points:    ${analysis.architecture.entryPoints.length}`);
  console.log(`Architecture components: ${analysis.architecture.connectedComponents.length}`);
  console.log(`API endpoints:   ${analysis.apiEndpoints.length}`);
  console.log(`DB signals:      ${analysis.databaseSignals.length}`);
  console.log(`UI components:   ${analysis.components.length}`);
  console.log("");
  console.log("Generated reports:");
  console.log("  architecture.md");
  console.log("  api-spec.md");
  console.log("  database-schema.md");
  console.log("  project-spec.md");
  console.log("  reconstruction-prompt.md");
  console.log("");
}
