# Quality Script Contract

Every product repository exposes these check-only commands:

```text
format:check
lint:check
type:check
test
test:coverage
build
quality:check
```

`quality:check` runs the first six commands in that order and stops on the first failure. Required checks must not repair files, suppress missing tests, force process exit, or convert failure into success. In particular, required command paths may not use `--fix`, `--write`, `--passWithNoTests`, `--forceExit`, `|| true`, `exit 0`, or an echo-only test placeholder.

Repositories may retain separate developer convenience writers such as `format` or `lint:fix`; those commands are not part of `quality:check` or required CI.

Hermes and web-app intentionally fail their test and coverage commands with an actionable dependency on `OPS-217` and `OPS-228`, respectively, until their test harnesses are delivered. This keeps required checks truthful.
