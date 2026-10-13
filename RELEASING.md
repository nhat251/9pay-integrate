# Releasing 9pay-integrate

One-time setup, then 3 commands per release.

## One-time setup: `NPM_TOKEN` secret

Publishing fails with `ENEEDAUTH` without this. Do it once:

1. Create an npm access token:
   - Go to https://www.npmjs.com → avatar → Access Tokens → Generate New Token.
   - Use a **Granular Access Token**: read + write scoped to the
     `9pay-integrate` package, no expiry (or set a reminder to rotate).
     (A classic **Automation** token also works.)
2. Add it to GitHub:
   - Repo page → Settings → Secrets and variables → Actions →
     New repository secret.
   - Name: `NPM_TOKEN`, value: paste the token starting with `npm_...`.
3. Verify: push any `v*` tag later and watch the `publish` job turn green.
   If it fails with `ENEEDAUTH`, the secret is missing, expired, or lacks
   publish permission on this package.

## Release checklist

Branching: code on `dev`, merge `dev` into `main`, then version + tag
**on `main`**. CI publishes to npm only for tags created from `main`.

```bash
# 0. Make sure CI is green on the PR dev -> main, then merge it
gh pr checks 1

# 1. On main, up to date
git checkout main
git pull origin main

# 2. Bump version (creates a commit + a v* tag locally)
#    patch = bug fixes          -> 2.0.1
#    minor = new features       -> 2.1.0
#    major = breaking changes   -> 3.0.0
npm version <patch|minor|major> -m "release: v%s"

# 3. Push commit + tag (the tag triggers the publish workflow)
git push origin main --follow-tags
```

## What CI does on a tag push

Job `publish` (`.github/workflows/publish.yml`):

1. Verifies the tag commit is an ancestor of `origin/main` —
   tags created outside `main` are rejected.
2. Verifies the tag matches `package.json` version —
   e.g. tag `v2.1.0` with version `2.0.0` fails.
3. Re-runs `typecheck` + `test` + `build`.
4. Runs `npm publish --provenance --access public` with `NPM_TOKEN`.

## If publish fails

| Symptom | Cause | Fix |
|---|---|---|
| `ENEEDAUTH` / need auth | `NPM_TOKEN` missing, expired, or without publish scope | Redo one-time setup above, then re-run failed jobs |
| Tag-not-on-main error | Tag created from `dev` or another branch | Delete the tag locally + remotely, redo from `main` |
| Tag/version mismatch | Forgot `npm version` before tagging | Delete the tag, run `npm version`, push again |
| Anything else red | typecheck/test/build broke after merge | Fix on `dev`, merge, then version + tag again (patch) |

Re-running a failed tag workflow is safe: re-run with
`gh run rerun <run-id>` or Actions UI → Re-run failed jobs.
Nothing is published until the `Publish to npm` step succeeds,
and npm rejects republishing an already-published version.

## Deleting a bad tag (before a successful publish)

```bash
git tag -d v2.0.0
git push origin :refs/tags/v2.0.0
```
