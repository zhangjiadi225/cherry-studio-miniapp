import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateBuiltApp } from './package-app.mjs'

export async function createDistributionManifest(appDirectory, packageUrl, packageUrlCn, iconUrl) {
  const validated = await validateBuiltApp(appDirectory)
  const { manifest } = validated
  if (!manifest.update?.url) {
    throw new Error('Add update.url to the app manifest, rebuild, and package before publishing')
  }

  const primaryPackageUrl = new URL(packageUrl)
  if (
    primaryPackageUrl.protocol !== 'https:' ||
    primaryPackageUrl.origin !== new URL(manifest.update.url).origin
  ) {
    throw new Error('Package URL must be HTTPS and share the origin of manifest.update.url')
  }
  if (packageUrlCn) {
    if (!manifest.update.urlCn) throw new Error('The China package URL requires manifest.update.urlCn')
    const mirrorPackageUrl = new URL(packageUrlCn)
    if (
      mirrorPackageUrl.protocol !== 'https:' ||
      mirrorPackageUrl.origin !== new URL(manifest.update.urlCn).origin
    ) {
      throw new Error('China package URL must share the origin of manifest.update.urlCn')
    }
  }
  if (manifest.update.urlCn && !packageUrlCn) {
    throw new Error('manifest.update.urlCn requires a China package URL')
  }

  if (iconUrl) {
    if (!manifest.icon) throw new Error('The icon URL requires manifest.icon')
    const remoteIconUrl = new URL(iconUrl)
    const declaredOrigins = new Set(
      [manifest.update.url, manifest.update.urlCn].filter(Boolean).map((url) => new URL(url).origin)
    )
    if (remoteIconUrl.protocol !== 'https:' || !declaredOrigins.has(remoteIconUrl.origin)) {
      throw new Error('Icon URL must be HTTPS and use a declared update origin')
    }
  }

  const slug = path.basename(validated.appDirectory)
  const artifactsDirectory = path.join(validated.appDirectory, 'artifacts')
  const artifactPath = path.join(artifactsDirectory, `${slug}-${manifest.version}.miniapp`)
  const bytes = await readFile(artifactPath)
  const packageDescriptor = {
    url: packageUrl,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.byteLength
  }
  if (packageUrlCn) packageDescriptor.urlCn = packageUrlCn
  if (iconUrl) packageDescriptor.iconUrl = iconUrl

  const distributionManifest = { ...manifest, package: packageDescriptor }
  const outputPath = path.join(artifactsDirectory, `${slug}-${manifest.version}.distribution.json`)
  await writeFile(outputPath, `${JSON.stringify(distributionManifest, null, 2)}\n`)
  return outputPath
}
