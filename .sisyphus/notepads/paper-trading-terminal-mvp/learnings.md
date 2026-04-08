- 2026-current Jupiter guidance: use Swap API V2 /order + /execute for managed landing; /build is Metis-only and requires own RPC send path.
- Jupiter rate limit constraints for MVP prototyping: keyless 0.5 RPS, 60s sliding window, shared account bucket, 429 on exceed.
- Polymarket CLOB auth is 2-level: L1 EIP-712 for credential creation/derivation, L2 HMAC headers for trade endpoints; order payloads still signed locally.
- Secret-handling boundary validated: keep builder/L2 secrets server-side; remote signer endpoint pattern is documented for builder headers.

---
Scaffold work (task-1) notes:
- The repository already contained minimal monorepo layout: apps/web, apps/worker, packages/domain.
- Root package.json already configured npm workspaces and workspace-level scripts (dev/build/lint/test).
- Chakra Provider is used correctly in apps/web via @chakra-ui/react in src/main.tsx.

Verification steps to run from repo root: npm ci; npm run lint; npm run build; run worker and curl /health.
- Task-2 contracts: using literal tuples (`VENUES`, `ORDER_SIDES`) with derived union types keeps venue/order-side normalization strict and compiler-safe.
- Runtime payload validation in `packages/domain/src/validation.ts` returns structured `issues` with JSON-style paths (for example `$.side`), which is easy for API handlers/tests to consume.
- Event model consistency: a shared `DomainEventBase` with `timestamp` + `correlationId` guarantees deterministic metadata fields across all event contracts.
- Task-3 execution engine: deterministic behavior is easiest to audit when randomness, timestamping, and ID generation are injected as one explicit context (`nextRandom`, `nowIso`, `nextId`, `advanceByMs`) and never pulled from ambient APIs.
- Event emission pattern that stayed contract-safe: always emit `OrderRequested` first, then exactly one of `OrderAccepted` or `OrderRejected`, then fill events (`FillPartial` optional, `FillComplete` terminal), then `PortfolioUpdated` only on accepted fills that mutate state.
- Replay stability check in tests is reliable when comparing serialized fill event streams directly; running the same seed+input fixture twice with no external clocks yields byte-identical snapshots.
- Task-3 follow-up: when workspace package `@ai-trading/domain` is referenced directly from worker source/tests before domain dist exists, adding a worker-local TS path mapping to `../../packages/domain/src/index.ts` restores editor/LSP type resolution and prevents implicit-any cascades from unresolved imports.
- Task-4 persistence pattern: keep local-first storage as a pair of files under worker data dir (`snapshot.json` + append-only `ledger.ndjson`) so startup can rehydrate quickly from snapshot and still support deterministic replay from ledger.
- Replay determinism in worker persistence is preserved by rebuilding runtime state from ordered `DomainEvent` records and treating `PortfolioUpdated` as authoritative account-state checkpoints while deriving holdings from position payloads.
- Corrupt-ledger handling that stays non-fatal: parse line-by-line, skip malformed/unknown records, emit `LedgerRecoveryError` records to a dedicated local recovery log, and continue startup with the valid subset of events.
- Task-4 persistence: deterministic replay reliability improved by sorting valid ledger records by sequence and rejecting non-increasing sequence records as explicit `LedgerRecoveryError` entries while still replaying valid records.
- A thin integration helper (`apps/worker/src/storage/persistentEngine.ts`) keeps Task-3 engine contracts unchanged while ensuring emitted events are appended to ledger and runtime snapshots are saved in one deterministic flow.
- Replay/snapshot parity required numeric normalization parity with engine arithmetic (`roundToScale(..., 8)`) for `PortfolioUpdated`-derived balances to avoid floating-point drift across restart assertions.

