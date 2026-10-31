# A second Amsterdam mission — brainstorm record

Status: **brainstorm only** (2026-10-29). The user liked the brainstorm and asked to document the
choices; **no plan and no build yet**. Nothing here is a spec. The sources and the full list of
ideas (also the ones not chosen) are in `research.md` (about 90 sourced facts, real euro values,
sensitivity notes, parody names).

2026-10-31: the user asked for a level 2 proposal from this pool, with the race moved to level 3.
The result is `level-2.md` (OAT OF CONTROL).

## 1. The user's seed

> "Next up, I want to brainstorm about all kinds of things that are funny or newsworthy or a meme
> in Amsterdam:
> - New enemies: the Biro 45 km/h hour cars that are driven by influencers, drug dealers in the
>   city centre Red Light District, taxi drivers who are overly agressive
> - New mechanisms: instead of using a high score with numbers, I want the score to be indicative
>   of a budget. Getting a fine from the wardens will decrease the score, while shooting bins that
>   explode with statiegeld will increase the score.
> - New areas that parody city hotspots: Fort Negen &Zestig (a parody of Fort Negen and the long
>   queues), houses that are for sale for ludicrious prices, the red light district
>
> I want you to research typical "havermelkelite" things about the city, and suggest new enemies
> and game mechanisms."

## 2. The choices (two rounds of questions, 2026-10-29)

### Placement

- **A new mission** (a second Amsterdam mission). `ams` stays as it is (finished and deployed).
  The new enemies may also appear in `ams` later.
- **The budget score is game-wide:** every mission counts euros, the HUD shows
  `BUDGET € 1.234,56` (Dutch notation), and the high-score table becomes a budget table. Statiegeld
  bins and fines appear mainly in Amsterdam.

### Enemies

The user's three, plus two picks from the research:

| Enemy | Idea (from the research proposals; details still open) |
|---|---|
| **Brommobiel influencer** (user) | A 45 km/h cube micro-car (parody name, never the brand: `BRAMMOBIEL`) with a ring light and a phone on a gimbal. Parks across the pavement as a solid block; the ring light charges, then flashes a cone ahead. The wreck drops "sponsor deal" coins. |
| **Wallen dealer** (user) | Hood up in a dark doorway; whispers `COKE? XTC?`; never shoots but pickpockets the budget on contact. Shoot him before he escapes to get the money back; his "pills" are a fake pickup (mints). |
| **Aggressive taxi** (user) | A roof meter ticks while it is on screen; a door swing (jump) or a ram; refuses short rides (`TE KORT!`). If it leaves alive, the fare is billed to the budget. |
| **Bakfiets-ouder** (picked) | An e-cargo bike that charges like a tank (bell + `AAN DE KANT!`). The box with toddlers is a shield and the kids are never hurt; every shot into the box costs €1 `LAKSCHADE`, so the player flanks and hits the parent. The kids lob rice cakes. |
| **De Makelaar** (picked) | An estate agent in a sharp suit; plants `VERKOCHT` signs as cover, throws `+10%` bidding paddles, yells `OVERBIEDEN!`. While he lives, 1.5 % of every euro the player picks up flows to him as `COURTAGE`; his death returns the pile. Fits the house-for-sale area (maybe its mini-boss). |

Not chosen this round: run club, speedpedelec (and the other research enemies: padel player, rats,
bike thief, sloep crew, barista, food influencer on foot, natural-wine sommelier, tour group).

### Fines

- **Keep the hit, add a fine.** A handhaver's `BOETE` ticket still kills, as today, and the death
  also costs a fine in euros. (Not chosen: fines as money only; money first and lethal after three.)
- Real amounts are in `research.md` §7 (for example €115 fatbike in the Vondelpark, €140 brommobiel
  on the ferry, €190 a guide stopping on a bridge).

### Budget mechanics

- **Statiegeld bins** (user, confirmed again 2026-10-29): the player **shoots a street bin, and the
  bin explodes or collapses**. Then **cans fly out** (and bottles), bounce on the street and **can
  be picked up for statiegeld**: each pickup adds its deposit to the budget (can €0.15, small
  bottle €0.15, big bottle €0.25). The user's words: "I also want a mechanism where we shoot bins
  and they explode/collapse, after which cans fly out and are able to be picked up for
  statiegeld". Research ideas on top (not decided): the cans stay about 4 s before gulls and rats
  take them; some bins have a lock; a `GEEN STATIEGELD` bag is a jackpot. Deposit hunters are
  never enemies.
