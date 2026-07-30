#!/usr/bin/env python3
"""Build src/assets/gunslinger-sheet.png from assets/gunslinger_spritesheet.png.

The source is a character *design* sheet, not a game sheet: a cream page with a large
portrait, printed section headings, frame numbers, and the poses themselves sitting in
beige cards of varying size, in groups of varying length. What it does have going for it
is that every usable pose is inside a card, so the cards can be found and lifted out.

Taken:  IDLE, and the four attack patterns (dual shot, hip-fire burst, trick shot,
        charge shot) — five animations, 31 poses.
Skipped: the MOVE SET row (running, dodge roll, jump). Those poses are printed straight
        onto the page with no cards to key against, and the game has no use for movement
        animations — the character stands in one spot and acts.

    python3 scripts/build-gunslinger-sheet.py

Requires Pillow and numpy.
"""
from collections import deque

import numpy as np
from PIL import Image

SRC = 'assets/gunslinger_spritesheet.png'
DEST = 'src/assets/gunslinger-sheet.png'

# Page background, and the card background the poses are drawn on.
PAGE = (244, 241, 224)
CARD = (239, 227, 202)
PAGE_TOL = (9, 9, 11)

# Regions of the page that are not poses: the outer border rule, and the portrait.
BORDER_MAX_X = 25
PORTRAIT = (70, 0, 180, 370)  # x0, y0, x1, y1

# A gap this wide between cards separates two *animations* sharing one band (hip-fire
# burst and trick shot sit side by side); anything smaller just separates frames.
GROUP_GAP = 20
PAD = 6

# The finished sheet is resampled so a cell is about this tall. The game draws a cell at
# roughly 97px, so this leaves a 2x margin for high-density screens while keeping the runtime
# scale near 1 — shrinking the source by more than a third with nearest-neighbour sampling is
# what made the sprite look grainy. Downscaling here, with a proper filter, is the fix.
OUTPUT_CELL_HEIGHT = 190

# Bands of cards, top to bottom, and what each group in them is called. A band with two
# names has its cards split by the first group-sized gap.
BAND_GROUPS = [
    ['idle'],
    ['dual_shot'],
    ['hip_fire', 'trick_shot'],
    ['charge_shot'],
]


def page_mask(a):
    """True where the pixel is the cream page (i.e. not part of a card)."""
    return (
        (np.abs(a[:, :, 0] - PAGE[0]) < PAGE_TOL[0])
        & (np.abs(a[:, :, 1] - PAGE[1]) < PAGE_TOL[1])
        & (np.abs(a[:, :, 2] - PAGE[2]) < PAGE_TOL[2])
    )


def find_cards(a):
    """Locate every pose card, grouped into bands and then animations."""
    card = ~page_mask(a)
    card[:, :BORDER_MAX_X] = False
    x0, y0, x1, y1 = PORTRAIT
    card[y0:y1, x0:x1] = False

    # Bands: horizontal stripes of card. The unboxed MOVE SET row shows up here too, as
    # one wide blob per label group rather than separate cards — it's dropped below by
    # taking only as many bands as BAND_GROUPS names, in order, that split into cards.
    rows = card.sum(axis=1)
    bands = []
    run = None
    for y, v in enumerate(rows):
        if v > 60:
            run = [y, y] if run is None else [run[0], y]
        elif run is not None:
            if run[1] - run[0] >= 60:
                bands.append(tuple(run))
            run = None
    if run is not None and run[1] - run[0] >= 60:
        bands.append(tuple(run))

    banded = []
    for (by0, by1) in bands:
        prof = card[by0:by1 + 1, :].sum(axis=0)
        threshold = (by1 - by0 + 1) * 0.55
        cards = []
        run = None
        for x, v in enumerate(prof):
            if v > threshold:
                run = [x, x] if run is None else [run[0], x]
            elif run is not None:
                if run[1] - run[0] >= 40:
                    cards.append((run[0], run[1]))
                run = None
        if run is not None and run[1] - run[0] >= 40:
            cards.append((run[0], run[1]))
        # The MOVE SET band yields 3 very wide blobs (a whole group each) rather than
        # per-pose cards; a real card band has more, narrower cards than that.
        if len(cards) >= 4:
            banded.append(((by0, by1), cards))

    if len(banded) != len(BAND_GROUPS):
        raise SystemExit(f'expected {len(BAND_GROUPS)} card bands, found {len(banded)}')

    groups = []
    for ((by0, by1), cards), names in zip(banded, BAND_GROUPS):
        splits = [[cards[0]]]
        for prev, cur in zip(cards, cards[1:]):
            if cur[0] - prev[1] > GROUP_GAP:
                splits.append([cur])
            else:
                splits[-1].append(cur)
        if len(splits) != len(names):
            raise SystemExit(f'band y{by0}-{by1}: expected {len(names)} group(s), found {len(splits)}')
        for name, group in zip(names, splits):
            groups.append((name, [(cx0, by0, cx1, by1) for (cx0, cx1) in group]))
    return groups


