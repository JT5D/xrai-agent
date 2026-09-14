# XRAI model and runtime research — 2026-09-13

This is a dated research snapshot for architecture decisions in `JT5D/xrai-agent`. It is **not** a production-model approval list. Re-check current sources before making a future model/provider/runtime change.

The governing rule is in `SPEC.md`: research current primary sources and proven implementations first; distinguish open weights from free hosted inference; qualify model + harness + tools + execution environment together; then change defaults only on objective XRAI evidence with rollback.

## Decision summary

1. **Do not use tiny browser-local LLMs as XRAI's primary brain.** The existing 135M browser path and one off-path 1.2B WebGPU candidate failed the first bounded A1 instruction/latency check in the tested GitHub Actions Chromium environment. That does not prove those models fail everywhere; it is enough evidence to stop blind browser-model swapping.
2. **Keep browser-local inference only as an optional/offline adapter.** The public no-install/no-user-key UX does not require primary inference to live in the tab.
3. **Make the primary model path provider-neutral.** Frontier open-weight agent models now exist, but useful checkpoints are generally server-class. Hosted access can make them practical without coupling XRAI to one vendor.
4. **Do not confuse open weights with free production inference.** Self-hosting open weights still requires compute. Current free hosted endpoints have credentials, rate limits, availability changes, and provider data-policy considerations.
5. **Use one simple model -> tool -> observation loop by default.** Keep model, session, tools, execution environment, verifier, and persistence behind replaceable seams. Add multi-agent coordination only when an XRAI eval proves benefit.
6. **Do not adopt a new framework merely because it is popular.** Reuse established interfaces/patterns first; add a dependency only if a controlled XRAI comparison demonstrates a measurable reliability, simplicity, security, or performance gain.

## Primary candidate shortlist

The table records why a model deserves evaluation, not why it should become production default.

| Candidate | License / availability | Relevant evidence | Deployability / constraint | XRAI decision |
| --- | --- | --- | --- | --- |
| **Nex-N2.5-mini** | Apache-2.0 open weights; current free OpenRouter endpoint | Nex model card targets coding, terminal, browser/computer use and environment self-correction. Vendor-reported: Terminal-Bench 2.1 73.4, SWE-Bench Pro 43.8, Toolathlon Verified 54.6, BrowseComp 83.4. OpenRouter advertises tool calling + JSON-schema structured outputs. | Official self-host example is 2x H100. OpenRouter free endpoint requires an API key and is rate limited. | **Tier-1 hosted evaluation candidate** for A1/A4/A8; not approved as default. |
| **Nex-N2.5-Pro** | Apache-2.0 open weights; current free OpenRouter endpoint | Same agent-oriented training. Vendor-reported: Terminal-Bench 82.7, SWE-Bench Pro 61.2, Toolathlon 68.5, BrowseComp 89.7. Tools + structured outputs advertised on OpenRouter. | Official self-host example is 8x H100. Heavier than mini; free endpoint still rate limited and credentialed. | **Tier-1 escalation candidate** if mini does not meet quality/reliability targets. |
| **DeepSeek-V4-Pro-0813** | MIT open weights | Current official HF model; vLLM/OpenAI-compatible serving documented. Nex comparison reports strong coding/agent scores, but those cross-model numbers are partly Nex evaluations and must not be treated as XRAI proof. | Very large server-class checkpoint; unsuitable for phone/browser primary inference. | **Tier-2 server/self-host candidate** if operating a large model becomes justified. |
| **GLM-5.3 / GLM-5.3-Flash** | GLM-5.3 custom license; Flash variants available under MIT in current distributions | HF Transformers describes GLM-5.3-Flash as 320B total / 18B active and oriented toward coding/agentic performance with improved serving efficiency. | Still server-class; current hosted availability, exact license for chosen artifact, tool behavior, privacy, and cost must be checked at decision time. | **Tier-2 candidate**, not yet XRAI-qualified. |
| **Kimi-K3** | Kimi K3 license; weights available | Current flagship multimodal MoE intended for long-horizon coding/knowledge work/visual agents. | About 2.8T total parameters according to current NVIDIA quantized model documentation; server-class and license must be reviewed for the exact deployment. | **Tier-2 candidate**, no production approval. |

Other current free/OpenRouter models (for example Nemotron 3 Ultra and changing free-router selections) are worth re-screening when an eval is run, but a changing free router must not be the production identity for an evidence-sensitive agent unless reproducibility requirements are explicitly solved.

## Free hosted inference is useful for evaluation, not a production guarantee

As of this research date:

- OpenRouter lists Nex-N2.5-mini and Pro `:free` endpoints at zero token price and documents support for tools / tool choice / structured outputs.
- OpenRouter requires an API key for programmatic inference.
- OpenRouter's FAQ states free-model accounts are limited to **50 requests/day** unless at least $10 of credits has been purchased, after which the free-model cap is **1000 requests/day**. The FAQ explicitly says free models have low limits and are usually unsuitable for production.
- OpenRouter's free router changes its available model pool and chooses among compatible free models; it is useful for experimentation, not reproducible model qualification.
- A static GitHub Pages client must never contain an operator provider key. A true no-user-key public UX with hosted inference therefore requires a server/edge secret or another authorized backend.

This means a model can be both open-weight and currently free to call while still being unsuitable as a zero-cost production dependency.

## Agent/runtime patterns worth reusing

### mini-SWE-agent — copy the simplicity, not necessarily the package

