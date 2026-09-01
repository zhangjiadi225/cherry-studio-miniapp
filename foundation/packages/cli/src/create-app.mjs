import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateAppId } from './manifest.mjs'

const templateDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/ai-app')

export async function createApp({ slug, displayName, appId, rootDirectory }) {
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('App slug must be kebab-case')
  }

  const resolvedName =
    displayName ?? slug.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  const resolvedAppId = appId ?? `dev.yourstudio.${slug}`
  validateAppId(resolvedAppId)
  const targetDirectory = path.resolve(rootDirectory, slug)
  await mkdir(path.dirname(targetDirectory), { recursive: true })
  await cp(templateDirectory, targetDirectory, { recursive: true, errorOnExist: true, force: false })

  const replacements = new Map([
    ['__APP_SLUG__', slug],
    ['__APP_NAME__', resolvedName],
    ['__APP_ID__', resolvedAppId]
  ])

  async function replaceInDirectory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await replaceInDirectory(entryPath)
        continue
      }
      if (!/\.(?:css|html|json|md|ts)$/.test(entry.name)) continue
      let contents = await readFile(entryPath, 'utf8')
      for (const [placeholder, value] of replacements) contents = contents.replaceAll(placeholder, value)
      await writeFile(entryPath, contents)
    }
  }

  await replaceInDirectory(targetDirectory)
  return targetDirectory
}
