import { rollup } from 'rollup';
import typescriptImport from '@rollup/plugin-typescript';
import setupFileInliner from './rollup-plugin-inline-file.js';
import faFix from './rollup-plugin-fa.js';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import generateMetadata from '../src/meta/metadata.js';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import importBase64 from './rollup-plugin-base64.js';
import generateManifestJson from '../src/meta/manifestJson.js';
import terserImport from '@rollup/plugin-terser';
import fixTsOutputFormat from './fix-ts-output-format.js';
import cleanup from 'rollup-plugin-cleanup';
import alias from '@rollup/plugin-alias';
import platformSpecific from './rollup-plugin-platform-specific.js';
import removeDecaffeinateComments from './rollup-plugin-remove-decaffeinate-comments.js';
import removeTestCode from './rollup-plugin-remove-test-code.js';

// These dual ESM/CJS packages publish CJS-shaped declarations for their ESM entry.
// Node loads the callable ESM default; align JSDoc with that runtime export.
const typescript = /** @type {typeof typescriptImport.default} */ (/** @type {unknown} */ (typescriptImport));
const terser = /** @type {typeof terserImport.default} */ (/** @type {unknown} */ (terserImport));

const createMinifier = () => terser({
  format: {
    max_line_len: 1000,
    comments: /^(?: ==\/?UserScript==| @|!)|license|\bcc\b|copyright/i,
  },
});

const __dirname = dirname(fileURLToPath(import.meta.url));

const buildDir = resolve(__dirname, '../dist/');

