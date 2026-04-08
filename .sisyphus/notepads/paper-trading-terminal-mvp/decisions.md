- For MVP paper trading, enforce adapter-level simulation only for Jupiter/Polymarket; exclude live signing/execution paths from UI.
- Local worker should be the only process allowed to touch private keys/API secrets; web UI gets opaque connection status only.

Scaffold decisions:
- Keep Chakra setup minimal and use ChakraProvider in apps/web main entry (matches existing pattern).
- Use npm workspaces (root package.json) to run scripts across workspaces; keep scripts as-is to avoid surprises.
- Chose dependency-free runtime validation functions over adding a schema library to keep Task-2 scope minimal while still enforcing strict inbound payload checks.
- Added adapter contract surface (`VenueAdapter`, `QuoteRequest`) in `packages/domain/src/contracts.ts` so downstream adapter implementations can share a normalized, venue-agnostic interface.
- Standardized all domain events on `DomainEventBase` to enforce deterministic `timestamp` and `correlationId` fields by type.
- Task-3 decision: keep deterministic execution core in `apps/worker/src/engine/determinism.ts` with an LCG RNG and deterministic logical clock instead of embedding `Math.random`/`Date.now` calls in engine logic. Why: this guarantees replayability and makes downstream strategy/runtime simulations testable with fixed seeds.
- Task-3 decision: compute buy/sell constraint checks against normalized requested quantity derived from quantity-or-notional + quote price before acceptance, and return explicit reason codes (`INSUFFICIENT_BUYING_POWER`, `INSUFFICIENT_HOLDINGS`) through `OrderRejected` payloads. Why: preserves contract consistency and deterministic rejection semantics.
- Task-4 decision: persistence versioning is snapshot-centric (`SNAPSHOT_VERSION=1`) with an explicit migration stub error (`SNAPSHOT_MIGRATION_NOT_IMPLEMENTED`) for older versions to make future migrations intentional rather than implicit.
- Task-4 decision: startup rehydration logs ledger recovery errors to stderr and records detailed recovery entries in `ledger.recovery.ndjson` to provide an explicit error path without blocking worker availability.
- Persistence remains local-first filesystem only (`snapshot.json` + append-only `ledger.ndjson` + `ledger.recovery.ndjson`) with no external DB dependencies.
- Corruption handling decision: malformed records and sequence corruption are recorded as explicit recovery events and excluded from replay, while valid records continue to be applied to produce safe startup state.
- Integration decision: do not alter domain event contracts; add worker-local persistence adapter functions to consume existing `DomainEvent[]` outputs from the execution engine.

[2026-04-08T03:26:54Z] Decision: use existing adapter factory+registry pattern (simulationUtils.ts/types.ts/venueAdapterRegistry.ts) rather than introducing parallel class-based adapter stack to avoid architectural divergence.
- Task-5 decision: keep adapters simulated-only and deterministic by introducing `createSimulatedVenueAdapter` + per-venue rule configs (stocks/crypto/jupiter/polymarket) instead of integrating any live venue clients.
- Task-5 decision: expose a registry factory (`createVenueAdapterRegistry`) that returns all four `VenueAdapter` implementations backed by shared deterministic quote generation and engine-based execution.
- Task-5 decision: normalized adapter rejection codes are centralized in `ADAPTER_ERROR_CODES` (`INVALID_SYMBOL`, `INVALID_ORDER_SIZE`, `VENUE_CLOSED`, `INVALID_ORDER_REQUEST`) so venue-specific validation always maps to the same outward error surface.
[2026-04-08T03:38:33Z] Task 6 decision: keep API payload validation centralized in @ai-trading/domain validation helpers and return a uniform HTTP 400 envelope { error: { code, message, issues? } } for malformed requests.
- Added execution callback hook in adapter registry so successful order executions persist full engine events without duplicating order execution logic in API handlers.
- [2026-04-08T03:43:40Z] Task 6 decision: keep both `POST /api/quote` and existing `POST /api/quotes` mapped to the same validation/execution flow to satisfy singular endpoint requirement without breaking any existing callers.
- [2026-04-08T03:43:40Z] Task 6 decision: structured HTTP 400 responses remain uniform as `{ error: { code, message, issues? } }`, with domain validator issue paths forwarded unchanged.
- For Task 6 verification, treat API architecture as conditionally sound for MVP if orchestrator enforces consistency gates around endpoint naming, validator reuse, and deterministic artifact boundaries.
- Preserve existing local-first/single-worker architecture; avoid adding infrastructure. Focus gates on behavior contracts and safety regressions rather than redesign.

