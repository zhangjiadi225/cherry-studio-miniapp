# Cherry Mini App monorepo rules

- Treat this directory as the only Git repository. `foundation/` and every `apps/*/` directory are workspace areas inside the monorepo; do not create nested Git repositories or configure per-app remotes.
- Before editing, identify the owning workspace area and read its nearest `AGENTS.md` and README.
- Put host adapters, reusable build behavior, shared Skills, and cross-product specifications in `foundation/`.
- Put gameplay, product prompts, product UI, assets, and the app manifest in the owning `apps/<slug>/` directory.
- Apps consume shared packages through their public package entry points. Never deep-import or copy source from `foundation/` into an app.
- A shared public contract change must update the foundation package version, relevant specification, and affected app dependency ranges in the same change when applicable.
- Keep one root `pnpm-lock.yaml`. Install and run recursive workspace commands from the repository root; do not add nested lockfiles.
- Packaging is owned by `@cherry-miniapp/cli`; app-specific scripts may configure it but must not implement a parallel archive format.
- Existing sibling apps may be under active development. Never format, move, or edit another app directory unless the user puts it in scope.
