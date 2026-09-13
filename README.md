# XRAI Agent

A deliberately small, transparent, recursively improving AI agent: **zero runtime npm dependencies**, one execution kernel, one observable event stream, and thin interfaces for terminal, browser, ChatGPT, and Claude Code.

**No API key is required.** Keys are an optional upgrade, never a prerequisite.

- **Browser / GitHub Pages:** runs on-device using Chrome built-in AI when available, otherwise a small WebGPU model via Transformers.js.
- **CLI:** uses a local Ollama model when available.
- **ChatGPT / Claude Code:** the host chat model can orchestrate XRAI directly through MCP, so XRAI itself needs no model key.
- **Optional OpenAI key:** enables the hosted Responses API + hosted web search for standalone server/CLI runs.

The UI shows observable execution events (agents, tools, retrieval, evaluation, retries, learning). It does **not** expose or pretend to expose a model's private chain-of-thought.

## Why this architecture

The goal is maximum capability per line of code, not an agent framework inside an agent framework.

- **One kernel:** `src/kernel.js`
- **Three local tools:** shell, knowledge search, bounded delegation
- **Optional hosted web search:** only when an OpenAI key is present
- **One recursive quality loop:** act -> evaluate -> retry if needed -> retain verified lesson
- **One live event bus:** every visible interface observes the same real events
- **No vector DB / graph DB / queue / swarm service:** Markdown + JSONL/localStorage are enough for v0.1
- **MCP:** the same tool surface works from ChatGPT or Claude Code

## Fastest start — no key

### Browser

Use the live GitHub Pages build:

```text
https://jt5d.github.io/xrai-agent/
```

The first message may trigger an on-device model download. Chrome's built-in Prompt API is used first when available; otherwise XRAI falls back to `onnx-community/LFM2.5-350M-ONNX` through Transformers.js/WebGPU. Model files are cached by the browser.

### Local browser

```bash
git clone https://github.com/JT5D/unrepo.git xrai-agent
cd xrai-agent
node src/cli.js web
```

Open `http://127.0.0.1:8787`. If there is no OpenAI key and no local Ollama model, the browser still works in no-key on-device mode.

### CLI — no key

If Ollama is already installed and has a model, XRAI uses it automatically:

```bash
ollama pull qwen3:0.6b
node src/cli.js chat
```

No model SDK is installed into XRAI; it talks to Ollama's local HTTP API directly. `XRAI_LOCAL_MODEL` selects a specific installed model.

## Optional hosted model

For stronger standalone autonomous runs, set an OpenAI key:

```bash
export OPENAI_API_KEY="your-key"
export XRAI_MODEL=gpt-5.6-luna
node src/cli.js chat
```

When present, the key enables the OpenAI Responses API and hosted web search. Without it, XRAI uses local/browser/host-model paths above.

## Two browser interfaces

### Chat
The fastest normal interface. Ask a task and receive the final answer.

### Control Room
A live, deterministic execution DAG showing:

- parent and child agents
- model/provider state
- XRAI knowledge hits
- tool activity
- evaluator score
- retries
- retained verified lessons

Users can tune child-agent count and evaluator retries. Server mode also exposes recursion depth and workspace settings. The graph displays **observable events and outputs**, not hidden chain-of-thought.

## Claude Code via MCP — no model key required

From the standalone repo:

```bash
claude mcp add --transport stdio --scope project xrai -- node "$PWD/src/cli.js" mcp
claude mcp get xrai
```

The MCP exposes:

- `xrai_shell` — workspace-rooted execution
- `xrai_knowledge` — XRAI KB + verified lessons
- `xrai_run` — complete recursive XRAI run; uses OpenAI when configured, otherwise local Ollama

Claude Code itself can be the model/orchestrator and call `xrai_shell` + `xrai_knowledge`, so no second model API is necessary.

## ChatGPT via MCP — no model key required

ChatGPT connects to **remote** MCP servers, not ordinary localhost stdio servers. Run XRAI locally:

```bash
node src/cli.js web
```

Its Streamable-HTTP-style endpoint is:

```text
http://127.0.0.1:8787/mcp
```