- **Toeristenbelasting** (picked): each continue costs a share of the budget, 12.5 % rising to 20 %
  (the 2026 city plan). The end tally is a `JAARREKENING`, stamped `OVERSCHOT` or `TEKORT`.
- **Overbieden auction** (picked): a canal house `TE KOOP` at a checkpoint; stand on the doormat to
  bid while rival bidders raise the price every second; winning opens the door on a weapon crate,
  food or a rare 1UP.
- **Havermelk-bar shop** (picked): a coffee window sells boosts — flat white €3.95 (+€0.50 oat) =
  speed and fire rate, matcha = slow motion, €9 sourdough = full heal; prices rise 10 % per buy
  (`INFLATIE`).

Not chosen: rood staan + deurwaarder (bailiff below €0), the can counter / can cannon, the parking
meter, the bike depot / magnet fishing, the payment-request bubble.

### Areas and set pieces

The user's three, plus three picks:

| Area | Idea |
|---|---|
| **Fort Negen & Zestig** (user) | The parody bakery and its queue. **Hold your place:** a camera lock `DE RIJ`; the queue steps forward every 5 s; line-cutters (influencers, bakfiets parents) try to cut in, and each one that succeeds pushes the player back a place. Reach the counter in time for the last cheese-soufflé brioche (a big power-up), or get `UITVERKOCHT`. Keep the bakery staff friendly; the joke is the queue. |
| **Houses for sale** (user) | Research idea: `TE KOOP: DE BEZICHTIGING`, a vertical climb inside a narrow canal house for sale (steep stairs, a viewing queue per floor, price tags per m²), the 22 m² studio without a kitchen as a hostage room, De Makelaar on the roof terrace. |
| **The Red Light District** (user) | Research idea: `DE WALLEN BY NIGHT`, neon and closed curtains, narrow alleys, dealers, a stag party, `BLOWVERBOD` signs, tour groups stopping on bridges; at 03:00 the neon goes out. |
| **Vondelpark verbodszone** (picked) | Gate sign `FATBIKES VERBODEN (BANDEN > 7 CM)`; the fatbike youths must get off; handhavers measure tyres; bakfiets parents; the open-air stage as a platform. |
| **De Kademuur** (picked) | An old quay wall crumbles behind the player as a chase; a closed bridge, pontoon bridges, a sinkhole that swallows a parked scan car. |
| **De Pont** (picked) | An auto-scroll IJ ferry deck to Noord; rush-hour cyclists crowd on; brommobielen try to drive on and get a €140 fine; a cargo ship's wake rocks the deck; arrival at the shipyard cranes in Noord. |

Not chosen: De Fietsvisser (the bike-dredging crane boat), De Pijp dark-store street, Zuidas,
Koningsdag.

### Gags

- **The €1.900 studio** (picked): a freed tenant says `€1.900 PER MAAND` / `EN GEEN KEUKEN!`; a
  microwave dings in the hallway.

Not chosen: the `SCHAPENSTRAAT` sign with the bleating queue, the handhaver's tyre ruler
(`7,1 CM. BOETE!`), the brommobiel that misses the ferry, and the rest of `research.md` §D.

### Round 3: more ideas (2026-10-29)

The user asked for more mechanisms, ideas and areas. Picked:

| Kind | Idea |
|---|---|
| Mechanism | **Hijsbalk:** a hoist beam on a canal house. Shoot the rope: a piano or a sofa falls on the enemies below, and the load then becomes a platform. |
| Mechanism | **Blauwe envelop:** the tax office's blue envelope floats in. Shoot it open: a refund (+€) or an assessment (−€), a budget gamble. (Name the sender generically, never the real agency's logo.) |
| Enemy | **Huisjesmelker:** a slumlord who literally milks a small house like a cow; throws milk bottles. A candidate mini-boss for the €1.900 studio / houses-for-sale area. |
| Enemy | **Levend standbeeld:** a living statue on the Dam that moves only while the player looks away (faces the other way). |
| Gag / pickup | **Wafel-winkel:** a tourist-trap shop sells a waffle for €14; the shopkeeper throws free cheese samples that heal the player. |
| Area | **Albert Cuyp-markt:** market stalls as platforms; sellers shout `DRIE VOOR VIJF!` and throw fruit. |
| Area | **NDSM-werf:** a shipyard in Noord full of festivals: container studios, graffiti, a hotel in a crane with a hot tub on top. |

