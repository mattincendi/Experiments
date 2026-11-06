# World Editor

The specification and working record for the world editor (`index.html` in this folder): a standalone
geodesic world editor, also published as a Claude Artifact at
https://claude.ai/artifact/UUJQkUV8n4cQTFrZDUKJ8d. It is a general tool for building worlds; nothing in
it refers to any particular setting.

Read this before changing the editor. The file is one self-contained HTML page (Three.js r128 from
cdnjs; everything else inline). The simulation runs in a Web Worker whose source is the
`<script id="worker-src" type="text/plain">` block; the page code is the last `<script>`.

## Status

| Stage | Name | State |
|---|---|---|
| 0 | Foundations | Built |
| 1 | Plates (with physical motion and plumes) | Built |
| 2 | Boundaries (and crust age) | Built |
| 3 | Tectonic height | Built |
| 3b | Sea level | Built |
| 4 | Erosion | Built |
| 5 | Rock (soil comes with climate) | Built |
| 6 | Sunlight and temperature | Built |
| 7 | Pressure and winds | Built |
| 8 | Ocean currents | Built |
| 9 | Storms | Built |
| 10 | Humidity and rain | Built |
| 11 | Lakes and rivers | Built |
| 12 | Biome | Planned. A placeholder, "Starter biomes", stands in until then |
| — | Custom layer rules, flat-map export | Planned |

## Decisions the user has settled

Keep these unless the user says otherwise.

- **Calibrate to Earth.** Every rule and number aims to reproduce Earth's real proportions and rates
  (plate speeds, ocean depth by age, shelf share, basin sizes, deposit frequency). Worlds unlike
  Earth will come from start-up presets (Earth, a younger Earth, and so on) once all stages exist,
  not from departing from Earth in the rules.

- **Saved worlds rerun stale code.** Each stage has a version number (`v` in `STAGES`), and saves
  record them. A loaded world reruns any stage whose saved result came from an older version, and
  everything after it. Bump a stage's `v` whenever its output changes.

- **Grid:** a Goldberg polyhedron with 100 cells per icosahedron edge: 10·100² + 2 = 100,002 cells,
  12 of them pentagons. Fixed resolution.
- **Both workflows:** procedural-first and blank-canvas. Every stage has Auto / Hand / Off.
- **Biomes:** a real-world list, kept open. Magic, ley lines and the like go in separate custom
  layers, never into the physical stages.
- **Oceanic crust lies below sea level.** Only volcanoes (arcs, hotspots) break the surface.
  Sea level sits at the 0 m datum (Auto); Hand lets the user type a level to flood or drain coasts.
  There is no "ocean share" setting any more; the share is reported, not set.
- **Plate borders are ragged**, never smooth lines.
- **Boundary features take their width from what meets there** (speed, crust, slab age, plate size),
  and vary along the boundary.
- **Crust age:** young at divergent boundaries, old at convergent ones, for ocean and continents
  alike. Lines of equal age are jagged (advanced or delayed by a few cells), not clean parallel
  bands, and age never jumps from young to old across a few cells.
- **A ? button** explains how to use the editor, including the blank-world steps.

## 0. Foundations

**Grid.** Built once in the worker (`buildGrid`). Each icosahedron face is subdivided into barycentric
points (i, j); corners, edges and face interiors get deterministic ids, so shared points are never
duplicated. Points are normalised onto the unit sphere. Each vertex of that triangle mesh is one
cell. For every cell the worker stores, in compressed-sparse-row form (`off` gives each cell's
range): neighbours `nbr` and corner triangles `corner`, both ordered counter-clockwise seen from
outside; plus `pos`, `lat`, `lon`, triangle centroids `cent`, and the mean neighbour angle `spacing`
(about 0.0126 rad, roughly 80 km on an Earth-sized globe).

**Fields.** Every layer is a set of typed arrays, one value per cell:

- `base`: what the pipeline produced.
- `delta` (number layers): the user's edit, added on top. Survives reruns.
- `over` (category layers): the user's paint, 255 meaning "not painted". Survives reruns.
- `lock` (Keep): stages leave a kept cell's base untouched.

The value shown is `base + delta` for numbers and `over`, if set, otherwise `base`, for categories.

**Pipeline.** `STAGES` lists each stage's `reads` and `writes` (layer ids, or `param:<name>` for
world settings). An edit to a key marks every stage that reads it out of date, then everything
downstream of what that stage writes. **Simulate** (or "Run after edits") sends the out-of-date
stages to the worker in order. Modes: `auto` computes, `manual` (Hand) leaves the layer alone,
`off` writes a neutral value. Each stage's result is undoable.

**Determinism.** One world seed; each stage derives its own from `hash(seed + ':' + purpose)`.

**Shared helpers in the worker:** 3-D simplex noise (`makeNoise`) and `fbm`, sampled at the cell's
position so nothing seams at the poles; `bfsFrom(sources, maxSteps, allow)` (distance in steps, with
the nearest source); `gatherW(cell, steps)`; `nearestW(x, y, z, startCell)` (greedy walk to the
closest cell); `rotateAbout` (Rodrigues); `vel(plates, k, x, y, z)` = ω (pole × p) in cm/yr; a binary
heap.

**Contours** (header toggle, on by default): lines every 500 m on land and 1,000 m at sea, every
fifth bolder, the coastline strongest. Each vertex carries a height: the cell's own at its centre,
the mean of the three cells meeting at each corner. So lines run smoothly across cells, drawn in the
fragment shader with screen-space widths, and they fade where they would crowd.

**Time view** (the Time panel on the globe; a view, not a stage). Month (0–12) and hour (UTC)
sliders and Play (an hour every 60 ms, a year in about 25 s).
- **Day and night:** the shader lights the globe from the real sun direction: declination from tilt
  and date, subsolar longitude = (12 − hour)·15°. There is a twilight band and a dark blue night side.
- **Temperature (now):** a transient layer that is neither saved nor sent to the worker.
  - Seasonal part: mid + half·cos(2π(t − 6.5)/12), where mid and half come from the stored January
    and July (it peaks mid-July in the north, mid-January in the south).
  - Daily part: amplitude 3–9 °C on land (3 + 0.12 × seasonal range, so wider where seasons are
    harsh), 0.6 °C at sea, smaller toward the poles; warmest at 15:00 local time.
- January and July stay as stored layers. They are what the view interpolates from, and what climate
  classification (Köppen, in the biome stage) needs.

**Editor:** brushes (Raise, Lower, Smooth, Flatten, Set value, Clear edits; Paint, Clear paint;
Keep, Release; Set motion), inspector, 60-step undo, custom layers (number or categories), views
(cell edges, relief shading, lat/long, kept cells, plate motion arrows), autosave in IndexedDB,
Export/Import as JSON.

**File format** (`format: 'geodesic-world'`, `version: 2`): grid info, params, stage modes, and
each field's definition plus its arrays in base64 (`f32le` for numbers, `u8` for categories and
locks). Version-1 files (before plates) load with Elevation set to Hand, so their terrain is kept.

**Enum codes are shared by page and worker. Append new values; never reorder.**

- Crust: 1 oceanic, 2 continental.
- Boundary: 1 collision, 2 subduction (sinking side), 3 subduction (arc side), 4 island arc
  (sinking side), 5 island arc (arc side), 6 mid-ocean ridge, 7 rift, 8 transform, 9 fracture zone
  (a scar inside a plate; not a plate boundary, and not a source for boundary profiles).
- Landform: 1 trench, 2 volcanic arc, 3 fold belt, 4 plateau, 5 mid-ocean ridge, 6 rift valley,
  7 fault line, 8 active volcano, 9 hotspot chain, 10 fracture zone, 11 continental shelf.
- Feature: 1 Volcano, 2 Crater, 3 Hot spring, 4 Oasis, 5 Waterfall, 6 Cave, 7 Mountain pass,
  8 Landmark, 9 Ruin, 10 Hotspot (painted: adds a plume), 11 Caldera, 12 Geyser.
- Plate: 1–40.

## Legend

A panel under the time controls describes the active layer. Number layers get a colour bar with
five values, read back through the layer's own mapping (log or split ramps label correctly).
Category layers list the categories present, most common first (up to 16). Elevation shows the
hypsometric bar with sea level marked. Short notes explain arrows, contours and grey cells.

## World settings

| Setting | Default | Read by |
|---|---|---|
| Seed | random | everything |
| Radius (km) | 6371 | crust age |
| Plates | 12 | Plates. 0 means only the plates the user painted |
| Generate continents | on | Plates |
| Continental crust | 35% | Plates |
| Random plumes | 6 | Plates (plume list), Elevation |
| Physical plate motion | on | Plates |
| User plumes | none | Plates (placed with the Add plume tool) |
| Sea level (m) | 0 | everything after Elevation |
| Plate motion overrides | none | Plates (set with the Set motion tool) |

## 1. Plates

**Reads** seed, plate count, continental share, generate-continents, motion overrides, and painted
plate cells. **Writes** `plate`, `crust`, `param:plates`.

1. Painted (or kept) plate cells are fixed and seed their plate. Further random seeds are spread out
   with Poisson-disk spacing, up to the plate count. Plate ids above the random count exist only
   where painted.
2. Plates grow from their seeds together, cheapest frontier first (Dijkstra). Each plate has its own
   growth weight; a noise cost field makes borders wander.
3. **Ragged borders:** each cell takes the plate found at a point displaced by 5-octave noise (up to
   about 4 cells). Two majority-vote passes then remove isolated specks. Fixed cells stay put.
4. Each plate gets a random Euler pole and a speed of 1.5–9 cm/yr, and a density used to decide
   which oceanic plate sinks. Set-motion overrides replace pole and speed. (Dragging along d at
   point p sets the pole to p × d, which makes the velocity point along d.)
5. **Crust:** plates are picked at random as continental until they cover a little more than the
   continental share. Then score = ±0.5 (continental plate or not) + noise, cut at the percentile
   that gives exactly the continental share. So coastlines don't simply follow plate borders. With
   Generate continents off, all crust is oceanic until painted.

6. **Inland oceans:** the crust noise leaves oceanic holes inside continents. Earth has a few trapped
   basins (the south Caspian, the Black Sea, part of the Gulf of Mexico) but they are small and rare.
   So every oceanic patch under 1,600 cells becomes continental, except about a third of those up to
   150 cells, which stay as trapped basins.

If there are no random plates and nothing is painted, the world is one still plate.

**Physical plate motion** (`solveMotion`, on by default). Boundaries depend on motion and motion
on boundaries, so the solver iterates 6 times, starting from the seeded motions:

1. Classify the boundaries with the current motions (the same `boundaryGeometry` and `classify` that
   stage 2 uses; the geometry is built once).
2. Apply forces along each boundary's direction:
   - slab pull +1 on sinking sides (2, 4), toward the trench;
   - trench suction +0.35 on overriding sides (3, 5): the sinking slab also draws the plate above it
     toward the trench, which is what keeps continents moving;
   - ridge push −0.5 (6) and rift −0.15 (7);
   - collision −0.5 (1);
   - each plume pushes outward on cells within 6 steps of it (0.08).
3. Each plate's angular velocity = its net torque ÷ drag, where drag = area × (1 + 1.2 × continental
   share).
4. Scale so the fastest plate moves 9 cm/yr, then blend 50/50 with the previous motion.
5. **No ocean–continent divergence.** Ocean floor and continent can only converge or slide past each
   other: a gap between them fills with new ocean floor, which is a ridge with ocean on both sides.
   - **Ridge jump** (rounds 1 and 2): after 6 iterations, wherever an ocean plate pulls away from a
     continent faster than 0.5 cm/yr, the ocean strip within 8 cells of the coast welds onto the
     continent's plate. The coast becomes a passive margin, and the boundary moves into the ocean,
     where it can open as a ridge. Motion is then solved again for the new plate shapes. On Earth
     ridges jump this way, and plates capture strips of ocean floor.
   - **Closing** (round 3): small leftover openings are closed by turning both plates. Each takes
     a share inversely proportional to its drag, so the lighter plate gives more, and plates with a
     Set motion don't move. It sweeps up to 40 times, until nothing opens faster than 0.05 cm/yr.
   - Doing the closing first was tried. It froze the big plates against each other (median ocean
     speed fell to 0.6 cm/yr), because a plate pulled open on several sides can't close them all by
     turning. Jumping first is what Earth does.
   - At the end every free plate is scaled so the fastest moves 9 cm/yr; a uniform scale keeps every
     boundary's type.
   - Checked over three seeds, cells on ocean–continent boundaries that are opening: before 430–568,
     now 1–4. Median speeds: ocean 2.8–5.8 cm/yr, continent 0.4–1.2.

Plates with a Set motion override stay fixed. Tested against Earth: oceanic plates with long
trenches run at 4–9 cm/yr (Pacific 7–10), continent-heavy plates mostly 1–2 cm/yr (Eurasia 1–2,
Africa about 2).

**Plumes.** `P.hotspots` = the user's plumes (`P.plumes`, Add plume tool on the Plate layer; click
again to remove) plus `Random plumes` seeded ones. They are drawn as orange rings on the Plate view.

## 2. Boundaries

**Reads** plate, crust, plates, radius. **Writes** `boundary`, `convergence` (cm/yr, positive =
closing), `crustAge` (Myr).

**Classification.** A boundary cell is any cell with a neighbour on another plate. The "other" plate
is the most common other plate among its neighbours.

- **The border direction comes from a 4-step neighbourhood:** the difference between the centroids
  of the other plate's cells and its own plate's cells, projected onto the surface. A single
  neighbour's direction flips on a ragged border, which used to flip the type cell by cell.
- Relative velocity (own plate minus other, both evaluated at the cell) gives convergence (along the
  direction) and shear (across it).
- Both are averaged along the boundary, over boundary cells within 3 steps that have the same pair
  of plates, so each stretch of border has one character.
- With threshold 0.5 cm/yr:
  - converging, both continental → collision;
  - converging, oceanic meets continental → subduction (the oceanic side sinks);
  - converging, both oceanic → island arc (the denser plate sinks);
  - diverging, two continents → rift; diverging with ocean on either side → ridge on the oceanic side
    and nothing on the continental side. On Earth there is no ocean–continent divergent boundary: the
    gap fills with new oceanic crust, so the ridge sits out in the ocean and the continent's edge is a
    passive margin on the same plate (the Atlantic coasts). The old rule put a rift valley along the
    continent's edge;
  - otherwise, enough shear → transform.

**Crust age, ocean.** A conveyor from ridge to trench.

- Floor is born at a ridge (age 0) and ages at the ridge's half-spreading rate. That rate is
  |convergence| / 2, minimum 0.6, averaged along the ridge.
- Distance to the nearest ridge and the nearest trench (sinking side) are both measured on the
  cell's own plate, as great-circle distances.
- **True nearest sources.** The searches find the source fewest grid steps away. On a hex grid that
  is not always the truly nearest one, and the winner alternates in bands, drawing thin parallel
  streaks. Correction passes (`refineNearest`) let each cell take a neighbour's source whenever that
  source is truly closer. The same applies to the trench and continental searches.
- **Spreading rate is a smooth field.** Each ridge cell's rate is spread over the floor and averaged
  over 20 passes within the plate, so ridge segments with different rates meet without a seam.
- **Fracture zones.** Traced from ridge cells spaced 5–10 cells apart, about half of them. Each trace
  steps to the neighbour with the greatest distance from the ridge (straight out, the way the floor
  spreads). It stops at another boundary, a continent or the plate's edge, or where the floor ahead
  came from a different part of the ridge. Following seams between ridges closed the lines into
  loops, so the trace stops there.
  - The traces are written into the Boundary layer as code 9 and into Landform as code 10, with a
    280 m trough in Elevation.
  - The floor they cut off is grouped into segments, each with an offset of up to ±2 steps of 1.6
    cells. Most traces end before the plate edge, so segments mostly join up and the offsets rarely
    show. Lines of equal age come out smooth and jagged rather than stair-stepped.
  - A smaller fractal offset keeps the lines of equal age jagged everywhere.
  - An earlier version stepped the offset by noise contours; that drew closed loops, not lines.
- Floor with both a ridge and a trench: age = physical age × (1 + (stretch − 1) × f).
  - Physical age is distance from the ridge over the spreading rate.
  - f is how far along the cell sits from ridge (0) to trench (1).
  - Stretch pulls the trench toward the plate's oldest floor, but is capped at 1.6×. Without the cap,
    a trench close to its ridge forced a 0-to-200 Myr jump across a few cells, which drew stripes.
- Floor with a ridge but no trench: the physical age.
- Floor with a trench but no ridge: an old basin, about 200 Myr at the trench, falling slowly away
  from it.
- Floor with neither: about 150 Myr.
- Ages ease into a 200 Myr ceiling (unchanged below 140, then 140 + 60·tanh) rather than clipping, so
  old floor keeps a gradient. Four smoothing passes run within each plate; ridges stay at 0.

**Crust age, continents.** Young where crust is made or remade, ancient far from any active edge.

- Starting ages at the nearest active edge (on continental crust): volcanic arc 40 Myr, collision
  120, rift 180, transform 350, passive margin 500.
- Age rises smoothly to about 3,200 Myr over roughly 1,100 km (distance wobbled ±30% by noise), plus
  ±250 Myr of noise.

The Crust age view gives ocean ages (0–200 Myr) the first three quarters of the colour ramp and continental ages (200–4,000 Myr) the last quarter, so both read. (A log scale was tried first and flattened all ocean floor into one colour.)

## 3. Tectonic height (stage id `elevation`)

**Reads** crust, plate, boundary, convergence, crust age, plates, hotspot count, seed, painted
features. **Writes** `elevation` (m), `landform`.

1. **Base.**
   - **Continents:** low coastal plains rising inland, ~40 m at the coast to ~560 m some 1,500 km
     in (an exponential ramp over 700 km of great-circle distance to the coast, scaled ±25% by
     noise).
   - **Broad swells and basins:** swells reach up to +1,500 m and basins down to −750 m (Earth's
     plateaus stand higher than its basins sink), faded in over the first 600 km from the coast.
   - Rolling hills ±160 m on top; the result never goes below 8 m.
   - **Ocean floor:** −(2,600 + 3,000·(1 − e^(−age/55))) m. That is 2.6 km at a ridge, levelling
     off near 5.6 km on the abyssal plains, so only trenches go much deeper than 6 km.
2. **Margins: continental shelves.** The edge of every continent is drowned continental crust, a
   shelf at −40 to −180 m.
   - Its width varies along the coast with noise, from 1 to 7 cells (about 80–550 km).
   - Within 4 cells of an active boundary (collision, subduction or arc) it narrows to about one cell.
   - Inland of the shelf, height rises back over 2 cells. On the oceanic side, a slope down from
     −1,300 m over 3 cells.
   - About 28% of continental crust ends up under water, close to Earth's share. Those cells get
     landform 11, Continental shelf.