[2026-04-08T03:26:54Z] Task 5 adapters: existing adapter architecture already implemented deterministic simulated adapters via createSimulatedVenueAdapter + createVenueAdapterRegistry. Kept and verified this path.
- Task-5 adapters: preserving deterministic behavior is simplest when adapters derive quote `timestamp` and `price` from pure hash-based inputs (venue/symbol/size), then route execution through `PaperExecutionEngine` for all accepted orders.
- Existing worker engine/persistence contracts were reused by injecting an adapter dependency `executeOrder(request, quotePrice)` that returns the engine `OrderResult` shape directly, avoiding duplicate fill/accounting logic.
- Venue-rule enforcement pattern that stayed stable: validate in this order for market orders -> contract validity, symbol format, venue-open rule, then size/notional constraints; normalize all failures into shared adapter error codes.
[2026-04-08T03:38:33Z] Task 6 API: mounted worker API router under /api and kept /health response minimal (exact {\"status\":\"ok\"}) to satisfy acceptance checks.
- Reused domain validators (validateMarketOrderRequest, validatePortfolioUpdateRequest) for 400 responses with structured issues payloads.
- Preserved deterministic behavior by routing quote/order through existing adapter registry + paper engine; adapter execution callback persists orders/fills/events via existing storage helpers.
- [2026-04-08T03:43:40Z] Task 6 API: route ordering in Express matters for literal-vs-parameterized paths; `/connect/:venue` can swallow `/connect/save` unless explicitly handled before venue validation.
- [2026-04-08T03:43:40Z] Task 6 API: preserving deterministic behavior was achieved by keeping quote + order execution in adapter registry and persisting via existing execution callback, with no duplicate engine/accounting logic in handlers.
- Task 6 API currently exposes both `/api/quote` and `/api/quotes` with identical behavior, while plan acceptance mentions quote retrieval generally and evidence uses singular endpoint; this is a semantics drift risk for downstream clients.
- Validation is split between shared domain validators (`validateMarketOrderRequest`, `validatePortfolioUpdateRequest`) and router-local parsing (`parseQuoteRequest`, strategy/connect checks), increasing response-shape inconsistency risk across endpoints.
- Determinism is mostly preserved by seeded engine/context and deterministic adapter quote generation, but persistence snapshot timestamps use wall-clock time (`new Date().toISOString()`), creating non-deterministic metadata in replay artifacts.

## 2026-04-07 - Task 6 API research patterns (worker architecture)
- Fastify encapsulation is a strong fit for router layering in a local worker API: parent plugins share common decorators/hooks, while child plugins isolate feature-specific concerns.
- Fastify validation errors already include `statusCode` and validation context (`error.validation`, `error.validationContext`), which supports a stable structured error envelope for client-facing 400/422 responses.
- Fastify response schemas are a practical guardrail for no-secret responses because serialization can whitelist output fields and reduce accidental data disclosure.
- Pino redaction should be configured at startup with explicit paths and never from user input; this is suitable for protecting API key/secret fields from logs.
- [2026-04-08T04:06:00Z] Task 7 UI shell: hash-based route skeleton (`#/terminal`, `#/portfolio`, `#/strategies`, `#/metrics`, `#/connect`) keeps navigation dependency-free while still enabling deterministic Playwright route checks.
- [2026-04-08T04:06:00Z] Task 7 UI shell: shared Chakra primitives (`FormField`, `ShellDataTable`, `SectionCard`, `WorkerStatusBanner`) are enough to standardize shell-level form/table/status UX before business flows are wired in Task 8+.
- [2026-04-08T04:06:00Z] Worker availability in frontend is safer via same-origin `/health` with Vite proxy than direct cross-origin calls; this avoids CORS/runtime drift between local/dev environments.
- [2026-04-08T04:20:00Z] Task 8 terminal flow: using `/api/quote`, `/api/orders/market`, `/api/orders`, and `/api/fills` from the worker was enough to deliver quote preview, order submit, and API-backed activity without adding new frontend dependencies.
- [2026-04-08T04:20:00Z] For stocks + notional input, adding a derived integer quantity fallback (based on preview last price, minimum 1) avoids deterministic adapter size-step rejections while keeping a market-order-only UX.
- [2026-04-08T04:20:00Z] Debounced auto-quote on valid form state significantly improves terminal responsiveness and keeps quote preview aligned with symbol/size edits while preserving explicit loading/error states.
- [2026-04-08T04:29:53Z] Task 9 connect UI: local credential persistence can stay UI-only by storing per-venue obfuscated values in browser localStorage and decoding only in-memory when issuing worker `/api/connect/:venue` checks.
- [2026-04-08T04:29:53Z] Task 9 connect UI: explicit reveal/hide controls per field kept secrets masked by default after reload, while still supporting edit flows without server-side persistence changes.
- [2026-04-08T04:29:53Z] Task 9 verification: Playwright checks confirmed no plain-text secrets were visible in rendered connect UI before reveal, and connection checks updated per-venue status via `/api/connect/status`.
- [2026-04-08T00:41:00Z] Task 10 strategy runtime: separating runtime orchestration into `StrategyRuntimeManager` (registration + start/stop + heartbeat + failure transitions) keeps API handlers thin and allows deterministic timestamp/id behavior by reusing existing execution context.
- [2026-04-08T00:41:00Z] Task 10 restart behavior: on worker boot, persisted `running` strategy runs are safely normalized to `stopped` and can be manually resumed via existing start endpoint, preserving metadata without auto-resuming concurrent loops.
- [2026-04-08T00:56:00Z] Task 11 metrics: computing realized PnL from `FillComplete` events with weighted average-cost tracking per `venue:symbol` keeps results deterministic and independent of wall-clock time.
- [2026-04-08T00:56:00Z] Task 11 metrics: strategy-level analytics can stay reproducible by filtering fills to `strategyRun.startedAt|createdAt` through `stoppedAt|updatedAt`, then rebuilding strategy holdings from only that filtered stream.
- [2026-04-08T00:56:00Z] Task 11 metrics: missing mark-price handling is safest as explicit partial-data warnings (`MISSING_MARK_PRICE`) while excluding impacted symbols from unrealized PnL and exposure math.
- [2026-04-08T00:56:00Z] Task 11 metrics UI: clear loading/empty/error states plus warning banners made backend partial-data behavior visible without blocking metrics rendering.
- [2026-04-08T05:06:00Z] Task 12: Playwright E2E became stable after isolating web E2E in `apps/web/e2e/**` + dedicated `apps/web/playwright.config.ts` with worker and web webServer bootstraps.
- [2026-04-08T05:06:00Z] Task 12: Root `test:e2e` needed to execute workspace Playwright (`npm run test:e2e --workspace=@ai-trading/web`) so orchestration validates real browser flows instead of a placeholder script.
- [2026-04-08T05:06:00Z] Task 12: Resilience hardening is easiest at API integration level by injecting deterministic adapter faults (429 + timeout) and asserting normalized error envelopes while health endpoint remains green.
- F1 compliance audit: Core MVP scope (Tasks 1-11) is implemented and executable; root gate commands run successfully (`lint`, `test`, `build`, `test:e2e`).
- Evidence artifacts exist for Tasks 1-12 under `.sisyphus/evidence/` and align with most acceptance checks.
- [2026-04-08T05:16:00Z] F1 fix: keeping portfolio update UI-minimal (load current state, edit cash/buying power, PATCH existing `/api/portfolio`, show save notice) satisfies compliance without introducing new runtime features.
- [2026-04-08T05:16:00Z] F1 fix: e2e compliance required replacing request-client portfolio mutation with user interactions on `#/portfolio`, while preserving sequence connect -> trade -> portfolio -> metrics.
- [2026-04-08T05:20:44Z] F1 compliance audit: strict plan-fidelity review should explicitly re-check disallowed E2E shortcuts (for this plan, direct \) and confirm UI-driven path in the Playwright spec.
- [2026-04-08T05:20:48Z] F1 compliance audit: strict plan-fidelity review should explicitly re-check disallowed E2E shortcuts (for this plan, direct request.patch('/api/portfolio')) and confirm UI-driven path in the Playwright spec.
- [2026-04-08T06:00:00Z] F4 scope-fidelity gate passed: MVP implementation matches plan must-haves and guardrails; only minor non-blocking scope drift found (duplicate `/api/quote` + `/api/quotes` endpoint semantics).
- [2026-04-08T05:21:53Z] F2 code quality gate: strict review should treat metric denominator semantics as correctness, not style; strategy analytics currently reuse account totalEquity for exposure/sharpe (`apps/worker/src/metrics/analytics.ts`), which can skew per-strategy risk interpretation.
- [2026-04-08T05:21:53Z] F2 code quality gate: duplicated API routes with identical handlers (`/api/quote` + `/api/quotes`) are maintainability risks even when tests pass; prefer one canonical contract path to avoid client divergence.
- [2026-04-08T05:21:53Z] F2 code quality gate: warning-only lint findings (e.g., missing React hook dependency in `apps/web/src/pages/MetricsPage.tsx`) should still be treated as quality debt at final gate when evaluating long-term reliability.
- [2026-04-08T05:23:00Z] F3 manual QA: validated full UI journey (Connect save -> Terminal trade -> Portfolio save -> Metrics load) with worker running; all checkpoints passed and evidence captured under `.sisyphus/evidence/f3-*.png` plus `.sisyphus/evidence/f3-smoke-commands.txt`.
- [2026-04-08T05:23:00Z] Negative-path behavior is enforced at UI level for invalid stock symbols (`@@@`): inline helper text appears and both quote/order actions are disabled, preventing bad submissions before hitting API.
- [2026-04-08T05:23:00Z] Playwright MCP console capture at warning level returned zero warnings/errors for this run (`.sisyphus/evidence/f3-console.log`), and network capture showed successful API interactions (`/api/quote`, `/api/orders`, `/api/fills`, `/health` all 200 in `.sisyphus/evidence/f3-network.log`).
- [2026-04-08T01:31:00Z] F2 blocker fix: strategy-level exposure now uses a strategy-specific capital baseline (max gross cost from strategy-window fills) instead of account-global equity, so per-strategy risk ratios stay interpretable when account cash dwarfs strategy deployment.
- [2026-04-08T01:31:00Z] F2 blocker fix: strategy Sharpe-like ratio now uses per-closed-trade basis denominators for strategy scope while account scope keeps equity-denominated returns; this keeps deterministic behavior and removes cross-scope denominator drift.
- [2026-04-08T01:31:00Z] F2 blocker fix: quote API is now canonicalized to `POST /api/quote`; duplicate plural endpoint removal plus integration assertion (`/api/quotes` => 404) prevents silent client contract divergence.
- [2026-04-08T01:31:00Z] F2 blocker fix: metrics page loader now uses `useCallback`-stabilized `fetchStrategies`/`fetchMetrics`/`load` and dependency-complete `useEffect`, eliminating `react-hooks/exhaustive-deps` warning without lint suppression.
- [2026-04-08T05:36:37Z] F2 re-review: blocker-focused remediation verification is strongest when each fix is enforced twice (source citation + explicit regression assertion), e.g., canonical `/api/quote` path plus a test that `/api/quotes` returns 404.
