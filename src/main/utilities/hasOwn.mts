// @internal
const hasOwn = Object.prototype.hasOwnProperty.call.bind(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  Object.prototype.hasOwnProperty
) as (
  ...args: [object: object, ...Parameters<object['hasOwnProperty']>]
) => ReturnType<object['hasOwnProperty']>;
// @internal
export default hasOwn;
