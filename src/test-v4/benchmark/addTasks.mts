import type { ApolloCache } from '@apollo/client';
import type { Bench } from 'tinybench';
import * as Task from './task.mjs';

export interface Config {
  name: string;
  makeCache: () => ApolloCache;
}

function waitMicrotask() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

// for debugging purpose
function makeCacheWrapper(makeCache: Config['makeCache'], name: string) {
  const cache = makeCache();
  (cache as unknown as Record<string, unknown>).__name = name;
  return cache;
}

export function addTasks(bench: Bench, config: Config): void;
export function addTasks(bench: Bench, { name, makeCache }: Config): void {
  for (const [funcName, fn] of Object.entries(Task)) {
    if (typeof fn !== 'function') {
      continue;
    }
    bench.add(`${name}:${funcName}`, async () => {
      await waitMicrotask();
      const cache = makeCacheWrapper(makeCache, name);
      fn(cache);
    });
  }
}
