<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Code standards (mandatory)

Every agent working in this repository or any of its worktrees MUST follow
[docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md). Read it before changing code.
It covers module boundaries, where shared helpers live, the API route shape,
persistence and test rules, and change discipline. Reviews reject changes that
break it. If a task conflicts with it, stop and ask instead of working around it.
