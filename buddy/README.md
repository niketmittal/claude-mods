# buddy

Clawd, the block mascot from Claude Code's welcome screen, walks back and forth across every prompt you type: it strides along the row, turns around at the edge, throws its arms up, and blinks now and then. Each prompt gets its own color and its own place in the walk, so you can find your prompts quickly when scrolling back through a long session.

## What Clawd does

- Walks back and forth along each prompt row, turning around at the edges. Your prompt sits on a lightly highlighted bar, in the same color as its Clawd, with wrapped lines lined up under the first.
- Wears headwear picked per prompt (28 looks): top hat, party hat, crown, girl Clawd with hair and a bow, blonde with a flower, pigtails, princess tiara, beanie, cowboy, halo, flower crown, chef, wizard, witch, santa, graduation cap, headphones, viking, ninja, pirate, bunny ears, cat ears, devil horns, a spinning propeller cap, baseball cap, sombrero, alien antennae, or nothing.
- Halfway along, does something that fits your prompt:

  | Prompt mentions | Clawd |
  | --- | --- |
  | git, commit, push, branch, PR | types on a laptop while commits appear on screen |
  | deploy, ship, release, space | launches a rocket among the stars |
  | swim, beach, water, ocean | swims through waves |
  | fish, dive, underwater | among bubbles, fish and seaweed |
  | code, hack, terminal | at a laptop in falling matrix code |
  | server, docker, k8s, cloud | at a laptop in front of a city skyline |
  | rain, storm, weather | in the rain |
  | snow, winter, cold | in falling snow |
  | sun, summer, vacation | under the sun, in a sombrero |
  | done, shipped, milestone | under fireworks |
  | love, heart, <3 | among rising hearts |
  | christmas, pirate, wizard, chef, ninja, learn, birthday | dressed for it (santa, pirate, wizard, chef, ninja, graduate, party hat) |
  | fix, build, add, refactor | hammers a nail into a board |
  | find, search, debug, test | scans with a magnifier |
  | flowers, garden, pretty, design, css | grows a flower in a garden |
  | thanks, nice, love | floats hearts under confetti |
  | dance, music, fun | dances to music under confetti |
  | explain, teach, learn, meeting | teaches a class of tiny Clawds at a chalkboard; one raises a hand |
  | family, kids, team, friends | walks with two tiny Clawds hopping behind |
  | play, pair, collab, buddy | plays catch with a friend |
  | coffee, morning | sips coffee |
  | read, docs, readme | reads a book, turning pages |
  | guitar, band, song | plays guitar |
  | win, passed, merged, done | holds up a trophy under fireworks |
  | screenshot, photo, image | takes a photo, flash |
  | cook, recipe, food | flips a pancake (chef hat) |
  | rain | holds an umbrella |
  | birthday | holds a balloon (party hat, fireworks) |
  | later, break, sleep | naps (zZ) under the moon |
  | a question | ponders with a thought bubble |

- Prompts with no topic get a new activity and scene every lap.
- A prompt's color and headwear come from its text, so the same prompt always looks the same.
- On the way back, does one of Claude Code's own Clawd tricks, a different one each lap: jump, skip, spin, peekaboo, drop, waddle, wink, boop, tap, sneeze, turn, coin-hop, plus wave, shiver, moonwalk, bounce, doze and dab.

## Install

```
/plugin install buddy --marketplace niketmittal/claude-mods
```

## Notes

- Needs a Claude Code build with mods support. It does not load where an organization policy sets `allowManagedHooksOnly`.
- Each prompt row is four lines tall: Clawd plus a row of air for jumps, hats, thought bubbles and the ball.
- Terminal only for now. Only prompts you typed get a buddy; task notifications and other messages keep the default look.
- In the terminal's normal (non-fullscreen) view, prompts that have scrolled into the history may stop dancing. Fullscreen animates every prompt on screen.

## Develop

```
claude plugin validate buddy
claude plugin test buddy
```
