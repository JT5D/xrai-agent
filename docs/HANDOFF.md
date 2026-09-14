# XRAI Agent architecture and execution handoff

Assessment date: 2026-09-13. Implementation target: **JT5D/xrai-agent only**. Start with `../SPEC.md`; it remains the product contract and does not freeze the implementation.

## Current source state

The authoritative `master` at the start of this pass was `6cff7e7c1be02e5b75b58e96f8b83830bbc38213`. Work is isolated on `work/shared-loop-evidence-20260913` in draft PR #9. Always fetch `master` again before promotion; do not overwrite concurrent work.

`SPEC.md` was re-read against the current repository and still captures the intended product: continuing goal/context, real research and tools, plan -> execute -> verify, explicit evidence categories, durable recovery, and verified compounding rather than model self-scoring. No spec rewrite was needed.

## Architecture audit and decision

The target remains deliberately small:

```text
browser / CLI / MCP / host
        |
 task + session state
        |
 one shared agent/tool loop
        |
 model adapter + real tool adapters
        |
 execution environment
        |
 independent verifier
        |
 evidence + transfer-verified reusable learning
```

This is a direction, not a framework mandate. The current repository is not there yet.

| Subsystem | Decision | Evidence / reason |
| --- | --- | --- |
| `web/conversation-context.js` | KEEP | Useful goal/follow-up state already covers retry, “do it”, and related continuations. |
| Browser ordinary chat mini-swarm | REPLACE - DONE in PR | Planner/worker/evaluator/self-promotion added calls without real tools and disconnected conversation from retrieval. Browser chat is now one context + retrieval + model turn. |
| `src/kernel.js` host tool loop | KEEP + REFACTOR | Strongest existing real model/tool loop. It should become the shared core, but browser repo/chat still bypass it today. |
| Browser web research | KEEP as adapter | Real source-linked research is useful; it should feed the same task loop rather than define a separate architecture. |
| `web/browser-workspace.js` WebContainer | KEEP as execution adapter | It performs real public Node/JS/TS install/commands/edits/re-verification. It is not durable learning or deployment. |
| Skill ledger / promotion | REPLACE promotion semantics - DONE in PR | Source verification alone and model scores were not enough evidence. Promotion now requires verified held-out transfer that objectively beats a baseline. |
| Model evaluator scores | ADVISORY ONLY - DONE in PR | Self-scores no longer count as skill usage, promotion evidence, or meta-learning evidence. |
| Host process shell | REPLACE / ISOLATE before remote exposure | It runs host processes rooted at the workspace; it is not an OS security sandbox. |
| Host run persistence | REFACTOR | In-process Map state is not host-restart durability. Browser UI recovery is a separate guarantee. |
| Event/provenance UI | KEEP | Inspectable tool/evidence events are valuable if labels remain truthful. |
| MCP / CLI / browser interfaces | KEEP as interfaces | They should converge on the shared task loop rather than own divergent orchestration logic. |
| Default multi-agent orchestration | REMOVE / avoid | No evidence justifies default swarms. Add specialized roles only when an eval proves measurable benefit. |

**Architecture decision:** REFACTOR around a shared task/session + agent/tool loop. Do not rebuild the whole product and do not import a large agent framework yet. Replace disconnected or misleading pieces incrementally behind working interfaces.

## State-of-the-art review: decisions that changed implementation

Recent primary/current sources support the same direction:

- Anthropic, *Scaling Managed Agents: Decoupling the brain from the hands* (2026): stable session/harness/sandbox interfaces should outlive a particular harness. https://www.anthropic.com/engineering/managed-agents
- Anthropic, *Demystifying evals for AI agents* (2026): evaluate the model and harness together and grade actual environment outcomes, not claims in the transcript. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Anthropic, *Effective harnesses for long-running agents*: preserve explicit progress artifacts across context windows and make incremental verified progress. https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Anthropic, *Building effective agents*: prefer simple composable patterns; add framework/agent complexity only when it measurably helps. https://www.anthropic.com/engineering/building-effective-agents
- OpenHands SDK/runtime docs: mature workspace/session abstractions are candidates if managed execution becomes the dominant burden; do not import the full stack without evidence. https://docs.openhands.dev/sdk
- MCP specification: retain MCP as a standard tool/interface boundary rather than coupling product semantics to a specific host. https://modelcontextprotocol.io/specification
- Agent Skills specification: a portable skill package is useful structure, but a `SKILL.md` is not verification evidence or tool authority. https://agentskills.io/specification
- WebContainer support documentation: browser/mobile runtime support and memory limits need explicit device qualification. https://developer.stackblitz.com/platform/webcontainers/browser-support

No framework was adopted in this pass. The highest-leverage fixes were simpler than a migration.

## Changes implemented in PR #9

### 1. Transfer-verified learning gate

`src/skills.js` now distinguishes model observations from evidence:

- model/evaluator scores may propose a candidate but cannot promote it;
- repeated model proposals cannot promote it;
- a safe objective source-task verifier must pass before transfer evaluation;
- promotion requires reuse on a **different related task**;
- the with-skill run must objectively beat a no-skill baseline;
- an objective verifier must re-check the held-out result;
- only then is the skill marked `transferVerified:true` and retrievable;
- legacy promoted entries without transfer evidence are quarantined;
- verified regressions can roll back to the prior transfer-verified version;
- unverified run observations do not drive meta-maintenance.

A focused local module harness passed 8/8 and caught a real rollback bug: superseding v1 with v2 originally made v1 ineligible for restoration. That was fixed before PR CI.

### 2. Browser chat simplified

`web/local-agent.js` no longer runs a default planner/worker/evaluator/self-promotion loop for ordinary conversation. It now:

