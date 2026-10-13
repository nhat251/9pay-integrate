# Releasing 9pay-integrate

One-time setup, then 3 commands per release.

## One-time setup: trusted publishing (OIDC, no tokens)

CI publishes via npm trusted publishing — no long-lived tokens, nothing
to expire. (2FA-bypass granular tokens no longer publish directly since
npm restricted them; do not use `NPM_TOKEN` anymore. If the secret still
exists in repo settings, delete it.)

1. Go to https://www.npmjs.com/package/9pay-integrate → Settings (or
   Access → Trusted Publishers).
2. Add a GitHub Actions trusted publisher:
   - Organization/User: `nhat251`
   - Repository: `9pay-integrate`
   - Workflow file name: `publish.yml`
   - Environment: leave empty (or match the workflow's `environment:`
     if one is ever added — keep them in sync).
3. Verify: push the next `v*` tag and watch the `publish` job turn
   green with `+ 9pay-integrate@x.y.z`, then `npm view 9pay-integrate versions`.

The workflow (`.github/workflows/publish.yml`) already carries what OIDC
needs: `permissions.id-token: write`, `registry-url` on setup-node, and
`npm publish --provenance`. No `NODE_AUTH_TOKEN` anywhere.

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
| `ENEEDAUTH` / need auth | Leftover token auth or missing OIDC trust | Ensure no `NODE_AUTH_TOKEN` in workflow; redo trusted-publisher setup above |
| Tag-not-on-main error | Tag created from `dev` or another branch | Delete the tag locally + remotely, redo from `main` |
| Tag/version mismatch | Forgot `npm version` before tagging | Delete the tag, run `npm version`, push again |
| Version invisible after green publish | Staged by a legacy 2FA-bypass token, awaiting approval | Approve the staged version on npmjs.com (with 2FA), then move to trusted publishing |
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
