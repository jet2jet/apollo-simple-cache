import {
  Kind,
  OperationTypeNode,
  type DocumentNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
} from 'graphql';

// @internal
export default function getMainDefinition(
  document: DocumentNode
): OperationDefinitionNode | FragmentDefinitionNode {
  let fragmentDefinition: FragmentDefinitionNode | undefined;

  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      const operation = definition.operation;
      if (
        operation === OperationTypeNode.QUERY ||
        operation === OperationTypeNode.MUTATION ||
        operation === OperationTypeNode.SUBSCRIPTION
      ) {
        return definition;
      }
    } else if (
      definition.kind === Kind.FRAGMENT_DEFINITION &&
      !fragmentDefinition
    ) {
      // we do this because we want to allow multiple fragment definitions
      // to precede an operation definition.
      fragmentDefinition = definition;
    }
  }

  if (fragmentDefinition) {
    return fragmentDefinition;
  }

  throw new Error('');
}
