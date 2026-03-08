---
name: explain-code
description: Explains source code with analogies and diagrams. Use when teaching architecture or onboarding developers.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read Grep Glob
argument-hint: "[path]"
context: fork
agent: Explore
---

# Explain Code

Use clear conceptual language and include ASCII diagrams for control flow.

## Steps

1. Inspect requested files.
2. Summarize responsibilities.
3. Highlight gotchas and edge cases.

See [examples](references/examples.md).
