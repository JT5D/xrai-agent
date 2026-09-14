# XRAI Agent architecture and execution handoff

Assessment updated: 2026-09-13. Scope: **JT5D/xrai-agent only**.

## Read order

1. `../SPEC.md` — authoritative goals, boundaries, acceptance gates, and priorities.
2. `AGENT_ARCHITECTURE_RESEARCH_2026-09-13.md` — current agent/skills/MCP/A2A plus Portals/Jarvis research.
3. `MODEL_RUNTIME_RESEARCH_2026-09-13.md` — model/provider/runtime research.
4. `RUNTIME_CANDIDATE_PROBE_2026-09-13.md` — exact Puter/Lifo probe result.

If these disagree, `SPEC.md` wins unless deliberately revised with new evidence.

## Current repository state

- Branch: `work/shared-loop-evidence-20260913`
- Draft PR: #9
- Base seen by the PR: `master@6cff7e7c1be02e5b75b58e96f8b83830bbc38213`; re-fetch before merge.
- Master spec: **v0.3**.
- This branch is **not deployed** and does not claim the public product is fixed.
- Temporary Puter/Lifo probe page, test, and workflow were removed after their evidence was preserved in the dated probe document.

## One architecture target

```text
browser / CLI / MCP / host
        |
 durable task + session state
        |
 provenance-aware retrieval
  | curated XRAI knowledge
  | source-linked live research
  | transfer-verified skills
  | semantic retrieval only if A12 earns it
  | structural graph relations only if A12 earns it
        |
 small relevant context
        |
 one bounded model/tool loop
        |
 provider capability adapter + typed tools
        |
 execution adapter
        |
 independent verifier receipts
        |
 evidence ledger + verified reusable learning
```

Default rule: **one capable agent, real tools, independent verification, explicit state, minimal machinery**. Add workers/frameworks/datastores only when an XRAI acceptance comparison proves a benefit.

## Verified decisions

### Keep for P0

- Existing XRAI KB retrieval: genuinely wired into browser chat today.
- Conversation/follow-up state handling.
- Source-linked research path.
- WebContainer Node/JS/TS repo execution where supported.
- Evidence-gated skill semantics.
- Provenance/X-ray UI concepts.
- Browser, CLI, MCP, and host as product interfaces, while their internal semantics converge later.

### Do not use as the primary production brain

The tested tiny browser-local model strategy is closed for P0. The active 135M path failed the bounded A1 qualification and the tested 1.2B candidate did not meet the response budget in the tested CI browser environment. Browser-local inference may remain an optional fallback only if later measured successfully.

### Puter

Official documentation provides the needed primitives for a promising no-developer-key browser path, including GPT-5.6 Luna, tools, web search, and interactive website authentication. The isolated CI probe opened the auth popup but did not complete interactive authentication, so Puter is **not yet qualified or disqualified** for a real user session.

Next useful proof: real interactive auth -> A1 exact cases -> tools -> web search -> privacy/limit review.

### Lifo

The exact tested jsDelivr ESM path failed before the sandbox ran because of a dependency export mismatch. Do not replace WebContainer with it. Revisit only through a supported packaging path if WebContainer becomes the actual blocker and the comparison is cheaper than keeping the working lane.

### Knowledge graph / Holograim

Holograim is a useful structural crawler/graph/visualization reference, not current XRAI semantic memory and not wired into xrai-agent. It stays P2. The missing graph is **not** tonight's blocker.

## Adjacent-project conclusions

### Portals v4

Use as product-direction and failure-history evidence:

- simple/fast/scalable architecture;
- verify the live path and the actual claim;
- one shared handler/code path rather than parallel shims;
- retain useful failure lessons;
- multimodal/spatial context and X-ray/provenance are valid long-term directions;
- hook/session/memory/process accretion is a proven failure mode to avoid.

Do **not** import Portals orchestration or complexity into XRAI by default.

### Jarvis v1

Useful historical direction: natural input -> knowledge/tools -> real action -> response. Implementation is obsolete and not a security/architecture template.

### Jarvis v2

Strong adjacent principles to preserve in XRAI boundaries:

- evidence before confidence;
- permission before consequence;
- real states / no theater;
- provenance-rich memory;
- typed/versioned contracts;
- replaceable providers/components;
- least privilege;
- clean-sheet decisions based on measured product fit.

### Integration stance

XRAI should remain independently usable and expose explicit contracts rather than becoming internal Jarvis/Portals state.

Likely future boundary:

```text
Jarvis policy/identity/approvals
        |
 versioned MCP / typed XRAI task contract
        |
XRAI reasoning/retrieval/tools/evidence
        |
 optional Portals spatial context + X-ray visualization
```

A2A is later-only if true autonomous peer-agent delegation is materially cleaner than MCP tools/tasks.

## Current standards/framework direction

- **Agent Skills:** target compatibility with the open directory format for portable skill packages, but keep XRAI quarantine/provenance/held-out verification/rollback as the trust layer.
- **MCP:** new work should follow the current specification and stateless/self-describing design; do not build new architecture around deprecated historical protocol assumptions.
- **OpenAI Agents SDK for TypeScript:** best current P1 framework comparison because it is small, TypeScript-native, and covers tools/sessions/HITL/tracing/sandbox patterns. Benchmark against XRAI's current kernel before adopting.
- **LangGraph:** durability/checkpoint semantics are useful reference material; do not introduce a graph runtime unless it is objectively simpler than the required XRAI state machine.
- **smolagents:** useful simplicity/security reference, not a reason to migrate XRAI to Python.
- **CrewAI / larger multi-agent stacks:** popular but not the default design for XRAI; multi-agent complexity must beat the single-agent baseline.

