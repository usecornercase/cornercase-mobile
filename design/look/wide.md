# Wide windows

A topic of [Look](../look.md): the iPad and Android tablets (task 062, issue 71), two panes, the widths of the
screens, the wide terminal, a hardware keyboard and a pointer, the close confirmation as a popover.

## One pane or two

- **Two panes from 720 CSS px of width, by the window's width alone** (`src/lib/layout.svelte.ts`: `WIDE`, `twoPanes`,
  `Layout`, watched once by `App` on `resize`). 720 is a side of 320 px plus a detail of 400, a phone's width, so every
  screen of the detail already fits. It puts iPad portrait (744–1032) and the 2/3 Split View in two panes, the 1/3
  Split View and Slide Over in one, and also **phones in landscape** (812–956), as Mail does on large iPhones.
  The width follows rotation, Split View, Stage Manager and Android's multi-window live; the device type never
  decides. Rejected: a height condition (Android shrinks the page under its keyboard, which would flip the layout on
  every focus); a higher threshold (iPad portrait would stay one stretched column); the user agent or Tauri's
  `os` plugin (a phone in landscape and an iPad in a narrow Split View are the same problem as a phone).
- **`splits(wide, base, fullTerminal)`**: two panes only in a wide window, over the board (`home`) and not while the
  terminal takes the whole width. On `no-machines` there is no board to keep beside anything, so it stays the one
  centred column.
- **`html.split`, a class on the root, not a media query**: JavaScript must know the same fact (the routes, the edge
  swipe), and `split` is also false on `no-machines` and under a full-width terminal, which no media query can say.
  `App` toggles it in one effect, as `html.scanning` is toggled for the scanner.
- **The pane's tokens** (`tokens.css`, ours, not gpui's): `--side` (`clamp(320px, 30vw, 380px)` plus the left safe
  area), `--pane-left` (`0px`), `--pane-width` (`100vw`) and `--pane-safe-left` (the left safe area), which
  `html.split` sets to the side, the rest of the window and `0px`, on the root itself so `--gutter` and
  `--gutter-form`, computed from `--pane-width`, follow. `body` drops its left padding there: the side pads the safe
  area. Fixed layers that assumed the whole window start at `--pane-left`: the toasts, the terminal's screen and the
  chat while the keyboard is open.

## The side and the detail

- **The side**: an `aside`, fixed on the left, full height, its own vertical scroll (`overscroll-behavior: contain`),
  a 1 px `--border` on its right, holding the connection bar (fixed at its top, as wide as the side,
  `:global(html.split) .connection`) and the board exactly as on the phone. While a keyboard covers part of the
  window it follows the visual viewport (`Keyboard`), so the chat's keyboard does not push it away.
- **The detail scrolls as the document**, not in a box of its own: the chat's header, thread and composer and every
  `NavBar` depend on the document's scroll (`window.scrollY`, `position: sticky`, the thread's scroll to the end);
  moving them into a scrolling box would rewrite them all. So `.page` only moves right by `--pane-left`. Rejected:
  two scrolling boxes, as Mail's split view.
- **The side replaces the detail, the detail stacks**: in two panes a row of the board, the board's `Start` and the
  bar's `Machines` `settle` their route over the base (`side` in `App`), so tapping rows swaps the agent on the right
  and the stack never grows behind them; what the detail opens (the terminal, changes, files, a subagent) is pushed
  as on the phone, so a subagent opened from a chat still goes back to its parent. In one pane they push as before.
  So Machines opened from the bar in two panes no longer returns to the agent under it: its row is one tap away.
