import fs from "node:fs";
import { portfolioSummary } from "../static/portfolio.js";

const portfolio = JSON.parse(fs.readFileSync(new URL("../docs/portfolio.json", import.meta.url), "utf8"));
const summary = portfolioSummary(portfolio.subjects);
for (const entry of summary.entries) {
  console.log(`${entry.passed ? "PASS" : "FAIL"} ${entry.title}: ${entry.average}/5`);
}
console.log(`Portfolio: ${summary.passed}/${summary.total} passed, average ${summary.average}/5`);
if (summary.passed !== summary.total) process.exitCode = 1;
