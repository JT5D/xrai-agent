# XRAI Agent v0.2.1

A deliberately small, transparent recursive AI agent with **evidence-gated skill evolution**.

- zero runtime npm dependencies
- one execution kernel
- local/browser/host-model operation
- versioned reusable skills instead of free-form memory
- fast skill learning + slower evidence-driven meta-learning
- deterministic promotion, rejection, and rollback rules
- observable execution events, never private chain-of-thought

**No model API key is required.** A hosted OpenAI key is optional.

Live no-key browser build:

```text
https://jt5d.github.io/xrai-agent/
```

## What changed in v0.2.1

v0.2.1 keeps the evidence-gated learning architecture and hardens the browser runtime after real mobile testing:

- **durable UI state:** task, messages, events, result, selected view, and run state survive refresh/page eviction
- **recoverable runs:** interrupted browser-local runs restore with an explicit Resume action; local-server runs continue in the background and can reattach by run ID
- **truthful execution boundaries:** the public GitHub Pages build blocks repo/filesystem/test prompts instead of pretending it inspected or changed files
- **mobile-safe inference:** constrained devices use a smaller on-device model, one worker, and no evaluator retry to reduce memory pressure
- **workspace redesign:** visual orchestration, chat, status, activity, skills, runtime, and execution-host choices now live in one responsive interface

The v0.2 learning change remains the core architecture. v0.1 learned by saving one evaluator-written lesson after a high-scoring run; v0.2 replaced that with a stricter lifecycle:

```text
task
  ↓
retrieve promoted skills only
  ↓
execute + verify
  ↓
evaluate
  ↓
propose narrow candidate skill
  ↓
┌──────────────────────────────────────────────┐
│ safe concrete verifier available?            │
│   yes → execute verifier → pass/fail          │
│   no  → require repeated distinct successes   │
└──────────────────────────────────────────────┘
  ↓
promote / keep candidate / reject
  ↓
measure future utility
  ↓
slow meta-maintenance every 10 runs
  ↓
retain / supersede / roll back
```

A model is never allowed to promote a skill merely because it says the skill is good.

## Learning rules

### Fast loop

After each successful run:

1. The evaluator may propose one reusable skill with:
   - title
   - trigger
   - procedure
   - optional verifier command
   - tags
2. Scores below `0.82` cannot learn.
3. If score is at least `0.86` and the verifier is an allowlisted test/check/lint/build command, XRAI executes it.
4. A passing verifier can promote the skill immediately.
5. A failing verifier rejects the candidate.
6. Without executable evidence, a candidate needs successful support from **two distinct task fingerprints** before promotion.
7. Candidate and rejected skills are never returned by normal retrieval.

Browser-only mode cannot execute workspace shell verifiers, so it always uses the repeated-support gate.

### Slow loop

Every 10 completed runs, XRAI evaluates aggregate evidence:

- average run score
- candidate/promotion rate
- failure rate when retrieved skills were used
- utility of promoted skill versions

It updates compact meta-guidance for future skill creation/retrieval. A promoted version with at least five uses and under 40% success is rolled back; a prior proven version is restored when available.

The slow loop changes **learning guidance and skill state**, not trusted kernel code.

## Retrieval

Promoted skills are ranked by a transparent hybrid score:

- task relevance
- confidence
- measured utility
- recency

The Markdown XRAI knowledgebase remains separate. Raw `.xrai/skills.jsonl` history is audit-only and is deliberately excluded from generic knowledge search, preventing unpromoted candidates from leaking back into context.

## Privacy and memory

CLI/server learning is append-only in:

```text
.xrai/skills.jsonl
```

The browser uses localStorage:

```text
xrai-skills-v2
xrai-meta-v2
xrai-runs-v2
xrai-ui-v3
```

`xrai-ui-v3` stores bounded UI/run recovery state so a browser refresh or mobile page eviction does not erase the user's task, messages, visible events, or completed result.

