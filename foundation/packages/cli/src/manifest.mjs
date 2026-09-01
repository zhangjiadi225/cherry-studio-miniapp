import { isIP } from 'node:net'
import path from 'node:path'
import semver from 'semver'

const appIdPattern = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])(?:\.(?:[a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9]))*$/
const hostnamePattern = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/
const numericHostnameSuffix = /(^|\.)(?:\d+|0x[0-9a-f]*)$/
const windowsDevice = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/
const officialAppIdPrefix = 'com.cherrystudio.'
const permissionLeaves = new Set([
  'ai.chat',
  'storage.get',
  'storage.set',
  'storage.delete',
  'storage.keys',
  'file.save',
  'file.load',
  'file.list',
  'file.delete',
  'file.export',
  'notification.show',
  'clipboard.read',
  'clipboard.write',
  'network.fetch'
])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function validateLocalizedText(value, field, maximumLength) {
  if (typeof value === 'string') {
    assert(
      value.length > 0 && value.length <= maximumLength,
      `${field} must be 1-${maximumLength} characters`
    )
    return
  }

  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    `${field} must be a string or locale map`
  )
  const entries = Object.entries(value)
  assert(entries.length > 0 && entries.length <= 20, `${field} must contain 1-20 locales`)
  assert('en' in value || 'zh' in value, `${field} must contain en or zh`)
  for (const [locale, text] of entries) {
    assert(locale.length > 0, `${field} has an empty locale`)
    assert(
      typeof text === 'string' && text.length > 0 && text.length <= maximumLength,
      `${field}.${locale} is invalid`
    )
  }
}

function validatePackagePath(value, field) {
  assert(typeof value === 'string' && value.length > 0, `${field} must be a package-relative path`)
  assert(
    !value.includes('\\') && !value.startsWith('/') && !value.split('/').includes('..'),
    `${field} is unsafe`
  )
  assert(path.posix.normalize(value) === value, `${field} must be a normalized POSIX path`)
  assert(value.split('/')[0] !== '__cherry', `${field} uses the reserved __cherry directory`)
}

function expandPermissions(values, field) {
  assert(Array.isArray(values), `${field} must be an array`)
  assert(values.length <= 32, `${field} may contain at most 32 entries`)
  assert(new Set(values).size === values.length, `${field} contains duplicates`)

  const expanded = new Set()
  for (const permission of values) {
    assert(typeof permission === 'string', `${field} contains a non-string permission`)
    if (permission.endsWith('.*')) {
      const prefix = permission.slice(0, -1)
      const matches = [...permissionLeaves].filter((leaf) => leaf.startsWith(prefix))
      assert(matches.length > 0, `${field} contains unknown wildcard ${permission}`)
      for (const match of matches) expanded.add(match)
    } else {
      assert(permissionLeaves.has(permission), `${field} contains unknown permission ${permission}`)
      expanded.add(permission)
    }
  }
  return expanded
}

export function validateAppId(appId) {
  assert(
    typeof appId === 'string' && appId.length <= 120 && appIdPattern.test(appId),
    'manifest.id is invalid'
  )
  assert(!windowsDevice.test(appId.split('.')[0] ?? ''), 'manifest.id starts with a Windows device name')
  assert(!appId.startsWith(officialAppIdPrefix), `manifest.id uses reserved prefix ${officialAppIdPrefix}`)
}

export function validateManifest(manifest) {
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'manifest must be an object')
  validateAppId(manifest.id)
  validateLocalizedText(manifest.name, 'manifest.name', 64)
  validateLocalizedText(manifest.description, 'manifest.description', 200)
  if (manifest.releaseNotes !== undefined) {
    validateLocalizedText(manifest.releaseNotes, 'manifest.releaseNotes', 500)
  }
  assert(
    typeof manifest.version === 'string' && manifest.version.length <= 32 && semver.valid(manifest.version),
    'manifest.version must be semver'
  )
  validatePackagePath(manifest.entry, 'manifest.entry')

  const required = expandPermissions(manifest.permissions ?? [], 'manifest.permissions')
  const optional = expandPermissions(manifest.optionalPermissions ?? [], 'manifest.optionalPermissions')
  for (const permission of required) {
    assert(!optional.has(permission), `${permission} cannot be both required and optional`)
  }

  const network = manifest.network ?? []
  assert(Array.isArray(network) && network.length <= 20, 'manifest.network may contain at most 20 hosts')
  assert(new Set(network).size === network.length, 'manifest.network contains duplicates')
  for (const host of network) {
    assert(
      typeof host === 'string' &&
        hostnamePattern.test(host) &&
        !numericHostnameSuffix.test(host) &&
        isIP(host) === 0,
      `invalid network host ${host}`
    )
  }
  const hasNetworkPermission = required.has('network.fetch') || optional.has('network.fetch')
  assert(network.length === 0 || hasNetworkPermission, 'network hosts require network.fetch permission')
  assert(!hasNetworkPermission || network.length > 0, 'network.fetch permission requires at least one host')

  if (manifest.icon !== undefined) {
    assert(manifest.icon && typeof manifest.icon === 'object', 'manifest.icon must be an object')
    validatePackagePath(manifest.icon.path, 'manifest.icon.path')
    assert(/^[a-f0-9]{64}$/.test(manifest.icon.sha256), 'manifest.icon.sha256 must be lowercase SHA-256')
  }

  if (manifest.update !== undefined) {
    assert(manifest.update && typeof manifest.update === 'object', 'manifest.update must be an object')
    assert(manifest.update.url !== undefined, 'manifest.update.url is required')
    for (const field of ['url', 'urlCn']) {
      if (manifest.update[field] === undefined) continue
      const url = new URL(manifest.update[field])
      assert(url.protocol === 'https:', `manifest.update.${field} must use https`)
    }
  }

  assert(manifest.package === undefined, 'manifest.package belongs only in a distribution manifest')

  return manifest
}
