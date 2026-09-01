# Repository model

## Goal

Keep Cherry miniapps and their shared host-compatible foundation in one Git repository so cross-cutting changes are atomic, while preserving clear ownership and independent product releases.

## Monorepo layout

```text
cherry-studio-miniapp              one Git repository
  foundation
    packages/runtime               published @cherry-miniapp/kit
    packages/cli                   published @cherry-miniapp/cli
    skills/cherry-miniapp-development
    specs
  apps
    <slug>                         one workspace package per product
  examples
    <slug>                         runnable capability example, not a released product
```

The repository root owns the pnpm workspace and the only committed `pnpm-lock.yaml`. `foundation/`, `apps/*/`, and `examples/*/` are ownership boundaries inside the repository, not nested repositories. They must not contain `.git` directories or independent remotes. Only `apps/*/` entries are registered products and participate in batch app builds and packaging; `examples/*/` entries remain runnable references.

## Ownership test

Ask: “Would another miniapp need this for the same reason?”

- Yes, because Cherry exposes the same host contract: runtime package.
- Yes, because every package must be safe and reproducible: CLI package.
- Yes, because agents need the same decision rule: Skill or spec.
- No, because it expresses one product's loop, prompt, brand, asset, or manifest: owning app directory.

Apps consume foundation behavior only through public package entry points. Never use a deep relative import from `apps/*` into `foundation/*`, and never copy patched shared source into an app.

## Dependency and change model

- Compatible foundation packages resolve locally through the root pnpm workspace.
- The root lockfile is the dependency truth for local development and CI; nested lockfiles are not committed.
- A public foundation contract change updates its specification, package version, migration notes when needed, and affected app dependency ranges in the same branch.
- Publishing foundation packages remains a separate explicit action. A monorepo commit does not implicitly publish packages or apps.
- External local links are development-only bridges and must not become undeclared release dependencies.

## Release independence

- Each app controls its own version, changelog, build, artifact, and distribution URL even though code is stored together.
- Foundation packages version and publish according to their own public contracts.
- A batch release is an orchestrated set of app releases, not one atomic product version.
- A failure in one app must not invalidate artifacts already produced for another; the batch summary records each result.
