import React, { useId } from 'react';
import './HeroIllustration.css';

/**
 * Isometric "exploded platform" illustration for the landing hero: a machine built from four lifted layers
 * (schedule, monitor, verify, audit) over a floor grid, with documents and a console window linked by thin lines.
 * Pure SVG, no images; colours come from CSS variables so it follows the portal theme and dark mode.
 */

/** Isometric projection: world (x, y, z) -> screen (z points up). */
const P = (x, y, z = 0) => [(x - y) * 0.866, (x + y) * 0.5 - z];
const pts = (list) => list.map(([x, y, z]) => P(x, y, z).map((n) => n.toFixed(1)).join(',')).join(' ');
/** SVG matrix that lays a local (u, v) drawing flat on the plane at height z, origin at world (x, y). */
const flat = (x, y, z = 0, s = 1) => {
  const [e, f] = P(x, y, z);
  return `matrix(${0.866 * s} ${0.5 * s} ${-0.866 * s} ${0.5 * s} ${e} ${f})`;
};

const Poly = ({ q, className }) => <polygon points={pts(q)} className={className} />;

const Slab = ({ x, y, w, d, h, z = 0, top = 'il-paper', left = 'il-soft', right = 'il-mid' }) => (
  <g>
    <Poly q={[[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]} className={left} />
    <Poly q={[[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]} className={right} />
    <Poly q={[[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]} className={top} />
  </g>
);

/** Extrude any outline (world x/y points) into a plate: visible side faces plus the top. */
const Prism = ({ outline, z, h, top = 'il-paper', left = 'il-soft', right = 'il-mid' }) => {
  const area = outline.reduce((sum, [x1, y1], i) => {
    const [x2, y2] = outline[(i + 1) % outline.length];
    return sum + (x1 * y2 - x2 * y1);
  }, 0);
  const sign = area >= 0 ? 1 : -1;
  const sides = outline.map(([x1, y1], i) => {
    const [x2, y2] = outline[(i + 1) % outline.length];
    const nx = (y2 - y1) * sign;
    const ny = -(x2 - x1) * sign;
    if (nx <= 0 && ny <= 0) {return null;}
    return (
      <Poly key={i} q={[[x1, y1, z], [x2, y2, z], [x2, y2, z + h], [x1, y1, z + h]]} className={Math.abs(nx) > Math.abs(ny) ? right : left} />
    );
  });
  return (
    <g>
      {sides}
      <Poly q={outline.map(([x, y]) => [x, y, z + h])} className={top} />
    </g>
  );
};

const Rect = ({ x, y, w, d, z = 0, className = 'il-paper' }) => (
  <Poly q={[[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]]} className={className} />
);

const Line = ({ a, b, z = 0, className = 'il-stroke' }) => {
  const [x1, y1] = P(a[0], a[1], z);
  const [x2, y2] = P(b[0], b[1], z);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} className={className} />;
};

const Disc = ({ x, y, r, z = 0, className = 'il-ink' }) => {
  const [cx, cy] = P(x, y, z);
  return <ellipse cx={cx} cy={cy} rx={r * 1.2247} ry={r * 0.7071} className={className} />;
};

const Route = ({ list, z = 0, className = 'il-stroke' }) => (
  <polyline points={pts(list.map(([x, y]) => [x, y, z]))} className={className} fill="none" />
);

const Cylinder = ({ x, y, r, z, h, className = 'il-ink' }) => {
  const [cx, top] = P(x, y, z + h);
  const [, bottom] = P(x, y, z);
  const rx = r * 1.2247;
  const ry = r * 0.7071;
  return (
    <g>
      <path d={`M${cx - rx},${top} L${cx - rx},${bottom} A${rx},${ry} 0 0 0 ${cx + rx},${bottom} L${cx + rx},${top} Z`} className={className} />
      <ellipse cx={cx} cy={top} rx={rx} ry={ry} className={className} />
    </g>
  );
};

const Node = ({ x, y, z = 0 }) => {
  const [cx, cy] = P(x, y, z);
  return <circle cx={cx} cy={cy} r="2.4" className="il-dot" />;
};

const Sector = ({ x, y, r, z, from, to, className = 'il-ink' }) => {
  const q = [[x, y, z]];
  for (let a = from; a <= to; a += 8) {
    q.push([x + r * Math.cos((a * Math.PI) / 180), y + r * Math.sin((a * Math.PI) / 180), z]);
  }
  return <Poly q={q} className={className} />;
};

/** A toothed gear lying on a plane. */
const Gear = ({ x, y, z, r, teeth = 12, depth = 4, hub = 0.35 }) => {
  const q = [];
  const step = (Math.PI * 2) / (teeth * 4);
  for (let i = 0; i < teeth * 4; i += 1) {
    const rr = i % 4 === 1 || i % 4 === 2 ? r + depth : r;
    q.push([x + rr * Math.cos(i * step), y + rr * Math.sin(i * step), z]);
  }
  return (
    <g>
      <Poly q={q} className="il-paper" />
      <Disc x={x} y={y} r={r * hub * 1.6} z={z} className="il-soft" />
      <Disc x={x} y={y} r={r * hub} z={z} className="il-paper" />
    </g>
  );
};

/** A round fan: ring, blades, hub. */
const Fan = ({ x, y, z, r }) => (
  <g>
    <Rect x={x - r - 4} y={y - r - 4} w={(r + 4) * 2} d={(r + 4) * 2} z={z} className="il-paper" />
    <Disc x={x} y={y} r={r} z={z} className="il-paper" />
    {Array.from({ length: 14 }, (_, i) => {
      const a = (i * Math.PI * 2) / 14;
      return <Line key={i} a={[x + r * 0.25 * Math.cos(a), y + r * 0.25 * Math.sin(a)]} b={[x + r * 0.95 * Math.cos(a + 0.5), y + r * 0.95 * Math.sin(a + 0.5)]} z={z} className="il-stroke" />;
    })}
    <Disc x={x} y={y} r={r * 0.22} z={z} className="il-ink" />
  </g>
);

const Tick = ({ x, y, z }) => <Route list={[[x, y], [x + 3, y + 4], [x + 9, y - 3]]} z={z} className="il-bold" />;

const Shadow = ({ x, y, w, d, off = 9 }) => <Rect x={x + off} y={y + off} w={w} d={d} z={0} className="il-shadow" />;

export const HeroIllustration = () => {
  const uid = useId().replace(/:/g, '');
  const fadeId = `il-fade-${uid}`;
  const maskId = `il-mask-${uid}`;

  const grid = [];
  for (let i = -320; i <= 320; i += 40) {
    grid.push(<Line key={`a${i}`} a={[i, -320]} b={[i, 320]} className="il-grid" />);
    grid.push(<Line key={`b${i}`} a={[-320, i]} b={[320, i]} className="il-grid" />);
  }

  const topPlate = [[-62, -62], [22, -62], [22, -42], [78, -42], [78, -4], [22, -4], [22, 62], [-62, 62]];

  return (
    <svg className="hero-il" viewBox="-235 -240 545 465" role="img" aria-label="Illustration of the exam platform: schedule, monitor, verify and audit layers">
      <defs>
        <radialGradient id={fadeId} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.72" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={maskId}>
          <rect x="-235" y="-240" width="545" height="465" fill={`url(#${fadeId})`} />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`}>{grid}</g>

      {/* soft shadows on the floor */}
      <g>
        <Shadow x={-75} y={-75} w={150} d={150} off={14} />
        <Shadow x={-215} y={-45} w={62} d={62} />
        <Shadow x={160} y={10} w={135} d={110} />
        <Shadow x={10} y={140} w={110} d={95} off={6} />
      </g>

      {/* connector lines on the floor */}
      <g>
        <Route list={[[-184, 17], [-184, 70], [-70, 70], [-70, 95]]} />
        <Route list={[[155, -88], [155, -40], [210, -40], [210, 10]]} />
        <Route list={[[-30, 140], [-30, 195], [10, 195]]} />
        <Route list={[[80, 70], [160, 70]]} />
        <Route list={[[120, 195], [215, 195], [215, 170]]} />
        <Node x={-184} y={17} /><Node x={-70} y={95} />
        <Node x={155} y={-88} /><Node x={210} y={10} />
        <Node x={-30} y={140} /><Node x={10} y={195} />
        <Node x={80} y={70} /><Node x={160} y={70} />
        <Node x={120} y={195} /><Node x={215} y={170} />
      </g>

      {/* rack of servers */}
      {[0, 20, 40, 60].map((z) => (
        <g key={z}>
          <Slab x={-215} y={-45} w={62} d={62} h={20} z={z} />
          <Line a={[-215, 17]} b={[-153, 17]} z={z + 14} className="il-thin-solid" />
        </g>
      ))}

      {/* small document, back right, with a target marker */}
      <Rect x={120} y={-150} w={70} d={62} z={20} />
      {[-138, -128, -118].map((y, i) => (
        <Line key={y} a={[130, y]} b={[130 + 46 - i * 8, y]} z={20} className={i === 0 ? 'il-bold' : 'il-stroke'} />
      ))}
      <Line a={[168, -100]} b={[178, -100]} z={20} className="il-bold" />
      <Node x={150} y={-175} z={20} />

      {/* standoffs between the lifted layers */}
      {[[-52, -52], [12, -52], [12, 52], [-52, 52]].map(([x, y]) => {
        const [x1, y1] = P(x, y, 10);
        const [x2, y2] = P(x, y, 165);
        return (
          <g key={`${x}${y}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="il-rod" />
            <Disc x={x} y={y} r={3} z={55} className="il-dot" />
            <Disc x={x} y={y} r={3} z={110} className="il-dot" />
          </g>
        );
      })}

      {/* base: dark tray */}
      <Slab x={-75} y={-75} w={150} d={150} h={10} z={0} top="il-soft" left="il-dark" right="il-ink" />
      <Rect x={-55} y={-55} w={110} d={110} z={10} className="il-paper" />
      <Rect x={-40} y={-40} w={80} d={36} z={10} className="il-soft" />

      {/* audit layer: machinery */}
      <Slab x={-70} y={-70} w={140} d={140} h={6} z={55} />
      <Slab x={-58} y={-58} w={54} d={36} h={9} z={61} top="il-soft" />
      <Rect x={-52} y={-52} w={42} d={8} z={70} className="il-paper" />
      <Gear x={34} y={30} z={61} r={24} teeth={11} depth={5} />
      <Gear x={-14} y={50} z={61} r={13} teeth={8} depth={3.5} hub={0.4} />
      {[0, 1, 2, 3].map((i) => <Disc key={i} x={-45 + i * 14} y={8} r={4} z={61} className="il-paper" />)}
      <Rect x={-58} y={22} w={44} d={10} z={61} className="il-soft" />

      {/* verify layer: circuit board and fan */}
      <Slab x={-65} y={-65} w={130} d={130} h={6} z={110} />
      <Rect x={-56} y={-56} w={112} d={112} z={116} className="il-circuit" />
      {[
        [[-50, 20], [-30, 20], [-30, 40], [-8, 40], [-8, 54]],
        [[-50, 38], [-40, 38], [-40, 52], [-24, 52]],
        [[-50, 4], [-22, 4], [-22, 24]],
        [[-6, 8], [14, 8], [14, 30], [32, 30]],
        [[-6, 22], [6, 22], [6, 46]],
        [[20, 52], [20, 40], [44, 40], [44, 20]],
      ].map((list, i) => <Route key={i} list={list} z={116} />)}
      <Slab x={-50} y={-6} w={22} d={14} h={4} z={116} top="il-soft" />
      <Fan x={34} y={34} z={116} r={14} />

      {/* schedule layer: the top plate */}
      <Prism outline={topPlate} z={165} h={9} top="il-ink" left="il-ink" right="il-ink" />
      <Disc x={-30} y={-28} r={19} z={174} className="il-paper" />
      <Disc x={-30} y={-28} r={12} z={174} className="il-ring" />
      <Rect x={-50} y={8} w={46} d={30} z={174} className="il-paper" />
      <Rect x={-44} y={14} w={34} d={8} z={174} className="il-soft" />
      <Rect x={34} y={-32} w={36} d={9} z={174} className="il-paper" />
      <Rect x={4} y={34} w={8} d={20} z={174} className="il-paper" />
      <line x1={P(30, -48, 176)[0]} y1={P(30, -48, 176)[1]} x2={P(30, -48, 196)[0]} y2={P(30, -48, 196)[1]} className="il-thin" />
      <Cylinder x={30} y={-48} r={14} z={196} h={8} />

      {/* left card: tiles and lines */}
      <Rect x={-100} y={95} w={70} d={62} z={15} />
      <Disc x={-88} y={108} r={7} z={15} className="il-ink" />
      <Rect x={-76} y={102} w={14} d={14} z={15} className="il-ink" />
      <Rect x={-86} y={125} w={14} d={14} z={15} className="il-ink" />
      <Line a={[-62, 124]} b={[-40, 124]} z={15} className="il-bold" />
      <Line a={[-62, 131]} b={[-40, 131]} z={15} className="il-bold" />
      <Line a={[-62, 138]} b={[-46, 138]} z={15} className="il-bold" />

      {/* front-left document: text and a checklist */}
      <Rect x={10} y={140} w={110} d={95} z={0} />
      {[[22, 152, 100], [22, 160, 94], [22, 168, 88], [22, 176, 96]].map(([x, y, x2], i) => (
        <Line key={y} a={[x, y]} b={[x2, y]} className={i === 0 ? 'il-bold' : 'il-stroke'} />
      ))}
      {[192, 205, 218].map((y, i) => (
        <g key={y}>
          <Rect x={22} y={y - 4} w={8} d={8} className="il-paper" />
          {i === 1 && <Tick x={23} y={y} z={0} />}
          <Line a={[38, y]} b={[98, y]} className="il-stroke" />
        </g>
      ))}

      {/* console: a second window underneath, then the main window */}
      <Rect x={140} y={96} w={105} d={72} z={0} />
      <Rect x={140} y={96} w={10} d={72} z={0} className="il-ink" />
      <Disc x={145} y={160} r={2} z={0} className="il-dot" />
      <Disc x={145} y={152} r={2} z={0} className="il-dot" />
      <Rect x={160} y={10} w={135} d={110} z={0} />
      <Rect x={160} y={10} w={135} d={12} z={0} className="il-ink" />
      <Rect x={228} y={12.5} w={22} d={7} z={0} className="il-paper" />
      <Disc x={168} y={16} r={2.4} z={0} className="il-dot" />
      <Disc x={176} y={16} r={2.4} z={0} className="il-dot" />
      <Disc x={184} y={16} r={2.4} z={0} className="il-dot" />
      {/* big letter */}
      <Rect x={172} y={30} w={34} d={32} z={0} className="il-paper" />
      <text transform={flat(180, 55, 0, 1)} className="il-letter">A</text>
      {/* table with ticks */}
      <Rect x={216} y={30} w={68} d={46} z={0} className="il-paper" />
      {[42, 54, 66].map((y) => <Line key={y} a={[216, y]} b={[284, y]} className="il-thin-solid" />)}
      {[238, 261].map((x) => <Line key={x} a={[x, 30]} b={[x, 76]} className="il-thin-solid" />)}
      <Tick x={222} y={37} z={0} />
      <Tick x={243} y={61} z={0} />
      <Tick x={266} y={37} z={0} />
      {/* text block */}
      <Rect x={172} y={70} w={40} d={30} z={0} className="il-paper" />
      {[76, 82, 88, 94].map((y) => <Line key={y} a={[176, y]} b={[208, y]} className="il-stroke" />)}
      {/* pie chart */}
      <Disc x={236} y={98} r={13} z={0} className="il-paper" />
      <Sector x={236} y={98} r={13} z={0} from={-30} to={110} />
      <Sector x={236} y={98} r={13} z={0} from={110} to={190} className="il-hatch" />
      {/* cursor */}
      <g transform={flat(264, 88, 0, 1)}>
        <polygon points="0,0 0,17 4.5,13 8,20 11,18.5 7.5,11.5 13,11.5" className="il-cursor" />
      </g>
      <Line a={[172, 108]} b={[205, 108]} className="il-bold" />
      <Line a={[172, 114]} b={[196, 114]} className="il-stroke" />
    </svg>
  );
};
