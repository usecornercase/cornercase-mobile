import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { NARROW_QUERY, SHORTEST_SCREEN } from '../site/src/lib/track'
import { build, escape, expand, fill, plainText, render, resolveLink, sitePlugin } from './site.mjs'

const repository = 'owner/name'
const root = join(import.meta.dirname, '..')
const folders: string[] = []

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

function temporary() {
  const folder = mkdtempSync(join(tmpdir(), 'site-'))
  folders.push(folder)
  return folder
}

function write(folder: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(folder, path)), { recursive: true })
    writeFileSync(join(folder, path), text)
  }
  return folder
}

function html(markdown: string, source = 'SUPPORT.md') {
  return render(markdown, { source, repository })
}

describe('escape', () => {
  it('escapes &, <, > and "', () => {
    expect(escape('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;')
  })

  it('escapes & before the others, so nothing is escaped twice', () => {
    expect(escape('&lt;')).toBe('&amp;lt;')
  })
})

describe('resolveLink', () => {
  it.each([
    ['../../issues', 'SUPPORT.md', 'https://github.com/owner/name/issues'],
    ['../../issues/new', 'SUPPORT.md', 'https://github.com/owner/name/issues/new'],
    ['../../issues', 'PRIVACY.md', 'https://github.com/owner/name/issues'],
    ['CHANGELOG.md', 'SUPPORT.md', 'https://github.com/owner/name/blob/main/CHANGELOG.md'],
  ])('resolves %s from %s against the repository', (url, source, href) => {
    expect(resolveLink(url, { source, repository })).toBe(href)
  })

  it.each([
    ['PRIVACY.md', 'SUPPORT.md', '../privacy/'],
    ['SUPPORT.md', 'PRIVACY.md', '../support/'],
    ['./PRIVACY.md', 'SUPPORT.md', '../privacy/'],
    ['SUPPORT.md', 'SUPPORT.md', './'],
  ])('sends %s from %s to its page of the site', (url, source, href) => {
    expect(resolveLink(url, { source, repository })).toBe(href)
  })

  it('keeps an https link as it is', () => {
    expect(resolveLink('https://tailscale.com', { source: 'SUPPORT.md', repository })).toBe('https://tailscale.com')
  })

  it.each(['http://example.com', 'javascript:alert(1)', 'mailto:someone@example.com'])(
    'refuses %s, which is not https',
    (url) => {
      expect(() => resolveLink(url, { source: 'SUPPORT.md', repository })).toThrow(/SUPPORT\.md: .*not https/)
    },
  )

  it.each([
    ['PRIVACY.md#contact', 'SUPPORT.md'],
    ['#contact', 'PRIVACY.md'],
  ])('refuses %s from %s, since the pages have no anchors', (url, source) => {
    expect(() => resolveLink(url, { source, repository })).toThrow(`${source}: the site has no anchors: ${url}`)
  })

  it('keeps the anchor of a link to GitHub', () => {
    expect(resolveLink('CHANGELOG.md#v1', { source: 'SUPPORT.md', repository })).toBe(
      'https://github.com/owner/name/blob/main/CHANGELOG.md#v1',
    )
  })

  it('refuses a link from the root, which GitHub reads from the repository', () => {
    expect(() => resolveLink('/PRIVACY.md', { source: 'SUPPORT.md', repository })).toThrow(
      'SUPPORT.md: a link from the root, which GitHub reads otherwise: /PRIVACY.md',
    )
  })

  it('refuses a source that is not a page of the site', () => {
    expect(() => resolveLink('PRIVACY.md', { source: 'README.md', repository })).toThrow(/README\.md: not a page/)
  })

  it.each([undefined, '', 'name', 'owner/name/extra', 'owner name/x'])(
    'refuses %j as the repository of a relative link',
    (bad) => {
      expect(() => resolveLink('../../issues', { source: 'SUPPORT.md', repository: bad })).toThrow(
        /not a GitHub repository/,
      )
    },
  )
})

describe('render', () => {
  it.each([
    ['# Title', '<h1>Title</h1>'],
    ['### Small', '<h3>Small</h3>'],
    ['A paragraph.', '<p>A paragraph.</p>'],
    ['Some *soft* words', '<p>Some <em>soft</em> words</p>'],
    ['Some **bold** words', '<p>Some <strong>bold</strong> words</p>'],
    ['Run `a < b`', '<p>Run <code>a &lt; b</code></p>'],
    ['```\nx && y\n```', '<pre><code>x &amp;&amp; y</code></pre>'],
    ['one  \ntwo', '<p>one<br>two</p>'],
    ['---', '<hr>'],
    ['[here](PRIVACY.md)', '<p><a href="../privacy/">here</a></p>'],
    [
      '[**new**](../../issues/new)',
      '<p><a href="https://github.com/owner/name/issues/new"><strong>new</strong></a></p>',
    ],
  ])('renders %j', (markdown, expected) => {
    expect(html(markdown)).toBe(expected)
  })

  it('separates the blocks with a newline', () => {
    expect(html('# A\n\nB')).toBe('<h1>A</h1>\n<p>B</p>')
  })

  it('renders a tight list without paragraphs', () => {
    expect(html('- one\n- **two**')).toBe('<ul>\n<li>one</li>\n<li><strong>two</strong></li>\n</ul>')
  })

  it('keeps the paragraphs of a loose list', () => {
    expect(html('- one\n\n- two')).toBe('<ul>\n<li><p>one</p></li>\n<li><p>two</p></li>\n</ul>')
  })

  it('renders an ordered list, with its start when it is not 1', () => {
    expect(html('1. a\n2. b')).toBe('<ol>\n<li>a</li>\n<li>b</li>\n</ol>')
    expect(html('3. c')).toBe('<ol start="3">\n<li>c</li>\n</ol>')
  })

  it('renders a nested list inside its item', () => {
    expect(html('- a\n  - b')).toBe('<ul>\n<li>a<ul>\n<li>b</li>\n</ul></li>\n</ul>')
  })

  it('escapes <, & and " in text', () => {
    expect(html('a < b & "c"')).toBe('<p>a &lt; b &amp; &quot;c&quot;</p>')
  })

  it('escapes <, & and " in a link', () => {
    expect(html('[x](https://example.com/?a=1&b="<")')).toBe(
      '<p><a href="https://example.com/?a=1&amp;b=&quot;&lt;&quot;">x</a></p>',
    )
  })

  it.each([
    ['<b>raw</b>', 'html'],
    ['Inline <i>raw</i> html', 'html'],
    ['![a picture](a.png)', 'image'],
    ['> a quote', 'blockquote'],
    ['| a | b |\n| - | - |\n| 1 | 2 |', 'table'],
    ['~~gone~~', 'delete'],
    ['[a][b]\n\n[b]: https://example.com', 'linkReference'],
  ])('fails on %j, a node it has no HTML for', (markdown, type) => {
    expect(() => html(markdown)).toThrow(`SUPPORT.md:1: the site has no HTML for the markdown node "${type}"`)
  })

  it('fails on a link with a title, instead of losing it', () => {
    expect(() => html('[a](PRIVACY.md "the policy")')).toThrow(
      'SUPPORT.md:1: the site has no HTML for the markdown link title',
    )
  })

  it('fails on a task list item, instead of losing its box', () => {
    expect(() => html('\n- [x] done', 'PRIVACY.md')).toThrow(
      'PRIVACY.md:2: the site has no HTML for the markdown task list item',
    )
  })
})

describe('plainText', () => {
  it('joins the text of a node and of everything inside it', () => {
    const tree = fromMarkdown('A **bold** [link](x) and `code`.')
    expect(plainText(tree)).toBe('A bold link and code.')
  })
})

describe('fill', () => {
  it('puts each value in its placeholder, every time it appears', () => {
    expect(fill('{{a}}-{{b}}-{{a}}', { a: '1', b: '2' }, 'x.html')).toBe('1-2-1')
  })

  it('takes a value as it is, with no special meaning for $', () => {
    expect(fill('<p>{{content}}</p>', { content: "$& $' $1" }, 'x.html')).toBe("<p>$& $' $1</p>")
  })

  it('does not fill the placeholders that a value brings in', () => {
    expect(fill('{{a}}{{b}}', { a: '{{b}}', b: 'x' }, 'x.html')).toBe('{{b}}x')
  })

  it('fails on a placeholder it has no value for, naming the entry', () => {
    expect(() => fill('{{title}} {{missing}}', { title: 'x' }, 'site/index.html')).toThrow(
      'site/index.html: no value for {{missing}}',
    )
  })
})

describe('expand', () => {
  it('puts a partial in its place', () => {
    expect(expand('<a>{{nav}}</a>', { nav: 'N' })).toBe('<a>N</a>')
  })

  it('puts a partial inside a partial', () => {
    expect(expand('{{document}}', { document: '[{{nav}}]', nav: '({{mark}})', mark: 'M' })).toBe('[(M)]')
  })

  it("leaves a value's placeholder for fill", () => {
    expect(expand('{{nav}}{{title}}', { nav: '{{root}}' })).toBe('{{root}}{{title}}')
  })

  it('takes a partial as it is, with no special meaning for $', () => {
    expect(expand('{{nav}}', { nav: "$& $'" })).toBe("$& $'")
  })

  it('fails on a partial that includes itself', () => {
    expect(() => expand('{{nav}}', { nav: '<{{nav}}>' })).toThrow(/a partial includes itself/)
  })
})

const DOCUMENTS = [
  ['PRIVACY.md', 'privacy/index.html'],
  ['SUPPORT.md', 'support/index.html'],
]
const ENTRIES = ['index.html', 'privacy/index.html', 'support/index.html']
const SCREENSHOTS = ['01-board', '02-chat', '03-terminal', '04-changes', '05-start', '06-files']
const ORIGINS = /^https:\/\/(github\.com\/owner\/name(\/|$)|usecornercase\.dev$|apps\.apple\.com\/)/

function blocks(node: { type: string; children?: unknown[] }): { type: string; children?: unknown[] }[] {
  const inside = (node.children ?? []).flatMap((child) => blocks(child as typeof node))
  return node.type === 'heading' || node.type === 'paragraph' ? [node, ...inside] : inside
}

function textOf(html: string) {
  return html.replace(/<[^>]*>/g, '')
}

function urls(html: string) {
  return [...html.matchAll(/\s(?:href|src|srcset)="([^"]*)"/g)].map((match) => match[1])
}

function attributes(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}\\s[^>]*href="([^"]*)"`, 'g'))].map((match) => match[1])
}

