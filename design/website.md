# Website

Code: `site/`, `scripts/site.mjs`, `scripts/site.test.ts`, `SUPPORT.md`, `.github/workflows/pages.yml`.

The app's site on GitHub Pages: a landing page at `/` and the privacy and support pages that the stores link to, at
`/privacy/` and `/support/` (069). 072 turned the bare front page into a landing in cornercase-gpui's look, whose
subject is a phone showing the app's real screenshots; the two legal pages kept their URLs and their markdown and took
the new look.

## The pages

- **Three entries**, `site/index.html`, `site/privacy/index.html` and `site/support/index.html`, built by Vite into
  `_site/`, which git and ESLint ignore; `.github/workflows/pages.yml` publishes that folder. Locally:
  `pnpm site` with `GITHUB_REPOSITORY=owner/name` set (or `node scripts/site.mjs --repository owner/name`), and
  `pnpm site:dev` for Vite's server.
- **Partials and placeholders**: `site/partials/` holds `document`, `head`, `nav`, `footer` and `mark`. A plugin of
  `scripts/site.mjs` (`transformIndexHtml`, `order: 'pre'`) takes each entry, puts the partials in place with
  `expand`, then the page's values with `fill`. Two passes on purpose: partials are ours and nest (`nav` holds
  `{{mark}}`), so `expand` repeats, at most three rounds, and fails on a partial that includes itself; values are
  filled once, so a `{{…}}` inside a markdown text stays as it is. A placeholder without a value stops the build,
  naming the entry.
- **The two legal entries are one line each**, `{{document}}`: Vite needs a file per page, and the line keeps them
  from being two copies of one shell. `document.html` is that shell.
- **Built from the markdown by a script of our own** (D1, 069), so `PRIVACY.md` stays the one text that GitHub shows
  in the repository and the site serves. `scripts/site.mjs` parses with `mdast-util-from-markdown` and its GFM
  extension, which the app already depends on, and writes the HTML through a map of handlers by node type, as
  `src/lib/markdown.ts` does; it does not import that file, which is TypeScript for the WebView. Rejected in 069:
  Jekyll (no files from outside its folder, or every markdown file of the repository from the root), GitHub's markdown
  API (the network at build time), `remark` and `rehype` (new dependencies for two pages), HTML committed next to the
  markdown (two copies of every change).
- **What markdown it takes**: headings, paragraphs, emphasis, strong, inline code, code blocks, line breaks, rules,
  lists and links. Anything else (a table, an image, strikethrough, a task list, raw HTML) stops the build with the
  file and the line, so a page never shows markdown as literal text and no raw HTML reaches the site. All text is
  escaped. A document's title is its `#` heading and "Cornercase remote"; its description, its first paragraph.
- **Links stay as GitHub reads them**: the markdown links relatively, and the script resolves every link against the
  file's place in the repository. A link to `PRIVACY.md` or `SUPPORT.md` becomes a relative link to its folder; any
  other becomes an absolute link to GitHub. A link with a `#fragment` to one of the pages, an absolute link that is
  not `https`, a link from the root and a link with a title stop the build. 072 removed `site/index.md`, so a markdown
  link can no longer target the home by file; the partials link it as `{{root}}`.
- **The repository comes from `GITHUB_REPOSITORY`**, which GitHub sets in every job, or from `--repository`; with
  neither, the script stops and says so, in both modes. So no source names the owner.
- **URLs with a folder** (D2): `/privacy/` and `/support/`, each an `index.html`: shorter to type into App Store
  Connect, and the address says nothing about what the page is made of.
- **`SUPPORT.md` at the root** (D3): GitHub links a repository's `SUPPORT.md` to whoever opens an issue, so one text
  serves both. It and the site say "your computer (Linux or macOS)", never a Mac; `scripts/wording.test.ts` reads
  every `.html` under `site/`.

## Vite, not Astro

