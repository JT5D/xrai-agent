# XRAI Agent - architectural reset and execution handoff

Assessment date: 2026-09-13. Start with ../SPEC.md. This is a checkpoint for a fresh session, not a claim of product completion.

## Verified starting state

Initial inspected master: `0b2b7f5a91b05d08933ba425eaaf11a927b77e29`, public UI v0.3.50. Before publishing this checkpoint, master advanced to `70807409394f266f3b6ce344fcd6755768a2e345`: concurrent patch-export changes and a real-model release preflight. They are preserved. Always resolve current HEAD and deployed build separately.

The supplied transcript shows lost goals, irrelevant research, invented executions, unchanged passing baselines reported against improvement requests, and self-rating presented as improvement. The original creation prompt was not recovered; this assessment does not substitute unrelated XRAI or Portals history for it.

Deployment run `34789980365` belongs to this public revision. Its reported model-runtime failure remains a blocker. Prior browser conversation tests use controlled responses. Passing repo checks on an already-passing repository did not prove agent-generated repair. See STABILIZATION_2026-09-13.md for historical evidence and exact caveats.

## Architecture assessment: useful parts, incomplete product loop

Retain pinned repository snapshots, actual command exit codes, isolated browser workspaces where supported, event visibility, saved history, truthful status evidence, and optional MCP/local/hosted interfaces.

The current architecture is not yet aligned with the full goals:

- `web/local-agent.js:runLocalTask` returns early for conversation turns with no tools and `learning: none`, before retrieval and skill evolution. The main browser path supplies this conversation option. Ordinary chat therefore does not run the advertised learning loop.
- `web/app.js`, `web/browser-workspace.js`, `src/kernel.js`, and `src/ollama.js` implement materially different routing/execution paths. Working pieces do not establish a coherent shared agent.
- The browser repo workflow runs bounded checks/edits, while browser skill promotion code relies on model evaluations and task supports. Code repair, durable skill reuse, and independent measured improvement have not been demonstrated together.
- `src/server.js` intercepts every `/api/runs` request as a list, but the UI POSTs there to create work. Only singular `/api/run` started a run. This is a concrete integration defect, independent of model quality.
- The local host run manager is an in-process Map; `runPersistence: true` overstates host-restart durability. Saved browser history is a different guarantee. Capability metadata also includes an old hardcoded version.
- The local shell uses host processes/environment. It is not equivalent to an OS-level sandbox. Do not turn it into an anonymous remote execution service by exposing a port.
- Repeated fallback experiments mixed model quality, prompt format, runtime support, quantization, and device memory. The 135M model showed instruction/patch failures; one CPU arithmetic response was numerically correct but violated an exact-format test. LFM q4/WASM failed an unsupported operator; a larger coder candidate hit allocation failure. These results do not establish that all local models fail or that GPU alone is the cause.
- Existing source and controlled-browser tests miss real task completion. The initially inspected deployment preceded its unmocked quality checks. Concurrent commit `70807409` adds a required real-model preflight before publication; retain it. That canary still does not establish the complete repair/learning contract. Correct status reporting is valuable but does not repair the underlying agent.

## Proposed direction, not a frozen stack

Thin browser/CLI/MCP clients -> one task and tool loop with durable context -> replaceable model and execution adapters -> independent verification -> versioned skills and artifacts.

Persist task identity, accepted goal/plan, events, artifacts and checkpoints; give all adapters the same outcome semantics. Keep ordinary chat cheap, but able to retrieve relevant knowledge and transition into authorized work. Use focused file read/search/edit, command execution, relevant web research, verification, and memory tools with bounded outputs. Do not default to multiple planner/worker/evaluator calls for every message.

Separate **no user API key or installation** from **all computation on the phone**. A capable operator-hosted backend could preserve the first requirement, but funding, credentials, privacy, security, and deployment need explicit approval. Retain an on-device path only where measured quality, memory, and latency support its claims. No new hosted service was provisioned in this pass.

Prefer a focused shared-core replacement behind existing interfaces, not a whole-app rewrite. A full rebuild is justified only when a tested small replacement is simpler than adapting the existing core. Do not pick a new framework based on popularity alone.

### Research supporting this direction

