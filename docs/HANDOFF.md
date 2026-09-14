# XRAI Agent architecture and execution handoff

Assessment updated: 2026-09-13. Implementation target: **JT5D/xrai-agent only**.

Start with `../SPEC.md`. It is the authoritative product contract and intentionally does not freeze the implementation. The dated model/runtime research is in `MODEL_RUNTIME_RESEARCH_2026-09-13.md`.

## Current repository state

- `master` remains based at `6cff7e7c1be02e5b75b58e96f8b83830bbc38213` in draft PR #9; re-fetch before any merge because concurrent work can change this.
- Work remains isolated on `work/shared-loop-evidence-20260913` in draft PR #9.
- The master spec is now v0.2 and explicitly defines the knowledge/retrieval/graph-memory contract plus P0-P3 delivery priorities.
- Source CI previously passed the code-bearing branch after the evidence/learning and remote-candidate harness changes. Every later documentation/probe commit must still be rechecked before promotion.
- The branch is **not deployed** and this document does not claim the public product is fixed.

## Governing engineering rule

No speculative model swaps, runtime swaps, memory systems, or bespoke architecture by intuition.

Before changing a model, provider, harness, execution runtime, memory/retrieval mechanism, knowledge graph, or comparable material architecture choice:

1. inspect current primary sources and proven maintained implementations;
2. record license, compute/deploy requirements, tool/structured-output support, privacy/data policy, limits, latency/availability when available, and cost implications;
3. distinguish open weights from genuinely free hosted inference;
4. benchmark shortlisted candidates through XRAI acceptance cases;
5. qualify **model + harness + tools + retrieval + execution environment together**;
6. prefer standard replaceable seams and mature patterns, but add a framework only if an XRAI comparison proves benefit;
7. preserve rollback until the replacement is objectively better.

The exact invariant is in `SPEC.md`.

## Target architecture

Keep the product small and modular:

```text
browser / CLI / MCP / host
        |
 durable task + session state
        |
 retrieval boundary
  | curated XRAI knowledge
  | source-linked research
  | transfer-verified skills
  | semantic retrieval when proven useful
  | structural graph relations when proven useful
        |
 small provenance-rich context
        |
 one bounded agent/tool loop
        |
 provider-neutral model adapter + real tool adapters
        |
 execution environment adapter
        |
 independent verifier receipts
        |
 evidence ledger + transfer-verified reusable learning
```

This is an architecture boundary, not a framework mandate.

## Verified knowledge and graph status

### XRAI knowledgebase: wired today

The current browser agent source explicitly loads these seed files:

- `knowledge/MISSION.md`
- `knowledge/KEY_LEARNINGS.md`
- `knowledge/SYSTEM_PATTERNS.md`
- `knowledge/AGENTIC_CODING_EVALS_2025_2026.md`
- `knowledge/UNVERIFIED.md`

It chunks the text, scores relevance using lexical token overlap, retrieves a small ranked set, mixes that with eligible transfer-verified skills and bounded conversation context, and passes the resulting evidence into the browser model turn.

**Verified conclusion:** the knowledgebase is genuinely wired into browser chat. This is source/mechanism verification only; it does not prove retrieval quality is optimal or that the current weak browser-local model can reason well from the retrieved context.

### Current knowledge limitations

- The corpus is very small.
- Retrieval is lexical rather than semantic/hybrid.
- Provenance exists at a basic source-file level but freshness/conflict handling is still minimal.
- More context is not a substitute for a capable model.

Therefore the existing KB stays in the P0 path, but a retrieval-platform rewrite does not.

### Holograim: useful reference, not current XRAI memory

`JT5D/holograim` is currently documented as a high-performance crawler/visualizer with filesystem, web, S3, and Google Drive sources; SQLite output; graph JSON containing nodes/edges/hierarchy; and force/tree/sunburst visualization.

**Verified conclusion:** these are useful structural indexing/provenance patterns for XRAI, but Holograim is **not currently wired into `xrai-agent`** and is not presently documented as a proven semantic agent-memory system.

Use it later through the common retrieval boundary for structural topology and X-ray provenance. Do not import its full stack into tonight's stabilization pass.

## Current model/runtime evidence

### Browser-local primary-brain strategy: closed

Real CI evidence in this session showed:

- the active SmolLM2 135M browser path failed the first bounded exact-instruction qualification case in the tested CI Chromium environment;
- an off-path LFM2.5 1.2B WebGPU Q4 candidate loaded but still could not finish the first tiny bounded response within the 45-second case limit after output was limited to 12 tokens.

This is environment-specific evidence, not a universal quality claim. It is sufficient to stop trying to make tiny browser-local inference the production brain. Keep browser-local inference only as an optional/offline fallback if it later passes measured requirements.

### Hosted/open server candidates

