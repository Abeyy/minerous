#!/usr/bin/env python3
"""Build src/assets/cleric-sheet.png from the source art in assets/cleric_animations.png.

The source is four labelled rows of poses on an opaque grey checkerboard. Three things
make it unusable as-is:

  * a title and row labels are baked into the image
  * the rows hold different numbers of poses (7, 6, 6, 6), on no consistent pitch
  * staffs, floating symbols and ground circles overflow well past each figure

So: crop away the lettering, key out the checkerboard, group each row's content into
poses by the gaps between them, and recompose onto a uniform grid with feet on a shared
baseline. Rows shorter than the widest are padded with empty cells at the end.

    python3 scripts/build-cleric-sheet.py

Requires Pillow and numpy.
"""
from collections import deque

import numpy as np
from PIL import Image

SRC = 'assets/cleric_animations.png'
DEST = 'src/assets/cleric-sheet.png'

# The lettering sits above and to the left of every pose: the title spans y 27..98 and the
# widest row label ("SPELL CASTING") ends at x 506, while the leftmost pose pixel is 556.
CROP_LEFT = 530
CROP_TOP = 150

# The checkerboard is two neutral greys, 127 and 181, with 1-2px antialiasing between
# them. Treating the whole span as background keeps those seams from surviving as speckle.
BG_LOW, BG_HIGH = 112, 198
NEUTRAL = 14

# Once the checkerboard is keyed out, each pose is a single unbroken column span — the
# white robes fill the gaps that a colour-only pass leaves between a figure and its staff.
# So poses need almost no merging: 2px only bridges antialiasing breaks. Anything larger
# starts swallowing neighbours, since the attack row's poses sit as close as 8px apart.
FRAME_GAP = 2
PAD = 6

ROW_NAMES = ['idle', 'attack', 'spell', 'heal']


def key_background(a):
    """Boolean mask of pose pixels.

    The colour test alone would punch holes in grey shading on the white robes, so it only
    nominates candidates; the actual background is whatever is reachable from the border.
    Anything enclosed by a figure stays opaque.
    """
    h, w, _ = a.shape
    gray = a.mean(axis=2)
    sat = a.max(axis=2) - a.min(axis=2)
    cand = (sat < NEUTRAL) & (gray > BG_LOW) & (gray < BG_HIGH)

    bg = np.zeros((h, w), dtype=bool)
    dq = deque()

    def seed(y, x):
        if cand[y, x] and not bg[y, x]:
            bg[y, x] = True
            dq.append((y, x))

    for x in range(w):
        seed(0, x)
        seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w:
                seed(ny, nx)

    opaque = ~bg
    clear_enclosed_pockets(a, cand, opaque)
    return opaque


