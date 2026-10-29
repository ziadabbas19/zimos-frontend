/**
 * Words a shopper reads exactly as they are (backend pages/pageTree.js
 * `check.plainText`, the story gallery's titles and descriptions). The server
 * refuses markup — anything between "<" and ">" — and control or hidden
 * characters (zero-width marks, direction overrides), which could make a text
 * read as something other than what it says. A field holding such words drops
 * them as they are typed or pasted, so the page always saves.
 *
 * A lone "<" or ">" stays: only a whole tag is markup, there as on the server.
 */

const MARKUP = /<[^>]*>/g;

/** The characters the server refuses: controls (tab and line breaks aside), DEL, zero-width marks and direction controls. */
function hidden(code: number): boolean {
  return (
    (code < 32 && code !== 9 && code !== 10 && code !== 13) ||
    code === 127 ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

export function plainText(value: string): string {
  // One pass leaves no tag: each one taken out starts at the first "<" that has a ">" after it.
  return Array.from(value.replace(MARKUP, ""))
    .filter((char) => !hidden(char.charCodeAt(0)))
    .join("");
}