The provider-neutral A1 harness remains the correct side-by-side path for OpenResponses-compatible candidates such as Nex-N2.5-Mini, Nemotron 3 Super, conditional GLM-5.3-Flash, and Nex-N2.5-Pro comparison. No candidate wins from a model card or benchmark alone.

### Puter browser AI candidate

Current official Puter documentation verifies that Puter.js supports:

- GPT-5.6 Luna through `puter.ai.chat`;
- function/tool calling;
- OpenAI web search on supported models;
- website authentication;
- optional temporary-user creation via `attempt_temp_user_creation`.

Puter's website authentication documentation also explicitly requires `signIn()` to be triggered by a real user action because it opens a popup.

An isolated XRAI CI probe opened the Puter auth popup but timed out before authentication completed. Therefore:

- **Puter is not production-qualified**;
- the CI timeout does **not** prove Puter fails for a real interactive user, because the authentication flow is inherently interactive;
- the correct next proof is a real browser/user interaction qualification, followed by A1/tool tests, before any production integration.

Do not weaken authentication or fake an authenticated response to make CI green.

### Lifo portable browser execution candidate

`@lifo-sh/core` is documented as a browser/Node sandbox with VFS, shell, Node compatibility, npm, commands, and a programmatic `Sandbox` API. The first isolated XRAI browser integration attempted `@lifo-sh/core@0.10.17` through jsDelivr.

The probe failed before runtime execution with:

```text
SyntaxError: The requested module '/npm/@jridgewell/sourcemap-codec@1.5.3/+esm'
does not provide an export named 'encode'
```

Therefore:

- the exact jsDelivr ESM integration path is **FAIL**;
- Lifo itself is **not globally disqualified**, because this was a packaging/import-path failure before its sandbox could be exercised;
- do not replace WebContainer with Lifo until a supported build/package integration passes a real browser Node/npm/test proof on claimed devices.

Production was not changed by this probe.

## What to keep / refactor / avoid

| Subsystem | Decision | Reason |
| --- | --- | --- |
| `web/conversation-context.js` | KEEP | Goal/follow-up state already handles retry, status interruptions, and continuations usefully. |
| Existing XRAI KB retrieval | KEEP for P0 | It is genuinely wired and provides useful grounding; improve only after the working vertical slice. |
| Retrieval boundary | FORMALIZE | Curated docs, research, skills, semantic retrieval, and graph relationships should plug into one provenance-aware interface. |
| Holograim structural graph patterns | DEFER to P2 | Useful for topology/provenance, not required to get XRAI working tonight. |
| Browser ordinary chat mini-swarm | REPLACED | Planner/worker/evaluator/self-promotion added calls without real tools. Browser chat is now one context + retrieval + model turn. |
| `src/kernel.js` | KEEP + REFACTOR | Strongest existing real model/tool loop; should converge toward shared core semantics. |
| Model/provider binding | REFACTOR after qualification | Introduce a small provider seam rather than hard-coding another vendor. |
| Browser local inference | KEEP as optional fallback | Not the primary-brain architecture. |
| Browser web research | KEEP as tool adapter | Real source-linked research is useful; it should feed the same task loop. |
| `web/browser-workspace.js` WebContainer | KEEP for supported path | Real public Node/JS/TS install/test/edit/reverify. Do not replace until another execution adapter proves better. |
| Lifo candidate | RESEARCH ONLY | First CDN integration failed before sandbox execution. |
| Puter candidate | RESEARCH / interactive proof next | Official capabilities are promising; CI auth is not a valid full-user qualification. |
| Skill ledger | KEEP semantics, finish integration | Promotion requires source verification + held-out transfer improvement. |
| Model evaluator scores | ADVISORY ONLY | Never execution evidence or promotion evidence. |
| Host shell | ISOLATE before remote exposure | Workspace-rooted host processes are not an OS security sandbox. |
| Host run state | REFACTOR | In-memory Map is not restart durability. |
| Event/provenance UI | KEEP | Valuable when evidence labels remain truthful; later graph work should feed it rather than replace it. |
| MCP / CLI / browser | KEEP interfaces | They should converge on shared task/tool/evidence semantics. |
| Default multi-agent orchestration | AVOID | Add specialized workers only if evals demonstrate measurable benefit. |
| Large agent framework migration | DEFER | Current blockers do not justify wholesale migration. |

## P0 - working public XRAI tonight

The priority is a working qualified vertical slice, not architectural completeness.