def lift_pose(a, box, claimed=None):
    """Key the card background off one pose, returning (rgb, alpha mask, bbox).

    `claimed` marks pixels an earlier card in this band already accounted for — its flash
    spilling across the boundary — so they are not attributed to this pose as well.
    """
    cx0, cy0, cx1, cy1 = box
    sub = a[cy0:cy1 + 1, cx0:cx1 + 1]
    h, w, _ = sub.shape

    # The card is a flat colour, so a tolerance test finds it — but the poses contain
    # pale cloth and bright muzzle flash, so only fill what connects to the card's edge.
    dist = np.abs(sub - np.array(CARD)).sum(axis=2)
    # Each card is drawn with a near-white rule along its top and bottom edge. That isn't
    # within tolerance of the card colour, so without counting it the rule survives the key
    # as a white bar across the frame. Pale *and* neutral: the muzzle flash is bright but
    # strongly yellow, so it stays, and the gunslinger's white shirt is enclosed by the
    # figure and never reachable from the edge.
    light = (sub.min(axis=2) > 225) & (sub.max(axis=2) - sub.min(axis=2) < 25)
    # Cards in a band don't all start at the same height, so the band's box is the union
    # and the shorter cards carry a few rows of bare page along their top edge. That tone
    # sits between the card colour and "pale neutral", so it needs naming explicitly.
    page_dist = np.abs(sub - np.array(PAGE)).sum(axis=2)
    cand = (dist < 40) | light | (page_dist < 30)

    bg = np.zeros((h, w), dtype=bool)
    dq = deque()

    def seed(y, x):
        if cand[y, x] and not bg[y, x]:
            bg[y, x] = True
            dq.append((y, x))

    # Seed the whole outer ring: the border rule *is* the edge, so a colour test there
    # would refuse to start the fill on exactly the pixels that need removing.
    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            cand[y, x] = True
            seed(y, x)
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            cand[y, x] = True
            seed(y, x)
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w:
                seed(ny, nx)

    mask = ~bg
    if claimed is not None:
        mask &= ~claimed[cy0:cy1 + 1, cx0:cx1 + 1]
    mask = drop_bleed_in(mask)
    ys = np.nonzero(mask.any(axis=1))[0]
    xs = np.nonzero(mask.any(axis=0))[0]
    if len(ys) == 0 or len(xs) == 0:
        return None
    return sub, mask, (xs.min(), ys.min(), xs.max(), ys.max())


def effect_mask(a):
    """Muzzle flash and beam pixels: bright and strongly warm.

    Leather, denim and shadow are neither, so this separates the gunslinger's effects from
    the gunslinger. Used to work out which pixels a card's flash spills into its neighbour.
    """
    lum = a.mean(axis=2)
    return (lum > 165) & ((a[:, :, 0] - a[:, :, 2]) > 60)


def claim_overflow(lifted_mask, effect, card_right, width):
    """Pixels of this card's flash that spill past its own right-hand edge.

    The cards sit shoulder to shoulder, so a beam runs straight out of its own card and into
    the next one's — where it reads as a flare hanging in the air behind the next pose. Each
    card therefore claims its own spill, and the card to its right subtracts it.

    The flood is confined to *effect* pixels, which is what makes it safe to cross the card
    boundary at all: a beam can be followed out, but the neighbouring gunslinger is not
    effect-coloured and can never be claimed by mistake.
    """
    h = lifted_mask.shape[0]
    claimed = np.zeros((h, width), dtype=bool)
    dq = deque()
    for (y, x) in zip(*np.nonzero(lifted_mask & effect)):
        claimed[y, x] = True
        dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < width and effect[ny, nx] and not claimed[ny, nx]:
                claimed[ny, nx] = True
                dq.append((ny, nx))
    # Only what lies beyond this card matters to the next one.
    claimed[:, :card_right + 1] = False
    return claimed


