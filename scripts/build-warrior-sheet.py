#!/usr/bin/env python3
"""Build src/assets/warrior-sheet.png from assets/warrior_spritesheet.png.

The source is a labelled animation sheet on a light grey page: a dark title bar, then one
labelled row per animation with its frame count printed in the label. The frames are not on
a strict grid — the pitch wanders between about 230 and 270 pixels — and the sword glow and
magic effects both bridge neighbouring frames and split single ones, so neither an even
slice nor plain gap-splitting recovers the frames.

What makes it tractable is that the labels state the frame counts, which gives ground truth
to segment against. The body is both *saturated* and *dark* — the armour is deep blue and
gold — while the effects are saturated but bright and the printed labels are dark but grey,
so that pair of tests isolates the figures from both. For each row a short search finds the
settings that yield exactly the number of figures the label promises, and the frame widths
it produces have to be consistent with each other, which is what catches a segmentation
that hit the right count for the wrong reasons.

Taken: IDLE (8), ATTACK 1: SLASH (8), DEFENSE (4).

Frames are not cut to a grid at all. Each figure is grown outward from its own armour
until it runs out of ink, which captures however far that pose's sword happens to reach.
That only works because the printed rule lines under each row are removed first: they span
the full width and, left in, they join every figure into one blob so growth from any body
floods the entire row.

Skipped, and why:
  * WALK — the game has no movement animations; the character stands in one spot and acts.
  * ATTACK 2: OVERHEAD STRIKE, ATTACK 3: MAGIC THRUST, SPECIAL: AETHER BLAST — in these
    rows the effects are large enough to occlude the bodies and overlap the neighbouring
    pose, so no threshold recovers the frame boundaries: every candidate segmentation that
    hits the stated count does it by cutting figures in half or grouping three together.
    Re-exporting those rows one pose per cell on a fixed grid, or without the effect layer,
    would make them usable.

    python3 scripts/build-warrior-sheet.py

Requires Pillow and numpy.
"""
from collections import deque

import numpy as np
from PIL import Image

SRC = 'assets/warrior_spritesheet.png'
DEST = 'src/assets/warrior-sheet.png'

HEADER_HEIGHT = 110    # the dark title bar
PAD = 6

# The finished sheet is resampled so a cell is about this tall. The game draws a cell at
# roughly 95px, so this leaves a 2x margin for high-density screens while keeping the
# runtime scale close to 1 — the source art is ~220px per cell, and letting the browser
# shrink that by more than half with nearest-neighbour sampling is what made the sprite look
# grainy. Downscaling here instead, with a proper filter, is what fixes it.
OUTPUT_CELL_HEIGHT = 190

# The widest frame in a row may be no more than this multiple of the narrowest. Frames in a
# row are all one character at one scale, so wildly uneven widths mean the split is wrong
# even when the count is right.
MAX_WIDTH_RATIO = 1.6

# A row of ink this wide is a printed rule, not artwork.
RULE_WIDTH_FRACTION = 0.4

# (y0, y1, name, frames) per row taken, with the counts the sheet's own labels state. Bands
# are generous: segmentation finds the figures inside them. See the docstring for the rows
# left out.
ROWS = [
    (120, 350, 'idle', 8),
    (595, 812, 'slash', 8),
    (1295, 1490, 'defense', 4),
]


def solid_mask(a):
    """Ink, with the printed rule lines taken out.

    A rule runs the full width of the sheet, so it bridges every figure in a row. With them
    in place, growing a figure outward floods the whole row; with them gone, each figure is
    an island and can be grown as far as its own sword reaches.
    """
    page = (a.mean(axis=2) > 180) & (a.max(axis=2) - a.min(axis=2) < 22)
    solid = ~page
    width = solid.shape[1]
    for y in range(solid.shape[0]):
        if longest_run(solid[y]) > width * RULE_WIDTH_FRACTION:
            solid[y, :] = False
    return solid


def longest_run(row):
    best = current = 0
    for value in row:
        current = current + 1 if value else 0
        if current > best:
            best = current
    return best


def body_mask(a, luminance, saturation):
    """Pixels that are the character's body rather than its glow or a printed label.

    The armour is deep blue and gold: saturated *and* dark. Effects are saturated but
    bright; the labels are dark but grey. Requiring both rules out both.
    """
    lum = a.mean(axis=2)
    sat = a.max(axis=2) - a.min(axis=2)
    mask = (sat > saturation) & (lum < luminance)
    mask[:HEADER_HEIGHT, :] = False
    return mask


