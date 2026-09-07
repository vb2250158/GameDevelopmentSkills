---
name: github-submit-workflow
description: 通用 GitHub 提交、脱敏、版本日志、提交说明、推送流程。Use when Codex needs to submit local changes to GitHub in any project, including checking diffs, protecting secrets, writing detailed changelogs, committing, pushing, and optionally preparing PR information.
---

# GitHub Submit Workflow

## Core Rule

Treat every GitHub submission as a publish operation. Before staging, reverting, merging, committing, or pushing, analyze the exact operation and create a commit approval record; then verify scope, remove sensitive data, write a useful version log, and publish only intended changes. Authorization comes from the user's request, not from loading this skill or writing a record. Continue a clearly authorized submission without asking for the same permission again.

## Git Operation Approval

For each operation group, record the exact paths and exclusions; operation class; base/local/upstream diff; owner; dependency or migration evidence; intended staged diff; rollback; and validation. Classify removals as migration cleanup, genuinely obsolete content, or accidental deletion to restore. A missing file, an unstaged deletion, a teammate saying “unused,” a same-named replacement, or a branch difference is evidence only, never a deletion decision by itself.

If migration evidence, active references, ownership, upstream merge semantics, target branch, or publish destination remain ambiguous, stop that operation group and report the concrete decision required. Otherwise proceed through staging, commit, and push without a second approval request.

## Workflow

1. Confirm repository context.
   - Run `git status --short --branch` and `git remote -v`.
   - Identify the current branch, upstream branch, and target remote.
   - If the repo is not initialized, has no remote, or the target branch is ambiguous, ask the user before publishing.

2. Inspect the full change set and form the Git operation approval.
   - Use `git diff --stat`, `git diff`, and `git diff --cached`.
   - Include untracked files in the review with `git status --short`.
   - Do not stage unrelated user changes.
   - Never revert user changes unless the user explicitly asks.

3. Perform mandatory desensitization.
   - Search changed files for secrets, private endpoints, tokens, cookies, authorization headers, access keys, private keys, passwords, phone numbers, email addresses, internal IDs, and machine-specific absolute paths.
   - Inspect config files, logs, screenshots, generated exports, `.env` files, lockfiles, and copied command output especially carefully.
   - Replace sensitive values with placeholders such as `<redacted>`, `<token>`, `<internal-host>`, or project-approved environment variable names.
   - If a real secret was already committed or may have been exposed, tell the user clearly that the credential should be rotated. Do not print the secret.

4. Update project version metadata when present.
   - Check common version sources such as `package.json`, lockfiles, manifest files, build metadata, app metadata, and existing release or changelog files.
   - If the project has an explicit version number and the submission changes shipped behavior, bump the appropriate version before committing.
   - Keep paired version files in sync, such as `package.json` and `package-lock.json`.
   - If the project has a changelog or release log, add or update an entry for the new version.
   - The version log and commit body must explicitly name the released version number.

5. Verify behavior before committing.
   - Run the smallest meaningful test, build, lint, format, or validation command available for the project.
   - If no reliable validation exists, state that explicitly in the final summary.
   - If validation fails, fix the issue before committing unless the user asks to publish a known failing state.

6. Write a detailed version log.
   - State the new version number when the project has version metadata.
   - Summarize what changed, why it changed, and which files or modules were affected.
   - Include behavior changes, configuration changes, migration notes, compatibility notes, and validation results.
   - Prefer adding or updating the project changelog when the repo already has one.
   - If there is no changelog, include the detailed version log in the commit body or PR notes.

7. Prepare a good commit message.
   - Use a concise subject that names the actual change, for example `Add GitHub publish workflow skills`.
   - Add a commit body when the change is non-trivial.
   - Include bullets for: version number when present, changed behavior, desensitization result, version log, and validation.
   - Avoid vague messages such as `update`, `fix`, or `changes`.

8. Stage, commit, and push.
   - Stage only reviewed files.
   - Re-run `git diff --cached --stat` and `git diff --cached` before committing.
   - Commit after the staged diff matches the intended scope.
   - Push to the correct remote and branch.
   - If pushing creates a new branch, set upstream explicitly with `git push -u`.

## Output

End with a compact publish report:

- branch and remote pushed
- commit hash and subject
- released version number when present
- version log summary
- desensitization result
- validation command and result
- any follow-up needed, such as opening a PR or rotating exposed credentials
