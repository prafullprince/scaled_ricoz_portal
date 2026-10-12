import type { OrganizationAssignment } from '@/services/organization.service';

export interface OrganizationBranch { item: OrganizationAssignment; children: OrganizationBranch[] }
const order = { CEO: 0, HR: 1, HEAD: 2, MANAGER: 3, MEMBER: 4 };

export function organizationForest(items: OrganizationAssignment[], department = 'ALL', query = '') {
  const byId = new Map(items.map((item) => [item.userId._id, item]));
  const term = query.trim().toLowerCase();
  const keep = new Set<string>();
  for (const item of items) {
    if (department !== 'ALL' && item.department !== department) continue;
    if (term && !`${item.userId.name} ${item.userId.email} ${item.level} ${item.department} ${item.roleKeys.join(' ')}`.toLowerCase().includes(term)) continue;
    let current: OrganizationAssignment | undefined = item;
    while (current && !keep.has(current.userId._id)) {
      keep.add(current.userId._id);
      current = current.reportsTo ? byId.get(current.reportsTo._id) : undefined;
    }
  }
  const children = new Map<string, OrganizationAssignment[]>();
  for (const item of items) {
    if (!keep.has(item.userId._id)) continue;
    const parent = item.reportsTo && byId.has(item.reportsTo._id) && item.reportsTo._id !== item.userId._id ? item.reportsTo._id : '__root__';
    children.set(parent, [...children.get(parent) ?? [], item]);
  }
  for (const list of children.values()) list.sort((left, right) => order[left.level] - order[right.level] || left.department.localeCompare(right.department) || left.userId.name.localeCompare(right.userId.name));
  const visited = new Set<string>();
  const branch = (item: OrganizationAssignment): OrganizationBranch => {
    visited.add(item.userId._id);
    return { item, children: (children.get(item.userId._id) ?? []).filter((child) => !visited.has(child.userId._id)).map(branch) };
  };
  const roots = (children.get('__root__') ?? []).map(branch);
  for (const item of items) if (keep.has(item.userId._id) && !visited.has(item.userId._id)) roots.push(branch(item));
  return roots;
}

export function layoutOrganization(forest: OrganizationBranch[], collapsed: Set<string>) {
  const nodeWidth = 224;
  const nodeHeight = 142;
  const gap = 24;
  const levelGap = 72;
  const nodes: { branch: OrganizationBranch; x: number; y: number }[] = [];
  const edges: { fromX: number; fromY: number; toX: number; toY: number }[] = [];
  const span = (branch: OrganizationBranch): number => {
    const children = collapsed.has(branch.item.userId._id) ? [] : branch.children;
    return children.length ? Math.max(nodeWidth, children.reduce((total, child) => total + span(child), 0) + gap * (children.length - 1)) : nodeWidth;
  };
  const width = Math.max(280, forest.reduce((total, branch) => total + span(branch), 0) + Math.max(0, forest.length - 1) * gap + 32);
  let height = nodeHeight + 32;
  const place = (branch: OrganizationBranch, left: number, depth: number) => {
    const branchWidth = span(branch);
    const x = left + (branchWidth - nodeWidth) / 2;
    const y = 160 + depth * (nodeHeight + levelGap);
    nodes.push({ branch, x, y });
    height = Math.max(height, y + nodeHeight + 24);
    let childLeft = left;
    for (const child of collapsed.has(branch.item.userId._id) ? [] : branch.children) {
      const childWidth = span(child);
      edges.push({ fromX: x + nodeWidth / 2, fromY: y + nodeHeight, toX: childLeft + childWidth / 2, toY: y + nodeHeight + levelGap });
      place(child, childLeft, depth + 1);
      childLeft += childWidth + gap;
    }
  };
  let left = 16;
  for (const branch of forest) {
    edges.push({ fromX: width / 2, fromY: 112, toX: left + span(branch) / 2, toY: 160 });
    place(branch, left, 0);
    left += span(branch) + gap;
  }
  return { nodes, edges, width, height, nodeWidth, nodeHeight };
}