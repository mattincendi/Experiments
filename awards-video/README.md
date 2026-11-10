# Awards Night Video Templates

Pre-rendered awards-night videos in navy and gold. Each category becomes one 1920×1080 MP4:

1. **Category intro** (7 s): gold lines draw outward, "The nominees for" fades in, then the category name appears in metallic gold with a light sweep.
2. **Nominees**: each nominee's clip plays full screen inside a gold frame with corner accents, with their name and an optional detail line in a lower-third. There's a short dip to navy between clips.
3. A fade to navy at the end, with no winner reveal, so presenters announce the winner.

The font is **Jost**, a free geometric font close to Futura.

## Setup

```bash
cd awards-video
npm install
```

## Add your nominees

1. Put each nominee's clip in `public/clips/`. Use MP4 or MOV, ideally 1920×1080 so it fills the frame without cropping.
2. Edit `data/awards.json`:

```json
{
  "id": "best-newcomer",
  "title": "Best Newcomer",
  "nominees": [
    {"name": "Jane Smith", "detail": "Marketing", "clip": "jane.mp4"}
  ]
}
```

Nominee options:
- `detail`: the second line under the name. Optional.
- `clip`: the file in `public/clips/`. Leave it out and a dashed placeholder appears instead.
- `startAt`: the second to start the clip from. Optional.
- `maxSeconds`: cuts a long clip short. Optional. Otherwise the clip plays at its full length.

Category options:
- `id`: lowercase letters, numbers and hyphens. It becomes the file name.
- `kicker`: the small line above the title. The default is "The nominees for".

## Preview and render

```bash
npm run studio          # live preview in the browser and scrub through it
npm run render          # render every category to out/<id>.mp4
node render-all.mjs best-newcomer   # render one category
```

## Tweaking the look

Colours, font, intro length and fade timings are in `src/theme.ts`. The intro animation is in `src/CategoryIntro.tsx` and the nominee frame and lower-third are in `src/NomineeClip.tsx`.

Built with [Remotion](https://www.remotion.dev/). It's free for individuals and small organisations, so check its licence if this is for a larger company.
