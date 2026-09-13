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
