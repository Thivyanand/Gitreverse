# GitReverse

> Reverse-engineer GitHub repositories into AI-ready architecture, specifications, and reconstruction prompts.

GitReverse statically analyzes a public GitHub repository and generates structured Markdown reports plus a machine-readable JSON analysis. The reports help developers and AI coding agents plan an independent, clean-room implementation.

## Current capabilities

- Clone a public GitHub repository from a URL or `owner/repository` shorthand
- Inventory files, directories, languages, dependencies, frameworks, and package manager
- Extract TypeScript/JavaScript symbols, imports, and exports
- Build a relative-import dependency graph and architecture indicators
- Detect likely API routes, database technology signals, and React/Next.js UI components
- Generate five Markdown reports and a JSON analysis file

## Generated reports

By default, output is written to `.gitreverse/`.

| File | Contents |
|---|---|
| `repository.json` | Machine-readable repository analysis |
| `architecture.md` | Entry points, module relationships, and graph metrics |
| `api-spec.md` | Statically detected API endpoints |
| `database-schema.md` | Database technology evidence and limitations |
| `project-spec.md` | Combined project profile and reconstruction requirements |
| `reconstruction-prompt.md` | Prompt for an AI coding agent to implement equivalent behavior |

## Requirements

- Node.js 20+
- Git
- npm

## Install and run

```bash
npm install
npm run dev -- https://github.com/owner/repository
```

Or use shorthand:

```bash
npm run dev -- owner/repository
```

Choose a different output directory:

```bash
npm run dev -- owner/repository --output ./analysis-output
```

Build and run the compiled CLI:

```bash
npm run build
node dist/cli.js owner/repository
```

## How to interpret results

The analyzer uses static heuristics, not execution or a full language-specific AST for every supported language. API routes, framework identification, database signals, and component detection may be incomplete or incorrect. Review source code, tests, migrations, and documentation before treating reports as authoritative.

## Principles

GitReverse is intended for analysis, documentation, interoperability, and clean-room reconstruction. Respect each repository's license and do not reproduce proprietary source code or secrets verbatim.
