import { promises as fs } from 'fs';
import * as path from 'path';

/** @param {String} fileName  */
async function rewriteDmts(fileName) {
  const content = await fs.readFile(fileName, 'utf-8');
  const newContent = content
    .split(/\r?\n/g)
    .map((line) => {
      line = line.replace(
        /from (['"])(.*?)\.mjs\1/,
        (_, $1, $2) => `from ${$1}${$2}.cjs${$1}`
      );
      return line;
    })
    .join('\n');
  await fs.writeFile(fileName, newContent, 'utf-8');
  await fs.rename(fileName, fileName.replace('.mts', '.cts'));
}

/** @param {String} targetDir */
async function visitDirectory(targetDir) {
  const files = await fs.readdir(targetDir);
  for (const file of files) {
    const fullName = path.join(targetDir, file);
    const stat = await fs.stat(fullName);
    if (stat.isDirectory()) {
      await visitDirectory(fullName);
    } else if (/\.d\.mts$/i.test(file)) {
      console.log(`Processing '${fullName}'...`);
      await rewriteDmts(fullName);
    }
  }
}

if (process.argv.length <= 2) {
  console.log(`Usage: node ${process.argv[1]} <target-dir>`);
  process.exit(1);
}

void visitDirectory(process.argv[2]).then(
  () => {
    console.log('Done.');
    process.exit(0);
  },
  (e) => {
    console.log('Error:', e);
    process.exit(-1);
  }
);
