import type { ApolloCache } from '@apollo/client';
import type { Bench } from 'tinybench';
import * as Task from './task.mjs';

export interface Config {
  name: string;
  makeCache: () => ApolloCache<unknown>;
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
  bench.add(`${name}:readWrite`, async () => {
    await waitMicrotask();
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskReadWrite(cache);
    cache.reset();
  });
  bench.add(`${name}:taskReadSameQuery`, async () => {
    await waitMicrotask();
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskReadSameQuery(cache);
    cache.reset();
  });
  bench.add(`${name}:taskReadSimilarQuery`, async () => {
    await waitMicrotask();
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskReadSimilarQuery(cache);
    cache.reset();
  });
  bench.add(`${name}:taskWriteEntireAndWriteIndividual`, async () => {
    await waitMicrotask();
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskWriteEntireAndWriteIndividual(cache);
    cache.reset();
  });
  bench.add(`${name}:taskWriteEntireAndReadIndividual`, async () => {
    await waitMicrotask();
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskWriteEntireAndReadIndividual(cache);
    cache.reset();
  });
  bench.add(`${name}:taskWriteComplexData`, async () => {
    await waitMicrotask();
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskWriteComplexData(cache);
    cache.reset();
  });
}
