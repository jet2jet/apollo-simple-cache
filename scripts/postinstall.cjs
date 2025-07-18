// Patches @apollo/client package.json for esm/cjs imports

const fs = require('fs');
const path = require('path');

try {
  const apolloPackageJsonPath = path.resolve(
    __dirname,
    '../node_modules/@apollo/client/package.json'
  );
  const jsonData = fs.readFileSync(apolloPackageJsonPath, 'utf-8');
  const json = JSON.parse(jsonData);
  json.exports = {
    '.': {
      import: './index.js',
      require: './main.cjs',
      types: './index.d.ts',
    },
    './cache': {
      import: './cache/index.js',
      require: './cache/cache.cjs',
      types: './cache/index.d.ts',
    },
    './cache/core/types/common': {
      import: './cache/core/types/common.js',
      types: './cache/core/types/common.d.ts',
    },
    './utilities': {
      import: './utilities/index.js',
      require: './utilities/utilities.cjs',
      types: './utilities/index.d.ts',
    },
    './dev': {
      import: './dev/index.js',
      require: './dev/dev.cjs',
      types: './dev/index.d.ts',
    },
  };
  fs.writeFileSync(
    apolloPackageJsonPath,
    JSON.stringify(json, null, 2),
    'utf-8'
  );
} catch {
  // do nothing
}
