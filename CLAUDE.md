# CLAUDE.md

## Git workflow

- **Always push directly to `main` for this repo after changes.** Do not open feature branches or PRs unless the user explicitly asks.

## UX: stage-and-save

- Any user-editable setting in this app follows a **stage-and-save** pattern. Selections update local pending state only; nothing changes in the rest of the app until the user clicks a **Save** action. No live-apply toggles, no auto-commit-on-blur, no eager persistence.
- Applies to theme, scenario, and every future preference/form surface. When adding new controls, default to this pattern.
- Pending state lives on the view that owns it. If the user navigates away without saving, pending changes are discarded silently — do not add intrusive "unsaved changes" browser prompts.
- A "Discard" action (revert pending → applied) and a "Save" action should appear only when the view is dirty.
- Form submissions (e.g., "Give recognition") are already stage-and-save by definition — keep them that way.

## Architecture at a glance

Static HTML + vanilla Web Components, no build step. Entry point `index.html` loads `main.js`, which boots the app shell and registers features. Everything else is ES modules.

- **Router** (`src/app/router.js`) — hash-based, `:param` segments, longest-match wins. Features register routes via `src/app/registry.js`.
- **Event bus** (`src/utils/events.js`) — `appBus.on/emit`. This is the primary decoupler between features: mutations emit an event, interested views re-render. See the event list below.
- **Mock API** (`src/mock-data/api/mockApi.js`) — the single entry point for all CRUD. Everything else goes through it; do not read engines or storage directly from feature code.
- **Primitives** (`src/primitives/`) — shadow-DOM Web Components (buttons, inputs, cards, table, modal, drawer, tabs, grid, stack, badge). Kept dumb — they render what they're given.
- **Composites** (`src/composites/`) — feature-level components layered on primitives (see table below).

## Features (routes)

| Route | What the user does |
|---|---|
| `/` · `/dashboard` · `/reporting` | View metrics and participation trend |
| `/people` | Browse the employee directory (schema-driven columns) |
| `/schema`, `/schema/new`, `/schema/:id` | Declare / edit user fields |
| `/groups`, `/groups/new`, `/groups/:id` | Build reusable audience definitions with a rule editor |
| `/campaigns`, `/campaigns/new`, `/campaigns/:id` | Define recognition campaigns targeting a group or ad-hoc audience |
| `/approvals` | Review the pending-recognition queue |
| `/recognitions`, `/recognitions/new` | Browse the feed; give a recognition |
| `/rewards` | Browse the reward catalog |
| `/settings` | Change theme, active mock scenario, and simulated API latency/failure rate |

## Data model

All entities flow through `mockApi`. Most live in-memory (hydrated from scenario fixtures); user-created state is mirrored to `localStorage`.

- **Schema fields** (`src/schema/`) — `{ id, label, type: 'string'|'number'|'date'|'timestamp', enumValues?, min?, max?, source: 'seed'|'custom' }`. Id and type are immutable after create. Persisted: `localStorage:cms:schema`.
- **People / users** — `{ id, name, email, team, title, department, location, hiredAt, … }`. Fields are schema-driven; reads go through `schema.validateUser()` so orphaned keys from deleted fields drop out.
- **Groups** (`src/groups/`) — `{ id, name, description, definition, source }`. `definition` is a recursive AST of AND/OR/ALL/NONE nodes whose leaves reference schema fields or other groups. Validation catches circular refs and missing field refs. Persisted: `localStorage:cms:groups`.
- **Campaigns** — `{ id, name, status, startsAt, endsAt, audienceGroupId? | audienceDefinition?, … }`. Reads are enriched with resolved membership. Persisted: `localStorage:cms:campaigns`.
- **Recognitions** — `{ id, fromId, toId, message, values[], points, status, createdAt }`. Enriched with full user objects on read.
- **Approvals** — derived view over recognitions with `status: 'pending'`.
- **Rewards**, **Values**, **Metrics**, **Participation trend** — read-only fixtures.

