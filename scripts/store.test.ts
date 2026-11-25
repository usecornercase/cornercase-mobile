import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')
const store = join(root, 'store/app-store')
const screenshots = join(store, 'screenshots')
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

type FileRef = { $file: string }
type PngHeader = { width: number; height: number; colorType: number; chunks: string[] }
type Sized = [number, number]

const IPHONE_69: Sized[] = [[1320, 2868]]
const IPAD_13: Sized[] = [
  [2752, 2064],
  [2064, 2752],
]

function isFileRef(value: unknown): value is FileRef {
  return typeof value === 'object' && value !== null && typeof (value as FileRef).$file === 'string'
}

function fileRefs(value: unknown): string[] {
  if (isFileRef(value)) return [value.$file]
  if (typeof value !== 'object' || value === null) return []
  return Object.values(value).flatMap(fileRefs)
}

function characters(text: string) {
  return [...text].length
}

function bytes(text: string) {
  return Buffer.byteLength(text, 'utf8')
}

function words(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function keywordProblems(keywords: string, indexed: string) {
  const indexedWords = words(indexed)
  const problems = bytes(keywords) > 100 ? [`${bytes(keywords)} bytes`] : []
  for (const keyword of keywords.split(',')) {
    if (characters(keyword.trim()) <= 2) problems.push(`too short: "${keyword}"`)
    if (words(keyword).some((word) => indexedWords.includes(word))) problems.push(`already indexed: "${keyword}"`)
  }
  return problems
}

function pngHeader(data: Buffer): PngHeader {
  if (!data.subarray(0, 8).equals(pngSignature)) throw new Error('not a png')
  const chunks: string[] = []
  for (let offset = 8; offset + 8 <= data.length; offset += 12 + data.readUInt32BE(offset)) {
    chunks.push(data.toString('latin1', offset + 4, offset + 8))
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data[25], chunks }
}

function screenshotProblems({ width, height, colorType, chunks }: PngHeader, sizes: Sized[]) {
  return [
    sizes.some(([w, h]) => w === width && h === height) ? '' : `${width}x${height}`,
    colorType === 2 ? '' : `colorType ${colorType}`,
    chunks.includes('tRNS') ? 'tRNS' : '',
  ].filter(Boolean)
}

function mentionsAndroid(text: string) {
  return /android/i.test(text)
}

function mentionsMac(text: string) {
  return /\bMacs?\b/.test(text)
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)])
}

function syntheticPng(width: number, height: number, colorType: number, extra: string[] = []) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = colorType
  const middle = extra.map((type) => chunk(type, Buffer.alloc(2)))
  return Buffer.concat([pngSignature, chunk('IHDR', ihdr), ...middle, chunk('IDAT', Buffer.alloc(3)), chunk('IEND', Buffer.alloc(0))])
}

function json(path: string) {
  return JSON.parse(readFileSync(join(store, path), 'utf8'))
}

function text(value: unknown) {
  return isFileRef(value) ? readFileSync(join(store, value.$file), 'utf8') : (value as string)
}

describe('fileRefs', () => {
  it('finds the files referenced at any depth', () => {
    const value = { a: { $file: 'x.txt' }, b: [{ c: { $file: 'y.txt' } }], d: 'z', e: null }
    expect(fileRefs(value)).toEqual(['x.txt', 'y.txt'])
  })

  it('ignores a $file that is not a string', () => {
    expect(fileRefs({ a: { $file: 1 } })).toEqual([])
  })
})

describe('characters and bytes', () => {
  it('count the same in ASCII', () => {
    expect([characters('abc'), bytes('abc')]).toEqual([3, 3])
  })

  it('differ beyond ASCII', () => {
    expect([characters('a›é'), bytes('a›é')]).toEqual([3, 6])
  })
})

describe('keywordProblems', () => {
  const indexed = 'Cornercase remote Follow your coding agents'

  it('accepts keywords within 100 bytes, longer than 2 characters and away from the name and subtitle', () => {
    expect(keywordProblems('developer,terminal,diff', indexed)).toEqual([])
  })

  it('counts bytes, not characters', () => {
    expect(keywordProblems(`${'é'.repeat(50)},abc`, indexed)).toEqual(['104 bytes'])
  })

  it('rejects a keyword of 2 characters', () => {
    expect(keywordProblems('terminal, ai', indexed)).toEqual(['too short: " ai"'])
  })

  it('rejects a word of the name or the subtitle, in any case', () => {
    expect(keywordProblems('Remote control,cornercase,Coding tools', indexed)).toEqual([
      'already indexed: "Remote control"',
      'already indexed: "cornercase"',
      'already indexed: "Coding tools"',
    ])
  })

  it('accepts a word that only contains one of the name', () => {
    expect(keywordProblems('remotely', indexed)).toEqual([])
  })
})

