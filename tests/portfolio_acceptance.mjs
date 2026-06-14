import fs from "node:fs";
import { portfolioSummary } from "../static/portfolio.js";

const portfolio = JSON.parse(fs.readFileSync(new URL("../docs/portfolio.json", import.meta.url), "utf8"));
const summary = portfolioSummary(portfolio.subjects);
console.log(`Portfolio: ${summary.total} subjects`);
console.log(`Note: ${summary.note}`);
for (const entry of summary.entries) {
  const storybookInfo = entry.styles.storybook;
  console.log(`${entry.title}: ${storybookInfo.composition} | ${storybookInfo.draftsCount} drafts | requires visual review`);
}
console.log("Portfolio structural evaluation complete. Visual acceptance requires manual review.");
