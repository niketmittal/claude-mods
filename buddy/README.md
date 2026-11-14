# buddy

Clawd, the block mascot from Claude Code's welcome screen, walks back and forth across every prompt you type: it strides along the row, turns around at the edge, throws its arms up, and blinks now and then. Each prompt gets its own color and its own place in the walk, so you can find your prompts quickly when scrolling back through a long session.

## Install

```
/plugin install buddy --marketplace niketmittal/claude-mods
```

## Notes

- Needs a Claude Code build with mods support. It does not load where an organization policy sets `allowManagedHooksOnly`.
- Each prompt row is three lines tall, Clawd's height.
- Terminal only for now. Only prompts you typed get a buddy; task notifications and other messages keep the default look.
- In the terminal's normal (non-fullscreen) view, prompts that have scrolled into the history may stop dancing. Fullscreen animates every prompt on screen.

## Develop

```
claude plugin validate buddy
claude plugin test buddy
```
