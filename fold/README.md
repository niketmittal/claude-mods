# fold

Fold Claude's long answers so the conversation stays easy to scan.

- Click `▾ fold` at the end of a long answer to fold it to its first 3 lines; click `▸ N more lines` to open it again. (Clicks need the fullscreen view: `/tui fullscreen`.)
- `/fold` folds every long answer at once; `/unfold` opens them all. Clicking one still opens or folds just that one.
- Short answers are left exactly as Claude Code draws them.

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
