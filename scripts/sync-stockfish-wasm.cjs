#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stockfishRoot = process.env.STOCKFISH_ROOT
  ? path.resolve(process.env.STOCKFISH_ROOT)
  : path.join(root, 'stockfish');
const sourceDirs = [
  path.join(stockfishRoot, 'bin'),
  path.join(stockfishRoot, 'src')
];

const engines = [
  {
    publicName: 'stockfish-18',
    required: true,
    candidates: [
      'stockfish-18-lite-single',
      'stockfish-18-single',
      'stockfish-18-lite',
      'stockfish-18',
      'stockfish'
    ]
  },
  {
    publicName: 'stockfish-16.1',
    required: false,
    candidates: [
      'stockfish-16.1-lite-single',
      'stockfish-16.1-single',
      'stockfish-16.1-lite',
      'stockfish-16.1',
      'stockfish-16-lite-single',
      'stockfish-16-single',
      'stockfish-16'
    ]
  }
];

function exists(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function findEngineBundle(engine) {
  for (const dir of sourceDirs) {
    for (const base of engine.candidates) {
      const js = path.join(dir, `${base}.js`);
      const wasm = path.join(dir, `${base}.wasm`);
      if (exists(js) && exists(wasm)) {
        return { dir, base, js, wasm, parts: [] };
      }

      if (exists(js)) {
        const parts = fs.existsSync(dir)
          ? fs.readdirSync(dir)
              .filter((file) => file.startsWith(`${base}-part-`) && file.endsWith('.wasm'))
              .sort()
              .map((file) => path.join(dir, file))
          : [];
        if (parts.length) {
          return { dir, base, js, wasm: null, parts };
        }
      }
    }
  }

  return null;
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function clearOldPublicAssets(publicEngineDir) {
  fs.mkdirSync(publicEngineDir, { recursive: true });
  for (const file of fs.readdirSync(publicEngineDir)) {
    if (file === 'stockfish.js' || file === 'stockfish.wasm' || /^stockfish-part-\d+\.wasm$/.test(file)) {
      fs.unlinkSync(path.join(publicEngineDir, file));
    }
  }
}

engines.forEach((engine) => {
  const bundle = findEngineBundle(engine);
  if (!bundle) {
    if (engine.required) {
      throw new Error(
        `No ${engine.publicName} WASM bundle found in ${sourceDirs.join(' or ')}. ` +
          'Build one with `cd stockfish && npm run build-single-lite`, or place the built .js/.wasm pair in stockfish/bin.'
      );
    }
    console.warn(`Skipping optional ${engine.publicName} bundle; no matching .js/.wasm pair found.`);
    return;
  }

  const publicEngineDir = path.join(root, 'public', 'engines', engine.publicName);
  clearOldPublicAssets(publicEngineDir);

  copyFile(bundle.js, path.join(publicEngineDir, 'stockfish.js'));
  if (bundle.wasm) {
    copyFile(bundle.wasm, path.join(publicEngineDir, 'stockfish.wasm'));
  } else {
    bundle.parts.forEach((part, index) => {
      copyFile(part, path.join(publicEngineDir, `stockfish-part-${index}.wasm`));
    });
  }

  console.log(`Synced ${bundle.base} from ${path.relative(root, bundle.dir)} to ${path.relative(root, publicEngineDir)}`);
});