See `AGENT_ARCHITECTURE_RESEARCH_2026-09-13.md` for the dated evidence.

## P0 — get public XRAI working

Do these in order and do not expand scope until the preceding blocker is closed:

1. **Qualify the primary reasoning path.** First try the interactive Puter proof because it matches the no-user-model-key browser goal without exposing an operator key. If it fails or has unacceptable limits/privacy, continue the existing provider-neutral hosted candidate harness. Do not return to tiny-model tuning.
2. **Preserve the existing KB.** Verify at least one relevant-KB task against a no-KB baseline through the qualified model path. No vector DB or graph project tonight.
3. **Keep real tools real.** Preserve source-linked research and WebContainer execution where it is already proven. Do not fake mobile repo execution or substitute model prose for tool receipts.
4. **Run end-to-end acceptance.** Ordinary conversation, retry/context continuity, research, repo inspect/test/repair, patch, bounded failures, reload/recovery, console/network behavior, and exact revision identity.
5. **Verify claimed devices separately.** Mobile chat support and mobile Node/npm execution are separate claims. Physical iPhone/Safari and Android evidence is required before claiming full support.
6. **Deploy only the exact qualified revision.** Then repeat the live checks against the deployed revision.

Nothing else blocks P0: not Holograim, not semantic memory, not Agent Skills packaging, not Jarvis/Portals integration, not A2A, not a framework migration.

## P1 — coherent and standards-aligned core

After P0 is actually live:

1. Put the winning model/provider behind a capability adapter.
2. Converge browser/CLI/MCP/host on one task/session/tool/evidence semantics.
3. Compare the current TypeScript kernel with a narrow OpenAI Agents SDK TS prototype on A1/A4/A7/A9 before writing more generic orchestration/session/sandbox/tracing code.
4. Align touched MCP surfaces with the current MCP specification.
5. Add Agent-Skills-compatible packaging with XRAI's stricter evidence/trust layer.
6. Run authentic A4 repo repair and A8 held-out skill-transfer improvement/rollback.
7. Make host checkpoints genuinely restart-durable and idempotent.
8. Curate/sync verified knowledge, add freshness/trust metadata, and establish A12 baselines.
9. Stabilize typed/versioned task/evidence/artifact contracts for future Jarvis/Portals adapters.

## P2 — earned semantic + structural memory

- Add semantic retrieval only if A12 shows lexical retrieval is a material limiter.
- Reuse Holograim/Portals structural and X-ray ideas behind the same retrieval/provenance seam.
- Link files, tasks, runs, sources, skills, verifier receipts, artifacts, and outcomes with explicit typed relations.
- Compare hybrid retrieval against no-retrieval and lexical-only baselines for success, latency, context size, and reliability.
- Audit/version the real XRAI interchange schema/loader/saver before other products claim XRAI compatibility.

## P3 — broader autonomy and ecosystem integration

- Jarvis adapter via explicit typed/MCP contracts.
- Portals spatial/multimodal context + provenance visualization adapter.
- A2A only if genuine peer-agent discovery/delegation is needed.
- Longer workflows, more runtimes, and specialist workers only when evals beat the simpler baseline.

## Verification matrix

| Goal | Status |
| --- | --- |
| SPEC v0.3 goals/acceptance/priorities | PASS — documented |
| XRAI KB wired into browser chat | PASS — source verified |
| Retrieval quality optimal | NOT YET — requires A12 |
| Evidence-gated skill promotion semantics | PASS — module/tests |
| Model self-score rejected as execution proof | PASS |
| Browser -> host transport contract | PASS |
| WebContainer verifier-command mechanism | PASS for supported path |
| Primary qualified public reasoning path | **BLOCKER / NOT YET** |
| Puter real-user auth + A1/tools/search | NOT YET |
| Lifo tested jsDelivr integration | FAIL — do not promote |
| Shared browser/CLI/MCP/host core | NOT YET |
| Genuine host restart durability | NOT YET |
| Authentic model-generated A4 repair | NOT YET |
| Full A8 held-out reuse experiment | NOT YET |
| A12 retrieval comparison | NOT YET |
| Agent Skills compatibility | P1, NOT YET |
| Current-MCP alignment audit | P1, NOT YET |
| Jarvis/Portals integration contract | P1/P3, NOT YET |
| Physical iPhone/Safari | NOT YET |
| Physical Android | NOT YET |
| Branch deployed | NO |
| Full public vertical slice | **NOT YET** |

## Promotion safety

Before merge or deploy:

1. re-fetch `master` and compare against the branch;
2. require latest source CI green on the final branch head;
3. preserve concurrent work and rollback;
4. keep PR #9 draft while the primary reasoning path/full vertical slice is unresolved;
5. never call source CI "deployment verification";
6. never promote a provider/runtime/framework/skill/graph from docs, stars, model cards, or partial probes;
7. verify the exact deployed revision and each claimed desktop/mobile capability after deployment.

## Exact next action

**Interactive Puter qualification is the cheapest current P0 proof.** If it succeeds, immediately run XRAI A1 + tools + web-search qualification and then integrate it behind a small browser model adapter while preserving the current KB and real execution lanes. If it fails, record the specific reason and move directly to the existing provider-neutral hosted-candidate harness. Do not branch into graph/framework/runtime research unless one of those is the demonstrated blocker.
