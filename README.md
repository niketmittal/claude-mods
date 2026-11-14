# claude-mods

Claude Code mods by Niket.

```
/plugin install buddy --marketplace niketmittal/claude-mods
/plugin install eta --marketplace niketmittal/claude-mods
/plugin install fold --marketplace niketmittal/claude-mods
```

## buddy

Clawd, the block mascot from Claude Code's welcome screen, lives on every prompt you type. Each prompt gets its own Clawd: its own color, its own hat, and something to do that fits what you asked. Scrolling back through a long session, your prompts are easy to spot.

![Four prompts, four Clawds: coffee, a game of catch, a classroom, a rocket launch in space](buddy/media/hero.gif)

The moment you send a prompt, its Clawd starts on the activity that fits it. Then it walks the row, turns around, does one of Claude Code's own Clawd tricks on the way back, and starts the next lap. A prompt that matches several topics does them one per lap, the item popping in with a sparkle and leaving in a puff; a prompt with no topic gets a new activity, scene and sometimes a crew every lap. The topics come from what people most often ask Claude Code for.

| | |
| --- | --- |
| ![](buddy/media/coffee.gif)<br>`coffee`, `mug`: sips from a mug | ![](buddy/media/catch.gif)<br>`pair`, `play`, `collab`: plays catch with a friend |
| ![](buddy/media/class.gif)<br>`teach`, `explain`, `learn`: teaches a class of tiny Clawds | ![](buddy/media/family.gif)<br>`family`, `team`, `friends`: tiny Clawds hop along behind |
| ![](buddy/media/laptop.gif)<br>`git`, `commit`, `laptop`: types code on a laptop | ![](buddy/media/hammer.gif)<br>`fix`, `build`, `hammer`: hammers a nail into a board |
| ![](buddy/media/rocket.gif)<br>`deploy`, `ship`, `rocket`: launches a rocket into space | ![](buddy/media/swim.gif)<br>`swim`, `beach`, `water`: swims through the waves |
| ![](buddy/media/flower.gif)<br>`design`, `css`, `pretty`: grows a flower in a garden | ![](buddy/media/trophy.gif)<br>`passed`, `merged`, `shipped`: trophy and fireworks |
| ![](buddy/media/think.gif)<br>a question: thought bubble ? → … → ! | ![](buddy/media/rain.gif)<br>`rain`, `umbrella`: an umbrella in the rain |
| ![](buddy/media/matrix.gif)<br>`code`, `hack`, `terminal`: falling matrix code | ![](buddy/media/snow.gif)<br>`christmas`, `snow`: santa hat in the snow |
| ![](buddy/media/book.gif)<br>`read`, `docs`, `book`: reads, pages turning | ![](buddy/media/guitar.gif)<br>`guitar`, `song`, `band`: plays guitar |
| ![](buddy/media/camera.gif)<br>`screenshot`, `photo`: camera flash | ![](buddy/media/pan.gif)<br>`cook`, `recipe`, `pancake`: flips a pancake |
| ![](buddy/media/balloon.gif)<br>`birthday`, `balloon`: party hat and a balloon | ![](buddy/media/magnifier.gif)<br>`find`, `search`, `debug`: scans with a magnifier |
| ![](buddy/media/love.gif)<br>`love`, `heart`, `<3`: hearts float up | ![](buddy/media/music.gif)<br>`dance`, `music`, `party`: dances to music |
| ![](buddy/media/sleep.gif)<br>`sleep`, `later`, `tired`: naps under the moon | ![](buddy/media/underwater.gif)<br>`fish`, `dive`: bubbles, fish and seaweed |
| ![](buddy/media/city.gif)<br>`docker`, `k8s`, `server`: laptop before a city skyline | ![](buddy/media/sunny.gif)<br>`summer`, `vacation`: sombrero in the sun |
| ![](buddy/media/ninja.gif)<br>`ninja`, `secret`: ninja at night | ![](buddy/media/wizard.gif)<br>`magic`, `wizard`, `spell`: wizard among the stars |
| ![](buddy/media/approve.gif)<br>`yes`, `ok`, `go`: a check mark draws itself | ![](buddy/media/binoculars.gif)<br>`show`, `open`, `view`: looks through binoculars |
| ![](buddy/media/cart.gif)<br>`shop`, `order`, `customer`: a cart fills with parcels | ![](buddy/media/easel.gif)<br>`page`, `button`, `theme`, `ui`: paints a canvas |
| ![](buddy/media/run.gif)<br>`run`, `start`, `execute`: play, progress bar, done | ![](buddy/media/trash.gif)<br>`remove`, `delete`, `clean`: tosses paper in the bin |
| ![](buddy/media/bulb.gif)<br>`plan`, `idea`, `brainstorm`: a light bulb flickers on | ![](buddy/media/coins.gif)<br>`payment`, `pricing`, `money`: coins stack up |
| ![](buddy/media/server.gif)<br>`api`, `request`, `webhook`: request out, response back | ![](buddy/media/phone.gif)<br>`phone`, `mobile`, `app`: a buzzing phone |
| ![](buddy/media/plane.gif)<br>`email`, `message`, `send`: a paper plane flies off | ![](buddy/media/bug.gif)<br>`error`, `bug`, `crash`: stomps a bug |
| ![](buddy/media/scanner.gif)<br>`scan`, `barcode`, `qr`: a laser sweeps a barcode | ![](buddy/media/clock.gif)<br>`time`, `schedule`, `deadline`: an alarm clock rings |
| ![](buddy/media/chart.gif)<br>`data`, `dashboard`, `chart`: bars grow | ![](buddy/media/gears.gif)<br>`settings`, `config`: gears turn |
| ![](buddy/media/lock.gif)<br>`login`, `password`, `security`: a key unlocks a padlock | ![](buddy/media/box.gif)<br>`install`, `extension`, `package`: a parcel opens |
| ![](buddy/media/clapper.gif)<br>`video`, `animation`, `gif`: a clapperboard snaps | ![](buddy/media/handover.gif)<br>several topics in one prompt: one per lap, swapping with a sparkle |

