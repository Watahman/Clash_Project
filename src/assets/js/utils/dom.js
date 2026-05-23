export function show(el) { el?.classList.remove('hidden') }
export function hide(el) { el?.classList.add('hidden') }
export function toggle(el, condition) { el?.classList.toggle('hidden', !condition) }
