import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { lstat, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import archiver from 'archiver'
import { validateManifest } from './manifest.mjs'

const stableZipDate = new Date('1980-01-01T00:00:00.000Z')

async function sha256(filePath) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

async function listPackageFiles(directory, relativeDirectory = '') {
  const files = []
  const entries = await readdir(path.join(directory, relativeDirectory), { withFileTypes: true })
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory.split(path.sep).join('/'), entry.name)
    if (relativePath.split('/')[0] === '__cherry') {
      throw new Error('Refusing to package reserved directory: __cherry')
    }
    const absolutePath = path.join(directory, ...relativePath.split('/'))
    const stats = await lstat(absolutePath)
    if (stats.isSymbolicLink()) throw new Error(`Refusing to package symlink: ${relativePath}`)
    if (stats.isDirectory()) files.push(...(await listPackageFiles(directory, relativePath)))
    else if (stats.isFile()) files.push({ absolutePath, relativePath, size: stats.size })
    else throw new Error(`Unsupported package entry: ${relativePath}`)
  }
  return files
}

export async function validateBuiltApp(appDirectory = process.cwd()) {
  const resolvedAppDirectory = path.resolve(appDirectory)
  const distributionDirectory = path.join(resolvedAppDirectory, 'dist')
  const manifestPath = path.join(distributionDirectory, 'manifest.json')
  const manifestBytes = await readFile(manifestPath)
  if (manifestBytes.byteLength > 256 * 1024) throw new Error('manifest.json exceeds 256 KB')
  const manifest = validateManifest(JSON.parse(manifestBytes.toString('utf8')))
  const files = await listPackageFiles(distributionDirectory)

  if (files.length > 2_000) throw new Error('Package contains more than 2,000 files')
  const extractedSize = files.reduce((total, file) => total + file.size, 0)
  if (extractedSize > 100 * 1024 * 1024) throw new Error('Extracted package exceeds 100 MB')

  const entry = files.find((file) => file.relativePath === manifest.entry)
  if (!entry) throw new Error(`Manifest entry does not exist: ${manifest.entry}`)

  if (manifest.icon) {
    const icon = files.find((file) => file.relativePath === manifest.icon.path)
    if (!icon) throw new Error(`Manifest icon does not exist: ${manifest.icon.path}`)
    if (icon.size > 5 * 1024 * 1024) throw new Error('Manifest icon exceeds 5 MB')
    if ((await sha256(icon.absolutePath)) !== manifest.icon.sha256) {
      throw new Error('Manifest icon SHA-256 does not match the packaged file')
    }
  }

  return { appDirectory: resolvedAppDirectory, distributionDirectory, extractedSize, files, manifest }
}

export async function packageApp(appDirectory = process.cwd(), outputDirectory) {
  const validated = await validateBuiltApp(appDirectory)
  const slug = path.basename(validated.appDirectory)
  const artifactsDirectory = path.resolve(outputDirectory ?? path.join(validated.appDirectory, 'artifacts'))
  await mkdir(artifactsDirectory, { recursive: true })
  const artifactPath = path.join(artifactsDirectory, `${slug}-${validated.manifest.version}.miniapp`)
  const pendingArtifactPath = `${artifactPath}.partial`

  try {
    await new Promise((resolve, reject) => {
      const output = createWriteStream(pendingArtifactPath)
      const archive = archiver('zip', { zlib: { level: 9 } })
      output.on('close', resolve)
      output.on('error', reject)
      archive.on('warning', reject)
      archive.on('error', reject)
      archive.pipe(output)
      for (const file of validated.files) {
        archive.file(file.absolutePath, {
          date: stableZipDate,
          mode: 0o644,
          name: file.relativePath
        })
      }
      void archive.finalize()
    })

    const pendingStats = await lstat(pendingArtifactPath)
    if (pendingStats.size > 50 * 1024 * 1024) throw new Error("Archive exceeds Cherry's 50 MB limit")
    await rename(pendingArtifactPath, artifactPath)
  } catch (error) {
    await unlink(pendingArtifactPath).catch(() => undefined)
    throw error
  }

  const artifactStats = await lstat(artifactPath)
  const metadata = {
    schemaVersion: 1,
    appId: validated.manifest.id,
    version: validated.manifest.version,
    artifact: path.basename(artifactPath),
    sha256: await sha256(artifactPath),
    archiveBytes: artifactStats.size,
    extractedBytes: validated.extractedSize,
    fileCount: validated.files.length
  }
  const metadataPath = path.join(artifactsDirectory, `${slug}-${validated.manifest.version}.metadata.json`)
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
  return { ...metadata, artifactPath, metadataPath, manifest: validated.manifest }
}
