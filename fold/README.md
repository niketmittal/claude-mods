# fold

Fold Claude's answers so the conversation stays easy to scan.

- Click `▾ fold` at the end of any answer of two lines or more to fold it to its first lines (up to 3); click `▸ N more lines` to open it again. (Clicks need the fullscreen view: `/tui fullscreen`.)
- `/fold` folds every answer at once; `/unfold` opens them all. Clicking one still opens or folds just that one.
- One-line answers are left exactly as Claude Code draws them.

## Install

```
/plugin install fold --marketplace niketmittal/claude-mods
```

## Notes

- Terminal only. A folded answer is folded in the view alone; what Claude remembers is unchanged.
- Folding is for this session; a new session starts with everything open.

## Develop

```
claude plugin validate fold
claude plugin test fold
```
