# Foundation workspace rules

- This directory owns cross-product runtime adapters, the packaging CLI, shared Skills, templates, and specifications inside the monorepo.
- A behavior belongs here only when two or more miniapps should consume the same contract or when Cherry host compatibility requires one implementation.
- Keep runtime code independent from any product theme, prompt, gameplay rule, or app identity.
- Keep CLI output deterministic and fail closed on unsafe or ambiguous package contents.
- Treat `specs/` as the human-readable contract. Update the relevant spec with a public package behavior change.
- Skills should route agents to maintained specs instead of duplicating long API manuals.
- Packages use semantic versioning. Breaking host-contract adaptations require a documented migration and an appropriate major version once the packages reach 1.0.
