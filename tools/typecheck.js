import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselineFile = resolve(root, 'tools/typecheck-baseline.json');
const projects = ['tsconfig.json', 'tools/tsconfig.json'];
const update = process.argv.includes('--update-baseline');
const full = process.argv.includes('--full');
if ((update && full) || process.argv.slice(2).some(arg => !['--update-baseline', '--full'].includes(arg))) {
  throw new Error('Usage: node tools/typecheck.js [--update-baseline | --full]');
}

/** @typedef {Record<string, Record<string, number>>} Counts */
/** @typedef {{ version: number, projects: Record<string, Counts> }} Baseline */
/** @type {Baseline} */
const current = { version: 1, projects: {} };
/** @type {Map<string, ts.Diagnostic[]>} */
const diagnosticsByKey = new Map();
const formatHost = {
  getCanonicalFileName: (/** @type {string} */ path) => path,
  getCurrentDirectory: () => root,
  getNewLine: () => '\n',
};

for (const project of projects) {
  const config = ts.readConfigFile(resolve(root, project), ts.sys.readFile);
  if (config.error) throw new Error(ts.formatDiagnostics([config.error], formatHost));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(resolve(root, project)));
  if (parsed.errors.length) throw new Error(ts.formatDiagnostics(parsed.errors, formatHost));
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const counts = current.projects[project] = {};
  for (const diagnostic of diagnostics) {
    // Invalid compiler options and global errors must never be baselined.
    if (!diagnostic.file) throw new Error(ts.formatDiagnostics([diagnostic], formatHost));
    const file = relative(root, diagnostic.file.fileName).replaceAll('\\', '/');
    const code = `TS${diagnostic.code}`;
    const fileCounts = counts[file] ??= {};
    fileCounts[code] = (fileCounts[code] ?? 0) + 1;
    const key = `${project}:${file}:${code}`;
    const group = diagnosticsByKey.get(key) ?? [];
    group.push(diagnostic);
    diagnosticsByKey.set(key, group);
  }
}

// Stable order makes baseline changes easy to review on any operating system.
for (const project of projects) {
  current.projects[project] = Object.fromEntries(
    Object.entries(current.projects[project]).sort(([a], [b]) => a.localeCompare(b, 'en')).map(
      ([file, codes]) => [file, Object.fromEntries(Object.entries(codes).sort())],
    ),
  );
}
const total = [...diagnosticsByKey.values()].reduce((sum, group) => sum + group.length, 0);

if (full) {
  for (const group of diagnosticsByKey.values()) console.error(ts.formatDiagnostics(group, formatHost));
  console.log(`TypeScript full check: ${total} diagnostics across ${projects.length} projects.`);
  process.exitCode = total ? 1 : 0;
} else if (update) {
  await writeFile(baselineFile, JSON.stringify(current, null, 2) + '\n');
  console.log(`Recorded ${total} inherited TypeScript diagnostics. Review the baseline diff before committing.`);
} else {
  /** @type {Baseline} */
  const baseline = JSON.parse(await readFile(baselineFile, 'utf8'));
  if (baseline.version !== 1) throw new Error('Unsupported TypeScript baseline version');
  let failed = false;
  for (const project of projects) {
    for (const [file, codes] of Object.entries(current.projects[project])) {
      for (const [code, count] of Object.entries(codes)) {
        const allowed = baseline.projects[project]?.[file]?.[code] ?? 0;
        if (count > allowed) {
          failed = true;
          console.error(`${project}: ${file} has ${count} ${code} diagnostics (baseline: ${allowed}).`);
          console.error(ts.formatDiagnostics(diagnosticsByKey.get(`${project}:${file}:${code}`) ?? [], formatHost));
        }
      }
    }
  }
  process.exitCode = failed ? 1 : 0;
  if (!failed) console.log(`TypeScript baseline check passed (${total} inherited diagnostics; no count increases).`);
}
