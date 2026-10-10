import path from "node:path";
import { Command } from "commander";
import { analyzeRepository } from "./analyzer.js";
import { cloneRepository, parseGitHubUrl } from "./github.js";
import { printAnalysis, writeAnalysis } from "./output.js";

const program = new Command();

program
  .name("gitreverse")
  .description("Reverse-engineer a GitHub repository into an AI-ready project specification.")
  .version("0.2.0")
  .argument("[repository]", "GitHub repository URL or owner/repository")
  .option("-o, --output <directory>", "Output directory", ".gitreverse")
  .option("--keep-workspace", "Keep the cloned repository after analysis", false)
  .action(async (repository: string | undefined, options: { output: string; keepWorkspace: boolean }) => {
    if (!repository) {
      program.help();
      return;
    }

    try {
      const input = parseGitHubUrl(repository);
      const outputRoot = path.resolve(options.output);
      const tempRoot = path.resolve(outputRoot, "workspace");

      console.log(`Analyzing ${input.owner}/${input.repo}...`);
      console.log("Fetching repository...");

      await cloneRepository(input, tempRoot);

      console.log("Scanning repository...");
      const analysis = await analyzeRepository(tempRoot, input);
      printAnalysis(analysis);

      const outputFile = await writeAnalysis(analysis, outputRoot);
      console.log("✓ Analysis complete");
      console.log(`Output directory: ${outputRoot}`);
      console.log(`JSON report:      ${outputFile}`);

      if (!options.keepWorkspace) {
        const { rm } = await import("node:fs/promises");
        await rm(tempRoot, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });

await program.parseAsync();
