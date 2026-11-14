# fold

Fold Claude's long answers so the conversation stays easy to scan.

- Every answer of 10 lines or more gets a toggle at its end. `▾ fold` shrinks it to its first 3 lines and `▸ 27 more lines` opens it again (click it in fullscreen mode, where the terminal reports clicks).
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
