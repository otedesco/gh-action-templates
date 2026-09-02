import { readFile, writeFile } from "node:fs/promises";
const gate = process.argv[2];
const { defect } = JSON.parse(await readFile("fixture.json", "utf8"));
await writeFile(
  ".fixture-result.json",
  JSON.stringify({
    gate,
    message: defect === gate ? "intentional fixture defect detected: no tests discovered" : "passed",
  }),
);
if (defect === gate) process.exitCode = 1;
