import "./river-brand-mark.css";

/** A split V: two banks define a river through the negative space. */
export function RiverBrandMark() {
  return <span className="river-brand-mark" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <path d="M4 8H14L23 27C25 32 24 37 21 42H17L4 8Z" fill="#c1dcad" />
      <path d="M34 8H44L29 42H25C28 36 29 31 27 26L34 8Z" fill="#c1dcad" />
    </svg>
  </span>;
}
