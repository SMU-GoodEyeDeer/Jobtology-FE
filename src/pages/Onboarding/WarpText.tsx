/** Keep a continuous accessible label while animating whole Korean characters. */
export function WarpText({ text, strength = 24, radius = 160 }: { readonly text: string; readonly strength?: number; readonly radius?: number }) {
  return <span className="landing-warp-text">
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">{text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word :
      <span className="landing-warp-word" key={index}>{Array.from(word).map((character, characterIndex) =>
        <span className="landing-warp-char" data-mouse-field={strength} data-field-radius={radius} data-field-kind="character" key={characterIndex}>{character}</span>,
      )}</span>,
    )}</span>
  </span>;
}