- **Vite builds the site** (072), with `build()` from its API and `configFile: false`, so the app's `vite.config.ts`
  stays the app's. It was already a dependency. Checked with the repository's Vite 8.3.6 before it was chosen: `base:
  './'` writes `./assets/…` from `/` and `../assets/…` from `/privacy/`; an `<img>` or `<link rel="icon">` pointing
  outside the root (`../store/…`, `../src-tauri/…`) and a CSS `@import` of a file outside it are taken into
  `assets/`; a classic script from `site/public/` comes out relative.
- **Astro, which gpui's and cornercase's sites use, was rejected**: its `assetsPrefix: '.'` is right for gpui's one
  page and wrong from `/privacy/`, and it brings `astro`, `@astrojs/check` and a `.astro` file kind that
  `scripts/check-rules.mjs` would have to learn to read for comments, where HTML, CSS and TypeScript are already read.
  The cost of Vite: the pages are HTML with placeholders, not components.
- **The configuration**: `root: site/`, `base: './'`, the three entries as `rollupOptions.input`,
  `assetsInlineLimit: 0` (a `data:` URL would need `data:` in the CSP), `cacheDir` in `node_modules/.vite-site` so
  the site's dev server does not share the app's, and `server.fs.allow` on the repository.
- **One style sheet per page**: `landing.css` and `prose.css` each `@import` `base.css`. Linked as two sheets, Vite put
  the landing's own CSS before the shared one, against the cascade.
- **The dev server** (`--dev`): the same plugin, plus two things only it needs. Files outside `site/` (the screenshots,
  the icon) are asked for at `/store/…` and `/src-tauri/…`, which Vite's server does not map outside its root, so a
  middleware redirects a file of the repository that `site/` lacks to `/@fs/…`, where Vite serves it within
  `fs.allow`. And the dev pages' CSP adds `script-src 'self'; connect-src 'self'`, for Vite's client and its socket.
  The build never gets either.

## The look

- **cornercase-gpui's site** (`usecornercase/cornercase-gpui`, `site/`, at `dc019a7`, live at
  `gui.usecornercase.dev`): its nav of glass, its type scale, its hero of letters that rise and squeeze, its chapters
  pinned while a subject moves beside the caption, its closing section, its footer and its `max-width: 980px` layout.
  Not taken: its WebGL field, its window drawn in HTML, its sheets, OS detection and the GitHub API call.
- **The app's colours and nothing else**: `site/styles/base.css` imports `src/lib/theme/tokens.css`, and the style
  sheets write no `#hex`, `rgb()` or `hsl()`. gpui's literals map to tokens (`--ground` to `--glass`, `--text-2` to
  `--soft`, `--brand-ink` to `--accent`, its cobalt gradient to `--brand-light` and `--brand`), and its translucent
  colours to `color-mix(in srgb, <token | white | black> N%, transparent)`. The one literal is the `theme-color` meta,
  which a test ties to `--glass`. Site variables (`--site-font`, `--expo`, `--gutter`, `--phone`, `--primary`) live
  in `base.css`'s `:root`.