3. **Boundary profiles.** Each cell finds the nearest boundary cell on its own plate, up to 24
   steps. That distance is jittered by ±1.3 steps of noise, so feature edges aren't parallel bands.
   Each boundary cell sets its own strength k = |convergence| / 4 (clamped 0.35–1.4) and an
   along-boundary noise factor nA (0.6–1.4). Then:

| Boundary | Profile |
|---|---|
| Collision | width (0.75 + 0.5k) × (0.8 + 2·min(plate area, 0.25)) × nA. Range (2,300 + 2,100k)·nA, plateau 700 + 500k, foothills 300 over a wider band. Landform fold belt near the border, plateau behind it |
| Subduction / island arc, sinking side | trench −3,200k, width (0.8 + 0.3k)·nA; a low outer rise further out |
| Subduction, arc side | arc at distance (2.5 + 2.4k − 1.6·slab)·nA, width (1.8 + 1.4k)·nA, height (1,800 + 1,500k)·nA, plus uplands 400 + 400k behind it. Slab = the sinking floor's age / 120 Myr: older slabs dive steeper, so the arc sits nearer the trench |
| Island arc, arc side | as above, but nearer and narrower: (2 + 1.6k − slab)·nA, width (1.1 + 0.8k)·nA |
| Ridge | broad and smooth when spreading fast (width 1.4 + 2.4k); a deep axial valley when slow |
| Rift | graben with raised shoulders, wider when pulling apart faster |
| Transform | a narrow scarp of broken ground |

   Mountains (profile above 400 m) get ridged noise on top.
4. **Plumes:** every plume lifts a dome (+750 m, about 6 cells wide, on land or sea). Plumes come
   from `P.hotspots` (stage 1), plus any cells painted Feature → Hotspot. Each leaves 12
   bumps spaced 3 cells apart, carried along the plate's motion by rotating about its pole. Bumps
   shrink by 0.82 per step and are 4,800 m on ocean or 1,800 m on continent. Landform active
   volcano at the hotspot, hotspot chain behind it.
5. Fine relief noise, then one smoothing pass. Heights above 5,200 m and below −8,000 m are
   compressed.
6. **Oceanic crust is pushed below −60 m** unless its landform is a volcanic arc, active volcano or
   hotspot chain.

**Automatic features** (written to the Feature layer's base; painted features win):

- a volcano over every plume;
- volcanoes at spaced peaks along volcanic arcs: about 14% of arc cells are tried, kept only if
  they are the local high point and no other volcano is within 4 steps. These are where a sinking
  oceanic slab melts under the plate above;
- occasional rift volcanoes (2% of rift-valley cells);
- hot springs on land within 4 steps of a volcano (4% chance per cell).

**More automatic features:**
- **Calderas:** a plume under continental crust makes a caldera (a collapsed supervolcano, like
  Yellowstone) instead of a volcano.
- **Geysers:** around plume, caldera and rift volcanoes, 40% of the hot springs are geysers.

Stage 3 writes the `tectonic` layer (Tectonic height). The `elevation` layer people see and sculpt
comes from stage 4.

**Hotspot chains run with the plate's motion, and that is correct.** The plume stays still while the
plate carries each finished volcano away, so older islands lie downstream along the motion, as
Hawaii's chain runs northwest. The user asked whether this was reversed; it isn't.

**Checked against Earth's hypsometry** (share of land in each height band, three seeds):

| Band | Editor | Earth |
|---|---|---|
| 0–200 m | 22–28% | about 28% |
| 200–500 m | 23–27% | about 20% |
| 500 m–1 km | 26–30% | about 25% |
| 1–2 km | 11–14% | about 17% |
| above 3 km | 4–9% | about 5% |
| mean land height | 700–960 m | 840 m |
| ocean deeper than 6 km | 1–2% | about 2–3% |

Before the rework, continents were a flat table (40% of land at 200–500 m, 12% lowland) with
mountains as narrow walls, and 23% of the ocean was deeper than 6 km.

## 3b. Sea level

Auto: 0 m. Hand: the typed value. Everything downstream uses height = elevation − sea level.

## 4. Erosion

**Reads** tectonic height, the user's elevation edits, sea level, Erosion strength (World, 0–2,
default 1×; 0 = none), features. **Writes** `elevation`, `sediment` (m deposited), `flow`
(Drainage: cells draining through each cell), and mountain passes on `feature`.

It works on tectonic height + the user's sculpting, so sculpted ground erodes too. The stored base is
the eroded result minus the user's edit, so base + edit = eroded. Kept elevation cells neither erode
nor receive sediment. Each of 16 iterations:

1. **Route:** Priority-Flood from the sea upward. Every land cell gets a receiver on a path to the
   coast; pits are noted with their fill level.
2. **Drainage area:** accumulated downhill.
3. **Incision:** implicit stream power (Braun & Willett): h ← (h + f·h_receiver) / (1 + f), with
   f = 0.0035 × strength × √area. Big rivers cut deep; hillslopes barely change.
4. **Sediment:** carried downstream and dropped in pits (up to half the depth to their fill level),
   on gentle slopes (12% where the drop is under 25 m), and at the coast (70% on the sea floor;
   anything left spreads over neighbouring sea cells as deltas).
5. **Slumping:** steps over 1,400 m between neighbours shed 15% of the excess.

Then **mountain passes**: saddles at least 1,200 m above sea level, where the ring of neighbours
goes up-down-up-down (4+ sign changes). At most one within 6 steps. Passes are cleared and refound
each run.

The **Drainage** layer (log scale) shows the river networks that stage 11 will turn into rivers. In
a test world the largest basin was about 850 cells (about 5 million km² on an Earth-sized globe,
Amazon-sized). Valleys were cut up to about 2.7 km deep. The stage takes about 0.45 s.

Not yet: rainfall-weighted erosion (needs stage 10); glacial carving.

## 5. Rock

**Reads** crust, plate, landform, boundary, crust age, elevation, sediment, sea level, plumes.
**Writes** `rock`, `resource`, karst (landform 12) and caves (feature 6). Karst and caves are cleared
and refound each run.

Rock, by the first rule that fits:

| Where | Rock |
|---|---|
| Oceanic crust | ocean sediment where sediment > 250 m or floor older than 70 Myr (in patches), else basalt |
| Continent within 5 steps of a plume, or rift valley | flood basalt |
| Volcanic arc, or within 3 steps of an arc-side boundary | andesite |
| 4–7 steps behind an arc (its roots) | granite, some sandstone |
| Fold belt, plateau, or within 7 steps of a collision | metamorphic |
| Erosion sediment ≥ 150 m on land | alluvium |
| Drowned continent (shelves, trapped basins) | limestone below about 34° latitude, shale above |
| Crust older than 1,800 Myr | platform sediment (about two thirds) or bare ancient shield with granite patches |
| Lowland under 500 m | limestone, sandstone or shale (by noise; no limestone above about 40°) |
| Otherwise (uplands) | mostly sandstone and shale, some granite and metamorphic |

**Karst** on limestone more than 30 m above sea level; **caves** in it, about 5% of cells, at least 4
steps apart.

**Resources** (enum, append only: 1 base metals, 2 gold, 3 gems, 4 diamonds, 5 coal, 6 oil and
gas, 7 iron ore, 8 copper, 9 tin and tungsten, 10 uranium). Each kind has its geology and an
Earth-like share of land. Within that geology the cells with the highest values of a slow noise
field (its own per kind, times a weight) are taken until the share is met, so deposits cluster in
districts. Rarer kinds are placed first; one resource per cell.

| Resource | Geology | Share of land |
|---|---|---|
| Diamonds | crust older than 1,800 Myr (kimberlites in shields) | 0.4% |
| Gems | metamorphic or granite | 0.8% |
| Uranium | granite or sandstone on crust older than 1,000 Myr | 0.8% |
| Tin and tungsten | granite, or metamorphic in collision belts | 0.8% |
| Gold | metamorphic, andesite, or old shield rock and granite (greenstone belts) | 2% |
| Copper | andesite or within 8 steps of an arc (porphyry copper) | 1.5% |
| Base metals | andesite, granite, metamorphic, limestone (lead-zinc) | 1.5% |
| Iron ore | crust older than 1,800 Myr (banded iron formations) | 3% |
| Oil and gas | sedimentary rock on shelves, in rifts, forelands, behind arcs, or lowland platform; weight 1 if the old latitude was within 40°, else 0.55; ×1.15 on shelves and rifts | 10% |
| Coal | sedimentary rock on land below 900 m; weight 1 if the old latitude was within 25°, 0.8 at 40–65°, else 0.3; ×1.15 in forelands | 8% |

**Old latitude:** run the cell's plate motion backwards about 310 Myr (the great coal age), assuming
the plate kept its present motion. Real plates wander, so it is approximate. In tests, coal fills
2.4–8% of land depending on how much sedimentary lowland once sat in the tropics.

Planned with climate (stage 5b): salt and potash, lithium brines, bauxite, phosphate.

**Earth check for rock:** sedimentary rock 54–66% of land in tests (Earth about 66–75%), exposed
shield about 14%. Ancient shields carry a platform cover of sediment over about two thirds of their
area. Uplands away from belts are mostly sedimentary too. The arc band (andesite) is 3 steps, the
granite roots behind it 4–7.

Rock enum: 1 basalt, 2 andesite, 3 granite, 4 metamorphic, 5 sandstone, 6 shale, 7 limestone,
8 ancient shield, 9 ocean sediment, 10 flood basalt, 11 alluvium. Landform 12 = karst.

## Climate overhaul: why stages 6–8 were rebuilt

Stages 6–8 used to be a stack of separate latitude-based approximations: a temperature-against-sunlight
curve, a seasonal swing by continentality, a Coriolis turn switched by hemisphere, separate coastal and
equatorial upwelling formulas, band means, warm pools and winter weightings. Each seam drew straight
east–west lines, and patching one exposed the next. They were replaced by a few equations that hold
everywhere, so no rule depends on which hemisphere or latitude band a point is in.

## 6. Sunlight and temperature

**Reads** elevation, sea level, Axial tilt, Sunlight, Warmer/colder, radius. **Writes** `insolation`,
`tempMean`, `tempJan`, `tempJul`, `tempRange`.

A **month-by-month energy balance** (`climateEBM`) on a 2° raster, 48 steps a year, run 3 years to
settle. Each point has a surface temperature Ts and an air temperature Ta:

- Surface: C·dTs/dt = sunlight·(1 − albedo) − γ·(Ts − Ta) − 60 + 0.5·Ts (the window to space) − upwelling
  heat, plus the sea carried by the currents (stage 8 only).
- Air: Ca·dTa/dt = γ·(Ts − Ta) − (A + B·Ta) + D·∇²Ta + air carried in by the wind (stage 8 only).

| Term | Value | Why |
|---|---|---|
| Heat capacity C | sea 5, land 0.15, sea ice 0.6 (W·yr/m²/K) | sea a mixed layer, land a skin |
| Air capacity Ca | 0.3 | |
| Coupling γ | sea 40, land 22, frozen ground under warmer air 9 | the winter inversion lets continents freeze |
| Outgoing A + B·T | A 195 (186 with currents), B 2.1 | |
| Spreading D | 0.45 + 1.0·e^(−(lat/24°)²); × 0.72 with currents | Hadley cells mix the tropics flat; with currents the sea takes part of the transport |
| Albedo | 0.28 + 0.12·sin²lat, rising smoothly to 0.62 with snow below −1 °C | |
| Wind term | 6 × min(2, speed/7) W/m²/K toward the air a day upwind | brings sea air onto coasts |

**Continental winters** (added after the first calibration left interiors near −20 °C while Siberia
reaches −40):
- *Dry air:* the window to space opens by up to 30 W/m² where the air is cold (below 2 °C, full at
  −23 °C) and far inland (1 − e^(−distance from the sea / 1,200 km)), because cold continental air holds
  little water vapour, the main greenhouse gas.
- *Blocking:* the air over a cold interior mixes less with its neighbours (by up to 70%, as inland and
  below 0 °C), standing in for the winter high that keeps sea air out. Each face takes the smaller of its
  two ends' mixing.
- The test worlds' largest continents are 106–148 million km², larger than Eurasia (55), so the mild
  winters were the model's fault, not the geography's.
- Result: coldest lowland January at 50–65°N −18 to −27 °C (was −20 to −24); the world with the most
  high-latitude land reached −35 in one trial.

Land cells read land raster points and sea cells sea points, so coasts stay sharp; −6.5 °C per km of
height on land. Stage 6 runs it without winds or currents; stage 8 runs it again with them.

**Earth check** (seeds 0, alpha and beta, after stage 8, sea-level zonal means):

| Latitude | Editor | Earth |
|---|---|---|
| 0° | 26.5–28.4 °C | 26 |
| 20° | 25.4–25.9 | 24.5 |
| 40° | 15.3–15.8 | 14 |
| 60° | −1.0 to −1.4 | −1 |
| 80° | −17.1 to −17.8 | −17 |
| Land 50–60°N, Jan/Jul | −9 to −11 / 15–18 °C | Moscow −7/19, Winnipeg −16/20 |
| Coldest lowland 50–65°N, January | −20 to −24 °C | Yakutsk −39 (at 62°) |
| Sea's swing, 45–65° | 6.3–6.7 °C | 5–8 |

Continental winters are still milder than Siberia's; the stage takes about 1 s.

## 7. Pressure and winds

**Reads** elevation, sea level, January and July temperature, Day length, Spins backward. **Writes**
`pressureJan/Jul`, `windJan/Jul` and hidden `windJanE/N`, `windJulE/N`.

1. **Belts** from the circulation cells (1, 3 or 5 per hemisphere by spin): equatorial low −4.5 hPa,
   alternating highs +10 and lows −12, polar highs +6; shifted toward the summer hemisphere, further
   over tropical land (the monsoon). **Thermal pressure:** −0.6 hPa per °C land is warmer than the sea at
   its latitude (smoothed band means, sea-level equivalent). 10 smoothing passes.
2. **Wind from one balance:** pressure push, Coriolis f = 2Ω·sin(lat) and friction r cancel:
   u = (r·G − f·k×G)/(r² + f²). r = 2.2×10⁻⁵ s⁻¹ over sea, 1.0×10⁻⁴ over land, plus 4×10⁻⁵ ×
   e^(−(lat/9°)²) for the rain belt's cumulus drag. The turn grows smoothly from none on the equator.
3. **Momentum carried:** 5 passes, each keeping 55% of the wind a day upwind, so the trades keep
   their easterly swing across the equator. Then 3 smoothing passes as 3-D vectors.
4. Scaled to a 7 m/s sea mean; on land × 0.7/(1 + height/2 km), deflected round mountains, cap 25 m/s.

**Earth check** (seed 0, mean over sea): trades −6 to −10 m/s east at 10–20°; equator about −2.3 m/s
east with cross-equatorial flow into the summer hemisphere; westerlies +6 to +7 at 40–50°; polar
easterlies. No hemisphere switch anywhere.

