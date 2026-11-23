/**
 * A thin horizontal hunger bar. The red fill is drawn full width and scaled from the left with a transform.
 * It is full at one day idle, which is when a tab becomes Starving.
 */
export function HungerBar({ fill, label }: { fill: number; label: string }) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fill) ? fill : 0));
  return (
    <div className="hunger-bar" role="img" aria-label={label} data-fill={clamped.toFixed(3)}>
      <span className="hunger-fill" style={{ transform: `scaleX(${clamped})` }} />
    </div>
  );
}