- **Archivo** (`@fontsource-variable/archivo`, its `wdth` file): gpui's face, with the width axis that the titles
  animate; self-hosted, so the page asks nothing of another origin. Rejected: JetBrains Mono too (the site draws no
  terminal; the app's mono stack serves the few `kbd`), a font CDN (a third party, against the CSP), the font files
  committed. The app keeps system fonts (`design/look.md`).
- **Dark only** (072): 069's light palette went. gpui's site is dark only, the landing's glass, glow and screenshots
  are dark, and one site should not have two looks. The dark contrasts measured on 2026-11-17 still hold on the
  ground (`--text` 16.83, `--soft` 10.23, `--accent` 7.85); on a card's `--raised` they are 14.05, 8.54 and 6.55, and
  `--muted`, the small print, 6.23 and 5.20, all above AA's 4.5.
- **Glass is written unprefixed only**: `backdrop-filter`, and the minifier (lightningcss under Vite's default
  targets) adds `-webkit-backdrop-filter` for Safari. A rule that declared both lost the unprefixed one to the
  minifier, which folded the pair into the prefixed property that Chrome and Firefox ignore; a test reads the built
  CSS for it.
- **Smooth scrolling to an anchor** only under `prefers-reduced-motion: no-preference`, and not while the motion
  runs, whose script follows the native scroll.
- **A wash of `--brand` at 26 %** at the top of the viewport, fixed, on every page, and a glow that follows the phone.
  No GPU field: gpui's fluid is about 800 lines of WebGL for a background, and here the phone is the subject.

## The landing

- **Hero, six chapters, What it needs, Get the app, footer.** The copy restates `store/app-store/en-US/description.txt`,
  `store/app-store/review/notes.txt` and `SUPPORT.md`, and adds no claim: cornercase 0.13.78 or later on the computer
  (Linux or macOS, the version of `contract.rs`'s `SINCE`, which a test reads), the same network or Tailscale, no
  account and no sign-in, a link to `https://usecornercase.dev` to install cornercase, pairing from Settings › Remote
  › Phone app, and Try a demo.
- **The phone is a frame in CSS** around the real screenshots, sized by `--phone`: a rounded body with an edge, a
  screen of the screenshots' ratio (1320 × 2868), and a black island drawn over the room the screenshots leave for
  it. Rejected: Apple's device art, which comes with its own rules.
- **The screenshots are read from `store/app-store/screenshots/iphone-6.9/`**, so the listing and the site cannot
  drift; `pages.yml` rebuilds when they change. They stay PNG, 1.2 MB for the six, each fetched once. Rejected: WebP
  copies, two sets to keep or `sharp` as a dependency.
- **The badges**: Apple's black "Download on the App Store" badge (en-US), unmodified, from
  `tools.applemediaservices.com` on 2026-11-25, linking `https://apps.apple.com/app/id6835431973`, with a quarter of
  its height of clear space and nothing on it but the focus ring; the footer carries the trademark line. Google Play
  is words in a badge-shaped outline, "Coming soon on Google Play", not a link and with no Google artwork: Play is in a
  closed test, and Google's badge is for an app that is there.

## The motion

- **Everything is a function of the smoothed scroll** (gpui's `Scroll`): native scrolling, no wheel hijack, and
  scrolling back plays it backwards. The hero is 230lvh and each chapter 200lvh, each with a pin of 100svh.
- **One fixed phone moved by a camera**: `site/src/client/camera.ts` keys a shot to `scroll.at(section, progress)`;
  `site/src/lib/track.ts` turns a shot into a pose (where, how big, how turned) and blends between keys. The phone's
  size is measured from the element, so CSS stays the one place that states it. It peeks under the hero's note
  without covering the badges, rises upright, then sits opposite each caption, turned a little towards it, and leaves
  before What it needs reaches the middle of the screen.
- **The screen changes between chapters, never under a caption**: from 0.97 of a chapter to 0.05 of the next, as the
  app pushes a screen, the new one slides in from the right over the old, which moves 30 % left and dims to half.
- **Wide or narrow comes from the style sheets' own media query**: `track.ts` exports `NARROW_QUERY`, `(max-width:
  980px)`, which a test ties to every `980` query of the CSS, and `Scroll` reads it with `matchMedia` on each measure.
  A width compared by hand disagreed with the CSS at exactly 980 px, and on systems with classic scrollbars, where
  `clientWidth` leaves the scrollbar out and a media query does not (gpui has the same mismatch). The width stays the
  geometry's.
- **On a narrow screen** (980 px and under) the caption is a glass sheet at the bottom, and the phone is sized by its width
  (86 % of the area above the sheet) so the app's text stays readable. It is taller than that area, so a `focus` per
  chapter says which part of the screenshot sits in view, and the phone pans down slowly through the chapter (chat
  down to its options and keys).
- **The hero's letters** rise one after the other at load and widen from 62 % to 112 %; they squeeze away as the phone
  rises. The script splits the title into letters, with the whole title as its `aria-label`. The nav drops in, the
  phone rises into its peek, and a reload mid-page skips all of it.
- **Captions, What it needs and Get the app** fade and rise in as they enter; titles widen as gpui's do.
- **Without motion, the same page flows**, each chapter with its own still phone: with `prefers-reduced-motion`,
  without JavaScript, on a viewport under 480 px tall (a phone on its side; gpui's limit is 300), and when the script
  fails or has not started 4 s after the first paint. `site/public/boot.js` decides before the first paint, as a file
  and not inline, which the CSP would need a hash for; `main.ts` sets `data-alive`, which the 4 s check reads. Reduced
  motion turned on, a resize under 480 px or an exception in a frame fall back for good, removing every inline style.
  The stage's six images are lazy, so the plain page does not fetch them; the script makes them eager.

## Security and URLs

- **A CSP per page**: `default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'`, and the landing alone
  adds `script-src 'self'`. No inline style or script anywhere: the script sets styles through
  `style.setProperty`, which the CSP allows, and never a `style` attribute. `no-referrer` on every page.
- **Every URL the build writes is relative**, at both depths, so a custom domain (`mobile.usecornercase.dev`, later)
  only needs its CNAME. Only the canonical link and the `og:` and `twitter:` tags are absolute, from `SITE_URL`, which
  the workflow takes from `actions/configure-pages`' `base_url`; without it the build writes none. After a change of
  domain, run the workflow by hand so they catch up.
- **`site/public/og.png`** (1200 × 630) is a shot of the built hero with reduced motion in headless Chrome, retaken by
  hand when the hero changes, as gpui's is.

## The workflow

- **`.github/workflows/pages.yml`** runs on a push to `main` that touches the site's sources (the two markdown files,
  `site/`, `scripts/site.mjs`, `tokens.css`, the screenshots, the icon, `package.json`, `pnpm-lock.yaml` and itself)
  and by hand. `build` sets up the tools as `ci.yml` does, with the same versions, installs, runs `configure-pages`
  (for `base_url`), then `node scripts/site.mjs` with `SITE_URL`, then `upload-pages-artifact`; `deploy` runs
  `deploy-pages`. `scripts/site.test.ts` checks the versions, the paths and the order.
  - Permissions per job, none at the top: `build` gets `contents: read` and `pages: read`, `deploy` `pages: write` and
    `id-token: write`, so `pnpm install` never holds a token that can publish.
  - Concurrency `pages` without cancelling. No `.nojekyll`: Jekyll does not run when Actions deploys.
- **Only `main` deploys**: the `github-pages` environment allows the default branch only, so the first look at a
  change is the merge's. Pull requests build the site anyway, in CI's vitest. The site is
  `https://usecornercase.github.io/cornercase-mobile/`.

## The checks

- `scripts/check-rules.mjs` and ESLint already read `site/` (HTML, CSS, TypeScript, JavaScript): no comments, 1,000
  lines, 40 lines a function. The client is small classes for that reason, where gpui's `main.ts` is one long function.
- `tsconfig.json` takes `site/src/**/*.ts`, so `pnpm check` type-checks the site; vitest takes `site/**/*.test.ts`
  (the pure `math.ts` and `track.ts`); jscpd reads `site/`.
- `scripts/site.test.ts` builds the real site once per block and checks the pages, the relative URLs, the CSP, the
  badges, the six screenshots, the copy against `contract.rs`, the mark against `icon.svg`, the colours against the
  tokens and the workflow.

## Checked

- On 2026-11-25, with Node 22, Vite 8.3.6 and Chrome 158 headless through Playwright, against the built site served
  from a subfolder: at 1440 × 900, 390 × 844 and 320 × 568, with motion and with reduced motion, the intro, the
  phone through every chapter and the push between screens, the narrow sheet, the plain page with a still phone per
  chapter, no horizontal scroll (`scrollWidth` equal to the width) and an empty console on the three pages. The two
  legal pages at 1440 and 320 wide. `pnpm site:dev` serves the three pages with their images.
- Not checked: Safari and Firefox, a real phone, the workflow on GitHub and the URLs answering 200, which come with
  the merge.
