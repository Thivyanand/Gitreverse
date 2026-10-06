#!/usr/bin/env node

import path from "node:path";
import { Command } from "commander";
import { analyzeRepository } from "./analyzer.js";
import { cloneRepository, parseGitHubUrl } from "./github.js";
import { printAnalysis, writeAnalysis } from "./output.js";

const program = new Command();

program
  .name("gitreverse")
  .description(
    "Reverse-engineer a GitHub repository into an AI-ready project specification."
  )
  .version("0.1.0")
  .argument("<repository>", "GitHub repository URL")
  .option("-o, --output <directory>", "Output directory", ".gitreverse")
  .action(async (repository: string, options: { output: string }) => {
    try {
      const input = parseGitHubUrl(repository);

      console.log(`Analyzing ${input.owner}/${input.repo}...`);
      console.log("Fetching repository...");

      const tempRoot = path.resolve(".gitreverse", "workspace");
      await cloneRepository(input, tempRoot);

      console.log("Scanning repository...");

      const analysis = await analyzeRepository(tempRoot, input);
      printAnalysis(analysis);

      const outputFile = await writeAnalysis(analysis, path.resolve(options.output));
      console.log("✓ Analysis complete");
      console.log(`Output: ${outputFile}`);
    } catch (error) {
      console.error(
        `✗ ${error instanceof Error ? error.message : String(error)}`
      );
      process.exitCode = 1;
    }
  });

await program.parseAsync();