Primary sources reviewed; recommendations above are engineering judgments, not benchmark results for XRAI:

1. Anthropic, Building effective agents: start with simple composable patterns and add complexity only when outcomes justify it. https://www.anthropic.com/engineering/building-effective-agents
2. Anthropic, Managed Agents architecture: separate session, agent harness, and execution sandbox behind interfaces. https://www.anthropic.com/engineering/managed-agents
3. Anthropic, Demystifying evals for AI agents (2026): grade actual environment outcomes, evaluate model and harness together, retain traces, and distinguish capability from regression tests. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
4. Anthropic, Effective harnesses for long-running agents: durable progress/feature artifacts and incremental verification across context windows. https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
5. Pi: a plausible small JavaScript/TypeScript agent-loop/provider reuse candidate. It does not supply a security sandbox or permission boundary by itself. Validate package/version and API before adopting. https://github.com/earendil-works/pi
6. OpenHands SDK: a candidate when managed execution workspaces and agent lifecycle are the main integration burden. Do not import its full stack without proving the need. https://docs.openhands.dev/sdk
7. mini-SWE-agent: a simplicity reference for a model/tool/environment loop, not evidence our browser deployment works. https://mini-swe-agent.com/
8. LangGraph persistence: checkpoint semantics worth reusing if durable workflow requirements justify a framework. https://docs.langchain.com/oss/javascript/langgraph/persistence
9. Agent Skills: portable procedure packaging and progressive disclosure; a SKILL.md file does not itself grant tools, authority, or verified competence. https://agentskills.io/specification
10. GEPA: trace-guided optimization with explicit evaluation and bounded candidate selection. Consider only after reliable task graders exist; do not replace test evidence with self-assessment. https://github.com/gepa-ai/gepa
11. WebContainer support: browser and mobile memory restrictions require explicit qualification. https://developer.stackblitz.com/platform/webcontainers/browser-support

## Narrow implementation in this checkpoint

Changed only server routing behavior: GET `/api/runs` lists; POST `/api/runs` creates; legacy POST `/api/run` remains supported.

New `test/server-contract.test.js` reproduces the original 200-vs-202 failure and passes after the two-line fix. Three local HTTP/run-manager tests passed after repair; the reconstructed local source snapshot passed 111 source tests. The full current-master suite is checked separately in CI. The HTTP tests use a controlled runner, not a real model.

New `test/server-ui.e2e.mjs` exercises real browser submission -> HTTP 202/run ID -> controlled runner executing a real Node subprocess -> displayed result -> reload without duplicate execution, at desktop and mobile widths. Its report explicitly identifies the controlled runner. CI runs this alongside the existing source suite and exports `server-ui-contract` evidence. Local browser navigation was blocked by environment policy; CI is the designated browser verification environment. Do not claim browser verification until that job's actual result is inspected.

This fixes a real host integration bug. It does not change the public browser model or prove autonomous repair, durable host restarts, learning transfer, or iPhone Safari behavior. Remaining candidate branches belong to separate work: inspect before merging, never overwrite them.

## Next execution, bounded and goal-oriented

1. Read this spec/checkpoint, resolve current master, inspect pending changes and CI evidence. Do not replay the long chat or rerun completed model matrices without a new discriminating hypothesis.
2. Use the same small outcome suite to qualify one viable model/runtime and one existing agent-core candidate. Record exact model/export/runtime, chat template, outputs, time, memory where measurable, and failures. Distinguish format errors from wrong answers. Reuse the simplest viable components; do not implement a general platform first.
3. Complete one unmocked vertical path: inspect a pinned broken JS fixture -> generate a real source fix -> execute unchanged failing and protected held-out tests -> apply exported diff -> persist evidence -> reload -> retrieve a narrow learned procedure on a different related task -> compare against a no-skill baseline -> demonstrate rejection/rollback.
4. Promote only the independently verified pieces, preserve old working behavior during migration, then exercise the real public entrypoint and supported mobile environment. Keep remaining SPEC acceptance rows explicitly incomplete.

A fresh coding session is appropriate after this checkpoint. It should have repository checkout, terminal, browser testing, and an authorized usable model/execution path. The documents preserve intent without freezing the current broken implementation. No claim of state-of-the-art or complete functionality is warranted before the outcomes pass.