## 2026-04-07 - Task 6 architecture validation references
- For router layering, use Fastify plugin encapsulation patterns (root + child context) as the primary organizational model.
- For malformed payload handling, use Fastify schema validation defaults with custom `setErrorHandler` to emit normalized structured validation responses.
- For secret-safety, combine Fastify response schemas (field allow-listing) with Pino `redact` (startup-configured paths, optional remove mode) to prevent secret leakage in responses and logs.
- [2026-04-08T04:06:00Z] Task 7 decision: implement route structure with hash navigation in `apps/web/src/App.tsx` instead of adding a router dependency, to keep Task 7 scoped to shell architecture and avoid unnecessary package churn.
- [2026-04-08T04:06:00Z] Task 7 decision: treat worker connectivity as a shell concern only (`WorkerStatusBanner` + `useWorkerAvailability`) with explicit connected/disconnected messaging and no business-side effects.
- [2026-04-08T04:06:00Z] Task 7 decision: define Chakra theme tokens in `apps/web/src/theme.ts` (brand/surface palette + typography) and wire via `ChakraProvider theme={theme}` to establish consistent shell visuals for downstream tasks.
- [2026-04-08T04:20:00Z] Task 8 decision: keep terminal implementation in `apps/web/src/pages/TerminalPage.tsx` (existing route location) and only add minimal wiring in `apps/web/vite.config.ts` (`/api` proxy) instead of introducing a new feature directory structure.
- [2026-04-08T04:20:00Z] Task 8 decision: enforce symbol format client-side per venue and disable preview/submit when invalid so the invalid-symbol scenario produces inline validation and prevents order submission attempts.
- [2026-04-08T04:20:00Z] Task 8 decision: represent order outcomes with in-page `Alert` notifications (accepted/rejected) and periodically refreshed API-backed activity table rather than adding toast/state libraries.
- [2026-04-08T04:29:53Z] Task 9 decision: implement connect management directly in `apps/web/src/pages/ConnectPage.tsx` (existing route) and keep backend contracts unchanged by consuming existing Task 6 endpoints (`POST /api/connect/:venue`, `GET /api/connect/status`).
- [2026-04-08T04:29:53Z] Task 9 decision: store credentials locally using reversible obfuscation (base64 + reverse) with explicit UI warning that storage is not production-grade; mask values by default and require per-field reveal action.
- [2026-04-08T04:29:53Z] Task 9 decision: avoid rendering API response payload details in connect UI and use sanitized success/warning notices only, preventing accidental secret exposure in toasts/log-style feedback.
- [2026-04-08T00:41:00Z] Task 10 decision: enforce single active instance per `strategyId` by default in runtime manager, with optional `allowConcurrentInstances` registration flag for explicit multi-instance behavior.
- [2026-04-08T00:41:00Z] Task 10 decision: runtime heartbeat exceptions are captured and mapped to persisted `failed` run state with `failureReason`, while worker health remains independent and continues serving API endpoints.
- [2026-04-08T00:56:00Z] Task 11 decision: implement analytics in `apps/worker/src/metrics/analytics.ts` as pure deterministic functions (account + strategy) and keep API router as a thin orchestration layer.
- [2026-04-08T00:56:00Z] Task 11 decision: extend `/api/metrics` with optional `strategyId` and `window` query params (`all|1h|24h|7d`) and return structured payload `{ scope, window, metrics, warnings, summary }`.
- [2026-04-08T00:56:00Z] Task 11 decision: include `sharpeLikeRatio` in metrics output as a deterministic closed-trade-return ratio normalized by total equity; return `0` when sample size or variance is insufficient.
- [2026-04-08T00:56:00Z] Task 11 decision: keep UI implementation in existing route `apps/web/src/pages/MetricsPage.tsx` (no new dependencies), with account/strategy scope selector + time-window selector and explicit state messaging.
- [2026-04-08T05:06:00Z] Task 12 decision: keep stabilization changes confined to tests/docs/config wiring by adding `apps/web/e2e/integration-flow.spec.ts`, `apps/worker/tests/apiResilience.integration.test.ts`, and minimal test runners/config updates only.
- [2026-04-08T05:06:00Z] Task 12 decision: capture required evidence artifacts directly from automated checks (`.sisyphus/evidence/task-12-e2e.png` from Playwright and `.sisyphus/evidence/task-12-e2e-error.txt` from scoped resilience integration test output).
- [2026-04-08T05:06:00Z] Task 12 decision: document deterministic operator replay in `README.md` using fixed worker seed/time/clock env keys and optional storage reset to ensure reproducible ledger + metrics behavior.
- F1 gate decision: REJECT pending remediation of Task 12 acceptance-path fidelity for portfolio update via UI flow.
- Rationale: Plan text explicitly requires full terminal journey with balance edit transition, and web `PortfolioPage` remains shell-only with no `/api/portfolio` UI wiring.
- [2026-04-08T05:16:00Z] F1 fix decision: add minimal portfolio page wiring only in `apps/web/src/pages/PortfolioPage.tsx` (no new endpoints, no schema changes), and validate by UI-driven Playwright steps.
- [2026-04-08T05:16:00Z] F1 fix decision: retain resilience evidence generation path unchanged (`apps/worker/tests/apiResilience.integration.test.ts` scoped run) and regenerate required artifacts after e2e flow correction.
