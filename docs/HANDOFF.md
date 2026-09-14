# XRAI Agent architecture and execution handoff

Assessment updated: 2026-09-13. Implementation target: **JT5D/xrai-agent only**.

Start with `../SPEC.md`. It is the product contract and intentionally does not freeze the implementation. The dated model/runtime research is in `MODEL_RUNTIME_RESEARCH_2026-09-13.md`.

## Current repository state

- `master` remains `6cff7e7c1be02e5b75b58e96f8b83830bbc38213` as of the latest comparison in this session.
- Work remains isolated on `work/shared-loop-evidence-20260913` in draft PR #9.
- Source CI run `34795600449` passed on commit `5f23fcba18926668550f52892e83fb9d4c6dab26` after the research-before-change invariant was added to `SPEC.md`.
- Later commits in this branch are documentation/research updates; inspect the latest CI again before promotion.
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

**Tier 1 — evaluate first, do not promote yet**

- **Nex-N2.5-mini** — Apache-2.0 open weights; purpose-built for agentic coding/browser/computer use; current OpenRouter free endpoint advertises tools and JSON-schema structured output. Official self-host example requires 2x H100. Vendor-reported agent/coding benchmarks are promising but are not XRAI evidence.
- **Nex-N2.5-Pro** — Apache-2.0; stronger vendor-reported agent/coding scores; official self-host example requires 8x H100. Evaluate only as escalation if mini misses XRAI quality targets.

**Tier 2 — re-screen if Tier 1 fails or deployment strategy changes**

- DeepSeek V4 Pro — MIT open weights, server-class.
- GLM-5.3 / GLM-5.3-Flash — current agent/coding-oriented server-class family; verify the exact artifact/license and hosted route at adoption time.
- Kimi K3 — current large multimodal/agent model with Kimi K3 license; server-class.
- Other current free/OpenRouter models (including Nemotron variants) should be screened from current model metadata when the benchmark is run, not assumed from an old list.

### Free weights != free production inference

OpenRouter currently provides Nex Mini/Pro free endpoints, but programmatic use requires an API key. OpenRouter documents free-model limits of 50 requests/day on a free account, or 1000/day after at least $10 of credits are purchased, and explicitly describes free models as generally unsuitable for production workloads.

Therefore:

- never expose an operator provider key in GitHub Pages;
- do not call a temporary free tier a production guarantee;
- a no-user-key hosted public product requires an operator-controlled backend/edge secret, or self-hosted inference;
- private code must not be sent to a provider unless its data policy is explicitly approved.

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

### Research-before-change rule added

`SPEC.md` now explicitly requires current research + candidate benchmarking before material model/provider/harness/runtime changes.

## Verification evidence

- Skill-learning focused module harness: **8/8 PASS**; it caught a real rollback restoration defect that was fixed before promotion.
- Source CI run `34795600449`: **PASS** on `5f23fcba...`, including `npm run check` and the real browser->server execution contract.
- Current `master` was rechecked and still equals the branch base `6cff7e7...`; no concurrent master commit is being overwritten at this point.
- Active browser inference: **FAIL in CI qualification environment** for the tested local path. This intentionally blocks release under the stronger preflight.
- Authentic unmocked A4 repair and A8 transfer experiment: **NOT YET VERIFIED**.
- No claim is made that the branch or public deployment is fully fixed.

## Acceptance matrix

| Product goal | Status | Evidence / blocker |
| --- | --- | --- |
| Goals-first SPEC without frozen stack | PASS | SPEC defines outcomes and now includes research-before-change invariant. |
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
| Qualified primary inference path | FAIL / unresolved | Current browser-local path fails CI A1; hosted candidates are researched but not yet XRAI-qualified. |
| Authentic model-generated broken-repo repair | NOT YET VERIFIED | Requires candidate model path + protected fixture. |
| Real reusable procedure improves held-out task | NOT YET VERIFIED | Module gate exists; full experiment not wired/executed. |
| Physical Android | NOT YET VERIFIED | Responsive Chromium is not physical-device evidence. |
| Physical iPhone/Safari | NOT YET VERIFIED | Must test real Safari/device. |
| Current branch deployed | NOT YET VERIFIED | Pages only deploys from master and preflight currently protects release. |
| Full SPEC vertical slice | NOT YET VERIFIED | A4 + A8 + durable/session convergence remain blockers. |

## Exact next engineering step

Do not add another browser model and do not weaken the qualification gate.

Build the **smallest provider-neutral remote-candidate seam**, preserving production defaults:

```text
model provider config
  -> OpenResponses-compatible request adapter
  -> provider capability declaration
  -> existing bounded XRAI tools / execution adapters
  -> objective verifier receipts
  -> candidate qualification report
```

The existing host kernel already speaks OpenAI Responses semantics, and OpenRouter now exposes an OpenResponses-compatible `/api/v1/responses` endpoint. Therefore the first experiment should be a small adapter/configuration seam—not a new agent framework.

Important portability rule: provider-specific server tools must stay behind the provider adapter. For example OpenAI `web_search` and OpenRouter `openrouter:web_search` are not a shared portable tool definition. XRAI's own user-defined tools should remain provider-neutral.

Then, with an authorized server-side candidate credential:

1. run A1 against **Nex-N2.5-mini**;
2. if it passes, run a pinned A4 broken-repo fixture with unchanged failing + protected tests;
3. run the second related A8 fixture with a no-skill baseline and candidate-skill trial;
4. only if all pass, compare Mini with Pro on quality/latency/reliability and choose from measured evidence;
5. if both fail, re-screen the current frontier list rather than tuning the gate around them.

No production model/provider changes until that evidence exists.

## Promotion safety

Before any merge:

1. fetch current `master` again;
2. inspect the latest branch CI after the final commit;
3. preserve concurrent work;
4. keep PR #9 draft while the shared-core/real-repair blockers remain;
5. never describe source green as deployment green;
6. after a future merge, verify Pages preflight, deployment, and live browser flows separately.
