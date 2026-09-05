import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [, , rawBaseUrl] = process.argv
if (!rawBaseUrl) {
  throw new Error('Usage: node foundation/scripts/configure-pages-manifests.mjs <pages-base-url>')
}

const baseUrl = new URL(rawBaseUrl)
if (baseUrl.protocol !== 'https:') {
  throw new Error('GitHub Pages base URL must use HTTPS')
}
baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/`
baseUrl.search = ''
baseUrl.hash = ''

const apps = ['model-stage', 'survivor-game']

for (const slug of apps) {
  const manifestPath = path.join('apps', slug, 'public', 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.update = {
    url: new URL(`miniapps/${slug}/manifest.json`, baseUrl).href
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`${manifest.id}: ${manifest.update.url}`)
}
