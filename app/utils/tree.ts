import type { FolderItem, FolderTreeNode } from "~~/shared/types";

function sortNodes(a: FolderTreeNode, b: FolderTreeNode): number {
  if (a.kind === "folder" && b.kind !== "folder") return -1;
  if (a.kind !== "folder" && b.kind === "folder") return 1;
  return a.name.localeCompare(b.name);
}

// Bangun tree dari rows flat. Root = parentId null (atau parent tak dikenal).
export function buildTree(items: FolderItem[]): FolderTreeNode[] {
  const nodes = new Map<number, FolderTreeNode>();
  for (const item of items) nodes.set(item.id, { ...item, children: [] });
  const roots: FolderTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId !== null ? nodes.get(node.parentId) : undefined;
    if (parent && parent.kind === "folder") parent.children.push(node);
    else roots.push(node);
  }
  const sortAll = (list: FolderTreeNode[]): void => {
    list.sort(sortNodes);
    for (const n of list) sortAll(n.children);
  };
  sortAll(roots);
  return roots;
}

// Kumpulan id node + seluruh descendant — dipakai move dialog untuk mengecualikan subtree.
export function collectSubtreeIds(nodes: FolderTreeNode[], rootId: number): Set<number> {
  const result = new Set<number>();
  const walk = (node: FolderTreeNode): void => {
    result.add(node.id);
    for (const child of node.children) walk(child);
  };
  const find = (list: FolderTreeNode[]): FolderTreeNode | null => {
    for (const n of list) {
      if (n.id === rootId) return n;
      const hit = find(n.children);
      if (hit) return hit;
    }
    return null;
  };
  const target = find(nodes);
  if (target) walk(target);
  return result;
}
