---
name: deploy-app
description: Deploys this application to staging and production. Use when the user asks for deployment or release workflows.
metadata:
  owner: platform-team
disable-model-invocation: true
custom-field: preserve-me
---

# Deploy App

## Workflow

1. Validate the working tree state.
2. Run deployment checks.
3. Deploy to the requested environment.

See [REFERENCE](references/REFERENCE.md) for full release checklist.
