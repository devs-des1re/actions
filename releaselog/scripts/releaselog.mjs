#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SECTION_ORDER = [
  { key: "feat", heading: "New Features" },
  { key: "fix", heading: "Bug Fixes" },
  { key: "docs", heading: "Docs Changes" },
  { key: "other", heading: "Other Changes" },
];

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitOrNull(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function env(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function tagExists(tag) {
  return gitOrNull(["rev-parse", "--verify", `refs/tags/${tag}`]) !== null;
}

function resolveTag() {
  const tag = env("INPUT_TAG") || env("GITHUB_REF_NAME");
  if (!tag) {
    throw new Error(
      'No tag provided. Set the "tag" input or run on a tag push event.',
    );
  }
  return tag;
}

const SEMVER_RE = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function resolvePreviousTag(tag) {
  const explicit = env("INPUT_PREVIOUS_TAG");
  if (explicit) return explicit;

  const merged = gitOrNull(["tag", "--merged", `${tag}^`]);
  if (!merged) return null;

  const candidates = merged
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (candidate) =>
        candidate && candidate !== tag && SEMVER_RE.test(candidate),
    );

  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const count = Number(
      gitOrNull(["rev-list", "--count", `${candidate}..${tag}`]),
    );
    if (Number.isFinite(count) && count < bestDistance) {
      bestDistance = count;
      best = candidate;
    }
  }

  return best;
}

function parseType(subject) {
  const match = subject.match(/^([a-zA-Z]+)(\([^)]*\))?!?:\s*/);
  return match ? match[1].toLowerCase() : "other";
}

function collectCommits(range) {
  const raw = gitOrNull([
    "log",
    "--no-merges",
    "--pretty=format:%H%x1f%s",
    range,
  ]);
  if (!raw) return [];

  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split("\x1f");
      return {
        hash,
        short: hash.slice(0, 7),
        subject: subject || "",
        type: parseType(subject || ""),
      };
    });
}

function collectContributors(range) {
  const raw = gitOrNull([
    "log",
    "--no-merges",
    "--pretty=format:%ae%x1f%an",
    range,
  ]);
  if (!raw) return [];

  const byEmail = new Map();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const [email, name] = line.split("\x1f");
    const key = (email || name || "").toLowerCase();
    if (!key) continue;
    const entry = byEmail.get(key) || { email, commits: 0, names: new Map() };
    entry.commits += 1;
    const display = name || email;
    entry.names.set(display, (entry.names.get(display) || 0) + 1);
    byEmail.set(key, entry);
  }

  return [...byEmail.values()]
    .map((entry) => {
      const name = [...entry.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { name, email: entry.email, commits: entry.commits };
    })
    .sort((a, b) => b.commits - a.commits);
}

function buildAuthorUrl(tag, email) {
  const server = env("GITHUB_SERVER_URL", "https://github.com");
  const repo = env("GITHUB_REPOSITORY", "");
  if (!repo || !email) return "";
  return `${server}/${repo}/commits/${tag}?author=${encodeURIComponent(email)}`;
}

function buildCompareUrl(previousTag, tag) {
  const server = env("GITHUB_SERVER_URL", "https://github.com");
  const repo = env("GITHUB_REPOSITORY", "");
  if (!repo) return "";
  if (previousTag) {
    return `${server}/${repo}/compare/${previousTag}...${tag}`;
  }
  return `${server}/${repo}/commits/${tag}`;
}

function buildNotes({ customMessage, tag, commits, contributors, compareUrl }) {
  const grouped = new Map(SECTION_ORDER.map((section) => [section.key, []]));
  for (const commit of commits) {
    const key = grouped.has(commit.type) ? commit.type : "other";
    grouped.get(key).push(commit);
  }

  const lines = [];

  if (customMessage) {
    lines.push(customMessage.trim(), "");
  }

  for (const section of SECTION_ORDER) {
    const items = grouped.get(section.key);
    if (!items.length) continue;
    lines.push(`## ${section.heading}`);
    for (const item of items) {
      lines.push(`- ${item.subject} (${item.short})`);
    }
    lines.push("");
  }

  if (contributors.length) {
    lines.push("## Contributors");
    for (const person of contributors) {
      const label = person.commits === 1 ? "commit" : "commits";
      const count = `${person.commits} ${label}`;
      const url = buildAuthorUrl(tag, person.email);
      lines.push(`- ${person.name} (${url ? `[${count}](${url})` : count})`);
    }
    lines.push("");
  }

  if (compareUrl) {
    lines.push("## Full Change Log");
    lines.push(compareUrl);
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function publish({ tag, notes, isPrerelease, branch }) {
  const notesFile = join(
    tmpdir(),
    `releaselog-${tag.replace(/[^\w.-]/g, "_")}.md`,
  );
  writeFileSync(notesFile, notes, "utf8");

  const args = [
    "release",
    "create",
    tag,
    "--title",
    tag,
    "--notes-file",
    notesFile,
  ];
  if (isPrerelease) args.push("--prerelease");

  if (tagExists(tag)) {
    args.push("--verify-tag");
  } else if (isPrerelease && branch) {
    args.push("--target", branch);
  }

  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`, "utf8");
  } else {
    process.stdout.write(`::set-output name=${name}::${value}\n`);
  }
}

function main() {
  const tag = resolveTag();
  const isPrerelease = tag.includes("-");
  const branch = env("INPUT_PRERELEASE_BRANCH", "dev");
  const dryRun = env("INPUT_DRY_RUN", "false").toLowerCase() === "true";
  const customMessage = env("INPUT_CUSTOM_MESSAGE");

  const previousTag = resolvePreviousTag(tag);
  const range = previousTag ? `${previousTag}..${tag}` : tag;

  const commits = collectCommits(range);
  const contributors = collectContributors(range);
  const compareUrl = buildCompareUrl(previousTag, tag);
  const notes = buildNotes({
    customMessage,
    tag,
    commits,
    contributors,
    compareUrl,
  });

  process.stdout.write(notes);

  setOutput("is-prerelease", String(isPrerelease));

  if (dryRun) {
    setOutput("release-url", "");
    return;
  }

  const url = publish({ tag, notes, isPrerelease, branch });
  setOutput("release-url", url);
}

main();
