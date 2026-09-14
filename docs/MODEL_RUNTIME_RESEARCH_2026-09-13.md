# XRAI model and runtime research — 2026-09-13

This is a dated research snapshot for architecture decisions in `JT5D/xrai-agent`. It is **not** a production-model approval list. Re-check current sources before making a future model/provider/runtime change.

The governing rule is in `SPEC.md`: research current primary sources and proven implementations first; distinguish open weights from free hosted inference; qualify model + harness + tools + execution environment together; then change defaults only on objective XRAI evidence with rollback.

## Decision summary

1. **Do not use tiny browser-local LLMs as XRAI's primary brain.** The existing 135M browser path and one off-path 1.2B WebGPU candidate failed the first bounded A1 instruction/latency check in the tested GitHub Actions Chromium environment. That does not prove those models fail everywhere; it is enough evidence to stop blind browser-model swapping.
2. **Keep browser-local inference only as an optional/offline adapter.** The public no-install/no-user-key UX does not require primary inference to live in the tab.
3. **Make the primary model path provider-neutral.** Frontier open-weight agent models now exist, but useful checkpoints are generally server-class. Hosted access can make them practical without coupling XRAI to one vendor.
4. **Do not confuse open weights with free production inference.** Self-hosting open weights still requires compute. Current free hosted endpoints have credentials, rate limits, availability changes, and provider data-policy considerations.
5. **Use one simple model -> tool -> observation loop by default.** Keep model, session, tools, execution environment, verifier, and persistence behind replaceable seams. Add multi-agent coordination only when an XRAI eval proves benefit.
6. **Do not anchor on the first plausible model.** Run the same XRAI harness against a small current candidate set and select from measured task success, tool accuracy, structured-output reliability, latency, availability, privacy, and operational constraints.
7. **Do not adopt a new framework merely because it is popular.** Reuse established interfaces/patterns first; add a dependency only if a controlled XRAI comparison demonstrates a measurable reliability, simplicity, security, or performance gain.

## Primary candidate shortlist

The table records why a model deserves evaluation, not why it should become production default. Free endpoint properties can change; inspect current model metadata immediately before a qualification run.

| Candidate | Current free route / license | Relevant evidence | Constraint / caution | XRAI decision |
| --- | --- | --- | --- | --- |
| **Nex-N2.5-Mini** | `nex-agi/nex-n2.5-mini:free`; Apache-2.0 open weights | Purpose-built for coding, terminal, browser/computer use and environment self-correction. Current OpenRouter route explicitly accepts `tools`, `tool_choice`, and JSON-schema `response_format`; recent route availability was about 99.5% over 3 days. Vendor agent/coding benchmarks are strong but are not XRAI evidence. | Official self-host example is 2x H100. Free route requires provider credentials and is rate limited. | **Tier-1 benchmark candidate.** |
| **NVIDIA Nemotron 3 Super** | `nvidia/nemotron-3-super-120b-a12b:free`; NVIDIA Open License | 120B total / 12B active agent-oriented MoE. Current free route explicitly supports tools, tool choice, and JSON-schema structured output. Recent OpenRouter telemetry showed roughly 10s P50 E2E, ~3.6-3.7% tool-call error and ~24.7% structured-output error. | Telemetry is route/provider behavior, not XRAI task success. Review exact license and provider privacy before private-code use. | **Tier-1 benchmark candidate.** |
| **GLM-5.3-Flash** | `z-ai/glm-5.3-flash:free`; free hosted route; verify exact weight artifact/license if self-hosting | Current free route is a 1M-context multimodal model described for efficient coding and long-horizon agents. Paid/batch GLM-5.3-Flash routes explicitly support tools + JSON-schema output. | The current free route page inspected in this pass did **not** explicitly confirm those exact tool/structured-output parameters. Capability metadata must be checked immediately before running A1; do not infer from another route. | **Conditional Tier-1 candidate only if the exact free endpoint exposes the required function semantics.** |
| **Nex-N2.5-Pro** | `nex-agi/nex-n2.5-pro:free`; Apache-2.0 open weights | Stronger vendor-reported agent/coding scores than Mini and tools/structured outputs are advertised. | Recent OpenRouter route telemetry was materially slower and less reliable: ~44.7s P50 E2E, ~3.1% tool-call error, ~30.8% structured-output error, ~94.2% 3-day availability. Official self-host example is 8x H100. | **Quality-escalation candidate, not presumed default.** |

