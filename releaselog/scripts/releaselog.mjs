#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SECTION_ORDER = [
  { key: 'feat', heading: 'New Features' },
  { key: 'fix', heading: 'Bug Fixes' },
  { key: 'docs', heading: 'Doc Changes' },
  { key: 'other', heading: 'Others' },
];

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitOrNull(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function env(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function tagExists(tag) {
  return gitOrNull(['rev-parse', '--verify', `refs/tags/${tag}`]) !== null;
}

function resolveTag() {
  const tag = env('INPUT_TAG') || env('GITHUB_REF_NAME');
  if (!tag) {
    throw new Error('No tag provided. Set the "tag" input or run on a tag push event.');
  }
  return tag;
}

function resolvePreviousTag(tag) {
  const explicit = env('INPUT_PREVIOUS_TAG');
  if (explicit) return explicit;

  const described = gitOrNull(['describe', '--tags', '--abbrev=0', `${tag}^`]);
  if (described && described !== tag) return described;
  return null;
}

function parseType(subject) {
  const match = subject.match(/^([a-zA-Z]+)(\([^)]*\))?!?:\s*/);
  return match ? match[1].toLowerCase() : 'other';
}

function collectCommits(range) {
  const raw = gitOrNull(['log', '--no-merges', '--pretty=format:%H%x1f%s', range]);
  if (!raw) return [];

  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split('\x1f');
      return {
        hash,
        short: hash.slice(0, 7),
        subject: subject || '',
        type: parseType(subject || ''),
      };
    });
}

function collectContributors(range) {
  const raw = gitOrNull(['shortlog', '-sne', range]);
  if (!raw) return [];

  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(.*?)\s*<.*>$/);
      if (!match) return null;
      return { name: match[2].trim(), commits: Number(match[1]) };
    })
    .filter(Boolean)
    .sort((a, b) => b.commits - a.commits);
}

function buildCompareUrl(previousTag, tag) {
  const server = env('GITHUB_SERVER_URL', 'https://github.com');
  const repo = env('GITHUB_REPOSITORY', '');
  if (!repo) return '';
  if (previousTag) {
    return `${server}/${repo}/compare/${previousTag}...${tag}`;
  }
  return `${server}/${repo}/commits/${tag}`;
}

function buildNotes({ commits, contributors, compareUrl }) {
  const grouped = new Map(SECTION_ORDER.map((section) => [section.key, []]));
  for (const commit of commits) {
    const key = grouped.has(commit.type) ? commit.type : 'other';
    grouped.get(key).push(commit);
  }

  const lines = [];

  for (const section of SECTION_ORDER) {
    const items = grouped.get(section.key);
    if (!items.length) continue;
    lines.push(`## ${section.heading}`);
    for (const item of items) {
      lines.push(`- ${item.subject} (${item.short})`);
    }
    lines.push('');
  }

  if (contributors.length) {
    lines.push('## Contributors');
    for (const person of contributors) {
      const label = person.commits === 1 ? 'commit' : 'commits';
      lines.push(`- ${person.name} (${person.commits} ${label})`);
    }
    lines.push('');
  }

  if (compareUrl) {
    lines.push('## Full Change Log');
    lines.push(compareUrl);
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

function publish({ tag, notes, isPrerelease, branch }) {
  const notesFile = join(tmpdir(), `releaselog-${tag.replace(/[^\w.-]/g, '_')}.md`);
  writeFileSync(notesFile, notes, 'utf8');

  const args = ['release', 'create', tag, '--title', tag, '--notes-file', notesFile];
  if (isPrerelease) args.push('--prerelease');

  if (tagExists(tag)) {
    args.push('--verify-tag');
  } else if (isPrerelease && branch) {
    args.push('--target', branch);
  }

  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`, 'utf8');
  } else {
    process.stdout.write(`::set-output name=${name}::${value}\n`);
  }
}

function main() {
  const tag = resolveTag();
  const isPrerelease = tag.includes('-');
  const branch = env('INPUT_PRERELEASE_BRANCH', 'dev');
  const dryRun = env('INPUT_DRY_RUN', 'false').toLowerCase() === 'true';

  const previousTag = resolvePreviousTag(tag);
  const range = previousTag ? `${previousTag}..${tag}` : tag;

  const commits = collectCommits(range);
  const contributors = collectContributors(range);
  const compareUrl = buildCompareUrl(previousTag, tag);
  const notes = buildNotes({ commits, contributors, compareUrl });

  process.stdout.write(notes);

  setOutput('is-prerelease', String(isPrerelease));

  if (dryRun) {
    setOutput('release-url', '');
    return;
  }

  const url = publish({ tag, notes, isPrerelease, branch });
  setOutput('release-url', url);
}

main();
