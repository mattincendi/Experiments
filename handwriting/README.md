# Handwriter

Turns typed text into handwriting you can print. It is not a font: each letter is a pen path
that gets re-drawn every time with small random changes (shape, size, slant, rotation, spacing,
baseline drift, pen pressure), so the same letter never comes out twice the same.

Open `index.html` in a browser.

- Pens: gel, ballpoint, fountain (width follows stroke direction), pencil, felt tip
- Sizes are in real millimetres (x-height, pen width, line spacing, line length)
- **Save PNG** at 150/300/600 dpi, transparent or white; the DPI is written into the file so it prints at the size shown
- **Save SVG** for clean vector ink
- **New variation** re-rolls the randomness; the variation number reproduces a result

`handwriter.html` is the same page without the document wrapper (used for the published artifact).
