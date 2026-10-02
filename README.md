<div align="center">

# actions
Reusable GitHub Actions and workflows for any repository.

[![Version](https://img.shields.io/github/v/tag/devs-des1re/actions?label=version)](https://github.com/devs-des1re/actions/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## Usage

Reference an action by its folder and a floating major tag:

```yaml
- uses: devs-des1re/actions/releaselog@v1
```

`v1` is moved forward automatically on every stable release, so you always get
the latest `v1.x.x` without changing your workflow.

---

## `releaselog`

Generate a release with grouped changelog notes when you push a tag.

### Setup

```yaml
name: release

on:
  push:
    tags: ["*"]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Resolve checkout ref
        id: ref
        run: |
          if [[ "${GITHUB_REF_NAME}" == *-* ]]; then
            echo "ref=dev" >> "$GITHUB_OUTPUT"
          else
            echo "ref=${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"
          fi

      - uses: actions/checkout@v4
        with:
          ref: ${{ steps.ref.outputs.ref }}
          fetch-depth: 0
          fetch-tags: true

      - uses: devs-des1re/actions/releaselog@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

`fetch-depth: 0` and `permissions: contents: write` are required. Pre-release
tags (containing `-`) check out the `dev` branch so the release is built from
`dev`; stable tags check out the tagged commit.

### Inputs

| Input               | Description                                                                             | Default           |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------- |
| `tag`               | Tag to release.                                                                         | `github.ref_name` |
| `previous-tag`      | Explicit previous tag to compare against. Auto-detected when empty.                     | `''`              |
| `prerelease-branch` | Target branch used when publishing a pre-release.                                       | `dev`             |
| `token`             | GitHub token with `contents: write`.                                                    | `github.token`    |
| `dry-run`           | Render the notes and skip publishing.                                                   | `false`           |
| `custom-message`    | Markdown shown at the top of the notes (e.g. install instructions). Ignored when empty. | `''`              |

### Outputs

| Output          | Description                                         |
| --------------- | --------------------------------------------------- |
| `release-url`   | URL of the created release (empty on dry-run).      |
| `is-prerelease` | Whether the release was published as a pre-release. |

### Custom message

Use `custom-message` to put install or package instructions above the
changelog:

````yaml
- uses: devs-des1re/actions/releaselog@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    custom-message: |
      ## Install

      ```sh
      npm install my-package
      ```
````

### Notes format

Tags containing `-` (e.g. `v1.2.0-rc.1`) are published as a pre-release on the
`dev` branch. Commits are grouped by conventional commit prefix (`feat:`,
`fix:`, `docs:`, and others) between the previous tag and the new one.

Example result for `v1.2.0`:

```markdown
## New Features

- feat: add dark mode toggle (a1b2c3d)

## Bug Fixes

- fix: resolve startup race condition (b2c3d4e)

## Doc Changes

- docs: update installation guide (c3d4e5f)

## Others

- chore: bump dependencies (d4e5f6a)

## Contributors

- Arjun Patel (5 commits)

## Full Change Log

https://github.com/devs-des1re/actions/compare/v1.1.0...v1.2.0
```

## Contributing

Contributions are welcome — bug reports, fixes, and new actions alike. Please
read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

## License

[MIT License](LICENSE) © Arjun Patel
