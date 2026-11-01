# Chem Lab

2D chemistry lab simulator. No build step: open `index.html`.

- Drag glassware; hold it over another container to pour, or tilt with scroll / Q·E / ⟲⟳ buttons.
- Hover (or long-press on touch) for 1 s to see composition, pH, temperature, mass, reactions.
- Tap a container for its wiki entry; the ⓘ buttons in the sidebar open the wiki too.
- Equipment: hot plate (tap to cycle power), Bunsen burner (tap to light; heat things on the gauze or hold a test tube in the flame), dropper pipette.
- Time controls ×1 / ×10 / ×60 speed up chemistry and heating.
- `js/chem.js` — data-driven species, reagents and reactions (add entries to extend). Reversible reactions use equilibrium constants with van 't Hoff temperature dependence (solubility, weak acids, complexes); heat from reactions, heaters, cooling, boiling and evaporation.
- `js/lab.js` — physics (gravity, bench collisions, tilt-based pouring with real fill geometry, slosh), rendering, input.
