# Releases

Code: `.github/workflows/release.yml`, `scripts/ios-release.sh`, `scripts/versions.test.ts`, `CHANGELOG.md`, and `src-tauri/gen/apple/project.yml` for the device family and the encryption key; for the site, `site/`, `scripts/site.mjs`, `scripts/site.test.ts`, `SUPPORT.md` and `.github/workflows/pages.yml`; for the App Store listing, `store/app-store/` and `scripts/store.test.ts`.

How a version becomes an Android APK on a GitHub Release and an iPhone build in TestFlight (0.1.0, 060). Android is built and signed by a workflow; iOS by a script on a Mac. Publishing stays a person's job: the workflow makes only a draft, and the script is run by hand. The privacy and support pages that the stores ask for are a small site on GitHub Pages, built from the repository's markdown on every change to `main` (069).

Topics, in `design/releases/`:

- [The App Store listing](releases/app-store.md) (`store/app-store/`, `scripts/store.test.ts`): one JSON file per group of App Store Connect API resources and the texts in `.txt`, why not fastlane `deliver`, the OpenAPI version, what is left `null`, 4+ and why, the copyright, free everywhere, a machine and not a Mac, guideline 2.3.10, `whatsNew`, the screenshots from the demo on a simulator of their own (English, the Dynamic Island, no alpha, no frames), the recording as a review attachment, the test, and that nothing was applied in App Store Connect.

## The version

- **One version, in four places**: `package.json`, `src-tauri/tauri.conf.json`, `[package]` of `src-tauri/Cargo.toml` and the first `## <version>` of `CHANGELOG.md`. `scripts/versions.test.ts` fails when they differ, so a release that bumps one and forgets another fails in its pull request rather than at the tag. `crates/core` has a version of its own that nothing publishes or checks.
- **`CFBundleShortVersionString` and `CFBundleVersion` in `src-tauri/gen/apple`** (`project.yml` and `Info.plist`) also say `0.1.0`, as `tauri ios init` wrote them, and stay as they are: they do not rule. `tauri ios build` overwrites both in `Info.plist` from `tauri.conf.json` and the build number before Xcode builds, and the script restores the folder afterwards, so after a bump they keep the old number without harm. The test leaves them out for that reason: checking them would add two places to edit by hand on every release for values nothing reads.
- **`tauri.conf.json` is the one the stores show**: Tauri writes it to `CFBundleShortVersionString` on iOS and to `versionName` on Android, and derives Android's `versionCode` from it (major × 1,000,000 + minor × 1,000 + patch, so 0.1.0 is 1000). Android refuses an update whose `versionCode` is not higher, so every release needs a new version.
- **The tag is `v<version>`**: the workflow compares it with `tauri.conf.json` before building and fails on a mismatch.

## CHANGELOG

- **A `## <version>` section per release, written for users**: the workflow cuts it out of `CHANGELOG.md` with `awk` and makes it the notes of the GitHub Release, and fails when the section is missing or empty. The same habit as cornercase-terminal, whose sections are also its release notes.

## Android

