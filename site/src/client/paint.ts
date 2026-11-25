const styles = new WeakMap<HTMLElement, Map<string, string>>()

export function paint(el: HTMLElement, prop: string, value: string): void {
  let seen = styles.get(el)
  if (!seen) {
    seen = new Map()
    styles.set(el, seen)
  }
  if (seen.get(prop) === value) return
  seen.set(prop, value)
  el.style.setProperty(prop, value)
}

export function one<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const found = root.querySelector<T>(selector)
  if (!found) throw new Error(`nothing matches ${selector}`)
  return found
}

export function all<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return [...root.querySelectorAll<T>(selector)]
}