**Scenarios** (`src/mock-data/scenarios/`) — named fixture sets (default / empty / heavy). `mockApi.setScenario(id)` hot-swaps in-memory data and emits `mock:scenario-changed`. Persisted: `localStorage:cms:scenario`.

## Cross-feature interactions

The app is a small graph of features that observe each other via `appBus`. The important edges:

- **Schema → People** — the People page opts into columns by field id (`COLUMN_IDS` in `src/features/people/routes.js`). Labels, formatters, and the sort/filter types (text / enum / number / date) are all derived from the field's schema entry. Adding a field in `/schema` auto-surfaces it if listed.
- **Schema → Groups** — group rules reference schema fields. Deleting a referenced field leaves the group valid-shaped but surfaces a "field missing" validation error until edited.
- **Groups → Campaigns** — campaigns reference a group by id or embed an ad-hoc definition. A deleted group renders as "Missing group" in the campaign; a changed group updates resolved membership.
- **Groups → Groups** — group definitions can reference other groups. The engine resolves recursively and detects cycles.
- **Scenario → everything** — swapping scenarios re-hydrates the in-memory store. Every list view listening to `mock:scenario-changed` re-renders with the new dataset.

### appBus events

Emitters and the views that listen:

| Event | Emitted by | Listeners |
|---|---|---|
| `schema:change` | `src/schema/schema.js` (CRUD, reset) | Schema list + edit, Groups list + edit, People (indirectly via re-fetch) |
| `groups:change` | `src/groups/groups.js` (CRUD, reset) | Groups list + edit, Campaigns list + detail, Group summary/picker |
| `campaigns:change` | `mockApi` (create) | Campaigns list |
| `theme:change` | `src/theme/theme.js` | Appearance card (other cards re-render to reflect applied state) |
| `mock:scenario-changed` | `mockApi.setScenario` | Every list view; Group summary/picker |
| `route:change` | `src/app/router.js` | App chrome |
| `nav:updated` | `src/app/registry.js` | Nav |

When a feature mutates shared state, emit; when a feature displays shared state, subscribe in `mount` and unsubscribe via the `signal` `abort` event.

## Composites worth knowing about

| Component | Purpose |
|---|---|
| `<data-table-shell>` | Wraps `<ui-table>` with a title + count header, responsive card layout (<48rem), row-click dispatch, and a **content-aware sort + filter** controls bar. Columns opt in via hints: `sortable`, `type: 'text'|'number'|'date'` (drives the comparator), `filter: 'text'|'enum'`, and `sortValue`/`filterValue` accessors for derived columns. The primitive `<ui-table>` stays dumb; the shell computes `rows → filter → sort → view` and hands the view to both the table and the card layout. |
| `<filter-bar>` | Top-level search input + chip tabs. Used for page-wide primary filtering (e.g., People search + team chips). Runs *before* rows reach `<data-table-shell>`; per-column filters compose on top. |
| `<group-builder>` | Recursive rule editor for group definitions. Emits `change` with the definition AST on every mutation; validates in real time. |
| `<group-picker>` | Modal that switches between "pick existing group" and "build ad-hoc"; used in the Campaign editor. |
| `<group-summary>` | Read-only badge with name + resolved member count + errors. Self-subscribes to `groups:change` / `schema:change` / `mock:scenario-changed`. |
| `<recognition-card>`, `<metric-card>`, `<page-header>` | Self-explanatory presentational pieces. |

When adding a new table, reach for `<data-table-shell>` and add the column hints rather than building parallel sort/filter UI.

## Settings (stage-and-save)

All settings cards in `/settings` follow the stage-and-save pattern from the top of this doc — pending state, dirty tracking, Save + Discard only appear when dirty.

- **Theme** (`src/theme/`) — axes (color mode, contrast, font scale, …) declared in `src/theme/axes.js`; applied as `data-theme-*` attributes + custom properties on `<html>`. Stored at `localStorage:cms:theme`. Emits `theme:change`.
- **Mock scenario** — dropdown of scenario ids. Applied via `mockApi.setScenario()`; emits `mock:scenario-changed`.
- **API simulation** — latency (ms) and failure rate (0–1) applied to every `mockApi` call.