### Useful current models that are *not* first-line free candidates

- **NVIDIA Nemotron 3 Ultra free** supports tools but not `response_format` on the inspected free route. Its page also explicitly warns not to upload confidential/personal data and says use is logged for security/product improvement. That makes it a poor default for private-repository XRAI work despite its size/capability.
- **MiniMax M3 free** is current and agent-oriented, but the inspected OpenRouter endpoint does not accept `tools`; structured output alone is insufficient for XRAI's tool loop.
- **DeepSeek V4 Pro**, **GLM-5.3**, **Kimi K3**, large Qwen variants, and paid frontier routes remain server/hosted candidates to re-screen if the free Tier-1 set fails or the operating-cost constraint changes.
- Do not use a random/free-router aggregate as the qualification identity. Reproducible evidence requires a concrete model route.

## Why this candidate set is deliberately small

The goal is not to benchmark every free model on the internet. The first screen requires the exact primitives XRAI needs:

- strong coding/agent orientation;
- multi-turn context;
- real function/tool calling;
- exact structured arguments or JSON-schema support where applicable;
- acceptable latency and availability;
- a route that can be pinned by model identity;
- privacy terms that can be approved for the intended data class.

Candidates that fail a required interface capability should be eliminated before spending A4/A8 evaluation budget.

## Free hosted inference is useful for evaluation, not a production guarantee

As of this research date:

- several strong current model routes are priced at zero tokens, including Nex-N2.5 Mini/Pro, Nemotron 3 Super, GLM-5.3-Flash and other changing free routes;
- OpenRouter requires an API key for programmatic inference;
- OpenRouter's FAQ states free-model accounts are limited to **50 requests/day** unless at least $10 of credits has been purchased, after which the free-model cap is **1000 requests/day**; its own FAQ says free models are generally unsuitable for production workloads;
- OpenRouter's free router changes its model pool and routes among compatible free models, which is useful for experimentation but not a reproducible qualification identity;
- static GitHub Pages must never contain an operator provider key; a no-user-key hosted public UX therefore requires an authorized backend/edge secret or self-hosted inference;
- provider data handling varies. For private-code routes, require approved provider routing/data policy (for example data-collection denial / ZDR where supported) rather than assuming that a zero-price endpoint is private.

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

## Provider-neutral qualification harness now in the branch

`test/remote-model-qualification.mjs` + `npm run qualify:remote-model` provide an opt-in A1 comparison without changing production inference.

The harness:

- never reads production provider credentials implicitly;
- accepts an HTTPS OpenResponses-compatible endpoint, or an unauthenticated loopback HTTP endpoint for self-hosted local evaluation;
- records the exact model/endpoint, outputs, durations, errors, and response IDs;
- fail-fasts on exact instruction, arithmetic, conversation recall, real function arguments, code diagnosis, and a bounded edit function call;
- uses only synthetic A1 prompts, so this stage need not transmit private repository content;
- is syntax-checked by normal CI but is **not** automatically run against any external provider.

Example runs (only with an authorized candidate credential):

