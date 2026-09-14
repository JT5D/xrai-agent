# XRAI Agent v0.3.51

Small, transparent AI agent with **grounded runtime capabilities**, **no-key web research**, zero-install browser repo execution, and transfer-gated reusable skill memory on supported host paths.

Live app:

```text
https://jt5d.github.io/xrai-agent/
```

Source:

```text
https://github.com/JT5D/xrai-agent
```

## Core principle

XRAI should **act when the runtime can act, and say exactly what happened**. It should not answer capability-changing requests by inventing architecture, vendors, credentials, execution, learning, deployment, or verification it did not actually perform.

## What works out of the box

No user API key or local install is required for the public browser experience.

### Grounded capabilities

Capability questions are answered from a deterministic runtime catalog rather than model speculation. Current capabilities include:

- on-device browser chat/reasoning
- no-key live web research with multiple independent public-source fallbacks
- XRAI knowledge retrieval plus retrieval of transfer-verified skills when available
- public Node/JS/TS repo inspection and execution in an isolated WebContainer on supported modern browsers (mobile beta; device memory limits apply)
- real test/check/lint/build verification using process exit codes
- bounded sandbox repair + re-verification + downloadable patch
- visible execution/provenance events
- host-side skill candidate quarantine, transfer-gated promotion, and rollback
- durable browser UI/task recovery across reloads
- MCP, CLI, local Ollama, and optional hosted model modes

These pieces do not yet prove one complete shared agent loop across every interface. See `SPEC.md` and `docs/HANDOFF.md` for the acceptance status and remaining evidence gaps.

### Web research

XRAI has a built-in browser web-research tool. It does **not** require SerpAPI, Redis, Python, a local service, or a user API key.

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

A verified browser sandbox patch is execution evidence. It is **not** automatically retained learning, a Git commit, or a deployment.

## Browser conversation

Ordinary browser conversation uses bounded conversation context plus relevant XRAI knowledge and eligible transfer-verified skills, then performs one model answer turn. It does not run a default planner/worker/evaluator swarm and it does not promote learning from a model self-score.

A final output-shape guard suppresses evaluator-shaped JSON such as `score`, `critique`, `work_product`, and internal skill objects before they can appear as a user answer. Previous assistant text and retrieved knowledge are context, not execution proof.

## Evidence-gated learning

Host-side reusable learning follows this contract:

```text
real source task
  -> objective source verifier
  -> quarantined candidate
  -> different related task
  -> no-skill baseline
  -> candidate reuse
  -> objective verifier
  -> measured improvement over baseline
  -> promote or reject
  -> later verified usage
  -> rollback if verified performance regresses
```

A model score, repeated proposal, passing source task, or sandbox repair alone cannot promote a reusable skill. Legacy promotions without held-out transfer evidence are quarantined from retrieval.

## Reliability strategy

Every release should prefer the smallest reliable verification loop:

```text
source change
  -> deterministic source CI
  -> model/runtime qualification when behavior depends on inference
  -> deploy
  -> real browser against production
  -> console/network/screenshots + exact user flow
```

Production repo fetching uses multiple fallbacks where practical so anonymous rate limits from one provider do not take down the public path. Paid infrastructure should not become a requirement unless evidence shows it is necessary and the tradeoff is explicit.

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

The deterministic suite covers repo execution primitives, fallback fetching, state recovery, transfer-gated skill semantics, MCP, server recovery, grounded capability routing, browser/server transport, no-key web-search execution with controlled providers, and regression protection against evaluator JSON leakage and evidence-category mistakes.

## Boundaries

- Anonymous browser mode does not push changes back to GitHub.
- Private repositories require an authorized execution lane.
- WebContainer execution is intentionally focused on compatible web/Node toolchains.
- No-key web research depends on public providers; results are source-linked and partial provider failure is expected.
- Browser conversation does not promote new reusable skills.
- The local host shell runs host processes rooted at the workspace; it is not an OS-level security sandbox and must not be exposed as an anonymous remote executor.
- Browser inference is deliberately small and not a substitute for model qualification; deterministic external evidence outranks model confidence.
- Responsive/mobile-width Chromium testing is not physical iPhone/Safari verification.
- Trusted kernel/tool boundaries do not autonomously rewrite themselves.

Seed knowledge is synchronized from historical XRAI knowledge documents; that does not make the older `JT5D/xrai` repository the implementation target for this project.

MIT licensed.

## Runtime status evidence

Ask "are we fixed & working now?" to inspect recorded command receipts and live deployment checks for the exact build. This read-only tool does not call a language model, run tests, or invent repairs. Failed, cancelled, missing, or stale checks remain unverified. Status questions preserve the prior task.