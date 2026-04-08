"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeterministicExecutionContext = void 0;
const DEFAULT_START_TIME = "2026-01-01T00:00:00.000Z";
const DEFAULT_CLOCK_STEP_MS = 1;
const UINT32_DIVISOR = 2 ** 32;
const toUInt32 = (value) => {
    if (!Number.isFinite(value)) {
        throw new Error("Deterministic seed must be a finite number");
    }
    return value >>> 0;
};
const createDeterministicExecutionContext = (options) => {
    let rngState = toUInt32(options.seed);
    let sequence = 0;
    const startTime = Date.parse(options.startTime ?? DEFAULT_START_TIME);
    if (!Number.isFinite(startTime)) {
        throw new Error("Deterministic startTime must be a valid ISO timestamp");
    }
    const clockStepMs = options.clockStepMs ?? DEFAULT_CLOCK_STEP_MS;
    if (!Number.isFinite(clockStepMs) || clockStepMs <= 0) {
        throw new Error("Deterministic clockStepMs must be greater than 0");
    }
    let clockCursor = startTime;
    return {
        nextRandom: () => {
            rngState = (1664525 * rngState + 1013904223) >>> 0;
            return rngState / UINT32_DIVISOR;
        },
        nextId: (prefix) => {
            sequence += 1;
            return `${prefix}-${sequence.toString().padStart(6, "0")}`;
        },
        nowIso: () => {
            const timestamp = new Date(clockCursor).toISOString();
            clockCursor += clockStepMs;
            return timestamp;
        },
        advanceByMs: (milliseconds) => {
            if (!Number.isFinite(milliseconds) || milliseconds < 0) {
                throw new Error("Deterministic advanceByMs requires a non-negative finite value");
            }
            clockCursor += Math.floor(milliseconds);
        },
    };
};
exports.createDeterministicExecutionContext = createDeterministicExecutionContext;
