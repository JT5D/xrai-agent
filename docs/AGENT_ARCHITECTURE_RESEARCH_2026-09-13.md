# XRAI agent architecture research — 2026-09-13

This is a dated research record for `JT5D/xrai-agent`. It complements `SPEC.md`; it does not approve a framework, model, runtime, or cross-project integration by popularity alone.

## Decision summary

1. Keep XRAI small: one capable model/tool loop, explicit tools, durable task/session state, independent verification, and provenance-rich retrieval.
2. Do not rebuild generic agent infrastructure by reflex. Current mature projects already provide tools, sessions, sandboxes, tracing, durable execution, MCP, and human approval. Compare them against XRAI before writing equivalent machinery.
3. Do not migrate to a large framework merely because it is popular. Adoption must measurably improve XRAI acceptance cases while reducing or justifying complexity.
4. Use open standards at boundaries: JSON Schema for typed tools/events, current MCP for tool/context interoperability, Agent Skills for portable procedural packages where useful, and A2A only if true peer-agent collaboration becomes a product requirement.
5. Treat Portals v4, Jarvis v1, and Jarvis v2 as directional evidence and possible future integration targets, not implementation authority. Reuse is earned by measured benefit and security review.
6. Keep XRAI independently usable. Future Jarvis/Portals integration should happen through versioned contracts rather than shared hidden state, copied orchestration, or direct coupling to internal repositories.

## Internal directional references

### Jarvis v1 — product intent, not architecture

Repository: `imclab/Jarvis`.

The historical `jarvischrome.php` prototype shows an early version of the same product direction:

```text
natural/voice input
  -> route intent
  -> query knowledge or a real external device/service
  -> perform an action
  -> speak the result
```

It directly used browser speech input, knowledge APIs, Wolfram Alpha, Google TTS, and Arduino home controls.

**Useful direction:** natural interaction should reach real knowledge and tools with low ceremony.

**Do not copy:** hard-coded endpoints/credentials, implicit trust, string-based intent routing, missing provenance, missing durable task state, and lack of approval/security boundaries are historical implementation constraints, not modern XRAI patterns.

### Portals v4 — multimodal/spatial north star plus operational lessons

Repositories inspected: `JT5D/portals_v4` and `JT5D/claude-memory-portals-v4`.

Current Portals guidance explicitly prioritizes:

- simple, fast, scalable, easy-to-test/debug/deploy architecture;
- real production code paths rather than parallel test shims;
- one shared bridge/handler instead of duplicative routes;
- "never guess — verify from files/code";
- an MVP filter before changes;
- escalation from lessons to narrow enforceable contracts;
- test ladders and verification of the live path;
- mirrored XRAI/knowledgebase lessons;
- small top-level instruction/index files with detailed knowledge loaded on demand.

The Portals memory corpus also records repeated lessons around:

- verify the claim, not merely an artifact;
- live-path-first diagnosis;
- hearing/brain/memory as foundational assistant capability;
- X-ray/visual provenance concepts;
- failure-pattern retention;
- a shared code surface across runtimes where practical;
- gated self-improvement rather than uncontrolled production mutation;
- hook/process/session accretion creating reliability and coordination failures;
- addition becoming a velocity tax when simple mechanisms already exist.

**XRAI takeaway:** preserve the multimodal/spatial and X-ray/provenance direction, but intentionally avoid inheriting Portals' accumulated hooks, duplicated orchestration, device/session contention, or project-specific complexity. XRAI should be the smaller reusable core.

### Jarvis v2 — strongest adjacent product contract

Repository: `JT5D/jarvis`.

Jarvis v2's current master specification and ADRs are stronger than either historical Jarvis or Portals as architecture/safety references. Especially relevant principles:

- evidence before confidence;
- permission before consequence;
- local observation with minimal raw-data retention;
- fast conversation with visible/cancellable delegated depth;
- real states, no theater;
- safe improvement separated from product release mutation;
- replaceable architecture and provider boundaries;
- zero-trust trust zones and least privilege;
- composable simplicity;
- typed/versioned contracts;
- explicit source/provenance/confidence for durable memory;
- conflict surfacing instead of silent memory collapse;
- clean-sheet architecture decisions based on measured product fit, not code reuse.

