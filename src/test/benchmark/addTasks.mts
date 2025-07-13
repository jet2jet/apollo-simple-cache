import type { ApolloCache } from '@apollo/client';
import type { Bench } from 'tinybench';
import * as Task from './task.mjs';

export interface Config {
  name: string;
  makeCache: () => ApolloCache<unknown>;
}

// for debugging purpose
function makeCacheWrapper(makeCache: Config['makeCache'], name: string) {
  const cache = makeCache();
  (cache as unknown as Record<string, unknown>).__name = name;
  return cache;
}

export function addTasks(bench: Bench, config: Config): void;
export function addTasks(bench: Bench, { name, makeCache }: Config): void {
  bench.add(`${name}:readWrite`, () => {
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskReadWrite(cache);
  });
  bench.add(`${name}:taskReadSameQuery`, () => {
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskReadSameQuery(cache);
  });
  bench.add(`${name}:taskReadSimilarQuery`, () => {
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskReadSimilarQuery(cache);
  });
  bench.add(`${name}:taskWriteEntireAndWriteIndividual`, () => {
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskWriteEntireAndWriteIndividual(cache);
  });
  bench.add(`${name}:taskWriteEntireAndReadIndividual`, () => {
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskWriteEntireAndReadIndividual(cache);
  });
  bench.add(`${name}:taskWriteComplexData`, () => {
    const cache = makeCacheWrapper(makeCache, name);
    Task.taskWriteComplexData(cache);
  });
}