// Accept the old flags while documenting standard long options for new callers.
const args = process.argv.slice(2).map(arg => {
  if (arg === '-min') return '--minify';
  if (arg === '-no-format') return '--no-format';
  if (arg === '-test') return '--test';
  return arg.replace(/^-platform=/, '--platform=');
});
const { values } = parseArgs({
  args,
  options: {
    minify: { type: 'boolean', default: false },
    'no-format': { type: 'boolean', default: false },
    platform: { type: 'string' },
    test: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});
if (values.help) {
  console.log('Usage: npm run build -- [--platform=userscript|crx] [--minify] [--no-format] [--test]');
  process.exit(0);
}
const minify = values.minify;
const noFormat = values['no-format'];
const platform = /** @type {'crx'|'userscript'|undefined} */ (values.platform);
if (platform !== undefined && platform !== 'crx' && platform !== 'userscript') {
  throw new Error('incorrect value for the platform argument');
}
const buildForTest = values.test;

// https://github.com/rollup/plugins/discussions/1777
const createTsPlugin = () => typescript({
  tsconfig: resolve(__dirname, '../tsconfig.build.json'),
  compilerOptions: { outDir: buildDir, sourceMap: minify, inlineSources: minify },
});

(async () => {
  await mkdir(buildDir, { recursive: true });
  const packageJson = JSON.parse(await readFile(resolve(__dirname, '../package.json'), 'utf-8'));

  const fileName = `${packageJson.meta.path}${minify ? '.min' : ''}.user.js`;
  const metaFileName = `${packageJson.meta.path}${minify ? '.min' : ''}.meta.js`;

  // Development builds must never point to the previous maintainer's releases.
  const metadata = (await generateMetadata(packageJson, fileName, metaFileName))
    .replace(/(\/\/ @(?:updateURL|downloadURL)[ \t]+)[^\r\n]+/g, '$1none');

  const license = await readFile(resolve(__dirname, '../LICENSE'), 'utf8');

  const version = JSON.parse(await readFile(resolve(__dirname, '../version.json'), 'utf-8'));

  const inlineFile = setupFileInliner(packageJson);

  const cleanupPlugin = noFormat ? undefined : cleanup({
    extensions: minify ? ['html', 'css'] : ['js', 'ts', 'tsx', 'json', 'html', 'css'],
    comments: 'all',
    lineEndings: 'unix',
    maxEmptyLines: 1,
    sourcemap: minify,
  });

  const circularDependencies = [];
  const bundle = await rollup({
    input: resolve(__dirname, '../src/main/Main.ts'),
    onwarn(warning, warn) {
      if (warning.code === 'CIRCULAR_DEPENDENCY') circularDependencies.push(warning.message);
      else warn(warning);
    },
    plugins: [
      platform ? platformSpecific({
        platform,
        include: [
          // Only files that actually have platform specific code.
          "**/src/main/Main.ts",
          "**/src/platform/$.ts",
          "**/src/platform/CrossOrigin.ts",
        ],
        minify
      }) : undefined,
      buildForTest ? undefined : removeTestCode({
        include: [
          // Only files that actually have test code.
          "**/src/main/Main.ts",
          "**/src/classes/Post.ts",
          "**/src/Linkification/Linkify.ts",
        ],
        sourceMap: minify,
      }),
      noFormat || minify ? undefined : removeDecaffeinateComments({
        include: ["**/*.js", "**/*.ts", "**/*.tsx"],
      }),
      createTsPlugin(),
      alias({
        entries: [
          {
            find: /^@fa\/(.*)$/,
            replacement: resolve(__dirname, '../node_modules/@fortawesome/free-regular-svg-icons/$1.js')
          },
          {
            find: /^@fas\/(.*)$/,
            replacement: resolve(__dirname, '../node_modules/@fortawesome/free-solid-svg-icons/$1.js')
          },
        ]
      }),
      minify || noFormat ? undefined : fixTsOutputFormat({
        include: ["**/*.ts", "**/*.tsx"],
      }),
      inlineFile({
        include: ["**/*.html"],
        transformer(html) {
          if (!minify) return html;

          return html.replace(/\n */g, ' ');
        },
      }),
      inlineFile({
        include: ["**/*.css"],
        transformer(css) {
          if (!minify) return css;

          return css
            // Remove whitespace after colon in css rules.
            .replace(/^ {2,}([a-z-]+:) +/gm, '$1')
            // Remove newlines and trailing whitespace.
            .replace(/\r?\n[ \t+]*/g, '')
            // Remove last semicolon before the }.
            .replace(/;\}/g, '}')
            // Remove space between rule set and {.
            .replace(/ \{/g, '{')
            // Remove comments.
            .replace(/\/\*[^*]*\*\//g, '')
            // Remove space before and after these characters in selectors.
            .replace(/ ([>+~]) /g, '$1');
        }
      }),
      importBase64({ include: ["**/*.png", "**/*.gif", "**/*.wav", "**/*.woff", "**/*.woff2"] }),
      inlineFile({
        include: "**/package.json",
        wrap: false,
        transformer(input) {
          const meta = JSON.parse(input).meta;
          meta.includes_only = undefined;
          meta.matches_only = undefined;
          meta.matches = undefined;
          meta.matches_extra = undefined;
          meta.exclude_matches = undefined;
          meta.grants = undefined;
          return `export default ${JSON.stringify(meta, undefined, 1)};`;
        }
      }),
      inlineFile({
        include: "**/*.json",
        exclude: "**/package.json",
        wrap: false,
        transformer(input) {
          return `export default ${input};`;
        }
      }),
      faFix,
      cleanupPlugin,
    ].filter(Boolean)
  });

  /** @type {import('rollup').OutputOptions} */
  const sharedBundleOpts = {
    format: "iife",
    name: 'fourchanXZ',
    generatedCode: {
      // needed for possible circular dependencies
      constBindings: false,
    },
    // Can't be none as long as the root file defined exports
    // exports: 'none',
  };

  try {
    if (circularDependencies.length) {
      console.warn(`Inherited circular dependencies: ${circularDependencies.length}. See dist/build-warnings.json.`);
    }
    await writeFile(resolve(buildDir, 'build-warnings.json'), JSON.stringify(circularDependencies, null, 2) + '\n');
    // user script
    if (platform !== 'crx') {
      await bundle.write({
        ...sharedBundleOpts,
        banner: (metadata + license).replace(/\r\n/g, '\n'),
        file: resolve(buildDir, fileName),
        plugins: minify ? [createMinifier()] : [],
        sourcemap: minify,
      });

      await writeFile(resolve(buildDir, metaFileName), metadata);
    }

    // chrome extension
    if (platform !== 'userscript') {
      const crxDir = resolve(buildDir, minify ? 'crx-min' : 'crx');
      await mkdir(crxDir, { recursive: true });
      await bundle.write({
        ...sharedBundleOpts,
        banner: license.replace(/\r\n/g, '\n'),
        file: resolve(crxDir, 'script.js'),
        plugins: minify ? [createMinifier()] : [],
        sourcemap: minify,
      });

      const eventPage = await rollup({
        input: resolve(__dirname, '../src/meta/eventPage.ts'),
        plugins: [
          createTsPlugin(),
          minify || noFormat ? undefined : fixTsOutputFormat({ include: ["**/*.ts", "**/*.tsx"] }),
          cleanupPlugin,
        ].filter(Boolean),
      });

      try {
        await eventPage.write({
          format: 'iife',
          file: resolve(crxDir, 'eventPage.js'),
          plugins: minify ? [createMinifier()] : [],
          sourcemap: minify,
        });
      } finally {
        await eventPage.close();
      }

      await writeFile(
        resolve(crxDir, 'manifestV2.json'),
        generateManifestJson(packageJson, version, 2),
      );

      await writeFile(
        resolve(crxDir, 'manifestV3.json'),
        generateManifestJson(packageJson, version, 3),
      );
      await copyFile(resolve(crxDir, 'manifestV3.json'), resolve(crxDir, 'manifest.json'));

      for (const file of ['icon16.png', 'icon48.png', 'icon128.png']) {
        await copyFile(resolve(__dirname, '../src/meta/', file), resolve(crxDir, file));
      }
    }
  } finally {
    await bundle.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
