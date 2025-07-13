// @internal
export default function canonicalStringify(value: unknown): string | undefined {
  function stringify(o: unknown): string | undefined {
    if (o == null) {
      return String(o);
    }
    const type = typeof o;
    if (type === 'string') {
      return JSON.stringify(o);
    } else if (type === 'number' || type === 'bigint' || type === 'boolean') {
      return o.toString();
    } else if (type !== 'object') {
      return undefined;
    }
    if (Array.isArray(o)) {
      return `[${o
        .map((i) => {
          const str = stringify(i);
          return str != null ? str : 'null';
        })
        .join(',')}]`;
    }
    const keys = Object.keys(o).sort();
    return `{${keys.reduce((prev, k) => {
      const str = stringify((o as Record<string, unknown>)[k]);
      if (str === undefined) {
        return prev;
      }
      if (prev !== '') {
        prev += ',';
      }
      prev += `${JSON.stringify(k)}:${str}`;
      return prev;
    }, '')}}`;
  }
  return stringify(value);
}
