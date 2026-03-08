---
name: api-review
description: Reviews API changes for compatibility and naming consistency. Use when validating API contracts.
license: Apache-2.0
compatibility: Requires git and jq on PATH
metadata:
  team: api-platform
disable-model-invocation: true
---

# API Review

## Checklist

1. Compare schema and endpoint changes.
2. Validate breaking changes policy.
3. Recommend remediation steps.

Run script: `scripts/review.sh`.