function builtSite(siteUrl?: string) {
  const site = { folder: '', read: (path: string) => readFileSync(join(site.folder, '_site', path), 'utf8') }
  beforeAll(async () => {
    site.folder = mkdtempSync(join(tmpdir(), 'site-'))
    await build({ root, out: join(site.folder, '_site'), repository, siteUrl })
  }, 60_000)
  afterAll(() => rmSync(site.folder, { recursive: true, force: true }))
  return site
}

describe('build with the repository', () => {
  const site = builtSite()

  it('writes the three pages, the early script and the social picture', () => {
    for (const path of [...ENTRIES, 'boot.js', 'og.png']) {
      expect(existsSync(join(site.folder, '_site', path)), path).toBe(true)
    }
  })

  it.each(DOCUMENTS)('puts every heading and paragraph of %s in %s', (source, path) => {
    const page = textOf(site.read(path))
    for (const block of blocks(fromMarkdown(readFileSync(join(root, source), 'utf8')))) {
      expect(page).toContain(escape(plainText(block)))
    }
  })

  it.each(ENTRIES)('links only relatively from %s, but for the few https origins it names', (path) => {
    const page = site.read(path)
    expect(page).not.toContain('github.io')
    for (const url of urls(page)) {
      if (/^([a-z]+:|\/\/)/i.test(url)) expect(url, url).toMatch(ORIGINS)
      else expect(url, url).not.toMatch(/^\//)
    }
  })

  it('reaches the assets from a page in a folder through ../', () => {
    const page = site.read('privacy/index.html')
    expect(attributes(page, 'link').filter((href) => !href.startsWith('https:'))).toEqual([
      expect.stringMatching(/^\.\.\/assets\/icon-[\w-]+\.svg$/),
      expect.stringMatching(/^\.\.\/assets\/prose-[\w-]+\.css$/),
    ])
  })

  it.each(DOCUMENTS)('gives %s no script (%s)', (_, path) => {
    expect(site.read(path)).not.toMatch(/<script/i)
  })

  it('gives the landing only scripts of its own', () => {
    const scripts = [...site.read('index.html').matchAll(/<script\b[^>]*src="([^"]*)"/g)].map((match) => match[1])
    expect(scripts).toEqual(['./boot.js', expect.stringMatching(/^\.\/assets\/index-[\w-]+\.js$/)])
  })

  it.each([
    ['index.html', "; script-src 'self'"],
    ['privacy/index.html', ''],
    ['support/index.html', ''],
  ])('gives %s its content security policy, no referrer and no inline style', (path, scripts) => {
    const page = site.read(path)
    const csp = `default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'${scripts}`
    expect(page).toContain(`<meta http-equiv="Content-Security-Policy" content="${csp}">`)
    expect(page).toContain('<meta name="referrer" content="no-referrer">')
    expect(page).not.toMatch(/\sstyle="/)
  })

  it.each([
    ['index.html', './', 'Cornercase remote · Your coding agents, in your pocket'],
    ['privacy/index.html', '../', 'Privacy policy · Cornercase remote'],
    ['support/index.html', '../', 'Support · Cornercase remote'],
  ])('links %s to the other pages through %s, with the title %s', (path, up, title) => {
    const page = site.read(path)
    expect(attributes(page, 'a')).toEqual(expect.arrayContaining([up, `${up}privacy/`, `${up}support/`]))
    expect(page).toContain(`<title>${title}</title>`)
  })

  it('links the App Store and cornercase, and names Google Play without a link', () => {
    const page = site.read('index.html')
    expect(attributes(page, 'a')).toEqual(
      expect.arrayContaining(['https://apps.apple.com/app/id6835431973', 'https://usecornercase.dev']),
    )
    expect(textOf(page)).toContain('Coming soon on Google Play')
    expect(page).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*Google Play/)
    expect(page).not.toMatch(/releases|\.apk/)
  })

  it('serves the six screenshots and shows each on the landing', () => {
    const assets = readdirSync(join(site.folder, '_site/assets'))
    const page = site.read('index.html')
    for (const shot of SCREENSHOTS) {
      const file = assets.find((name) => name.startsWith(`${shot}-`) && name.endsWith('.png'))
      expect(file, shot).toBeDefined()
      expect(page).toContain(`./assets/${file}`)
    }
  })

  it('keeps the unprefixed backdrop-filter that the minifier would fold into the prefixed one', () => {
    const sheets = readdirSync(join(site.folder, '_site/assets')).filter((name) => name.endsWith('.css'))
    expect(sheets).toHaveLength(2)
    for (const name of sheets) {
      const sheet = site.read(`assets/${name}`)
      const prefixed = sheet.match(/-webkit-backdrop-filter:/g) ?? []
      const unprefixed = sheet.match(/(?<!-webkit-)backdrop-filter:/g) ?? []
      expect(unprefixed.length, name).toBeGreaterThan(0)
      expect(unprefixed.length, name).toBe(prefixed.length)
    }
  })

  it.each(ENTRIES)('gives %s no canonical and no og: tag without a site URL', (path) => {
    expect(site.read(path)).not.toMatch(/rel="canonical"|property="og:/)
  })
})

describe('build with a site URL', () => {
  const site = builtSite('https://example.com/app/')

  it.each([
    ['index.html', 'https://example.com/app/'],
    ['support/index.html', 'https://example.com/app/support/'],
  ])('gives %s its canonical URL and its card', (path, url) => {
    const page = site.read(path)
    expect(page).toContain(`<link rel="canonical" href="${url}">`)
    expect(page).toContain(`<meta property="og:url" content="${url}">`)
    expect(page).toContain('<meta property="og:image" content="https://example.com/app/og.png">')
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image">')
  })

  it('refuses a site URL that is not https', async () => {
    const out = join(temporary(), '_site')
    await expect(build({ root, out, repository, siteUrl: 'http://example.com' })).rejects.toThrow(
      'SITE_URL: a link that is not https: http://example.com',
    )
  })
})

function filesUnder(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
  )
}

describe('the sources of the site', () => {
  it('name no owner of the repository', () => {
    const sources = [
      ...filesUnder('site').filter((path) => !path.endsWith('.png')),
      'scripts/site.mjs',
      'SUPPORT.md',
      'PRIVACY.md',
      '.github/workflows/pages.yml',
    ]
    expect(sources).toEqual(expect.arrayContaining(['site/partials/nav.html', 'site/src/main.ts']))
    const owner = new RegExp(['miguel', 'hang'].join(''), 'i')
    for (const path of sources) expect(readFileSync(join(root, path), 'utf8'), path).not.toMatch(owner)
  })

  it('draw the mark of the app icon, on a grid of 12', () => {
    const icon = readFileSync(join(root, 'src-tauri/icons/icon.svg'), 'utf8')
    const mark = readFileSync(join(root, 'site/partials/mark.html'), 'utf8')
    const paths = (text: string) => [...text.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map((match) => match[1])
    const scaled = (d: string) =>
      d.replace(/([MHVhv])([\d\s]+)/g, (_, command: string, numbers: string) => {
        const shift = command === command.toUpperCase() ? 224 : 0
        return (
          command +
          numbers
            .trim()
            .split(/\s+/)
            .map((n) => (Number(n) - shift) / 48)
            .join(' ')
        )
      })
    expect(paths(mark)).toEqual(paths(icon).slice(1).map(scaled))
  })
})

describe('the copy of the landing', () => {
  const landing = readFileSync(join(root, 'site/index.html'), 'utf8')

  it('asks for the cornercase that the app needs', () => {
    const contract = readFileSync(join(root, 'crates/core/src/cli/contract.rs'), 'utf8')
    const since = /const SINCE[^=]*=([^;]*);/.exec(contract)?.[1] ?? ''
    const versions = [...since.matchAll(/"(\d+)\.(\d+)\.(\d+)"/g)].map((match) => match.slice(1).map(Number))
    const [highest] = versions.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])
    expect(highest).toBeDefined()
    expect(landing).toContain(`cornercase ${highest.join('.')} or later`)
  })

  it.each(['Linux or macOS', 'Tailscale', 'No account', 'no sign-in', 'Try a demo'])('says %j', (words) => {
    expect(textOf(landing)).toContain(words)
  })

  it('starts the motion on screens as tall as the script allows', () => {
    expect(readFileSync(join(root, 'site/public/boot.js'), 'utf8')).toContain(`innerHeight >= ${SHORTEST_SCREEN}`)
  })
})

