import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { build as viteBuild, createServer } from 'vite'

const DOCUMENTS = { 'PRIVACY.md': 'privacy', 'SUPPORT.md': 'support' }
const ENTRIES = ['index.html', 'privacy/index.html', 'support/index.html']
const PARTIALS = ['document', 'head', 'nav', 'footer', 'mark']
const PARTIAL_ROUNDS = 3
const SITE = 'Cornercase remote'
const LANDING = {
  title: 'Cornercase remote · Your coding agents, in your pocket',
  description:
    'See which agents need you, answer their questions and start new work from your iPhone, while they keep running on your computer.',
}
const CSP = "default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'"
const SCRIPTS = "; script-src 'self'"
const DEV_SOURCES = "; script-src 'self'; connect-src 'self'"
const NO_REPOSITORY = 'site.mjs needs the GitHub repository: set GITHUB_REPOSITORY or pass --repository owner/name.'
const PLACEHOLDER = /\{\{(\w+)\}\}/g

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

export function escape(text) {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character])
}

function pageOf(source) {
  if (!Object.hasOwn(DOCUMENTS, source)) throw new Error(`${source}: not a page of the site`)
  return DOCUMENTS[source]
}

function pageLink(from, to) {
  const path = posix.relative(`/${from}`, `/${to}`)
  return path === '' ? './' : `${path}/`
}

function checkRepository(repository) {
  if (!REPOSITORY.test(repository ?? '')) throw new Error(`not a GitHub repository as owner/name: ${repository}`)
}

function repositoryBase(repository) {
  checkRepository(repository)
  return `https://github.com/${repository}/blob/main/`
}

function secure(url, source) {
  if (new URL(url).protocol !== 'https:') throw new Error(`${source}: a link that is not https: ${url}`)
  return url
}

export function resolveLink(url, { source, repository }) {
  const from = pageOf(source)
  if (URL.canParse(url)) return secure(url, source)
  if (/^\/(?!\/)/.test(url)) throw new Error(`${source}: a link from the root, which GitHub reads otherwise: ${url}`)
  const base = repositoryBase(repository)
  const target = new URL(url, base + source)
  const file = Object.keys(DOCUMENTS).find((path) => target.origin + target.pathname === base + path)
  if (file === undefined) return target.href
  if (target.hash !== '') throw new Error(`${source}: the site has no anchors: ${url}`)
  return pageLink(from, DOCUMENTS[file])
}

function unsupported(node, context, what) {
  const line = node.position?.start.line ?? '?'
  return new Error(`${context.source}:${line}: the site has no HTML for the markdown ${what}`)
}

function element(tag, content, attributes = '') {
  return `<${tag}${attributes}>${content}</${tag}>`
}

function inner(node, context, separator = '') {
  return node.children.map((child) => html(child, context)).join(separator)
}

function listItem(node, context, loose) {
  if (typeof node.checked === 'boolean') throw unsupported(node, context, 'task list item')
  const content = node.children.map((child) =>
    !loose && child.type === 'paragraph' ? inner(child, context) : html(child, context),
  )
  return element('li', content.join(loose ? '\n' : ''))
}

function list(node, context) {
  const loose = node.spread === true || node.children.some((child) => child.spread === true)
  const items = node.children.map((child) => listItem(child, context, loose)).join('\n')
  const start = node.ordered && node.start !== 1 && node.start != null ? ` start="${node.start}"` : ''
  return element(node.ordered ? 'ol' : 'ul', `\n${items}\n`, start)
}

function link(node, context) {
  if (node.title) throw unsupported(node, context, 'link title')
  return element('a', inner(node, context), ` href="${escape(resolveLink(node.url, context))}"`)
}

const HANDLERS = {
  root: (node, context) => inner(node, context, '\n'),
  heading: (node, context) => element(`h${node.depth}`, inner(node, context)),
  paragraph: (node, context) => element('p', inner(node, context)),
  text: (node) => escape(node.value),
  emphasis: (node, context) => element('em', inner(node, context)),
  strong: (node, context) => element('strong', inner(node, context)),
  inlineCode: (node) => element('code', escape(node.value)),
  code: (node) => element('pre', element('code', escape(node.value))),
  break: () => '<br>',
  thematicBreak: () => '<hr>',
  list,
  link,
}

function html(node, context) {
  if (!Object.hasOwn(HANDLERS, node.type)) throw unsupported(node, context, `node "${node.type}"`)
  return HANDLERS[node.type](node, context)
}

function parse(markdown) {
  return fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
}

export function render(markdown, context) {
  return html(parse(markdown), context)
}

export function plainText(node) {
  return node.value ?? (node.children ?? []).map(plainText).join('')
}

function pageTitle(tree, source) {
  const heading = tree.children.find((node) => node.type === 'heading' && node.depth === 1)
  if (heading === undefined) throw new Error(`${source}: the page has no # heading to name it`)
  return [...new Set([plainText(heading), SITE])].join(' · ')
}

