#!/usr/bin/env python3
"""Build src/assets/monk-sheet.png from the source art in assets/monksprites.png.

The source is 19 monk poses on an opaque grey checkerboard, and the poses are NOT laid
out on an even grid -- several straddle the boundaries an even 5x4 split would use, so
slicing the source directly cuts figures in half. This script keys out the checkerboard,
finds each pose by its own content, and recomposes them onto a uniform 5x4 grid with
feet on a shared baseline.

Re-run it after replacing the source art:

    python3 scripts/build-monk-sheet.py

Requires Pillow and numpy.
"""
from collections import deque

import numpy as np
from PIL import Image

SRC = 'assets/monksprites.png'
DEST = 'src/assets/monk-sheet.png'
COLS, ROWS = 5, 4
PAD = 6                  # blank margin around the tallest/widest pose
MIN_COMPONENT = 150      # px; smaller blobs are compression speckle
BG_TOLERANCE = 18        # how close to the modelled background counts as background
NEUTRAL = 14             # max channel spread for a pixel to count as grey


def load_source():
    img = Image.open(SRC).convert('RGB')
    return np.array(img).astype(int)


def key_background(a):
    """Return a boolean mask of sprite pixels.

    The background is a flat light grey crossed by darker grid lines, and JPEG noise
    smears both across the whole grey range -- so a plain colour key would eat the
    sprites' dark outlines. Instead: model the expected background from the sprite-free
    top rows and left columns (the expected value at (x, y) is whichever axis profile is
    darker), then flood fill in from the border. Requiring connectivity to the border
    means grey parts of a pose that happen to match, like the shading on the white hand
    wraps, stay opaque because they are enclosed by the figure.
    """
    h, w, _ = a.shape
    gray = a.mean(axis=2)
    sat = a.max(axis=2) - a.min(axis=2)

    vprof = np.median(gray[0:27, :], axis=0)
    hprof = np.median(gray[:, 0:20], axis=1)
    expected = np.minimum(vprof[None, :], hprof[:, None])

    cand = (np.abs(gray - expected) <= BG_TOLERANCE) & (sat <= NEUTRAL)

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

    return ~bg


def find_poses(opaque):
    """Label connected sprite blobs and return the pose-sized ones."""
    h, w = opaque.shape
    labels = np.zeros((h, w), dtype=int)
    poses = []
    nxt = 0
    for sy in range(h):
        for sx in range(w):
            if not opaque[sy, sx] or labels[sy, sx]:
                continue
            nxt += 1
            labels[sy, sx] = nxt
            stack = [(sy, sx)]
            ys, xs, n = [], [], 0
            while stack:
                y, x = stack.pop()
                ys.append(y)
                xs.append(x)
                n += 1
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and opaque[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = nxt
                            stack.append((ny, nx))
            box = (min(xs), min(ys), max(xs), max(ys))
            # A pose is a chunky blob; thin strips are edge artefacts in the source.
            if n >= MIN_COMPONENT and box[2] - box[0] > 20 and box[3] - box[1] > 40:
                poses.append({'id': nxt, 'n': n, 'box': box})
    return labels, poses


def group_rows(poses):
    rows = []
    for c in sorted(poses, key=lambda c: c['box'][1]):
        for r in rows:
            if c['box'][1] <= max(x['box'][3] for x in r) - 40:
                r.append(c)
                break
        else:
            rows.append([c])
    return [sorted(r, key=lambda c: c['box'][0]) for r in rows]


def compose(a, labels, rows, poses):
    maxw = max(c['box'][2] - c['box'][0] + 1 for c in poses)
    maxh = max(c['box'][3] - c['box'][1] + 1 for c in poses)
    cellw, cellh = maxw + PAD * 2, maxh + PAD * 2
    out = np.zeros((cellh * ROWS, cellw * COLS, 4), dtype=np.uint8)

    for ri, row in enumerate(rows):
        # The ground for a row is the lowest pixel any of its poses reaches. Offsetting
        # from that keeps airborne poses (the flying kick, the leaping punch) in the air
        # rather than dropping them onto the baseline.
        ground = max(c['box'][3] for c in row)
        for ci, c in enumerate(row):
            x0, y0, x1, y1 = c['box']
            sw, sh = x1 - x0 + 1, y1 - y0 + 1
            mask = labels[y0:y1 + 1, x0:x1 + 1] == c['id']
            px = a[y0:y1 + 1, x0:x1 + 1]

            # Anchor horizontally on the lower body: an extended arm would otherwise
            # drag the whole figure sideways from one frame to the next.
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

    return out, cellw, cellh


def main():
    a = load_source()
    opaque = key_background(a)
    labels, poses = find_poses(opaque)
    rows = group_rows(poses)

    print(f'{len(poses)} poses in {len(rows)} rows: ' +
          ', '.join(str(len(r)) for r in rows))
    if len(rows) != ROWS:
        raise SystemExit(f'expected {ROWS} rows, found {len(rows)}')
    if any(len(r) > COLS for r in rows):
        raise SystemExit(f'a row has more than {COLS} poses')

    out, cellw, cellh = compose(a, labels, rows, poses)
    Image.fromarray(out, 'RGBA').save(DEST)
    print(f'wrote {DEST}: {cellw * COLS}x{cellh * ROWS}, {COLS}x{ROWS} cells of {cellw}x{cellh}')


if __name__ == '__main__':
    main()