Jarvis v2 explicitly defers any XRAI adapter until the real XRAI schema/loader/saver are located and audited, and forbids inventing a competing generic graph.

**XRAI takeaway:** make that future adapter possible by stabilizing XRAI's own typed retrieval/provenance/tool interfaces. Do not move XRAI inside Jarvis or copy Jarvis internals into XRAI.

## 2026 agent-framework landscape

GitHub counts below are a snapshot from 2026-09-13/14 and are screening evidence only. Stars do not prove suitability.

| Project | Snapshot | Relevant pattern | XRAI decision |
| --- | ---: | --- | --- |
| `openai/openai-agents-js` | ~3.8k stars, MIT, active 2026-09-14 | Small TS primitives; function/MCP tools, sessions, HITL, tracing, voice, sandbox agents | **Primary P1 TypeScript framework comparison** against current small kernel; no migration before P0. |
| `openai/openai-agents-python` | ~29.4k stars, MIT, active 2026-09-14 | Same small-primitives design at larger adoption | Architecture/reference evidence; TS SDK is more directly relevant to XRAI. |
| `langchain-ai/langgraph` | ~41.6k stars, MIT, active 2026-09-13 | Checkpointed durable execution, interrupts, persistence, short/long-term memory | Reference for A7 durability. Adopt only if XRAI's simpler event/checkpoint layer becomes the dominant engineering burden. |
| `pydantic/pydantic-ai` | ~19.9k stars, MIT, active 2026-09-13 | Typed agent/tool boundaries and durable-execution/provider patterns | Architecture reference; Python mismatch makes wholesale migration unlikely. |
| `huggingface/smolagents` | ~29.3k stars, Apache-2.0, active Aug 2026 | Minimal multi-step agents, code vs JSON tool calling, MCP, sandbox execution, model-agnostic | Strong simplicity/reference baseline; compare ideas, not language migration. |
| `mastra-ai/mastra` | ~28.0k stars, active TS | Agents, tools, workflows, MCP, memory, tracing/evals | Useful P1 TS comparison if exact current licensing is reviewed first; GitHub license metadata was not sufficiently clear in this pass. |
| `crewAIInc/crewAI` | ~58.5k stars, MIT, active 2026-09-13 | Role/team multi-agent orchestration | Popularity evidence, but default multi-agent design is not aligned with XRAI's one-capable-agent-first principle. |
| `microsoft/autogen` | ~61.0k stars, historically influential | Multi-agent programming framework | Reference only for now: repository activity is materially older than the leading current candidates and its own metadata does not make it a fresh default choice. |
| `anthropics/skills` | ~176k stars, current | Portable filesystem Agent Skills ecosystem | Strong evidence that XRAI should interoperate with the open Agent Skills format rather than invent another skill package format. |

### OpenAI Agents SDK — most relevant current TS comparison

Current official TypeScript documentation describes a small production-oriented primitive set:

- agents with instructions/tools;
- function tools with schema validation;
- MCP tools;
- persistent sessions;
- human-in-the-loop controls;
- tracing;
- voice agents;
- sandbox agents pairing an agent with an isolated filesystem/workspace, shell, editing, snapshots, and sandbox state.

The SDK documentation explicitly distinguishes using raw Responses when the application wants to own a short-lived loop from using the SDK when the runtime should manage tool execution, sessions, guardrails, or handoffs.

**XRAI decision:** do not migrate tonight. In P1, benchmark XRAI's current bounded kernel against a narrow Agents SDK TypeScript prototype for A1/A4/A7/A9. Adopt only if it reduces bespoke code or improves reliability without weakening provider portability, evidence semantics, or public-browser constraints.

### LangGraph — durability reference, not default agent architecture

Current LangGraph documentation positions it as a low-level runtime for durable execution, checkpoint persistence, streaming, and human-in-the-loop rather than a required high-level agent abstraction. Checkpoints can recover from failures without rerunning successful work and can separate thread-scoped state from cross-thread stores.