1. **Capable reasoning path.** Qualify a primary browser-accessible reasoning path that needs no user model API key and does not expose an operator secret. Do not weaken A1/A11 to get there.
2. **Existing KB stays active.** Preserve and test XRAI knowledge retrieval with the qualified reasoning path. Do not build a new vector/graph stack tonight.
3. **Real tools stay real.** Preserve source-linked research and the currently proven WebContainer repo lane where supported. Any alternative execution adapter must first pass an isolated browser proof.
4. **Separate mobile chat from mobile execution claims.** A good mobile reasoning experience does not automatically prove a Node/npm sandbox on mobile. Report each capability from actual evidence.
5. **End-to-end qualification.** Exercise ordinary conversation, context/retry, research, repo inspection/test/repair, patch output, error behavior, reload/recovery, console/network behavior, and exact build identity.
6. **Deploy exact revision only after gates pass.** Production remains unchanged when a candidate probe fails.
7. **Real-device check.** Physical iPhone/Safari and Android evidence is required before claiming those devices fully supported.

### P0 decision rules

- Puter: run an interactive user-auth proof, then A1/tool/web-search checks. Adopt only if those pass and privacy/limits are acceptable.
- Lifo: do not retry the same failed CDN integration. Only test a supported packaging path if doing so is cheaper than keeping WebContainer for the release.
- OpenResponses hosted candidates: continue the existing A1 harness path when an authorized candidate credential/endpoint is available.
- Tiny local browser models: do not spend tonight tuning them as the primary brain.
- Holograim/knowledge graph: not on the critical path.

## P1 - stabilize the coherent agent

After P0 is actually live and verified:

1. put the winning model/provider behind a small provider-capability adapter;
2. converge browser/CLI/MCP/host on one task/session/tool/evidence loop;
3. run authentic A4 broken-repository repair with protected tests;
4. run full A8 held-out skill-transfer improvement and rollback;
5. make host run state/checkpoints restart-durable and verify no duplicate side effects;
6. curate/sync more verified XRAI knowledge and add explicit freshness/trust metadata;
7. establish A12 baseline measurements for retrieval versus no retrieval.

## P2 - hybrid semantic + structural memory

Only after P0/P1 evidence:

1. add semantic retrieval if A12 shows lexical retrieval materially limits relevant tasks;
2. reuse Holograim crawler/graph patterns for repository/source topology behind the same retrieval seam;
3. represent typed links among files, sources, tasks, runs, skills, verifier receipts, and outcomes;
4. expose those relations through the existing X-ray provenance UI;
5. compare hybrid retrieval against lexical-only/no-retrieval baselines for task success, context size, latency, and reliability;
6. keep graph visualization optional unless it proves task-value, not merely visual appeal.

## P3 - broader capability

Only after the foundations are repeatably successful: richer long-horizon workflows, additional execution environments, specialist workers, broader domain skills, and more advanced spatial/visual knowledge experiences.

## State-of-the-art architecture conclusions retained

### Agent loop: stay simple

`SWE-agent/mini-swe-agent` remains a useful reference: a compact bounded loop queries the model, executes explicit actions, appends observations, and saves trajectory state. Its environment executes commands independently rather than hiding state in a persistent shell.

**XRAI takeaway:** one capable model/tool loop with hard limits, explicit observations, and independent verifier receipts is the default. Do not encode a swarm to compensate for an unqualified model.

### Generic hosted-agent machinery already exists

OpenRouter's current TypeScript `@openrouter/agent` SDK supports OpenResponses, tools, stop conditions, approvals, state, timeouts/concurrency, async tasks, streaming, MCP integration, and loop protection.

**XRAI takeaway:** compare it with XRAI's existing small kernel only if generic hosted-loop machinery becomes a real burden. Do not add it for feature count.

### Durable capability seams are proven patterns

DeepSeek Harness makes model adapters, tools, session log, agent loop, filesystem/subprocess/sandbox and persistence replaceable capabilities; durable session events reconstruct model-visible state.

**XRAI takeaway:** adopt the boundary ideas without importing the whole harness unless a controlled comparison proves the migration worthwhile.

## Changes already implemented in PR #9

### Evidence-gated reusable learning

`src/skills.js` enforces source verifier -> quarantined candidate -> different related task -> no-skill baseline -> candidate reuse -> objective verifier -> measurable improvement -> promote. Model scores and repeated proposals cannot promote a skill. Legacy promotions without held-out evidence are quarantined; verified regressions can restore a prior verified version.

### Browser chat simplified

Ordinary browser conversation uses bounded context + relevant knowledge + eligible transfer-verified skills + one model answer turn. It cannot truthfully claim repo execution, deployment, or new learning on that chat-only path.

### Sandbox verification separated from learning

The WebContainer path performs real import -> dependency install -> baseline commands -> bounded edit -> re-verification -> patch output. Passing sandbox commands are execution evidence only; they do not automatically become retained learning, commits, or deployment.

### Release inference gate strengthened

`test/model-qualification.e2e.mjs` checks exact instruction following, arithmetic, conversation recall, structured tool arguments, code diagnosis, and code repair JSON. Pages release preflight blocks deployment if the active browser inference path fails.

### Provider-neutral remote-candidate harness

