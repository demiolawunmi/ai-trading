# Paper Trading Terminal MVP (React + Chakra UI)

## TL;DR
> **Summary**: Build a from-scratch paper trading terminal with a React + Chakra UI frontend, a local worker process for strategy execution, and simulated adapters for stocks, crypto, Jupiter, and Polymarket under one normalized trading interface.
> **Deliverables**:
> - React terminal UI with manual market-order flow
> - Local worker/API + deterministic paper execution engine
> - Unified venue adapter contract + 4 simulated adapters
> - Portfolio/balance editing + local-first persistence
> - PnL + risk metrics dashboard for strategy evaluation
> - Automated unit/integration/E2E verification
> **Effort**: XL
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2 → 3 → 4 → 6 → 8 → 10 → 12

## Context
### Original Request
User wants a paper trading terminal that supports four avenues (stock market, crypto, Jupiter, Polymarket), built with React + Chakra UI, with a central editable balance/holdings model, manual trading first, and then a foundation for testing AI/algorithmic strategies.

### Interview Summary
- Confirmed product decisions:
  - Simulated paper adapters first for all 4 venues.
  - V1 manual trading scope: market orders only.
  - Persistence: local-first storage.
  - Metrics in MVP: PnL + risk metrics.
  - Strategy runtime in MVP: local worker process.
  - Connect UX: saved credentials forms per venue (for connection checks/future readiness).
- Repo state: effectively empty; full bootstrap required.

### Metis Review (gaps addressed)
- Added strict trust boundaries: UI ↔ local API/worker ↔ paper engine ↔ adapters.
- Added deterministic simulation requirement (seeded/replayable) to avoid flaky strategy evaluation.
- Added explicit anti-scope-creep guardrails (no live execution, no advanced order types, no full Polymarket auth flow in MVP).
- Added concrete failure-path QA (insufficient buying power, rate limits/timeouts, invalid symbols, stale quotes, restart rehydration).

## Work Objectives
### Core Objective
Deliver an MVP paper-trading platform that is safe, deterministic, locally runnable, and ready for AI strategy experimentation without involving live funds.

### Deliverables
- Bootstrapped app/workspace with React + Chakra UI frontend and local worker/API process.
- Shared domain model and adapter contracts for orders/positions/quotes/events.
- Deterministic paper execution engine supporting market-order simulation.
- Simulated venue adapters for stocks, crypto, Jupiter, Polymarket.
- Manual terminal UX for connect, order placement, holdings/balance editing, and activity tracking.
- Analytics module with PnL and risk metrics.
- Strategy runtime foundation (register/start/stop strategy jobs) in local worker.
- End-to-end automated verification pipeline.

### Definition of Done (verifiable conditions with commands)
- `npm ci` exits with code 0.
- `npm run lint` exits with code 0.
- `npm run test` exits with code 0.
- `npm run build` exits with code 0.
- `npm run test:e2e` exits with code 0.
- `curl -s http://localhost:4000/health` returns `{"status":"ok"}`.
- Posting a market order to local API returns accepted/rejected deterministically for fixture conditions.