**Upper layer (two-layer atmosphere).** `windUpJan/Jul` (with hidden E/N parts) is the wind about 5 km up:
the surface wind plus the thermal wind (g·H/(f·T₀)) k×∇T, with H = 5 km and T₀ = 270 K. T is the
sea-level-equivalent air temperature smoothed over 14 rings. f is floored at its 8° value, and the thermal
part fades out within 5–20° of the equator, where the balance fails. Capped at 70 m/s. Seed 0 gives upper
westerlies of 19–22 m/s at 30–50° in winter and 8–12 in summer (Earth's 500 hPa mean about 15–25).
`ascentJan/Jul` (10⁻⁶ s⁻¹, + rising) is the convergence of the lower-layer wind (6 smoothing passes) plus
0.25 × ∇²p in hPa per (1,000 km)², capped at ±8 (Ekman pumping into lows, including thermal lows). Rising
air shows in the equatorial belt and subpolar lows, sinking under the subtropical highs and winter
continents. Stage 10 takes its large-scale lift from it (e^(ascent/3), 0.3–4) instead of the pressure
alone; storms are steered by the deep-layer mean, half the lower and half the upper east wind, and
0.15 × lower + 0.35 × upper north wind.

## 8. Ocean currents

**Reads** elevation, sea level, winds, seed and the stage-6 inputs. **Writes** `sst`, `current`
(`currentE/N`), `upwelling`, `seaIce`, `currentHeat`, and rewrites the four temperature layers.

1. **Circulation, on the cells** (rebuilt; there is no latitude–longitude raster any more, so no row can
   draw a stripe). Every cell uses its true edges and area.
   - **Gyres:** Stommel's balance r·∇²ψ + β·∂ψ/∂x = curl τ, with ψ = 0 at every coast and r = 1.4×10⁻⁶ s⁻¹
     (a western boundary layer about 70 km wide plus half a cell). τ ∝ |w|·w from the year-mean wind,
     smoothed over 6 rings; the curl fades within about 4° of the equator. Solved by Gauss–Seidel with the
     β term taken upwind (east faces only, weights exact for a steady eastward change), cells swept east
     to west from the meridian with the most land; 60 sweeps. Centred differences were tried first and
     barely converged (ψ stayed far from zero at coasts). Velocity = k × ∇ψ, scaled so the median gyre
     speed is 0.05 m/s; shelves under 1 km keep 35–100%.
   - **Two layers.** A surface layer (gyres, 1.5% wind drift, the overturning's surface branch) over a
     deep layer that returns it. The drift is left as it is: where the surface layer spreads apart, deep
     water rises into it, and where it piles up, it sinks. That spreading is the upwelling below.
   - **Overturning:** deep sea (over 1.5 km) beyond 45° whose coldest month is between −1.8 and 4 °C sinks
     into the deep layer; the rest of the sea rises evenly to balance it. A pressure φ with
     ∇²φ = rise − sinking (900 sweeps on the energy balance's 2° grid, nothing through coasts) draws
     surface water toward the sinking seas as −∇φ, read back to cells by bilinear differences. The
     pattern spans basins, so 2° is enough, and no rows are integrated. Solving it on all the cells
     took 3 s; this takes about 0.2 s. It replaces the hand-placed poleward current on each basin's
     eastern side.
   - **No coast-following rules.** The surface drift is the Ekman flow (turned right of the wind in the
     north, U = (ε·τ − f·r̂×τ)/(ρ·50 m·(ε² + f²))), not 1.5% of the wind. Its flow across a coast is real:
     offshore it is fed by upwelling, onshore it sinks, matching the Upwelling layer. The gyres (k×∇ψ, ψ = 0
     on shores) and the overturning (−∇φ, no flow through shores) never cross coasts, so nothing has to
     be turned. Earlier versions bent every current along the shore within 1–6 cells; real currents only
     run along coasts where the gyres put a boundary current. This also widened the west–east sea gap to
     5.3 °C on seed 0 (Earth about 5).
   - The warm layer's depth for upwelling is the gyre's accumulated transport |ψ| (÷ its 90th
     percentile), near zero at a basin's eastern coast and largest toward the west, instead of a
     row-by-row position.
   - Currents are averaged into the energy balance's 2° grid to carry the sea's heat. The energy balance
     stays on its 2° grid: on all 100,000 cells it would take minutes, and its bilinear sampling draws no
     stripes (checked).
2. **Upwelling and sinking, one signed field:** the Ekman transport M = (ε·τ − f·k×τ)/(ρ·(ε² + f²)), ε
   the Coriolis value at 2.5° so it stays finite on the equator, τ = 1.56×10⁻³·|w|·w, smoothed over the
   sea. Its spreading (outflow across each cell's true edges ÷ its true area; nothing crosses a coast) is
   the vertical motion: + where deep water rises, − where surface water sinks. January and July are
   computed separately and averaged, then the overturning's sinking is subtracted. The layer runs −1 to
   +1, where 1 ≈ 2 m/day, blue rising and orange sinking. It used to show only rising water, which left
   every sinking sea grey and looking blank. Rising shows along coasts where the wind pushes water
   offshore and along the equator; sinking in the middle of the subtropical gyres, where the wind piles
   water up, and in the cold seas of the overturning.
3. **The warm layer** (`warmDepth`, m): the upper ocean as warm water over the cold deep ocean, its
   thickness h from two steady balances summed westward from each eastern coast (h = 60 m there, 35 m on
   the equator) by the gyres' east-to-west sweep on the cells: off the equator, Ekman pumping thickens it
   into the gyres, d(h²)/dx = 2f²/(g′β) × pumping (Parsons); on the equator the trades tilt it,
   d(h²)/dx = 2τ/(ρg′), with g′ = 0.02 m/s². Smoothed 3 passes, 30–700 m.
4. **Sea surface on the cells:** a 30 m surface layer takes heat from the currents (upwind, from the cells
   it flows in from), trades it with the air toward the winds-only climate (35 W/m² per °C), and where water
   rises mixes in water from below: deep (2 °C) + (surface − deep)·(1 − e^(−h_eff/60 m)), where
   h_eff = h ÷ (1 + rise/8×10⁻⁶ m/s) at coasts (rising water lifts the layer's base there). 70 Gauss–Seidel
   sweeps east to west and back. Warm water flowing into a sea that would freeze dives under its cold
   surface (heat inflow × 0.15–1). Under sea ice the ocean's effect fades out. The world mean of the
   ocean's warming is removed, so it only moves heat.
   - Then the energy balance runs again, its sea surface pulled toward the winds-only seasonal cycle plus
     the ocean's warming (coupling 200 W/m² per °C), so air and land downwind respond; the cell detail
     (the ocean's warming minus its 2° box mean, smoothed 3 passes) is added back on the cells.
   - Both runs (`oceanOn`) let the air carry 85% of its usual heat and lower outgoing heat by 6 W/m², the
     ocean's share of the transport.
   - Tried and dropped: taking the deep ocean's temperature from the sinking seas (a runaway that warmed the
     poles to +30 °C), returning upwelling's heat to the air where deep water forms (11 PW moved, five
     times Earth's ocean transport), and feeding the ocean's heat as a flux (no hold on the polar seas).
     A −1.8 °C floor on the coupling target held every ice-covered sea at freezing, warming poles by 15 °C.
   - **Low cloud** (`lowCloud`): stratus decks where the sea is colder than its winds-only temperature
     (from 0.5 °C, full at 3.5 °C) and below the free tropical air (the mean tropical sea), in a band about
     22° ± 13°. Up to 0.9 cover cuts the sunlight reaching the sea by 40% × cover. Updated every 5 sweeps,
     relaxed by half. It widened the west–east gap only slightly (3.4–4.6 °C on three seeds).
5. **Sea ice:** seasonal where the coldest month is below −1.8 °C; permanent where the year's mean is below
   −12 °C. Perennial ice thaws to about 0 °C on top every summer and survives by being thick, so a
   rule on the warmest month froze every polar sea solid.

**Earth check:** sea surface 26 °C at the equator, 20.5–20.9 at 30°, 11 at 45°, 1 at 60°; western-ocean
coasts at 18–38° are 2.8–4.9 °C warmer than eastern ones (Earth about 5); sea ice 3–10% permanent and
9–25% at most, depending on how much polar sea a world has (Earth 2–3% and 9%).

**Earth check after the currents rebuild** (seeds 0, alpha, beta): zonal means 24–26 °C at 0°, 23–24 at 20°,
15 at 40°, −2 at 60°. Western boundary currents at 20–40° reach 0.7 m/s at their peak (the Gulf Stream's
core is 1.5–2 m/s but only about 100 km wide; a 70 km cell averages it down). Sea ice 2.5–7.5% permanent,
9–25% at most; the high figures are worlds with 9–11% of their ocean beyond the polar circles (Earth
about 5%).

**Known gaps:**
- West–east contrast at 18–38° after the warm layer: western-ocean coasts 3.5–4.4 °C warmer than eastern
  ones (was 1.5–2; Earth about 5). Low cloud over cold upwelling is still missing.
- Coldest continental January −18 to −26 °C (Yakutsk −39).

The pipeline takes about 16 s. A progress card over the globe shows the stage, sub-steps inside the
currents stage, a bar and the seconds so far.

**Seams found while rebuilding:** neighbour directions were used as if every cell were a regular
hexagon. Along the icosahedron's edges (one runs down 180° longitude) the cells are slightly irregular,
so a uniform wind looked like it was spreading there and drew a line of false upwelling. Divergence now
uses each cell's true edge normals and area (`cellGeom`), which is exact for uniform flow everywhere.

## 9. Storms

**Reads** elevation, sea level, seed, January and July temperature and winds, radius. **Writes**
`cyclones` (storms passing within 300 km per decade), `cycloneRain` (mm/yr), `stormTrack` (0–1), and
`param:stormTracks` (up to 400 tracks for the overlay, a point every 12 hours).

**Tropical cyclones:** a decade of storms is simulated, one track each, in 6-hour steps for up to 16 days.
- **Where they form:** genesis potential = (6–11° ramp up, fading by 30°) × how much warmer the sea's
  warmest month is than the mean of the tropical sea within 20° (from −0.5 °C, full at +2 °C). Relative,
  not a fixed 26.5 °C: the air above the tropics warms with the sea, so a storm needs a sea warmer than
  its surroundings (Vecchi and Soden). The fixed threshold formed almost no storms on worlds whose
  tropics run a degree cool.
- **How many:** 850 per decade (Earth about 85 a year) × the world's genesis area ÷ Earth-like 3.4% of
  the globe, at most twice that.
- **Motion:** 70% of that summer's east–west wind and 15% of its north–south wind (steering is the wind
  several kilometres up, which lacks the surface's turn toward the equator), plus a drift of 1.5 m/s
  west and 2.5 m/s toward the pole (the beta drift). Tracks run west in the trades, turn poleward and
  curve east in the westerlies.
- **Strength:** starts at 18 m/s and grows toward eff × (45 + 10 × (warmth − tropical mean + 1.5)) m/s
  (cap 85) over sea within 1.5 °C of the tropical mean; eff 0.35–1 per storm is its wind shear. Decays
  with a 4-day e-fold over moderately cool sea, 1.5 days over cold sea, 12 hours over land; ends below
  17 m/s.
- **Rain:** 6 × speed × e^(−distance/120 km) mm per day within 320 km.
- **Season:** northern storms June–November, southern December–April, for the overlay.

**Earth check** (seeds 0 and alpha): peak strengths 30–35% tropical storm, 35–36% Category 1, 20–23%
Category 2–3, 4–8% Category 4, no Category 5 (Earth about 45% storms, 15% Cat 1, 20% Cat 2–3, 15–20%
Cat 4–5); tracks reach 32–39° latitude; up to 47–62 storms per decade near the busiest coasts (the
western North Pacific gets about 25 a year in all); cyclone rain up to 230–380 mm a year. Strong storms
are too rare because the tropical seas vary too little from place to place: the same weak west–east
contrast as in the currents.

**Winter storm tracks:** where winter air is sharply colder on one side (the steepest change to a
neighbour, °C per 1,000 km at sea-level equivalent) times the westerly wind + 2 m/s, over 22–75° of
latitude, × (0.25 + 0.75 × share of sea within about 1,000 km), since storms feed on warm sea. Smoothed
10 passes; 1 = 140 units. The first version capped the whole 30–60° belt over land and sea alike.

**Overlay:** *Storm tracks* in the view toggles draws the tracks as lines just above the globe,
coloured by Saffir–Simpson category. Storms of the time controls' month are bright, others faint, so
Play steps through the seasons. The storm layers fade into "none" instead of showing grey for zero,
which drew hard lines along the edges of the storm belts.

## 10. Humidity and rain

**Reads** elevation, sea level, January and July temperature, winds and pressure, cyclone rain. **Writes**
`precip` (mm/yr, with cyclone rain), `precipJan`, `precipJul` (mm/month), `humidity` (relative, 0–1).

A steady water-vapour budget on the cells for each month: W = (E + a·W_upwind) / (a + rate), solved by
Gauss–Seidel sweeps in four orders (by longitude and latitude, both ways), 24 sweeps × 7 rounds.
- **Transport** in advective form: the column takes its upwind neighbours' water (weighted by the inflow
  across each true edge) at the rate air passes through. The flux form was tried first and piled all the
  water into the lines where surface winds converge.
- **Capacity** C = 12·e^(0.063·T) mm, with T capped at 25 °C (hotter air convects instead of holding more).
- **Rain-out** per day = (1/8)·lift·(0.1 + 1.6·rh³), plus rain-out of 0.4 × the excess per day above saturation (an air mass crossing onto cold land snows out
  over hundreds of km; at 2 per day it all fell in the first cell or two). Lift =
  e^(−(p − 1011)/7) (0.3–2) × (1 + uphill wind / 3 cm/s, −0.7 to +4). Mountains get rain on their windward
  side because capacity falls with height; lee sides are dry.
- **Convergence:** surface-wind convergence (smoothed 6 passes) multiplies lift by 1 + conv/4×10⁻⁶ s⁻¹
  (−0.6 to +2) and adds a moisture source 0.35·conv·W (the column gathering water as air converges). This
  is what makes the equatorial rain belt; without it equatorial land got 470–620 mm.
- **Evaporation:** sea 0.075·(0.4 + wind/7)·C(SST)·(1 − rh) mm/day; land gives back up to 60% of its rain,
  at most 3.5 mm/day, scaled by warmth (none below −2 °C), iterated over rounds.
- Year = 6 × (January + July) + cyclone rain; cyclone rain falls in each hemisphere's summer month.

**Storm remnants:** over land a cyclone's wind dies (12-hour e-fold) but it keeps a water store that rains
out with a 1.6-day e-fold; the track continues as a grey "remnant low" until the store is down to 5% (about 5 days inland), up to
22 days in all.

**Storm fixes:** shear makes most storms stay weak (eff = 0.3 + 0.7·r^1.4); over cool water in the upper westerlies
(> 3 m/s) storms turn extratropical and decay over 5 days, reaching 38–56°; genesis capped at 1.2× Earth's rate.
Seeds 0 and alpha: 37% tropical storm, 20% Cat 1, 10% Cat 2, 11% Cat 3, 14% Cat 4, 7% Cat 5.

**Earth check** after the two-layer atmosphere (seeds 0, alpha): global mean 1,120–1,220 mm/yr; arid land 31–53%;
sea in the 10° band 2,300 mm. Equatorial lowlands on these supercontinents stay dry (about 400 mm, relative
humidity 0.1–0.2): air reaching their interiors has already crossed thousands of km of dry land, and the
recycling of land rain can't start where there is none. Storms: tracks reach 35°, about 17% reach
Category 5 (too many). The pipeline takes about 23 s.

## 11. Lakes and rivers

**Reads** elevation, sea level, yearly temperature and rain. **Writes** `lake` (1 fresh, 2 salt, 3 salt flat),
`waterLevel`, `river` (m³/s), `runoff` (mm/yr).
- **Open sea:** below sea level and in a water body of 2,000+ cells. Smaller sub-sea basins are land to this
  stage: they hold water only if rain keeps them full, otherwise they stay dry. Other layers still draw every
  cell below sea level as sea.
- **Runoff:** P − ET, ET from Fu's Budyko curve (w = 2.6), PET = 55·T + 120 mm/yr.
- **Routing:** Priority-Flood from the open sea gives spill levels and receivers; runoff is gathered
  upstream-first. Each depression (cells 1 m+ below their spill level, one spill level) gathers its inflow at
  its outlet. If inflow covers 1.3·PET − P over its whole area it fills and overflows (fresh); otherwise it
  fills lowest-first until evaporation matches inflow (salt lake), or leaves a salt flat. One-cell puddles under
  20 m are dropped.

- **Draining:** depressions shallower than 40 m drain through (rivers cut such rims quickly), and an
  overflowing lake is lowered by the gorge its river cuts, 15 m × √(Q_out / 100 m³/s); if that leaves under
  5 m of water the basin is just a river. Lake evaporation is 1.3·PET + 350 mm (wind dries lakes even in
  the cold).

**Checks** (seeds 0, alpha, beta): largest river 180,000–220,000 m³/s (the Amazon about 209,000); land runoff
565–1,000 mm (Earth about 300; rain over land runs high). Lakes 1.5–7% of land (fresh 0.2–0.9%, salt
0.6–6.9%), was 5–19%; Earth about 2–3% including lakes far smaller than a cell. Seed 0's figure is cold
closed basins in its giant continent's interior (0.9 °C): little evaporation, mountain rivers feeding them.

## 12. Biomes (stage id `starterBiome`, kept so saved worlds load)

**Reads** elevation, temperatures (year, January, July), rain (year, January, July), sea ice, lakes, rivers.
**Writes** `biome` and `koppen` (Af, Am, Aw, BWh, BWk, BSh, BSk, Cs, Cw, Cf, Ds, Dw, Df, ET, EF).
- Warmth: mean, coldest and warmest of January/July. Wetness: aridity index AI = P / PET (PET = 55·T + 120),
  and the drier month's rain.
- Ice sheet if the warmest month < 0 °C; bare rock above 4,500 m; tundra (polar desert under 150 mm, alpine
  above 2,000 m) if the warmest month < 10 °C.
- Coldest month < −3 °C: cold desert (AI < 0.25), steppe (< 0.55), mixed forest (mean > 5, warmest > 18), taiga.
- Coldest −3 to 18 °C: desert (AI < 0.12, hot if mean ≥ 18), xeric scrub / steppe (< 0.4), Mediterranean scrub
  (summer rain < a third of winter's, under 1,100 mm), grassland (< 0.75), temperate rainforest (AI > 2.2,
  P > 2,000), temperate forest.
- Coldest ≥ 18 °C: hot desert (< 0.12), xeric scrub (< 0.3), savanna (< 0.6), rainforest (drier month ≥ 40 mm,
  P ≥ 1,600), seasonal forest (≥ 1,300), dry forest.
- Lakes and salt flats from stage 11; swamp/marsh on flat lowland (< 150 m) along rivers over 4,000 m³/s in wet
  climates; mangroves on warm, wet coasts under 40 m; reefs in shallow sea whose coldest month is above 20 °C.
- Köppen uses its standard thresholds with January and July standing in for the extreme months.

**Earth check** (Köppen shares of land; Earth A 19, B 29, C 14, D 22, E 16%): alpha A 13, B 32, C 29, D 10,
E 16; beta A 23, B 45, C 22, D 3, E 7; seed 0 B 36, E 32. Winters run mild, so C takes D's place; the supercontinents
run dry. Tropical rainforest is rare (1–1.5% of land against Earth's ~7%): the equatorial interiors are too dry
and only two months are known, one of them often in the dry season.

## Winters and equatorial rain (second pass)

- **Equinox season.** Winds (stage 7) now also run an equinox season (T = year mean, belts unshifted), with
  hidden `pressureEq`, `windEq(E/N)`, `windUpEq(E/N)`, `ascentEq`. Stage 10 runs all three; year =
  4 × (January + July + equinox) + cyclone rain. With only January and July the equatorial rain belt sat
  15° off the equator in both, and the equator got its rain in neither: equatorial land went from about
  420 to 1,270–1,540 mm (Earth about 2,000).
- **Winters.** Winter blocking now applies to all land (at least 60% of full, more inland) once the air is
  below 8 °C, and dry air opens the window from 8 °C; dryLoss 40, block 0.85. Land at 50–70°N cooled 2–4 °C in
  January; 40–50°N land is still about +3 °C in January (Earth about −6), so continental (D) climates stay
  at 4–11% of land (Earth 22%).
- **Rainforest rule:** drier month ≥ 30 mm and P ≥ 1,700, or P ≥ 2,300. Tropical rainforest 7–14% of land
  (Earth about 7%; was about 1%).

## Mid-latitude recalibration (third pass)

Code constants (`EBM` in index.html) after this pass:

- Spreading is now D 0.75 + Dt 1.6·e^(−(lat/16°)²); it was 0.65 + 1.0·e^(−(lat/24°)²). The tropics stay flat, but over a narrower band.
- kAir is 2.5 (was 6).
- The dry-air window now opens from 15 °C. It applies to all land: coastal land at a quarter of full strength, rising to full strength inland. Air over land is drier than sea air well before it freezes.

Results, model against Earth (zonal means, two test seeds):

| Latitude | Model | Earth |
|---|---|---|
| 0° | 25.7 | 26 |
| 20° | 25.4–26.2 | 24.5 |
| 30° | 21.9–22.3 | 20 |
| 40° | 15.5–15.6 | 14 |
| 50° | 7.1–7.6 | 6 |
| 90° | −20 to −22 | −20 |

The 20–50° bands were about 2 °C warm and are now about 1.5 °C warm.

Land at 40–50°N in January is 1–2 °C; Earth's is about −6. Continental (D) climates remain 4–11% of land (Earth 22%).

Levers tried and dropped:

- Snow albedo on land from +2 °C: poles 3 °C colder, mid-latitudes unchanged.
- Changing A and D alone: this shifts the whole curve, not its shape.
- gamL 14: hotter summers only.

What remains is structural. A diffusive air layer keeps blending winter land air with sea air. The likely fix is to carry continental air with the wind rather than diffusing it, so that a winter high can hold its own cold pool.

**Advection of the air column (tried, reverted).** Physical advection replaced the weak kAir pull: the air relaxed toward the air one day upwind at Ca/1 day ≈ 110 W/m²K. Three variants were tried, none kept:

- *Surface winds, full advection:* the planet cooled (equator 22 °C, pole −28 °C). Surface trades carry cool subtropical air in with no warm return flow aloft, and the layer is the whole column. Cutting D as well made the poles −37 °C.
- *Column-mean zonal wind:* average of the surface and upper winds, along the parallels only. Zonal means were back on target, but the continents turned maritime: land's yearly range at 45–65° fell from 28 to 19 °C, and 40–50°N in January rose from about 2 to 6 °C.
- *Column wind, switching to the surface wind under a winter high:* no gain. The blocking only starts below 8 °C, so it hardly engages at 40–50°N.

The cause is in the winds, not in the temperature solver. January surface winds over land at 40–55°N blow weakly from the south (v ≈ +1 m/s). On Earth, winter winds over these continents blow from the north and northwest: outflow from the Siberian and Canadian highs, plus the stationary troughs over the east coasts. The model has no stationary waves, and its winter highs are weak. The next step for continental winters is therefore the wind stage: a winter high that drives cold outflow (done in the fourth pass below).

## Continental winter highs (fourth pass)

- **Winds (stage 7, v7):** the pressure field has a seasonal term set by continentality. Land fraction is smoothed over about 1,500 km (80 passes). Continentality = clamp((landBig − 0.45)/0.4). Where it is set:
  - Winter hemisphere: +18 hPa × g((|lat| − 50)/15).
  - Summer hemisphere: −7 hPa × g((|lat| − 35)/15).

  These are the Siberian and Canadian highs and the summer heat lows. Their strength follows the size of the continent, not its temperature: temperature alone gave a chicken-and-egg loop, a mild land making only a weak high. Highs now reach 1028–1031 hPa, with sea lows near 1001.
- **Air advection (stage 8):** the air relaxes toward the air one day upwind at kAdv × Ca / 1 day (kAdv 0.35; it replaces kAir).
  - Away from the highs, the column moves with the mean of the surface and upper zonal winds, along the parallels only.
  - Under a continental high, it moves with the surface outflow.
  - Weight b = clamp((p − 1016)/10), applied only poleward of 25–40°, so the subtropical belt over deserts is excluded.
- **Clear skies under highs:** the window to space opens by max(dryLoss·dry, highLoss·b), with highLoss 65. A is 208.

Results on the two test seeds:

- Zonal means: 0° 25.3–25.5, 20° 25.1–25.7, 30° 21.3–21.4, 40° 14.1–14.4, 50° 5.0–6.5, 90° −21 to −23.
- Land at 40–50°N in January: −1 to −2 °C (Earth about −6; it was +1 to +2).
- Land at 60–70°N in January: −18 to −20 °C (Earth −25 to −30).
- Continental (D) climates: 5–11% of land (Earth 22%).

Still to do: winters further inland are not yet cold enough. Stationary troughs downstream of mountains and the east-coast troughs are not modelled.

## Standing troughs (fifth pass)

### Winds (stage 7, v8)

Two standing troughs, both found by looking upwind along the parallel. The direction follows the rotation sign. Samples are taken 6, 12, 18, 25 and 32° upwind.

- **Thermal troughs.** upLand = weighted continentality upwind × (1 − local continentality). In the winter hemisphere it deepens pressure by −10 hPa × upLand × g((|lat| − 50)/13): these are the Aleutian and Icelandic lows off a continent's lee coast. The summer value is −2 hPa and the equinox −5.
- **Lee troughs.** upMt = the highest ground within 18° upwind, less the local height (km, capped at 3). It gives −3 hPa × upMt poleward of 20–35°.

Results on the two test seeds:

- Sea lows reach 988–990 hPa; continental highs reach 1027–1030.
- January surface winds on 35–55° east coasts blow from the north (−0.3 to −3.6 m/s), and west coasts from the south (+1 to +3), as on Earth.

### Coupling to temperature (stage 8)

- The air's north–south motion is the surface wind less its zonal mean, which is the standing-wave part.
- Under a high, weight b fades in over the first ~800 km inland (inland/0.5), so windward coasts keep the westerlies.

Results are much as in the fourth pass:

- 40–50°N land in January: −1 to 0 °C.
- D climates: 4–10% of land.
- Zonal means: within about 1.5 °C of Earth from 0° to 50°; 60–90° is 0.6–3 °C cold.

### What is still wrong

West and east coasts at 35–55° come out about equally cold in January. Earth's west coasts are 8–10 °C milder.

- With advection switched off, west coasts are 0.6–1.9 °C *colder*. Advection adds about 1.6 °C to the west side, so the two end up even.
- The east–west spreading keeps the air almost uniform round each parallel, so there is little contrast for the wind to carry.

Tried and dropped:

- **Full-strength advection, kAdv 1.** The continents turned maritime (yearly range at 45–65° fell from 26 to 17–21 °C), with still no coast contrast.
- **East–west spreading cut to a quarter, as well.** Same result.
- **Inversion only under highs and inland.** Same result.

**Why the west coasts started out colder: height.** On both seeds the west-coast land within ~3° of the sea is higher (1,044 m against 559 on alpha; 460 against 110 on beta). Converging plates raise coastal ranges facing the open ocean. Reduced to sea level at 6.5 °C per km, the January temperatures are:

| | West coast | East coast |
|---|---|---|
| alpha | 5.5 | 2.2 |
| beta | 4.7 | 2.7 |

So the west coasts are milder, by 2–3 °C with advection and 0.4–2.4 °C without. West coasts are near Earth's (Seattle about 5 °C). East coasts are too mild (Boston and Beijing about −2 to −4) because the air arriving from the interior is not cold enough. Next lever: colder continental interiors under the winter highs. Also, the troughs and the upwind search add about 6 s to a run.

## Cold continental interiors (sixth pass)

The interiors' winter is set by how strongly frozen ground under an inversion draws heat from the air above. One lever was tested at a time on alpha, for 60–70°N land in January:

| Lever | Effect |
|---|---|
| Blocking 0.97 | No change |
| Clear-sky loss 100 | No change |
| Advection off | 2 °C colder |
| Inversion coupling 9 → 4 | 8 °C colder |

So land now has its own inversion coupling, gamInvL 4. Sea ice keeps 9, since its leads and cracks keep venting heat (applying 4 to sea ice too made the poles 2–5 °C too cold).

Results on the two test seeds:

- January land: 60–70°N −23 to −27 °C (was −17 to −20; Earth −25 to −30). 50–60°N −16 to −18. 40–50°N −2 to −3.
- Coldest interior: −34 to −35 °C (Earth: Yakutsk −39).
- Land's yearly range at 45–65°: 27–32 °C.
- Zonal means: unchanged at 0–50°. 60° is −2.6 to −5.3 °C (Earth −1).

Continental (D) climates are still 4–11% of land, now held back by cold summers. 60–70°N land in July is 5–6 °C, against Earth's ~13, so those cells class as tundra rather than D.

## Northern summers (seventh pass)

One lever was tested at a time on alpha, for 60–70°N land in July (6 °C; Earth ~13). Ice sheets were checked and are not in that band.

- **The dry-air window.** It opened from 15 °C, so it kept cooling high-latitude land right through summer. It now opens from 5 °C, full at −15. Taking the window out entirely lifted July in the coldest interiors from 4 to 10 °C.
- **Snow off.** This gave +4 °C, but it melts the sea ice and warms the poles 4 °C. Not used.
- **Warm-side coupling, gamLw 16.** Land warmer than the air above passes heat into it less readily than land colder than the air (gamL 22). Used.

Results, July land on the two test seeds:

| Band | Model | Earth |
|---|---|---|
| 60–70°N | 9–10 | ~13 |
| 50–60°N | 18–19 | ~17 |
| 40–50°N | 25 | ~22 |
| 30–40°N | 30–31 | ~27–28 (a little hot) |
| 20–30°N | 33 | 30–33 |

D climates are 13% of land on alpha and 5% on beta (beta has little land at 50–70°N: 51 cells at 60–70°N).

The rest of the 60–70°N shortfall is the sea next door. Seas at 50–70°N are −2 to 6 °C in July, against about 5–12 on Earth. The ocean carries too little heat into the subpolar seas; it has nothing like the North Atlantic Drift.

## Mid-latitude summers (eighth pass)

The warm-side coupling (gamLw 16) lifted every summer by 3–4 °C. One value at all latitudes can only trade the 30–50° summers against the 60–70° ones: at 19, every band moves by about 2 °C.

The fix is evaporation from warm land. Land loses evapL × clamp((Ts − 18)/12) × (1 − 0.5·inland) W/m², with evapL 60, and that latent heat is released into the air layer. Releasing it in full matters: removing it outright cooled the whole planet by about 1 °C. Cool high-latitude summers stay below 18 °C and are untouched.

July land on the two test seeds:

| Band | Model | Earth |
|---|---|---|
| 20–30°N | 30 | 30–33 |
| 30–40°N | 28 | 27–28 |
| 40–50°N | 23 | ~22 |
| 50–60°N | 17.5–18 | ~17 |
| 60–70°N | 9–10 | ~13 (the cold sea next door) |

The equator is at 25.4–25.8 °C, and winters are unchanged.

## Ocean heat reaching the subpolar seas (ninth pass)

The seas at 50–70°N were 3 and −1.8 °C (Earth about 9 and 6), and the currents warmed them by at most about 3.5 °C. There were four causes:

1. **Too thin a carried layer.** The currents carried a 30 m layer exchanging heat with the air at 35 W/m²K, so a 0.1 m/s current lost its warmth within about 350 km. The gyres and the overturning now carry a layer Hc = max(30 m, oceanMixH 400 m × clamp((|lat| − 45)/15)): the winter mixed layer of the subpolar seas. The Ekman drift still carries only 50 m, since it moves only the top of the sea; giving it 400 m swept a deep slab of cold subpolar water toward the equator. Starting the ramp at 35° instead of 45° cooled the 40° seas by 2.6 °C, through the subpolar gyres' cold western currents (the Labrador Current's kind).
2. **Sinking stopped at the winds-only ice edge.** The overturning only sank water that the winds-only climate left unfrozen in winter. Without currents, the subpolar seas freeze, so the drift stopped near 50°. Sinking now fades out only below about −14 °C, and the ice lid and the diving of warm water under cold seas likewise judge only seas far below freezing.
3. **Impossible water temperatures.** Over ice, the winds-only year mean is the air's (−10 to −20 °C), and the currents swept it along as if it were water. The water's target is now floored at −1.8 °C; the lid and diving rules still read the raw value.
4. **Charging the tropics doesn't work.** Charging the delivered heat to the warm seas was tried. Before any correction, the ocean cools every band by 3–6 °C (water rising from the 2 °C deep), so the correction mostly gives heat back. Concentrating it in the tropics made them 28–30 °C. The even correction stays.

Results on the two test seeds:

- Currents now warm 50–70°N seas by 1.5–3.2 °C on average and up to 6–7 °C.
- Permanent sea ice is 6.7% of the sea (was 7.9%).
- 60–70°N land in July is 10.7 °C (was 9.2–9.9; Earth ~13).
- Zonal means: 40° 14.4 and 50° 5.6–5.9 (on target).
- D climates are 14% of land on alpha and 5% on beta.

Equatorial sea temperatures fell to 24.6–24.9 °C (Earth ~27), since the even correction charges every sea for the heat now delivered poleward; air at the equator is still 25.9–26.2.

Still short: 60–70°N seas are −1.1 to −1.6 °C on a yearly mean (Earth about 6).

**Subpolar seas, tried and reverted (tenth pass).**

- *Solving the ocean twice*, judging each sea by the first pass's climate with currents. With the plain freezing thresholds, the second pass shut the warm water out again: at 60°N the warming fell from 3.2 °C to 1.3, because a frozen subpolar sea is a steady state too. With the lenient thresholds it gained almost nothing (permanent ice 6.5% against 6.7%) and cost about 2 s.
- *Deeper winter mixing in the seasonal balance* (Cs 5 → 25 at 45–60°). The seas' seasonal range collapsed to about 2 °C (Earth 5–8), and 60°N still averaged −1.5 °C.

The shortfall is the year-round heat supply: the currents warm the 60–70°N seas by 3–4 °C, where about 8–10 °C is needed.

## Climate: where it stands (published as version 57)

**Scorecard: 17/33 Earth targets within tolerance on both test worlds** (`tests/score.js`). Within tolerance:

- the zonal means at 0–40° and 70–90°;
- continental summers;
- 60–70°N winters;
- sea temperatures at 30–60°;
- the atmosphere's heat transport;
- the polar winter outgoing infrared.

**Robustness** (`robust.js`): fourteen very different worlds run with no failures or NaNs and respond in the physical direction.

**Conservation:** energy is conserved to about 1 W/m², and the air solver converges.

**Known limits.** Each is a structural limit of a one-layer air over a slab ocean, not a bug:

| Target | Model | Earth |
|---|---|---|
| Zonal mean, 50–60° | 1–4 °C too warm | |
| 40–50°N land, January | −9 to −12 °C | −6 |
| Tropical sea | 25–26 °C | 27.5 |
| Coastal seas, 18–38° | 2–4 °C too cool | |
| Seasonal range of the sea, 45–65° | 2 °C | ~5 |
| Perennial sea ice | 7–10% of the sea | ~3% |
| Ocean heat transport at 20°N | ~0.2 PW | 1.6 |
| TOA balance | about −1 W/m² | 0 |
| Wettest mountain cells | 20–25 m/yr | ~12 (record) |

**Run time:** a full pipeline takes about 70 s, most of it the coupled climate's two passes.

## Coupled climate overhaul

Many earlier fixes shared one root: the ocean was solved as a separate, year-averaged step, and its rules judged each sea by the climate it would have without currents. The overhaul puts the air, the sea surface and the sea ice into one month-by-month loop. Planned steps:

1. **Ocean and ice inside the seasonal balance.** Done (first pass, below).
2. Sinking judged from the coupled climate, and the leftover steady solve retired except as cell-scale detail.
3. Winds recomputed from the coupled temperatures.
4. Recalibration to fewer, physical constants.

### Step 1: ocean and ice in the seasonal balance (currents v32, temperature v11)

**Each sea point** on the 2° raster carries:

- A mixed layer of water, Tw, 50 m deep. Poleward of 45–60° it deepens by up to 150 m in late winter (mlH, mlDeep).
- A sheet of ice, hi metres thick.

**Each step, open water:**

- The water is carried by the currents (semi-Lagrangian), at the gyres' and overturning's velocity. The wind's Ekman drift is scaled by 50 m / layer depth, since it moves only the top 50 m.
- It mixes with the 2 °C deep at the upwelling rate (W/m² per °C, from the currents stage). That heat is returned within the same latitude row: upwelling reshapes a belt, and the currents carry heat poleward.
- A low-cloud deck shades the sea only by its excess over its row's mean, because the base albedo already holds each latitude's usual cloud. Subtracting the whole shade made the planet 9 °C colder.

**Each step, ice:**

- Ice grows from the heat conducted up through it. Conduction is kIce / (hi + snowIns): kIce 2 W/m/K, and snowIns 0.6 m of ice-equivalent for snow cover.
- It melts at the top when the top reaches 0 °C (albedo at least 0.42 once ponded). It melts at the bottom when the water arriving underneath is above freezing.
- Water that would cool below −1.8 °C freezes instead.

So whether a sea freezes comes from its own heat budget. The lid, diving and uniform-correction rules are gone from the coupling. The spin-up is two extra years.

**Outputs:**

- sst is the water's yearly mean, plus cell detail.
- seaIce is 2 where the ice never fully melts (lowest monthly thickness > 5 cm), and 1 where it melts each year.

**Sign bug fixed in the overturning.** It solved ∇²φ = rise − sinking but used −∇φ, so the surface water spread *out* of the sinking seas: cold subpolar water was pushed toward the equator (the source of much of the old subpolar chill). With the sign fixed the overturning became a strong heat pump: at its old strength of 0.9, seas at 60–70°N were 9–11 °C and the pole −11 °C. OT is now 0.15.

**Gyres on the coarse grid.** A gyre carries no net water across a latitude, but the 2° boxes average away its narrow western boundary current. Each row's net north–south gyre flow is therefore removed before the flow goes into the balance. (It made no measurable difference once the overturning sign was fixed.)

Results on the two test seeds:

| Zonal means | Model | Earth |
|---|---|---|
| 0° | 26.7–27.1 | 26 |
| 20° | 24.3–24.7 | 24.5 |
| 30° | 20.1–20.7 | 20 |
| 40° | 13.6–13.8 | 14 |
| 50° | 6.2–7.2 | 6 |
| 60° | −1.6 to 0.6 | −1 |
| 70° | −10.1 to −7.3 | −10 |
| 90° | −18.7 to −15.4 | −20 |

- 60–70°N land in July: 11.0–13.9 °C (was ~10.7; Earth ~13).
- Sea seasonal range at 45–65°: 2.4–3.5 °C.
- D climates: 14% of land on alpha, 5% on beta.

Open problems:

- **Too much sea ice.** It is perennial on 10–11% of the sea (Earth ~3–4%).
- **East-coast seas too cold.** Seas off eastern-ocean coasts at 18–38° are about 12 °C (was 16; Earth 17–20). Capping the upwelling's pull per 2° box at 15 W/m²K only gained 1 °C, and warmed the tropics by more than 1 °C.
- **Mid-latitude seas still cool.** 40°N sea is about 10 °C (Earth ~14).
- **Lakes.** The lakes stage reports salt lakes on 4.8% of land. This predates the overhaul (5.8% before it).

### Diagnosis by heat budget (overhaul, between steps 1 and 2)

The method: a test copy logs every term of each sea box's yearly heat budget, then the problem regions are compared with Earth's.

**Sea ice.** Midsummer on the perennial ice: 237 W/m² of sunlight absorbed, 176 W/m² lost straight to the air at the full 40 W/m²K coupling. The top never reached 0 °C, so it melted 0.14 m a year against 0.46 m of growth, and the ice sat at 4 m on every polar sea, Antarctic included. Earth's summer flux over Arctic ice is about ±5 W/m².

**East coasts (18–38°).** Each term was Earth-sized:

| Term | Model (W/m²) | Earth (W/m²) |
|---|---|---|
| Sunlight after cloud | ~200 | ~200 |
| Infrared loss | 66 | 50–60 |
| Turbulent loss | 46 | 50–80 |
| Removed by ocean dynamics | 80 | 50–100 |

The coast was cold relative to the open sea because the air above was 5.2 °C colder than over the open ocean. The cold water's weaker evaporation released less latent heat into its own air column, and the cold air then held the sea cold: a 9.4 °C drop in the sea brought a 5.3 °C drop in the air.

**Two physical fixes:**

1. **Coupling follows Clausius-Clapeyron.** The sea-air coupling is gamS 10 + (40 − 10) × es(T)/es(25 °C), capped at 1.3×. It stays 40 over warm tropical seas and falls to about 15 at 0 °C. Results:
   - perennial ice 10–11% → 3.0–3.8% of the sea (Earth about 2–4%);
   - 40°N sea about 10 → 12.5 °C;
   - east coasts unchanged.
2. **Evaporation heats the air where the vapour condenses.** The evaporation part of the flux, (g − gamS)(Ts − Ta), goes into the air spread over the seas of the same latitude row; only the sensible part heats the air above. Results:
   - the east-coast air is no longer colder than the open ocean's;
   - east coasts 12.2 → 13.3–13.7 °C, now 5–6 °C below the west coasts (Earth's contrast);
   - spreading it over the whole row, land included, was tried first and heated the continents 4–5 °C.

**What this exposed: the polar winter air is too warm.** This was true before these fixes too. Over the 70–90°N sea in winter the air is −10 to −12 °C (Earth's lower troposphere is about −25) and the ice top −14 to −17 °C (Earth −30 to −35). The old ice, perennial and 4.6 m thick, hid it. With the physical budget, the polar sea's ice is 1.6 m and covers 80% of it, and the zonal means at 70–90° are now 4–9 °C warm:

| Latitude | Model | Earth |
|---|---|---|
| 70° | −5.9 to −2.4 | −10 |
| 90° | −14.7 to −10.9 | −20 |

Next to measure: the air's poleward heat transport against Earth's (peak about 5–6 PW near 35–40°).

Also still open:

- Absolute sea temperatures are a few degrees cold in the subtropics and tropics (15°: 23.8–24.1 °C against Earth's ~27).
- The sea's seasonal range at 45–65° is about 2 °C (Earth 5–8).

### Heat transport and the energy budget (measured)

Northward heat transport on alpha, in PW. The total is the top-of-atmosphere imbalance summed from the pole; the parts add up to it within about 0.2 PW.

| Latitude | Total | Air spreading | Wind | Ocean | Earth total |
|---|---|---|---|---|---|
| 20°N | 3.0 | 2.9 | −0.2 | +0.3 | ~4.5 (ocean ~1.5–2) |
| 35°N | 4.3 | 4.0 | −0.1 | +0.4 | ~5.5 |
| 60°N | 2.5 | 2.3 | 0.0 | +0.3 | ~3.5 |
| 70°N | 1.2 | 1.4 | 0.0 | 0.0 | ~1.6–2 |
| 80°N | 0.3 | 0.5 | 0.0 | 0.0 | ~0.4 |

So the air does *not* carry too much heat into the Arctic, and the warm polar winter air is not from over-transport. The ocean carries far too little out of the tropics.

**Energy is not conserved.** Over the last year stored energy changes by only +0.3 W/m², but the top of the atmosphere gains +3.5 W/m² (the version before the coupling fixes: +3.6). Two terms that should sum to zero over the globe don't:

- The air carried by the wind (kAdv): −2.6 W/m².
- The water carried by the currents: −2.2 W/m².

That is about 4.7 W/m², or 2.4 PW, destroyed. Both use the upwind-sampling (advective) form on flows that converge and diverge. That form is exact only for a flow that does neither: where flow converges onto warm air or water it deletes heat.

The loss sits between 40°S and 40°N, per unit area of each band:

| Band | Wind (W/m²) | Ocean (W/m²) |
|---|---|---|
| 40°S | −8.4 | −7.0 |
| 20°S | −3.6 | −2.5 |
| 0° | −1.5 | −4.9 |
| 20°N | −2.6 | −6.3 |
| 40°N | −1.8 | −4.2 |

Meanwhile the ocean deposits +13.3 W/m² around 60°N and +3.9 around 60°S, which is real transport.

The calibration (A, the oceanA offset) has been compensating with a global warming offset. That would leave the tropics too cool and the high latitudes relatively too warm, which is exactly the remaining pattern.

Next: make both carriers conservative, as flux-form transport between neighbouring boxes. Then:

- the ocean's divergence is met by rising and sinking water, explicitly;
- the air column uses only the part of the wind that neither converges nor spreads;
- A is recalibrated.

### Energy leak fixed (flux-form carrying)

**Air.** The wind no longer samples the air a day upwind. Each step:

- Upwind inflow between neighbouring 2° boxes enters the air's implicit solve.
- The face winds are first projected divergence-free: a potential χ with ∇²χ equal to their divergence is solved and its gradient taken off. A column's wind neither converges nor spreads; what converges near the ground rises within the column.
- kAdv (0.35) still scales the strength.

**Ocean.** The same box-to-box form, in two loops of water:

1. **The shallow loop:** the gyres plus the wind's drift (the drift scaled by 50 m / layer depth). The gyre faces are projected divergence-free with no flow through coasts, since a gyre (k × ∇ψ) neither converges nor spreads and what the boxes give it of either is an artefact.
2. **The overturning.**

Where a loop's flow converges, the surplus sinks with its own heat. Where it spreads, water rises at the temperature of what that loop sank within about 15° of latitude. Whatever the latitude windows leave unbalanced is spread evenly over the sea. The upwelling's cold (mix, with Td) and its row-wise return are unchanged.

**What was tried on the way:**

- Rising water at a fixed 2 °C, with an even global return: the raster flow's spurious divergence took 40 W/m² out of the sea (−115 at the equator), and the return put 50–80 back everywhere, poles included. The pole came out at +1 °C with no sea ice.
- One worldwide pool per loop: warm subtropical subduction water (~20 °C) "rose" in the polar seas, +89 W/m² into 80°N.

**Recalibration.** oceanA (−6 W/m², described as the offset for "what the ocean takes from the tropics") turned out to be the compensation for the leak. It is now 0.

**Energy audit after the fix (alpha):**

| Global yearly mean | Before (W/m²) | After (W/m²) |
|---|---|---|
| Top of the atmosphere | +3.5 | −0.13 |
| Air carried by the wind | −2.6 | −1.3 |
| Ocean, both loops | −2.2 | +0.6 |

The air's remainder is the outflow blending under continental highs, which is not divergence-free.

**Zonal means:**

| Latitude | Alpha | Beta | Earth |
|---|---|---|---|
| 0° | 25.4 | 26.9 | 26 |
| 20° | 24.1 | 24.7 | 24.5 |
| 30° | 20.3 | 20.5 | 20 |
| 40° | 14.0 | 14.9 | 14 |
| 50° | 7.5 | 9.4 | 6 |
| 70° | −6.9 | −3.5 | −10 |
| 90° | −16.4 | −12.2 | −20 |

The tropics and mid-latitudes are on target; the poles are still warm. The polar cap's TOA is about −85 W/m² at 80°N (Earth about −100), so the next thing to measure is the polar outgoing radiation. The pipeline now takes about 34 s (was 22).

### Polar radiation (measured)

Polar caps poleward of 70°, in W/m² (temperatures in °C). Alpha's north is shown; beta's north and south are much the same. Earth values are for the Arctic.

| Term | Model, year | Model, winter | Model, summer | Earth |
|---|---|---|---|---|
| Sunlight absorbed | 101 | 0 | 267 | year ~95–100 |
| Outgoing infrared | 186 | 181 | 193 | year ~190–200; winter ~165; summer ~225 |
| Heat imported by the air | 89 | 90 | 85 | year ~100 |
| Surface temperature | −9 | −16 | 0 | winter −30 to −35 |
| Air layer temperature | −11 | −12 | −9 | winter ~−25 (850 hPa) |

The yearly totals are about right. What is wrong is the winter surface, 15 °C too warm, and the outgoing infrared barely changing with the seasons.

The winter surface over sea ice receives 36 W/m² from the air: the inversion coupling gamInv = 9 W/m²K times a 4 °C air-surface difference. Earth's is about 10–15 W/m² of sensible heat plus a few W/m² of extra downward infrared, about 4 W/m²K effective. That is the value land already uses (gamInvL = 4). The earlier test that rejected 4 for sea ice was made with the leaking, thick-ice model.

Proposed: sea ice uses 4 too. Expected: the winter ice surface about 8–10 °C colder, and winter outgoing infrared lower.

**Sea ice inversion coupling set to 4 (applied).** The prediction was 8–10 °C of cooling; the result was 4. The winter ice surface went from −16 to −20 °C, but the air layer stayed at −12 °C, so the gap widened to 8 °C and the downward flux only fell from 36 to 32 W/m².

| Latitude | Before (alpha / beta) | After (alpha / beta) | Earth |
|---|---|---|---|
| 90° | −16.4 / −12.2 | −18.4 / −14.7 | −20 |
| 70° | −6.9 / −3.5 | −7.3 / −3.9 | −10 |

40–50°N land in January is −8 °C (was −2; Earth about −6).

The remaining cause is the warm polar winter air. The linear outgoing infrared (A + B·T) is too low for cold, dry air: at Earth's polar temperatures it would give about 152 W/m² against Earth's 165. The dry-air window applies only over land, and adds 0 over the frozen sea. Next: extend it to sea ice.

## Climate scorecard and consolidated pass

The tools are in `tests/`; `score.js` checks 33 Earth targets on both test worlds.

**First run: 15/33 within tolerance.** The misses fall into five groups:

- **A. Poles warm.** Zonal means at 50–90° are too warm, the winter polar surface is −20 °C (Earth −31), and the polar outgoing infrared barely changes with the seasons (179–194 against Earth's 165–225).
- **B. Tropical seas cold.** The sea is 24 °C at 0° and 23.5 at 15° (Earth 27.5 and 26), and both coasts are about 4.5 °C low. Between 10°S and 10°N the sea surface is 24.0 °C against 29.6 on land (Earth: about 27.5 and 26–27). Over that sea the air layer is 18.6 °C, the surface loses 288 W/m² to the air, and the upwelling's −192 W/m² is returned within the row.
- **C. Seasonal swing too small.** The seas' seasonal range at 45–65° is 2 °C (Earth 5). The mixed layer is 56–60 m in summer and 128–134 in winter; Earth's summer layer is about 20–30 m.
- **D. Too much sea ice.** Perennial ice is 5% of the sea and the maximum 11% (Earth 3 and 8). The excess is in the 70–80°S band, where the ice never drops below about 86% cover, even in summer.
- **E. Ocean heat transport too small.** It is 0.2–0.4 PW at 20°N (Earth 1.6). The shallow loop carries 41.5 Sv across 20°N, but the water it brings up at the equator is 23.6 °C. Earth's upwelled water is about 15–20 °C thermocline water, subducted at 30–40°. With warm return water, the loop carries little heat.

**The solver is not converged.** The polar air's budget did not close: winter −71 W/m² and summer +89 W/m², yet the air moved only 3 °C between the seasons. Each sweep moves the air by only ~0.01 °C, but the answer keeps drifting with more sweeps:

| Sweeps | N polar summer air | N polar winter air | Winter surface |
|---|---|---|---|
| 14 | −9.0 | −11.9 | −19.9 |
| 40 | −6.4 | −11.2 | −16.1 |
| 200 | −4.2 | −12.1 | −13.6 |

So the model has been reporting an unconverged answer, damping the polar seasons; earlier calibrations were made on it too. The cause: the east–west coupling is stiff near the poles, where the boxes are narrow, and point-by-point Gauss-Seidel creeps there.

**Planned fixes, in order:**

1. Solve each row's east–west coupling exactly (a cyclic tridiagonal solve per row, inside each sweep), so the sweeps only settle the weak north–south coupling. Re-run the scorecard and re-diagnose A–D on the converged model.
2. The dry-air window over sea ice (A).
3. A summer mixed layer of about 25 m, from Earth's climatology (C).
4. The shallow loop's return water from where it is actually subducted, at 30–40° (E).

### Fix 1: the air solver (applied)

Each row's east–west coupling, with the surface eliminated, is now solved exactly as a cyclic tridiagonal system, sweeping rows alternately up and down. With 40 sweeps the polar air is within about 1 °C of the 200-sweep answer. With the old point-by-point solver, 14 against 200 sweeps differed by 5 °C in summer. The run takes about 55 s (was 28).

The converged model scores 13/33. The old solver's error had been masking the poles:

| Target | Before | After | Earth |
|---|---|---|---|
| 90° (alpha / beta) | −18.4 / −14.7 | −12.2 / −9.4 | −20 |
| Perennial ice | 5% | 0% | 3% |
| Polar winter surface | −20 | −13 | −31 |

The polar budget, re-measured: the Arctic ice now melts out completely every summer. Open water absorbs 275 W/m² in midsummer, winter ice stays thin, and 20 W/m² of ocean heat is conducted up through it. The summer melt is too strong because melting ice uses a planetary albedo floor of 0.42, a value set when the ice was built; the satellite-measured summer planetary albedo over the Arctic, clouds included, is about 0.5–0.55.

The run now also shows a TOA imbalance of −1.3 to −1.8 W/m² (it was −0.1 before the solver change).

### Fixes 1–4 (scorecard after each)

| Fix | Score | Result |
|---|---|---|
| 1. Melting-ice albedo floor 0.42 → 0.55 | 13/33 → 15/33 | **Kept.** Poles about 3 °C cooler, winter polar surface −13 → −19 °C, some ice survives summer (0.4–0.5%). |
| 2. Dry-air window over sea ice | 15/33 | **Reverted.** The poles went 8 °C too cold, the winter surface −40 °C, perennial ice 9–10%. |
| 3. Summer mixed layer 25 m outside the tropics | 13/33 | **Reverted.** The seas' seasonal range only rose 2.3 → 2.9 °C (Earth 5), so the summer layer is not the main cause, and the poles warmed 1–1.5 °C. |
| 4. Return water from where it sinks | 13/33, then 14/33 | **Reverted.** See below. |

Why fix 2's premise was wrong: the measure of the window is the surface's net infrared loss in an Arctic winter, Earth about 30–50 W/m², and the model's sea ice already loses about 50 without it. That check should have come before the fix.

Fix 4 in two parts:

- A worldwide overturning pool doubled the ocean transport at 20°N (0.4 → 0.8 PW), but the pool came out near 7 °C against Earth's 2 and warmed the poles by up to 10 °C. Water is sinking in seas not yet cold enough, under the lenient leftover sinking rule judged from the winds-only climate; overhaul step 2 has not been done.
- A 25° window for the shallow loop alone gained no transport (0.4 PW) and warmed the poles 1.8 °C.

**State:** fix 1 only, 15/33, identical to the run after fix 1.

**Root causes still to work on:**

- The sinking rule (overhaul step 2). It sets the deep pool's temperature and the ocean's heat transport.
- The polar air too warm in winter and too cold in summer: winter outgoing infrared 175 (Earth 165), summer 202 (Earth 225).
- The tropical seas about 3 °C cold.
- The seas' seasonal range.
- The TOA imbalance of −1.3 to −1.7 W/m², and the 55 s run time.

### Sinking rule (overhaul step 2): tried and reverted

**Measured first:** the model sank water at 50–60° (70–90% of it), judged from the winds-only climate, where those seas freeze (−3.6 °C). In the coupled climate the same water is 5.3 °C in winter and 7.2 °C on a yearly mean. Almost none sank beside Antarctica, though Earth forms about half its deep water there, at freezing.

**Rebuilt rule:**

- Two passes, the second judged from the coupled climate's coldest-month water.
- No cut-off at freezing, so brine-forming seas sink.
- Slopes count from 500 m depth.
- The overturning's deep pool takes each sea's late-winter (coldest) water.

**Result:** sinking moved to 60–80° in both hemispheres at −1.2 °C water, as on Earth. With a worldwide deep pool the rising water is −1.2 °C too.

**But the score fell to 11/33.** The Arctic stayed open all winter: polar winter surface +1.6 °C, ice at most 1.5%. Ocean transport at 20°N was 2.0–2.8 PW. Measured against Earth:

| Overturning | Model | Earth |
|---|---|---|
| Total sinking | 370 Sv | ~25–30 Sv |
| Across 60°N | 54 Sv, carrying 1.85 PW | ~6–9 Sv, 0.1–0.3 PW |
| Across 20°N | 10 Sv | ~17 Sv (Atlantic) |

**Two pieces of physics are missing:**

1. Nothing sets the overturning's strength. It scales with the area that sinks, and with the sinking in the right places it was seven times Earth's. Its shape is wrong too: Earth's is essentially one cross-equatorial cell sinking in the North Atlantic, plus Antarctic Bottom Water.
2. The halocline. Atlantic water entering the Arctic dives under a cold, fresh surface layer, and only 1–3 W/m² of its heat reaches the ice. The one-layer sea has nothing like it, so the warm inflow melts the ice.

The code is back at the fix-1 state (15/33).

### Sinking rule, overturning strength and halocline (applied, 16/33)

- **Sinking rule:** re-applied as above (two passes, coldest-month water, freezing seas sink, slopes from 500 m, worldwide deep pool).
- **Overturning strength:** set by volume. OT = sinkSv (25 Sv for Earth, scaled by the world's ocean area / 3.6×10¹⁴ m²) × R / (200 m × Σ(sinking − mean)·area). The 200 m is the sinking seas' winter layer. Across 60°N on alpha this went from 54 Sv to about 8; it was 16.7 Sv with a 100 m layer.
- **Halocline:** warm water flowing in under ice passes beneath the cold, fresh surface layer, and only a share halo = 0.1 of its excess over freezing reaches the ice. The rest is returned evenly over the sea next step, so the sea's heat is kept.

The score is 16/33. The poles are still 5–8 °C warm (90° −12.9 °C, Earth −20), perennial ice is near 0, and polar infrared is still flat across the seasons (winter 172–177, summer 201).

### Further physics (applied; scorecard 14–15/33)

- **Dry air radiates more (dryAir 15).** Very cold air holds little water vapour, so its column radiates up to 15 W/m² more to space, full at −25 °C. Earth's polar winter air radiates about 165 W/m² where the straight line gives about 150. The land surface's dry window was cut to 15 (dryLoss 15) so that continents keep about the same total.
- **Sunlight absorbed in the air (solAir 0.2).** The atmosphere absorbs about a fifth of the incoming sunlight (75–80 W/m² worldwide). Before, all of it went to the surface: tropical land was 30 °C beside a 24 °C sea. A was then recalibrated 208 → 201 for the same global mean.
- **Halocline-capped mixed layer (mlHalo 25 m).** Seas that froze last winter keep a 25 m mixed layer all year (the Arctic's is 10–20 m in summer and 30–50 m in winter); only seas that stay open convect deep.

Measured on the poles (alpha, 70–90°N, by month): the ice is at most 1.0 m in April (Earth 2–3 m) and melts out by August (Earth keeps about half). Cover is 18% in October and 56% in December. The chain:

1. The June ice surface absorbs about 130 W/m² (Earth about 50–100 under snow and clouds).
2. So the ice melts out, freeze-up comes late, and the winter ice stays thin.
3. About 20 W/m² of ocean heat is conducted up through it, so the winter surface is about −15 °C against −31.

That is the summer surface energy over ice (snow on ice, clouds, melt ponds), detail this one-layer model does not hold. Snow-albedo adjustments moved the poles about 1 °C each, so the remaining 5–8 °C polar warmth is recorded as a limit of the model.

### Any world: robustness, scaling and speed

**Robustness run (`tests/robust.js`).** Fourteen worlds were tested: Earth; tilt 0°, 60° and 90°; sunlight 85% and 115%; spin 0.25× and 3×; retrograde spin; radius 3,000 km and 12,000 km; and a +5 °C offset. All ran with no stage failures and no NaNs. They respond in the physical direction:

- **Tilt 0°:** no seasons and cold poles.
- **High tilt:** poles warmer than the equator, with extreme seasons.
- **85% sunlight:** a snowball. **115%:** hot.
- **Slow spin:** near-uniform temperatures.

**Gaps found and fixed:**

- The air's spreading did not depend on the planet's size or spin. It is now D × (6371 km / R)² × Ω⁻², bounded 0.1–8×; the temperature and currents stages now read the spin.
- `oceanFraction` is an unused leftover; the land/sea split comes from `continentalFraction`.

**Speed.** One run took about 89 s; the currents stage alone took 62 s (climate without currents 11 s, coupled 27, a second pass 14, gyre/sea-surface solves ~10). Two changes:

- The second pass now starts warm from the first one's state (2 simulated years instead of 5), including last winter's coldest water.
- Both ocean loops' inflows are summed once per step, and the air solver uses 24 sweeps (within 0.8 °C of 40).

A run now takes about 70 s.

**Rain (open).** Earth's global mean is about 740 mm/yr (Earth ~1,000), and 56% of land is desert (Earth about a third); both predate this work. Single cells also reach 18,000–24,000 mm/yr over open ocean, from supersaturated columns (water up to 3× capacity) drifting into the subtropical highs. Two things that did not fix it, both reverted:

- Capping the convergence gain at saturation cut global rain by a third and left the spike.
- Capping the column at 1.2× capacity moved the spike to a coast, at 53,000 mm/yr.

The moisture transport needs its own diagnosis.

### Rain (stage 10): three fixes

1. **The ocean rain spike was an oscillation.** Sea evaporation, Ev·(1 − W/C), was taken with the last sweep's W. A calm column under a high (little inflow, little rain-out) flipped between bone-dry and several times saturated every sweep. Diagnostics sampled every 8th sweep only ever saw the high phase. Evaporation is now implicit in W, and the ocean spike is gone; the wettest cells are now on mountainsides (18–25 m/yr; Earth's record is about 12).
2. **The water cycle's size.** Evaporation was about 1.7 mm/day over warm seas, where a bulk formula gives about 4–5. evapSea 0.064 → 0.096, set by Earth's global mean of about 1,000 mm/yr.
3. **Vapour moves with the lower-atmosphere wind.** Vapour fills the lowest ~2 km and travels with the wind there; the surface wind is slowed to 1–2 m/s over land by friction. Moisture is now carried by the surface wind plus vapLift 0.4 × (upper − surface).

| Seed 0 | Before | After | Earth |
|---|---|---|---|
| Global rain | 739 mm/yr | 941 mm/yr | ~1,000 |
| Land median | 166 mm/yr | 497 mm/yr | ~600 |
| Desert share of land | 56% | 34% | ~33% |
| Salt lakes (share of land) | 4.8% | 0.06% | |

**Still off:**

- Land rain by latitude: 20–30° is too wet (1,060–1,280 against Earth's ~500–700), so hot desert is only 3–4% of land; equatorial land is too dry (1,075 against ~2,000).
- The biggest river is 490,000 m³/s (the Amazon is ~210,000).

### Snow on sea ice (applied; scorecard 17/33)

Snow lies on the ice from the autumn freeze until it melts in early summer. Top melt goes into the snow first; it holds about 8 cm of water (snowMelt 0.85 W·yr/m²), and while it lasts the ice is bright (snowAlb 0.65, the planetary albedo of snow-covered sea ice seen from space, clouds included). Only then does the ice itself thaw, ponded and darker (iceAlb 0.55).

| | Before | After | Earth |
|---|---|---|---|
| 70° | −3.6 | −9.5 / −8.4 | −10 |
| 80° | −11 | −16.9 / −15.8 | −17 |
| 90° | −12.5 | −18.3 / −18.2 | −20 |
| Winter polar surface | | −25 / −28 | −31 |
| Winter polar infrared | | 167–170 | 165 |

The ice now survives summer too well. 70–80°N stays 92–100% covered (Earth's Arctic drops to about half in September), perennial ice is 7–10% of the sea (Earth ~3%), and continental winters are colder: 40–50°N land in January is −9 to −12 °C (Earth −6). The snow values are Earth's observed ones and are kept rather than tuned to the ice target.

### Any world, second round

**Size and spin.** The first round's spreading scaling (∝ 1/R², 1/Ω²) was too strong. A 3×-spin world's pole came out at −67 °C beside a 32 °C equator, and a 12,000 km world's at −57. Climate-model experiments on such planets find the contrast grows gently: four times Earth's spin widens it from about 40 to 60 °C. Spreading is now ∝ (R_E/R) × Ω^(−2/3), bounded 0.15–6×. Those worlds now give −45 and −43 °C.

**Rain spikes on other worlds.** Two causes:

1. **Uplift factors multiplied.** Rising air from converging winds and from slopes were multiplied, so a jet driven up a coast in a convergence zone got 20× the rain-out. They now add, with the total capped at 6.
2. **Stalled cyclones.** On a tilt-0 world (no seasons) storms form all year at the same latitudes. Near 5° the steering wind and the westward/poleward drift cancel, and a storm could sit still for its whole 26-day life: 99,567 mm/yr of cyclone rain in one place. A storm moving under about 4 m/s churns cold water up from below and starves itself (its cold wake): the strength the sea can feed falls with forward speed, to 15% when stalled.

| World | Wettest cell before | After | Cyclone rain, most anywhere |
|---|---|---|---|
| Tilt 0° | 105,526 mm/yr | 20,231 (orographic) | 12,793 |
| Radius 3,000 km | 63,978 | 24,792 (a 4,300 m mountain) | |
| Earth | | ~20,600 (orographic) | 1,167 |

The orographic maxima, 20–25 m/yr, are about twice Earth's record (~12).

**Tried and reverted:** warm-land evaporation 60 → 110 W/m², on Earth's tropical-forest value. It cooled the subtropical deserts' summers (which hardly evaporate on Earth) and left the tropical sea unchanged.

### Visual checks

- **The year's rain showed parallel east–west stripes** over the southern ocean. The yearly total was built from three snapshots (January, July and the equinox, each standing for four months), so each narrow rain belt was counted at three latitudes. The moisture stage now runs five states, the three seasons plus the two halfway blends between them, weighted 3, 2, 2, 2 and 3 months, so the belts sweep the latitudes they pass through. Some faint banding remains.
- **The sea-temperature and ocean-current layers coloured land as 0.** Layers can now be marked `seaOnly`, and their land cells are shown greyed like empty sparse cells.
- **The square blocks seen over land** in several layers were the relief shading of blocky mountain terrain, not climate data. With shading off, the climate fields are smooth.

### Layered atmosphere and ocean (work in progress, not published)

The energy balance now has two air layers and a three-layer ocean.

- **Air.** A lower layer (Ta) and an upper layer (Tu), both at sea-level equivalent. They stir together when air rising from the ground (the warmer of the ground and the lower air) is as warm as the air aloft, and hardly at all under an inversion. Evaporation's heat is released aloft. The lower layer's share of the outgoing infrared falls from half in cold, dry air to 15% in the moist tropics (olrU 0.5 to olrUw 0.85). Warm, humid air also closes the surface's window by up to 20 W/m² (asWet), with the total outgoing infrared unchanged.
- **Sea evaporation.** It runs on the air's dryness: air at 80% humidity evaporates a sea of its own temperature as if it were 4 °C colder (dq0). The evaporation strength was recalibrated to match (gam 30). Tropical evaporation now measures about 120 W/m², with the air 1.2 °C below the sea.
- **Ocean.** A mixed layer (Tw), a thermocline down to 500 m (Tt), and the deep (the overturning's pool).
  - The wind's drift in the top 50 m returns beneath it, in the thermocline. Where the drift spreads apart, thermocline water rises; where it piles up, mixed-layer water is pushed down.
  - The mixed layer takes in thermocline water as it deepens and leaves its water behind as it shoals.
  - Upwelling's mixing now draws on the thermocline rather than a fixed 2 °C, and the row-by-row return (oRet) is gone.
  - Currents carry heat sized by the box the water leaves, so they conserve it exactly.
  - Spin-up carries each year's thermocline change on as if ten years had passed (ttAcc 10). Shrinking the thermocline's heat capacity instead gave a different, false balance.
- **Energy audit.** Stored heat over the recorded year matches the top-of-atmosphere imbalance, so nothing leaks.

What it gets right: the sea's seasonal range at 45–65° (about 5 °C, against 2 for the single slab) and the ocean's heat transport across 20°N (about 1.6–2.3 PW, against 0.2).

What's still wrong, in the true balance (a 6–10 year spin-up, TOA about +0.5 W/m²):
- The world is cold: equatorial sea 23 °C, sea at 60° about 1 °C, sea ice at its most 17–20%. The score is 8–10/33.
- An earlier reading of 17/33 came from a thermocline that hadn't settled.
- The deep is diagnostic: heat the thermocline mixes down (kTd) is returned evenly to every sea's surface, about 6.6 W/m², polar seas included. Turning that up warms the poles only by acting as a false heat pump (kTd 1.5 gives 15/33, with 5 PW of ocean transport).
- **Next:** a deep layer with its own temperature, warmed by mixing from above and returned by the overturning's upwelling. Then the hot equatorial land beside a cold sea.

**The deep layer (added).** The deep (Tdp) is one body of water below 500 m with its own temperature. The cold seas' late-winter water sinks into it, the thermocline mixes slowly down into it (kTd 0.06, the measured interior mixing), and the overturning's upwelling drains it.
- Each spin-up year the deep moves halfway to the temperature at which its gains and losses balance. Setting it straight to that temperature made it lurch by 2–4 °C from year to year.
- The old even return of 6.6 W/m² is gone. With kTd 0.5 the deep settled at 8.9 °C; with 0.06 it settles at about 3 °C.
- The gyres now also carry the thermocline, at 30% of their surface speed (gyreT). That is how mid-latitude winter water reaches the equator underneath.
- A recalibrated to 196.
- The thermocline's spin-up speed-up now extends each latitude band's yearly change 20-fold. Extending each box's own change only amplified fast local swings.

Measured with the default three-year spin-up: 15/33. The thermocline's mean is still rising about 0.5 °C a year when the recorded year starts, and the deep with it, so TOA is about +1.9. With a six-year spin-up and box-by-box extension the score was 21/33, at TOA +3.5.

Still open:
- The settled state needs decades, which the spin-up can't yet reach in a few years.
- Ocean transport across 20°N is only 0.4–0.6 PW.
- Sea ice reaches 14–17% at its most.
- The tropical sea is about 2 °C cold, and the equatorial land hot.

**Settling the thermocline (added).** Each spin-up year, each latitude band is moved straight to where its heat would balance: the year's net gain divided by how strongly it trades heat with the layers around it. The step is 2.5 times that, because each plain step closed only about 40% of the gap, and it is capped at 1.5 °C a year. The deep's water now rises through the thermocline on its way up, as in the real ocean, instead of skipping it.

Long runs show what the settled state is:
- Without the rising-through change, a 30-year run settled with the thermocline averaging 16.8 °C and the deep at 8–13 °C. The world was 3 °C too warm, the sea's seasonal range was 2.5 °C, and there was almost no ice.
- With it, a 20-year run is still warming: the thermocline averages 18.5 °C and the deep 6.5–10.7 °C.

Root cause: the deep's sinking temperature rises, about 2 °C at first and 5–12 °C later. The sites where the overturning sinks are fixed by the currents stage, whatever their water's temperature. A warmer deep rises through the thermocline and warms the subpolar seas, and their winter water then sinks warmer, so the loop feeds on itself.

On Earth only the densest water sinks: near-freezing, salty water off Antarctica and in the Nordic seas. So the deep is held near 0–2 °C however warm the rest of the ocean gets.

Next: make deep water form only where the sea is dense enough. Then recalibrate A against a settled run.

**Dense-water rule (added).** Only water at 2 °C or colder in late winter feeds the deep (denseT). Warmer sinking water goes into the thermocline. The deep's share of the rising water (fD) matches what it receives.

A 20-year run is still not settled:
- The share of sinking water dense enough for the deep falls from about 0.5 to about 0.2.
- The deep still warms, from 1 to 6 °C.
- The thermocline still rises, to 16.3–16.9 °C.
- The score is 10/33, with TOA +1.7.

With little dense water reaching it, the deep is set mostly by slow mixing from the thermocline, so it follows the thermocline up. The thermocline's own warming is now the root to find. A heat budget per band would show whether summer water left behind, the drift pushing warm subtropical water down, or the gyre carrying the thermocline supplies the steady gain that upwelling can't remove.

**Thermocline heat budget by band, measured (20-year run, W/m² into the thermocline):**

| Band | Total | Main terms |
|---|---|---|
| Equator | +3.7 | mixing from the warm sea above +12.7, cooler return flow −8.4, deep −2.5 |
| Subtropics | +0.3 | subduction +11.4, gyre −8.5 |
| Mid-latitudes | +2.3 | return flow +4.8, gyre +4.5, subduction −4.6 |
| Subpolar | +7.1 | return flow +11.9, gyre +5.3, water left behind in spring −7.3 |

The subpolar band gains steadily and nothing resets it in winter, because the model allowed cold surface water to sit on warmer thermocline water.

**Convection (added).** Open water colder than the thermocline beneath it overturns and mixes with it, with heat conserved. Seas under a halocline are skipped. With it, a 20-year run gives:
- the thermocline at 14.7–15.1 °C, against 16.3–16.9 before;
- the deep at 4–6 °C, against about 6;
- a score of 13/33, against 10, with TOA +1.6.

It is still not settled: the thermocline rises about 0.07 °C a year and the deep follows it. The remaining gains are the return flow and gyre carrying mid-latitude thermocline water poleward, and the equator's mixing.

**Two-level thermocline (added).** The thermocline is split at 250 m (Hmid).
- The upper level (Tt) is fed from the surface as before.
- The lower level (Tl, 250–500 m) is filled by winter convection where convection reaches below the upper level, and carried by the gyres at 15% of their surface speed (gyreL).
- The deep's water rises through the lower level, then the upper one.
- The two levels mix at kTl 0.2 W/m² per °C, and the deep mixes with the lower level at kTd 0.06.
- The lower level is settled by band each spin-up year, like the upper one.

A 20-year run:
- The deep holds at 1–1.4 °C (Earth about 2) and the lower thermocline at 8–8.8 °C, both steady. The deep's runaway is gone.
- The upper thermocline still creeps up, to 15.0–15.3 °C, at about 0.04 °C a year, with TOA +1.3 to +1.8.
- The score is 14/33.
- The world is about 1–2.5 °C warm in the tropics and mid-latitudes, and the land in July 2–5 °C warm. The equatorial sea is still 1–2 °C cool.
- The ocean carries only 0.3–0.5 PW across 20°N.

**Ocean heat transport across 20°N, measured by part.** The scorecard's old figure counted only heat moved within the mixed layer. The corrected scorecard (scpatch.py) counts what the sea gives up to the air, so it covers every layer: about 0.6 PW. By part, in PW:

| Part | Before | After the fix |
|---|---|---|
| Mixed-layer gyre | 0.11 | 0.11 |
| Thermocline gyre | 0.19 | 0.19 |
| Lower-thermocline gyre | 0.05 | |
| Ekman drift | +4.6 | +4.4 |
| Its return beneath | −4.15 | −4.0 |
| Overturning | 0.07–0.13 (1.2–1.8 Sv) | 0.3–0.5 (4.6–7.2 Sv) |

- **The Ekman drift** carries 46 Sv poleward (Earth about 20–30). But its return beneath is only about 2 °C cooler than the surface (Earth 6–8 °C), so the loop nets only 0.4 PW. The upper thermocline at 20°N sits too close to the surface temperature.
- **The overturning** was sized as 25 Sv through a 200 m layer, but it was carried with the mixed layer's 50 m, so only a quarter of it flowed. Fixed: its upper limb is now 200 m (ovH). It now carries 4.6–7.2 Sv and 0.3–0.5 PW across 20°N.

With that fix the default three-year run scores 17/33, at TOA +3.4 to +3.9 (not settled).

Next: why the upper thermocline at 20°N is only about 1.6 °C below the surface. Subduction and the upwelling's mixing tie it to the surface; on Earth it is fed by water subducted further poleward.

### Test-tool leak found; the real model re-measured

The scorecard patch (polr.py) had restored the old line in which the overturning's upwelling reaches the mixed layer at the deep's temperature. Every test copy since commit 69a266f therefore leaked about 3.9 W/m², and ran colder than the real editor. Found by switching each flow on alone: only the overturning leaked, and its own books balanced exactly. Fixed. The ocean's books now close to 0.02 W/m², and A = 196 was tuned against the leaky copies.

Also fixed while hunting:
- Water flowing on from under ice leaves at −1.8 °C.
- The thermocline's thickness mismatch (about 0.4 W/m²) is counted and returned.
- Warm sinking water goes into one intermediate pool (Tint).

**The real model, 20-year run, at A = 196:**
- Too warm by 1–3 °C at low and mid latitudes. Alpha's Arctic stays near 0 °C with almost no ice.
- The sea's seasonal range at 45–65° is 2.7–2.9 °C.
- Still warming: the upper thermocline rises 13.9 → 16.2 °C and the lower 5.9 → 9.2 °C, with the deep up to about 5 °C.
- The dense share fD falls to 0.03–0.11: almost no sea gets cold enough to feed the deep, so slow mixing warms it.
- Score 11/33, TOA +0.5 to +0.8.

Next: recalibrate A upward (back toward 201) against this corrected model. That cools the world, brings back ice and dense water, and should stop the deep's warming. Then re-check against a settled run.

**A against settled 20-year runs:**

| A | Score | TOA (W/m²) | Settled? | Notes |
|---|---|---|---|---|
| 199 | 16/33 | +0.2 to +0.3 | yes | upper thermocline 11.6 °C, deep 1.1 °C; alpha's Arctic warm (90° at −4.9 °C) |
| 201 (kept) | 17/33 | 0.0 | yes | upper thermocline flat at 11.4 °C, deep 0.4 °C, dense share 0.36 |
| 203 | 7/33 | −0.3 | no | too cold, the lower thermocline still drifting |

At A = 201 the zonal means at 0–60°, the sea's seasonal range (5.2–5.7 °C), ocean transport across 20°N (1.4–1.9 PW) and TOA all pass.

Still off at A = 201:
- The tropical sea: 23–24 °C at the equator against 27.5.
- Coastal seas at 18–38°: 2–5 °C cool.
- Sea ice: 14–18% at most against 8.
- Alpha's North Pole: −8.5 °C against −20.
- Continental winters at 40–50°N: −12 to −14 °C against −6.

The default three-year spin-up does not reach this settled state: it scores about 12/33.

### Interface overhaul

- **Left panel in four tabs:** Layers, World, Climate, Pipeline. The tab is remembered in the browser. Climate holds day length, spin direction, tilt, sunlight and the warmer/colder offset.
- **Top bar:** a Globe / Map switch (also the G key), and one Show menu for the overlays (cell edges, relief, contours, graticule, kept cells, plate arrows, storm tracks).
- **Flat map:** an equirectangular map drawn by the same mesh. The vertex shader unrolls each cell around its own centre's longitude, so cells at the map's edge stay whole. Lines unroll point by point, so a short line crossing the map's edge can stretch across it. Picking intersects the map plane. Drag pans and wraps east–west; scroll zooms; the map opens fitted to the window, centred on the side of the globe that was facing you.
- **Help rewritten:** quick start, the screen, getting around, how the world is built, the two ways to start, a reference for every layer group, and shortcuts.

### Published as version 58

**Robustness fixes (all 14 test worlds now finite and sensible):**
- The thickness-mismatch heat is no longer returned. It fed on itself.
- Summer warmth kept back from sinking water is capped at 60 W/m² per box (demonCap).
- Water passing under ice that melts it all leaves at the box's own temperature.

**Calibration:** the albedo before snow is 0.23 + 0.25·sin² of latitude (Earth's measured cloud-included values), with A = 203.

**Scorecard: 20/33.** Passing now:
- the equatorial and 15° seas;
- ocean heat transport;
- the sea's seasonal range;
- zonal means from 40° to 80°;
- the polar winter.

Still off:
- Tropical zonal air 2–4 °C warm.
- Coastal seas at 18–38° cool.
- Sea ice 16–19% at most (Earth 8).
- Continental winters at 40–50°N about −12 °C (Earth −6).
- Polar summer infrared low.

**Tried and reverted this round:**
- halving the upwelling mixing;
- solAir 0.17;
- evapL 100 and 140;
- a moist-convection offset for the upper air (6 and 9 °C), which cooled everything;
- land evaporation by rising air, which barely moved the tropics and chilled high-latitude summers.

### After version 58: the remaining errors, measured

**Kept:** melting-ice albedo 0.5, scorecard 21/33.

**Tried and reverted:**

| Change | Result |
|---|---|
| Land–air coupling gamLw 30, 45 | cooled summer land too much |
| Evaporation from 10 °C at 80, 100 W/m² | little effect |
| Land 0.06 brighter, A 198–203 | fixes the tropics but cools the planet; rebalancing A brings the tropics back |
| Halocline mixed layer 35, 45 m | no effect |
| Halocline pass-through halo 0.2, 0.3 | no effect |
| Snow albedo 0.60 / 0.63 | ice too small, polar winter too warm |
| D 0.85, 0.95 | trades errors |

**Measured:**
- **Tropical land in alpha and beta is high** (700–1000 m mean), and at sea-level equivalent runs 31–34 °C beside a 26–27 °C sea. It absorbs as much sunlight as the sea.
- **Sea ice has no seasonal thickness cycle.** At 75–90°N it is about 4.7 m in March and 4.9 m in September (Earth about 3 and 2), and at 65–75°N 84–88% survives summer.
- **The polar summer surface averages −1.3 °C**, so it rarely melts. The snow (0.65) stays on, and the air above sits near −1 °C.
- **Polar summer outgoing infrared stays at 203–208 W/m²** in every test (Earth 225). The upper air over the summer pole is about +2 °C at sea-level equivalent, where Earth's is about +15 (−20 °C at 500 hPa).
- **The missing piece is warm-air advection from the summer continents into the polar cap**, which on Earth starts the melt. It is a structural fix, not a setting.

### Workarounds retired; land albedo; snow builds gradually

- **Snow on sea ice now builds up over about half a year of freezing weather**, not all at once after any cold step.
- **Measured:** snow covered 86–100% of the polar ice all summer at 0.65 albedo, and the ice was 5.5 m with only 0.25 m of summer melt. The June surface keeps only about 80 W/m² against Earth's 150. Snow albedo is a strong lever: 0.62 brings perennial ice to Earth's 3%, but warms the whole planet.
- **The single-layer era's workarounds are retired.** The continental-winter window under highs is off (highLoss 0), the dry-air window is off (dryLoss 0), and winter-high blocking drops from 0.85 to 0.3. With the two-layer inversion they overcooled continental winters, to −12 °C at 40–50°N.
- **Land is 0.06 brighter than sea** (landAlb), and A = 202.
- **Scorecard 21/33**, now passing continental winters at both 40–50°N and 60–70°N, and the tropics in alpha.

Still off:
- Beta's tropics, 28 °C.
- Summer land at 20–40°N, 2–3 °C cool.
- Coastal seas.
- Sea ice: 3–14% perennial, 14–18% at most.
- Polar summer infrared.

### Seasonal layers

- **Sea ice (now):** stage 8 stores each cell's ice season (iceFreeze, the month it forms; iceMonths, how long it lies) from the coupled ocean's monthly ice. The layer shows ice or open water for the Time slider's month.
- **Snow cover (now):** a snowpack is run month by month on the main thread from the stored January and July temperature and rain, over three years so it settles.
  - Snowfall is the precipitation share below freezing: all of it below −2 °C, none above +2 °C.
  - Melt is 4 mm of water per positive degree-day, with days scattered about 4 °C around the monthly mean.
  - It is shown as snow depth at 0.3 cm per mm of water. Packs that never melt are capped at 20 m of water; those are where glaciers will form (next step).

### Glaciers and ice sheets (stage 11)

- **Where ice builds up:** where the yearly snow budget (the same snowpack as the Snow cover layer) is positive.
- **Thickness:** the plastic-ice profile from the distance to the ice's edge, H = √(2τd/ρg) with τ = 100 kPa, capped at 4.8 km.
- **Height feedback:** the budget is recomputed five times over the raised, colder surface (6.5 °C per km).
- **Biomes:** the Ice sheet biome now follows the ice (iceThick > 0). Land below freezing all year without ice is polar desert.
- **On the test worlds:** ice covers 6.4% of alpha's land and 3.4% of beta's (Earth about 10%), up to 2.4–2.8 km thick.
- **Fed back into the climate (version 63):**
  - Ice-covered land keeps a 0.65 albedo all year (iceSheetAlb), and its surface temperature is lapsed over bedrock plus ice.
  - Stages 6 and 8 read iceThick from the last run. After a run, if more than 3% of the ice changed, the climate runs once more over the new ice (S.iceRounds, capped at one). On first load that pass grows the ice about 14%; a third would add about 1%.
  - Ice cover rises to 7.8% of alpha's land and 4.3% of beta's. The scorecard goes to 20/33 (A 201 no better). All 14 robustness worlds pass.
  - A fresh world takes about 5 minutes instead of 2.5.

### Biomes extended (stage 13)

**Eleven biomes appended** (codes kept stable for saved files):

| Biome | Rule |
|---|---|
| Polar sea | open ocean, SST < 5 °C |
| Tropical sea | open ocean, SST > 22 °C |
| Seasonal sea ice | sea ice part of the year |
| Kelp forest | shelf, SST 5–18 °C, rising water or rocky coast |
| Upwelling zone | open ocean, upwelling > 0.4, SST < 24 °C |
| Glacier | ice under 1 km thick |
| Montane cloud forest | no real seasons, 1000 m up, mean 10–22 °C, wet |
| Páramo | no real seasons, above 2500 m, mean 1–12 °C |
| Temperate coniferous forest | wet winters with cool dry summers, or cold-winter mountains above 1200 m |
| Flooded grassland | warm floodplain with a dry season |
| Sand sea | hot desert on sediment > 20 m, about a fifth of hot desert |

**Rule changes:** Ice sheet now follows the ice thickness, and land below freezing all year without ice is polar desert.

## Presets and atmosphere

The World tab carries thirteen presets. Each resets the preset-controlled
parameters (air pressure, greenhouse, solar, temperature offset, continental
fraction, plate and hotspot counts, rotation and its direction, axial tilt,
erosion, radius) to their defaults and then applies its own values; every
preset also clears the previous world's ice so the climate does not inherit it.

The Climate tab adds two atmosphere sliders:

- **Air pressure** (0.1–10 × Earth): scales both air layers' heat capacity and
  the meridional heat transport, and thickens the greenhouse by 12·ln(p) W/m².
- **Greenhouse** (0.25–64 × Earth CO₂-equivalent): 5.35·ln(g) W/m² of forcing.

At the defaults (1 and 1) every term is exactly identity. Verified with a
fixed startup seed: the default Earth-like world is bit-identical to the build
before these controls, on every field and every cell.

Preset results (one build each, all finite):

| Preset | Mean °C | Equator | Pole | Sea ice | Glaciated |
|---|---|---|---|---|---|
| Earth-like | 17.0 | 24.7 | −19.9 | 15% | 8% |
| Young Earth | 15.0 | 22.2 | −21.0 | 14% | 14% |
| Supercontinent age | 18.5 | 26.0 | −19.5 | 12% | 4% |
| Snowball | −13.2 | 3.0 | −49.2 | 49% | 68% |
| Hothouse | 25.7 | 32.6 | −4.5 | 3% | 4% |
| Ocean world | 18.9 | 26.0 | −23.6 | 12% | 14% |
| Desert world | 17.6 | 27.1 | −19.2 | 21% | 3% |
| Thin-air world | 8.3 | 26.5 | −60.6 | 32% | 24% |
| Thick-air world | 25.1 | 28.4 | 8.7 | 0% | 3% |
| Fast spinner | 17.2 | 28.8 | −34.6 | 21% | 9% |
| Slow spinner | 14.6 | 20.0 | −5.0 | 3% | 8% |
| Extreme seasons | 13.8 | 15.2 | 7.4 | 0% | 4% |
| No seasons | 17.0 | 26.8 | −31.0 | 18% | 19% |

### Orbit, gravity and tidal locking

- **Eccentricity** (0–0.5) and **perihelion** (time of year): the planet's
  place on its orbit comes from Kepler's equation, the sun's declination from
  its true anomaly, and the sunlight is scaled by 1/r². Default 0, a circle:
  Earth's real 0.017 is left out so the default world stays bit-identical.
- **Gravity** (0.3–3 × Earth's): the air's mass per square metre is
  pressure ÷ gravity, so it scales both air layers' heat capacity and the heat
  transport; the lapse rate is 6.5 °C/km × g (it is g/cₚ); the thermal wind
  and the ice sheets' plastic profile use g. Relief and tectonics are not
  scaled.
- **Tidally locked**: the day lasts the year (spin 1/365), the tilt is zero,
  and the sunlight belongs to each point rather than its latitude — full sun
  over longitude 0 on the equator, night beyond the terminator. The energy
  balance spreads heat to the night side through its two-dimensional
  diffusion; the winds stage still builds zonal belts (one cell per
  hemisphere at this spin), not the true day-to-night flow. The day–night
  cycle in the view is switched off and the sun stands still.

All three are identity at their defaults (each new term multiplies by 1 or
takes the old branch). Verified: the fixed-seed default world dumps
byte-identical before and after.

| Preset | Mean °C | Equator | Pole | Sea ice | Glaciated |
|---|---|---|---|---|---|
| Eccentric orbit (0.2, perihelion in July) | 19.0 | 26.7 | −16.4 | 14% | 8% |
| Light world (0.5 g) | 18.0 | 23.0 | −5.0 | 7% | 1% |
| Heavy world (2 g) | 13.6 | 24.4 | −37.2 | 21% | 18% |
| Tidally locked | 3.0 | 8.1 | −7.4 | 1% | 46% |

The tidally locked world, second pass. The first build smeared the ocean
along latitude bands (sea beneath the sun 10 °C beside 48 °C land; the night
sea barely freezing). Fixed:

- Where the climate reads latitude as a stand-in for "how tropical" — the
  cloud-albedo belt, the mixed layer's deep winter mixing, the thermocline's
  yearly band settling, the stratocumulus belt, where the overturning sinks —
  a locked world reads half the angle from the substellar point instead
  (`sunLat`), so its hot centre is the "equator" and the far side the "pole".
- Winds: one low beneath the sun, a broad high on the far side, no seasonal
  shifts or standing troughs; aloft the surface inflow is reversed (the
  return flow to the night side) instead of a thermal wind that a near-zero
  spin makes meaningless. The land–sea contrast is measured in sun-angle bands.
- The ocean's Ekman and Stommel friction rates were tied to the spin; at
  1/365 of Earth's they made the drift and gyres hundreds of times too strong
  and swept cold water beneath the sun. A locked world uses Earth's rates.
- A standing cloud deck beneath the sun (+0.22 albedo × cos²ψ), as the
  climate models of such planets find.

Result, by angle from the sun:

| Zone | Mean °C | Sea | Sea ice | Land glaciated |
|---|---|---|---|---|
| Beneath the sun | 31.1 | 25.5 | 0% | 0% |
| Day side | 14.7 | 14.9 | 0% | 0% |
| Terminator | −17.9 | −0.5 | 72% | 21% |
| Night side | −37.2 | −1.8 | 100% | 41% |

An "eyeball" world: open sea round the substellar point, ice everywhere
else. The night side's land is mostly bare because little snow reaches it.
The default world still dumps byte-identical.

Limits: the climate is calibrated on Earth. Mars (0.006 atm) and Venus
(90 atm) lie outside the slider ranges and would not be modelled credibly.

### Life switch

Climate tab, **Life** (on by default). Biomes are living communities, so a
lifeless world has none: with Life off the Biomes stage and layer are named
**Surface**, and every living class falls back to the ground beneath it —
forest, grass, scrub and savanna to **Barren plain** (weathered soil and
gravel), cold ones (tundra, alpine, or mean below 0 °C) to **Frost barren**,
wetlands and mangroves to **Mudflat**, reefs and kelp to Shallow sea, steppe
and xeric scrub to cold and hot desert. Ice, rock, deserts, salt flats, sand
seas, lakes and the sea classes stay; Köppen climates are unchanged. Hand-
locked cells keep what was painted. A "Lifeless world" preset sets it.
On by default, so nothing changes for the Earth-like world.

Life off also changes the climate and the ground:

- **Brighter land**, `EBM.barrenAlb` +0.05 seen from space — except in the
  warm tropics, where the cloud the plants no longer make is the larger effect
  and the land ends a little darker (the bonus fades and reverses between 15
  and 27 °C).
- **Little evaporative cooling**: the energy balance's land evaporation is
  cut to a tenth (bare topsoil dries within days of rain). This is what makes
  bare tropical ground hotter than forest.
- **Less rain recycled** (about 25% of the rain given back instead of up to
  60%) and **more runoff** (Budyko w 1.6 instead of 2.6).
- **No coal, oil or gas** (buried forest and plankton).
- **Faster erosion**: river incision ×1.6 (no roots binding the soil; before
  land plants Earth's rivers ran braided and its land wore down faster).
  Same world, Life on → off: mean land height 710 → 696 m, the highest 1%
  4620 → 4602 m, sediment on land 14.6 → 23.6 m on average; the mountains,
  which the plates keep raising, barely change.
- **Wider sand seas**: with no roots to hold it, 5 m of loose desert sediment
  is enough for dunes instead of 20 m.

Climate, same world, Life on → off: world mean 17.3 → 17.2 °C, tropical land
(within 23° of the equator) 21.0 → 23.5 °C, land mean 4.1 → 3.7 °C (the
cold high-latitude land cools), runoff 680 → 763 mm/yr. The default world
still dumps byte-identical.

Bug found along the way, from before these changes: the rock stage placed
resources and karst using the *previous* run's rock map, so a fresh world's
first build had only the rock-independent resources (iron, copper,
diamonds) — no gold, gems, coal, oil, base metals, tin or uranium until it
was rebuilt. It now uses the rock it has just made. Terrain and climate are
unaffected (zero cells differ).

## Landmarks (stage 14) and impacts

A last stage picks the notable places out of every earlier stage's fields.
Each kind has a quota that scales with the world's land (or sea) and a
minimum spacing, and candidates are ranked by a measure, so each one is worth
naming:

| Kind | Where | Ranked by |
|---|---|---|
| Waterfall | river ≥ 150 m³/s stepping down ≥ 250 m to its lowest neighbour | √flow × drop |
| Gorge | river ≥ 300 m³/s with three neighbours 700 m higher | flow × wall height |
| River fork | river ≥ 3,000 m³/s fed by two rivers each > ¼ of it | the smaller river |
| Delta | river ≥ 1,500 m³/s reaching the sea below 40 m | flow × sediment |
| Oasis | hot desert or sand sea with a river or a lake beside it | water |
| Salt pan, Dune field | whole salt-flat and sand-sea regions, one marker at each heart | area |
| Fjord | shelf sea under walls ≥ 500 m on a cold coast | wall height |
| Sea cliff | coast ≥ 250 m above deep water | height |
| Lagoon | warm low coast with thick sediment and shallow sea | sediment |
| Atoll | coral reef with no land within two cells | — |
| Glacier tongue, Calving front | ice reaching ice-free ground below it, or the sea | ice thickness |
| Seamount | sea floor below 1.5 km standing ≥ 1,200 m above its surroundings | prominence |
| Hydrothermal vent | on a mid-ocean ridge | — |
| Crater | old (≥ 300 Myr), ice-free land with little sediment | crust age |
| Impact basin | from the tectonic stage (below) | — |

The map keeps one feature per cell (earlier stages' and painted ones come
first). The full list, `featureList`, holds everything with a number per kind
and a measure; the inspector shows all of a cell's entries, and the first
becomes the cell's suggested name ("Waterfall 1") until it's named. Earlier
stages clear the Landmarks kinds before they work, so last run's markers never
block them.

**Bombardment** (Climate tab, default ×1, Earth's rate):
- *Impact basins* are cut into the tectonic height, so erosion, climate and
  everything after respond to them. Large impactors pass through any
  atmosphere, so their number follows the bombardment only: N(>D) ∝ D⁻²,
  drawn from 150 km (two cells) up, `floor(0.9 × rate × area)`. At Earth's
  rate that is none — Earth's three that big are eroded, deformed or buried —
  so the default world is unchanged (verified byte-identical). Profile: a
  bowl 1.5–4 km deep, rim 0.3 of that, a central peak, ejecta thinning out to
  2.2 radii.
- *Craters* (landmarks) are where the air matters: it breaks up small
  impactors, so their number scales with pressure^−0.6 (×0.2 to ×4), and a
  lifeless world, eroding faster, keeps 65%.

Test: the default world lists 313 features (15 waterfalls, 11 gorges, 11
river forks, 11 deltas, 9 oases, 9 dune fields, 11 fjords, 9 sea cliffs, 9
lagoons, 8 atolls, 7 calving fronts, 9 glacier tongues, 10 seamounts, 8
vents, 9 craters, and the earlier stages' volcanoes, springs, caves and
passes). The new **Cratered world** preset (×60, 0.1 bar, lifeless): 54
impact basins and 326 craters; no atolls (no reefs without life).

A separate lifeless pipeline was considered and set aside: the Life switch
already branches the stages that differ, and a second pipeline would copy
every stage that doesn't.

## Tides and the carbon cycle

**Tides** (stage 12b; Climate tab: Moon, Moon distance). The tide-raising force
is the moon's mass over its distance cubed, plus the sun's 0.46 of the Moon's,
as a multiple of Earth's (no moon: 0.32). Range: 0.5 m × force in the open
ocean, raised along coasts by the shelf in front (× 1 + width/120 km) and by
how enclosed the water is (the land share within four rings), capped at 18 m;
coastal land takes its sea's range. Earth-like worlds: mean sea range 0.7 m,
up to 14–16 m in the most enclosed bays (Fundy's 16).
- Landmarks: a great river's mouth with ≥ 4 m tides is an **Estuary**, not a
  Delta; low coast with ≥ 3 m tides and sediment is a **Tidal flat**.
- Biomes: mangroves grow up to 40 m × √force above the sea.
- Presets: **Moonless** (0.2 m mean; 13 deltas, 1 estuary, 53 mangrove
  cells) and **Great moon** (2× mass at 0.67 distance, ~5× force: 3.1 m mean;
  10 estuaries, no deltas, 94 mangrove cells).
- At Earth's moon every term is identity (verified byte-identical). The
  Landmarks set itself does change at the default — some deltas are now
  estuaries — as the stage is new and this makes Earth-like coasts more
  Earth-like.

**Carbon cycle** (Climate tab checkbox, off by default). After a full run,
outgassing (plate speed summed over ridges, rifts and subduction zones,
square-rooted against an Earth-like world's 14,500) is set against
weathering (ice-free land share / 0.28 × mean exp(0.09 (T − 15)) / 1.6 ×
(runoff / 750 mm)^0.65, × 0.3 without life). The greenhouse moves by the
imbalance squared (held to ×3 a step and to 0.25–64) and the climate reruns,
up to four rounds, until they agree within 8%. The first measures tried
(volcano counts, total runoff) scattered by ×2.6 between Earth-like worlds
and sent one to ×64; these scatter by about ±25%.
- An Earth-like world: balanced at ×1 on the first check.
- Snowball: weathering 0.09× Earth's (almost no ice-free land), so the gas
  builds: ×3, ×9, ×27, ×64 over four rounds, mean −13 → 8 °C — the thaw.
  Still short of balance at the slider's ceiling; the toast says so.
- No round limit: it runs until outgassing and weathering agree within 8%
  or the greenhouse reaches the slider's end (a safety stop at 20 rounds).
  After the first step, each step follows this world's own response to the
  last two (the secant method).
- The searching rounds run as Quick previews; once they agree, one full
  climate run confirms, and if it disagrees the search goes on in full. An
  Earth-like world out of balance (outgassing 1.11×, weathering 0.80×):
  two quick rounds and one full, ×3.07, 2.7 minutes in all (it was over 6
  with every round full).

## Build speed

Profiled per section of the energy balance's step: the air solve took 63% of
the climate's time, the thermocline 24%. Two changes, both bit-identical
(verified):
- Each row's two east–west cyclic tridiagonal systems keep their
  coefficients through a step's 24 sweeps, so they are factored once a step
  (`makeCyclicFactors`) and only solved per sweep.
- The thermocline's neighbour loops built four little arrays per cell per
  sweep; written out, the same sums in the same order.
Air solve 78 → 54 s, thermocline 29 → 6.5 s; a build 94 → 75 s in the test
browser (about a fifth faster).

Warm starts (a rerun beginning from the last run's state, one settling year
instead of three or four) were tried and removed: for the ice feedback's
second pass they saved 15 s but moved 530 cells of an Earth-like world by more
than 3 °C (polar seas near freezing settle open or frozen depending on where
they start), and for the carbon cycle's quick rounds one settling year was too
short for the climate to answer the greenhouse, which threw the search off.
Quick previews already settle in one or two years from cold.

**Several cores.** Shared memory between workers is allowed only on a page
served cross-origin isolated (COOP `same-origin`, COEP `require-corp`). The
artifact host doesn't send those headers, so there the editor runs on one
core, unchanged and bit-identical. `serve-world-editor.py` (Python standard
library, no installs) serves the repo with them:

    python3 serve-world-editor.py      # then open http://localhost:8000/index.html

There the climate worker starts helper workers (cores − 1, 2 to 8), each a copy
of itself (it fetches its own source), and hands them two kinds of work:
- **The air solve's sweeps.** Rows in two colours, even and odd, each colour's
  rows solved at once (their neighbours are all of the other colour), with a
  shared-memory barrier between half-sweeps. Each climate run is a session:
  the helpers enter a loop at its start and leave at its end (they say when
  they have, so the next session can't be mistaken for a step). Inputs are
  copied into one shared buffer each step and the three temperatures copied
  back. The answer differs from one core's by the change of sweep order:
  world mean +0.01 °C, 282 of 100,000 cells by over 0.5 °C (polar seas near
  freezing).
- **The year's rain.** Its five states are independent (`moistState`): the
  helpers take up to four, the climate worker the rest, and they are added up
  in the same order as on one core — identical, bit for bit (verified with
  the air solve held on one core: zero cells differ).
The helpers are made when the climate worker starts and used once all report
ready: a worker can't start helpers while it's blocked waiting on them (the
first version hung). Three.js is fetched with `crossorigin="anonymous"` so the
isolated page may load it. Climate tab: **Use all cores** (on; greyed where
unavailable); the run time reads "on N cores".

Measured on a 4-core test machine, one full climate run: 71 s on one core,
about 47 s on four (air solve 54 → 20 s, rain 12 → 5 s). Spinning before each
barrier sleep made no difference. The rest of the climate's step (advection,
coefficients, thermocline, about 16 s a run) stays on one core: its loops read
the climate's local state through a dozen closures and some 30 arrays, so
moving it would mean copying all of them every step and keeping two copies
of the code in step — not worth about 10 s.

## Planet size and resolution

**Distances in km.** Many stages were tuned in cells (search rings, smoothing
passes, breadth-first reaches, feature spacing, the tectonic profiles' widths,
per-cell slope thresholds). They now go through one factor, `CELLS` = this
world's cell width against the reference (Earth's radius on the n = 100 grid,
about 70 km): (100 / n) × (radius / 6,371 km), exact because the Goldberg
grid's spacing goes as 1/n. Rings and reaches divide by it, smoothing passes
by its square (smoothing spreads as the square root of its passes), slope
thresholds and per-cell probabilities scale by it or its square, feature
quotas by area. Pure iteration counts (relaxations, the climate's own 2°
grid, the upwind day-steps) are left alone, as is erosion's stream power,
which is already resolution-consistent. At the default it is exactly 1, and
the default world dumps byte-identical.

**Resolution** (World tab): 25,002 / 49,002 / 100,002 (default) / 196,002 /
400,002 cells. Rebuild starts the world afresh at the new resolution from the
same settings and seed; painted cells, names and hand-placed plumes and plates
name cells, so they aren't kept. A saved world records its n: the editor
reopens at the browser-saved world's resolution, and importing a file at
another one switches the grid. The old mesh is now disposed when rebuilt.

Same seed at three resolutions:

| Cells | Mean °C | Land | Over 2 km | Features | Build |
|---|---|---|---|---|---|
| 25,002 | 17.5 | 31% | 7.0% of land | 306 | 53 s |
| 100,002 | 17.0 | 29% | 12.0% | 337 | 79 s |
| 400,002 | 17.2 | 28% | 8.8% | 306 | 172 s |

Climate, land share and feature counts hold. The high-ground difference was
traced: it is already there in the tectonic height, before erosion, and it is
mostly the seed. The same seed doesn't lay plates out alike on different grids
(alpha at 25,002 cells has twice the island arcs and a fifth of the collision),
so each resolution is a different world. Over six seeds, tectonic land above
2 km:

| Cells | alpha | beta | gamma | delta | eps | zeta | Mean |
|---|---|---|---|---|---|---|---|
| 25,002 | 7.2 | 7.3 | 8.1 | 9.2 | 7.1 | 5.5 | 7.4% |
| 100,002 | 13.2 | 9.5 | 7.4 | 6.0 | 15.3 | 12.7 | 10.7% |
| 400,002 | 9.4 | 11.6 | 9.9 | 13.3 | 13.5 | 10.5 | 11.4% |

The default and the finest agree within the seeds' spread (6–15%): no bias.
The coarsest is lower, with lower peaks (5.4–5.6 km against 5.4–6.5), because
a 140 km cell holds the mean height of ground that includes valleys, and most
ranges are 100–300 km wide: that is the grid's sampling, not an error, and it
is left as it is.

## Relief, atmosphere and clouds (display only)

Show menu, globe only (the map stays flat); nothing here touches the
simulation.

- **3D relief** (on, ×20; slider ×1–60). Each cell is a flat-topped column
  lifted in the shader by its height × exaggeration ÷ radius (the sea's
  surface at sea level, so ocean cells sit flat). Walls: a quad on every edge
  two cells share, its four corners at the two cells' tops, coloured as the
  higher cell, lit by their own facing and darker; no contours or cell edges
  on walls. Lines and arrows float just above the highest ground. True scale
  (×1) is there but invisible: Everest is 0.14% of Earth's radius.
- **Atmosphere** (on). A shell sized by the air pressure: drawn from inside
  it glows just outside the planet's edge and fades outward; drawn from
  outside it lays a thin haze thickening toward the limb. Thin air: faint and
  sharp; thick air: broader, paler. With day and night it is lit by the sun
  and reddens along the terminator. Blended rather than added (added light
  washed out to white on the light theme).
- **Clouds** (off). Each cell's cover is 0.8·(1 − e^(−P/160 mm)) of the
  month's rain (January and July blended by the time slider), or stage 8's
  low cloud over cool seas, whichever is more, broken up by fixed 4-octave
  noise. They follow the month and darken on the night side.

Checked only in software rendering here.

## Pins and the map image

Both general: the editor never names a particular world.

- **Pins** (World tab, Import pins): a JSON file `{ pins: [{ name, lat, lon,
  note? }], links?: [[a, b]], regions?: [{ name, pins: [a, b, c] }] }`,
  indexes into `pins`. Kept with the world in `params.pins` (presets and new
  worlds keep them; Clear removes them). Drawn as rings with labels over the
  canvas (hidden on the globe's far side), links as great circles in 1° steps
  (on the map, a piece crossing the map's edge is left out, recut as the map
  pans). The inspector shows the region a cell lies in (the spherical triangle
  test: the cell on the same side of all three edges) and the nearest pin
  with its distance. Show menu: Pins.
- **Export map image** (World tab): the current layer as a 4096 × 2048
  equirectangular PNG, longitude 0 in the middle, 180° W at the left edge,
  north at the top: the map view rendered once off screen through an
  orthographic camera over its ±2 × ±1 extent, overlays off.

- **Align pentagons to pins** (World tab, Grid): when the pins are twelve
  points at the corners of a regular icosahedron (each with five others at
  cos⁻¹(1/√5) = 63.43°, within 0.6°), the grid's base icosahedron, whose
  corners become cells 0–11 and the only pentagons, is turned so they land on
  the pins: one corner and a neighbour fix the rotation (`icoRotation`), and
  every other corner is checked to land within 0.8°. The builder rotates the
  twelve starting corners, so everything else follows; without a rotation it
  is untouched (the default world dumps byte-identical). The turn (a 3×3) is
  kept in the world file's grid record beside n; a world can only be opened
  on a grid turned the same way, and importing one turned differently
  rebuilds the grid first. Rebuilds the world afresh, as a resolution change
  does. **Standard** turns it back.

Tested with a pin file of twelve pins at a regular icosahedron's corners, its
30 edges as links and its 20 faces as regions; a cell just east of a pin reads
the face it lies in. A
test image with dots at three pins' coordinates lands exactly on them in the
globe viewer that uses these images. Aligned to the same pins, all twelve
pentagons fall within 0.01° of them (the grid's single-precision positions),
and the world builds as usual.

## Plate motion and plumes with the Plates stage on Hand

On Hand the Plates stage keeps its plates exactly (often hand-painted) and
never reruns, and putting it back on Auto regrows them from their seeds. So
with the stage on Hand:

- **Records for every plate.** The stage makes each plate's record (pole,
  speed, density, continental, area); plates painted while it was on Hand had
  none, and a plate without one is still, so Set motion seemed to do nothing
  on them. `ensurePlates` adds one for each plate in the layer (continental if
  most of its cells are, density 2.85 or 3.0, still) and updates every area.
- **Set motion** writes the pole and speed into that plate's record, **Add
  plume** adds or removes the cell in `params.hotspots`.
- **The other plates answer**, as on Auto: the worker runs `solveMotion` on
  the plates as they stand (the set ones held), on copies, and only the
  motions come back (`params.plates`); the shapes stay as painted. Off when
  Physical motion is off.
- Only the stages after Plates rerun, and only once the plates have
  answered (nothing reruns before: a first rerun had queued the solve behind
  a full rebuild and then rebuilt again).
- **Reset all motions** clears the set ones, gives every plate a seeded
  motion of its own (a pole and speed drawn from the seed and its number:
  the Auto stage draws them while growing the plates, which Hand doesn't
  do), then solves them as on Auto. Close to Auto's, not the same.

Tested: on Hand, a plate painted beyond the records (13 of 12) was given a
motion; it moved at 6.9 cm/yr, the other twelve answered (several slowed by
half), no plate cell changed, and 4,762 cells of the convergence field did.
A motion of 12 on one plate, then Reset: the others answered, then all were
reseeded and solved, the fastest back to 9 cm/yr; no plate cell changed.

## Plate borders

Lines along every cell edge where the plate changes (the edge's two shared
corners), always on the Crust layer so continents can be painted to the
plates, and on every layer with Show > Plate borders. Redrawn with each full
recolour and, on the Plate layer, as plates are painted. White on dark,
near-black on light.

## Regions (stage 15) and the wiki export

**Regions.** From the height alone, numbered so they can be named:
continents (land masses of 4 million km² or more) and islands (10,000 km² and
up, the largest 40); seas (water with over 40% land within about 600 km, in
bodies of 200,000 to 5 million km², the largest 20 — at 50,000 km² a world
had 92, every bay); oceans (the open water divided round its points farthest
from land, at least 3,500 km apart and 800 km from land, up to 7, each of a
million km² or more); mountain ranges (land 1,500 m and up, 30,000 km² or
more) and inland basins (land under 500 m more than 600 km from the sea,
150,000 km² or more). `regionMain` holds each cell's land or water region,
`regionRelief` its range or basin (hidden fields). A region keeps its number
when a rerun finds it again (the same kind, covering at least 40% of the same
cells), so its name, kept by number in `params.regionNames`, stays with it.
The inspector shows a cell's regions, each nameable; unnamed, a region is its
kind and its rank by size ("Mountain range 3").

**Export to wiki** (World tab): a zip of `gazetteer-rows.md` and
`places/<name>.md`. Every region, every landmark (named or stub-named, the
cell's name and notes going to its first feature) and every named cell gets a
gazetteer row (name linking its page, what it is, latitude, longitude, the
pin region it lies in) and a page: what it is (with the landmark's measure,
or a region's area and highest or deepest point), the ground, height and
climate from the layers, the regions it lies in, the places near it (within
400 km) or in it, what a region borders (land and water against each other),
and the inspector's notes. Positions are in the rows only; each page links
to the gazetteer. A small zip writer (stored, CRC-32) builds the file.

The landmark for two great rivers joining is called **River fork** (it was
once "Confluence"; renamed so it can't be confused with a region a pins file
names).

Tested: a world gave 1 continent, 25 islands, 7 oceans, 20 seas, 18 ranges
and 22 basins; a continent named in the inspector kept its name and number
through a rerun; the export held 93 regions, 417 landmarks and a named cell,
512 files, a valid zip. The default world still dumps byte-identical.

## Planned stages (design agreed; details may be adjusted when built)

**5b. Soil** (with climate, after stage 10): alluvial, loess, laterite, podzol, chernozem, permafrost,
sand, bare rock; salt flats and evaporites in dry basins.

**11. Hydrology.**

- Priority-Flood with real lakes.
- Water balance: lakes that overflow drain onward; basins with no outlet become salt lakes.
- Discharge accumulated downhill; rivers above a threshold, marshes and deltas.
- Glaciers where snow outlasts summer melt.
- Optional groundwater: springs, oases, karst.

**12. Biome.** A cascade:

1. Water types (deep sea, shelf, reef, sea ice, lakes).
2. Ice.
3. Alpine.
4. Wetlands (marsh, swamp, mangrove).
5. A Whittaker grid of mean temperature against yearly rainfall, adjusted by seasonality: savanna
   needs a long dry season, Mediterranean scrub needs winter rain.

Plus a continuous vegetation density for smooth colour blending.

**Feature plan:** each stage adds the features it causes. Done: volcanoes, calderas, hot springs,
geysers (stage 3), mountain passes (stage 4), caves and karst (5). Planned: lakes, waterfalls,
springs and oases (11), with climate. Craters, landmarks and ruins stay hand-painted.

**Iteration.** `1 → 2 → 3 → 4 → 5 → [6 → 10] ×2 → 11 → 12 → 5 (soil) → 4 (optional second pass)`.
The climate loop feeds currents back into temperature.

**Custom layers.** Number or category layers, created by the user. Planned: a small formula rule per
layer, reading physical layers (for example strength by distance to a ley line). An optional,
visible "affects" clause can feed back into physics as an edit. Extra biomes with conditions,
checked before the Whittaker grid.

**Flat-map export.** An equirectangular PNG of any view.

## Testing

Headless Chromium is available in the cloud environment. The CDN is blocked there, so fetch
`three@0.128.0` from npm and point the script tag at the local copy. Then load the page (wrapped in
a doctype/body skeleton) with Playwright and `--use-gl=swiftshader`, and inspect `S` (the page
state), `STAGES` and `S.fields.*.base` from `page.evaluate`. The full pipeline should stay under
about a second.

Useful checks, all used so far:

- the neighbour table is symmetric;
- every oceanic cell above sea level is volcanic;
- each plate's ridge cells average youngest, its trench cells near the oldest;
- continental belts are younger than interiors;
- the page width at 400 px has no horizontal scroll.
