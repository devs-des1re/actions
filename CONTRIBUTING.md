# Contributing

Thanks for your interest in improving `actions`. This repository is a set of
reusable GitHub Actions and workflows, and contributions of any size are
appreciated.

## Ways to contribute

- Report a bug or request a feature via an issue.
- Fix a bug or improve an existing action.
- Add a new reusable action.

## Development setup

No build step or dependencies are required. The changelog generator is a
zero-dependency Node script that runs on the runner's preinstalled Node.

```sh
node releaselog/scripts/releaselog.mjs
```

## Adding a new action

1. Create a new top-level folder named after the action, e.g. `my-action/`.
2. Add `my-action/action.yml` describing its inputs, outputs, and steps.
3. Put logic in `my-action/scripts/` (prefer zero-dependency Node or shell).
4. Copy `.github/workflows/_template.yml` to `.github/workflows/my-action.yml`
   and wire it up.
5. Document the action in `README.md`.

## Commit messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org).
Useful prefixes:

- `feat:` — a new feature
- `fix:` — a bug fix
- `docs:` — documentation only
- `chore:` — maintenance that is not a feature or fix
- `refactor:` — a change that neither fixes a bug nor adds a feature
- `ci:` — changes to workflows or CI configuration

Commit messages feed directly into the generated release notes.

## Pull requests

- Keep changes focused and describe them clearly.
- Update the `README.md` when behavior or inputs/outputs change.
- Make sure any YAML you touch is valid.
- Prefer small, reviewable commits that follow the convention above.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
