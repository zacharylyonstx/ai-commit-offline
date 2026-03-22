# ai-commit-offline

**AI-quality commit messages. No API key. No cost. No internet.**

[![npm version](https://img.shields.io/npm/v/ai-commit-offline.svg)](https://www.npmjs.com/package/ai-commit-offline)
[![license](https://img.shields.io/npm/l/ai-commit-offline.svg)](https://github.com/zacharylyonstx/ai-commit-offline/blob/main/LICENSE)

> Every "AI commit" tool requires an API key, costs money, and needs internet. This one doesn't.  
> Smart pattern analysis generates conventional commit messages — completely offline.

## Why?

There are dozens of AI commit message tools. They all:

- ❌ Require an OpenAI/Anthropic API key
- ❌ Cost money per commit
- ❌ Need internet access
- ❌ Send your code to third-party servers
- ❌ Fail when you're on a plane, in a tunnel, or offline

**ai-commit-offline** uses smart heuristics and pattern matching to generate commit messages that are genuinely good — not generic "update files" garbage. Zero dependencies on external services. Works everywhere, always.

## Install

```bash
# Use directly (no install needed)
npx ai-commit-offline

# Or install globally
npm i -g ai-commit-offline
```

## Usage

```bash
# Stage your changes first
git add .

# Generate a commit message
npx ai-commit

# Generate and commit in one step
npx ai-commit --apply

# Add gitmoji
npx ai-commit --emoji
# → feat(auth): ✨ add login handler

# Force a specific type
npx ai-commit --type fix

# Override scope
npx ai-commit --scope api

# See what it detected
npx ai-commit --dry-run
```

## What It Detects

The analyzer examines your staged diff and classifies changes:

| Change | Detected As | Example Output |
|--------|-------------|----------------|
| New files with functions | `feat` | `feat(auth): add handleLogin function` |
| New React components | `feat` | `feat(components): add UserProfile component` |
| New test files | `test` | `test(auth): add login tests` |
| Modified test files | `test` | `test(utils): update parser tests` |
| README/docs changes | `docs` | `docs: update README.md` |
| CSS/SCSS changes | `style` | `style(theme): update theme styles` |
| Config file changes | `chore` | `chore: update eslint configuration` |
| Deleted files | `refactor` | `refactor: remove 3 files` |
| Renamed files | `refactor` | `refactor: rename oldName to newName` |
| Added dependencies | `chore` | `chore(deps): add express, lodash dependencies` |
| Removed dependencies | `chore` | `chore(deps): remove old-lib dependency` |
| CI/workflow files | `ci` | `ci: add CI configuration` |
| Error handling added | `fix` | `fix(api): add error handling` |
| New hooks | `feat` | `feat: add useAuth hook` |
| New routes | `feat` | `feat(api): add POST/GET route handlers` |
| New classes | `feat` | `feat: add UserService class` |
| Auth changes | `feat`/`fix` | `feat: add authentication` |
| Database operations | `feat`/`fix` | `feat: add database operations` |

### Smart Analysis

It doesn't just look at filenames — it reads the actual diff:

- **Function detection** — finds new/modified function names
- **Import analysis** — tracks new dependencies being used
- **Component detection** — identifies React/Vue components
- **Hook detection** — recognizes custom React hooks (`use*`)
- **Route detection** — spots Express/Koa route handlers
- **Error handling** — detects try/catch, `.catch()`, throw
- **State management** — finds useState, Redux, Zustand patterns
- **DB operations** — recognizes Prisma, Mongoose, raw SQL patterns
- **Auth patterns** — login, logout, JWT, session handling

## How It Works

1. Reads `git diff --cached` (staged changes only)
2. Classifies each file by type (test, docs, config, style, CI, deps, code)
3. Parses the diff to find added/removed patterns (functions, classes, imports, etc.)
4. Determines the best conventional commit type
5. Detects scope from file paths
6. Generates a specific, descriptive subject line

No AI model. No API. No network. Just well-tuned heuristics running on your machine.

## Conventional Commits

All messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description
```

Supported types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`

## Gitmoji Support

Use `--emoji` to add [gitmoji](https://gitmoji.dev/):

```
feat: ✨ add user authentication
fix: 🐛 add error handling
docs: 📝 update README.md
test: ✅ add login tests
refactor: ♻️ refactor function implementation
chore: 🔧 update configuration
perf: ⚡ optimize loop
ci: 👷 update CI configuration
```

## Configuration

No config files needed. Everything works via CLI flags.

Respects `NO_COLOR` environment variable for CI/piped output.

## Limitations

This tool uses heuristics, not a language model. It's surprisingly good for ~90% of commits, but it won't:

- Write paragraph-length commit bodies (keeps it to conventional subject lines)
- Understand business logic ("fix the login bug where OAuth tokens expire early")
- Generate breaking change descriptions

For those cases, write the message yourself. For everything else, let the machine do it.

## License

[MIT](LICENSE) © [Zachary Lyons](https://github.com/zacharylyonstx)

---

**If this saves you time, [sponsor the project](https://github.com/sponsors/zacharylyonstx) ⚡**