**XRAI decision:** copy the durability semantics first: explicit JSON-serializable task state, checkpoints, idempotent side effects, and restart tests. Do not introduce a graph runtime unless that is objectively simpler than XRAI's needed state machine.

### Hugging Face smolagents — simplicity and secure-tool reference

Current smolagents stable docs identify v1.26.0 as the stable release. The library stays intentionally small, supports `CodeAgent` and JSON `ToolCallingAgent`, model-agnostic providers, MCP tools, and sandbox code execution. Its docs explicitly warn that imported tools/MCP servers are executable trust boundaries.

**XRAI decision:** keep the same discipline: small loop, explicit max steps, sandbox tool execution, and untrusted imported tools. XRAI remains TypeScript-first, so this is a reference/evaluation baseline rather than a migration target.

## Skills: use the open Agent Skills format, keep XRAI verification semantics

`agentskills.io` now documents Agent Skills as an open lightweight format. A skill is a directory with required `SKILL.md` metadata/instructions plus optional scripts, references, and assets. Skills use progressive disclosure:

1. load name/description for discovery;
2. load full instructions only when relevant;
3. load resources or execute scripts only as needed.

Anthropic's current documentation reinforces that Skills must be treated like software because instructions/scripts can invoke tools, access files, or exfiltrate data.

**XRAI decision:** separate **skill packaging** from **skill trust/promotion**.

A future XRAI skill can be Agent-Skills-compatible on disk while retaining XRAI-only evidence metadata externally or in optional namespaced metadata:

```text
portable skill package
  SKILL.md
  scripts/
  references/
  assets/
        +
XRAI evidence ledger
  source task
  provenance
  verifier receipts
  held-out transfer result
  trust/scope
  version/rollback lineage
```

Imported skills remain untrusted/quarantined until reviewed and/or independently verified. A compatible package must never auto-promote itself or expand tool permissions.

## MCP: align with the 2026-07-28 specification

The current MCP `2026-07-28` specification materially changes the preferred architecture:

- stateless protocol core;
- self-describing requests and header-based routing;
- cacheable deterministic list responses;
- Multi Round-Trip Requests for interactive input;
- formal extensions such as Tasks;
- stronger OAuth/OIDC-aligned authorization;
- shift from Dynamic Client Registration to Client ID Metadata Documents;
- deprecation of protocol Roots, Sampling, Logging, and legacy HTTP+SSE for new implementations.

**XRAI decision:** its MCP interface should target current stateless Streamable HTTP/stdio semantics. Do not build new architecture around deprecated Roots/Sampling/Logging/SSE. Use explicit XRAI state handles or durable task IDs rather than hidden transport session state. Add the Tasks extension only when long-running remote tool calls genuinely need it.

## A2A: future peer-agent boundary, not a P0 dependency

The A2A specification's latest released version is 1.0.0 and is designed for capability discovery, modality negotiation, and collaborative tasks between independent agents across frameworks/vendors.

**XRAI decision:** MCP remains the first integration boundary for exposing XRAI tools/resources to Jarvis or other hosts. If XRAI and Jarvis later need to remain autonomous peers that delegate durable tasks to one another, evaluate A2A 1.0 rather than inventing a proprietary peer-agent protocol.

## Open-model / Hugging Face ecosystem observations

Hugging Face's August 2026 open-model report shows that:

- the open-weight frontier has moved to very large server-class models;
- the Qwen ecosystem has become a dominant base for derivatives and local deployment formats;
- permissive Apache/MIT licensing remains common among major open releases, though very large model licenses increasingly need exact review;
- local-runtime formats such as GGUF/MLX and agent access to Hub resources are growing rapidly;
- agent clients are now a significant first-class user of the Hub.

**XRAI decision:** this reinforces the existing model research rule. Do not choose a model from trending pages, family popularity, or parameter count. Screen current official candidates for licensing/deployability/tool support, then run XRAI A1/A4/A8. Keep local-model support as a replaceable adapter; do not force the public product around whichever local format is currently popular.

## Integration direction: XRAI ↔ Jarvis ↔ Portals

Do not make one repository's internal state another repository's API.

### Near-term

XRAI stays independent and proves its own vertical slice:

```text
reasoning + retrieval + research + tools + verifier + evidence ledger
```

### Jarvis integration after XRAI P1

Likely first boundary:

```text
Jarvis
  -> versioned MCP / typed XRAI tool contract
  -> XRAI task/session
  -> XRAI evidence + artifacts + verifier receipts
  -> Jarvis approval/presentation layer
```

Jarvis keeps ownership of user/tenant identity, permissions, executive context, approvals, and consequence policy. XRAI owns its technical/research task semantics, evidence, and verified reusable skills. Neither side silently elevates the other's authority.

### Portals integration later

Portals can consume XRAI outputs without owning the XRAI reasoning core:

- spatial/XR task invocation;
- XRAI scene/semantic exchange after the real schema is audited;
- X-ray/provenance visualization of sources, tools, tasks, relationships, and results;
- multimodal/spatial context as explicitly scoped evidence.

The spatial client should be a presentation/context/execution adapter, not a second agent architecture.

### A2A later if needed

Use A2A only if Jarvis/XRAI/other agents need independent discovery and peer task collaboration that cannot be represented cleanly as MCP tools/tasks.

## Prioritized implications for XRAI

### P0 — tonight

- No framework migration.
- Qualify the capable public reasoning path.
- Keep current XRAI KB retrieval active.
- Keep real research/tools/WebContainer verification where supported.
- Verify exact desktop/mobile claims and deploy only the qualified revision.

### P1 — coherent, standards-aligned core

1. Converge browser/CLI/MCP/host semantics.
2. Compare current TS kernel against a narrow OpenAI Agents SDK TS prototype before writing more generic loop/session/sandbox/tracing machinery.
3. Align XRAI MCP with the 2026-07-28 stateless protocol and current auth/transport guidance.
4. Add Agent-Skills-compatible import/export/progressive disclosure while preserving XRAI quarantine/verification/promotion evidence.
5. Implement real restart durability/idempotence and A4/A8/A9 tests.
6. Keep typed/versioned contracts so Jarvis integration does not require internal coupling.

### P2 — retrieval/provenance/graph

- Improve knowledge curation/freshness and run A12 comparisons.
- Add semantic retrieval only if it earns its complexity.
- Reuse Holograim/Portals structural and X-ray ideas behind the same provenance-rich retrieval interface.
- Stabilize any XRAI interchange schema/loader/saver before Jarvis or Portals claims compatibility.

### P3 — multimodal and ecosystem integration

- Jarvis XRAI adapter through explicit versioned contracts.
- Portals spatial/multimodal adapter and X-ray visualization.
- Evaluate A2A 1.0 for peer-agent collaboration only when required.
- Add specialist workers/multi-agent orchestration only when task evals beat the simpler single-agent baseline.

## Sources checked

Internal repositories:

- `JT5D/xrai-agent` current branch and spec
- `JT5D/portals_v4` — `CLAUDE.md` and current repository structure
- `JT5D/claude-memory-portals-v4` — memory index/failure/feedback corpus
- `imclab/Jarvis` — historical prototype including `jarvischrome.php`
- `JT5D/jarvis` — `MASTER_SPEC.md`, `README.md`, `docs/architecture/ADR-001-clean-sheet-architecture.md`

Current external primary/reference sources:

- https://openai.github.io/openai-agents-js/
- https://github.com/openai/openai-agents-js
- https://github.com/openai/openai-agents-python
- https://docs.langchain.com/oss/python/langgraph/overview
- https://docs.langchain.com/oss/python/langgraph/persistence
- https://github.com/langchain-ai/langgraph
- https://ai.pydantic.dev/
- https://github.com/pydantic/pydantic-ai
- https://huggingface.co/docs/smolagents
- https://github.com/huggingface/smolagents
- https://mastra.ai/
- https://github.com/mastra-ai/mastra
- https://github.com/crewAIInc/crewAI
- https://github.com/microsoft/autogen
- https://agentskills.io/
- https://github.com/anthropics/skills
- https://blog.modelcontextprotocol.io/posts/2026-07-28/
- https://a2a-protocol.org/latest/
- https://huggingface.co/blog/state-of-open-models-summer-2026
