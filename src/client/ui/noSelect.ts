// KB rule 24 fallback: browsers that ignore the user-select CSS still never select or pop a callout, except in inputs.
let installed = false

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof Element)) return false
  return !!t.closest('input, textarea, select, [contenteditable="true"]')
}

/** Install once at startup. Safe to call repeatedly. */
export function installNoSelect(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('selectstart', (e) => {
    if (!isEditable(e.target)) e.preventDefault()
  })
  document.addEventListener('contextmenu', (e) => {
    if (!isEditable(e.target)) e.preventDefault()
  })
}
