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

## Next priority

Isolate inference correctness before more UI changes or another blind model swap: compare the same model's minimal prompt and full conversation prompt, verify chat-template/tokenization, and compare WebGPU versus WASM with deterministic generation. Keep the arithmetic assertion and add real multi-turn context checks. Do not hardcode a known answer, replace the failing test with a model-ready check, or call mocked responses real inference. Promote a replacement only after genuine outputs pass and mobile memory limits are measured.

No further publishing or recurring experiments are authorized by this status document; it records findings only.
