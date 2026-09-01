#!/usr/bin/env node

import { access, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createApp } from './create-app.mjs'
import { createDistributionManifest } from './distribution.mjs'
import { packageApp, validateBuiltApp } from './package-app.mjs'

const [command, ...args] = process.argv.slice(2)

function option(name) {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function positionalArguments() {
  const values = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index]?.startsWith('--')) {
      index += 1
      continue
    }
    values.push(args[index])
  }
  return values
}

async function discoverApps(rootDirectory) {
  const resolvedRoot = path.resolve(rootDirectory)
  const entries = await readdir(resolvedRoot, { withFileTypes: true })
  const apps = []
  for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
    const appDirectory = path.join(resolvedRoot, entry.name)
    try {
      await access(path.join(appDirectory, 'package.json'))
      apps.push(appDirectory)
    } catch {}
  }
  return apps.sort((left, right) => left.localeCompare(right))
}

switch (command) {
  case 'create': {
    const [slug, displayName, appId] = positionalArguments()
    const target = await createApp({
      slug,
      displayName,
      appId,
      rootDirectory: option('--root') ?? path.resolve(process.cwd(), 'apps')
    })
    console.log(`Created ${path.relative(process.cwd(), target)}`)
    break
  }
  case 'validate': {
    const appDirectory = option('--app') ?? process.cwd()
    const result = await validateBuiltApp(appDirectory)
    console.log(
      `${result.manifest.id}@${result.manifest.version}: ${result.files.length} files, ${result.extractedSize} bytes`
    )
    break
  }
  case 'pack': {
    const appDirectory = option('--app') ?? process.cwd()
    const result = await packageApp(appDirectory, option('--out'))
    console.log(`${result.artifactPath}  ${result.archiveBytes} bytes  sha256:${result.sha256}`)
    break
  }
  case 'distribution': {
    const [packageUrl] = positionalArguments()
    if (!packageUrl) {
      throw new Error('Usage: cherry-miniapp distribution <package-url> [--cn <url>] [--icon <url>]')
    }
    const outputPath = await createDistributionManifest(
      option('--app') ?? process.cwd(),
      packageUrl,
      option('--cn'),
      option('--icon')
    )
    console.log(`Created ${outputPath}`)
    break
  }
  case 'repos': {
    const rootDirectory = args[0] ?? 'apps'
    for (const appDirectory of await discoverApps(rootDirectory)) {
      console.log(path.relative(process.cwd(), appDirectory))
    }
    break
  }
  case 'pack-all': {
    const rootDirectory = args[0] ?? 'apps'
    const summary = []
    for (const appDirectory of await discoverApps(rootDirectory)) {
      try {
        await access(path.join(appDirectory, 'dist', 'manifest.json'))
      } catch {
        summary.push({
          app: path.basename(appDirectory),
          status: 'skipped',
          reason: 'dist/manifest.json missing'
        })
        continue
      }
      try {
        const result = await packageApp(appDirectory)
        summary.push({
          app: path.basename(appDirectory),
          status: 'packed',
          artifact: result.artifactPath,
          sha256: result.sha256
        })
      } catch (error) {
        summary.push({
          app: path.basename(appDirectory),
          status: 'failed',
          reason: error instanceof Error ? error.message : String(error)
        })
        process.exitCode = 1
      }
    }
    console.log(JSON.stringify(summary, null, 2))
    break
  }
  default:
    throw new Error('Usage: cherry-miniapp <create|validate|pack|distribution|repos|pack-all>')
}
