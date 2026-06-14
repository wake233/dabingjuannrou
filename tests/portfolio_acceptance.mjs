import fs from "node:fs";
import { portfolioSummary } from "../static/portfolio.js";

const portfolio = JSON.parse(fs.readFileSync(new URL("../docs/portfolio.json", import.meta.url), "utf8"));
const summary = portfolioSummary(portfolio.subjects);
console.log(`Portfolio: ${summary.total} subjects`);
console.log(`Note: ${summary.note}`);
for (const entry of summary.flagship) {
  const results = entry.drafts.map(draft => `${draft.variant + 1}:${draft.quality.score}`).join(" ");
  console.log(`${entry.themeId}: ${results} | ${entry.passed ? "PASS" : "FAIL"}`);
}
if (!summary.passed) {
  console.error("Portfolio structural quality gate failed.");
  process.exitCode = 1;
} else {
  console.log("Portfolio structural quality gate passed. Visual acceptance still requires browser review.");
}