- **The row on the right is marked**: `--selected` fill and `aria-current="true"` (`Board`'s `selected`, the open
  chat's pane on the shown machine).
- **No back button straight over the board** (`NavBar`'s `rooted`): the board is in sight, so `‹ Agents` would only
  empty the detail. The `.start` column stays, so the title keeps its place. Every other screen keeps its back
  button and label.
- **With nothing open**, one line in `--muted`, `Choose an agent`, 40vh down, only when the board lists an agent.
- **No edge swipe in two panes** (`backSwipes`' third argument): the detail's left edge is not the screen's edge, and
  a drag there would start on the board. The back button does the same. Android's system back goes back as on the
  phone: from an agent over the board it empties the detail, and on the base it leaves the app.
- **The agent's screen is topmost in two panes**: no connection bar above it, so its bar reaches over the safe area
  as the other screens' do, and the connection bar lives in the side on every route. The terminal's head has its own
  height for the toasts (`terminalHead`), since `barHeight` is the side's bar there.
- **A rotation never remounts the open screen**: `.page` and its route chain are one block in both modes; only the
  board moves between the page and the side (its folds and search are module state, `folds`, `boardSearch`).

## Widths

- **Reading screens keep a centred column of at most 760 px** (`--column`): `Changes`, `Files`, `Issues`, `Issue` and
  the agent's chat (header, thread, composer). **Forms keep 520 px** (`--form`): `Start`, `Machines`, `Machine`.
  Their side padding is `--gutter` or `--gutter-form`, `max(--inset-wide, (pane − measure) / 2)`, so on a phone it is
  the 16 px it was and the screens are pixel-identical.
- **The bar still spans the pane** (`NavBar`'s `measure`): only the sticky bar's side margins follow the screen's
  gutter, its own padding stays, so its veil covers the pane's width and its buttons sit at the pane's edges. Until
  062 the forms capped the whole screen, bar included, at 520 px, so their bar was a segment on a wide window.
  The composer's ground spans the pane the same way, its negative margins being the gutter.
- **Code keeps the whole width**: `Diff`, `File` and the terminal, whose lines are as long as they are.

## The terminal

- **In the detail by default, with a `Full width` switch** (`maximize-2`, before the fit switch, only in a wide
  window, `aria-pressed`, `--soft` off and `--accent` on, the fit switch's styles). On, `splits` is false, the side
  goes and the terminal takes the window; it is remembered until the app restarts (`layout.full`). Fitting needs
  nothing new: hiding the side changes the terminal's box, and a new size opens a new view, as a rotation does
  (`design/terminal/fit.md` › A change opens again). Rejected: always the whole window (the terminal would not be on
  the right, as two panes promise), never (an 11-inch iPad in portrait would get about 65 columns).
- **`Fit to this screen`**, not `Fit to this phone`: the same switch on a phone and a tablet; the `smartphone` icon
  stays.

## Hardware keyboard

- **Stray keys reach the terminal** (`Typing.stray`, `Typist.take`, a `keydown` on the document in the terminal's
  screen): a key pressed while no field has the focus focuses the hidden field and is sent, so typing works without a
  tap on the grid. Arrows, Esc, Tab, Enter and Ctrl+key go through `physical()`, a printable character without Cmd or
  Ctrl as text; Cmd shortcuts, bare modifiers, dead keys and composition stay the system's. A hardware `keydown`
  exists only with a hardware keyboard, so this never opens the on-screen keyboard on a touch-only device. It takes
  Tab and Enter from a focused button of the terminal's screen, which a terminal needs.
- **Cmd+Return or Ctrl+Return sends in the chat** (`sendsOn`), Return still adds a line (`design/chat/answering.md`).

## Pointer

- **`html.pointing`** (`src/lib/pointer.ts`): on while a mouse, trackpad or pen moves or presses, off at the next
  finger. With it, everything with a pressed state shows `--hover` under the pointer (primary and danger buttons
  brighten instead, a link fades to 85 %), and buttons, links, summaries, selects and labels show `cursor: pointer`
  (always, harmless under a finger). Rejected: `@media (hover: hover)`, false on an iPad with a trackpad, whose
  primary pointer is still touch; `any-hover`, true there, which leaves a hover stuck after every finger tap.

## The popover

- **In a wide window the close confirmation is a popover** (`Sheet`'s floating mode, `src/lib/ui/popover.ts`): a
  `Glass` card with its four corners rounded, 360 px wide (never wider than the window less 24 px), under what opened
  it and left-aligned to it, or above it when there is no room below, kept 12 px inside the window; centred with no
  anchor. No veil: the layer behind is transparent and a tap on it cancels. It rises in and fades out like a card.
  `Esc` cancels, in both modes. Narrow, it is the bottom sheet it was. Its anchors: the board's row, the chat's
  `Close agent`. "Sheets and menus" of the task is this one: it is the app's only sheet, there are no menus, and the
  native `select`s already open as system popovers on an iPad.

## Limits

- Closing an agent from the board with a pointer: the swipe is touch-only and the long press Android's; `Close agent`
  on the agent's screen covers it.
- No resizable side, no third pane, no keyboard shortcuts to navigate, no right-click menus.
