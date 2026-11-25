import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')
const SKIPPED = new Set(['gen', 'target', 'node_modules', 'dist', '.build', '.tauri'])
const SOURCES: [string, string[]][] = [
  ['src', ['.svelte', '.ts']],
  ['crates/core/src', ['.rs']],
  ['src-tauri/src', ['.rs']],
  ['src-tauri/plugins', ['.rs', '.swift', '.kt']],
  ['site', ['.html']],
]
const SINGLE_FILES = [
  'src-tauri/gen/apple/project.yml',
  'src-tauri/gen/apple/cornercase-mobile_iOS/Info.plist',
  'src-tauri/gen/apple/LaunchScreen.storyboard',
  'src-tauri/gen/android/app/src/main/res/values/strings.xml',
  'src-tauri/gen/android/app/src/main/java/dev/usecornercase/mobile/MainActivity.kt',
  'src-tauri/tauri.conf.json',
  'index.html',
  'README.md',
  'PRIVACY.md',
  'CHANGELOG.md',
  'SUPPORT.md',
]
const NOT_SHOWN = new Set(['src/lib/bindings.ts'])

function macsIn(text: string) {
  return text.split('\n').flatMap((line, index) => (/\bMacs?\b/.test(line) ? [index + 1] : []))
}

function filesUnder(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true })
    .filter((entry) => !SKIPPED.has(entry.name))
    .flatMap((entry) => (entry.isDirectory() ? filesUnder(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]))
}

function isTest(path: string) {
  return path.endsWith('.test.ts') || path.endsWith('/tests.rs') || path.includes('/tests/')
}

function scannedFiles() {
  const sources = SOURCES.flatMap(([dir, extensions]) =>
    filesUnder(dir).filter((path) => extensions.includes(extname(path))),
  )
  return [...sources.filter((path) => !isTest(path) && !NOT_SHOWN.has(path)), ...SINGLE_FILES].sort()
}

describe('macsIn', () => {
  it.each(['Is the Mac on?', "The Mac's window", 'Two Macs', 'Mac'])('finds "Mac" in %j', (text) => {
    expect(macsIn(text)).toEqual([1])
  })

  it.each(['macOS', 'Linux or macOS', 'a machine', 'machines', 'MacBook', 'mac.local', 'iMac', 'MACS'])(
    'finds nothing in %j',
    (text) => {
      expect(macsIn(text)).toEqual([])
    },
  )

  it('gives the number of each line that says it', () => {
    expect(macsIn('one\nthe Mac\nthree\nMacs and a Mac\n')).toEqual([2, 4])
  })
})

describe('the words the app shows', () => {
  const files = scannedFiles()

  it('include the screens, the core, the plugins and the texts of each platform', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'src/routes/NoMachines.svelte',
        'crates/core/src/error.rs',
        'src-tauri/src/lib.rs',
        'src-tauri/plugins/secrets/src/lib.rs',
        'src-tauri/gen/apple/project.yml',
        'site/index.html',
        'site/partials/nav.html',
      ]),
    )
    expect(files.filter((path) => isTest(path) || NOT_SHOWN.has(path))).toEqual([])
  })

  it('say "machine" or "computer", never "Mac" (design/look.md › Words)', () => {
    const found = files.flatMap((path) => {
      const text = readFileSync(join(root, path), 'utf8')
      const lines = text.split('\n')
      return macsIn(text).map((line) => `${path}:${line}: ${lines[line - 1].trim()}`)
    })
    expect(found).toEqual([])
  })
})
