import { mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RepositoryInput } from "./types.js";

const execFileAsync = promisify(execFile);

export function parseGitHubUrl(input: string): RepositoryInput {
  const value = input.trim();
  if (!value) throw new Error("Provide a GitHub repository URL or owner/repository.");

  const candidate = value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://github.com/${value}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Invalid repository URL. Expected https://github.com/owner/repository");
  }

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw new Error("Only HTTPS URLs hosted on github.com are currently supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error("Expected a repository root URL: https://github.com/owner/repository");
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("The repository owner or name contains unsupported characters.");
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
    "--",
    repository.url,
    destination
  ], { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });
}
