# Contributing

Thanks for contributing to `skill-port`.

## Development Setup

Requirements:

- Node.js `>=20`
- npm

Install and validate:

```bash
npm install
npm run lint
npm test
npm run build
```

Run CLI locally:

```bash
npm run dev -- --help
```

## Pull Requests

Before opening a PR:

```bash
npm run lint
npm test
npm run build
npm pack --dry-run
```

PR expectations:

- Include tests for behavior changes.
- Keep CLI behavior deterministic and machine-friendly.
- Preserve unknown frontmatter fields and non-skill files unless intentionally changed.
- Document any new warning/drop/conflict codes.

## Security and Privacy

- Do not commit secrets, tokens, or private credentials.
- Avoid logging sensitive absolute paths unless explicitly requested.
- If you discover a vulnerability, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## Local-Only Files

The implementation planning file `skill-port.md` is intentionally local-only and must not be committed.
