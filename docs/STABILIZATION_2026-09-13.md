# Stabilization status - 2026-09-13

## Shipped

Conversation/runtime repairs were deployed as v0.3.49; retry-target fix commit: `2cf7f8ffe4c3699c17df161af9d61ead5503a37b`.

The isolated candidate passed 110 source tests and desktop/mobile-sized conversation contracts. Deployment run `34789259195` confirmed the browser bundle. Six deployed test flows passed: conversation, chat-retry, mobile-chat, mobile-repo, web, and repo.

Conversation contracts use mocked language/search providers. Repo tests execute real WebContainer commands, but the tested repo needed no edits. Mobile testing uses Chromium with a mobile viewport/user agent, not physical Safari/iPhone certification. Sandbox changes are not GitHub commits or deployments.

## Release blocker: actual inference correctness

Do not describe this release as fully end-to-end verified.

The unmocked deployed model-runtime test failed. Prompt: `What is 2 + 2? Reply with only the number.` SmolLM2 135M on WebGPU returned `1 + 2 = 3`, with runStatus completed. Evidence: run `34789259195`, artifact `live-pages-e2e-model-runtime`.

A bounded alternative tested the already-integrated LFM2.5 350M model as the default, served from actual candidate files with isolation headers. It also failed the same prompt, returning `2` on WebGPU. Evidence: run `34789594412`, artifact `fallback-model-validation`. This candidate was NOT promoted to master.

An earlier attempted module-route override was intercepted by the service worker and still ran SmolLM2. Its report explicitly shows that provider; it is not LFM evidence. The subsequent local-server preflight above confirmed LFM via a provider assertion.

A separate source-backed LFM2.5 350M q4 candidate with shortened conversation instructions passed 110 source tests but again returned `2` in the real WebGPU test (run `34789636207`, artifact `local-model-quality-validation`). It was not promoted.

The CPU reference run `34789790346` attempted the same LFM2.5 350M q4 export with Transformers.js 4.0.1 and real WASM inference. Initialization failed: `Could not find an implementation for GatherBlockQuantized(1)` at `/model/embed_tokens/Gather_Quant`. No CPU answers were generated, so this does not establish whether WebGPU caused the incorrect output. Evidence: artifact `local-model-cpu-reference` (10328390274). A generic q4-to-WASM fallback is not valid for this tested export/runtime combination.

## Next priority

Isolate inference correctness before more UI changes or another blind model swap: use a supported model-export/backend/runtime combination, compare minimal and full conversation prompts, verify chat-template/tokenization, and compare genuine WebGPU versus WASM results where both are supported. Keep the arithmetic assertion and add real multi-turn context checks. Do not hardcode a known answer, replace the failing test with a model-ready check, or call mocked responses real inference. Promote a replacement only after genuine outputs pass and mobile memory limits are measured.

No further publishing or recurring experiments are authorized by this status document; it records findings only.

## Portable patch export follow-up

The patch exporter now writes a complete unified diff instead of a truncated display preview. Exports beyond the existing 50,000-character storage limit fail explicitly rather than producing corrupt patches. The download control is in the chat composer so mobile layouts do not hide it, and its object URL is released after the click rather than immediately.

`test/patch-export.e2e.mjs` checks eight real `git apply` round trips and rendered downloads at 1440 and 390 pixels. It seeds a UI result deliberately: it does not claim model-generated repair. Run it with Playwright installed: `node test/patch-export.e2e.mjs`; pass the public app URL to verify deployment. The public default model remains an inference-quality blocker; no failed alternative model is promoted by this change.

## Inference qualification and release protection

The subsequent qualification pass isolated application code from model behavior:

- Pinned explicit-template comparisons: run `34790624508`, source commit `06830714271c674701a31fa6ab053583e71886ea`. Qwen2.5 0.5B with Transformers.js 3.8.1 and Qwen3 0.6B with 4.2.0, both on WASM, failed instruction/repair qualification. The matrix artifact named `reference-gpu` actually used WASM, correctly recorded inside its report; do not treat its name as GPU evidence.
- Native full-precision reference: run `34790854875`, artifact `precision-native-fp32`. Qwen/Qwen3-0.6B with PyTorch 2.7.1, Transformers 4.51.3, FP32 and thinking disabled returned `2` for the same `2 + 2` question, outside XRAI and the browser. Its proposed repair did not fix the subtraction bug. This shows the Qwen3 failure is not solely an XRAI, browser, GPU or quantization problem; it does not establish one common cause for every previously tested model.
- The same run's browser Q8 candidate gave mathematically correct answers but violated requested formats and returned a patch whose search text was absent from the source. It did not qualify.
- Documented reasoning configuration: run `34790977598`, artifact `reasoning-capability-reference`. Qwen3 0.6B on WASM q4 with thinking enabled, temperature 0.6, top-p 0.95 and top-k 20 answered `4`, but that case took 111966 ms. The probe hit its 240-second deadline before completing repair verification. A correct but extremely slow arithmetic response is not a qualified interactive repair agent.

No replacement from this qualification pass was deployed. A locally prepared full agent fixture E2E was not executed; it must not be reported as passing.

PR #7 merged as `70807409394f266f3b6ce344fcd6755768a2e345`. The release workflow now runs the existing real model-runtime canary before publication and makes `deploy` depend on it. PR source CI and merged-source CI passed. In run `34791314550`, the real SmolLM2 WebGPU response was again `1 + 2 = 3`, with no browser page errors; preflight failed and deployment was skipped. This verifies release protection, not model correctness. The concurrent v0.3.51 patch-export work was preserved.

The remaining decision is to qualify a more capable inference configuration/provider against the actual workload, rather than add more routing patches or call loading a model a success. Preserve the visitor-no-key goal. Require real instruction following, multi-turn context and failing-test -> generated patch -> unchanged tests pass -> durable evidence. Require successful evidence-backed skill reuse on a distinct task before claiming compounding learning. A single arithmetic release canary is a minimum guard, not sufficient evidence of general repair capability. Physical iPhone/Safari and device memory behavior remain unverified.