1. receives continuing conversation/goal context;
2. retrieves relevant XRAI knowledge and only transfer-verified skills;
3. performs one model answer turn;
4. explicitly forbids claims of repo execution, deployment, or self-improvement on that chat-only path;
5. reports `learning:none` and no model self-score as evidence.

The existing browser fallback model was intentionally **not changed**. A temporary default-model change was reverted because the specification requires model qualification before changing inference behavior.

### 3. Sandbox verification separated from learning

`web/browser-workspace.js` still performs real WebContainer import -> install -> baseline commands -> bounded edit -> re-verification -> patch output. It now reports sandbox verification separately and returns `learning:none`; a passing sandbox patch is no longer mislabeled as retained learning.

### 4. Capability claims corrected

`README.md` and the public UI no longer claim that browser chat self-improves or that all execution modes already use the same kernel. The UI now describes host-side transfer-gated learning and browser retrieval honestly.

### 5. Model qualification is now a PR gate

`test/model-qualification.e2e.mjs` exercises the actual browser inference path with six deterministic checks:

1. exact instruction following;
2. arithmetic sanity;
3. conversation recall;
4. structured tool-argument JSON;
5. simple code diagnosis;
6. simple code repair JSON.

`.github/workflows/ci.yml` runs this real-model suite in Chromium and uploads the evidence artifact. A candidate inference path must pass before it is trusted for the repair/learning vertical slice.

## Verification evidence

- Focused skill-learning module harness: **8/8 PASS** locally in this session.
- PR source CI run `34792731069`: **PASS** (`npm run check` + browser-to-server execution contract) on the browser-chat/learning refactor before the final evidence-label cleanup.
- PR source CI run `34792828380`: **PASS** after sandbox verification was separated from learning.
- Later PR commits add capability-label regression tests and the real-model qualification job. Inspect the latest PR head before relying on earlier green runs.
- No claim is made that a real model has completed the required broken-repository repair/learning transfer slice yet.

## Acceptance matrix

Status refers to evidence available for the current architecture, not intended future behavior.

| Product goal | Status | Evidence / blocker |
| --- | --- | --- |
| SPEC captures goals without freezing stack | PASS | Re-read against current repo; no conflicting architecture mandate found. |
| Follow-up goal/context handling | PASS | Existing conversation-context regression coverage remains in source CI. |
| Ordinary browser chat receives retrieval/context | PASS (wiring) | Source/static tests cover retrieval path; answer quality remains model-gated. |
| Browser chat cannot call a self-score “learning” | PASS | New source semantics + regression test. |
| Server browser->host submission contract | PASS | Real browser/HTTP/Node subprocess contract passed in PR CI. |
| Public repo sandbox runs real verifier commands | PASS (mechanism) | WebContainer path records command exit-code evidence; prior deployed E2E exists. |
| Sandbox verification is distinct from learning/deploy | PASS | New explicit verification state and regression test. |
| Skill source-verifier gate | PASS (module) | Focused 8/8 harness + source tests. |
| Held-out transfer gate before promotion | PASS (module) | Different-task + baseline-improvement + re-verifier tests. |
| Shared single agent/tool loop across browser/CLI/MCP | FAIL | Multiple execution loops still exist. This is the next architectural convergence work. |
| Host restart durability | FAIL | Run manager is still in-process; browser reload recovery is not equivalent. |
| Qualified browser inference path | NOT YET VERIFIED | New six-case PR gate is the deciding evidence. Prior public model-runtime evidence was not sufficient. |
| Authentic model-generated broken-repo repair | NOT YET VERIFIED | Must wait for a qualified inference path, then use a deterministic fixture with unchanged failing/protected tests. |
| Real learned procedure reused on a second task and measurably better than baseline | NOT YET VERIFIED | Promotion semantics now support the proof; the real two-task experiment has not yet passed. |
| Physical Android | NOT YET VERIFIED | Chromium mobile emulation is not physical-device evidence. |
| Physical iPhone/Safari | NOT YET VERIFIED | Never infer from viewport emulation or Android results. |
| Current branch deployed publicly | NOT YET VERIFIED | Pages deployment remains gated by real-model preflight and only runs from `master`. |
| Full SPEC vertical slice | NOT YET VERIFIED | Do not call XRAI “fixed” until repair + held-out learning reuse pass end to end. |

## First required vertical slice: next executable step

Do **not** add more architecture before the inference gate reports. If the six-case model qualification passes, immediately run one deterministic broken Node fixture through the real path:

```text
pinned fixture
-> failing unchanged verifier
-> model sees real files/failure
-> bounded source edit
-> unchanged verifier passes
-> protected test passes
-> valid patch
-> source-task candidate retained
-> different related fixture baseline
-> retrieve candidate
-> verified comparison
-> promote only if objectively better
```

If model qualification fails, do not tune around the test or resume blind model swapping. Treat that as evidence that the current anonymous-browser inference path is not good enough. Evaluate the smallest stronger architecture, including an explicitly documented operator-hosted inference path, while preserving the no-install/no-user-key UX requirement. Do not silently introduce paid infrastructure.

## Promotion safety

Before merging this PR:

1. fetch current `master` and compare it with the branch base;
2. require latest source CI results, including model qualification;
3. preserve any concurrent master work;
4. keep the PR draft if the model gate or source checks fail;
5. do not describe source green as deployed green;
6. after any eventual merge, inspect Pages preflight/deploy/live E2E separately.

The highest-leverage unresolved question is now empirical and small: **is any currently available inference path good enough for the six deterministic capabilities and then the authentic repair slice?** Everything else should wait for that answer.