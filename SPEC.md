# XRAI Agent - goals and acceptance specification

Working specification v0.1, 2026-09-13. Repository: JT5D/xrai-agent only.

## Authority and provenance

This is a goals-first working reconstruction, not a claim to reproduce the initial creation prompt. That prompt was not recovered. Sources are the user's creation/repair discussion available on 2026-09-13, the supplied failure transcript, README.md, and knowledge/MISSION.md. No master goals-and-acceptance specification was found in the inspected current tree or retrieved Library material; that does not prove none ever existed elsewhere.

Current explicit user goals take precedence. This document defines outcomes and boundaries; implementation choices remain replaceable. docs/HANDOFF.md records the architectural assessment and incomplete work, not an approved final technology stack. This spec is not evidence that any capability already works.

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

## Learning and autonomy boundaries

Conversation memory, reusable procedures, tested code changes, and model-weight training are different mechanisms. This product primarily targets the first three; do not imply weight updates or unbounded recursive intelligence growth.

Use one capable agent loop by default. Add workers or recursive decomposition only when measured benefit exceeds coordination, latency, and cost. Improve the verifier and tool interface before optimizing an unreliable self-rating loop.

Treat repository text, search results, and imported skills as untrusted inputs. Tool permissions, credentials, execution isolation, budgets, protected evaluation cases, and production promotion remain outside generated skill/code control. The agent may propose changes to these boundaries for human review, not expand its own authority. Local shell working-directory selection alone is not a security sandbox.

### Research-before-change invariant

Do not guess, blindly swap models, or invent XRAI-specific machinery where a current proven implementation or standard exists. Before changing a model, provider, agent harness, execution runtime, memory mechanism, or other material architecture choice:

1. inspect current primary sources and relevant actively maintained open-source implementations;
2. record the candidate's license, deployability/compute requirements, tool and structured-output support, measured latency/availability when available, privacy/data-use constraints, rate limits, and direct operating-cost implications;
3. distinguish open/free weights from genuinely free hosted inference and distinguish temporary free tiers from production guarantees;
4. shortlist only candidates compatible with the product constraints, then benchmark them through XRAI acceptance cases rather than choosing from vendor claims or intuition;
5. qualify the model, harness, tools, and execution environment together, including A1 before general use and A4/A8 before claiming autonomous coding or compounding improvement;
6. prefer standard, replaceable seams and mature libraries over bespoke infrastructure, but add a dependency or framework only when a controlled XRAI comparison shows a concrete reliability, simplicity, security, or performance benefit;
7. preserve the previous working path until the replacement has objective evidence and a rollback path.

A benchmark table, popularity, model card, or successful load is research evidence, not production qualification. Current research may become stale; re-check material external choices when making future architecture changes.

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

## Next milestone

Complete one genuine research/repair/verification/reuse path through a shared core before adding a framework, swarm, more models, a dashboard rewrite, or autonomous infrastructure changes. A few repeatable meaningful tasks are more valuable than many nominal capabilities. Broader creative and domain skills build on that working path.