- **The trigger**: pushing a `v*` tag builds, signs and attaches the APK to a **draft** GitHub Release. A person then reads the notes, tries the APK (the scanner first, `architecture/android.md` › The release build) and publishes it. A draft is safer than a release that people can download before anyone has opened it. `workflow_dispatch` builds and signs the same way but only uploads the APK as an artifact (`cornercase-<version>-apk`), without a Release: this tries the secrets and the whole pipeline before tagging.
- **One universal APK for `aarch64` and `armv7`**, `cornercase-<version>.apk`: one file to download for every phone, which is what installing by hand from a Release needs. `x86` and `x86_64` are left out (emulators and a few Chromebooks). The `armv7-linux-androideabi` target is added by the workflow only, so `ci.yml` downloads no more targets (`architecture/android.md` › Targets). No AAB: there is no Play Store listing yet.
- **`zipalign -P 16 -f 4`, then `apksigner`**: `-P 16` aligns the native libraries to 16 KB pages, which Android 15 phones with 16 KB pages need to load them, and the alignment goes first because the v2 and v3 signatures cover the whole file. `zipalign -c -P 16 -v 4` on the signed APK still passes.
- **`apksigner`, not a Gradle `signingConfig`**: `src-tauri/gen/android` stays as `android init` wrote it, and the keystore never goes near the Gradle project. The workflow decodes it into `$RUNNER_TEMP`, outside the checkout and never in `src-tauri/gen/android`, and removes it in a step that runs even after a failure.
- **The secrets**: `ANDROID_KEYSTORE_BASE64` (the keystore in base64), `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS`. They reach only the signing step, through `env:`, and the password reaches `apksigner` as `--ks-pass env:ANDROID_KEYSTORE_PASSWORD`, never on a command line.
- **Making the keystore**, once, on a Mac, outside the repository:
  - `keytool -genkeypair -v -storetype PKCS12 -keystore cornercase-release.keystore -alias cornercase -keyalg RSA -keysize 4096 -validity 10000`.
  - PKCS12 keeps one password for the store and the key, which is why the workflow passes no `--key-pass`. A keystore with a separate key password would need it.
  - `base64 -i cornercase-release.keystore | gh secret set ANDROID_KEYSTORE_BASE64`, then `gh secret set ANDROID_KEYSTORE_PASSWORD` (it asks for the value) and `gh secret set ANDROID_KEY_ALIAS --body cornercase`.
  - Keep the keystore and its password backed up outside the repository. Android installs an update only when it is signed with the same key, so losing the key means users have to uninstall the app, and lose its machines, to install the next APK.
