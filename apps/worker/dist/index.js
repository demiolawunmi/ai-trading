"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const domain_1 = require("@ai-trading/domain");
const api_1 = require("./api");
const app = (0, express_1.default)();
const port = 4000;
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.json({ status: "ok", app: (0, domain_1.getAppName)() });
});
(0, api_1.registerApi)(app);
app.listen(port, () => {
    console.log(`Worker listening on port ${port}`);
});