describe('pngHeader', () => {
  it('reads the size, the colour type and the chunks', () => {
    expect(pngHeader(syntheticPng(1320, 2868, 2, ['sRGB']))).toEqual({
      width: 1320,
      height: 2868,
      colorType: 2,
      chunks: ['IHDR', 'sRGB', 'IDAT', 'IEND'],
    })
  })

  it('refuses what is not a png', () => {
    expect(() => pngHeader(Buffer.from('not a png at all, no signature'))).toThrow('not a png')
  })
})

describe('screenshotProblems', () => {
  it('accepts an RGB 1320x2868 image', () => {
    expect(screenshotProblems(pngHeader(syntheticPng(1320, 2868, 2)), IPHONE_69)).toEqual([])
  })

  it.each(IPAD_13)('accepts an RGB %ix%i image as a 13-inch iPad', (width, height) => {
    expect(screenshotProblems(pngHeader(syntheticPng(width, height, 2)), IPAD_13)).toEqual([])
  })

  it('rejects an iPhone size for the iPad and an iPad size for the iPhone', () => {
    expect(screenshotProblems(pngHeader(syntheticPng(1320, 2868, 2)), IPAD_13)).toEqual(['1320x2868'])
    expect(screenshotProblems(pngHeader(syntheticPng(2064, 2752, 2)), IPHONE_69)).toEqual(['2064x2752'])
  })

  it('rejects another size, an alpha channel and a transparent colour', () => {
    expect(screenshotProblems(pngHeader(syntheticPng(1290, 2796, 6, ['tRNS'])), IPHONE_69)).toEqual([
      '1290x2796',
      'colorType 6',
      'tRNS',
    ])
  })
})

describe('mentionsAndroid and mentionsMac', () => {
  it('find Android in any case', () => {
    expect(['Android', 'ANDROID phones', 'android'].map(mentionsAndroid)).toEqual([true, true, true])
    expect(mentionsAndroid('iPhone')).toBe(false)
  })

  it('find Mac as a word, and let macOS through', () => {
    expect(['your Mac', "the Mac's", 'Macs', 'Mac.'].map(mentionsMac)).toEqual([true, true, true, true])
    expect(['Linux or macOS', 'MacBook', 'machine', 'mac'].map(mentionsMac)).toEqual([false, false, false, false])
  })
})

describe('the App Store listing', () => {
  const info = json('app-info.json').appInfoLocalizations['en-US'].attributes
  const version = json('version.json')
  const localization = version.appStoreVersionLocalizations['en-US'].attributes
  const notes = text(json('review.json').appStoreReviewDetails.attributes.notes)
  const listing = {
    subtitle: info.subtitle as string,
    keywords: localization.keywords as string,
    promotionalText: localization.promotionalText as string,
    description: text(localization.description),
    whatsNew: readFileSync(join(store, 'en-US/whats-new.txt'), 'utf8'),
  }

  it('fits the subtitle in 30 characters', () => {
    expect(characters(listing.subtitle)).toBeLessThanOrEqual(30)
  })

  it('has valid keywords', () => {
    expect(keywordProblems(listing.keywords, `${info.name} ${info.subtitle}`)).toEqual([])
  })

  it('fits the promotional text in 170 characters', () => {
    expect(characters(listing.promotionalText)).toBeLessThanOrEqual(170)
  })

  it.each(['description', 'whatsNew'] as const)('fits the %s in 4000 characters', (key) => {
    expect(characters(listing[key])).toBeLessThanOrEqual(4000)
  })

  it('fits the review notes in 4000 bytes', () => {
    expect(bytes(notes)).toBeLessThanOrEqual(4000)
  })

  it('gives the version of package.json', () => {
    expect(version.appStoreVersions.attributes.versionString).toBe(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version)
  })

  it('references only files that exist', () => {
    const jsons = readdirSync(store).filter((name) => name.endsWith('.json'))
    const missing = jsons.flatMap((name) => fileRefs(json(name))).filter((path) => !existsSync(join(store, path)))
    expect(missing).toEqual([])
  })

  it('never mentions Android in the listing', () => {
    expect(Object.entries(listing).filter(([, value]) => mentionsAndroid(value))).toEqual([])
  })

  it('never calls the computer a Mac, in the listing or the review notes', () => {
    expect(Object.entries({ ...listing, notes }).filter(([, value]) => mentionsMac(value))).toEqual([])
  })
})

