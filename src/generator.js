'use strict';

const path = require('path');

// ─── Gitmoji Map ─────────────────────────────────────────────────────────────

const GITMOJI = {
  feat:     '✨',
  fix:      '🐛',
  docs:     '📝',
  style:    '💄',
  refactor: '♻️',
  test:     '✅',
  chore:    '🔧',
  perf:     '⚡',
  ci:       '👷',
  build:    '📦',
  revert:   '⏪',
  deps:     '➕',
  init:     '🎉',
  security: '🔒',
  breaking: '💥',
  remove:   '🔥',
  rename:   '🚚',
  types:    '🏷️',
  config:   '🔧',
};

// ─── Type Determination ──────────────────────────────────────────────────────

function determineType(analysis) {
  const { filesByCategory, counts, details, patterns } = analysis;
  const cats = Object.keys(filesByCategory);

  // All new files → feat or init
  if (counts.added > 0 && counts.modified === 0 && counts.deleted === 0) {
    if (cats.length === 1 && cats[0] === 'test') return 'test';
    if (cats.length === 1 && cats[0] === 'docs') return 'docs';
    if (cats.length === 1 && cats[0] === 'ci') return 'ci';
    return 'feat';
  }

  // All deleted
  if (counts.deleted > 0 && counts.added === 0 && counts.modified === 0) {
    return filesByCategory.test ? 'test' : 'refactor';
  }

  // Only renames
  if (counts.renamed > 0 && counts.added === 0 && counts.modified === 0 && counts.deleted === 0) {
    return 'refactor';
  }

  // Dependency changes only
  if (details.some(d => d.type === 'deps-add' || d.type === 'deps-remove') && cats.every(c => c === 'deps' || c === 'config')) {
    return 'chore';
  }

  // Single category dominance
  if (cats.length === 1) {
    switch (cats[0]) {
      case 'test':   return 'test';
      case 'docs':   return 'docs';
      case 'style':  return 'style';
      case 'config': return 'chore';
      case 'ci':     return 'ci';
    }
  }

  // Bug fix signals
  const added = patterns.added || {};
  const removed = patterns.removed || {};
  if (added.errorHandling || added.conditionalAdd) {
    // If we're adding error handling or conditional logic to existing files → likely fix
    if (counts.modified > 0 && counts.added === 0) return 'fix';
  }

  // Performance signals
  if (removed.loopAdd && added.loopAdd) return 'perf';

  // New functionality signals
  if (added.newFunction || added.newClass || added.newComponent || added.newRoute || added.newHook) {
    return 'feat';
  }

  // Auth changes
  if (added.authChange) return counts.added > 0 ? 'feat' : 'fix';

  // Refactoring signals (removing + adding similar patterns)
  if (removed.newFunction && added.newFunction) return 'refactor';
  if (removed.newImport && added.newImport && counts.added === 0) return 'refactor';

  // Default: modifications without new files → fix/refactor
  if (counts.modified > 0 && counts.added === 0) {
    return filesByCategory.code ? 'fix' : 'chore';
  }

  return 'feat';
}

// ─── Scope Detection ─────────────────────────────────────────────────────────

function determineScope(analysis) {
  const { files, filesByCategory } = analysis;

  if (files.length === 1) {
    const f = files[0].file;
    const base = path.basename(f, path.extname(f));
    // Don't use generic names as scope
    if (!['index', 'main', 'app', 'config', 'utils', 'helpers'].includes(base.toLowerCase())) {
      return base.length > 20 ? base.slice(0, 20) : base;
    }
    // Use directory instead
    const dir = path.dirname(f).split('/').filter(d => d !== '.')[0];
    if (dir && dir !== '.') return dir;
  }

  // If all files in one directory
  const dirs = [...new Set(files.map(f => {
    const parts = f.file.split('/');
    return parts.length > 1 ? parts[0] : null;
  }).filter(Boolean))];

  if (dirs.length === 1) return dirs[0];

  // If a single category
  const cats = Object.keys(filesByCategory);
  if (cats.length === 1 && ['test', 'docs', 'ci', 'style'].includes(cats[0])) return cats[0];

  return null;
}

// ─── Subject Generation ──────────────────────────────────────────────────────