### Heroes

Original hero looks (not any real character), each with its own move. Capes trail beside Clawd and badges sit above it, never on its face.

| | |
| --- | --- |
| ![](buddy/media/hero-super.gif)<br>`hero`, `super`, `save`: Super Clawd flies, cape streaming | ![](buddy/media/hero-night.gif)<br>`dark`, `shadow`, `midnight`: night hero on a rooftop, cape flaring |
| ![](buddy/media/hero-speed.gif)<br>`fast`, `quick`, `asap`: speedster dashes with speed lines | ![](buddy/media/hero-swing.gif)<br>`jump`, `parkour`, `climb`: vaults over a crate |
| ![](buddy/media/hero-ranger.gif)<br>`fly`, `hover`, `jetpack`: space ranger on jetpack flames | ![](buddy/media/hero-robo.gif)<br>`robot`, `automate`, `agent`: Robo Clawd dances |

### Tricks

Taken from Claude Code's own Clawd animations: jump, skip, spin, peekaboo, drop, waddle, look, wink, boop, tap, sneeze, turn, coin-hop, plus wave, shiver, moonwalk, bounce, doze, dab, cartwheel, flip, pogo, slide, tiptoe, sleepwalk, nod, yawn, hiccup, wiggle, duck, salute, shrug and stomp (34 in all).

![Clawd doing jump, spin, peekaboo, moonwalk, coin-hop, dab, sneeze and wave](buddy/media/tricks.gif)

![Clawd doing a cartwheel, a flip, pogo, slide, tiptoe, sleepwalk, wiggle, duck, stomp and shrug](buddy/media/tricks2.gif)

### Looks

Every prompt's Clawd wears something different: 27 headwear looks or none. Some topics pick it (christmas → santa, pirate → pirate, magic → wizard, cook → chef, ninja → ninja, learn → graduation cap, birthday → party hat). Whatever Clawd holds or wears never shares its color: the item keeps its natural color and Clawd picks one that stands apart.

About a third of Clawds also wear a very small earring against the left side of the head: a gold or silver stud, a gold hoop or a pink drop.

Type `hats`, `outfits` or `fashion` for a fashion show: Clawd twirls on the spot and models a new hat every second.

![Clawd twirling and modelling a new hat every second](buddy/media/fashion.gif)

![All the headwear: top hat, party hat, crown, girl with a bow, pigtails, princess, beanie, cowboy, halo, flower crown, chef, wizard, witch, santa, graduate, headphones, viking, ninja, pirate, bunny ears, cat ears, devil horns, propeller, cap, sombrero, alien](buddy/media/outfits.png)

### Notes

- Needs a Claude Code build with mods support. It does not load where an organization policy sets `allowManagedHooksOnly`.
- Terminal only for now. Only prompts you typed get a Clawd; task notifications and other messages keep the default look.
- Each prompt row is four lines tall: Clawd plus a row of air for jumps, hats, thought bubbles and the ball. The prompt text takes its Clawd's color.
- A prompt's look comes from its text, so the same prompt always looks the same.
- In the terminal's normal (non-fullscreen) view, prompts that have scrolled into the history may stop moving. Fullscreen animates every prompt on screen.
- The GIFs are rendered from the mod's own frames.

## eta

An accurate ETA for Claude's current work, measured from its progress, and nothing else on the line. Plus done pings and background `side:` tasks. [Details →](eta/)

![⏱ 3m 20s left counting down above the prompt while Claude works](eta/media/eta.gif)

## fold

Fold Claude's answers: every answer of two lines or more ends in a `▾ fold` link that shrinks it to its first lines (`▸ N more lines` opens it), and `/fold` and `/unfold` do every answer at once. [Details →](fold/)
