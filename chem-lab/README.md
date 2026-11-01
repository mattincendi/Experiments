# Chem Lab

2D chemistry lab simulator. No build step: open `index.html`.

- Drag glassware; hold it over another container to pour, or tilt with scroll / Q·E / ⟲⟳ buttons.
- Hover (or long-press on touch) for 1 s to see composition, pH, temperature, mass, reactions.
- `js/chem.js` — data-driven species, reagents and reactions (add entries to extend).
- `js/lab.js` — physics (gravity, bench collisions, tilt-based pouring with real fill geometry, slosh), rendering, input.
