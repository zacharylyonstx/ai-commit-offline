'use strict';

const { analyze, classifyFile, parseDiff, detectPatterns } = require('../src/analyzer');
const { generate, determineType } = require('../src/generator');
const { parseArgs } = require('../src/index');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`);
  } else {
    failed++;
    process.stderr.write(`  \x1b[31m✗\x1b[0m ${name}\n`);
  }
}

// ─── File Classification ─────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mFile Classification\x1b[0m\n');

assert(classifyFile('src/app.test.js') === 'test', 'test file (.test.js)');
assert(classifyFile('__tests__/foo.js') === 'test', 'test file (__tests__/)');
assert(classifyFile('README.md') === 'docs', 'docs file (README.md)');
assert(classifyFile('docs/guide.md') === 'docs', 'docs file (docs/)');
assert(classifyFile('.eslintrc.json') === 'config', 'config file (.eslintrc)');
assert(classifyFile('tsconfig.json') === 'config', 'config file (tsconfig)');
assert(classifyFile('Dockerfile') === 'config', 'config file (Dockerfile)');
assert(classifyFile('styles.css') === 'style', 'style file (.css)');
assert(classifyFile('theme.scss') === 'style', 'style file (.scss)');
assert(classifyFile('.github/workflows/ci.yml') === 'ci', 'CI file');
assert(classifyFile('package.json') === 'deps', 'deps file (package.json)');
assert(classifyFile('yarn.lock') === 'deps', 'deps file (yarn.lock)');
assert(classifyFile('src/index.js') === 'code', 'code file');
assert(classifyFile('lib/utils.ts') === 'code', 'code file (.ts)');

// ─── Diff Parsing ─────────────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mDiff Parsing\x1b[0m\n');

const testDiff = `diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,5 @@
+import express from 'express';
+
 const app = {};
-app.start = () => {};
+app.start = async () => { await init(); };
+export default app;
`;

const parsed = parseDiff(testDiff);
assert(parsed.length === 1, 'parses one file');
assert(parsed[0].path === 'src/app.js', 'correct file path');
assert(parsed[0].added.length === 4, 'correct added lines');
assert(parsed[0].removed.length === 1, 'correct removed lines');

// ─── Pattern Detection ──────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mPattern Detection\x1b[0m\n');

const patterns1 = detectPatterns([
  'export function handleAuth(req, res) {',
  'import jwt from "jsonwebtoken";',
  'const router = express.Router();',
  'try {',
]);
assert(patterns1.newFunction?.includes('handleAuth'), 'detects function');
assert(patterns1.newImport?.includes('jsonwebtoken'), 'detects import');
assert(patterns1.errorHandling?.length > 0, 'detects error handling');

const patterns2 = detectPatterns([
  'class UserService {',
  'export default class ApiClient {',
]);
assert(patterns2.newClass?.includes('UserService'), 'detects class');
assert(patterns2.newClass?.includes('ApiClient'), 'detects exported class');

const patterns3 = detectPatterns([
  'export function useAuth() {',
  'const useTheme = () => {',
]);
assert(patterns3.newHook?.includes('useAuth'), 'detects hook');

// ─── Type Determination ──────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mType Determination\x1b[0m\n');

// All new files → feat
const r1 = generate(analyze(
  [{ status: 'A', file: 'src/new-feature.js' }],
  `diff --git a/src/new-feature.js b/src/new-feature.js
new file mode 100644
--- /dev/null
+++ b/src/new-feature.js
@@ -0,0 +1,3 @@
+export function newFeature() {
+  return true;
+}
`
));
assert(r1.type === 'feat', 'new file → feat');
assert(r1.subject.includes('newFeature'), 'subject mentions function name');

// Test files → test
const r2 = generate(analyze(
  [{ status: 'A', file: 'src/utils.test.js' }],
  ''
));
assert(r2.type === 'test', 'test file → test');

// Docs → docs
const r3 = generate(analyze(
  [{ status: 'M', file: 'README.md' }],
  ''
));
assert(r3.type === 'docs', 'docs file → docs');

// Deletions → refactor
const r4 = generate(analyze(
  [{ status: 'D', file: 'src/old-module.js' }, { status: 'D', file: 'src/legacy.js' }],
  ''
));
assert(r4.type === 'refactor', 'deletions → refactor');
assert(r4.subject.includes('2 files'), 'multi-delete subject');

// Renames
const r5 = generate(analyze(
  [{ status: 'R', file: 'src/newName.js', oldFile: 'src/oldName.js', similarity: 'R100' }],
  ''
));
assert(r5.type === 'refactor', 'rename → refactor');
assert(r5.subject.includes('rename'), 'rename in subject');

// ─── Emoji Mode ──────────────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mEmoji Mode\x1b[0m\n');

const r6 = generate(analyze(
  [{ status: 'A', file: 'src/widget.js' }],
  ''
), { emoji: true });
assert(r6.message.includes('✨'), 'feat emoji present');

const r7 = generate(analyze(
  [{ status: 'M', file: 'README.md' }],
  ''
), { emoji: true });
assert(r7.message.includes('📝'), 'docs emoji present');

// ─── Type Override ───────────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mType Override\x1b[0m\n');

const r8 = generate(analyze(
  [{ status: 'M', file: 'src/app.js' }],
  ''
), { type: 'fix' });
assert(r8.type === 'fix', 'type override works');
assert(r8.message.startsWith('fix'), 'message starts with overridden type');

// ─── CLI Args ────────────────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mCLI Argument Parsing\x1b[0m\n');

const a1 = parseArgs(['--apply', '--emoji', '--type', 'fix']);
assert(a1.apply === true, '--apply parsed');
assert(a1.emoji === true, '--emoji parsed');
assert(a1.type === 'fix', '--type parsed');

const a2 = parseArgs(['-a', '-e', '-t', 'docs']);
assert(a2.apply === true, '-a shorthand');
assert(a2.emoji === true, '-e shorthand');
assert(a2.type === 'docs', '-t shorthand');

const a3 = parseArgs(['--type=chore', '--scope=api']);
assert(a3.type === 'chore', '--type= format');
assert(a3.scope === 'api', '--scope= format');

let threw = false;
try { parseArgs(['--type', 'invalid']); } catch { threw = true; }
assert(threw, 'invalid type throws');

// ─── Package.json Changes ────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mPackage.json Analysis\x1b[0m\n');

const r9 = generate(analyze(
  [{ status: 'M', file: 'package.json' }],
  `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -5,6 +5,8 @@
   "dependencies": {
-    "old-lib": "^1.0.0"
+    "express": "^4.18.0",
+    "lodash": "^4.17.0"
   }
`
));
assert(r9.type === 'chore', 'package.json deps → chore');
assert(r9.subject.includes('dependencies'), 'subject mentions dependencies');

// ─── Scope Detection ─────────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mScope Detection\x1b[0m\n');

const r10 = generate(analyze(
  [{ status: 'M', file: 'src/auth/login.js' }],
  ''
));
assert(r10.scope === 'login', 'single file scope from basename');

const r11 = generate(analyze(
  [{ status: 'M', file: 'src/api/routes.js' }, { status: 'M', file: 'src/api/middleware.js' }],
  ''
));
assert(r11.scope === 'src', 'multi-file scope from common dir');

// ─── Complex Scenarios ───────────────────────────────────────────────────────

process.stdout.write('\n\x1b[1mComplex Scenarios\x1b[0m\n');

// New React component
const r12 = generate(analyze(
  [{ status: 'A', file: 'src/components/UserProfile.tsx' }],
  `diff --git a/src/components/UserProfile.tsx b/src/components/UserProfile.tsx
new file mode 100644
--- /dev/null
+++ b/src/components/UserProfile.tsx
@@ -0,0 +1,10 @@
+import React from 'react';
+
+export default function UserProfile({ user }) {
+  return (
+    <div className="profile">
+      <h1>{user.name}</h1>
+    </div>
+  );
+}
`
));
assert(r12.type === 'feat', 'React component → feat');
assert(r12.subject.includes('UserProfile'), 'subject mentions component');

// Style file
const r13 = generate(analyze(
  [{ status: 'M', file: 'src/styles/theme.css' }],
  ''
));
assert(r13.type === 'style', 'CSS → style');

// CI file
const r14 = generate(analyze(
  [{ status: 'A', file: '.github/workflows/deploy.yml' }],
  ''
));
assert(r14.type === 'ci', 'workflow → ci');

// ─── Summary ─────────────────────────────────────────────────────────────────

process.stdout.write(`\n\x1b[1mResults: ${passed} passed, ${failed} failed\x1b[0m\n\n`);
process.exit(failed > 0 ? 1 : 0);
