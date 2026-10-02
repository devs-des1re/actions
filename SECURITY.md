# Security Policy

## Supported versions

This repository ships reusable GitHub Actions and workflows. Security fixes are
applied to the latest release and the floating major tag (`v1`). Older versions
are not maintained.

| Version        | Supported |
| -------------- | --------- |
| `v1` (latest)  | Yes       |
| Older releases | No        |

## Reporting a vulnerability

Please do **not** report security vulnerabilities through public GitHub issues,
discussions, or pull requests.

Instead, report them privately using GitHub's private vulnerability reporting:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.
3. Fill in as much detail as you can.

Alternatively, email **me@devs-des1re.com** with the subject line
`[SECURITY] actions`.

Please include:

- A description of the vulnerability and its impact.
- The affected action, workflow, input, or commit range.
- Steps to reproduce, ideally with a minimal workflow snippet.
- Any suggested fix or mitigation, if you have one.

## What to expect

- **Acknowledgement** within 48 hours.
- **Assessment** and an initial response within 5 working days.
- **Disclosure** coordinated with you. Once a fix is released, you will be
  credited unless you prefer to stay anonymous.

## Scope

This policy covers the actions and workflows in this repository, including the
changelog generator and the release/major-tag workflows. It does not cover
vulnerabilities in third-party actions or dependencies you choose to use
alongside them.

Because these workflows run with access to a repository's `GITHUB_TOKEN` and can
create releases, please treat anything that could allow unauthorized code
execution, tag or release manipulation, or secret exposure as a vulnerability.
