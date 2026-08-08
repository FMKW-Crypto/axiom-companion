/**
 * Finds axiom.trade's right-hand sidebar column on a token page.
 *
 * The site ships hashed-free but purely utility-class markup (Tailwind), so
 * there is no stable selector to anchor on. Instead we detect the sidebar
 * geometrically: the outermost column that is tall (≥ half the viewport),
 * narrow (sidebar-sized, not a chart or table pane) and sits on the right
 * side. A breadth-first walk returns the outermost match, so we anchor to the
 * whole column rather than one of its inner cards.
 *
 * Returns null when the layout has no such column (narrow windows, or the
 * site shipped a redesign) — the caller then falls back to a floating
 * overlay, so the feature degrades rather than disappears.
 */
export function findSidebar(): HTMLElement | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Below ~1100px axiom collapses to a single column; nothing to anchor to.
  if (vw < 1100) return null;

  const queue: Array<{ el: HTMLElement; depth: number }> = [
    { el: document.body, depth: 0 },
  ];
  while (queue.length) {
    const { el, depth } = queue.shift()!;
    if (depth > 8) continue;
    for (const child of el.children) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
      const r = child.getBoundingClientRect();
      // Too narrow to be (or contain) the sidebar.
      if (r.width < 200) continue;
      const isSidebarShaped =
        r.width <= 480 && r.height >= vh * 0.5 && r.left >= vw * 0.55;
      if (isSidebarShaped) return child;
      queue.push({ el: child, depth: depth + 1 });
    }
  }
  return null;
}
