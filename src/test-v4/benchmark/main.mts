import { Bench } from 'tinybench';
import { addTasks } from './addTasks.mjs';
import * as InMemoryCacheDefault from './InMemoryCacheDefault.mjs';
import * as InMemoryCacheNoNormalization from './InMemoryCacheNoNormalization.mjs';
import * as OptimizedNormalizedCacheMain from './OptimizedNormalizedCacheMain.mjs';
import * as SimpleDocumentCacheMain from './SimpleDocumentCacheMain.mjs';

const mToNs = (ms: number) => ms * 1e6;
const formatNumber = (
  x: number,
  targetDigits: number,
  maxFractionDigits: number
): string => {
  // Round large numbers to integers, but not to multiples of 10.
  // The actual number of significant digits may be more than `targetDigits`.
  if (Math.abs(x) >= 10 ** targetDigits) {
    return x.toFixed();
  }

  // Round small numbers to have `maxFractionDigits` digits after the decimal dot.
  // The actual number of significant digits may be less than `targetDigits`.
  if (Math.abs(x) < 10 ** (targetDigits - maxFractionDigits)) {
    return x.toFixed(maxFractionDigits);
  }

  // Round medium magnitude numbers to have exactly `targetDigits` significant digits.
  return x.toPrecision(targetDigits);
};

const bench = new Bench({ name: 'benchmark', time: 10 });

addTasks(bench, SimpleDocumentCacheMain.config);
addTasks(bench, OptimizedNormalizedCacheMain.config);
addTasks(bench, InMemoryCacheNoNormalization.config);
addTasks(bench, InMemoryCacheDefault.config);

for (const task of bench.tasks) {
  console.log(`Running ${task.name}...`);
  await task.run();
}

const table = bench.tasks
  .sort((a, b) => {
    const aArr = a.name.split(':');
    const bArr = b.name.split(':');
    if (aArr.length !== bArr.length) {
      return aArr.length - bArr.length;
    }
    for (let i = 1; i < aArr.length; ++i) {
      if (aArr[i] !== bArr[i]) {
        return aArr[i]!.localeCompare(bArr[i]!);
      }
    }
    return aArr[0]!.localeCompare(bArr[0]!);
  })
  .map((task) => {
    if (!task.result) {
      return null;
    }
    const { error, latency, throughput } = task.result;
    if (error) {
      return {
        'Task name': task.name,
        Error: error.message,
      };
    } else {
      return {
        'Task name': task.name,
        'Latency avg (ns)': `${formatNumber(mToNs(latency.mean), 5, 2)} \xb1 ${latency.rme.toFixed(2)}%`,
        'Latency med (ns)': `${formatNumber(mToNs(latency.p50!), 5, 2)} \xb1 ${formatNumber(mToNs(latency.mad!), 5, 2)}`,
        'Throughput avg (ops/s)': `${Math.round(throughput.mean).toString()} \xb1 ${throughput.rme.toFixed(2)}%`,
        'Throughput med (ops/s)': `${Math.round(throughput.p50!).toString()} \xb1 ${Math.round(throughput.mad!).toString()}`,
        Samples: latency.samples.length,
      };
    }
  });
console.table(table);
