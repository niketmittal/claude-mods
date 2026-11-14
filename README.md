# eta — a Claude Code mod

Know how long Claude's current work will take, so you can wait, step away, or start something else without disturbing the main thread.

```
⏱ ~6m10s left (×1.4 calibrated) · step 2/4 · writing tests · go do something else; you'll get a ping
```

- **Live ETA above the prompt** while Claude works. Claude reports its estimate through an `estimate` tool before multi-step work and updates it at each step.
- **Advice on what to do with the wait:** under 1 minute, wait; 1–5 minutes, start a side task or take a short break; over 5 minutes, go do something else.
- **Corrects itself over time.** It compares each turn's real time to Claude's first guess and stretches or shrinks later estimates to match.
- **Notifies you** when a turn that took more than 90 seconds finishes.
- **Side tasks:** type `side: <task>` while Claude is busy. It runs in a background agent without touching the main conversation, and you get a notification with the result when it's done. `/side <task>` works too, though typed mid-turn it may wait until the turn ends.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install eta --marketplace niketmittal/claude-mods
```

Answer `y` to add the marketplace, then choose a scope (user = every session). It's active immediately.

Requires a Claude Code build with mods (function hooks) support. Mods won't load if a managed policy sets `allowManagedHooksOnly: true`.

## Notes

- Side agents share your working directory. Give them research or read-only work, not edits to files the main thread is changing.
- Click `×` on the ETA line to hide it for the session.

## Develop

```
claude plugin validate .
claude plugin test .
```
