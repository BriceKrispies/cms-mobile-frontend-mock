# CLAUDE.md

## Git workflow

- **Always push directly to `main` for this repo after changes.** Do not open feature branches or PRs unless the user explicitly asks.

## UX: stage-and-save

- Any user-editable setting in this app follows a **stage-and-save** pattern. Selections update local pending state only; nothing changes in the rest of the app until the user clicks a **Save** action. No live-apply toggles, no auto-commit-on-blur, no eager persistence.
- Applies to theme, scenario, and every future preference/form surface. When adding new controls, default to this pattern.
- Pending state lives on the view that owns it. If the user navigates away without saving, pending changes are discarded silently — do not add intrusive "unsaved changes" browser prompts.
- A "Discard" action (revert pending → applied) and a "Save" action should appear only when the view is dirty.
- Form submissions (e.g., "Give recognition") are already stage-and-save by definition — keep them that way.
