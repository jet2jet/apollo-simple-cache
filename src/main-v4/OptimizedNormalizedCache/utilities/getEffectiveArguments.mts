import {
  Kind,
  type ArgumentNode,
  type FieldNode,
  type ValueNode,
} from 'graphql';

function valueNodeToValue(
  node: ValueNode,
  variables: Record<string, unknown> | undefined
): unknown {
  switch (node.kind) {
    case Kind.VARIABLE:
      return variables?.[node.name.value];
    case Kind.INT:
    case Kind.FLOAT:
    case Kind.STRING:
    case Kind.BOOLEAN:
      return node.value;
    case Kind.NULL:
      return null;
    case Kind.ENUM:
      return node.value;
    case Kind.LIST:
      return node.values.map((value) => valueNodeToValue(value, variables));
    case Kind.OBJECT:
      return node.fields.reduce<Record<string, unknown>>((prev, field) => {
        prev[field.name.value] = valueNodeToValue(field.value, variables);
        return prev;
      }, {});
    default:
      node satisfies never;
      throw new Error('Unexpected');
  }
}

/** Returns argument record from specified variables. */
// @internal
export default function getEffectiveArguments(
  fieldNodeOrArguments: FieldNode | readonly ArgumentNode[] | null,
  variables: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (fieldNodeOrArguments == null) {
    return variables;
  }
  const args =
    fieldNodeOrArguments instanceof Array
      ? fieldNodeOrArguments
      : fieldNodeOrArguments.arguments;
  if (args == null || args.length === 0) {
    return undefined;
  }
  return args.reduce<Record<string, unknown>>((prev, arg) => {
    prev[arg.name.value] = valueNodeToValue(arg.value, variables);
    return prev;
  }, {});
}
