/**
 * Placeholder cards with the same size as real ones, so the page does not jump
 * when the tabs arrive.
 */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <section aria-label="Loading open tabs" aria-busy="true">
      <ul className="card-grid" role="presentation">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="card card-skeleton" aria-hidden="true" />
        ))}
      </ul>
    </section>
  );
}
