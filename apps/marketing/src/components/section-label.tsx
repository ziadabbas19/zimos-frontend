/**
 * The line above a home section's title: its number in brackets, in the
 * accent, then its name — "( 02 ) Store templates".
 */
export function SectionLabel({ n, text }: { n: string; text: string }) {
  return (
    <p className="zx-label">
      <b className="ltr" aria-hidden>
        ( {n} )
      </b>
      <span>{text}</span>
    </p>
  );
}
