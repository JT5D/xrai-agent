# XRAI Agent architecture and execution handoff

Assessment updated: 2026-09-13. Implementation target: **JT5D/xrai-agent only**.

Start with `../SPEC.md`. It is the product contract and intentionally does not freeze the implementation. The dated model/runtime research is in `MODEL_RUNTIME_RESEARCH_2026-09-13.md`.

## Current repository state

- `master` remains `6cff7e7c1be02e5b75b58e96f8b83830bbc38213` as of the latest comparison in this session.
- Work remains isolated on `work/shared-loop-evidence-20260913` in draft PR #9.
- Source CI run `34795956458` passed on commit `dfee2488d96caebf05416819ec36199013a5c751`, including `npm run check` and the real browser->server execution contract. The remote-candidate harness is syntax-checked but no external provider is called by CI.
- Later documentation/research commits should be rechecked before promotion.
- The branch is **not deployed** and this document does not claim the public product is fixed.

## Governing engineering rule

No more speculative model swaps or bespoke architecture by intuition.

Before changing a model, provider, harness, execution runtime, memory mechanism, or comparable material architecture choice:

1. inspect current primary sources and proven maintained implementations;
2. record license, compute/deploy requirements, tool/structured-output support, privacy/data policy, limits, latency/availability when available, and cost implications;
3. distinguish open weights from genuinely free hosted inference;
4. benchmark shortlisted candidates through XRAI acceptance cases;
5. qualify **model + harness + tools + execution environment together**;
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
 one bounded agent/tool loop
        |
 provider-neutral model adapter
        +
 real tool adapters
        |
 execution environment adapter
        |
 independent verifier receipts
        |
 evidence ledger + transfer-verified reusable learning
