import express from "express";
import { getAppName } from "@ai-trading/domain";

import { registerApi } from "./api";

const app = express();
const port = 4000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", app: getAppName() });
});

registerApi(app);

app.listen(port, () => {
  console.log(`Worker listening on port ${port}`);
});
