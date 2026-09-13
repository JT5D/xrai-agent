# XRAI Agent v0.3.0

A deliberately small recursive AI agent with **evidence-gated learning** and a **zero-install public-repository execution lane**.

Live app: https://jt5d.github.io/xrai-agent/

Source: https://github.com/JT5D/xrai-agent

## What works out of the box

On a compatible desktop Chromium browser, open the public app and enter a task such as:

```text
inspect repo, fix failing tests, verify, & explain
```

If no repository is named, XRAI uses `JT5D/xrai-agent`. You can also include a public GitHub URL or `owner/repo`.

For public Node/JS/TS repositories XRAI can, without a local installation or user-supplied model/API key:

1. inspect the public GitHub repository,
2. import source files into an isolated browser WebContainer,
3. install project dependencies,
4. run the repository's real test/check/lint/build commands,
5. use an on-device model to propose bounded exact-match edits when verification fails,
6. apply edits only inside the disposable browser workspace,
7. re-run verification,
8. report success/failure from actual process exit codes.

The browser run and visible UI state are persisted so a reload does not silently erase the task or result.

## Why this architecture

XRAI keeps the trusted kernel small. It does not add LangChain/LangGraph, Redis, a vector database, a graph database, or a separate swarm service unless measurement proves one is needed.

```text
User task
   |
   v
XRAI capability router
   |-----------------------------|
   |                             |
normal chat                 public repo task
   |                             |
on-device model             GitHub public source
   |                             |
XRAI knowledge              WebContainer sandbox
                                 |
                         install + real tests
                                 |
                         pass -------- fail
                          |              |
                       evidence      local model
                          |          bounded edits
                          |              |
                          |         re-run tests
                          |______________|
                                 |
                          evidence gate
```

GitHub Pages cannot set the COOP/COEP response headers normally required by WebContainers, so the public build uses a small same-origin service worker to establish cross-origin isolation and boots WebContainers in `credentialless` mode.

## Evidence-gated learning

XRAI does not treat model confidence as proof.

Its durable learning lifecycle is:

```text
task -> retrieve promoted skills -> execute -> verify -> candidate skill
     -> replay/evidence gate -> promote/reject -> measure future utility
     -> periodic consolidation/rollback
```

Rules include:

- scores below `0.82` cannot learn,
- safe deterministic verifiers outrank model judgment,
- unverified skills require repeated distinct successful support,
- candidate/rejected skills never enter normal retrieval,
- underperforming promoted versions can roll back,
- sensitive/credential-shaped memory is rejected,
- trusted kernel code is not autonomously rewritten.

## Browser execution boundaries

The zero-install lane intentionally starts narrow:

- **works:** public Node/JavaScript/TypeScript repositories with `package.json` on compatible desktop Chromium browsers,
- **does not access:** your computer's local filesystem,
- **not yet in this lane:** private repositories, durable GitHub write-back/PR creation, very large repositories, mobile browsers, and arbitrary non-Node toolchains.

Those unsupported cases are reported explicitly rather than simulated.

WebContainer API is isolated behind `web/browser-workspace.js`, so a hosted sandbox can be added later without changing the XRAI kernel. Commercial production use of WebContainer API may require the applicable StackBlitz licensing/configuration.

## Local/host-model modes

The browser lane is not the only runtime. XRAI also retains its existing CLI, local server, Ollama, OpenAI, Claude Code MCP, and ChatGPT MCP paths.

No hosted model key is required with Ollama:

```bash
ollama pull qwen3:0.6b
node src/cli.js web
```

Open:

```text
http://127.0.0.1:8787
```

Claude Code can use XRAI as an MCP tool host:

```bash
claude mcp add --transport stdio --scope project xrai -- node "$PWD/src/cli.js" mcp
claude mcp get xrai
```

An OpenAI key remains optional for stronger hosted autonomous runs:

```bash
export OPENAI_API_KEY="..."
export XRAI_MODEL=gpt-5.6-luna
node src/cli.js chat
```

## MCP tools

v0.3 exposes:

- `xrai_run` — recursive execution with evidence-gated learning,
- `xrai_shell` — workspace-rooted shell,
- `xrai_knowledge` — base knowledge plus promoted skills,
- `xrai_skills` — skill and meta-policy inspection.

Do not expose `xrai_shell` as an unauthenticated public endpoint.

## Quick start

```bash
git clone https://github.com/JT5D/xrai-agent.git
cd xrai-agent
npm run check
node src/cli.js web
```

Runtime npm dependencies remain zero for the Node/CLI core. The public browser dynamically loads its optional browser model/runtime dependencies only when those capabilities are used.

## Tests

```bash
npm run check
```

The deterministic suite covers the recursive skill lifecycle, fail-closed browser evaluation, sensitive-memory rejection, promotion/rollback rules, MCP surface, reload recovery, background server runs, mobile model selection, public-repo parsing/routing, WebContainer integration, static-host isolation bootstrap, and the redesigned workspace UI.

Network/model calls are not required for the deterministic suite.

## Knowledge source

Seed knowledge is synchronized from:

```text
https://github.com/JT5D/xrai/tree/main/knowledge
```

Refresh it with:

```bash
node src/cli.js sync
```

MIT licensed.
