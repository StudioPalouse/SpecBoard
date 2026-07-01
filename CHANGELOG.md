# Changelog

All notable changes to Specboard are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/). See [VERSIONING.md](./VERSIONING.md)
for how and when the version is bumped.

## [0.1.5] - 2026-07-01

### Added

- App branding from the new logo kit: favicon, apple touch icon, and social
  preview (Open Graph) image, plus the icon mark in the sidebar header and on
  the sign-in and sign-up cards.
- First automated end-to-end tests: a Playwright suite covering the onboarding
  spec flow (scan and import, guided first spec, dedicated-repo nudge), run in
  CI on every pull request and now a required check on `main`.

### Changed

- Brand spelling unified to "Specboard" (previously "SpecBoard") across the UI,
  docs, and emails.
- Dependencies updated to latest compatible versions (better-auth 1.6.23,
  Tailwind 4.3.2, lucide-react 1.23, vitest 3.2, turbo 2.10, prettier 3.9).
  The vitest bump moves the transitive vite past two security advisories.

### Fixed

- Flaky end-to-end setup: signing in raced the app's own redirect to `/setup`.

## [0.1.4] - 2026-07-01

### Added

- Onboarding spec flow. Connecting a repository now registers it without
  auto-importing; an "Import your specs" panel scans connected repos read-only
  for `spec.md` files and creates cards only after you confirm, then links to the
  board.
- Guided first spec. When connected repos have no specs, the empty state walks
  you through naming a feature and picking a repo, then commits a starter
  `specs/<feature>/spec.md` (stable id and template body) and imports it so a
  real card appears. Refuses to overwrite an existing file.
- "Prefer a dedicated repo just for specs?" nudge for users without a suitable
  repo: a prefilled link to create a `specs` repo on GitHub, then install,
  connect, and seed it through the existing flow. No new GitHub App permissions.

## [0.1.3] - 2026-06-30

### Added

- CLI: `specboard --version` (also `version` / `-v`) prints the released
  version, read from the package manifest at runtime.
- `VERSIONING.md` documenting the single-version monorepo scheme and the
  per-release increment rule, plus this changelog.

### Fixed

- GitHub App install: a stray trailing space in the hand-configured "Setup URL"
  made GitHub redirect post-install to `/api/v1/github/setup%20`, a 404.
  Middleware now normalizes any trailing-whitespace variant back to the real
  route, preserving the `installation_id` / `setup_action` query, so the connect
  flow lands on the Repositories page instead of a dead end.

## [0.1.0]

- Initial baseline: spec backlog, roadmap, GitHub sync, multi-tenant org model,
  programmatic API keys, and the `specboard` CLI.