```

This is an architecture boundary, not a framework mandate.

### What to keep / refactor / avoid

| Subsystem | Decision | Reason |
| --- | --- | --- |
| `web/conversation-context.js` | KEEP | Goal/follow-up state already handles retry, status interruptions, and continuations usefully. |
| Browser ordinary chat mini-swarm | REPLACED | Planner/worker/evaluator/self-promotion added calls without real tools. Browser chat is now one context + retrieval + model turn. |
| `src/kernel.js` | KEEP + REFACTOR | Strongest existing real model/tool loop; should converge toward shared core semantics. |
| Model/provider binding | REFACTOR | Current host path is OpenAI-specific. Introduce a small provider seam rather than hard-coding another vendor. |
| Browser local inference | KEEP as optional fallback | Useful only when measured device/task requirements are met. It is not the primary-brain architecture. |
| Browser web research | KEEP as tool adapter | Real source-linked research is useful; it should feed the same task loop. |
| `web/browser-workspace.js` WebContainer | KEEP as execution adapter | Real public Node/JS/TS install/test/edit/reverify. It is not durable learning, a Git commit, or deployment. |
| Skill ledger | KEEP semantics, finish integration | Promotion now requires source verification + held-out transfer improvement. Main loop still lacks the full authentic two-task trial path. |
| Model evaluator scores | ADVISORY ONLY | Never execution evidence or promotion evidence. |
| Host shell | ISOLATE before remote exposure | Workspace-rooted host processes are not an OS security sandbox. |
| Host run state | REFACTOR | In-memory Map is not restart durability. |
| Event/provenance UI | KEEP | Valuable when evidence labels remain truthful. |
| MCP / CLI / browser | KEEP interfaces | They should converge on shared task/tool/evidence semantics. |
| Default multi-agent orchestration | AVOID | Add specialized workers only if evals demonstrate measurable benefit. |
| Large agent framework migration | DEFER | Mature projects offer useful patterns, but current problems do not justify wholesale migration yet. |

## State-of-the-art research conclusions

### Agent loop: stay simple

`SWE-agent/mini-swe-agent` provides a useful reference: a compact bounded loop repeatedly queries the model, executes explicit actions, appends observations, and saves trajectory state. Its environment executes commands independently rather than hiding state in a persistent shell.

**XRAI takeaway:** one capable model/tool loop with hard limits, explicit observations, and independent verifier receipts is the default. Do not encode a swarm to compensate for an unqualified model.

### Generic hosted-agent machinery already exists

OpenRouter's current TypeScript `@openrouter/agent` SDK supports OpenResponses, tools, stop conditions, approvals, state, timeouts/concurrency, async tasks, streaming, MCP integration, and loop protection.

**XRAI takeaway:** if generic hosted-loop machinery becomes necessary, compare that SDK with XRAI's existing small kernel before reimplementing the same features. Do not add the dependency merely for feature count.

### Durable capability seams are proven patterns

DeepSeek Harness makes model adapters, tools, session log, agent loop, filesystem/subprocess/sandbox and persistence replaceable capabilities; durable session events reconstruct model-visible state. It is also explicitly a rapidly changing developer preview.

**XRAI takeaway:** adopt the boundary ideas—durable session facts and replaceable capability seams—without importing the whole harness unless a controlled comparison proves the migration worthwhile.

Anthropic/OpenHands/MCP research continues to support the same direction: separate brain/session/harness from hands/sandbox; evaluate environment outcomes; retain standard tool interfaces; make long-running state explicit.

## Model research result

See `MODEL_RUNTIME_RESEARCH_2026-09-13.md` for the full dated record.

### Browser-local inference decision

The previous browser-model search is closed as a **primary-brain** strategy.

Real CI evidence in this session showed:

- the active SmolLM2 135M browser path failed the first bounded exact-instruction qualification case in the tested CI Chromium environment;
- an off-path LFM2.5 1.2B WebGPU Q4 candidate loaded but still could not finish the first tiny bounded response within the 45-second case limit after output was limited to 12 tokens.

This is environment-specific evidence, not a claim that those models are intrinsically bad. It is enough to stop blind browser-model swapping. Physical iPhone/Android behavior remains a separate unverified question.

### Current hosted/open shortlist

Do **not** assume one model wins from size, novelty, model-card benchmarks, or popularity. Run the same XRAI harness against the same small candidate set.

**Tier 1 — benchmark side by side, do not promote yet**

- **Nex-N2.5-Mini free** — Apache-2.0 open weights, agentic coding/browser/computer-use focus, current free route explicitly advertises tools/tool choice + JSON-schema output, and recent route availability is high. Official self-host example still requires 2x H100.
- **NVIDIA Nemotron 3 Super free** — open 120B/12B-active agent-oriented MoE; current free route explicitly advertises tools/tool choice + JSON-schema output. Recent route telemetry is materially faster than current Nex Pro but still shows non-trivial tool/structured-output error, so only XRAI A1 decides whether it is suitable.
- **GLM-5.3-Flash free, conditional** — current 1M-context coding/agent route. The free route page inspected here did not explicitly prove the exact tool/structured-output interface required by XRAI, although related GLM-5.3 Flash routes do. Include it only if current exact-route metadata confirms the required function semantics before the test.

**Quality escalation / comparison**

- **Nex-N2.5-Pro free** — stronger vendor-reported agent/coding scores but current route telemetry is much slower and less reliable than the smaller/faster candidates. It is a useful quality comparison, not a presumed winner.

**Deprioritized from the first free set**

- Nemotron 3 Ultra free: tools but no enforced `response_format` on the inspected free route; the route also explicitly warns against confidential/personal data and logs use for security/product improvement.
- MiniMax M3 free: current route is agent-oriented but the inspected endpoint does not accept `tools`.
- DeepSeek V4 Pro, GLM-5.3, Kimi K3, large Qwen families and other paid/self-hosted frontier models remain re-screen candidates if the free Tier-1 set fails or deployment constraints change.

### Free weights != free production inference

OpenRouter currently exposes several strong zero-token-price routes, but programmatic access requires an API key and free routes are rate limited. OpenRouter documents 50 free-model requests/day for a free account, or 1000/day after at least $10 of credits is purchased, and describes free models as generally unsuitable for production.

Therefore:

- never expose an operator provider key in GitHub Pages;
- do not call a temporary free tier a production guarantee;
- a no-user-key hosted public product requires an operator-controlled backend/edge secret, or self-hosted inference;
- private code must not be sent to a provider unless its exact provider/data-retention route is explicitly approved.

## Changes implemented in PR #9

### Evidence-gated reusable learning

`src/skills.js` now enforces:

```text
source task
  -> safe objective verifier passes
  -> quarantined candidate
  -> different related task
  -> no-skill baseline
  -> candidate reuse
  -> objective verifier passes
  -> measurable improvement
  -> promote