```bash
XRAI_CANDIDATE_API_URL=https://openrouter.ai/api/v1/responses \
XRAI_CANDIDATE_API_KEY="$OPENROUTER_API_KEY" \
XRAI_CANDIDATE_MODEL=nex-agi/nex-n2.5-mini:free \
npm run qualify:remote-model

XRAI_CANDIDATE_API_URL=https://openrouter.ai/api/v1/responses \
XRAI_CANDIDATE_API_KEY="$OPENROUTER_API_KEY" \
XRAI_CANDIDATE_MODEL=nvidia/nemotron-3-super-120b-a12b:free \
npm run qualify:remote-model

# Run GLM Flash only after current endpoint metadata confirms the required tool/function semantics.
XRAI_CANDIDATE_API_URL=https://openrouter.ai/api/v1/responses \
XRAI_CANDIDATE_API_KEY="$OPENROUTER_API_KEY" \
XRAI_CANDIDATE_MODEL=z-ai/glm-5.3-flash:free \
npm run qualify:remote-model
```

A local/self-hosted OpenResponses endpoint can be evaluated without a key on loopback, e.g. `http://127.0.0.1:<port>/v1/responses`.

## Required qualification before any hosted/open model becomes primary

A candidate only advances if the exact candidate model + provider + harness + tool interface + execution environment passes:

1. **A1** — deterministic instruction, arithmetic, context recall, structured tool arguments, code diagnosis, and code-repair formatting with recorded latency/output.
2. **A4** — pinned broken repository, unchanged failing tests + protected held-out test, real model-generated edit, clean patch, actual verifier pass.
3. **A8** — source-task candidate remains quarantined, then is reused on a different related task and objectively beats a no-skill baseline before promotion.
4. **Failure behavior** — provider 429/5xx/timeout, malformed tool output, cancellation, and unsupported feature paths remain bounded and truthful.
5. **Privacy / cost / limits** — provider data policy and limits are recorded for the exact route; private code is not sent to an unapproved provider.

Only after those pass should the default model/provider change. The prior path remains available until rollback evidence is established.

## Current next step

Do **not** add another browser model and do not pick a winner from model cards or popularity.

Run the exact same A1 harness against the current Tier-1 set:

1. Nex-N2.5-Mini free;
2. Nemotron 3 Super free;
3. GLM-5.3-Flash free **only if** current endpoint capability metadata confirms the required tool semantics;
4. Nex-N2.5-Pro free only as a quality escalation / comparison.

Score pass/fail first, then successful candidates by measured latency, tool/argument reliability, provider availability, privacy route, and operational constraints. Only the objective winner(s) advance to A4 and A8. If the set fails, re-screen the current frontier list rather than tuning the gate around a favorite model.

## Sources checked

Primary/current sources used in this research pass include:

- Nex-N2.5 model/deployment: https://huggingface.co/nex-agi/Nex-N2.5-Pro/blob/main/README.md
- Nex-N2.5-mini weights/license: https://huggingface.co/nex-agi/Nex-N2.5-mini
- Nex free route: https://openrouter.ai/nex-agi/nex-n2.5-mini:free
- Nex Pro free route/performance: https://openrouter.ai/nex-agi/nex-n2.5-pro:free
- Nemotron 3 Super free route/performance: https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b:free
- Nemotron 3 Ultra free route/privacy/capabilities: https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b-20260604:free
- GLM-5.3-Flash free route: https://openrouter.ai/z-ai/glm-5.3-flash:free
- GLM-5.3-Flash batch route capability reference: https://openrouter.ai/z-ai/glm-5.3-flash:batch
- MiniMax M3 endpoint capability reference: https://openrouter.ai/minimax/minimax-m3/api
- OpenRouter free limits: https://openrouter.ai/docs/faq
- OpenRouter OpenResponses API: https://openrouter.ai/docs/api/api-reference/responses/create-responses
- OpenRouter tools: https://openrouter.ai/docs/guides/features/tool-calling
- OpenRouter TypeScript agent: https://github.com/OpenRouterTeam/typescript-agent
- mini-SWE-agent: https://github.com/SWE-agent/mini-swe-agent
- DeepSeek Harness architecture: https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md
- DeepSeek V4 Pro: https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813
- GLM-5.3-Flash Transformers documentation: https://huggingface.co/docs/transformers/main/en/model_doc/glm5_next
- Kimi K3 license/model: https://huggingface.co/moonshotai/Kimi-K3
