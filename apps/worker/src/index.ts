import express from "express";
import { getAppName } from "@ai-trading/domain";

const app = express();
const port = 4000;

app.get("/health", (req, res) => {
  res.json({ status: "ok", app: getAppName() });
});

app.listen(port, () => {
  console.log(`Worker listening on port ${port}`);
});