def clusters(mask, y0, y1, min_width, min_density):
    """Column runs of figure within a row band."""
    prof = mask[y0:y1 + 1, :].sum(axis=0)
    out = []
    run = None
    for x, v in enumerate(prof):
        if v > min_density:
            run = [x, x] if run is None else [run[0], x]
        elif run is not None:
            if run[1] - run[0] >= min_width:
                out.append((run[0], run[1]))
            run = None
    if run is not None and run[1] - run[0] >= min_width:
        out.append((run[0], run[1]))
    return out


def segment_row(a, y0, y1, count):
    """Find the frame spans in a row, using the label's frame count as ground truth.

    A wrong split would silently mangle the animation, so this demands both the stated
    count *and* frame widths consistent with one another, and fails loudly rather than
    guessing.
    """
    for luminance in range(90, 200, 5):
        for saturation in (30, 45, 60):
            mask = body_mask(a, luminance, saturation)
            for min_width in (10, 15, 20, 28, 36):
                for min_density in (1, 2, 3, 5, 8):
                    found = clusters(mask, y0, y1, min_width, min_density)
                    if len(found) != count:
                        continue
                    widths = [x1 - x0 + 1 for (x0, x1) in found]
                    if max(widths) / min(widths) <= MAX_WIDTH_RATIO:
                        return found, mask
    raise SystemExit(f'row y{y0}-{y1}: no segmentation yields {count} evenly-sized figures')


def lift(a, solid, body, y0, y1, bx0, bx1):
    """Grow one figure out from its armour and return (pixels, mask, bbox).

    Unbounded horizontally: the figure stops where its own ink stops. A sword reaching past
    where the next pose begins is fine, because the two are separate islands once the rule
    lines are gone.
    """
    band_solid = solid[y0:y1 + 1, :]
    band_body = body[y0:y1 + 1, :]
    h, w = band_solid.shape

    keep = np.zeros((h, w), dtype=bool)
    dq = deque()
    for (yy, xx) in zip(*np.nonzero(band_body[:, bx0:bx1 + 1])):
        gx = xx + bx0
        keep[yy, gx] = True
        dq.append((yy, gx))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and band_solid[ny, nx] and not keep[ny, nx]:
                keep[ny, nx] = True
                dq.append((ny, nx))

    # Safety net for the case where two poses do touch: keep the piece holding the most
    # armour, so a neighbour that got joined on is still dropped.
    keep = main_figure(keep, band_body)

    ys = np.nonzero(keep.any(axis=1))[0]
    xs = np.nonzero(keep.any(axis=0))[0]
    if len(ys) == 0 or len(xs) == 0:
        return None
    return a[y0:y1 + 1, :], keep, (xs.min(), ys.min(), xs.max(), ys.max())