Use ChatGPT's **Secure MCP Tunnel** to connect that local endpoint without exposing your machine to the public internet. Then create/enable the XRAI custom app in ChatGPT and invoke it from normal chats. ChatGPT supplies the reasoning model; XRAI supplies knowledge/tools, so no XRAI API key is needed.

Do **not** expose `xrai_shell` as a public unauthenticated internet endpoint. The default server binds to `127.0.0.1` intentionally.

## Self-improvement, without uncontrolled self-modification

After a run:

1. The evaluator grades task completion from 0–1.
2. Below `0.82`, the root agent gets targeted feedback and retries, bounded by configuration.
3. At `>= 0.82`, one reusable lesson can be retained.
4. Future knowledge retrieval includes those verified lessons.

Storage:

- CLI/server: `.xrai/memory.jsonl`
- GitHub Pages/browser: `localStorage` on the user's device

This is **experience/skill improvement**, not blind rewriting of the agent's core code. Code changes still need tests and version control.

## XRAI knowledgebase

The package ships a synced seed under `knowledge/`; the local server and GitHub Pages deployment expose that same seed to the browser under `/knowledge/`. Refresh it directly from `JT5D/xrai/knowledge`:

```bash
node src/cli.js sync
```

Retrieval is intentionally tiny: token-overlap ranking over Markdown/JSONL chunks. For the current KB size this stays transparent, portable, and debuggable. Add a vector or graph database only if measured scale/retrieval quality proves it necessary.

## Knowledge graph

Events and lessons have explicit IDs, parent-agent links, types, sources, scores, and tags. The browser renders execution as a deterministic layered DAG rather than a decorative force graph, preserving causal order and parent/child delegation.

## Configuration

```bash
# optional hosted provider
export OPENAI_API_KEY=...
export XRAI_MODEL=gpt-5.6-luna
export XRAI_REASONING=low

# optional no-key local provider
export OLLAMA_HOST=http://127.0.0.1:11434
export XRAI_LOCAL_MODEL=qwen3:0.6b
export XRAI_LOCAL_CONTEXT=32768

# runtime
export XRAI_WORKSPACE=.
export XRAI_PORT=8787
```

The shell is **workspace-rooted, not an OS security sandbox**. A destructive-command blocklist catches obvious dangerous commands, but local execution still has the permissions of the user running XRAI. Use containers/VMs for untrusted tasks.

## Architecture

```text
GitHub Pages chat ─ on-device model ─┐
CLI ─ OpenAI or local Ollama ────────┤
Browser Control Room ────────────────┼──> XRAI events / knowledge / eval loop
                                     │
ChatGPT / Claude ───── MCP ──────────┼──> shell(workspace)
                                     ├──> knowledge(XRAI + lessons)
                                     └──> bounded delegation
                                               │
                                           evaluator
                                               │
                                   retry OR verified lesson
```

## Tests

```bash
npm test
npm run check
```

The deterministic suite covers knowledge ranking, durable lessons, MCP initialization/tool discovery, bounded Ollama capability detection, the Chat + Control Room surfaces, and the static no-key Pages fallback. Network/model calls are not required for tests.

## Current v0.1 boundaries

- GitHub Pages/browser mode cannot run shell commands on the user's machine; it intentionally runs in a browser sandbox with local AI, XRAI knowledge, orchestration, evaluation, and local lessons.
- CLI/MCP mode can use the local workspace shell.
- ChatGPT needs a remote MCP connection (or Secure MCP Tunnel); a static GitHub Pages site cannot itself be an MCP HTTP server.
- The evaluator is model-based; deterministic project tests remain the strongest verifier when available.
- Browser visualization shows actions and outcomes, not private reasoning tokens.

These constraints are intentional: keep the kernel understandable first, then add complexity only when measurements justify it.

## Sources that informed v0.1

- OpenAI Responses API, Apps/MCP guidance, and Secure MCP Tunnel model
- Model Context Protocol transport guidance
- Claude Code MCP
- Chrome built-in Prompt API
- Hugging Face Transformers.js + ONNX Community LFM2.5 350M browser model
- Ollama native multi-turn tool calling
- XRAI `knowledge/`: minimal loops, evidence-first evals, durable memory, less-is-more engineering
- GenericAgent's skill-crystallization approach as a comparison point

MIT licensed.
