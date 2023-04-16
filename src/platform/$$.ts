const $$ = (selector: string, root: HTMLElement | null = document.body): Element[] =>
  Array.from(root?.querySelectorAll(selector) ?? []) as Element[];

export default $$;
