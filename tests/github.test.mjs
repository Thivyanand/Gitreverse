import test from "node:test";
import assert from "node:assert/strict";
import { parseGitHubUrl } from "../dist/github.js";

test("parses owner/repository shorthand", () => {
  assert.deepEqual(parseGitHubUrl("octocat/hello-world"), {
    owner: "octocat",
    repo: "hello-world",
    url: "https://github.com/octocat/hello-world"
  });
});

test("normalizes HTTPS repository URLs and .git suffixes", () => {
  assert.deepEqual(parseGitHubUrl(" https://github.com/octocat/hello-world.git "), {
    owner: "octocat",
    repo: "hello-world",
    url: "https://github.com/octocat/hello-world"
  });
});

test("rejects empty input", () => {
  assert.throws(() => parseGitHubUrl("  "), /Provide a GitHub repository URL/);
});

test("rejects non-HTTPS URLs", () => {
  assert.throws(() => parseGitHubUrl("http://github.com/octocat/hello-world"), /Only HTTPS URLs/);
});

test("rejects hosts other than github.com", () => {
  assert.throws(() => parseGitHubUrl("https://example.com/octocat/hello-world"), /Only HTTPS URLs/);
});

test("rejects repository sub-pages instead of repository roots", () => {
  assert.throws(() => parseGitHubUrl("octocat/hello-world/tree/main"), /repository root URL/);
});