Suggested but not picked: fooi-scherm (tip screen), fietsbel (a non-lethal bell button), tramrails,
open bridge, check-in / check-out, wind on the bridges, the social-housing wait-list counter, the
orange wreck label on bikes; the rental-bike tourist, the pigeons on the Dam, the street bollards,
the rain suit; the underwater bike garage at Centraal, Zuidasdok, the tower swing in Noord,
Kalverstraat, houseboats, crooked canal houses.

### Round 4: more ideas (2026-10-29)

The user asked for more ideas again. Picked (areas only):

| Kind | Idea |
|---|---|
| Area | **De 9 Straatjes:** the boutique streets; shops with three items each and a €400 candle. |
| Area | **De foodhal:** an indoor food hall with 30 stands, every one selling an €18 bao. |

Suggested, no answer (not picked): mechanisms fietsendomino (a bike rack falls like dominoes),
gentrificatie-meter (destruction upgrades the street, shop prices rise), ondergrondse container
(the waste-bin pillar sinks like a lift to a secret room), sleutelkastje (shoot an Airbnb key box
open), flitspaal (a speed camera: a fine, or its flash stuns), erfpacht (ground rent on a won
house), glasbak (wine bottles give `GEEN STATIEGELD`); enemies and gags laptop-kampeerder,
koptelefoon-zombie, the heron and the herring cart, hospiteeravond; bosses het cruiseschip, de
biedingsmachine (De Makelaar in a mech), de bakfiets-tank, de havermelkfabriek; areas Schiphol's
security queue, Westergas, IJburg beach, the cruise terminal. The boss is still open.

### Round 5: weapons, vehicles, rescues, events (2026-10-29)

The user asked to brainstorm more. Picked:

| Kind | Idea |
|---|---|
| Set piece | **Het draaiorgel:** a street organ starts to play; every enemy stops and sways to the music for a moment, a free shooting window. |

Suggested, no answer (not picked): weapons and pickups bitterbal-granaat (hotter inside than it
looks), stroopwafel-schijf (a bouncing throwing disc), tulpenbollen-mortier (tulips grow up as
cover), havermelk-schuimkanon (enemies slip on the foam), de snackmuur (a €2.80 kroket heals);
vehicles bakfiets co-op (one pedals, one shoots from the box), a hijacked brommobiel, waterfiets,
huur-sloep; rescues de starter (a house key), de bestolen fietser (a bike bell), de verdwaalde
toerist (a map of the secrets); set pieces bevroren grachten (skating, koek en zopie), the light
festival, omleiding (a detour that loops back), melding openbare ruimte (`WORDT BINNEN 6 WEKEN
OPGELOST`).

## 3. Rules that carry over (from the research and the project)

- Originality (`docs/ORIGINALITY.md`): never name another game, studio or artist. Real Amsterdam
  places may be named under the `ams` exception; brands get parody names (`research.md` §9: no
  Biro, VanMoof, Tikkie, Uber, Oatly, Albert Heijn …). No real private people as characters.
- Behaviours, not groups: dealers and taxi drivers use the mixed look pool; sex workers are never
  shown or targeted; deposit hunters are never enemies; no flags or accents as the joke.
- The gloat rule: enemies never laugh at, point at or film a player's death (`ams-extras.md` §1).
- A queue gag at Fabel Friet itself needs the user's approval first (the shop stays friendly).

## 4. Open for later (not decided)

- The mission's name, slot in the mission order, length and route through the six areas; the boss.
- How the budget replaces the score everywhere (drops per enemy, medals, the high-score table, the
  end screen, 2-player split or shared budget), and the start amount.
- The exact fine per death and what happens below €0 (the bailiff was not chosen).
- De Makelaar's role (a common enemy, the house's mini-boss, or both).
- How the new enemies' tells meet the fairness rules (tell ≥ 18 ticks on screen).
