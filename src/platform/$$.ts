import { d } from '../globals/globals';

const $$ = (selector: string, root: HTMLElement | null = d.body): Element[] =>
  Array.from(root?.querySelectorAll(selector) ?? []) as Element[];

export default $$;