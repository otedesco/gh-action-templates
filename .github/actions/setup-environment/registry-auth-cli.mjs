import { runRegistryAuth } from "./registry-auth.mjs";

process.exitCode = runRegistryAuth(process.env.INPUT_NPM_TOKEN);
