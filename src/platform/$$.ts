import { d } from '../globals/globals';

const $$ = (selector: string, root = d.body) => [...Array.from(root.querySelectorAll(selector))];
export default $$;