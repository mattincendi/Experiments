# World editor

A geodesic world editor that runs in the browser: plates and tectonics, erosion,
a two-layer climate with oceans, ice, rain and rivers, biomes, landmarks and
regions, on a hexagonal grid of 25,000 to 400,000 cells. Paint, sculpt and pin
places; export the world, a map image, or Markdown pages for a wiki.

- **Open it:** `index.html` in a browser. Everything is in that one file
  (Three.js comes from cdnjs).
- **On several cores:** `python3 serve-world-editor.py`, then open the address
  it prints. Served that way the browser allows shared memory, and the climate
  runs on several cores.
- **How it works:** [`WORLD_EDITOR.md`](WORLD_EDITOR.md), the full
  specification and working record. Read it before changing the editor.
- **Tests:** [`tests/`](tests/), the scripts used to check the climate against
  Earth and test unusual worlds.
