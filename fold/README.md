# fold

Fold Claude's answers so the conversation stays easy to scan.

- Click `▾ fold` at the end of any answer of two lines or more and it shrinks to a one-line summary of the whole answer; click `▸ full answer` to open it again. (Clicks need the fullscreen view: `/tui fullscreen`.)
- Summaries are written by a small Haiku call when an answer finishes (or when you first fold it) and kept for the session, so folding is instant.
- `/fold` folds every answer to its summary at once; `/unfold` opens them all. Clicking one still opens or folds just that one.
- One-line answers are left exactly as Claude Code draws them.

## Install

```
/plugin install fold --marketplace niketmittal/claude-mods
```

## Notes

- Terminal only. A folded answer is folded in the view alone; what Claude remembers is unchanged.
- Folding is for this session; a new session starts with everything open.
- Each answer costs one small Haiku call for its summary.

## Develop

```
claude plugin validate fold
claude plugin test fold
```
