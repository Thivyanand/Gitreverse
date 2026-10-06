import { mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RepositoryInput } from "./types.js";

const execFileAsync = promisify(execFile);

export function parseGitHubUrl(input: string): RepositoryInput {
  let value = input.trim();

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    value = `https://github.com/${value}`;
  }

  const url = new URL(value);
  if (url.hostname.toLowerCase() !== "github.com") {
    throw new Error("Only github.com repositories are currently supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid GitHub repository URL. Expected https://github.com/owner/repository");
  }

  const [owner, repoWithGit] = parts;
  const repo = repoWithGit.replace(/\.git$/, "");

  if (!owner || !repo) {
    throw new Error("Could not determine GitHub owner and repository.");
  }

  return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}

export async function cloneRepository(
  repository: RepositoryInput,
  destination: string
): Promise<void> {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  await execFileAsync("git", [
    "clone",
    "--depth",
    "1",
    repository.url,
    destination
  ]);
}
