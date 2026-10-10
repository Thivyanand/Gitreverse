import type { RepositoryAnalysis } from "./types.js";

function bulletList(items: string[], empty = "None detected."): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`;
}

export function generateArchitectureMarkdown(analysis: RepositoryAnalysis): string {
  const { architecture, dependencyGraph } = analysis;
  return `# Architecture Overview

## Repository
- **Project:** ${analysis.repository.owner}/${analysis.repository.repo}
- **Primary framework:** ${analysis.framework ?? "Not detected"}
- **Languages:** ${Object.keys(analysis.languages).join(", ") || "Not detected"}
- **Files analyzed:** ${analysis.fileCount}

## Likely entry points
${bulletList(architecture.entryPoints)}

## Most imported modules
${bulletList(architecture.mostImported.map((item) => `${item.file} — imported by ${item.incomingEdges} file(s)`))}

## Dependency graph
- Nodes: ${dependencyGraph.nodes.length}
- Relative import edges: ${dependencyGraph.edges.length}
- Unresolved relative imports: ${dependencyGraph.edges.filter((edge) => !edge.resolved).length}

${bulletList(dependencyGraph.edges.map((edge) => `${edge.from} → ${edge.to}`), "No relative imports detected.")}

## Isolated files
${bulletList(architecture.isolatedFiles)}

## Notes
This report is generated using static heuristics. Confirm inferred entry points and module relationships before relying on them for production changes.
`;
}

export function generateApiMarkdown(analysis: RepositoryAnalysis): string {
  const rows = analysis.apiEndpoints.map((endpoint) =>
    `| ${endpoint.method} | ${endpoint.path} | ${endpoint.file} | ${endpoint.line} | ${endpoint.framework} |`
  );
  return `# API Specification

Detected endpoints: **${analysis.apiEndpoints.length}**

| Method | Route | Source file | Line | Detection |
|---|---|---|---:|---|
${rows.length ? rows.join("\n") : "| — | No endpoints detected | — | — | Static scan |"}

## Limitations
This is heuristic detection, not a runtime route inventory. Dynamic routes, middleware prefixes, decorators, and framework conventions may not be fully resolved.
`;
}

export function generateDatabaseMarkdown(analysis: RepositoryAnalysis): string {
  const sections = analysis.databaseSignals.map((signal) =>
    `### ${signal.technology}\n\nEvidence:\n${bulletList(signal.evidence)}`
  );
  return `# Database Signals

Detected signals: **${analysis.databaseSignals.length}**

${sections.length ? sections.join("\n\n") : "No known database dependencies or database-related directories were detected."}

## Important
These are indicators from dependency names and file paths, not a verified schema. Review migrations, ORM models, and configuration to confirm tables, relationships, and persistence behavior.
`;
}

export function generateProjectSpecMarkdown(analysis: RepositoryAnalysis): string {
  const symbols = analysis.codeFiles.flatMap((file) => file.symbols);
  const components = analysis.components.map((component) => `${component.name} — ${component.file}`);
  return `# Project Specification

## Summary
${analysis.repository.owner}/${analysis.repository.repo} is a repository analyzed by GitReverse. The scan found ${analysis.fileCount} files and ${analysis.codeFiles.length} TypeScript/JavaScript source files suitable for detailed symbol analysis.

## Technology profile
- **Framework:** ${analysis.framework ?? "Not detected"}
- **Package manager:** ${analysis.packageManager ?? "Not detected"}
- **Languages:** ${Object.entries(analysis.languages).sort((a, b) => b[1] - a[1]).map(([language, count]) => `${language}: ${count} files`).join(", ") || "Not detected"}
- **Dependencies:** ${analysis.dependencies.length}

## Architecture indicators
- Entry points: ${analysis.architecture.entryPoints.length}
- Relative import edges: ${analysis.dependencyGraph.edges.length}
- Detected API endpoints: ${analysis.apiEndpoints.length}
- Database signals: ${analysis.databaseSignals.length}
- UI components: ${analysis.components.length}
- Extracted symbols: ${symbols.length}

## Entry points
${bulletList(analysis.architecture.entryPoints)}

## API surface
${bulletList(analysis.apiEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path} (${endpoint.file}:${endpoint.line})`))}

## Database technologies
${bulletList(analysis.databaseSignals.map((signal) => signal.technology))}

## UI components
${bulletList(components)}

## Key dependencies
${bulletList(analysis.dependencies.slice(0, 60))}

## Reconstruction requirements
1. Recreate the detected framework and package-manager setup.
2. Implement the entry points and internal module relationships listed in the architecture report.
3. Reproduce the detected API surface, validating route behavior from source where possible.
4. Confirm persistence requirements from actual schemas and migrations; detected database signals alone are insufficient.
5. Recreate UI components and their interactions based on source inspection and tests.
6. Add automated tests for important user flows and API behavior.
7. Document environment variables and setup instructions after inspecting configuration files.

## Confidence and limitations
This specification is generated from static repository signals. It does not prove runtime behavior, complete schemas, secrets/configuration, or all dynamic routes. Validate findings against source code, tests, and project documentation before implementation.
`;
}

export function generateReconstructionPrompt(analysis: RepositoryAnalysis): string {
  return `# Reconstruction Prompt

You are an experienced software engineer. Build a clean-room implementation of the project described below. Use this document as a starting specification, not as permission to copy source code verbatim.

## Target
- Repository: ${analysis.repository.owner}/${analysis.repository.repo}
- Framework: ${analysis.framework ?? "Determine from evidence"}
- Languages: ${Object.keys(analysis.languages).join(", ") || "Determine from evidence"}
- Dependencies detected: ${analysis.dependencies.join(", ") || "None detected"}

## Architecture
Likely entry points:
${analysis.architecture.entryPoints.map((entry) => `- ${entry}`).join("\n") || "- None detected"}

Most imported modules:
${analysis.architecture.mostImported.map((item) => `- ${item.file} (${item.incomingEdges} incoming imports)`).join("\n") || "- None detected"}

## API surface
${analysis.apiEndpoints.map((endpoint) => `- ${endpoint.method} ${endpoint.path} — source ${endpoint.file}:${endpoint.line}`).join("\n") || "- No API endpoints detected; inspect the source manually."}

## Database evidence
${analysis.databaseSignals.map((signal) => `- ${signal.technology}: ${signal.evidence.join(", ")}`).join("\n") || "- No database signals detected; verify manually."}

## Implementation instructions
1. Inspect the original project's license and follow its requirements.
2. Implement equivalent functionality independently; do not copy proprietary source code or secrets.
3. Preserve the observable behavior, API contracts, and user workflows supported by the evidence.
4. Use clear module boundaries that reflect the architecture indicators.
5. Add tests for core behavior and error cases.
6. Include environment-variable documentation using placeholders only; never invent or expose secret values.
7. Explain assumptions and unresolved questions rather than silently guessing.
8. Run the project's build and test commands and report the actual results.

## Evidence caveat
GitReverse uses static heuristics. Verify routes, database schemas, component behavior, and entry points against source code, tests, and documentation before treating them as authoritative.
`;
}
