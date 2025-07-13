// @internal
const hasOwn = Object.prototype.hasOwnProperty.call.bind(
  Object.prototype.hasOwnProperty
) as (
  ...args: [object: object, ...Parameters<object['hasOwnProperty']>]
) => ReturnType<object['hasOwnProperty']>;
// @internal
export default hasOwn;