### Must Have
- React frontend using Chakra UI components.
- Manual market-order execution flow in terminal.
- Central editable balance + holdings + base currency model.
- 4 venue support through one normalized adapter interface.
- Local worker process for strategy execution.
- Local-first persistence and deterministic replay.
- PnL + risk metrics visible per account and per strategy.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No live-money trading execution.
- No advanced order types (limit/stop/oco) in MVP.
- No custody/key-management backend for production.
- No direct frontend storage of private signing secrets.
- No microservice split or cloud deployment complexity in MVP.
- No manual-only validation steps; all checks must be executable.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **TDD** (unit → integration → e2e) using Vitest + Testing Library + Playwright.
- QA policy: Every task includes happy-path and failure/edge scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1 (Foundation): Tasks 1, 2, 3, 4, 5  
Wave 2 (Domain Integrations + Core UI): Tasks 6, 7, 8, 9  
Wave 3 (Strategy + Analytics + Hardening): Tasks 10, 11, 12

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | — | 2,3,7,8,9,12 |
| 2 | 1 | 3,4,5,6,8,9,10,11,12 |
| 3 | 1,2 | 4,6,8,10,11,12 |
| 4 | 2,3 | 6,8,10,11,12 |
| 5 | 2,4 | 8,9,10,11,12 |
| 6 | 2,3,4 | 8,10,11,12 |
| 7 | 1,2 | 8,12 |
| 8 | 2,4,5,6,7 | 10,12 |
| 9 | 2,5 | 10,12 |
| 10 | 2,4,5,6,8,9 | 12 |
| 11 | 2,3,4,6 | 12 |
| 12 | 1-11 | Final verification |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 5 tasks → `quick` (scaffold), `ultrabrain` (engine/contracts), `unspecified-high` (persistence)
- Wave 2 → 4 tasks → `visual-engineering` (UI), `unspecified-high` (adapters)
- Wave 3 → 3 tasks → `ultrabrain` (analytics/runtime), `unspecified-high` (test hardening)

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Scaffold monorepo, frontend, worker, and baseline toolchain

  **What to do**: Create project structure for `apps/web` (React + Chakra UI) and `apps/worker` (local API/strategy worker), shared package `packages/domain`, root scripts (`dev`, `build`, `lint`, `test`, `test:e2e`), env template files, and a basic `/health` endpoint on worker port `4000`.
  **Must NOT do**: Do not implement trading logic or live API calls yet.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: deterministic scaffolding and script wiring.
  - Skills: `[]` - No special skill required.
  - Omitted: `['playwright']` - No browser QA implementation in this task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2,3,7,8,9,12 | Blocked By: none

  **References**:
  - Pattern: `README.md` - current baseline repository context.
  - Plan: `.sisyphus/plans/paper-trading-terminal-mvp.md` - architecture and guardrails.
  - External: `https://chakra-ui.com/docs/get-started/installation` - Chakra setup.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm ci` passes at repo root.
  - [ ] `npm run build` executes and exits 0.
  - [ ] `npm run lint` executes and exits 0.
  - [ ] `curl -s http://localhost:4000/health` returns `{"status":"ok"}` when worker is running.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Foundation services boot
    Tool: Bash
    Steps: run `npm ci`; run `npm run dev` in background; run `curl -s http://localhost:4000/health`
    Expected: health endpoint returns JSON with status ok
    Evidence: .sisyphus/evidence/task-1-scaffold.txt

  Scenario: Missing env file handling
    Tool: Bash
    Steps: start worker without required env values (empty env file)
    Expected: worker starts with safe defaults OR exits with explicit startup error message
    Evidence: .sisyphus/evidence/task-1-scaffold-error.txt
  ```

  **Commit**: YES | Message: `chore(scaffold): initialize web worker domain workspace` | Files: `apps/**, packages/**, package*.json, config files`

- [x] 2. Define shared trading domain and adapter contracts

  **What to do**: Implement shared TypeScript contracts for `Venue`, `MarketOrderRequest`, `OrderResult`, `Position`, `Holding`, `BalanceState`, `Quote`, `StrategyRun`, and event types (`OrderRequested`, `OrderAccepted`, `OrderRejected`, `FillPartial`, `FillComplete`, `PortfolioUpdated`, `MetricsUpdated`). Add runtime schema validation for inbound API payloads.
  **Must NOT do**: Do not encode venue-specific auth internals or advanced order types.

  **Recommended Agent Profile**:
  - Category: `ultrabrain` - Reason: foundational contracts and deterministic event model.
  - Skills: `[]` - No specialized skill required.
  - Omitted: `['frontend-ui-ux']` - Not a visual task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3,4,5,6,8,9,10,11,12 | Blocked By: 1

  **References**:
  - Pattern: `.sisyphus/drafts/paper-trading-terminal.md` - confirmed scope decisions.
  - API/Type: `https://docs.alpaca.markets/docs/trading-api` - order/account primitives.
  - API/Type: `https://dev.jup.ag/docs/swap/v1/get-quote` - quote route model inspiration.
  - API/Type: `https://docs.polymarket.com/api-reference/authentication` - auth boundary constraints.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Type-check passes for shared domain package (`npm run build` includes package compile).
  - [ ] Contract tests reject invalid payloads (missing symbol/side/notional etc.).
  - [ ] Event types include deterministic timestamp + correlation ID fields.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Valid contract payload round-trip
    Tool: Bash
    Steps: run unit tests for domain schemas and serializers
    Expected: valid market-order and portfolio payload fixtures pass schema validation
    Evidence: .sisyphus/evidence/task-2-contracts.txt

  Scenario: Invalid contract payload rejected
    Tool: Bash
    Steps: run test fixture with malformed order `{ side: "hold" }`
    Expected: schema validation fails with explicit error path
    Evidence: .sisyphus/evidence/task-2-contracts-error.txt
  ```

  **Commit**: YES | Message: `feat(domain): add normalized trading contracts and event model` | Files: `packages/domain/**`

- [x] 3. Implement deterministic paper execution engine

  **What to do**: Build execution engine that accepts normalized market orders, validates buying power/holdings constraints, simulates fills with deterministic seed-based latency/slippage/partial-fill rules, and emits ledger events.
  **Must NOT do**: Do not call external live trading APIs; do not add limit/stop logic.

  **Recommended Agent Profile**:
  - Category: `ultrabrain` - Reason: deterministic simulation logic with accounting correctness.
  - Skills: `[]` - No specialized skill required.
  - Omitted: `['playwright']` - Backend logic only.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 4,6,8,10,11,12 | Blocked By: 1,2

  **References**:
  - Pattern: `https://docs.alpaca.markets/docs/paper-trading` - simulation assumptions.
  - API/Type: `.sisyphus/plans/paper-trading-terminal-mvp.md` (Must NOT Have + determinism requirements).

  **Acceptance Criteria** (agent-executable only):
  - [ ] Given fixed seed and identical order stream, emitted fill sequence is identical across runs.
  - [ ] Engine rejects orders for insufficient buying power/insufficient holdings with structured reason codes.
  - [ ] Engine supports both full and partial fills in deterministic mode.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Deterministic replay
    Tool: Bash
    Steps: run simulation test twice with seed `42` and same input fixture
    Expected: snapshots of fill events are byte-identical
    Evidence: .sisyphus/evidence/task-3-engine.txt

  Scenario: Insufficient buying power rejection
    Tool: Bash
    Steps: submit buy order exceeding available cash in integration test
    Expected: response status rejected with reason `INSUFFICIENT_BUYING_POWER`
    Evidence: .sisyphus/evidence/task-3-engine-error.txt
  ```

  **Commit**: YES | Message: `feat(engine): add deterministic paper execution and rejection rules` | Files: `apps/worker/**, packages/domain/**`

- [x] 4. Add local-first persistence and event ledger replay

  **What to do**: Implement local persistence for balances, holdings, orders, fills, and strategy runs; support startup rehydration and replay from event ledger to rebuild current portfolio/metrics state.
  **Must NOT do**: Do not add external DB dependencies or cloud persistence.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-cutting persistence + replay correctness.
  - Skills: `[]` - No special skill required.
  - Omitted: `['frontend-ui-ux']` - data-layer task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6,8,10,11,12 | Blocked By: 2,3

  **References**:
  - Pattern: `.sisyphus/drafts/paper-trading-terminal.md` - local-first decision.
  - API/Type: Task 3 event model from shared contracts.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Restarting worker restores prior account/position state from persisted ledger.
  - [ ] Corrupted ledger segment triggers graceful recovery path and explicit error event.
  - [ ] Persistence tests cover save/load/version migration stub.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Restart rehydration
    Tool: Bash
    Steps: place fixture trades; stop worker; restart worker; query positions endpoint
    Expected: restored balances/positions equal pre-restart snapshot
    Evidence: .sisyphus/evidence/task-4-persistence.txt

  Scenario: Corrupt storage handling
    Tool: Bash
    Steps: inject malformed ledger record before startup
    Expected: worker logs deterministic recovery error and continues with safe state
    Evidence: .sisyphus/evidence/task-4-persistence-error.txt
  ```

  **Commit**: YES | Message: `feat(storage): implement local ledger persistence and replay` | Files: `apps/worker/**`

- [x] 5. Implement simulated venue adapters for stocks, crypto, Jupiter, and Polymarket

  **What to do**: Implement 4 adapters behind the shared interface. Each adapter returns deterministic quotes and executes via paper engine path. Include per-venue metadata (trading hours, symbol formatting, min notional/size rules) and consistent error normalization.
  **Must NOT do**: Do not place real orders on external venues; do not implement Polymarket L1/L2 signing flow.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: multi-adapter normalization and failure mapping.
  - Skills: `[]` - No special skill required.
  - Omitted: `['git-master']` - no git-specific requirement.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8,9,10,11,12 | Blocked By: 2,4

  **References**:
  - Pattern: `https://docs.alpaca.markets/docs/trading-api` - stock/crypto order primitives.
  - Pattern: `https://dev.jup.ag/docs/swap/v1/get-quote` - quote semantics for Jupiter adapter simulation.
  - Pattern: `https://docs.polymarket.com/api-reference/authentication` - keep auth concerns out of MVP execution path.
  - API/Type: `packages/domain/**` - adapter contract definitions.

  **Acceptance Criteria** (agent-executable only):
  - [ ] All adapters satisfy shared TypeScript interface with no `any` escape hatches.
  - [ ] Venue-specific validation errors map to normalized error codes.
  - [ ] Adapter tests cover at least 1 happy and 2 failure cases per venue.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Multi-venue market order simulation
    Tool: Bash
    Steps: run integration fixture placing one order per venue
    Expected: each returns accepted/rejected using normalized response shape
    Evidence: .sisyphus/evidence/task-5-adapters.txt

  Scenario: Venue rule violation normalization
    Tool: Bash
    Steps: submit below-min-size orders for each venue fixture
    Expected: all failures map to normalized code `INVALID_ORDER_SIZE`
    Evidence: .sisyphus/evidence/task-5-adapters-error.txt
  ```

  **Commit**: YES | Message: `feat(adapters): add simulated venue adapters for four markets` | Files: `apps/worker/src/adapters/**`

- [x] 6. Build worker API endpoints for terminal and strategy control

  **What to do**: Expose local API endpoints: health, connect status, balances/holdings (read/update), quote retrieval, market order submit, positions/orders/fills query, strategy register/start/stop/status, and metrics retrieval.
  **Must NOT do**: Do not expose raw secrets via API responses or logs.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: API surface + orchestration correctness.
  - Skills: `[]` - No special skill required.
  - Omitted: `['frontend-ui-ux']` - backend endpoint work.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8,10,11,12 | Blocked By: 2,3,4

  **References**:
  - Pattern: Task 2 contracts and Task 3/4 services.
  - External: `https://docs.polymarket.com/api-reference/authentication` - keep authentication server-side for future live mode.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `GET /health` returns `{"status":"ok"}`.
  - [ ] `POST /api/orders/market` accepts normalized payload and returns deterministic result.
  - [ ] `PATCH /api/portfolio` updates balances/holdings with validation and persistence.
  - [ ] Strategy lifecycle endpoints transition states correctly (idle → running → stopped).

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full API happy path
    Tool: Bash
    Steps: call connect save endpoint, update portfolio, request quote, submit market order, query metrics
    Expected: each endpoint returns HTTP 2xx and contract-valid payload
    Evidence: .sisyphus/evidence/task-6-api.txt

  Scenario: Invalid payload rejection
    Tool: Bash
    Steps: submit malformed order payload missing `venue`
    Expected: HTTP 400 with structured validation errors
    Evidence: .sisyphus/evidence/task-6-api-error.txt
  ```

  **Commit**: YES | Message: `feat(api): add local worker endpoints for trading and strategies` | Files: `apps/worker/src/api/**`

- [x] 7. Implement frontend app shell with Chakra UI and route structure

  **What to do**: Build React app shell with Chakra provider/theme, responsive layout, nav/route skeleton for Terminal, Portfolio, Strategies, Metrics, and Connect screens. Add shared form, table, and status components.
  **Must NOT do**: Do not implement business logic side effects beyond stubbed data hooks.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: UI architecture and Chakra patterns.
  - Skills: `[]` - No additional skill required.
  - Omitted: `['ultrabrain']` - not algorithmic-heavy.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8,12 | Blocked By: 1,2

  **References**:
  - Pattern: `https://chakra-ui.com/docs/get-started/installation` - provider/theme setup.
  - API/Type: `packages/domain/**` - UI type-safe contracts.

  **Acceptance Criteria** (agent-executable only):
  - [ ] App renders all required routes without runtime errors.
  - [ ] Chakra theme provider wraps app and consistent tokens/components are used.
  - [ ] Basic accessibility checks pass for nav and forms (label associations, keyboard navigation).

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: UI shell renders key routes
    Tool: Playwright
    Steps: open app; navigate to Terminal, Portfolio, Strategies, Metrics, Connect
    Expected: each route loads expected heading and no uncaught console errors
    Evidence: .sisyphus/evidence/task-7-ui-shell.png

  Scenario: Missing API availability state
    Tool: Playwright
    Steps: run frontend without worker; open app
    Expected: UI shows explicit backend-disconnected status banner
    Evidence: .sisyphus/evidence/task-7-ui-shell-error.png
  ```

  **Commit**: YES | Message: `feat(web): add chakra app shell and navigation routes` | Files: `apps/web/**`

- [x] 8. Deliver manual trading terminal flow (market orders only)

  **What to do**: Implement Terminal screen with venue selector, symbol input, side toggle, quantity/notional input, quote preview, submit order action, order result notifications, and order/fill activity table wired to worker API.
  **Must NOT do**: Do not include limit/stop/advanced order controls.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: dense interaction and stateful UI workflow.
  - Skills: `[]` - No special skill required.
  - Omitted: `['playwright']` - tests authored separately within task but skill not required.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 10,12 | Blocked By: 2,4,5,6,7

  **References**:
  - Pattern: Task 6 order/quote endpoints.
  - API/Type: `packages/domain` order request/response types.
  - External: `https://docs.alpaca.markets/docs/paper-trading` - paper semantics reference.

  **Acceptance Criteria** (agent-executable only):
  - [ ] User can submit valid market order for each venue and receive deterministic result.
  - [ ] Quote preview updates on symbol/size changes with loading/error states.
  - [ ] Order activity table reflects accepted/rejected/fill events.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Market order happy path from UI
    Tool: Playwright
    Steps: select venue `stocks`, symbol `AAPL`, side `BUY`, notional `100`; preview quote; submit
    Expected: success toast shown and activity row with status `accepted`
    Evidence: .sisyphus/evidence/task-8-terminal.png

  Scenario: Invalid symbol handling
    Tool: Playwright
    Steps: enter invalid symbol `@@@`; request quote and submit
    Expected: inline validation error and no order submission occurs
    Evidence: .sisyphus/evidence/task-8-terminal-error.png
  ```

  **Commit**: YES | Message: `feat(terminal): implement manual market-order workflow` | Files: `apps/web/src/features/terminal/**`

- [x] 9. Build connect management UI with locally saved venue credential forms

  **What to do**: Create Connect screen with per-venue credential form schemas, masked-value display, local encrypted-at-rest storage abstraction (best-effort client-side obfuscation + clear security warning), test-connection action against worker sanity checks, and status indicators.
  **Must NOT do**: Do not transmit credentials to third-party endpoints in MVP; do not claim production-grade secret security.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: form-heavy UX and validation flows.
  - Skills: `[]` - No special skill required.
  - Omitted: `['oracle']` - no architectural consult needed in execution step.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10,12 | Blocked By: 2,5

  **References**:
  - Pattern: `https://docs.polymarket.com/api-reference/authentication` - future auth complexity + warning language.
  - Pattern: `https://docs.alpaca.markets/docs/trading-api` - API-key style connect metadata.
  - API/Type: `packages/domain` connect-status contracts.

  **Acceptance Criteria** (agent-executable only):
  - [ ] User can save/edit/delete venue credentials locally for all 4 venues.
  - [ ] Credential values are masked in UI after save except explicit reveal action.
  - [ ] Connection check returns per-venue status without exposing secrets in payload/logs.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Save and reload credentials
    Tool: Playwright
    Steps: enter fixture credentials for all venues; save; refresh page
    Expected: forms repopulate masked values and statuses persist
    Evidence: .sisyphus/evidence/task-9-connect.png

  Scenario: Secret leakage prevention
    Tool: Playwright
    Steps: perform save and connection check; inspect UI and network payload summaries
    Expected: no plain-text secrets rendered in UI logs/toasts or response bodies
    Evidence: .sisyphus/evidence/task-9-connect-error.png
  ```

  **Commit**: YES | Message: `feat(connect): add local credential forms and connection checks` | Files: `apps/web/src/features/connect/**, apps/worker/src/api/connect/**`

- [x] 10. Implement strategy runtime foundation in local worker process

  **What to do**: Add strategy registry and runtime orchestration: register strategy config, start/stop runs, isolated execution loop with heartbeat, deterministic input feed from quote simulator, and event outputs tied to strategy ID.
  **Must NOT do**: Do not implement autonomous live trading connectors or remote execution.

  **Recommended Agent Profile**:
  - Category: `ultrabrain` - Reason: concurrency, state isolation, determinism.
  - Skills: `[]` - No special skill required.
  - Omitted: `['frontend-ui-ux']` - worker-side runtime work.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 12 | Blocked By: 2,4,5,6,8,9

  **References**:
  - Pattern: Task 6 strategy endpoints.
  - API/Type: shared `StrategyRun` and event contracts in `packages/domain/**`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Strategy runs can transition through `registered`, `running`, `stopped`, `failed` states.
  - [ ] Runtime enforces one active instance per strategy ID unless explicitly configured for multi-instance.
  - [ ] Worker restart restores run metadata and allows manual resume.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Strategy lifecycle happy path
    Tool: Bash
    Steps: register strategy fixture; start; observe heartbeat; stop; query status
    Expected: state transitions follow registered→running→stopped with timestamps
    Evidence: .sisyphus/evidence/task-10-strategy-runtime.txt

  Scenario: Strategy runtime failure isolation
    Tool: Bash
    Steps: run strategy fixture that throws exception
    Expected: run marked failed with error reason; worker process remains healthy
    Evidence: .sisyphus/evidence/task-10-strategy-runtime-error.txt
  ```

  **Commit**: YES | Message: `feat(strategy): add local worker strategy runtime orchestration` | Files: `apps/worker/src/strategy/**`

- [x] 11. Implement analytics: PnL + risk metrics (account and per-strategy)

  **What to do**: Compute realized PnL, unrealized PnL, total equity, max drawdown, win rate, exposure, and a simple Sharpe-like return ratio from event ledger snapshots. Render Metrics screen with account and strategy views plus time-window filters.
  **Must NOT do**: Do not invent non-deterministic metric formulas; avoid unbounded historical recomputation inefficiency.

  **Recommended Agent Profile**:
  - Category: `ultrabrain` - Reason: financial metric correctness and reproducibility.
  - Skills: `[]` - No special skill required.
  - Omitted: `['quick']` - complexity exceeds trivial changes.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12 | Blocked By: 2,3,4,6

  **References**:
  - Pattern: Task 3 event/fill model and Task 4 replay pipeline.
  - API/Type: metrics contracts in `packages/domain/**`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Metric fixture tests assert exact numeric outputs for seeded scenarios.
  - [ ] Metrics endpoint supports account-level and strategy-level filtering.
  - [ ] Metrics UI displays loading/empty/error states with explicit messages.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Deterministic metrics validation
    Tool: Bash
    Steps: run analytics unit tests with fixed event fixture set
    Expected: exact expected values for realized/unrealized PnL, drawdown, win rate, exposure
    Evidence: .sisyphus/evidence/task-11-metrics.txt

  Scenario: Missing mark-price data
    Tool: Bash
    Steps: run metrics computation with absent latest price for one symbol
    Expected: metric pipeline returns explicit partial-data warning and excludes affected unrealized component safely
    Evidence: .sisyphus/evidence/task-11-metrics-error.txt
  ```

  **Commit**: YES | Message: `feat(metrics): add pnl and risk analytics for account and strategies` | Files: `apps/worker/src/metrics/**, apps/web/src/features/metrics/**`

- [x] 12. Harden integration, add full E2E suite, and finalize operator docs

  **What to do**: Wire all flows end-to-end, add integration tests for API + engine + persistence, add Playwright E2E for UI critical paths, and provide concise runbook (`dev`, test, troubleshooting, known MVP limits).
  **Must NOT do**: Do not expand feature scope; only stabilization and verification.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: system-level QA and reliability hardening.
  - Skills: `[]` - No special skill required.
  - Omitted: `['ai-slop-remover']` - broad system task, not single-file cleanup.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final Verification Wave | Blocked By: 1-11

  **References**:
  - Pattern: `.sisyphus/plans/paper-trading-terminal-mvp.md` full task checklist.
  - Test: Playwright route and terminal/connect/metrics scenarios from Tasks 7-11.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run lint && npm run test && npm run build && npm run test:e2e` all pass.
  - [ ] End-to-end scenario covers connect save → manual trade → portfolio update → metrics update.
  - [ ] Runbook documents startup commands, env keys, and deterministic seed replay procedure.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full terminal journey
    Tool: Playwright
    Steps: save connect credentials; edit balance; place market order; verify holdings + metrics update
    Expected: all transitions succeed and persisted data survives reload
    Evidence: .sisyphus/evidence/task-12-e2e.png

  Scenario: Rate limit / timeout resilience
    Tool: Bash
    Steps: inject adapter 429/timeout fault in integration suite
    Expected: retries/backoff policy applied; user-facing error normalized; worker remains healthy
    Evidence: .sisyphus/evidence/task-12-e2e-error.txt
  ```

  **Commit**: YES | Message: `test(e2e): harden integrated flows and publish mvp runbook` | Files: `apps/**/__tests__/**, apps/**/e2e/**, README.md`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Keep atomic commits aligned to one task each.
- Enforce conventional commit messages (`type(scope): description`).
- Require green lint/test/build before each commit.
- Squash fixup commits into parent task commit before final verification wave.

## Success Criteria
- User can manually place simulated market orders across the 4 venues through one terminal UI.
- Balance/holdings/base currency are editable and persist across app restarts.
- Strategy jobs run from local worker and produce reproducible outputs with fixed seed.
- PnL and risk metrics are computed consistently from event ledger data.
- All automated checks and QA scenarios pass with saved evidence artifacts.
