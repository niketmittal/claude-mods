# buddy

Clawd, the block mascot from Claude Code's welcome screen, walks back and forth across every prompt you type: it strides along the row, turns around at the edge, throws its arms up, and blinks now and then. Each prompt gets its own color and its own place in the walk, so you can find your prompts quickly when scrolling back through a long session.

## What Clawd does

- Walks back and forth along each prompt row, turning around at the edges. Your prompt sits on a lightly highlighted bar, in the same color as its Clawd, with wrapped lines lined up under the first.
- Wears an outfit picked per prompt: top hat, party hat, crown, girl Clawd with hair and a bow (or blonde with a flower), beanie, cowboy hat, halo, flower crown, sunglasses, overalls or a striped shirt.
- Halfway along, does something that fits your prompt:

  | Prompt mentions | Clawd |
  | --- | --- |
  | git, commit, push, branch, PR | types on a laptop while commits appear on screen |
  | deploy, ship, release, space | launches a rocket among the stars |
  | swim, beach, water, ocean | swims through waves |
  | fix, build, add, refactor | hammers a nail into a board |
  | find, search, debug, test | scans with a magnifier |
  | flowers, garden, pretty, design, css | grows a flower in a garden |
  | thanks, nice, love | floats hearts under confetti |
  | dance, music, fun | dances to music under confetti |
  | later, break, sleep | naps (zZ) under the moon |
  | a question | ponders with a thought bubble |

- Prompts with no topic get a new activity and scene (swimming, space, garden, party, night) every lap.
- On the way back, does one of Claude Code's own Clawd tricks, a different one each lap: jump, skip, spin, peekaboo, drop, waddle, wink, boop, tap, sneeze, turn, coin-hop.

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
