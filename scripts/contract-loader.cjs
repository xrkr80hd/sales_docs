const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { registerHooks } = require('node:module');
const ts = require('typescript');

// Load only checked-in project modules, with external services replaced before
// any route executes. No VM, eval, or live service credentials are used.
module.exports = function contractLoader(overrides = {}) {
  overrides = { 'server-only': {}, ...overrides };
  const root = path.resolve(__dirname, '..');
  const mocks = new Map(Object.entries(overrides).map(([name, exports], index) => {
    const filename = path.join(__dirname, `contract-mock-${crypto.randomUUID()}-${index}.cjs`);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
    return [name, pathToFileURL(filename).href];
  }));
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (mocks.has(specifier)) return { url: mocks.get(specifier), shortCircuit: true };
      if (specifier.startsWith('@/')) {
        const filename = path.resolve(root, specifier.slice(2) + '.ts');
        if (!filename.startsWith(root + path.sep)) throw new Error('Module outside repository');
        return { url: pathToFileURL(filename).href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.startsWith('file:') && url.endsWith('.ts')) {
        const filename = fileURLToPath(url);
        if (!filename.startsWith(root + path.sep)) throw new Error('Module outside repository');
        const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        return { format: 'commonjs', source, shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });
  return filename => {
    if (!filename.startsWith(root + path.sep)) throw new Error('Module outside repository');
    return require(filename);
  };
};
