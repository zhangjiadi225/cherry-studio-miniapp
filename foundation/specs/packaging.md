# Packaging and distribution

## One pipeline

Every app repository owns a static `dist/` directory and invokes the published `cherry-miniapp` CLI. The CLI does not run the app's build command; build and packaging remain separate CI stages with separate failures.

```text
source + public/manifest.json
          │ app-owned build
          ▼
        dist/
          │ cherry-miniapp validate
          │ cherry-miniapp pack
          ▼
artifacts/<slug>-<version>.miniapp
artifacts/<slug>-<version>.metadata.json
```

## Validation gates

- `manifest.json` is at archive root, valid, and at most 256 KB; a `package` block is distribution-only.
- App ids, localized `releaseNotes`, permissions and exact network hostnames satisfy the current host schema; the `com.cherrystudio.*` namespace is reserved.
- The declared entry and icon exist; icon SHA-256 matches.
- No symlink, unsupported filesystem entry or top-level `__cherry` path enters the package.
- At most 2,000 files, 100 MB extracted, 50 MB archive, 5 MB icon.
- Required permissions are fixed at consent. Optional permissions appear selected by default and remain revocable.
- Files are added in sorted order with a fixed ZIP timestamp so identical inputs produce identical archives.

Metadata contains app id, version, archive name, SHA-256, archive/extracted sizes and file count. It deliberately omits a build timestamp so it remains reproducible.

## HTTPS distribution

`cherry-miniapp distribution <package-url>` reads the same built manifest and packaged bytes. It requires `manifest.update.url`, enforces HTTPS and same-origin package URLs, and writes a distribution manifest containing the exact SHA-256 and size. `update.urlCn` and the package mirror are both-or-neither. An optional `--icon` URL must use one of the declared update origins and is valid only when the packaged manifest contains a hashed icon.

Redirecting URLs are unsuitable because the Cherry installer refuses redirects.

## Batch packaging

The parent workspace discovers app repositories by `package.json`. `pack-all` packages only repositories that already contain `dist/manifest.json`, invokes the same single-app implementation, continues after independent failures, and prints a machine-readable per-repository summary. It must not upload artifacts unless explicitly authorized.
