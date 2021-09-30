import { MAIN_SIZE_PROPERTY } from '../constants';
import { ClientGroup } from '../interfaces/ClientGroup';
import { getQueryRegex } from './getQueryRegex';

export function findModulesByChunk(
  groups: ClientGroup[],
  query: string
): {
  chunkGroup: ClientGroup;
  moduleGroups: ClientGroup[];
  parentGroups: ClientGroup[];
}[] {
  if (!query || query.length < 3) {
    return [];
  }

  const queryRegex = getQueryRegex(query);

  if (!queryRegex) {
    return [];
  }

  return getChunkGroups(groups)
    .map(({ chunkGroup, parentGroups }) => {
      let foundGroups: ClientGroup[][] = [];

      if (chunkGroup.groups) {
        walkGroups(chunkGroup.groups, (group) => {
          let weight = 0;

          /**
           * Splitting found modules/directories into groups:
           *
           * 1) Module with matched label (weight = 4)
           * 2) Directory with matched label (weight = 3)
           * 3) Module with matched path (weight = 2)
           * 4) Directory with matched path (weight = 1)
           */
          if (queryRegex.test(group.label)) {
            weight += 3;
          } else if (group.path && queryRegex.test(group.path)) {
            weight++;
          }

          if (!weight) return;

          if (!group.groups) {
            weight += 1;
          }

          foundGroups[weight - 1] = foundGroups[weight - 1] || [];
          foundGroups[weight - 1].push(group);
        });
      }

      // Filtering out missing groups
      foundGroups = foundGroups.filter(Boolean).reverse();
      // Sorting each group by active size
      foundGroups.forEach((fGroups) =>
        fGroups.sort((a, b) => b[MAIN_SIZE_PROPERTY] - a[MAIN_SIZE_PROPERTY])
      );

      return {
        chunkGroup,
        moduleGroups: foundGroups.flat(),
        parentGroups,
      };
    })
    .filter((result) => result.moduleGroups.length > 0)
    .sort((a, b) => a.moduleGroups.length - b.moduleGroups.length);
}

function getChunkGroups(
  groups: ClientGroup[] = [],
  parentGroups: ClientGroup[] = []
): {
  chunkGroup: ClientGroup;
  parentGroups: ClientGroup[];
}[] {
  return groups
    .map((group) => {
      if (!group.isAsset) {
        return getChunkGroups(group.groups as ClientGroup[], [
          ...parentGroups,
          group,
        ]);
      }
      return {
        chunkGroup: group,
        parentGroups,
      };
    })
    .filter(Boolean)
    .flat();
}

function walkGroups(
  groups: ClientGroup[],
  cb: (group: ClientGroup) => unknown
): void {
  for (const group of groups) {
    cb(group);

    if (group.groups) {
      walkGroups(group.groups, cb);
    }
  }
}