def main_figure(keep, body, min_share=0.25):
    """Keep the piece holding the most body pixels, and any comparably solid with it.

    `min_share` is relative to the biggest piece's body-pixel count, so a figure that the
    mask happens to split in two survives while a neighbour's blade tip does not.
    """
    h, w = keep.shape
    seen = np.zeros((h, w), dtype=bool)
    pieces = []
    for sy in range(h):
        for sx in range(w):
            if not keep[sy, sx] or seen[sy, sx]:
                continue
            seen[sy, sx] = True
            stack = [(sy, sx)]
            pixels = []
            while stack:
                y, x = stack.pop()
                pixels.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and keep[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
            pieces.append(pixels)
    if not pieces:
        return keep
    scored = [(sum(1 for (y, x) in px if body[y, x]), px) for px in pieces]
    best = max(score for score, _ in scored)
    if best == 0:
        return keep
    out = np.zeros_like(keep)
    for score, pixels in scored:
        if score >= best * min_share:
            for (y, x) in pixels:
                out[y, x] = True
    return out


def main():
    a = np.array(Image.open(SRC).convert('RGB')).astype(int)
    solid = solid_mask(a)

    animations = []
    for (y0, y1, name, count) in ROWS:
        frames, mask = segment_row(a, y0, y1, count)
        lifted = []
        for (bx0, bx1) in frames:
            got = lift(a, solid, mask, y0, y1, bx0, bx1)
            if got:
                lifted.append(got)
        animations.append((name, lifted))
        print(f'  {name}: {len(lifted)}/{count} poses')
        if len(lifted) != count:
            raise SystemExit(f'{name}: expected {count} poses, kept {len(lifted)}')
        # A *body* flush against the band edge has been cut off by the band rather than
        # framed by it, and a silently beheaded sprite is worse than a failed build. The
        # grown mask is not the thing to test: this page's guide grid and ground shading run
        # continuously down it, so the glow legitimately reaches the edge.
        band_height = y1 - y0
        clipped = []
        for i, (bx0, bx1) in enumerate(frames):
            body = mask[y0:y1 + 1, bx0:bx1 + 1]
            ys = np.nonzero(body.any(axis=1))[0]
            # Only the top matters. Ground shading under the figures runs to the bottom of
            # every band on this page, so a body reaching the lower edge is expected; a body
            # reaching the *upper* edge means the band has cut its head off.
            if len(ys) and ys.min() == 0:
                clipped.append(i)
        if clipped:
            raise SystemExit(f'{name}: bodies {clipped} are cut off at the top — raise the band')

    cols = max(len(f) for _, f in animations)
    rows = len(animations)
    maxw = max(bb[2] - bb[0] + 1 for _, f in animations for (_, _, bb) in f)
    maxh = max(bb[3] - bb[1] + 1 for _, f in animations for (_, _, bb) in f)
    cellw, cellh = maxw + PAD * 2, maxh + PAD * 2
    print(f'grid {cols}x{rows}, largest pose {maxw}x{maxh} -> cell {cellw}x{cellh}')

    out = np.zeros((cellh * rows, cellw * cols, 4), dtype=np.uint8)
    for ri, (name, lifted) in enumerate(animations):
        # Ground for the row: the lowest pixel any pose reaches, so a leaping or crouching
        # pose keeps its height instead of being planted on the baseline.
        ground = max(bb[3] for (_, _, bb) in lifted)
        for ci, (sub, keep, bb) in enumerate(lifted):
            bx0, by0, bx1, by1 = bb
            sw, sh = bx1 - bx0 + 1, by1 - by0 + 1
            m = keep[by0:by1 + 1, bx0:bx1 + 1]
            px = sub[by0:by1 + 1, bx0:bx1 + 1]

            # Anchor on the lower body so a thrust or a wide swing doesn't drag the figure
            # sideways from one frame to the next.
            legs = m[int(sh * 0.7):, :]
            xs = np.nonzero(legs.any(axis=0))[0]
            anchor = (xs.min() + xs.max()) / 2 if len(xs) else sw / 2

            dy = ground - by1
            dest_x = int(round(ci * cellw + cellw / 2 - anchor))
            dest_y = int(round((ri + 1) * cellh - PAD - dy - sh))
            # Clamp inside the padding, not just inside the cell: the lower-body anchor can
            # push a wide pose flush against the edge, and a frame flush with its cell bleeds
            # a sliver of its neighbour once the sheet is scaled. Cells are sized maxw/maxh +
            # 2*PAD, so there is always room for this.
            dest_x = max(ci * cellw + PAD, min(dest_x, (ci + 1) * cellw - PAD - sw))
            dest_y = max(ri * cellh + PAD, min(dest_y, (ri + 1) * cellh - PAD - sh))

            region = out[dest_y:dest_y + sh, dest_x:dest_x + sw]
            region[..., :3] = np.where(m[..., None], px, region[..., :3])
            region[..., 3] = np.where(m, 255, region[..., 3])

    sheet = Image.fromarray(out, 'RGBA')
    if cellh > OUTPUT_CELL_HEIGHT:
        factor = OUTPUT_CELL_HEIGHT / cellh
        sheet = sheet.resize(
            (max(1, round(sheet.width * factor)), max(1, round(sheet.height * factor))),
            Image.LANCZOS,
        )
        print(f'resampled by {factor:.3f} to {sheet.width}x{sheet.height} (cell ~{round(cellw * factor)}x{round(cellh * factor)})')
    sheet.save(DEST)
    print(f'wrote {DEST}: {sheet.width}x{sheet.height}')
    for ri, (name, lifted) in enumerate(animations):
        idx = [ri * cols + c for c in range(len(lifted))]
        tail = f' (cells {idx[-1] + 1}-{ri * cols + cols - 1} empty)' if len(lifted) < cols else ''
        print(f'  {name}: frames {idx[0]}-{idx[-1]}{tail}')

    idle = next(f for n, f in animations if n == 'idle')
    tallest = max(bb[3] - bb[1] + 1 for (_, _, bb) in idle)
    print(f'  figureRatio (idle) = {tallest} / {cellh}')


if __name__ == '__main__':
    main()