`test/remote-model-qualification.mjs` + `npm run qualify:remote-model` provide an opt-in OpenResponses candidate path without changing production inference or using production credentials implicitly.

### Knowledge/memory architecture now explicit

`SPEC.md` v0.2 now defines:

- existing KB retrieval as a P0 capability to preserve;
- one provenance-aware retrieval seam;
- A12 retrieval effectiveness acceptance testing;
- semantic retrieval as evidence-gated P2 work;
- Holograim structural graph reuse as P2, not tonight's blocker.

## Verification status matrix

| Product goal | Status | Evidence / blocker |
| --- | --- | --- |
| Goals-first master SPEC | PASS | SPEC v0.2 defines outcomes, knowledge contract, research invariant, acceptance cases, and priorities. |
| Follow-up goal/context handling | PASS (source) | Existing regression coverage. |
| XRAI KB is wired into browser chat | PASS (source) | Five seed files are loaded/chunked/ranked and supplied with conversation + eligible skills. |
| Retrieval quality is optimal | NOT YET VERIFIED | Lexical retrieval and tiny corpus; requires A12 comparison. |
| Holograim structural graph implementation exists | PASS (related repo evidence) | Filesystem/web/S3/GDrive crawler, SQLite, graph JSON, hierarchy/visualization documented. |
| Holograim integrated into xrai-agent | FAIL / not present | No current integration; intentionally deferred. |
| Model self-score cannot become learning proof | PASS | Evidence semantics + tests. |
| Browser -> host submission contract | PASS | Real browser/HTTP/Node subprocess CI path. |
| Public repo sandbox executes verifier commands | PASS (mechanism) | Existing WebContainer exit-code evidence. |
| Sandbox verification distinct from learning/deploy | PASS | Explicit semantics + regression protection. |
| Held-out transfer required before skill promotion | PASS (module) | Different-task + baseline-improvement + re-verification tests. |
| Shared agent/tool loop across browser/CLI/MCP | FAIL | Multiple loops still exist. |
| Durable host restart recovery | FAIL | Run manager remains in-memory. |
| Qualified primary inference path | FAIL / unresolved | Browser-local path fails CI A1; hosted/browser candidates are not yet qualified. |
| Puter official needed primitives exist | PASS (research) | GPT-5.6 Luna, tools, web search, website auth/temp-user option documented. |
| Puter real-user XRAI path | NOT YET VERIFIED | CI popup opened but interactive auth did not complete; needs real-user browser proof. |
| Lifo jsDelivr integration | FAIL | Dependency export mismatch before sandbox execution. |
| Lifo as alternative browser runtime | NOT YET VERIFIED | Different supported packaging path would need full proof; not P0 unless required. |
| Authentic model-generated broken-repo repair | NOT YET VERIFIED | Requires qualified reasoning path + protected fixture. |
| Real reusable procedure improves held-out task | NOT YET VERIFIED | Module gate exists; full experiment not yet executed. |
| Physical Android | NOT YET VERIFIED | Responsive Chromium is not physical-device evidence. |
| Physical iPhone/Safari | NOT YET VERIFIED | Must test real Safari/device. |
| Current branch deployed | NOT YET VERIFIED | Pages deploys from master and release gate remains active. |
| Full SPEC vertical slice | NOT YET VERIFIED | P0 reasoning path + real-device/deployed evidence still blockers. |

## Exact next engineering step

Do **not** start the knowledge graph implementation yet.

The next engineering work should be the cheapest real P0 route to a qualified browser reasoning path while preserving the existing KB and real execution adapters:

1. run the Puter path in an actual interactive browser/user-auth flow because the official API requires a user gesture and the CI popup test cannot complete that proof;
2. if Puter authenticates, run the same six A1 behaviors plus function-call and web-search checks and record exact model/provider/results;
3. if it fails or its limits/privacy are unacceptable, continue the existing provider-neutral hosted/OpenResponses A1 comparison rather than returning to tiny local-model tuning;
4. keep WebContainer for the currently proven supported repo lane unless it is the actual blocker; do not spend P0 time repairing Lifo CDN packaging if WebContainer is sufficient;
5. preserve KB retrieval through the chosen brain and verify at least one relevant-KB vs no-KB task before calling knowledge integration healthy;
6. then run the full deployed revision checks, including physical mobile where claimed.

Only after P0 is live should the work proceed to shared-core durability/A4/A8 and then A12-driven semantic/graph upgrades.

## Promotion safety

Before any merge:

1. fetch current `master` again;
2. inspect the latest branch CI after the final commit;
3. preserve concurrent work;
4. keep PR #9 draft while P0/full vertical-slice blockers remain;
5. never describe source green as deployment green;
6. do not convert a research candidate into a production dependency from docs or a partial probe;
7. after a future merge, verify Pages preflight, deployment, exact revision, desktop flows, and claimed real-mobile flows separately.
