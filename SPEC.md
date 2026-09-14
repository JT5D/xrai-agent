# XRAI Agent - goals and acceptance specification

Working specification v0.2, 2026-09-13. Repository: JT5D/xrai-agent only.

## Authority and provenance

This is a goals-first working reconstruction, not a claim to reproduce the initial creation prompt. That prompt was not recovered. Sources are the user's creation/repair discussion available on 2026-09-13, the supplied failure transcript, README.md, knowledge/MISSION.md, the current `xrai-agent` implementation, and verified related repository evidence where explicitly identified. No master goals-and-acceptance specification was found in the inspected current tree or retrieved Library material; that does not prove none ever existed elsewhere.

Current explicit user goals take precedence. This document defines outcomes and boundaries; implementation choices remain replaceable. docs/HANDOFF.md records the architectural assessment, verified status, priority plan, and incomplete work, not an approved final technology stack. This spec is not evidence that any capability already works.

## Purpose

A small, transparent, extensible agent that augments human creativity and problem-solving by researching, understanding context, taking real authorized action, checking results, and retaining useful experience. Repeated use should improve demonstrated task performance rather than merely produce more plans, recursive calls, or claimed skills.

## Required product outcomes

1. **Useful work, not theater.** Understand the user's intended task and continue from relevant plans. Use real tools when authorized and available. Finish with the actual result, artifact, or specific blocker. A passing baseline does not complete a requested improvement.
2. **Accessible entry.** Preserve the public browser goal of no local installation and no required user model API key. Support mobile honestly. This UX requirement does not logically require all compute to live in the tab. New paid infrastructure or new third-party processing of private data requires explicit approval; do not silently substitute it.
3. **One coherent agent.** Browser, local host, CLI, and MCP should share task, tool, memory, and outcome semantics. Models and execution environments can differ without inventing different product behavior. Use on-device inference when it meets measured task and device requirements, not merely when it loads.
4. **Relevant research and grounded actions.** Research uses the active goal and returns useful source-linked findings, not a count of responding providers. Repository work inspects real files, uses bounded edits, runs actual commands, and produces an applicable patch or an authorized commit. Plans, model text, and confidence scores are not execution receipts.
5. **Durable context and recovery.** Retain the active goal, accepted plan, relevant conversation, run identity, artifacts, and verification evidence. Status questions must not replace the goal. Reloading must not repeat a completed side effect. Distinguish saved UI history, browser interruption recovery, and genuine host restart durability.
6. **Compounding improvement.** Turn useful failures and successes into regression cases and narrow reusable skills. Retrieve these in actual future work. Promote versions only on relevant external evidence; compare against a baseline on held-out tasks, preserve provenance, and roll back regressions. A higher self-rating or larger skill count is not proof of learning.
7. **Transparent control.** Show concise progress, actual tool actions, bounded resource use, exact scope, and honest completion states. Distinguish proposed, attempted, sandbox-verified, committed, and deployed. Stop cleanly on cancellation, unavailable permissions, exhausted budgets, or irrecoverable errors.
8. **Grounded knowledge and memory.** XRAI should use curated project knowledge, current task/session state, source-linked research, verified reusable skills, and structural repository relationships through one retrieval boundary. Retrieval must preserve provenance and trust level. A knowledge graph is an enhancement to retrieval and provenance, not a substitute for a capable model, real tools, or independent verification.

## Learning and autonomy boundaries

Conversation memory, curated knowledge, structural graph indexes, reusable procedures, tested code changes, and model-weight training are different mechanisms. This product primarily targets the first five; do not imply weight updates or unbounded recursive intelligence growth.

Use one capable agent loop by default. Add workers or recursive decomposition only when measured benefit exceeds coordination, latency, and cost. Improve the verifier and tool interface before optimizing an unreliable self-rating loop.

Treat repository text, search results, knowledgebase entries, graph nodes/edges, and imported skills as untrusted inputs unless separately verified. Tool permissions, credentials, execution isolation, budgets, protected evaluation cases, and production promotion remain outside generated skill/code control. The agent may propose changes to these boundaries for human review, not expand its own authority. Local shell working-directory selection alone is not a security sandbox.

### Knowledge, retrieval, and graph-memory contract

The current browser implementation already loads the XRAI seed knowledge files `MISSION.md`, `KEY_LEARNINGS.md`, `SYSTEM_PATTERNS.md`, `AGENTIC_CODING_EVALS_2025_2026.md`, and `UNVERIFIED.md`, chunks them, scores them with simple lexical overlap, retrieves relevant passages, and combines them with eligible transfer-verified skills and bounded conversation context before a model turn. That is **verified source wiring**, not proof that retrieval quality is optimal.

