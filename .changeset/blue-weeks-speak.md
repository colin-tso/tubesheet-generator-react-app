---
"tubesheet-generator-react-app": patch
---

Upgrade `changesets/action` from v1 to v2 in the dev release workflow. Updates the deprecated `commit`/`title` inputs to `commit-message`/`pr-title`, and moves the org PAT from the `GITHUB_TOKEN` env var to the `github-token` input, both required by v2.