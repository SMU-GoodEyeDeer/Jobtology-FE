import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

export interface SimNode extends SimulationNodeDatum {
  readonly id: string;
  readonly r: number;
  x: number;
  y: number;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  readonly source: SimNode;
  readonly target: SimNode;
  readonly dashed: boolean;
}

export interface SeedNode {
  readonly id: string;
  readonly r: number;
  readonly x: number;
  readonly y: number;
}

export interface SeedLink {
  readonly source: string;
  readonly target: string;
  readonly dashed: boolean;
}

export interface ForceSeed {
  readonly nodes: readonly SeedNode[];
  readonly links: readonly SeedLink[];
  readonly width: number;
  readonly height: number;
}

export interface EvidenceSimulation {
  readonly nodes: ReadonlyMap<string, SimNode>;
  readonly links: readonly SimLink[];
  readonly simulation: Simulation<SimNode, SimLink>;
}

const LABEL_ROOM = 22;
const EDGE_PADDING = 12;

function keepInside(width: number, height: number) {
  let nodes: SimNode[] = [];
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const force = () => {
    for (const node of nodes) {
      const pad = node.r + EDGE_PADDING;
      const [minX, maxX, minY, maxY] = [pad, width - pad, pad, height - pad - LABEL_ROOM];
      if (node.fx != null) node.fx = clamp(node.fx, minX, maxX);
      if (node.fy != null) node.fy = clamp(node.fy, minY, maxY);
      node.vx = clamp(node.x + (node.vx ?? 0), minX, maxX) - node.x;
      node.vy = clamp(node.y + (node.vy ?? 0), minY, maxY) - node.y;
    }
  };
  force.initialize = (initial: SimNode[]) => { nodes = initial; };
  return force;
}

export function createEvidenceSimulation(
  seed: ForceSeed,
  previous: ReadonlyMap<string, { readonly x: number; readonly y: number }> = new Map(),
): EvidenceSimulation {
  const nodes = new Map<string, SimNode>(
    seed.nodes.map((node) => {
      const kept = previous.get(node.id);
      return [node.id, { id: node.id, r: node.r, x: kept?.x ?? node.x, y: kept?.y ?? node.y }];
    }),
  );
  const links = seed.links.flatMap((link): SimLink[] => {
    const source = nodes.get(link.source);
    const target = nodes.get(link.target);
    return source && target ? [{ source, target, dashed: link.dashed }] : [];
  });
  const simulation = forceSimulation<SimNode, SimLink>([...nodes.values()])
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .distance((link) => (link.dashed ? 220 : link.source.r + link.target.r + 70))
        .strength((link) => (link.dashed ? 0.03 : 0.5)),
    )
    .force("charge", forceManyBody<SimNode>().strength((node) => -12 * node.r - 260).distanceMax(520))
    .force("collide", forceCollide<SimNode>((node) => node.r + LABEL_ROOM).strength(0.9))
    .force("x", forceX<SimNode>(seed.width / 2).strength(0.04))
    .force("y", forceY<SimNode>(seed.height / 2).strength(0.025))
    .force("bounds", keepInside(seed.width, seed.height))
    .alpha(previous.size > 0 ? 0.3 : 0.8)
    .alphaDecay(0.03);
  return { nodes, links, simulation };
}
