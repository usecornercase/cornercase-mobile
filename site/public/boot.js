const root = document.documentElement
root.classList.add('js')
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && innerHeight >= 480) {
  root.classList.add('motion', 'intro')
  setTimeout(() => {
    if (!root.dataset.alive) root.classList.remove('motion', 'intro')
  }, 4000)
}