XRAI stores compact skill procedures and hashed task fingerprints, not task outputs. Credential/private-key/email-shaped candidate memory is rejected. Evaluators are also instructed never to put secrets or personal data into skills.

## No-key modes

### Public browser

Open:

```text
https://jt5d.github.io/xrai-agent/
```

The public browser is deliberately a **local chat/knowledge runtime**, not a filesystem execution host. It can chat on-device, retrieve XRAI knowledge, orchestrate browser-local workers, and learn browser skills. It **cannot** read or modify a repository, run shell commands, or execute project tests. Repo/filesystem/test prompts are detected and blocked rather than simulated.

For ordinary browser-local tasks, XRAI tries Chrome built-in AI first. When unavailable it uses Transformers.js with a device-aware fallback:

```text
desktop/capable:    onnx-community/LFM2.5-350M-ONNX
mobile/constrained: onnx-community/SmolLM2-135M-Instruct-ONNX-MHA
```

Capable devices prefer WebGPU; the fallback can use WASM when WebGPU is unavailable. Constrained devices also reduce generation length, clamp to one worker, and disable evaluator retries to reduce memory pressure. The first use may download and cache the selected local model.

### Local CLI with Ollama

```bash
ollama pull qwen3:0.6b
node src/cli.js chat
```

XRAI talks directly to Ollama's local HTTP API and installs no model SDK.

### Local web UI — full repo/filesystem execution

For a no-key browser UI that can actually inspect/edit a local repository and run tests, use a local Ollama model and start XRAI from that repository/workspace:

```bash
ollama pull qwen3:0.6b
node src/cli.js web
```

Open:

```text
http://127.0.0.1:8787
```

The local server is the execution host: it can use the workspace-rooted shell, read/modify files through tool calls, and run project verification commands. Browser disconnects do not cancel active server runs; the UI persists the run ID and reattaches after refresh.

Run state is also available at:

```text
GET /api/runs/:runId
GET /api/runs/latest
```

The same server exposes MCP at:

```text
http://127.0.0.1:8787/mcp
```

## Optional hosted OpenAI mode

```bash
export OPENAI_API_KEY="..."
export XRAI_MODEL=gpt-5.6-luna
node src/cli.js chat
```

This enables the hosted Responses API and hosted web search. It is an upgrade path, not a requirement.

## Claude Code — no separate XRAI model key

From the repo root:

```bash
claude mcp add --transport stdio --scope project xrai -- node "$PWD/src/cli.js" mcp
claude mcp get xrai
```

Claude Code can be the reasoning host and directly use XRAI's tools.

## ChatGPT

ChatGPT connects to remote MCP servers; it does not directly connect to a localhost MCP endpoint. For a local/private XRAI server, use OpenAI's Secure MCP Tunnel.

On macOS, the current supported install path is:

```bash
brew install openai/tools/tunnel-client
tunnel-client help quickstart
```

Tunnel provisioning requires the applicable OpenAI tunnel/runtime credentials. That credential is for the tunnel transport; **XRAI itself still does not require a model API key**.

After the tunnel is healthy, create/enable the custom MCP app in ChatGPT and point it at the tunnel-backed MCP endpoint. Current OpenAI guidance is documented at:

```text
https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
https://help.openai.com/en/articles/12584461
```

Do not expose `xrai_shell` as a public unauthenticated endpoint. XRAI binds to `127.0.0.1` by default.

## MCP tools

v0.2.1 exposes four tools:

- `xrai_run` — complete recursive run with evidence-gated learning
- `xrai_shell` — workspace-rooted shell execution
- `xrai_knowledge` — XRAI knowledge + promoted skills only
- `xrai_skills` — inspect skill counts, active versions, and meta-policy

## CLI

```bash
node src/cli.js chat
node src/cli.js run "task"
node src/cli.js web
node src/cli.js mcp
node src/cli.js skills
node src/cli.js sync
```