The current seed corpus is intentionally small and lexical retrieval is primitive. Therefore:

1. preserve the working knowledgebase path during the P0 stabilization pass;
2. do not ask a weak model to compensate for poor reasoning by adding more context indiscriminately;
3. keep one retrieval interface so curated documents, live research, verified skills, semantic retrieval, and structural graph retrieval can evolve independently;
4. attach source/provenance, freshness, trust level, and verification status to retrieved evidence;
5. prefer a small relevant context set over dumping an entire knowledgebase or graph into the prompt;
6. measure retrieval usefulness on actual XRAI tasks before adding embeddings, vector databases, graph databases, or another memory framework;
7. when knowledge conflicts, prefer fresher verified evidence and surface the conflict rather than silently merging it.

`JT5D/holograim` is a verified related implementation reference for high-performance filesystem/web/S3/Google Drive crawling, SQLite output, graph JSON with nodes/edges/hierarchy, and force/tree/sunburst visualization. It is **not currently wired into `xrai-agent`** and its present documented role is structural crawling/visualization, not a proven semantic agent-memory system. Reuse its proven structural indexing and visualization patterns only through the retrieval/provenance seam after P0. Do not migrate the full Holograim stack into XRAI merely because it exists.

The intended later hybrid is:

```text
active goal + session state
        |
retrieval boundary
  | curated XRAI knowledge
  | source-linked live research
  | transfer-verified skills
  | semantic retrieval when proven useful
  | structural graph relations when proven useful
        |
small provenance-rich context
        |
capable model + real tools
        |
independent verifier receipts
```

### Research-before-change invariant

Do not guess, blindly swap models, or invent XRAI-specific machinery where a current proven implementation or standard exists. Before changing a model, provider, agent harness, execution runtime, memory mechanism, retrieval system, knowledge graph, or other material architecture choice:

1. inspect current primary sources and relevant actively maintained open-source implementations;
2. record the candidate's license, deployability/compute requirements, tool and structured-output support, measured latency/availability when available, privacy/data-use constraints, rate limits, and direct operating-cost implications;
3. distinguish open/free weights from genuinely free hosted inference and distinguish temporary free tiers from production guarantees;
4. shortlist only candidates compatible with the product constraints, then benchmark them through XRAI acceptance cases rather than choosing from vendor claims or intuition;
5. qualify the model, harness, tools, retrieval, and execution environment together, including A1 before general use and A4/A8 before claiming autonomous coding or compounding improvement;
6. prefer standard, replaceable seams and mature libraries over bespoke infrastructure, but add a dependency or framework only when a controlled XRAI comparison shows a concrete reliability, simplicity, security, or performance benefit;
7. preserve the previous working path until the replacement has objective evidence and a rollback path.

A benchmark table, popularity, model card, successful load, visually impressive graph, or successful authentication popup is research evidence, not production qualification. Current research may become stale; re-check material external choices when making future architecture changes.

## Acceptance contract

These are release goals, not claims of current coverage. Each result must record revision, runtime, model/export configuration, environment, actual output, duration, and mocks. Exact thresholds beyond these pass conditions remain implementation decisions and must be documented before comparison.

| ID | Outcome to demonstrate |
| --- | --- |
| A1 | Real model follows ordinary instructions and recalls relevant context across several turns; test arithmetic, literal constraints, explanation, and code tasks separately. Model-ready is not answer-correct. |
| A2 | Given a real plan, status question, then "do it" or "try again", continue the right task without unrelated work, duplicate submissions, or asking for supplied context. |
| A3 | Research similar agent systems from the active goal; relevant sources support the resulting recommendation. Provider failure is visible and does not fabricate findings. |
| A4 | On a pinned broken fixture, an unmocked agent inspects files, changes implementation, passes the original failing tests and protected held-out checks, and exports a patch that applies cleanly. |
| A5 | On a passing baseline, implement a requested feature and its acceptance test; do not report unchanged code as the improvement. |
| A6 | Browser submission reaches the real host API, starts exactly one run, displays its actual outcome, and preserves the result on reload. Controlled-runner transport tests must be labeled separately from model tests. |
| A7 | Interrupted work resumes from a checkpoint where supported without duplicating external effects. A host restart test is required before claiming durable host execution. |
| A8 | Persist a verified narrow skill; retrieve and use it on a different related task; compare task success and resource use with a no-skill baseline. Demonstrate rejection and rollback of a harmful candidate. |
| A9 | Denied operations, malformed tool output, download errors, timeouts, and cancellation produce bounded, truthful outcomes without corrupting memory or exposing secrets. |
| A10 | Validate desktop and real mobile-browser behavior on claimed supported devices, including startup/download/memory pressure. Mobile-width Chromium does not certify iPhone Safari. |
| A11 | Qualify model + harness + environment together before release, then verify the exact deployed revision. Preserve source/regression checks and report partial coverage rather than an unsupported all-clear. |
| A12 | For tasks with relevant XRAI knowledge, retrieval returns a small provenance-rich context set and measurably improves or preserves task success versus no retrieval without hiding stale/conflicting evidence. Structural/graph retrieval must independently demonstrate benefit before becoming a required production dependency. |

