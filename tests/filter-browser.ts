// Local fixture: node tests/filter-browser.ts, then open the printed URL.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import ts from 'typescript';
import fa from '../tools/rollup-plugin-fa.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await rollup({
  input: resolve(root, 'src/General/Settings/FilterEditor.ts'),
  plugins: [{
    name: 'filter-fixture',
    resolveId(source, importer) {
      if (source.startsWith('@fa')) {
        const solid = source.startsWith('@fas/');
        return resolve(root, `node_modules/@fortawesome/free-${solid ? 'solid' : 'regular'}-svg-icons/${source.split('/')[1]}.js`);
      }
      if (!importer || !source.startsWith('.')) return null;
      const path = resolve(dirname(importer), source);
      return [path, `${path}.ts`, `${path}.tsx`, `${path}.js`].find(candidate => existsSync(candidate)) ?? null;
    },
    transform(source, id) {
      if (id.endsWith('.html')) return { code: `export default ${JSON.stringify(source)};`, map: null };
      if (id.endsWith('.json')) return { code: `export default ${source};`, map: null };
      if (/\.tsx?$/.test(id)) return {
        code: ts.transpileModule(source, {
          compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, jsxFactory: 'h' }
        }).outputText,
        map: null
      };
    }
  }, fa]
});
const { output } = await bundle.generate({ format: 'iife', name: 'mountFilterEditor' });
await bundle.close();
const script = output[0].code;
const css = readFileSync(resolve(root, 'src/css/style.css'), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Filter editor test fixture</title><link rel="stylesheet" href="/style.css">
<style>body {font:13px Arial;margin:0;background:#eef2ff;color:#222} #fourchanx-settings {background:#eef2ff;margin:16px auto} .field {font-family:monospace} .icon {width:1em;height:1em}</style>
</head><body><div id="fourchanx-settings"><nav>4chan-XZ / Filter</nav><div class="section-container"><section class="section-filter">
<label>Filter field <select id="category"><option>general</option><option>comment</option><option>MD5</option><option>uniqueID</option></select></label>
<div id="editor"></div></section></div></div><script src="/editor.js"></script><script>
const category = document.querySelector('#category');
function mount() {
  const key = 'filter-fixture-' + category.value;
  mountFilterEditor(document.querySelector('#editor'), category.value, localStorage.getItem(key) || '', value => localStorage.setItem(key, value));
}
category.addEventListener('change', mount);
mount();
</script></body></html>`;
const server = createServer((request, response) => {
  const path = request.url;
  response.setHeader('Content-Type', path === '/editor.js' ? 'text/javascript' : path === '/style.css' ? 'text/css' : 'text/html');
  response.end(path === '/editor.js' ? script : path === '/style.css' ? css : html);
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') console.log(`Filter fixture: http://127.0.0.1:${address.port}`);
});
