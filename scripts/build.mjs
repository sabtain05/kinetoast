import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(currentDir);
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');

const modules = [
  'constants.js',
  'clock.js',
  'timer.js',
  'layout.js',
  'engine.js'
];

const exportedSymbols = [
  'DEFAULT_CONFIG',
  'EVICTION_POLICIES',
  'PLACEMENTS',
  'STACK_ORDER',
  'TOAST_STATUS',
  'createSystemClock',
  'createManualClock',
  'createToastTimer',
  'parsePlacement',
  'computeStackLayout',
  'createToastEngine'
];

function stripImportsAndExports(source) {
  let code = source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '');
  code = code.replace(/^export\s+(?=(?:const|let|var|function|class)\b)/gm, '');
  return code.trim();
}

const combinedBody = modules
  .map((filename) => stripImportsAndExports(readFileSync(join(srcDir, filename), 'utf8')))
  .join('\n\n');

const esmBundle = `${combinedBody}\n\nexport {\n  ${exportedSymbols.join(',\n  ')}\n};\n`;
const cjsBundle = `'use strict';\n\n${combinedBody}\n\nmodule.exports = {\n  ${exportedSymbols.join(',\n  ')}\n};\n`;

mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'index.mjs'), esmBundle, 'utf8');
writeFileSync(join(distDir, 'index.cjs'), cjsBundle, 'utf8');