describe.each([
  ['6.9-inch iPhone', 'iphone-6.9', IPHONE_69],
  ['13-inch iPad', 'ipad-13', IPAD_13],
] as const)('the %s screenshots', (_, folder, sizes) => {
  const set = join(screenshots, folder)
  const names = readdirSync(set).filter((name) => name.endsWith('.png'))

  it('are 4 to 6', () => {
    expect(names.length).toBeGreaterThanOrEqual(4)
    expect(names.length).toBeLessThanOrEqual(6)
  })

  it.each(names)('%s is RGB, of the set\'s size, with no transparency', (name) => {
    expect(screenshotProblems(pngHeader(readFileSync(join(set, name))), [...sizes])).toEqual([])
  })
})

describe('the listing metadata', () => {
  const info = json('app-info.json')
  const version = json('version.json').appStoreVersions.attributes
  const localization = json('version.json').appStoreVersionLocalizations['en-US'].attributes
  const age = json('age-rating.json').ageRatingDeclarations.attributes
  const pricing = json('pricing.json')
  const review = json('review.json').appStoreReviewDetails.attributes

  it('is a Developer Tools app with no secondary category', () => {
    expect(info.appInfos.relationships.primaryCategory.data.id).toBe('DEVELOPER_TOOLS')
    expect(info.appInfos.relationships.secondaryCategory.data).toBeNull()
  })

  it('names the app and links the pages of the site that design/releases.md names', () => {
    const releases = readFileSync(join(root, 'design/releases.md'), 'utf8')
    const privacy = info.appInfoLocalizations['en-US'].attributes.privacyPolicyUrl
    expect(info.appInfoLocalizations['en-US'].attributes.name).toBe('Cornercase remote')
    expect(privacy).toMatch(/^https:\/\/[^/]+\/.*privacy\/$/)
    expect(localization.supportUrl).toBe(privacy.replace(/privacy\/$/, 'support/'))
    expect(localization.marketingUrl).toBe(privacy.replace(/privacy\/$/, ''))
    expect([privacy, localization.supportUrl].filter((url) => !releases.includes(`\`${url}\``))).toEqual([])
  })

  it('leaves whatsNew out of the first version', () => {
    expect(localization).not.toHaveProperty('whatsNew')
  })

  it('has a copyright without a personal name and a manual release', () => {
    expect(version.copyright).toBe('2026 The cornercase-mobile authors')
    expect(version.releaseType).toBe('MANUAL')
  })

  it('answers every age rating question with nothing', () => {
    const answers = Object.entries(age).filter(([, value]) => value !== null && value !== 'NONE' && value !== false)
    expect(answers).toEqual([])
  })

  it('is free in the USA and available in new territories', () => {
    expect(pricing.appPricePoints.attributes.customerPrice).toBe('0.0')
    expect(pricing.appPriceSchedules.relationships.baseTerritory.data.id).toBe('USA')
    expect(pricing.appAvailabilities.attributes.availableInNewTerritories).toBe(true)
  })

  it('keeps the reviewer contact out of the repo and needs no demo account', () => {
    const contact = [review.contactFirstName, review.contactLastName, review.contactPhone, review.contactEmail]
    expect(contact).toEqual([null, null, null, null])
    expect(review.demoAccountRequired).toBe(false)
  })
})

describe('the review notes and recording', () => {
  const notes = text(json('review.json').appStoreReviewDetails.attributes.notes)
  const video = readFileSync(join(store, 'review/demo.mp4'))

  it('explain the demo path with the words of the app', () => {
    for (const phrase of ['0.13.78', 'Try a demo', 'DEMO', 'Leave demo']) expect(notes).toContain(phrase)
  })

  it('do not quote the old demo wording', () => {
    expect(notes).not.toContain('No Mac nearby?')
    expect(notes).not.toContain('Demo Mac')
  })

  it('has a recording of at most 10 MB, as an MP4', () => {
    expect(video.length).toBeLessThanOrEqual(10 * 1024 * 1024)
    expect(video.toString('latin1', 4, 8)).toBe('ftyp')
  })
})
