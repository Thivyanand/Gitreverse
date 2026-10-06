# GitReverse

> Reverse-engineer GitHub repositories into AI-ready architecture, specifications, and reconstruction prompts.

GitReverse analyzes a repository and turns its structure and source code into a structured understanding that an AI coding agent can use to plan a clean-room reconstruction.

## Status

🚧 Early development — Day 1

## Goals

- Analyze a local or GitHub repository
- Detect languages, frameworks, dependencies, and project structure
- Build a machine-readable repository model
- Generate architecture and implementation specifications
- Generate AI-ready reconstruction prompts
- Later expose analysis through a CLI, web UI, and MCP server

## Development

Requirements:

- Node.js 20+
- npm

Install dependencies:

```bash
npm install
```

Run the CLI:

```bash
npm run dev -- https://github.com/user/repository
```

Build:

```bash
npm run build
```

## Principles

GitReverse is intended for analysis, documentation, interoperability, and clean-room reconstruction. It should respect repository licenses and avoid reproducing proprietary source code verbatim.
