'use strict';

const { execSync } = require('child_process');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch {
    return '';
  }
}

/** Check if we're inside a git repo */
function isGitRepo() {
  return exec('git rev-parse --is-inside-work-tree') === 'true';
}

/** Get the diff of staged changes */
function getStagedDiff() {
  return exec('git diff --cached');
}

/** Get stat summary of staged changes */
function getStagedStat() {
  return exec('git diff --cached --stat');
}

/** Get list of staged files with status (A/M/D/R) */
function getStagedFiles() {
  const raw = exec('git diff --cached --name-status');
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    const parts = line.split('\t');
    // Rename: R100\told\tnew
    if (parts[0].startsWith('R')) {
      return { status: 'R', file: parts[2], oldFile: parts[1], similarity: parts[0] };
    }
    return { status: parts[0], file: parts[1] };
  });
}

/** Check if there are staged changes */
function hasStagedChanges() {
  return exec('git diff --cached --name-only') !== '';
}

/** Commit with message */
function commit(message) {
  execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: 'inherit' });
}

module.exports = { isGitRepo, getStagedDiff, getStagedStat, getStagedFiles, hasStagedChanges, commit };