function generateSubject(type, analysis) {
  const { files, counts, details, patterns, filesByCategory } = analysis;
  const added = patterns.added || {};
  const removed = patterns.removed || {};

  // ── Special cases ──

  // Initial commit (many new files, various types)
  if (counts.added > 5 && Object.keys(filesByCategory).length > 2) {
    return 'initial project setup';
  }

  // Dependency changes
  const depsAdded = details.find(d => d.type === 'deps-add');
  const depsRemoved = details.find(d => d.type === 'deps-remove');
  if (depsAdded && !depsRemoved) {
    const items = depsAdded.items;
    if (items.length <= 3) return `add ${items.join(', ')} ${items.length === 1 ? 'dependency' : 'dependencies'}`;
    return `add ${items.length} dependencies`;
  }
  if (depsRemoved && !depsAdded) {
    const items = depsRemoved.items;
    if (items.length <= 3) return `remove ${items.join(', ')} ${items.length === 1 ? 'dependency' : 'dependencies'}`;
    return `remove ${items.length} dependencies`;
  }
  if (depsAdded && depsRemoved) return 'update dependencies';

  // Version bump
  if (details.some(d => d.type === 'version-bump') && files.length <= 2) {
    return 'bump version';
  }

  // Renames
  if (counts.renamed > 0 && counts.added === 0 && counts.modified === 0) {
    if (counts.renamed === 1) {
      const f = files.find(f => f.status === 'R');
      return `rename ${path.basename(f.oldFile)} to ${path.basename(f.file)}`;
    }
    return `rename ${counts.renamed} files`;
  }

  // All deletions
  if (counts.deleted > 0 && counts.added === 0 && counts.modified === 0) {
    if (counts.deleted === 1) return `remove ${path.basename(files[0].file)}`;
    return `remove ${counts.deleted} files`;
  }

  // ── Pattern-based subjects ──

  // New component/class/function
  if (added.newComponent?.length) {
    const names = added.newComponent.slice(0, 2);
    return `add ${names.join(', ')} component${names.length > 1 ? 's' : ''}`;
  }

  if (added.newClass?.length) {
    const names = added.newClass.slice(0, 2);
    return `add ${names.join(', ')} class${names.length > 1 ? 'es' : ''}`;
  }

  if (added.newRoute?.length) {
    return `add ${added.newRoute.join('/')} route handler${added.newRoute.length > 1 ? 's' : ''}`;
  }

  if (added.newHook?.length) {
    return `add ${added.newHook.slice(0, 2).join(', ')} hook${added.newHook.length > 1 ? 's' : ''}`;
  }

  if (added.newMiddleware) return 'add middleware';

  if (added.authChange) return counts.added > 0 ? 'add authentication' : 'update authentication logic';

  if (added.dbOperation) return counts.added > 0 ? 'add database operations' : 'update database queries';

  if (added.stateChange) return 'update state management';

  if (added.validation) return 'add input validation';

  if (added.apiCall) return counts.added > 0 ? 'add API integration' : 'update API calls';

  if (added.eventListener) return 'add event handling';

  if (added.errorHandling && type === 'fix') return 'add error handling';

  // New functions (when adding new files)
  if (added.newFunction?.length && type === 'feat') {
    const names = added.newFunction.slice(0, 3);
    if (names.length === 1) return `add ${names[0]} function`;
    return `add ${names.join(', ')} functions`;
  }

  // New interfaces/types
  if (added.newInterface?.length) {
    const names = added.newInterface.slice(0, 2);
    return `add ${names.join(', ')} type${names.length > 1 ? 's' : ''}`;
  }

  // Refactoring (removing old, adding new)
  if (type === 'refactor') {
    if (removed.newFunction?.length && added.newFunction?.length) {
      return 'refactor function implementation';
    }
    if (removed.newImport?.length && added.newImport?.length) {
      return 'refactor imports';
    }
    return `refactor ${files.length === 1 ? path.basename(files[0].file, path.extname(files[0].file)) : `${files.length} files`}`;
  }

  // ── File-based fallbacks ──

  if (type === 'test') {
    const testFiles = files.filter(f => filesByCategory.test?.includes(f));
    if (testFiles.length === 1) {
      const name = path.basename(testFiles[0]?.file || files[0].file).replace(/\.(test|spec)\.[jt]sx?$/, '');
      return counts.added > 0 ? `add ${name} tests` : `update ${name} tests`;
    }
    return counts.added > 0 ? 'add tests' : 'update tests';
  }

  if (type === 'docs') {
    if (files.length === 1) {
      const name = path.basename(files[0].file);
      return counts.added > 0 ? `add ${name}` : `update ${name}`;
    }
    return 'update documentation';
  }

  if (type === 'style') {
    if (files.length === 1) {
      const name = path.basename(files[0].file, path.extname(files[0].file));
      return `update ${name} styles`;
    }
    return 'update styles';
  }

  if (type === 'ci') {
    return counts.added > 0 ? 'add CI configuration' : 'update CI configuration';
  }

  if (type === 'chore') {
    if (files.length === 1 && files[0].file.includes('config')) {
      const name = path.basename(files[0].file, path.extname(files[0].file));
      return `update ${name} configuration`;
    }
    return 'update configuration';
  }

  // ── Single file fallback ──
  if (files.length === 1) {
    const name = path.basename(files[0].file, path.extname(files[0].file));
    const verb = counts.added > 0 ? 'add' : 'update';
    return `${verb} ${name}`;
  }

  // ── Multi-file fallback ──
  if (counts.added > 0 && counts.modified === 0) {
    return `add ${counts.added} new file${counts.added > 1 ? 's' : ''}`;
  }

  // Last resort: use primary directory
  const primaryDir = files[0].file.split('/')[0];
  if (primaryDir && primaryDir !== files[0].file) {
    return `update ${primaryDir}`;
  }

  return `update ${files.length} files`;
}

// ─── Message Composition ─────────────────────────────────────────────────────

function generate(analysis, options = {}) {
  const type = options.type || determineType(analysis);
  const scope = determineScope(analysis);
  const subject = generateSubject(type, analysis);

  let message = type;
  if (scope) message += `(${scope})`;
  message += ': ';

  if (options.emoji) {
    const emoji = GITMOJI[type] || GITMOJI.chore;
    message += `${emoji} `;
  }

  message += subject;

  return { type, scope, subject, message };
}

module.exports = { generate, determineType, determineScope, generateSubject, GITMOJI };
