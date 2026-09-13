# XRAI Agent v0.3.47

Small, transparent recursive AI agent with **grounded runtime capabilities**, **no-key web research**, zero-install browser repo execution, and evidence-gated skill evolution.

Live app:

```text
https://jt5d.github.io/xrai-agent/
```

Source:

```text
https://github.com/JT5D/xrai-agent
```

## Core principle

XRAI should **act when the runtime can act, and say exactly what happened**. It should not answer capability-changing requests by inventing architecture, vendors, credentials, or verification it did not execute.

## What works out of the box

No user API key or local install is required for the public browser experience.

### Grounded capabilities

Capability questions are answered from a deterministic runtime catalog rather than model speculation. Current capabilities include:

- on-device chat/reasoning
- no-key live web research with multiple independent public-source fallbacks
- XRAI knowledge + promoted skills retrieval
- public Node/JS/TS repo inspection and execution in an isolated WebContainer on supported modern browsers (mobile beta; device memory limits apply)
- real test/check/lint/build verification using process exit codes
- bounded sandbox repair + re-verification + downloadable patch
- visible orchestration/events
- evidence-gated skill learning and rollback
- durable browser recovery
- MCP, CLI, local Ollama, and optional hosted model modes

### Web research

XRAI now has a built-in browser web-research tool. It does **not** require SerpAPI, Redis, Python, a local service, or a user API key.

The browser tool queries several independent no-key sources in parallel and deduplicates results. Current providers include Jina Search when browser-accessible, DuckDuckGo Instant Answers, Wikipedia, Hacker News search, and GitHub repository search. Individual providers may rate-limit or reject browser requests; XRAI degrades gracefully instead of failing the whole run.

Example:

```text
search the web for the latest agent orchestration tools
```

Fresh/current research requests are routed to this tool before local-model synthesis. Results include source URLs and provider evidence.

### Zero-install public repo execution

On supported modern browsers, including recent iOS/iPadOS Safari and Android browsers in beta:

```text
review repo, fix failed tests, verify & explain
```

If no repository is named, XRAI defaults to `JT5D/xrai-agent`.

The browser execution lane:

1. resolves the public repository
2. pins the run to an exact commit
3. imports bounded source, package metadata, and lockfiles
4. boots a fresh WebContainer
5. installs dependencies
6. runs real verification commands
7. trusts exit codes over model confidence
8. applies bounded edits only when needed
9. re-runs verification
10. reports evidence and exposes a patch
11. tears down the disposable sandbox

## Evaluator isolation

Planner, worker, synthesizer, and evaluator instructions must never contaminate one another.

Chrome built-in AI sessions are therefore isolated per role call. A final output-shape guard also suppresses evaluator-shaped JSON such as `score`, `critique`, `work_product`, and internal skill objects before they can appear as a user answer.

The evaluator remains internal evidence for learning; it is not the product response.

## Evidence-gated learning

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

A model cannot promote a reusable skill merely by claiming it is useful.

## Reliability strategy

Every release should prefer the smallest reliable verification loop:

```text
source change
  -> deterministic source CI
  -> deploy
  -> real Chromium against production
  -> console/network/screenshots + exact user flow
```

Production repo fetching uses multiple fallbacks where practical so anonymous rate limits from one provider do not take down the public path. Paid infrastructure should not become a requirement unless evidence shows it is necessary.

## Optional modes

### Local Ollama

```bash
ollama pull qwen3:0.6b
node src/cli.js chat
```

### Local web execution host

```bash
node src/cli.js web
```

### Claude Code MCP

```bash
claude mcp add --transport stdio --scope project xrai -- node "$PWD/src/cli.js" mcp
claude mcp get xrai
```

### Optional hosted OpenAI model

```bash
export OPENAI_API_KEY="..."
node src/cli.js chat
```

The hosted key is optional; the public browser experience does not require it.

## Development

```bash
git clone https://github.com/JT5D/xrai-agent.git
cd xrai-agent
npm run check
```

The deterministic suite covers repo execution, fallback fetching, state recovery, skills, MCP, server recovery, grounded capability routing, real no-key web-search execution with mocked providers, and regression protection against evaluator JSON leakage.

## Boundaries

- Anonymous browser mode does not push changes back to GitHub.
- Private repositories require an authorized execution lane.
- WebContainer execution is intentionally focused on compatible web/Node toolchains.
- No-key web research depends on public providers; results are source-linked and partial provider failure is expected.
- Trusted kernel/tool boundaries do not autonomously rewrite themselves.
- Browser inference is deliberately small; deterministic external evidence outranks model confidence.

Seed knowledge is synchronized from:

```text
https://github.com/JT5D/xrai/tree/main/knowledge
```

MIT licensed.