export function fill(template, values, source) {
  return template.replace(PLACEHOLDER, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`${source}: no value for {{${key}}}`)
    return values[key]
  })
}

function holdsPartial(html, partials) {
  return [...html.matchAll(PLACEHOLDER)].some(([, key]) => Object.hasOwn(partials, key))
}

export function expand(html, partials) {
  let text = html
  for (let round = 0; round < PARTIAL_ROUNDS && holdsPartial(text, partials); round += 1) {
    text = text.replace(PLACEHOLDER, (match, key) => (Object.hasOwn(partials, key) ? partials[key] : match))
  }
  if (holdsPartial(text, partials)) throw new Error(`a partial includes itself, or nests deeper than ${PARTIAL_ROUNDS}`)
  return text
}

function readPartials(root) {
  const read = (name) => readFileSync(join(root, 'site/partials', `${name}.html`), 'utf8').trimEnd()
  return Object.fromEntries(PARTIALS.map((name) => [name, read(name)]))
}

function folderOf(entry) {
  if (!ENTRIES.includes(entry)) throw new Error(`${entry}: not an entry of the site`)
  return posix.dirname(entry) === '.' ? '' : posix.dirname(entry)
}

function documentOf(folder) {
  return Object.keys(DOCUMENTS).find((source) => DOCUMENTS[source] === folder)
}

function documentValues(root, source, repository) {
  const tree = parse(readFileSync(join(root, source), 'utf8'))
  const title = pageTitle(tree, source)
  const paragraph = tree.children.find((node) => node.type === 'paragraph')
  const description = paragraph === undefined ? LANDING.description : plainText(paragraph)
  return { title, description, content: html(tree, { source, repository }), csp: CSP }
}

function landingValues() {
  return { ...LANDING, content: '', csp: CSP + SCRIPTS }
}

function siteBase(siteUrl) {
  return secure(siteUrl, 'SITE_URL').replace(/\/+$/, '')
}

function social(siteUrl, folder, { title, description }) {
  if (!siteUrl) return ''
  const base = siteBase(siteUrl)
  const url = escape(`${base}/${folder === '' ? '' : `${folder}/`}`)
  const image = escape(`${base}/og.png`)
  return [
    `<link rel="canonical" href="${url}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n')
}

export function pageValues(entry, { root, repository, siteUrl }) {
  checkRepository(repository)
  const folder = folderOf(entry)
  const source = documentOf(folder)
  const page = source === undefined ? landingValues() : documentValues(root, source, repository)
  const text = { title: escape(page.title), description: escape(page.description) }
  return {
    ...page,
    ...text,
    root: pageLink(folder, ''),
    repository: `https://github.com/${repository}`,
    social: social(siteUrl, folder, text),
  }
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile()
}

function servedFromTheRepository(root) {
  return (request, response, next) => {
    const path = decodeURIComponent(new URL(request.url, 'http://site').pathname)
    const file = join(root, path)
    if (existsSync(join(root, 'site', path)) || !file.startsWith(root) || !isFile(file)) return next()
    response.writeHead(302, { location: `/@fs${file}` })
    response.end()
  }
}

export function sitePlugin(options) {
  const handler = (html, context) => {
    const entry = context.path.replace(/^\//, '')
    const values = pageValues(entry, options)
    if (context.server) values.csp = CSP + DEV_SOURCES
    return fill(expand(html, readPartials(options.root)), values, `site/${entry}`)
  }
  return {
    name: 'cornercase-site',
    transformIndexHtml: { order: 'pre', handler },
    configureServer: (server) => {
      server.middlewares.use(servedFromTheRepository(options.root))
    },
  }
}

export function viteConfig({ root, out, repository, siteUrl }) {
  const site = join(root, 'site')
  return {
    configFile: false,
    root: site,
    base: './',
    logLevel: 'warn',
    cacheDir: join(root, 'node_modules/.vite-site'),
    plugins: [sitePlugin({ root, repository, siteUrl })],
    server: { fs: { allow: [root] } },
    build: {
      outDir: out,
      emptyOutDir: true,
      assetsInlineLimit: 0,
      rollupOptions: { input: ENTRIES.map((entry) => join(site, entry)) },
    },
  }
}

export async function build(options) {
  checkRepository(options.repository)
  for (const entry of ENTRIES) pageValues(entry, options)
  await viteBuild(viteConfig(options))
}

async function serve(options) {
  checkRepository(options.repository)
  const server = await createServer({ ...viteConfig(options), logLevel: 'info' })
  await server.listen()
  server.printUrls()
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url))
  try {
    const { values } = parseArgs({ options: { repository: { type: 'string' }, dev: { type: 'boolean' } } })
    const repository = values.repository || process.env.GITHUB_REPOSITORY
    if (!repository) throw new Error(NO_REPOSITORY)
    const options = { root, out: join(root, '_site'), repository, siteUrl: process.env.SITE_URL || undefined }
    await (values.dev ? serve(options) : build(options))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

const started = process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1])
if (started && import.meta.url === pathToFileURL(started).href) await main()