describe('the style sheets of the site', () => {
  const folder = join(root, 'site/styles')
  const sheets = readdirSync(folder).map((name) => [name, readFileSync(join(folder, name), 'utf8')])
  const tokens = readFileSync(join(root, 'src/lib/theme/tokens.css'), 'utf8')
  const base = /:root \{([^}]*)\}/.exec(readFileSync(join(folder, 'base.css'), 'utf8'))?.[1] ?? ''
  const glass = /--glass: (#[0-9a-f]+);/.exec(tokens)?.[1]

  it.each(sheets)('%s uses only the tokens of the app and the variables of the site', (_, sheet) => {
    for (const [, name] of sheet.matchAll(/var\((--[\w-]+)/g)) {
      expect(`${tokens}${base}`, name).toContain(`${name}:`)
    }
  })

  it.each(sheets)('%s writes no colour of its own and no light palette', (_, sheet) => {
    expect(sheet).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|prefers-color-scheme/i)
  })

  it('turns narrow at the width the script reads from the same media query', () => {
    const queries = sheets.flatMap(([, sheet]) => [...sheet.matchAll(/@media ([^{]*\b980[^{]*?) \{/g)].map((m) => m[1]))
    expect(queries.length).toBeGreaterThan(0)
    expect(new Set(queries)).toEqual(new Set([NARROW_QUERY]))
  })

  it('scrolls smoothly to an anchor only for who has not asked for less motion', () => {
    const smooth = sheets.flatMap(([, sheet]) => sheet.match(/scroll-behavior: smooth/g) ?? [])
    expect(smooth).toHaveLength(1)
    const base = readFileSync(join(folder, 'base.css'), 'utf8')
    expect(base).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*[^{}]+\{\s*scroll-behavior: smooth;/)
  })

  it('gives the browser the colour of the ground', () => {
    const head = readFileSync(join(root, 'site/partials/head.html'), 'utf8')
    expect(glass).toBeDefined()
    expect(head).toContain(`<meta name="theme-color" content="${glass}">`)
  })
})

describe('the workflow that publishes the site', () => {
  const workflow = (name: string) => readFileSync(join(root, `.github/workflows/${name}.yml`), 'utf8')
  const actions = (text: string) =>
    new Map([...text.matchAll(/uses: ([\w/-]+)@(\S+)/g)].map((match) => [match[1], match[2]]))
  const pages = workflow('pages')
  const ci = actions(workflow('ci'))

  it('sets up the tools with the same versions as CI', () => {
    const shared = [...actions(pages)].filter(([action]) => ci.has(action))
    expect(shared.map(([action]) => action)).toEqual(['actions/checkout', 'pnpm/action-setup', 'actions/setup-node'])
    for (const [action, version] of shared) expect(version, action).toBe(ci.get(action))
    expect(pages).toMatch(/node-version: 22\n/)
    expect(pages).toContain('run: pnpm install --frozen-lockfile')
  })

  it('builds the site again when any of its sources changes', () => {
    const sources = [...DOCUMENTS.map(([source]) => source), 'site/**', 'scripts/site.mjs', 'src/lib/theme/tokens.css']
    sources.push('store/app-store/screenshots/**', 'src-tauri/icons/icon.svg')
    sources.push('package.json', 'pnpm-lock.yaml', '.github/workflows/pages.yml')
    for (const source of sources) expect(pages, source).toContain(`- ${source}\n`)
  })

  it('gives the build the URL of the Pages site', () => {
    const configure = pages.indexOf('id: pages')
    const site = pages.indexOf('name: site')
    expect(configure).toBeGreaterThan(-1)
    expect(configure).toBeLessThan(site)
    expect(pages.slice(site)).toMatch(/env:\n\s+SITE_URL: \$\{\{ steps\.pages\.outputs\.base_url \}\}/)
  })
})

describe('build with a site of its own', () => {
  const document = '<!doctype html><html><head>{{head}}</head><body>{{nav}}<main>{{content}}</main></body></html>'
  const site = {
    'site/index.html': '<!doctype html><html><head>{{head}}</head><body>{{nav}}{{footer}}</body></html>',
    'site/privacy/index.html': '{{document}}',
    'site/support/index.html': '{{document}}',
    'site/partials/document.html': document,
    'site/partials/head.html': '<title>{{title}}</title>',
    'site/partials/nav.html': '<nav>{{root}}|{{mark}}</nav>',
    'site/partials/footer.html': '<footer>{{repository}}</footer>',
    'site/partials/mark.html': '<i>m</i>',
    'PRIVACY.md': '# Privacy',
    'SUPPORT.md': '# Support\n\nSee [privacy](PRIVACY.md).',
  }

  function out(files: Record<string, string> = {}) {
    const folder = write(temporary(), { ...site, ...files })
    return { folder, out: write(join(folder, '_site'), { 'stale.html': 'old' }) }
  }

  it('fills the partials, the title, the way up and the content of each page', async () => {
    const { folder, out: target } = out()
    await build({ root: folder, out: target, repository })
    const support = readFileSync(join(target, 'support/index.html'), 'utf8')
    expect(support).toContain('<title>Support · Cornercase remote</title>')
    expect(support).toContain('<nav>../|<i>m</i></nav>')
    expect(support).toContain('<main><h1>Support</h1>\n<p>See <a href="../privacy/">privacy</a>.</p></main>')
    const landing = readFileSync(join(target, 'index.html'), 'utf8')
    expect(landing).toContain('<nav>./|<i>m</i></nav><footer>https://github.com/owner/name</footer>')
  }, 30_000)

  it('escapes the title', async () => {
    const { folder, out: target } = out({ 'PRIVACY.md': '# A & B' })
    await build({ root: folder, out: target, repository })
    expect(readFileSync(join(target, 'privacy/index.html'), 'utf8')).toContain('<title>A &amp; B · Cornercase remote')
  }, 30_000)

  it('removes what an earlier build left', async () => {
    const { folder, out: target } = out()
    await build({ root: folder, out: target, repository })
    expect(existsSync(join(target, 'stale.html'))).toBe(false)
  }, 30_000)

  it.each([
    ['PRIVACY.md', 'No heading.', 'PRIVACY.md: the page has no # heading to name it'],
    ['SUPPORT.md', '# Support\n\n> a quote', 'SUPPORT.md:3: the site has no HTML for the markdown node "blockquote"'],
  ])('fails on %s with %j and leaves the earlier build alone', async (path, text, message) => {
    const { folder, out: target } = out({ [path]: text })
    await expect(build({ root: folder, out: target, repository })).rejects.toThrow(message)
    expect(existsSync(join(target, 'stale.html'))).toBe(true)
  })

  it.each([undefined, 'name'])(
    'fails without a repository as owner/name (%j), even with no link to resolve',
    async (bad) => {
      const { folder, out: target } = out()
      await expect(build({ root: folder, out: target, repository: bad })).rejects.toThrow(/not a GitHub repository/)
      expect(existsSync(join(target, 'stale.html'))).toBe(true)
    },
  )
})

describe('the dev server', () => {
  type Middleware = (request: { url: string }, response: unknown, next: () => void) => void
  const plugin = sitePlugin({ root, repository })

  function middleware() {
    let used: Middleware | undefined
    plugin.configureServer({ middlewares: { use: (handler: Middleware) => (used = handler) } })
    return used as Middleware
  }

  function serve(url: string) {
    const response = {
      location: '',
      writeHead: (_: number, headers: { location: string }) => (response.location = headers.location),
      end: () => {},
    }
    let passed = false
    middleware()({ url }, response, () => (passed = true))
    return { passed, location: response.location }
  }

  it("lets Vite's client run and connect, which the built pages do not", () => {
    const page = (server?: object) =>
      plugin.transformIndexHtml.handler('{{head}}', { path: '/support/index.html', server })
    expect(page({})).toContain(
      "default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'",
    )
    expect(page()).not.toContain('script-src')
  })

  it('sends a file of the repository outside site/ to Vite, which serves it from there', () => {
    const shot = 'store/app-store/screenshots/iphone-6.9/01-board.png'
    expect(serve(`/${shot}?import`)).toEqual({ passed: false, location: `/@fs${join(root, shot)}` })
  })

  it.each(['/', '/styles/base.css', '/store/app-store', '/nothing.png', '/../../etc/hosts'])(
    'leaves %s to Vite',
    (url) => {
      expect(serve(url).passed).toBe(true)
    },
  )
})

describe('the script', () => {
  function run(args: string[]) {
    const env = { ...process.env, GITHUB_REPOSITORY: '' }
    return spawnSync(process.execPath, ['scripts/site.mjs', ...args], { cwd: root, env, encoding: 'utf8' })
  }

  it('fails with a clear message when it has no repository', () => {
    const result = run([])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('set GITHUB_REPOSITORY or pass --repository owner/name')
  })

  it('fails with a clear message when the repository is not owner/name', () => {
    const result = run(['--repository', 'name'])
    expect(result.status).toBe(1)
    expect(result.stderr.trim()).toBe('not a GitHub repository as owner/name: name')
  })
})
