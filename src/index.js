'use strict';

const { isGitRepo, getStagedDiff, getStagedFiles, hasStagedChanges, commit } = require('./git');
const { analyze } = require('./analyzer');
const { generate } = require('./generator');
const c = require('./colors');

const VERSION = require('../package.json').version;

const HELP = `
${c.bold('ai-commit-offline')} v${VERSION}
${c.dim('AI-quality commit messages. No API key. No cost. No internet.')}

${c.bold('Usage:')}
  ${c.cyan('npx ai-commit')}              Generate a commit message
  ${c.cyan('npx ai-commit --apply')}      Generate and commit
  ${c.cyan('npx ai-commit --emoji')}      Include gitmoji
  ${c.cyan('npx ai-commit --type fix')}   Force commit type

${c.bold('Options:')}
  ${c.yellow('--apply')}        Auto-commit with generated message
  ${c.yellow('--emoji')}        Add gitmoji prefix
  ${c.yellow('--type')} ${c.dim('<type>')}   Force type: feat|fix|docs|style|refactor|test|chore
  ${c.yellow('--scope')} ${c.dim('<s>')}    Override scope
  ${c.yellow('--dry-run')}      Show analysis details
  ${c.yellow('--help')}         Show this help
  ${c.yellow('--version')}      Show version

${c.bold('Conventional Commit Types:')}
  ${c.green('feat')}      New feature
  ${c.green('fix')}       Bug fix
  ${c.green('docs')}      Documentation
  ${c.green('style')}     Styling (CSS, formatting)
  ${c.green('refactor')}  Code refactoring
  ${c.green('test')}      Tests
  ${c.green('chore')}     Maintenance
  ${c.green('perf')}      Performance
  ${c.green('ci')}        CI/CD changes
`;

const VALID_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'build', 'revert'];

function parseArgs(argv) {
  const opts = { apply: false, emoji: false, type: null, scope: null, dryRun: false, help: false, version: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--apply': case '-a': opts.apply = true; break;
      case '--emoji': case '-e': opts.emoji = true; break;
      case '--dry-run': case '-d': opts.dryRun = true; break;
      case '--help': case '-h': opts.help = true; break;
      case '--version': case '-v': opts.version = true; break;
      case '--type': case '-t':
        opts.type = argv[++i];
        if (!VALID_TYPES.includes(opts.type)) {
          throw new Error(`Invalid type "${opts.type}". Valid: ${VALID_TYPES.join(', ')}`);
        }
        break;
      case '--scope': case '-s':
        opts.scope = argv[++i];
        break;
      default:
        if (arg.startsWith('--type=')) {
          opts.type = arg.split('=')[1];
          if (!VALID_TYPES.includes(opts.type)) {
            throw new Error(`Invalid type "${opts.type}". Valid: ${VALID_TYPES.join(', ')}`);
          }
        } else if (arg.startsWith('--scope=')) {
          opts.scope = arg.split('=')[1];
        }
    }
  }
  return opts;
}

async function run(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    process.stdout.write(HELP + '\n');
    return;
  }

  if (opts.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  // Preflight checks
  if (!isGitRepo()) {
    throw new Error('Not a git repository. Run this from inside a git project.');
  }

  if (!hasStagedChanges()) {
    process.stdout.write(`\n${c.yellow('⚠')}  No staged changes found.\n`);
    process.stdout.write(`${c.dim('Stage files first:')} ${c.cyan('git add <files>')}\n\n`);
    return;
  }

  // Analyze
  const stagedFiles = getStagedFiles();
  const diff = getStagedDiff();
  const analysis = analyze(stagedFiles, diff);

  // Generate
  const genOpts = { emoji: opts.emoji };
  if (opts.type) genOpts.type = opts.type;
  if (opts.scope) genOpts.scope = opts.scope;
  const result = generate(analysis, genOpts);

  // Override scope if provided
  if (opts.scope) {
    result.message = result.message.replace(
      /^(\w+)(?:\([^)]*\))?:/,
      `$1(${opts.scope}):`
    );
  }

  // Dry run — show analysis
  if (opts.dryRun) {
    process.stdout.write(`\n${c.bold('Analysis')}\n`);
    process.stdout.write(`${c.dim('─'.repeat(50))}\n`);
    process.stdout.write(`${c.yellow('Files:')}     ${analysis.totalFiles} (${c.green(`+${analysis.counts.added}`)} ${c.red(`-${analysis.counts.deleted}`)} ${c.blue(`~${analysis.counts.modified}`)} ${c.magenta(`→${analysis.counts.renamed}`)})\n`);

    for (const [cat, files] of Object.entries(analysis.filesByCategory)) {
      process.stdout.write(`${c.yellow(cat + ':')}${' '.repeat(Math.max(1, 10 - cat.length))}${files.map(f => c.dim(f.file)).join(', ')}\n`);
    }

    const addedPatterns = Object.entries(analysis.patterns.added || {});
    if (addedPatterns.length) {
      process.stdout.write(`\n${c.yellow('Detected patterns:')}\n`);
      for (const [pat, items] of addedPatterns) {
        process.stdout.write(`  ${c.green('+')} ${pat}: ${c.dim(items.slice(0, 5).join(', '))}\n`);
      }
    }

    if (analysis.details.length) {
      process.stdout.write(`\n${c.yellow('Details:')}\n`);
      for (const d of analysis.details) {
        if (d.type === 'deps-add') process.stdout.write(`  ${c.green('+')} deps: ${d.items.join(', ')}\n`);
        if (d.type === 'deps-remove') process.stdout.write(`  ${c.red('-')} deps: ${d.items.join(', ')}\n`);
        if (d.type === 'version-bump') process.stdout.write(`  ${c.blue('↑')} version bump\n`);
        if (d.type === 'scripts-change') process.stdout.write(`  ${c.magenta('⚙')} scripts changed\n`);
      }
    }

    process.stdout.write(`\n${c.dim('─'.repeat(50))}\n`);
  }

  // Output
  process.stdout.write(`\n  ${c.bold(c.green('→'))} ${c.bold(result.message)}\n\n`);

  if (opts.apply) {
    commit(result.message);
    process.stdout.write(`${c.green('✓')} Committed!\n\n`);
  } else {
    process.stdout.write(`${c.dim('To commit:')} ${c.cyan(`git commit -m "${result.message}"`)}\n`);
    process.stdout.write(`${c.dim('Or run:')}    ${c.cyan('npx ai-commit --apply')}\n\n`);
  }
}

module.exports = { run, parseArgs };