- **No caches**: the job restores neither `Swatinem/rust-cache` nor `setup-node`'s pnpm cache. A workflow that signs and publishes should not run what another workflow saved, and the pnpm cache would be the one `ci.yml` saves while it runs pull requests' code. Nor would they save time: rust-cache's key holds the job's id, so it never reads `ci.yml`'s, and a cache saved from a tag is seen only by that tag, so each release would save one nobody reads.
- **The token stays out of the checkout**: `actions/checkout` runs with `persist-credentials: false`, because the job holds `contents: write` while it runs third-party code (`pnpm install`'s scripts, the crates' `build.rs`, Gradle's plugins). `gh` gets the token through `GH_TOKEN` alone. The workflow's default permission is `contents: read`; only the `android` job asks for `write`, which a job added later does not inherit.
- **The secrets are checked first**: a step right after the tag's checks fails with the name of any of the three that is empty (in a fork, or before they are created), instead of `apksigner` failing on an empty keystore after the whole build.
- **The versions** of the build tools, the NDK and JDK 17 (temurin) match the local setup in `CLAUDE.md`. Unlike `ci.yml`, the job installs no WebKitGTK: the Android build does not link it.

## iOS

- **Not in CI**: macOS runners cost about ten times the minutes of Linux ones, and signing in CI would put the App Store Connect API key into the repository's secrets for a step that runs a few times per release. `scripts/ios-release.sh` signs on the Mac of whoever releases, with the key there. Worth looking at again if releases become frequent.
- **The API key**: App Store Connect › Users and Access › Integrations › App Store Connect API, with the App Manager or Admin role. Apple lets you download the `.p8` file only once, named `AuthKey_<key ID>.p8`; keep it outside the repository, such as in `~/.appstoreconnect/private_keys/`.
- **Running the script**, from any folder of the repository: `APPLE_API_KEY=<key ID> APPLE_API_ISSUER=<issuer ID> APPLE_API_KEY_PATH=<path to AuthKey_<key ID>.p8> scripts/ios-release.sh`, with `BUILD_NUMBER=<n>` when needed; `--help` explains it. It checks the three variables and the key's file name, builds with `pnpm tauri ios build --export-method app-store-connect --ci` (whose `beforeBuildCommand` runs `pnpm build`), and uploads with `xcrun altool --upload-app`. Apple then processes the build for some minutes before it shows in TestFlight.
- **Signing**: the Tauri CLI reads the three `APPLE_API_*` variables and lets Xcode sign automatically with the key, making or fetching the distribution certificate and profile for team `22FWTVV94S`.
- **The upload**: `altool` finds the key by its file name, `AuthKey_<key ID>.p8`, in `API_PRIVATE_KEYS_DIR`, which the script sets to the key's folder; that is why the script refuses another name. Xcode 27.2's `altool` (27.10.4) still has `--upload-app`, and its help spells the options `--api-key` and `--api-issuer`. Rejected: fastlane, a Ruby toolchain for one command; the Transporter app, which is manual.
- **The build number**: App Store Connect refuses a second upload with the same `CFBundleVersion`. The script passes `BUILD_NUMBER`, or by default the time as `YYYYMMDDHHMM`, which always grows and keeps no state in the repository, as `--config '{"bundle":{"iOS":{"bundleVersion":"<n>"}}}'`. That sets `CFBundleVersion` only, and the version people see stays `tauri.conf.json`'s. Rejected: `--build-number`, which Tauri appends to the version (`0.1.0.<n>`, four numbers, where Apple allows three). Two uploads within the same minute need a `BUILD_NUMBER`.
- **`src-tauri/gen/apple` comes back as it was**: the build rewrites files git tracks (`ExportOptions.plist` to `app-store-connect`, the build number and the final newline of `Info.plist`, `DEVELOPMENT_TEAM` in `project.pbxproj`, the scheme). The script refuses to start while that folder has uncommitted changes or untracked files and runs `git checkout -- src-tauri/gen/apple` when it ends, after a failure too. Rejected: printing what to revert, which leaves a release build's `ExportOptions.plist` or build number one forgotten step away from a commit. The committed `ExportOptions.plist` stays `debugging`.
- **Where the `.ipa` lands**: `src-tauri/gen/apple/build/arm64/cornercase.ipa` with Tauri CLI 2.12.4. The script takes the one `.ipa` under `build/` newer than its own start rather than that path, since an older build left one at `build/cornercase.ipa`.
- **`llvm-tools` is needed on Xcode 27**, and the script refuses to start without it: without `rustup component add llvm-tools`, the release build fails to link with undefined `_init_plugin_keyboard`, `_init_plugin_network` and `_init_plugin_photos`. swift-rs needs `llvm-objcopy` to keep the plugins' `@_cdecl` functions visible, and says so in a warning. Debug builds link without it. It is not in `rust-toolchain.toml`, because only this build needs it and CI would download it on every run.

## iPhone only

- **`TARGETED_DEVICE_FAMILY` 1, and no `UISupportedInterfaceOrientations~ipad`** (`project.yml`, decided on 2026-11-15): App Review would otherwise test the app on an iPad and ask for iPad screenshots, where the phone's layout shows stretched. On an iPad it still installs, in iPhone compatibility mode. The iPad and tablets come with 062. Android has no such switch for an APK: a tablet gets the phone's layout.

## Export compliance

- **`ITSAppUsesNonExemptEncryption` is `false`** (`project.yml` › `info.properties`), so App Store Connect stops asking about encryption for every build before TestFlight. The app carries no encryption that export rules cover: its connection to cornercase is `ws://` in clear, with Tailscale encrypting it on its own when that is the route; ed25519 only signs, to authenticate, which is exempt; secrets at rest are sealed by the system's Keychain and Keystore. Revisit it if the app ever encrypts data with its own code.

## App Store Connect

- **The app**: "Cornercase remote", Apple ID 6835431973, SKU `cornercase-mobile`, primary language en-US, bundle ID `dev.usecornercase.mobile`, team `22FWTVV94S` (the paid Apple Developer Program). The name under the icon is "Cornercase" (decided by the user on 2026-11-16): `CFBundleDisplayName` in `project.yml` › `info.properties` on iOS, `app_name` and `main_activity_title` in `res/values/strings.xml` on Android. `productName` stays "cornercase", since it also names the binaries and the bundles.
- **The privacy policy** is `PRIVACY.md`. External TestFlight testing and the App Store need it at a public URL: `https://usecornercase.github.io/cornercase-mobile/privacy/`, the site's (The site).
- **The support page** is `SUPPORT.md`, at `https://usecornercase.github.io/cornercase-mobile/support/`, the Support URL that the App Store asks for with every version.
- **The user puts both URLs into App Store Connect by hand**: no script or workflow writes to it. They change again with the custom domain (The repository's URLs).
- **The listing** lives in `store/app-store/`, in a form the API applies as it is, with its `README.md` saying how and what is still missing (The App Store listing).

## App Review

- **The demo is the way in** (064, `demo.md`): the app does nothing without a computer running cornercase, and App Review (guideline 2.1) has to see it work. The notes for the reviewer in App Store Connect › App Review Information say so, and `Sign-in required` stays off, since there is no account. Their text is `store/app-store/review/notes.txt`, with a recording of the way in attached (The App Store listing).
- **The screenshots** come from the demo too: its sample is fictional and in English, made for them. They are in `store/app-store/screenshots/iphone-6.9/` and the recording in `store/app-store/review/demo.mp4` (The App Store listing).

## The site

- **Three pages on GitHub Pages**: a short home at `/`, the privacy policy at `/privacy/` and support at `/support/`, which App Store Connect asks for (069). Their text is `site/index.md`, `PRIVACY.md` and `SUPPORT.md`; `site/page.html` is the template the three share and `site/site.css` their style sheet. `scripts/site.mjs` writes them to `_site/`, which git and ESLint ignore, and `.github/workflows/pages.yml` publishes that folder. Locally: `node scripts/site.mjs --repository owner/name`.
- **Built from the markdown by a script of our own** (D1), so `PRIVACY.md` stays the one text that GitHub shows in the repository and the site serves. `scripts/site.mjs` parses with `mdast-util-from-markdown` and its GFM extension, which the app already depends on, and writes the HTML through a map of handlers by node type, as `src/lib/markdown.ts` does; it does not import that file, which is TypeScript for the WebView. No new dependency. Rejected:
  - Jekyll, Pages' own build: from a folder it takes no files from outside it, so `PRIVACY.md` at the root would need a copy, and from the root it would publish every markdown file of the repository; it also brings a theme of its own and Ruby.
  - GitHub's markdown API: the network at build time, for HTML that still needs a page around it.
  - `remark` and `rehype`: new dependencies for three pages.
  - HTML committed next to the markdown, with a test that they match: two copies of every change.
- **What markdown it takes**: headings, paragraphs, emphasis, strong, inline code, code blocks, line breaks, rules, lists and links, which is what the three pages use. Anything else, such as a table, an image, strikethrough, a task list or raw HTML, stops the build with the file and the line, so a page never shows markdown as literal text and no raw HTML reaches the site. GFM is parsed so that what GitHub renders as a table fails rather than turning into a paragraph of pipes. All text is escaped.
- **Links stay as GitHub reads them**: the markdown links relatively, and the script resolves every link against the file's place in the repository, `https://github.com/<owner>/<name>/blob/main/<file>`. A link to one of the three pages becomes a relative link to its folder (`PRIVACY.md` from `/support/` is `../privacy/`); any other becomes an absolute link to GitHub (`../../issues/new` is the repository's new issue). The headings have no `id`, so a link with a `#fragment` to one of the pages stops the build rather than opening the page at the top; a link to GitHub keeps its fragment, which GitHub does serve. An absolute link that is not `https` also stops the build, as do a link from the root (`/x`, which GitHub reads from the repository's root and the site from the host's) and a link with a title, which the site would lose.
- **The repository comes from `GITHUB_REPOSITORY`**, which GitHub sets in every job and does not let a workflow override, or from `--repository owner/name`; with neither, the script stops and says so. So no source names the owner, and the move to usecornercase changes none of them.
- **URLs with a folder** (D2): `/privacy/` and `/support/`, each an `index.html`, rather than `privacy.html`: shorter to type into App Store Connect, and the address says nothing about what the page is made of.
- **`SUPPORT.md` at the root** (D3): GitHub links a repository's `SUPPORT.md` to whoever opens an issue, so one text serves both. It calls the computer that runs cornercase a machine, the app's word, and "your computer (Linux or macOS)" to someone new, never a Mac (decided by the user on 2026-11-17). `PRIVACY.md`, `README.md` and the app's texts say the same since 070, and `scripts/wording.test.ts` checks `SUPPORT.md` and the site's own text with them; the reviewer's notes in App Review are 065's.
- **The page**: `site/page.html` fills `{{root}}`, `{{title}}` and `{{content}}`, and a key without a value stops the build. It has `lang="en"`, a Content Security Policy of `default-src 'none'; style-src 'self'` (the site has no scripts, fonts or images), `no-referrer`, and a header that links the three pages. A page's title is its `#` heading and "Cornercase remote"; the home's heading is the name, which it does not repeat.
- **The look** (D4): `src/lib/theme/tokens.css` is copied as it is, so the dark site has the app's colours, radii, spacing and fonts, and `site/site.css` uses only its variables. The wash of `--brand` at 12 % and the visible focus follow `src/lib/theme/base.css`, which the site does not import: it turns off text selection and carries rules of the app's own.
- **A light palette of the site's own**: the app is dark only, while the site follows the phone's setting (`color-scheme` and `prefers-color-scheme`). In light it overrides six colours and nothing else, inverting the background and the text and keeping cobalt; its accent is the app's `--brand-hover`:

  | Token | Dark (the app's) | Light |
  |---|---|---|
  | `--glass` | `#0b0c0e` | `#f7f8fa` |
  | `--panel` | `#ffffff0a` | `#0000000a` |
  | `--border` | `#ffffff17` | `#0000001f` |
  | `--text` | `#eceef1` | `#16181c` |
  | `--soft` | `#b6bcc4` | `#474d56` |
  | `--accent` | `#74a3ff` | `#0050d8` |

- **Contrast**, WCAG's ratio, measured on 2026-11-17 on the background, under the wash where it is strongest and on the panel behind code; the lowest is 5.30:1, above the 4.5:1 that AA asks of body text:

  | Theme | Text | Background | Wash | Code |
  |---|---|---|---|---|
  | Dark | `--text` | 16.83 | 15.55 | 15.64 |
  | Dark | `--soft` | 10.23 | 9.45 | 9.51 |
  | Dark | `--accent` | 7.85 | 7.25 | 7.30 |
  | Light | `--text` | 16.73 | 14.07 | 15.35 |
  | Light | `--soft` | 8.02 | 6.75 | 7.36 |
  | Light | `--accent` | 6.30 | 5.30 | 5.78 |

- **The workflow**, `.github/workflows/pages.yml`, runs on a push to `main` that touches the site's sources (the three markdown files, `site/`, `scripts/site.mjs`, `tokens.css`, `package.json`, `pnpm-lock.yaml` and itself) and by hand with `workflow_dispatch`. `build` sets up the tools as `ci.yml` does, with the same versions, installs, runs `node scripts/site.mjs`, then `configure-pages` and `upload-pages-artifact`; `deploy` runs `deploy-pages`. `scripts/site.test.ts` checks the versions against `ci.yml` and that the paths name every source.
  - Permissions, per job, with none at the top: `build` gets `contents: read` and `pages: read`, which `configure-pages` needs to read the Pages site, and `deploy` gets `pages: write` and `id-token: write`, which `deploy-pages` needs to prove where it runs. So `pnpm install`, whose packages run scripts of their own, never holds a token that can publish. First tried on the merge's deploy, since only `main` deploys.
  - Concurrency `pages` without cancelling: a deploy that has started finishes, and the next one waits.
  - No `.nojekyll`: Jekyll does not run when Actions deploys. `upload-pages-artifact` leaves out hidden files, and the site has none.
  - The Pages actions are at their latest major versions on 2026-11-17 (`configure-pages` 6, `upload-pages-artifact` 5, `deploy-pages` 5); Dependabot updates them with the rest.
- **Only `main` deploys**: the `github-pages` environment that GitHub creates with Pages allows the default branch only, so a pull request cannot publish, and the first deploy is the merge's. Pages was turned on before that merge, on 2026-11-17, through the API (`POST /repos/{owner}/{repo}/pages` with `build_type: workflow`, the Actions source, authorised by the user), since the deploy fails while Pages is off. The site is `https://usecornercase.github.io/cornercase-mobile/`.

## The repository's URLs

- **The repository lives at `usecornercase/cornercase-mobile`**: it moved there from `MiguelHang/cornercase-mobile` on 2026-11-23, before the first App Store submission (decided by the user). Nothing names it: `README.md`, `CHANGELOG.md` and `PRIVACY.md` link relatively (`PRIVACY.md`, `../../releases/latest`, `../../issues`), as do `SUPPORT.md` and `site/index.md`; `release.yml` uses `github.repository` and `gh`'s defaults, and the site's script `GITHUB_REPOSITORY`. Pages and the three Android secrets moved with it; the local remote is changed by hand.
- **Absolute URLs to the repository: none** (`git grep -l "github.com/[A-Za-z]*/cornercase-mobile"` on 2026-11-23 finds nothing).
- **The site's URLs name the owner, here and in the App Store listing**: `https://usecornercase.github.io/cornercase-mobile/privacy/` and `/support/`, written into App Store Connect by hand, and into `store/app-store/app-info.json` and `version.json`, which `scripts/store.test.ts` ties to these two. A move does not redirect Pages: `miguelhang.github.io/cornercase-mobile/` answered 404 right after it. So the move came before the listing went into App Store Connect.
- **A custom domain later, `mobile.usecornercase.dev`** (decided by the user on 2026-11-23), so that the listing's URLs no longer depend on where the repository lives: a `CNAME` from `mobile` to `usecornercase.github.io` in the domain's DNS, the domain verified for the organisation, then set as the Pages site's domain with HTTPS enforced, which `.dev` requires. Once set, GitHub redirects the `github.io` URLs to it, so the listing keeps working and takes the new URLs with its next version. Not done for 0.1.0, so that the submission waits on no one's DNS. Rejected: a custom domain before the submission, for that wait.

## Checked live

- On 2026-11-16, on macOS with Tauri CLI 2.12.4, Xcode 27.2, build-tools 37.0.0 and NDK 29.0.14206865:
  - `actionlint` 1.7.12 passes `release.yml`.
  - The Android build for `aarch64` and `armv7` leaves the unsigned universal APK at the workflow's path, with both ABIs inside, and rewrites nothing git tracks.
  - Aligning and signing with the workflow's commands and a test PKCS12 keystore sent through base64, as the secret is, works: `apksigner verify` reports v2 and v3, and the 16 KB alignment holds.
  - The `awk` cuts 0.1.0's section, with BSD `awk`.
  - `scripts/ios-release.sh` passes shellcheck 0.11.0, and fails as intended with each variable missing, a wrongly named key and a bad build number. A run with stand-ins for `pnpm` and `xcrun` restored `gen/apple` after a success and after a failure.
  - An unsigned `tauri ios build` with the script's `--config` gave an `.ipa` whose `Info.plist` has the build number in `CFBundleVersion`, `0.1.0` in `CFBundleShortVersionString`, `UIDeviceFamily` `[1]` and `ITSAppUsesNonExemptEncryption` `false`.
- Not checked:
  - The workflow on GitHub: the runner's `sdkmanager` and licences, the job without system packages, `gh release create`, `upload-artifact` and the real secrets. The first try is a `workflow_dispatch` once the secrets exist.
  - The runner's `awk` (mawk); the script is plain POSIX `awk`.
  - The signed APK on a phone or in the emulator.
  - `tauri ios build` writing `CFBundleShortVersionString` into `Info.plist` from a version other than `0.1.0`: every build so far had `0.1.0` in both. The CLI 2.12.4 binary holds the code for it (its warning about stripping a prerelease tag from `CFBundleShortVersionString`), and `CFBundleVersion` was seen rewritten.
  - Signing with the API key, the `app-store-connect` export, the upload, and App Store Connect taking a 12-digit build number.
- On 2026-11-17, for the site, with Node 22 and actionlint 1.7.12:
  - `actionlint` passes `pages.yml`, and the Pages actions' latest releases were read with `gh api repos/actions/<action>/releases/latest`.
  - `node scripts/site.mjs --repository owner/name` writes the three pages and the two style sheets to `_site/`, which `git status` does not list, and resolves `SUPPORT.md`'s links to `../privacy/` and to the repository's new issue on GitHub.
  - The three pages at 320 px wide, in light and in dark, in headless Chrome: nothing overflows the width, and both themes read as The site describes. The contrasts were computed from the colours, with WCAG's formula.
- Not checked for the site, until the merge deploys it: the workflow on GitHub and the two URLs answering 200, which a `curl` of each confirms after the merge.
- `apksigner` also writes a v4 signature, `cornercase-<version>.apk.idsig`, next to the APK; the workflow does not upload it.
