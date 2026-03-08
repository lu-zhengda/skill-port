# skill-port

`skill-port` converts AI coding skill packages between:

- `codex`
- `claude-code`
- `cursor`

The CLI is intentionally simple:

- `list`: show skills in a scope
- `convert`: convert one named skill across providers

## Install

```bash
npm install
npm run build
npm link
```

Then run:

```bash
skill-port --help
```

## Commands

### list

```bash
skill-port list [--scope <scope>] [--provider <provider|all>] [--show-paths] [--format text|json]
```

Defaults:

- `scope=user`
- `provider=all`
- paths hidden unless `--show-paths`

### convert

```bash
skill-port convert [<skill-name> | --all] --to <provider> [--from <provider|auto>] [--scope <scope>] [--target-scope <scope>] [--out <dir>] [--report <path>] [--strict] [--dry-run] [--overwrite] [--format text|json]
```

Defaults:

- `from=auto`
- `scope=user`
- `target-scope` matches `scope`

Notes:

- `<skill-name>` is required unless `--all` is set.
- `--all` converts all skills in the selected scope/provider set.
- `--all` cannot be combined with `--out` or `--report`.
- `--all` continues per-skill on errors and exits non-zero if any skill fails.
- `<skill-name>` must be a single directory name (no path separators).

## Scopes

- `user`
- `project`
- `local`

Provider roots used by scope:

- `codex`: `.agents/skills`
- `claude-code`: `.claude/skills`
- `cursor`: `.cursor/skills`

`user` scope resolves under the user home. `project` resolves under the nearest git root. `local` resolves under current working directory.

## Examples

```bash
# list all user-scoped skills
skill-port list

# list project-scoped codex skills
skill-port list --scope project --provider codex

# convert a user-scoped skill from codex to claude-code
skill-port convert deploy-app --from codex --to claude-code

# convert all user-scoped codex skills to cursor
skill-port convert --all --from codex --to cursor

# convert with strict safety checks
skill-port convert deploy-app --from codex --to cursor --strict
```

## Behavior

- Converts by skill name + scope, not by direct input folder path.
- Preserves unknown `SKILL.md` frontmatter keys by default.
- Preserves non-skill files by default (scripts, references, assets, etc.).
- Writes `skill-port.report.json` by default in output directory.

## Strict Mode

Use `--strict` to fail conversions that contain lossy mappings or conflicts.

## Open Source

- Contributor guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Security policy: [`SECURITY.md`](./SECURITY.md)
- Community standards: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)

## Scripts

```bash
npm run lint
npm test
npm run build
npm run test:e2e:live
```

`test:e2e:live` is optional and requires network access plus `SKILL_PORT_LIVE_E2E=1`.

## Provider Study

See [`docs/provider-study.md`](docs/provider-study.md) for the March 8, 2026 compatibility baseline and field matrix.
