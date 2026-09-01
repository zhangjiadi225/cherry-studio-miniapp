---
name: cherry-miniapp-development
description: Build or maintain Cherry Studio local miniapps and their shared foundation when work must respect the window.cherry sandbox, monorepo ownership, or .miniapp packaging contract.
---

# Cherry Miniapp Development

First identify the owning workspace area. Product UI, gameplay, prompts, assets, manifest, and release configuration belong in one `apps/<slug>` directory. Host adapters, reusable runtime behavior, packaging, templates, cross-product specifications, and this Skill belong in `foundation/`. Do not solve a foundation gap by copying shared source into an app.

Read the root and target directory's `AGENTS.md` and README before editing. Consume shared packages through their public entry points; the root workspace and lockfile own local dependency resolution.

## Cherry invariants

- Treat the page as an opaque-origin sandbox. Web Storage, IndexedDB, cookies, external page fetch, workers, iframes, popups, browser permissions, remote assets, `navigator.clipboard`, and browser downloads are unavailable. Use granted `cherry.clipboard` and `cherry.file.export` while the app is visible and focused as required.
- Use `@cherry-miniapp/kit` for host calls. Keep direct `window.cherry` access inside the runtime package or a deliberate compatibility probe.
- Keep rules, scores, resources, workflow state, and other product truth deterministic and local. AI may generate narrative or suggestions but must not own state integrity.
- Assume destruction at any moment. Persist one recoverable state document after each meaningful change; pause animation, audio, timers, and AI work on `app.visibilityChange`.
- Branch on `ai.getCapabilities().available` before offering an AI action. Hidden AI and network allowances reset only when the pane becomes visible again; do not retry a background `RateLimited` response on a timer.
- Required and optional permissions are product decisions. Request only capabilities needed for the core experience; use local-first behavior before adding network hosts.

## Documents

- Read [repository-model.md](../../specs/repository-model.md) when creating an app workspace, moving shared code, or changing cross-directory ownership.
- Read [runtime-contract.md](../../specs/runtime-contract.md) before adding a Cherry capability or reasoning about sandbox behavior.
- Read [ai-product-principles.md](../../specs/ai-product-principles.md) when designing an AI game loop or AI product workflow.
- Read [packaging.md](../../specs/packaging.md) before changing manifests, archive output, updates, CI, or distribution.

## Packaging

Apps build static files into `dist/`. The shared `cherry-miniapp` CLI validates and packages that directory; app workspaces must not implement a second archive format. A batch operation invokes the same CLI independently for each app and reports failures per app. Never publish or upload without the user's explicit authorization.
