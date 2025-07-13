import type {
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from 'graphql';

// @internal
export default function getMainDefinition(
  document: DocumentNode
): OperationDefinitionNode | FragmentDefinitionNode {
  let fragmentDefinition: FragmentDefinitionNode | undefined;

  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition') {
      const operation = definition.operation;
      if (
        operation === 'query' ||
        operation === 'mutation' ||
        operation === 'subscription'
      ) {
        return definition;
      }
    } else if (
      definition.kind === 'FragmentDefinition' &&
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
