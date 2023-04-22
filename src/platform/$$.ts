function $$(
  selector: string,
  root: HTMLElement = document.body
): HTMLElement[] | HTMLAnchorElement[] {
  return Array.from(root.querySelectorAll(selector));
}
export default $$;
