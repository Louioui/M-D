// Bridge between the engine canvas and the DOM HUD. Animation frames only
// write transforms/attributes here; layout is measured on resize/chapter change.
export const engineHud = {
  reticle: null as HTMLElement | null,
  leader: null as SVGPathElement | null,
  /** Canvas origin inside the sticky stage (px). */
  canvasX: 0,
  canvasY: 0,
  /** Point on the HUD card edge the leader line starts from (stage px), or null to hide. */
  card: null as { x: number; y: number } | null,
  /** Foreground parallax offset currently applied to the card (px, compositor transform). */
  drift: 0,
  lastX: NaN,
  lastY: NaN,
  hidden: true,

  /** Anchor in canvas pixels; `visible` false when the anchor is behind the camera. */
  place(x: number, y: number, visible: boolean) {
    const reticle = this.reticle, leader = this.leader;
    if (!reticle) return;
    if (!visible) {
      if (!this.hidden) { reticle.style.opacity = '0'; leader?.setAttribute('d', ''); this.hidden = true; }
      return;
    }
    const X = x + this.canvasX, Y = y + this.canvasY;
    if (!this.hidden && Math.abs(X - this.lastX) < .3 && Math.abs(Y - this.lastY) < .3) return;
    this.lastX = X; this.lastY = Y;
    if (this.hidden) { reticle.style.opacity = '1'; this.hidden = false; }
    reticle.style.transform = `translate3d(${X.toFixed(1)}px, ${Y.toFixed(1)}px, 0)`;
    if (leader) {
      const card = this.card;
      if (!card) leader.setAttribute('d', '');
      else {
        // Technical leader: horizontal run off the card, then a straight drop onto the anchor.
        const cy = card.y + this.drift;
        const elbow = card.x + (X > card.x ? 1 : -1) * Math.min(48, Math.abs(X - card.x) * .35);
        leader.setAttribute('d', `M${card.x.toFixed(1)} ${cy.toFixed(1)}H${elbow.toFixed(1)}L${X.toFixed(1)} ${Y.toFixed(1)}`);
      }
    }
  },
  /** Force the next frame to rewrite the leader (card or canvas moved). */
  dirty() { this.lastX = this.lastY = NaN; },
};