def clear_enclosed_pockets(a, cand, opaque):
    """Erase checkerboard trapped inside a pose.

    Spell circles and healing glows ring the figure completely, so the squares they
    enclose are unreachable from the border and survive the fill as grey blocks. Those
    pockets are flat checkerboard, unlike any shading in the art, so a blob is only
    removed when it is both sizeable and almost entirely one of the two exact tones.
    """
    h, w = opaque.shape
    gray = a.mean(axis=2)
    checker = (np.abs(gray - 127) <= 8) | (np.abs(gray - 181) <= 8)
    suspect = cand & opaque
    seen = np.zeros((h, w), dtype=bool)
    removed = 0
    for sy in range(h):
        for sx in range(w):
            if not suspect[sy, sx] or seen[sy, sx]:
                continue
            seen[sy, sx] = True
            stack = [(sy, sx)]
            pixels = []
            while stack:
                y, x = stack.pop()
                pixels.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and suspect[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if len(pixels) < 12:
                continue
            flat = sum(1 for (y, x) in pixels if checker[y, x])
            if flat / len(pixels) >= 0.7:
                for (y, x) in pixels:
                    opaque[y, x] = False
                removed += 1
    if removed:
        print(f'  cleared {removed} enclosed background pocket(s)')


def spans(profile, min_run, gap):
    """Group indices where `profile` is non-zero, merging groups closer than `gap`."""
    groups = []
    run = None
    for i, v in enumerate(profile):
        if v > 0:
            run = [i, i] if run is None else [run[0], i]
        elif run is not None:
            groups.append(run)
            run = None
    if run is not None:
        groups.append(run)

    merged = []
    for g in groups:
        if merged and g[0] - merged[-1][1] <= gap:
            merged[-1][1] = g[1]
        else:
            merged.append(list(g))
    return [tuple(g) for g in merged if g[1] - g[0] >= min_run]


def main():
    full = np.array(Image.open(SRC).convert('RGB')).astype(int)
    opaque_full = key_background(full)

    # Drop the lettering by cropping, not by filtering shapes — the title is white and
    # would otherwise survive the key and read as a pose.
    a = full[CROP_TOP:, CROP_LEFT:]
    opaque = opaque_full[CROP_TOP:, CROP_LEFT:]

    bands = spans(opaque.sum(axis=1), min_run=40, gap=20)
    print(f'{len(bands)} rows found')
    if len(bands) != len(ROW_NAMES):
        raise SystemExit(f'expected {len(ROW_NAMES)} rows, found {len(bands)}')

    # Per row, split into poses and record each one's tight box.
    rows = []
    for name, (y0, y1) in zip(ROW_NAMES, bands):
        band = opaque[y0:y1 + 1, :]
        frames = []
        for (x0, x1) in spans(band.sum(axis=0), min_run=12, gap=FRAME_GAP):
            sub = opaque[y0:y1 + 1, x0:x1 + 1]
            ys = np.nonzero(sub.any(axis=1))[0]
            frames.append((x0, y0 + ys.min(), x1, y0 + ys.max()))
        rows.append(frames)
        print(f'  {name}: {len(frames)} poses')

    cols = max(len(f) for f in rows)
    maxw = max(b[2] - b[0] + 1 for f in rows for b in f)
    maxh = max(b[3] - b[1] + 1 for f in rows for b in f)
    cellw, cellh = maxw + PAD * 2, maxh + PAD * 2
    print(f'grid {cols}x{len(rows)}, largest pose {maxw}x{maxh} -> cell {cellw}x{cellh}')

    out = np.zeros((cellh * len(rows), cellw * cols, 4), dtype=np.uint8)

    for ri, frames in enumerate(rows):
        # Ground for the row is the lowest pixel any of its poses reaches, so a kneeling
        # or hovering pose keeps its height instead of being planted on the baseline.
        ground = max(b[3] for b in frames)
        for ci, (x0, y0, x1, y1) in enumerate(frames):
            sw, sh = x1 - x0 + 1, y1 - y0 + 1
            mask = opaque[y0:y1 + 1, x0:x1 + 1]
            px = a[y0:y1 + 1, x0:x1 + 1]

            # Anchor on the lower body so an outstretched staff doesn't drag the figure
            # sideways from one frame to the next.
            legs = mask[int(sh * 0.7):, :]
            xs = np.nonzero(legs.any(axis=0))[0]
            anchor = (xs.min() + xs.max()) / 2 if len(xs) else sw / 2

            dy = ground - y1
            dest_x = int(round(ci * cellw + cellw / 2 - anchor))
            dest_y = int(round((ri + 1) * cellh - PAD - dy - sh))
            dest_x = max(ci * cellw, min(dest_x, (ci + 1) * cellw - sw))
            dest_y = max(ri * cellh, min(dest_y, (ri + 1) * cellh - sh))

            region = out[dest_y:dest_y + sh, dest_x:dest_x + sw]
            region[..., :3] = np.where(mask[..., None], px, region[..., :3])
            region[..., 3] = np.where(mask, 255, region[..., 3])

    Image.fromarray(out, 'RGBA').save(DEST)
    print(f'wrote {DEST}: {cellw * cols}x{cellh * len(rows)}')
    for ri, (name, frames) in enumerate(zip(ROW_NAMES, rows)):
        idx = [ri * cols + c for c in range(len(frames))]
        print(f'  {name}: frames {idx[0]}-{idx[-1]}' +
              (f' (cells {idx[-1] + 1}-{ri * cols + cols - 1} empty)' if len(frames) < cols else ''))


if __name__ == '__main__':
    main()
