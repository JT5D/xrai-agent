# XRAI Agent v0.3.4

Small, transparent recursive AI agent with **evidence-gated skill evolution** and a zero-install browser execution lane.

Live app:

```text
https://jt5d.github.io/xrai-agent/
```

Source:

```text
https://github.com/JT5D/xrai-agent
```

## What works out of the box

On compatible desktop Chromium browsers, XRAI can handle public Node/JS/TS repo tasks without a local install or user-supplied model/API key:

```text
inspect repo, fix failing tests, verify, & explain
```

If no repo is named, XRAI defaults to `JT5D/xrai-agent`.

The public browser lane:

1. resolves the public GitHub repo
2. pins the run to an exact commit SHA
3. imports bounded source + package metadata + lockfiles
4. boots a fresh isolated WebContainer
5. installs dependencies
6. runs the repo's real `test`, `check`, `lint`, or `build` scripts
7. uses actual exit codes as evidence
8. if verification fails, gives the on-device fixer only the failing output plus error-directed file context
9. applies bounded exact-match edits inside the disposable sandbox
10. re-runs verification
11. reports the verified result and exposes a downloadable patch preview
12. tears down the sandbox so later runs start clean

Commands have hard timeouts, and XRAI never claims success unless the verification commands actually pass.

Anonymous browser mode does **not** push changes back to GitHub. Private repos, write-back, non-Node/native toolchains, very large repos, and unsupported browsers need a separate authorized/hosted execution lane rather than being simulated.

## Why this architecture

For the current public/open-source product, browser execution is the simplest path that satisfies the core experience:

```text
one URL -> one prompt -> real repo -> real tests -> bounded fix -> real verification
```

No VM provisioning, no user API key, no local daemon, and no extra orchestration framework.

The browser execution dependency is isolated in:

```text
web/browser-workspace.js
```

so a hosted sandbox can be added later without changing the XRAI learning kernel.

## Evidence-gated learning

XRAI does not promote a reusable skill because a model says it is useful.

```text
task
  -> retrieve promoted skills only
  -> execute
  -> verify/evaluate
  -> candidate skill
  -> evidence gate
  -> promote / keep candidate / reject
  -> measure future utility
  -> slow meta-maintenance + rollback
```

Server/CLI skills can be promoted immediately by a safe concrete verifier. Browser-chat skills need repeated successful support from distinct task fingerprints. Candidate and rejected skills are excluded from normal retrieval.

## Persistence

Browser state is bounded and durable across refresh/page eviction:

```text
xrai-ui-v4
xrai-skills-v2
xrai-meta-v2
xrai-runs-v2
```

Tasks, visible events, results, and patch metadata survive reload. A browser-only run that is interrupted mid-generation restarts safely from the recovered task; server-backed runs can reattach by run ID.

## Browser runtime

Repo execution uses WebContainer API with cross-origin isolation supplied by the same-origin service worker on GitHub Pages.

Ordinary no-key chat tries Chrome built-in AI first, then falls back to an on-device Transformers.js model:

```text
desktop/capable:    onnx-community/LFM2.5-350M-ONNX
mobile/constrained: onnx-community/SmolLM2-135M-Instruct-ONNX-MHA
```

Current repo execution target is desktop Chromium. WebContainers have broader beta browser support, but XRAI intentionally keeps the public repair lane on the most reliable path until evidence justifies widening it.

WebContainer API is used here for the open-source/prototype execution lane. Review StackBlitz licensing before a commercial hosted deployment.

## Optional local / host-model modes

### Local Ollama

```bash
ollama pull qwen3:0.6b
node src/cli.js chat
```

### Local web execution host

```bash
node src/cli.js web
```

Default:

```text
http://127.0.0.1:8787
```

### Claude Code MCP

```bash
claude mcp add --transport stdio --scope project xrai -- node "$PWD/src/cli.js" mcp
claude mcp get xrai
```

### Optional hosted OpenAI mode

```bash
export OPENAI_API_KEY="..."
export XRAI_MODEL=gpt-5.6-luna
node src/cli.js chat
```

This is optional; the public browser experience does not require the user to provide an OpenAI key.

## MCP tools

- `xrai_run`
- `xrai_shell`
- `xrai_knowledge`
- `xrai_skills`

Do not expose `xrai_shell` as a public unauthenticated endpoint.

## CLI

```bash
node src/cli.js chat
node src/cli.js run "task"
node src/cli.js web
node src/cli.js mcp
node src/cli.js skills
node src/cli.js sync
```

## Development

```bash
git clone https://github.com/JT5D/xrai-agent.git
cd xrai-agent
npm run check
```

`npm run check` performs syntax checks plus the deterministic test suite. Network/model calls are not required by the tests.

Current deterministic coverage includes:

- public repo parsing/defaulting
- browser compatibility gating
- repo file prioritization and lockfile retention
- error-directed failure context
- patch evidence output
- knowledge ranking
- MCP tool surface
- bounded Ollama detection
- verifier-gated promotion
- repeated-support promotion
- failed-verifier rejection
- sensitive-memory rejection
- verifier allowlist
- slow meta-learning
- rollback
- browser-local model selection
- durable UI state
- background server-run recovery
- integrated zero-install repo execution
- fresh sandbox teardown
- command timeout guard
- patch download surface

## Current boundaries

- Anonymous browser execution reads public repos and changes only the disposable sandbox; it does not push to GitHub.
- Native Node addons and non-Web/WASM toolchains may not run inside WebContainers.
- Very large repositories are rejected rather than partially pretending to load them.
- Browser inference is deliberately small; deterministic test evidence outranks model confidence.
- Trusted kernel/tool boundaries do not autonomously rewrite themselves.

Seed knowledge is synchronized from:

```text
https://github.com/JT5D/xrai/tree/main/knowledge
```

MIT licensed.
