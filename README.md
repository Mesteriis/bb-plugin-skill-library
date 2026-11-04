# Skill Library

Browse, edit, create, and install agent skills without leaving bb.

Installed skills are checked out across several folders, and the built-in
Skills page browses them but does not edit them. Skill Library opens every
skill bb discovers as an editable markdown document in one place, so you can
check a skill out, adapt it to your codebase, and save.

## Features

- **Library** — every discovered skill (provider, plugin, built-in, and user
  scopes) in a filterable sidebar list; non-manageable skills open read-only.
- **Editor** — `SKILL.md` editing with revision-based conflict detection, a
  rendered preview, file chips, and Cmd/Ctrl+S to save.
- **Create** — new skills are written under `~/.bb/skills/<name>/SKILL.md`
  with frontmatter.
- **Registry** — search the [skills.sh](https://skills.sh) catalog and install
  entries into your user skills.
- **CLI** — `bb skill-library list [--json]` and
  `bb skill-library create <name> --description <text> [--json]`.

Publishing a skill to skills.sh has no API: put the skill folder in a GitHub
repository that skills.sh indexes, then install it. Use **Copy path** in the
editor header to find the folder.

## Install

From the bb UI (Plugins → search "Skill Library") or:

```
bb plugin install git:https://github.com/Ayan-M-Dev/bb-plugin-skill-library.git
```

`dist/` is committed, so no build step or npm install is needed on install.

## Development

```
npm install
bb plugin build
bb plugin install .
bb plugin reload skill-library   # or: bb plugin dev
```

Run the create-helper unit test with `node lib/create-skill.test.ts`.