## Workspace UI

The redesigned browser UI combines visual orchestration and basic chat. It shows observable execution state:

- parent/child agents
- tool activity
- knowledge retrieval
- promoted-skill retrieval
- evaluator score
- retries
- candidate/promotion/rejection events
- slow meta-learning events
- current learning status and meta version

It does **not** expose or imitate hidden chain-of-thought.

## Architecture

```text
                        ┌──────────────────┐
User / ChatGPT / Claude │    XRAI Core     │
Local / browser model ─▶│  small + stable  │
                        └────────┬─────────┘
                                 │
                    retrieve promoted skills
                                 │
                                 ▼
                         Execute + Tools
                                 │
                                 ▼
                            Evaluator
                                 │
                       candidate skill diff
                                 │
              ┌──────────────────┴─────────────────┐
              │                                    │
       safe verifier exists                 no verifier
              │                                    │
       execute real check                   repeat support
          /         \                       across tasks
       pass         fail                         │
        │             │                          │
     promote       reject                   promote later
        │                                        │
        └──────────────────┬─────────────────────┘
                           ▼
                    Promoted Skill Set
                           │
                   measured future use
                           │
                           ▼
               slow meta loop + rollback
```

## Why no agent framework or vector database

At this scale, adding LangChain/LangGraph, Redis, a vector DB, a graph DB, a queue, or a separate swarm service would increase failure modes faster than capability.

v0.2 keeps state inspectable:

- Markdown for durable base knowledge
- append-only JSONL for server skill history
- localStorage for browser skill history
- token-overlap retrieval plus measured utility/confidence

Add embeddings or a database only when measured retrieval quality or scale justifies it.

## Verification safety

Automatic skill verifiers are deliberately restricted to recognizable project verification commands such as:

```text
npm test
npm run check
pytest
go test
cargo test
dotnet test
```

This allowlist prevents arbitrary evaluator-generated shell from becoming a promotion gate. It is **not an OS sandbox**: project test/build scripts themselves can execute code with the permissions of the user running XRAI. Use a container or VM for untrusted repositories.

## Tests

```bash
npm run check
```

The deterministic suite currently verifies:

- knowledge ranking
- MCP v0.2 tool surface
- bounded Ollama detection
- verifier-gated immediate skill promotion
- two-distinct-task support promotion
- verifier failure rejection
- sensitive-memory rejection
- verifier command allowlist
- slow meta-learning after 10 runs
- rollback to a prior proven skill version
- static no-key browser inference
- browser evaluator fail-closed behavior
- redesigned visual workspace + chat surfaces
- public-browser repo-task capability blocking
- UI state persistence across reload
- constrained-device model selection
- background server-run persistence after client disconnect
- HTTP run reattachment by run ID

Network/model calls are not required for the test suite.

## Current boundaries

- Public GitHub Pages mode cannot read/modify a repository or run commands/tests on the user's machine; those prompts are blocked before model loading.
- Full repo fixing requires an execution host: local XRAI + Ollama, Claude Code MCP, or a compatible remote MCP host.
- Browser-local work is recoverable after reload, but an interrupted browser-only generation restarts from the restored task rather than resuming a model token stream mid-generation.
- Server-backed runs continue after browser disconnect and can be reattached by run ID.
- Browser skill promotion therefore requires repeated independent success rather than a shell verifier.
- Model evaluation is still probabilistic; deterministic project verification remains stronger evidence.
- The kernel does not autonomously rewrite itself. Skills/meta-guidance evolve; kernel changes remain test-gated and version-controlled.
- The shell is workspace-rooted by convention and destructive-command blocking, not an OS security sandbox.

## Knowledge source

The seed knowledge under `knowledge/` is synchronized from:

```text
https://github.com/JT5D/xrai/tree/main/knowledge
```

Refresh it with:

```bash
node src/cli.js sync
```

MIT licensed.