def drop_bleed_in(mask):
    """Remove muzzle flash that has bled in from the card to the left.

    The cards sit shoulder to shoulder and a flash overflows its own, so a pose can inherit
    the tail of its predecessor's — which shows up in game as a stray flare hanging in the
    air behind the gunslinger. It can't be filtered by size or by distance: the intruders run
    to a few hundred pixels and sit as close to the figure as his own flash does.

    What separates them is direction. Every pose on this sheet faces right, so his own muzzle
    flash is always to the right; anything detached and lying wholly to the *left* of his
    centre line came from the neighbour.
    """
    pieces = connected_pieces(mask)
    if len(pieces) < 2:
        return mask
    figure = max(pieces, key=len)
    fig_xs = [x for (_, x) in figure]
    centre = (min(fig_xs) + max(fig_xs)) / 2

    out = np.zeros_like(mask)
    for piece in pieces:
        if piece is not figure and max(x for (_, x) in piece) < centre:
            continue
        for (y, x) in piece:
            out[y, x] = True
    return out


def connected_pieces(mask):
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    pieces = []
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or seen[sy, sx]:
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
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
            pieces.append(pixels)
    return pieces


def main():
    a = np.array(Image.open(SRC).convert('RGB')).astype(int)
    groups = find_cards(a)

    effect = effect_mask(a)
    height, width = effect.shape

    poses = []
    for name, boxes in groups:
        lifted = []
        # Left to right, so each card can hand its spill on to the next.
        claimed = np.zeros((height, width), dtype=bool)
        for box in boxes:
            got = lift_pose(a, box, claimed)
            if not got:
                continue
            lifted.append(got)
            cx0, cy0, cx1, cy1 = box
            full = np.zeros((height, width), dtype=bool)
            full[cy0:cy1 + 1, cx0:cx1 + 1] = got[1]
            spill = claim_overflow(full[cy0:cy1 + 1, :], effect[cy0:cy1 + 1, :], cx1, width)
            claimed[cy0:cy1 + 1, :] |= spill
        poses.append((name, lifted))
        print(f'  {name}: {len(lifted)} poses')

    cols = max(len(p) for _, p in poses)
    rows = len(poses)
    maxw = max(bb[2] - bb[0] + 1 for _, p in poses for (_, _, bb) in p)
    maxh = max(bb[3] - bb[1] + 1 for _, p in poses for (_, _, bb) in p)
    cellw, cellh = maxw + PAD * 2, maxh + PAD * 2
    print(f'grid {cols}x{rows}, largest pose {maxw}x{maxh} -> cell {cellw}x{cellh}')

    out = np.zeros((cellh * rows, cellw * cols, 4), dtype=np.uint8)

    for ri, (name, lifted) in enumerate(poses):
        # Ground for the row: the lowest pixel any of its poses reaches, so a leaping or
        # crouching pose keeps its height rather than being planted on the baseline.
        ground = max(bb[3] for (_, _, bb) in lifted)
        for ci, (sub, mask, bb) in enumerate(lifted):
            bx0, by0, bx1, by1 = bb
            sw, sh = bx1 - bx0 + 1, by1 - by0 + 1
            m = mask[by0:by1 + 1, bx0:bx1 + 1]
            px = sub[by0:by1 + 1, bx0:bx1 + 1]

            # Anchor on the lower body so an outstretched revolver doesn't drag the
            # figure sideways between frames.
            legs = m[int(sh * 0.7):, :]
            xs = np.nonzero(legs.any(axis=0))[0]
            anchor = (xs.min() + xs.max()) / 2 if len(xs) else sw / 2

            dy = ground - by1
            dest_x = int(round(ci * cellw + cellw / 2 - anchor))
            dest_y = int(round((ri + 1) * cellh - PAD - dy - sh))
            # Clamp inside the padding, not just inside the cell: the lower-body anchor can
            # push a wide pose flush against the edge, and a frame flush with its cell bleeds
            # a sliver of its neighbour once the sheet is scaled.
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
        print(f'resampled by {factor:.3f} to {sheet.width}x{sheet.height}')
    sheet.save(DEST)
    print(f'wrote {DEST}: {sheet.width}x{sheet.height}')
    for ri, (name, lifted) in enumerate(poses):
        idx = [ri * cols + c for c in range(len(lifted))]
        tail = f' (cells {idx[-1] + 1}-{ri * cols + cols - 1} empty)' if len(lifted) < cols else ''
        print(f'  {name}: frames {idx[0]}-{idx[-1]}{tail}')

    # The idle row's figure height sets `figureRatio` in sprites.js.
    idle = next(p for n, p in poses if n == 'idle')
    tallest = max(bb[3] - bb[1] + 1 for (_, _, bb) in idle)
    print(f'  figureRatio (idle) = {tallest} / {cellh}')


if __name__ == '__main__':
    main()
