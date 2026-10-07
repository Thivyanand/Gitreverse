import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RepositoryAnalysis } from "./types.js";

export async function writeAnalysis(
  analysis: RepositoryAnalysis,
  outputRoot: string
): Promise<string> {
  await mkdir(outputRoot, { recursive: true });
  const outputFile = path.join(outputRoot, "repository.json");

  const { root: _root, ...serializable } = analysis;

  await writeFile(
    outputFile,
    JSON.stringify(serializable, null, 2) + "\n",
    "utf8"
  );

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
  console.log("");
}
