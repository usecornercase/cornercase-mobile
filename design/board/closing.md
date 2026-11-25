# Closing an agent

A topic of [Board](../board.md): closing an agent from the phone, as the machine's **close agent** does, from two places, the board's row and the agent's screen. Both ask cornercase what would close, show it in one confirmation and close through the queue with `--boot`. Upstream's own decision is in its `design/layout/agents-section.md` › Closing an agent (#399, #438), read on 2026-11-13. The state per pane is in `src/lib/closeAgent.svelte.ts` (`CloseAgent`), without markup, with the commands injected as in `addMachine.svelte.ts`. The gestures are pure machines in `src/lib/rowSwipe.ts` with the clock injected, as `backSwipe.ts` is. The argv and the answer are in `crates/core/src/cli/close.rs`, and the two commands in `src-tauri/src/commands/close.rs`.

## Where it is

- **On the agent's screen, a danger button at the foot of the large header** (P1, `src/routes/agent/ChatHeader.svelte`), `Close agent` in words, quiet since the review of 2026-11-15 (red text without fill or edge: filled, it was the loudest thing under the title of a screen made for answering), so VoiceOver reads its name with no label of its own. It rests outside `connected`, as `New agent` does (Chat › The screen), and also on a row without a `boot`. It shows a spinner while the check runs and reads `Closing…` while the close runs. It sits outside the `<header>`, so the height that turns the header compact still measures only the title. While the keyboard is open it leaves the eye with the large header (`.spoken`) and stays for VoiceOver. It scrolls away with the large header, as the subagents line does. Rejected:
  - **a sixth icon in the sticky bar**: with `‹ Agents` and the four icons of 44 pt, the compact line had 146 pt on a 390 pt phone (Chat › The screen), and one more icon takes 52 of them. An icon also says less than `Close agent` for something that cannot be undone.
  - **a `⋯` in the bar opening a menu**: a menu component for one entry. It would also hide the only way to close that VoiceOver has.
- **On the board, a gesture on the row**: a swipe left on iOS, a long press on Android (below). It works on roots and on subagents, and also on the rows of a search. Like the screen's button and the board's own `Start`, it is offered only while `connected`: outside it the check could only fail with `not_connected`. Section headers and the search field do not take it. The gesture's only way in for VoiceOver is the screen's button: the row's `Close` stays hidden from it until the row is open, and an accessible action on the row is left out.

## The swipe (iOS)

- **A swipe left uncovers `Close` in red on the row's right** (`RowSwipe`, `AgentRow.svelte`), as Mail and the system lists do. `Close` is 88 px wide, in `--failed` with the danger tone (Look › Touch and motion). Past half its width the row stays open on lifting, short of it the row shuts. The layer moves under the finger with no transition and settles with one.
- **Only a clear sideways move claims the gesture**, with the edge swipe's thresholds (`LEAN` and `CLAIM` from `backSwipe.ts`, shared, not copied; Look › Navigation): a scroll of the board never opens a row. A shut row claims only leftwards, an open one both ways, so a swipe right shuts it. A second finger cancels the gesture.
- **Never "swipe all the way to close"**: the layer stops at the button's width, and only a tap on `Close` asks. Closing stops agents, so a gesture that closes without a confirmation was rejected.
- **One row open at a time** (`Board.svelte`). A touch outside it, any scroll, a swipe right or a tap on it shuts it, and so does an `agents-changed` that moves it to another place in the list or removes it, or a connection that is no longer `connected` (the `Close` behind it would be gone). The row is shut rather than moved open, so `animate:flip` slides a shut row.
- **A tap on an open row only shuts it**: it opens neither the chat nor the fold. The fold's button lies inside the moving layer, so the triangle and its 44 pt target (051, 054) move with the row.
- **The edge swipe does not collide**: there is none on the board (`backSwipes` is false on `home`).

## The long press (Android)

- **A long press of 500 ms opens the same confirmation** (`LongPress`), with a light tap (`haptics.ts`). A move past `CLAIM` cancels it, so a scroll never holds. Lifting after a hold does not open the chat. `platform.ts` picks the gesture (`rowGesture`).
- **No swipe on Android**: a long press on a list's row is the platform's own way to act on it, and the screen's edges are the system's back. Rejected: the same swipe on both, which Android users do not expect on a row.

## The confirmation

- **A sheet that rises from the bottom** (P2, `src/lib/ui/Sheet.svelte`, the first `Sheet`, and `CloseConfirm.svelte`), shared by the board and the screen, as iOS shows an action sheet after a swipe and `Close`. The sheet goes to the end of `body`, over a dimmed page; a tap on the dim cancels. It pads the bottom safe area and takes the focus as a `dialog`, named by its title. It holds no text field, so the keyboard problem that kept the first machine's form out of a sheet does not arise here (Look › Forms). Rejected:
- **In a wide window it is a popover** (062, `design/look/wide.md` › The popover): `Sheet` floats as a card of 360 px with its four corners rounded, under what opened it and left-aligned to it, or above it when there is no room below, kept 12 px inside the window (`placed` in `src/lib/ui/popover.ts`), placed again on every resize, over a clear layer whose tap cancels; it rises in and fades out like a card. Its anchor is the row (`AgentRow` passes its element with `onclose`, which `Board` keeps) or the screen's `Close agent` (`ChatHeader` passes its wrapper, which `Agent` keeps). Only the screen that asked shows it: `CloseAgent.ask` takes who asks (`board` or `agent`) and `confirmingFor(pane, by)` gives a confirmation only to that screen, held by the ask's ticket, since in two panes both screens are mounted with the one closer and both used to show it. It is placed again on scroll as on resize, `Esc` goes no further than the popover, Tab stays among its buttons and the focus goes back to what had it once it closes. The same texts and buttons, and `Esc` cancels it in both modes. A phone keeps the bottom sheet. Rejected: the bottom sheet stretched to 520 px on an iPad, far from the row it is about; a centred dialog, which hides the row it names.
  - **an inline card**, as deleting a machine does: on the board it would push the rows under it.
  - **`window.confirm`**, which takes no danger tone and no detail.
- **What it says comes from cornercase's check** (`confirmationText`), never from the phone's rows:
  - `Close <label>?`, with the label the board shows, so a flow's member reads as its role;
  - `Also stops N subagents`, which is `stops` minus the agent itself, or `N agents` in a flow;
  - `Ends the flow run: its whole team closes` when `run` is set;
  - `Keeps N agents running` when `keeps` holds some;
  - `Nothing is deleted from disk: the worktree and the branch stay.`, always;
  - cornercase's `warning`, if any.
- **`Cancel` plain, `Close` danger**, the order of the machine's deletion.
- **One confirmation per pane**, held by the machine's `CloseAgent`, so the board and the screen show the same one: leaving the screen with it open brings it up on the board.

## Asking before and asking again

- **The check runs before the sheet shows**: `close --agent --pane P --boot B --check --json` asks cornercase what would close, while the row (in place of its time) or the screen's button shows a spinner. A check that fails opens no sheet: a toast says cornercase's reason (`stale-boot`, `pane N runs no agent cornercase reads`, a project that is closing, and so on). A check that gets no answer (`Unanswered`) says `cornercase did not answer, so nothing was closed. Try again.` rather than the generic `maybe_sent`, whose "it may have been sent" would suggest that a read closed the agent.
- **A row that leaves the board drops what it was asking**: a check, an open sheet or a second check of a pane no longer in `agents-changed` (its agent ended, or the machine closed it) is forgotten, and a check's answer that comes after is ignored, so no sheet opens for a gone agent and its `Close` cannot end in `runs no agent`.
- **`Close` checks again before closing** (P4), as the machine's window plans again on confirming (`Plan::grew`). While it runs, `Close` shows a spinner and `Cancel` rests. If the plan grew, the sheet shows the new plan instead of closing: a flow `run` it did not have, or a tab or an agent to stop that was not shown. A plan that shrank closes, since it closes less than the user confirmed. On a phone the sheet may stay open for a long time while a team starts agents. It costs one command more. Rejected: closing on the first answer. `close --agent` has no flag to close only the tabs that were confirmed (Upstream gaps).

## The close

- **Both commands go through the queue** (`reach::asked`), so they never overtake a send queued before them. Rejected: the check one-shot like `read --last-message`, which could answer about a pane that a queued send is still changing.
- **`--boot` from the row** (`AgentRow.boot`): a restart between the check and the close makes cornercase refuse with exit 4 (`StaleBoot`), so the close never reaches the agent that inherited the pane's id. A row without a `boot` offers no close.
- **`Closing…` until the rows go**: from the close on, the agent's row, the rows of its `stops` that are on the board, and its screen read `Closing…` and take no other close. The state ends when none of those panes is in an `agents-changed` any more, even if the command answered first and the rows stay a while; then the rows leave with the list's usual animation. A failure ends it with a toast of cornercase's reason. `Unanswered` (the close may have gone) keeps `Closing…` for 15 s waiting for the rows to go, then says `cornercase did not answer, so the agent may still close: look at the board before trying again.` That text is its own rather than the generic `maybe_sent`, since the board shows whether it did. `Skipped` says `not_sent`, as every send.
- **Switching the active machine drops the states**, since a `CloseAgent` belongs to a machine: a close under way finishes on the machine without its `Closing…`, and its failure still shows a toast.

## Nothing on disk

- **The argv never carries `--remove-worktree`, `--delete-branch`, `--force` or `--unlock`**, and a test of the argv holds it (CA7):
  - the ticket leaves them out;
  - removing a worktree from the phone, without seeing its uncommitted changes or its lock, cannot be undone. Upstream took exactly that out of its own close agent in 0.12.178 ("Close agent only closes agents");
  - removing a worktree stays on the machine (the workspace's `×`, the Worktrees dialog).
- **The contract promises it**: `close-agent-tabs` is required, and without it the CLI refuses `close --agent` (Connection › The contract).

## Why danger

- **Closing stops agents and cannot be undone from the phone**: upstream keeps nothing to reopen after `close --agent` (Upstream gaps). Look's danger tone marks only what cannot be undone, so it is used here, on the screen's button, the row's `Close` and the sheet's `Close`.

## Back to the board

- **Once the agent the user is on closes, the app returns to the board** (P5, `Router.closed`). That holds on its screen, on its terminal over it, and on a subagent's screen over its parent's when the parent closes, since its `stops` take the child. The return happens when the `Closing…` state ends. Rejected: going back to the screen below if its agent still runs, more rules for a stack the user can rebuild from the board in one tap. It also leaves the ticket's "back to the board".
- **`This agent is no longer running.` never shows first**: `Chat.see` takes whether the phone is closing the pane, and while it is, a list without the pane keeps the last row instead of counting the agent as gone (Chat › Gone). The effect that feeds `Chat.see` runs before the one that ends the state, so the screen is already leaving when the rows go.
- **Only the top of the stack goes back**: with Changes, Files or Machines open over the agent's screen, the stack stays, and coming back shows the agent gone. Taking away a screen the user opened on top, maybe halfway through a diff, was judged worse than one more `Back`.
- **A close from the machine, or from another phone**, has no `Closing…` here, so its screen turns gone as before (Chat › Gone).

## Left out

- Undoing a close or reopening the agent: upstream's `close --agent` keeps nothing for it (Upstream gaps).
- Closing every agent of a workspace and reopening them (`agents close`, `agents reopen`): another feature.
- Closing a pane that is only a shell, or a whole tab or workspace.
- Removing the worktree or the branch (Nothing on disk).
- An accessible action on the board's row: VoiceOver reaches the close through the agent's screen.

## Checked live

- **On 2026-11-13** in the iPhone 17 simulator (iOS 27.2, Xcode 27.2, macOS 26.6.2, Tauri 2.12.5), under `tauri ios dev`, against a bridge of its own on `127.0.0.1` and an installed cornercase 0.13.31 on a server of its own (`CORNERCASE_SOCKET`), with fake Claude agents (a signed copy of `sleep` named `claude` that writes its session file), the touches made by XCUITest. A wrapper given to the bridge as `--cornercase` logged every request of the queue, and could hold the close (not the check) a few seconds to see `Closing…`.
- **The swipe**: dragging a row left uncovered the red `Close` and stopped at its width. A drag mostly downwards that started on a row, with 40 pt sideways, opened nothing. With a row open, a vertical drag elsewhere on the board shut it.
- **The sheet**: `Close` on the row ran `--check` and opened the sheet over the dimmed board. For an agent that would stop one subagent and leave another running, it read `Close claude?`, `Also stops 1 subagent`, `Keeps 1 agent running` and the line about the disk. `Cancel` took the sheet away and left the row in place and shut, and nothing more reached cornercase.
- **A root with two subagents**: the sheet read `Also stops 2 subagents`. Its `Close` ran the check again and then the close, three requests in that order, each with the row's `--boot`. The folded row read `Closing…` in place of its time while the close was held, and the three rows left the board when it ended.
- **A flow's member**: the coder of a running flow (`flow run`) read `Also stops 2 agents` and `Ends the flow run: its whole team closes`; while it closed, the orchestrator's row, folded with `+2`, read `Closing…`, and the three agents left the board and `status`. The sheet's title is the board's label: `Close coder?` in one run, `Close claude?` in another, swiped while its orchestrator had not shown on the board yet.
- **On the agent's screen**: `Close agent` sat at the foot of the large header in the danger tone (P1, settled on this check's screenshots) and the sheet was the board's. Once confirmed, the button read `Closing…`, and when the rows went the app was on the board, also with the agent's terminal opened on top during the close, and from a subagent's screen opened over its parent's (`Back to claude`). No dump of those runs held `This agent is no longer running.`
- **A failure**: with the wrapper rewriting `--boot` to another start's (`1-1794500000000000000`), cornercase refused the check with exit 4, no sheet opened and a toast said its reason (`the cornercase server restarted since the command was prepared…`). A real restart of the server could not be used: its agents do not survive it, so the board emptied within seconds and no row with the old boot was left to close.
- **Android**: on the `cornercase_api37` emulator (API 37), the APK built with the `.debug056` suffix and a bridge on the LAN, a long press on a row ran the check and opened the same sheet. The light tap cannot be felt on an emulator, and the close itself was not repeated there.
