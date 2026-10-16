import { useMemo, type CSSProperties, type ReactElement } from 'react';
import { useLanguage } from '../i18n';
import { CAR_PALETTE, DAVID_PALETTE, LANE_TILE, SKYLINE_TILE, SPRITES, STREETLIGHT_TILE } from './pixelSprites';

// Pixel David cruising a silver Mercedes-Benz roadster, GIF-style: the car stays
// put while skyline, streetlights and lane paint scroll past at parallax speeds,
// so he looks like he's driving forward forever. Pure CSS animation (transforms
// and opacity only); prefers-reduced-motion freezes it with the bubble showing.

/** Row run-length encoding keeps each sprite to a few dozen <rect>s. */
function pixels(rows: readonly string[], palette: Record<string, string>, key: string) {
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (c !== '.') rects.push(<rect key={`${key}${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={palette[c]} />);
      x = end;
    }
  });
  return rects;
}

/** A scenery band that slides exactly one tile per loop (seamless). */
function layer(className: string, tile: { width: number; image: string }, seconds: number) {
  const style = { '--tile': `${tile.width}px`, '--speed': `${seconds}s`, backgroundImage: tile.image } as CSSProperties;
  return <span className={`pixel-layer ${className}`} style={style} aria-hidden="true" />;
}

export default function PixelDrive() {
  const { copy } = useLanguage();
  const art = useMemo(() => ({
    car: pixels(SPRITES.CAR, CAR_PALETTE, 'c'),
    wheelA: pixels(SPRITES.WHEELS_A, CAR_PALETTE, 'a'),
    wheelB: pixels(SPRITES.WHEELS_B, CAR_PALETTE, 'b'),
    david: pixels(SPRITES.DAVID, DAVID_PALETTE, 'd'),
  }), []);

  return <div className="pixel-drive" role="img" aria-label={copy.booking.pixelLabel}>
    <div className="pixel-road">
      {layer('pixel-skyline', SKYLINE_TILE, 8)}
      {layer('pixel-lights', STREETLIGHT_TILE, 2)}
      <span className="pixel-asphalt" aria-hidden="true" />
      {layer('pixel-lane', LANE_TILE, .28)}
      <div className="pixel-run">
        <div className="pixel-bubble" aria-hidden="true">{copy.booking.pixelBubble}</div>
        <svg className="pixel-car" viewBox="0 -12 40 28" shapeRendering="crispEdges" aria-hidden="true">
          <g transform="translate(10 -9)"><g className="pixel-head">{art.david}</g></g>
          <rect x={4} y={15} width={32} height={1} fill="#000" opacity={.35} />
          <g>{art.car}</g>
          <g className="pixel-wheel-a">{art.wheelA}</g>
          <g className="pixel-wheel-b">{art.wheelB}</g>
        </svg>
      </div>
    </div>
  </div>;
}
