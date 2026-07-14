import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * @param {String} fileName
 * @param {String} extension
 */
async function rewriteDmts(fileName, extension) {
  const content = await fs.readFile(fileName, 'utf-8');
  const newContent = content
    .split(/\r?\n/g)
    .map((line) => {
      line = line.replace(
        /from (['"])(.*?)\.mts\1/,
        (_, $1, $2) => `from ${$1}${$2}.${extension}${$1}`
      );
      return line;
    })
    .join('\n');
  await fs.writeFile(fileName, newContent, 'utf-8');
  if (extension === 'cjs') {
    await fs.rename(fileName, fileName.replace('.mts', '.cts'));
  }
}

/**
 * @param {String} targetDir
 * @param {String} extension
 */
async function visitDirectory(targetDir, extension) {
  const files = await fs.readdir(targetDir);
  for (const file of files) {
    const fullName = path.join(targetDir, file);
    const stat = await fs.stat(fullName);
    if (stat.isDirectory()) {
      await visitDirectory(fullName, extension);
    } else if (/\.d\.mts$/i.test(file)) {
      console.log(`Processing '${fullName}'...`);
      await rewriteDmts(fullName, extension);
    }
  }
}

if (process.argv.length <= 3) {
  console.log(
    `Usage: node ${process.argv[1]} <target-dir> <extensionWithoutDot>`
  );
  process.exit(1);
}

void visitDirectory(process.argv[2], process.argv[3]).then(
  () => {
    console.log('Done.');
    process.exit(0);
  },
  (e) => {
    console.log('Error:', e);
    process.exit(-1);
  }
);
