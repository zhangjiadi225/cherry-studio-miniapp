# Runtime contract

Source snapshot: Cherry Studio `main` at
[`56cf04c`](https://github.com/CherryHQ/cherry-studio/commit/56cf04c3c7d717c51ed9039eab70a7199d11d7f1),
reviewed 2026-08-30 after [PR #19475](https://github.com/CherryHQ/cherry-studio/pull/19475) merged.
All app access remains isolated behind `@cherry-miniapp/kit` so later host changes have one adaptation point.

## Capabilities

| Namespace | Product use | Main limit |
| --- | --- | --- |
| `app` | app/version/locale and current grants | no permission needed |
| `ai` | text generation through user `default` or `quick` slot | 2 in flight, 60/min/app, 5 calls per hidden stretch |
| `storage` | compact state document | 1 MB, 1000 keys, no transactions |
| `file` | larger generated/imported data and user-approved export | 10 MB/file, 20 MB and 200 files/app |
| `network` | explicitly allowed HTTPS backends | exact host allowlist, 1 MB request, 5 MB response, 10 calls per hidden stretch |
| `notification` | one-way completion/reminder message | 5/min/app, no click callback |
| `clipboard` | focused, user-present plain-text copy and paste | 10 reads/min, 30 writes/min, 1 MB text |

`ai.getCapabilities()` returns `{ available: false }` when the selected slot has no usable model. Callers must
branch on `available` before reading `reasoning` or `contextWindow` and before offering an AI action.

Errors cross the bridge as plain `{ name, message }` objects, not `Error` instances. Branch only on the seven
public names: `PermissionDenied`, `QuotaExceeded`, `RateLimited`, `Unavailable`, `InvalidArgument`,
`Cancelled`, and `Internal`.

## Sandbox

The page has an opaque origin. Use packaged assets only. Browser storage, cookies, external page `fetch`, XHR,
WebSocket, workers, service workers, iframes, remote scripts/styles/images, navigation, popups and browser
permissions are blocked. Own-package `fetch('./asset.json')`, file inputs, Canvas, WebGL/WebGPU, Web Audio,
WebAssembly and theme media queries remain available.

Use `cherry.clipboard` instead of `navigator.clipboard` and `cherry.file.export` instead of browser downloads.
Both require explicit grants; clipboard calls also require the app to be visible and focused, and export requires
it to be visible.

## Lifecycle and observability

Hidden apps remain alive in a bounded keep-alive pool, so browser visibility events are insufficient. Listen to
Cherry's `app.visibilityChange`. There is no reliable shutdown event; an update, eviction, crash or quit may
destroy the app immediately.

The hidden AI and network allowances do not refill with time. They reset only when the pane becomes visible
again, so a background `RateLimited` response must not be retried on a timer.

Cherry keeps a per-app activity log. It records refusals, outward-call metadata, permission decisions and counts,
but never payloads such as prompts, storage values, clipboard text or request bodies. Apps should inspect current
permissions and surface failures instead of repeatedly generating logged refusals.

## Compatibility policy

Apps import the runtime package only. When the host contract changes, adapt the package while preserving its
public API where reasonable. If semantics must break, publish a new incompatible package version and document
app migration before updating dependents.
