import editorHTML from './Filter-editor.html';
import { buildPattern, exactField, filterFields, matchesRule, parseRule, type MatchMode } from '../../Filtering/FilterRule';
import Icon from '../../Icons/icon';

/** Storage stays with Settings; the editor owns only the currently selected field. */
export default function filterEditor(root: HTMLElement, field: string, initial: string, save: (value: string) => void) {
  root.innerHTML = editorHTML;
  const get = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const input = (name: string) => get<HTMLInputElement | HTMLSelectElement>(`[data-field="${name}"]`);
  const checked = (name: string) => get<HTMLInputElement>(`[data-field="${name}"]`).checked;
  const raw = get<HTMLTextAreaElement>('.filter-raw textarea');
  raw.name = field;
  raw.value = initial;
  const form = get<HTMLFormElement>('form');
  const error = get<HTMLElement>('.filter-builder-error');
  const preview = get<HTMLOutputElement>('.filter-preview');
  const testResult = get<HTMLOutputElement>('.filter-test-result');
  const undo = get<HTMLButtonElement>('[data-command="undo"]');
  const types = get<HTMLFieldSetElement>('.filter-types');
  types.hidden = field !== 'general';
  for (const type of filterFields) {
    // Exact-only fields have their own categories and cannot use a general regex.
    if (exactField(type)) continue;
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = type;
    checkbox.checked = ['subject', 'name', 'filename', 'comment'].includes(type);
    label.append(checkbox, document.createTextNode(type));
    types.append(label);
  }
  const exact = exactField(field);
  if (exact) {
    input('mode').value = 'equals';
    input('mode').disabled = true;
    get<HTMLInputElement>('[data-field="case"]').checked = true;
    input('case').disabled = true;
  }

  function build(): string {
    let line = buildPattern(input('value').value, input('mode').value as MatchMode, checked('case'), field, input('flags').value.trim());
    const options: string[] = [];
    if (field === 'general') {
      const selected = Array.from(types.querySelectorAll<HTMLInputElement>('input:checked'), el => el.value);
      if (!selected.length) throw new Error('Select at least one field.');
      options.push(`type:${selected.join(',')}`);
    }
    for (const name of ['boards', 'exclude', 'op', 'file', 'stub', 'reason']) {
      let value = input(name).value.trim();
      if (/[;\r\n]/.test(value)) throw new Error(`${name} cannot contain semicolons or line breaks.`);
      if (name === 'boards' || name === 'exclude') {
        value = value.split(',').map(board => board.trim().replace(/^\/([^/]+)\/$/, '$1')).filter(Boolean).join(',');
      }
      if (value) options.push(`${name}:${value}`);
    }
    const action = input('action').value;
    if (action === 'highlight' || action === 'both') {
      const className = input('highlight').value.trim();
      if (className && !/^[\w-]+$/.test(className)) throw new Error('Invalid highlight class.');
      options.push(className ? `highlight:${className}` : 'highlight', `top:${checked('top') ? 'yes' : 'no'}`);
    }
    if (action === 'hide' || action === 'both') options.push('hide');
    if (action === 'notify' || checked('notify')) options.push('notify');
    for (const name of ['poster', 'replies']) if (checked(name)) options.push(name);
    line += options.length ? `;${options.join(';')}` : '';
    const rule = parseRule(line, field);
    if (!rule || rule.warnings.length) throw new Error(rule?.warnings.join('; ') || 'Invalid rule.');
    // Detect ambiguous delimiters in exact values before storing a different rule.
    if (exact && rule.regexp !== input('value').value) throw new Error('This exact value contains a rule delimiter.');
    return line;
  }

  function updatePreview() {
    const highlighting = ['highlight', 'both'].includes(input('action').value);
    input('flags').disabled = exact || input('mode').value !== 'regex';
    input('highlight').disabled = input('top').disabled = !highlighting;
    testResult.textContent = '';
    try {
      preview.textContent = build();
      error.textContent = '';
      get<HTMLButtonElement>('[type="submit"]').disabled = false;
    } catch (err) {
      preview.textContent = '';
      error.textContent = input('value').value ? (err as Error).message : '';
      get<HTMLButtonElement>('[type="submit"]').disabled = true;
    }
  }

  const removals: { line: string; index: number }[] = [];
  function persist(refresh = true) {
    save(raw.value);
    get<HTMLElement>('.filter-save-status').textContent = 'Saved. Changes apply after reloading the page.';
    if (refresh) renderRules();
  }

  function renderRules() {
    const list = get<HTMLElement>('.filter-rule-list');
    list.replaceChildren();
    const diagnostics: string[] = [];
    let active = 0;
    raw.value.split('\n').forEach((line, index) => {
      const trimmed = line.trim();
      const disabled = trimmed.startsWith('#');
      const candidate = disabled ? trimmed.slice(1).trim() : trimmed;
      if (!candidate || disabled && !candidate.startsWith('/')) return;
      try {
        const rule = parseRule(candidate, field);
        if (rule && !disabled) {
          active++;
          for (const warning of rule.warnings) diagnostics.push(`Line ${index + 1}: ${warning}`);
        }
      } catch (err) {
        if (!disabled) diagnostics.push(`Line ${index + 1}: ${(err as Error).message}`);
      }
      const row = document.createElement('div');
      row.className = 'filter-rule-row';
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = !disabled;
      toggle.setAttribute('aria-label', `Enable rule on line ${index + 1}`);
      toggle.addEventListener('change', () => {
        const lines = raw.value.split('\n');
        lines[index] = toggle.checked ? candidate : `#${line}`;
        raw.value = lines.join('\n');
        persist();
      });
      const code = document.createElement('code');
      code.textContent = candidate;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.title = `Edit line ${index + 1}`;
      edit.setAttribute('aria-label', edit.title);
      Icon.set(edit, 'pencil');
      edit.addEventListener('click', () => {
        get<HTMLDetailsElement>('.filter-raw').open = true;
        const start = raw.value.split('\n').slice(0, index).reduce((sum, value) => sum + value.length + 1, 0);
        raw.focus();
        raw.setSelectionRange(start, start + line.length);
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.title = `Remove line ${index + 1}`;
      remove.setAttribute('aria-label', remove.title);
      Icon.set(remove, 'xmark');
      remove.addEventListener('click', () => {
        const lines = raw.value.split('\n');
        removals.push({ line: lines.splice(index, 1)[0], index });
        raw.value = lines.join('\n');
        undo.disabled = false;
        persist();
      });
      row.append(toggle, code, edit, remove);
      list.append(row);
    });
    get<HTMLElement>('.filter-count').textContent = `(${active} active)`;
    get<HTMLElement>('.filter-diagnostics').textContent = diagnostics.join('\n') || 'No errors found.';
    raw.setAttribute('aria-invalid', String(diagnostics.length > 0));
    if (diagnostics.length) get<HTMLDetailsElement>('.filter-raw').open = true;
  }

  undo.addEventListener('click', () => {
    const removal = removals.pop();
    if (!removal) return;
    const lines = raw.value ? raw.value.split('\n') : [];
    lines.splice(Math.min(removal.index, lines.length), 0, removal.line);
    raw.value = lines.join('\n');
    undo.disabled = !removals.length;
    persist();
  });
  raw.addEventListener('input', () => {
    get<HTMLElement>('.filter-save-status').textContent = 'Unsaved changes.';
    renderRules();
  });
  raw.addEventListener('change', () => persist(false));
  get<HTMLButtonElement>('[data-command="save"]').addEventListener('click', () => persist(false));
  form.addEventListener('input', updatePreview);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const line = build();
      if (raw.value.split('\n').some(existing => existing.trim() === line)) throw new Error('This rule already exists.');
      raw.value += `${raw.value && !raw.value.endsWith('\n') ? '\n' : ''}${line}`;
      persist();
    } catch (err) {
      error.textContent = (err as Error).message;
    }
  });
  get<HTMLButtonElement>('[data-command="test"]').addEventListener('click', () => {
    try {
      const rule = parseRule(build(), field)!;
      testResult.textContent = matchesRule(rule.regexp, get<HTMLTextAreaElement>('[data-field="sample"]').value)
        ? 'Pattern matches.' : 'Pattern does not match.';
    } catch (err) {
      testResult.textContent = (err as Error).message;
    }
  });
  updatePreview();
  renderRules();
}
