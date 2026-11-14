# buddy

A tiny block figure that dances beside every prompt you type in Claude Code. Each prompt gets its own random shape and color, so you can find your own prompts quickly when scrolling back through a long session.

## Install

```
/plugin install buddy --marketplace niketmittal/claude-mods
```

## Notes

- Needs a Claude Code build with mods support. It does not load where an organization policy sets `allowManagedHooksOnly`.
- Terminal only for now. Only prompts you typed get a buddy; task notifications and other messages keep the default look.
- In the terminal's normal (non-fullscreen) view, prompts that have scrolled into the history may stop dancing. Fullscreen animates every prompt on screen.

## Develop

```
claude plugin validate buddy
claude plugin test buddy
```
