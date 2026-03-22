# Publish Checklist — ai-commit-offline

## Pre-publish

- [x] All 53 tests passing (`node test/run.js`)
- [x] CLI works: `node bin/cli.js --help`, `--version`, `--dry-run`, `--emoji`
- [x] `npm pack` succeeds (11.3 kB, 9 files)
- [x] Zero dependencies
- [x] MIT License
- [x] `.github/FUNDING.yml` → zacharylyonstx
- [x] `funding` field in package.json
- [x] README with clear value prop

## Create GitHub Repo

```bash
cd /Users/zak/.openclaw/workspace/ai-commit-cli

# Create the repo
gh repo create zacharylyonstx/ai-commit-offline --public --description "AI-quality git commit messages. No API key. No cost. No internet." --source . --push

# Or if repo already exists:
git remote add origin https://github.com/zacharylyonstx/ai-commit-offline.git
git branch -M main
git push -u origin main
```

## Publish to npm

```bash
# Login (if not already)
npm login

# Publish
npm publish

# Verify
npm info ai-commit-offline
npx ai-commit-offline --help
```

## Post-publish

1. **Test npx:**
   ```bash
   cd /tmp && mkdir test-repo && cd test-repo && git init
   echo "hello" > test.js && git add .
   npx ai-commit-offline
   npx ai-commit-offline --emoji
   npx ai-commit-offline --dry-run
   ```

2. **Add GitHub topics:** `git`, `commit`, `ai`, `conventional-commits`, `cli`, `developer-tools`, `offline`

3. **Social posts:**
   - "Built a commit message generator that works 100% offline. No API key. No cost. Just smart pattern matching."
   - Link: `https://github.com/zacharylyonstx/ai-commit-offline`

## Package name

- **npm name:** `ai-commit-offline`
- **Binary names:** `ai-commit` and `ai-commit-offline` (both work)
- Users run: `npx ai-commit-offline` or install globally and use `ai-commit`
