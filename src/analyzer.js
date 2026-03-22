'use strict';

const path = require('path');

// ─── File Classification ─────────────────────────────────────────────────────

const CATEGORIES = {
  test:   [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /(^|\/)__tests__\//, /(^|\/)test\//, /\.test\./, /\.spec\./],
  docs:   [/\.md$/i, /\.mdx$/i, /\.txt$/i, /\.rst$/i, /^docs\//, /^doc\//, /changelog/i, /readme/i, /contributing/i, /license/i],
  ci:     [/\.github\/workflows\//, /\.gitlab-ci/, /jenkinsfile/i, /\.circleci/, /\.travis/],
  deps:   [/^package\.json$/, /^package-lock\.json$/, /^yarn\.lock$/, /^pnpm-lock\.yaml$/, /^gemfile/i, /^cargo\.toml$/i, /^go\.(mod|sum)$/, /^requirements.*\.txt$/, /^pipfile/i],
  config: [/\.config\.[jt]s$/, /\.ya?ml$/, /\.toml$/, /\.env/, /\.ini$/, /tsconfig/, /\.eslint/, /\.prettier/, /\.babel/, /\.webpack/, /vite\.config/, /next\.config/, /jest\.config/, /rollup\.config/, /\.editorconfig/, /dockerfile/i, /docker-compose/, /\.github\//, /\.gitignore/, /\.npmrc/, /\.nvmrc/, /\.json$/],
  style:  [/\.css$/, /\.scss$/, /\.sass$/, /\.less$/, /\.styl$/, /\.styled\.[jt]sx?$/],
};

function classifyFile(filepath) {
  const name = filepath.toLowerCase();
  for (const [cat, patterns] of Object.entries(CATEGORIES)) {
    if (patterns.some(p => p.test(name))) return cat;
  }
  return 'code';
}

// ─── Diff Parsing ─────────────────────────────────────────────────────────────

function parseDiff(rawDiff) {
  if (!rawDiff) return [];
  const files = [];
  const chunks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    if (!headerMatch) continue;

    const file = { path: headerMatch[2], added: [], removed: [] };

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        file.added.push(line.slice(1));
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        file.removed.push(line.slice(1));
      }
    }
    files.push(file);
  }
  return files;
}

// ─── Change Detection Patterns ───────────────────────────────────────────────

const CODE_PATTERNS = {
  // Functions
  newFunction:     { pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?/, extract: m => m[1] || m[2] },
  newClass:        { pattern: /^(?:export\s+)?(?:default\s+)?class\s+(\w+)/, extract: m => m[1] },
  newInterface:    { pattern: /^(?:export\s+)?(?:interface|type)\s+(\w+)/, extract: m => m[1] },
  newComponent:    { pattern: /^(?:export\s+)?(?:default\s+)?(?:function|const)\s+(\w+).*(?:React|jsx|tsx|render|return\s*\()/, extract: m => m[1] },
  newImport:       { pattern: /^import\s+.*from\s+['"]([^'"]+)['"]/, extract: m => m[1] },
  newExport:       { pattern: /^export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/, extract: m => m[1] },
  newRoute:        { pattern: /(?:app|router)\.\s*(get|post|put|delete|patch|use)\s*\(/, extract: m => m[1].toUpperCase() },
  errorHandling:   { pattern: /(?:try\s*{|catch\s*\(|\.catch\(|throw\s+new|Error\()/, extract: () => 'error handling' },
  newHook:         { pattern: /^(?:export\s+)?(?:function|const)\s+(use\w+)/, extract: m => m[1] },
  newMiddleware:   { pattern: /(?:middleware|app\.use)\s*\(/, extract: () => 'middleware' },
  newEnum:         { pattern: /^(?:export\s+)?enum\s+(\w+)/, extract: m => m[1] },
  returnChange:    { pattern: /^\s*return\s+/, extract: () => 'return value' },
  conditionalAdd:  { pattern: /^\s*(?:if|else|switch|case)\s*[\s(]/, extract: () => 'conditional logic' },
  loopAdd:         { pattern: /^\s*(?:for|while|do)\s*[\s(]/, extract: () => 'loop' },
  apiCall:         { pattern: /(?:fetch|axios|http|request)\s*[\.(]/, extract: () => 'API call' },
  eventListener:   { pattern: /\.(?:addEventListener|on|once|emit)\s*\(/, extract: () => 'event handling' },
  validation:      { pattern: /(?:validate|sanitize|check|assert|expect|should|must)\s*[\.(]/, extract: () => 'validation' },
  logging:         { pattern: /console\.\w+\(|logger\.\w+\(/, extract: () => 'logging' },
  stateChange:     { pattern: /(?:setState|useState|useReducer|createStore|createSlice)\s*[\.(]/, extract: () => 'state management' },
  dbOperation:     { pattern: /(?:\.find|\.create|\.update|\.delete|\.insert|\.select|\.query|prisma\.|mongoose\.)\s*[\.(]/, extract: () => 'database operation' },
  authChange:      { pattern: /(?:auth|login|logout|signin|signup|token|jwt|session|password|credential)/i, extract: () => 'authentication' },
};

function detectPatterns(lines) {
  const found = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    for (const [name, { pattern, extract }] of Object.entries(CODE_PATTERNS)) {
      const m = trimmed.match(pattern);
      if (m) {
        if (!found[name]) found[name] = [];
        const val = extract(m);
        if (val && !found[name].includes(val)) found[name].push(val);
      }
    }
  }
  return found;
}

// ─── Package.json Analysis ───────────────────────────────────────────────────

function analyzePackageJson(added, removed) {
  const changes = { addedDeps: [], removedDeps: [], scripts: false, version: false, other: false };

  const depLine = /^\s*"([^"]+)":\s*"([^"]+)"/;

  // Since we get individual diff lines (not full context), detect deps by checking
  // all added lines for dep-like patterns. Also scan all lines for section headers.
  const allAdded = added.join('\n');
  const allRemoved = removed.join('\n');
  const hasDepsSection = /"(?:dependencies|devDependencies|peerDependencies)"/.test(allAdded) ||
                          /"(?:dependencies|devDependencies|peerDependencies)"/.test(allRemoved);

  for (const line of added) {
    if (/"version"/.test(line)) changes.version = true;
    if (/"scripts"/.test(line)) changes.scripts = true;
    const m = line.match(depLine);
    if (m && !['name', 'version', 'description', 'main', 'license', 'author', 'repository', 'homepage', 'bugs', 'type'].includes(m[1])) {
      changes.addedDeps.push(m[1]);
    }
  }

  for (const line of removed) {
    const m = line.match(depLine);
    if (m && !['name', 'version', 'description', 'main', 'license', 'author', 'repository', 'homepage', 'bugs', 'type'].includes(m[1])) {
      changes.removedDeps.push(m[1]);
    }
  }

  return changes;
}

// ─── Main Analysis ───────────────────────────────────────────────────────────

function analyze(stagedFiles, diff) {
  const parsed = parseDiff(diff);
  const filesByCategory = {};
  const allPatterns = { added: {}, removed: {} };
  const details = [];

  for (const sf of stagedFiles) {
    const cat = classifyFile(sf.file);
    if (!filesByCategory[cat]) filesByCategory[cat] = [];
    filesByCategory[cat].push(sf);
  }

  // Analyze each file's diff
  for (const fileDiff of parsed) {
    const cat = classifyFile(fileDiff.path);
    const addedPatterns = detectPatterns(fileDiff.added);
    const removedPatterns = detectPatterns(fileDiff.removed);

    // Merge patterns
    for (const [k, v] of Object.entries(addedPatterns)) {
      if (!allPatterns.added[k]) allPatterns.added[k] = [];
      allPatterns.added[k].push(...v);
    }
    for (const [k, v] of Object.entries(removedPatterns)) {
      if (!allPatterns.removed[k]) allPatterns.removed[k] = [];
      allPatterns.removed[k].push(...v);
    }

    // Package.json special handling
    if (fileDiff.path === 'package.json') {
      const pkgChanges = analyzePackageJson(fileDiff.added, fileDiff.removed);
      if (pkgChanges.addedDeps.length) details.push({ type: 'deps-add', items: pkgChanges.addedDeps });
      if (pkgChanges.removedDeps.length) details.push({ type: 'deps-remove', items: pkgChanges.removedDeps });
      if (pkgChanges.version) details.push({ type: 'version-bump' });
      if (pkgChanges.scripts) details.push({ type: 'scripts-change' });
    }
  }

  // Count operations
  const counts = { added: 0, modified: 0, deleted: 0, renamed: 0 };
  for (const sf of stagedFiles) {
    if (sf.status === 'A') counts.added++;
    else if (sf.status === 'M') counts.modified++;
    else if (sf.status === 'D') counts.deleted++;
    else if (sf.status === 'R') counts.renamed++;
  }

  return {
    files: stagedFiles,
    filesByCategory,
    patterns: allPatterns,
    details,
    counts,
    totalFiles: stagedFiles.length,
  };
}

module.exports = { analyze, classifyFile, parseDiff, detectPatterns };
