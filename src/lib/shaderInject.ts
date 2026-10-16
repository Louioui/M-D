/**
 * String.replace silently does nothing when a three.js chunk name changes
 * between releases, leaving an effect that compiles but never renders. Every
 * onBeforeCompile injection goes through here so a missing anchor fails loudly.
 */
export function inject(source: string, anchor: string, code: string, position: 'after' | 'before' = 'after') {
  if (!source.includes(anchor)) throw new Error(`[md] shader anchor not found: ${anchor}`);
  return source.replace(anchor, position === 'after' ? `${anchor}\n${code}` : `${code}\n${anchor}`);
}
