# skill-port Provider Study (March 8, 2026)

This document captures the v0.1 provider compatibility baseline used to implement `skill-port`.

## Scope Decision

- In scope for conversion: `codex`, `claude-code`, `cursor`.
- Out of scope for conversion in v0.1: `microsoft-hve`.
- Rationale: HVE skill frontmatter and packaging are documented and referenced, but conversion from/to HVE adds schema and distribution constraints that are better handled in a later release.

## Source Standards

- OpenAI Codex Skills docs: <https://developers.openai.com/codex/skills>
- OpenAI examples (`SKILL.md` + `agents/openai.yaml`): <https://github.com/openai/skills>
- Claude Code Skills docs: <https://docs.anthropic.com/en/docs/claude-code/skills>
- Cursor Skills docs: <https://cursor.com/docs/skills>
- Cursor Rules docs (non-goal boundary): <https://cursor.com/docs/rules>
- Agent Skills spec: <https://agentskills.io/specification>
- Microsoft HVE reference: <https://github.com/microsoft/hve-core>

## Conversion Matrix

| Source | Target | Status | Notes |
| --- | --- | --- | --- |
| codex | claude-code | Supported | `policy.allow_implicit_invocation` maps to inverse of `disable-model-invocation`. `agents/openai.yaml` extensions are lossy and reported. |
| codex | cursor | Supported | Same policy mapping as above; OpenAI-specific metadata is dropped with report entries. |
| claude-code | codex | Supported | Standard SKILL frontmatter retained; optional `agents/openai.yaml` generated when policy/extensions exist. |
| claude-code | cursor | Supported | Agent Skills-compatible frontmatter preserved. |
| cursor | codex | Supported | Standard frontmatter preserved; OpenAI policy generated from `disable-model-invocation` when available. |
| cursor | claude-code | Supported | Agent Skills-compatible frontmatter preserved. |

## Field Compatibility

| Field | Codex | Claude Code | Cursor | Canonical handling |
| --- | --- | --- | --- | --- |
| `name` | `SKILL.md` | `SKILL.md` | `SKILL.md` | Required and preserved |
| `description` | `SKILL.md` | `SKILL.md` | `SKILL.md` | Required and preserved |
| `license` | Optional (spec-level) | Optional | Optional | Preserved as frontmatter |
| `compatibility` | Optional (spec-level) | Optional | Optional | Preserved as frontmatter |
| `metadata` | Optional | Optional | Optional | Preserved as frontmatter |
| `disable-model-invocation` | Not primary; mapped to OpenAI policy | Optional | Optional | Canonical invocation control |
| `user-invocable` | Not used by OpenAI runtime | Optional | Optional | Preserved when present |
| `allowed-tools` | Spec-level optional | Optional | Optional | Preserved when present |
| `agents/openai.yaml.interface` | Codex-specific | N/A | N/A | Dropped on non-Codex targets with report entry |
| `agents/openai.yaml.dependencies` | Codex-specific | N/A | N/A | Dropped on non-Codex targets with report entry |
| `agents/openai.yaml.policy.allow_implicit_invocation` | Codex-specific | N/A | N/A | Bidirectional mapping with `disable-model-invocation` inverse |

## Lossiness Policy

- Default mode: conversion succeeds with warnings and `skill-port.report.json`.
- Strict mode (`--strict`): conversion fails when dropped fields or conflicts are present.
- Stable report issue codes are used for CI assertions.

## CLI Simplicity Decision

`skill-port` intentionally exposes two commands only:

- `list`
- `convert`

Conversion targets skill name + scope (`user`, `project`, `local`) rather than requiring path-based folder input. For batch workflows, `convert --all` is supported.

## HVE Note

HVE uses `SKILL.md` with a stricter schema and packaging expectations (collection manifests, validation scripts, and distribution conventions). v0.1 intentionally does not implement HVE adapters; this keeps the initial CLI focused on the highest interoperability surface already shared by Agent Skills-compatible providers.