## Delivery priority order

Priority is determined by the product outcome, not by architectural novelty.

### P0 - working public XRAI tonight

1. **Qualify a capable primary reasoning path** for the public browser without exposing an operator secret and without weakening A1/A11. Browser-local 135M/350M inference remains fallback-only because the tested CI path failed qualification.
2. **Preserve and verify existing XRAI knowledge retrieval** in the actual browser conversation path. It should ground the capable model, not become a new infrastructure project tonight.
3. **Preserve real execution + verification.** Use the already working WebContainer mechanism where supported while evaluating alternative browser execution adapters only behind an isolated proof. Do not replace a working mechanism on README claims alone.
4. **Make mobile claims evidence-based.** A mobile-friendly reasoning path and actual supported repo execution are separate capabilities; expose each truthfully.
5. **Deploy only an exact qualified revision**, then re-run live desktop/mobile conversation, research, repo execution, retry/recovery, patch, console/network, and exact-build checks.
6. **Keep rollback.** If a new inference/runtime candidate does not pass its bounded proof, production remains unchanged.

Current candidate evidence that affects P0:

- Puter documentation currently supports GPT-5.6 Luna, function calling, OpenAI web search, and website authentication including optional temporary-user creation. Website authentication requires a real user-triggered popup. The first CI probe opened the popup but timed out before authentication completed, so Puter is **not yet qualified or disqualified for a real interactive browser session**.
- The first Lifo browser candidate integration using `@lifo-sh/core@0.10.17` through jsDelivr failed before runtime execution because a bundled dependency export was incompatible. That exact CDN integration path is **failed** and must not be promoted. Lifo itself remains a research candidate only if a supported packaging/integration path passes the same real browser execution proof.

### P1 - stabilize the coherent agent after P0

1. Put the qualified model/provider behind a small provider-capability seam; keep provider-specific server tools behind that seam.
2. Converge browser/CLI/MCP/host on one task/session/tool/evidence loop instead of maintaining separate semantics.
3. Run authentic A4 broken-repo repair and A8 held-out transfer tests through the qualified path.
4. Make host run/checkpoint state genuinely restart-durable and test duplicate-side-effect prevention.
5. Improve the knowledgebase deliberately: sync/curate more verified XRAI knowledge, add freshness/provenance metadata, and benchmark retrieval quality before adopting semantic infrastructure.

### P2 - hybrid knowledge graph and richer memory

1. Add semantic retrieval only if A12 shows lexical retrieval is a material limiter.
2. Reuse Holograim structural crawler/graph ideas for repository/source topology behind the same retrieval interface rather than importing its entire application stack.
3. Link files, runs, sources, tasks, skills, verifier receipts, and outcomes with explicit typed edges and provenance.
4. Use the graph to improve retrieval/navigation and the X-ray provenance UI; do not make visualization itself the evidence of better agent performance.
5. Promote graph/semantic components only when controlled A12 comparisons improve relevant-task success, latency, or context efficiency without reducing reliability.

### P3 - broader autonomous/creative capability

Expand domains, longer-horizon workflows, additional execution environments, specialized workers, and richer spatial/visual knowledge interfaces only after P0-P2 foundations demonstrate repeatable value.

## Next milestone

The immediate milestone is a **real, publicly usable, qualified vertical slice**: capable reasoning + existing XRAI knowledge retrieval + source-linked research + real authorized execution + independent verification + durable truthful result presentation. Do not block that milestone on a new knowledge graph, framework migration, swarm, dashboard rewrite, or speculative model/runtime integration.

After that vertical slice is working, complete one genuine research/repair/verification/reuse path through the shared core and then prove A12 retrieval improvements before expanding the memory/graph architecture. A few repeatable meaningful tasks are more valuable than many nominal capabilities.