```

Model scores, repeated proposals, or a source-task success cannot promote a skill. Legacy promotions without held-out evidence are quarantined. Verified regressions can restore a prior transfer-verified version.

### Browser chat simplified

Ordinary browser conversation now uses bounded context + relevant knowledge + eligible transfer-verified skills + one model answer turn. It cannot truthfully claim repo execution, deployment, or new learning on that chat-only path.

### Sandbox verification separated from learning

The WebContainer path still performs real import -> dependency install -> baseline commands -> bounded edit -> re-verification -> patch output. Passing sandbox commands are execution evidence only; they do not automatically become retained learning, commits, or deployment.

### Capability claims corrected

README/UI language now distinguishes browser chat, browser sandbox execution, host-side learning, commits, and deployment.

### Release inference gate strengthened

`test/model-qualification.e2e.mjs` checks the real active browser inference path for:

1. exact instruction following;
2. arithmetic;
3. conversation recall;
4. structured tool arguments;
5. code diagnosis;
6. code repair JSON.

PR/source CI intentionally no longer reruns known-weak browser models on every commit. GitHub Pages **release preflight** runs the six-case real-model qualification and blocks deployment if it fails.

### Provider-neutral remote-candidate A1 harness added

`test/remote-model-qualification.mjs` and `npm run qualify:remote-model` provide an opt-in OpenResponses-compatible comparison path without changing production inference.

It requires explicit candidate endpoint/model configuration, never consumes production keys implicitly, permits unauthenticated HTTP only on loopback for self-hosted testing, and measures the same six foundational capabilities including real function-call arguments. Normal CI syntax-checks it but does not contact an external model provider.

### Research-before-change rule added

`SPEC.md` now explicitly requires current research + candidate benchmarking before material model/provider/harness/runtime changes.

## Verification evidence

- Skill-learning focused module harness: **8/8 PASS**; it caught a real rollback restoration defect that was fixed before promotion.
- Source CI run `34795956458`: **PASS** on `dfee2488...`, including `npm run check` and the real browser->server execution contract after the remote-candidate harness was added/fixed.
- Current `master` was rechecked and still equals the branch base `6cff7e7...`; no concurrent master commit was being overwritten at the latest check.
- Active browser inference: **FAIL in CI qualification environment** for the tested local path. This intentionally blocks release under the stronger preflight.
- Remote hosted/open candidates: **NOT YET RUN** because no authorized candidate-only provider credential or self-hosted endpoint is available in this session.
- Authentic unmocked A4 repair and A8 transfer experiment: **NOT YET VERIFIED**.
- No claim is made that the branch or public deployment is fully fixed.

## Acceptance matrix

| Product goal | Status | Evidence / blocker |
| --- | --- | --- |
| Goals-first SPEC without frozen stack | PASS | SPEC defines outcomes and includes research-before-change invariant. |
| Follow-up goal/context handling | PASS (source) | Existing regression coverage. |
| Browser chat retrieval/context wiring | PASS (source) | Static/source tests; answer quality remains model-dependent. |
| Model self-score cannot become learning proof | PASS | Evidence semantics + tests. |
| Browser -> host submission contract | PASS | Real browser/HTTP/Node subprocess CI path. |
| Public repo sandbox executes real verifier commands | PASS (mechanism) | WebContainer exit-code evidence. |
| Sandbox verification distinct from learning/deploy | PASS | Explicit semantics + regression protection. |
| Source verifier gate for skills | PASS (module) | Focused harness/tests. |
| Held-out transfer required before promotion | PASS (module) | Different-task + baseline-improvement + re-verification tests. |
| Shared agent/tool loop across browser/CLI/MCP | FAIL | Multiple loops still exist. |
| Durable host restart recovery | FAIL | Run manager remains in-memory. |
| Qualified primary inference path | FAIL / unresolved | Current browser-local path fails CI A1; remote candidates are researched and harnessed but not yet executed. |
| Authentic model-generated broken-repo repair | NOT YET VERIFIED | Requires a candidate model path + protected fixture. |
| Real reusable procedure improves held-out task | NOT YET VERIFIED | Module gate exists; full experiment not wired/executed. |
| Physical Android | NOT YET VERIFIED | Responsive Chromium is not physical-device evidence. |
| Physical iPhone/Safari | NOT YET VERIFIED | Must test real Safari/device. |
| Current branch deployed | NOT YET VERIFIED | Pages only deploys from master and preflight currently protects release. |
| Full SPEC vertical slice | NOT YET VERIFIED | A4 + A8 + durable/session convergence remain blockers. |

## Exact next engineering step

Do not add another browser model, do not weaken the gate, and do not choose a favorite model from vendor benchmarks.

The provider-neutral A1 harness now exists. With an **authorized candidate-only server-side credential or local self-hosted OpenResponses endpoint**, run exactly the same harness against:

1. `nex-agi/nex-n2.5-mini:free`;
2. `nvidia/nemotron-3-super-120b-a12b:free`;
3. `z-ai/glm-5.3-flash:free` only if the exact current route declares the required function/tool semantics;
4. `nex-agi/nex-n2.5-pro:free` as a quality escalation/comparison.

Pass/fail the six A1 capabilities first. Among passing candidates, compare measured latency, function-argument reliability, route availability, privacy constraints and operational limits. Only the objective winner(s) advance to a pinned A4 broken-repo fixture and then the held-out A8 skill-transfer experiment.

If this Tier-1 set fails, re-screen the current frontier landscape instead of tuning XRAI's gate around a model.

No production model/provider changes until that evidence exists.

## Promotion safety

Before any merge:

1. fetch current `master` again;
2. inspect the latest branch CI after the final commit;
3. preserve concurrent work;
4. keep PR #9 draft while the shared-core/real-repair blockers remain;
5. never describe source green as deployment green;
6. after a future merge, verify Pages preflight, deployment, and live browser flows separately.
