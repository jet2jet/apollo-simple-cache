import {
  Kind,
  type FieldNode,
  type SelectionNode,
  type SelectionSetNode,
} from 'graphql';
import type { FragmentMap, SelectionTuple } from '../internalTypes.mjs';

const SYMBOL_CACHED_SELECTIONS = Symbol('snc:cachedSelections');

type SelectionSetNodeWithCachedSelections = SelectionSetNode & {
  [SYMBOL_CACHED_SELECTIONS]?: readonly SelectionTuple[];
};

function makeSelections(
  selectionSetNode: SelectionSetNode,
  fragmentMap: FragmentMap
) {
  const resultSelections: SelectionTuple[] = [];

  impl(selectionSetNode.selections);

  return resultSelections;

  function impl(selections: readonly SelectionNode[], typename?: string) {
    for (let l = selections.length, i = 0; i < l; ++i) {
      const selection = selections[i]!;
      switch (selection.kind) {
        case Kind.FIELD: {
          const name = selection.name.value;
          const sel = resultSelections.find(
            (tuple) => tuple[0] === name && tuple[2] === typename
          );
          if (sel != null && sel[1] != null) {
            sel[1] = mergeSelection(sel[1], selection);
          } else {
            resultSelections.push([name, selection, typename]);
          }
          break;
        }
        case Kind.INLINE_FRAGMENT:
          impl(
            selection.selectionSet.selections,
            selection.typeCondition?.name.value
          );
          break;
        case Kind.FRAGMENT_SPREAD: {
          const def = fragmentMap[selection.name.value];
          if (def != null) {
            impl(def.selectionSet.selections, def.typeCondition.name.value);
          }
        }
      }
    }
  }

  function mergeSelection(
    target: Readonly<FieldNode>,
    source: Readonly<FieldNode>
  ): FieldNode {
    if (!source.selectionSet) {
      if (!target.selectionSet) {
        return { ...target };
      }
      return {
        ...target,
        selectionSet: {
          ...target.selectionSet,
          selections: target.selectionSet.selections.slice(),
        },
      };
    }
    const selections: SelectionNode[] = (
      target.selectionSet ? [...target.selectionSet.selections] : []
    ).concat(source.selectionSet.selections);
    return {
      ...target,
      selectionSet: {
        ...target.selectionSet,
        ...source.selectionSet,
        selections,
      },
    };
  }
}

// @internal
export default function getCachedSelections(
  selectionSetNode: SelectionSetNode,
  fragmentMap: FragmentMap
): readonly SelectionTuple[] {
  const s = selectionSetNode as SelectionSetNodeWithCachedSelections;
  return (
    s[SYMBOL_CACHED_SELECTIONS] ??
    (s[SYMBOL_CACHED_SELECTIONS] = makeSelections(
      selectionSetNode,
      fragmentMap
    ))
  );
}
