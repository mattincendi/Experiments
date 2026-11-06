# World editor test tools (temporary)

Scratch tools for checking the world editor's climate against Earth. They are not wiki content; delete this folder once the climate work is finished.

They need Playwright with Chromium, and `three.min.js` saved locally (the scripts expect it at `dl/package/build/three.min.js`).

1. Make a local copy of the editor that loads that local `three.min.js`:

   ```
   sed 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js#dl/package/build/three.min.js#' index.html > page.html
   ```

2. Add the diagnostic logging, then run the scorecard:

   ```
   python3 scpatch.py page.html psc.html
   node score.js psc.html
   ```

   The scorecard checks every Earth target on the two test worlds (seeds alpha and beta) and marks each one ok or OUT. It prints its targets and tolerances.

3. Optional deeper checks:
   - `python3 dgpatch.py psc.html pdq.html`, then `dq.js`, for the tropical and seasonal heat budgets, ice cover by latitude, and the ocean loops across 20°N.
   - `pr2.js`, for the polar radiation budget.
   - `cv.js`, for how far the air solver still moves per sweep.

   These three read a page file hard-coded in each script, so edit that name to match before running.
