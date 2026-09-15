/**
 * The design system's `Icon`, as the kit defines it.
 *
 * The kit renders `<i class="bi bi-{name}" />` against the Bootstrap Icons webfont — the glyph set
 * Caffriend.fig draws from, with layer names matching the catalogue. The package is installed
 * rather than loaded from the CDN the kit's `tokens/icons.css` points at, so the glyphs are the
 * same ones but the call surface does not depend on a third-party origin at runtime.
 *
 * Icons are decorative here: every control that carries one also carries its own accessible name,
 * either as visible text or as a visually hidden label beside the glyph.
 */
export function Icon({name, size = 20, color}:{name:string; size?:number; color?:string}) {
  return <i className={`bi bi-${name}`} aria-hidden="true" style={{
    fontSize: size, width: size, height: size, lineHeight: 1, color,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }} />;
}

/** Readable by a screen reader and by the tests; invisible on screen. */
export const Hidden = ({children}:{children:React.ReactNode}) => <span className="call-sr">{children}</span>;
