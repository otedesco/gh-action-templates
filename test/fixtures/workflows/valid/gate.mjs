import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";

const gate = process.argv[2];
const { defect } = JSON.parse(await readFile("fixture.json", "utf8"));
await writeFile(".fixture-result.json", JSON.stringify({ gate, message: "passed" }));
console.log(`GATE ${gate}: started`);
if (defect === gate) {
  console.error(`${gate}: intentional fixture defect detected`);
  process.exitCode = 1;
} else if (gate === "coverage") {
  await mkdir("coverage", { recursive: true });
  await writeFile("coverage/coverage-summary.json", '{"total":{"lines":{"pct":100}}}\n');
} else if (gate === "build") {
  await mkdir("dist", { recursive: true });
  await writeFile("dist/index.js", "export {};\n");
}