Primary source: `SWE-agent/mini-swe-agent`.

Its default agent is deliberately small: query the model, execute actions, append observations, repeat until an exit condition. It has explicit step/cost/wall-time limits and saves trajectories. Its local environment executes commands independently rather than relying on a long-lived implicit shell, making sandbox substitution simpler and reducing hidden state.

**XRAI implication:** keep the shared core linear and bounded. Let the capable model decide tool usage; keep tool effects explicit; make verifier receipts independent of model confidence.

### OpenRouter TypeScript Agent SDK — evaluate before reimplementing generic loop machinery

Primary source: `OpenRouterTeam/typescript-agent`, package `@openrouter/agent` (Apache-2.0).

Current `callModel` supports OpenResponses, tool execution, stop conditions, state, approval hooks, tool timeouts/concurrency, async tool tasks, streaming, MCP integration, and doom-loop protection.

**XRAI implication:** if XRAI needs generic hosted-model loop infrastructure beyond its existing small kernel, compare this SDK against the current kernel on A1/A4/A8 before writing equivalent machinery. Do not migrate just for feature count.

### DeepSeek Harness — architecture reference, not an immediate dependency

Primary source: `deepseek-ai/deepseek-harness` (MIT, developer preview).

Its architecture makes model adapters, tools, session log, agent loop, filesystem/subprocess/sandbox and persistence replaceable capabilities. Durable session events are the source of model-visible context: model-visible state is reconstructable from the session log.

**XRAI implication:** adopt the boundary ideas (durable session facts + replaceable capability seams) without importing the whole rapidly changing harness unless XRAI evals show the migration earns its complexity.

### Existing research retained

- Anthropic managed-agent guidance: separate durable session/harness concerns from the execution environment; evaluate model + harness together using real environment outcomes.
- OpenHands: stable workspace/session/runtime abstractions are useful if managed execution becomes the dominant engineering burden.
- MCP: retain a standard tool/interface boundary rather than making product semantics depend on one host.
- WebContainers: useful browser execution adapter with device/browser constraints; not the definition of the agent architecture or mobile support.

## Provider/API seam recommendation

The existing host kernel already speaks OpenAI Responses semantics. OpenRouter currently exposes an OpenResponses-compatible `POST /api/v1/responses` endpoint and standardizes user-defined tool calling across supported models. Therefore the smallest candidate experiment is **not** a new agent framework:

```text
existing XRAI task/session semantics
  -> model-provider adapter (base URL + credential + model + capability checks)
  -> existing bounded tool loop
  -> explicit execution adapter
  -> objective verifier
  -> evidence ledger
```

A provider adapter must declare supported features rather than assuming them. In particular, provider-specific server tools (for example OpenAI `web_search` versus OpenRouter `openrouter:web_search`) must stay behind the provider seam; user-defined XRAI tools should remain portable.

Do not expose credentials to the static browser. If a hosted provider wins qualification, the public browser should call an authorized XRAI backend/edge endpoint that owns the secret and enforces rate, privacy, tool, and budget policy.

## Required qualification before any hosted/open model becomes primary

A candidate only advances if the exact candidate model + provider + harness + tool interface + execution environment passes:

1. **A1** — deterministic instruction, arithmetic, context recall, structured tool arguments, code diagnosis, and code-repair formatting with recorded latency/output.
2. **A4** — pinned broken repository, unchanged failing tests + protected held-out test, real model-generated edit, clean patch, actual verifier pass.
3. **A8** — source-task candidate remains quarantined, then is reused on a different related task and objectively beats a no-skill baseline before promotion.
4. **Failure behavior** — provider 429/5xx/timeout, malformed tool output, cancellation, and unsupported feature paths remain bounded and truthful.
5. **Privacy / cost / limits** — provider data policy and limits are recorded for the exact route; private code is not sent to an unapproved provider.

Only after those pass should the default model/provider change. The prior path remains available until rollback evidence is established.

## Current next step

Do **not** add another browser model. Build one provider-neutral remote-candidate qualification seam, preserving the current production default, then evaluate **Nex-N2.5-mini** first and **Nex-N2.5-Pro** only as an escalation. If neither passes the XRAI acceptance slice, re-screen the current frontier list instead of tuning the gate around the candidate.

## Sources checked

Primary/current sources used in this research pass:

- Nex-N2.5 model card and deployment instructions: https://huggingface.co/nex-agi/Nex-N2.5-Pro/blob/main/README.md
- Nex-N2.5-mini weights/license: https://huggingface.co/nex-agi/Nex-N2.5-mini
- Nex-N2.5 free endpoints/capabilities: https://openrouter.ai/nex-agi/nex-n2.5-mini:free and https://openrouter.ai/nex-agi/nex-n2.5-pro:free
- OpenRouter free limits: https://openrouter.ai/docs/faq
- OpenRouter OpenResponses API: https://openrouter.ai/docs/api/api-reference/responses/create-responses
- OpenRouter tools: https://openrouter.ai/docs/guides/features/tool-calling
- OpenRouter TypeScript agent: https://github.com/OpenRouterTeam/typescript-agent
- mini-SWE-agent: https://github.com/SWE-agent/mini-swe-agent
- DeepSeek Harness architecture: https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md
- DeepSeek V4 Pro: https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813
- GLM-5.3-Flash Transformers documentation: https://huggingface.co/docs/transformers/main/en/model_doc/glm5_next
- Kimi K3 license/model: https://huggingface.co/moonshotai/Kimi-K3
