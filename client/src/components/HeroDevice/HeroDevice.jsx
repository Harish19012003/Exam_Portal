import React from 'react';
import './HeroDevice.css';

/**
 * Isometric line-art for the landing hero: a phone showing live centers, with floating cards around it
 * (shift schedule, identity check, audit chart, checklist). Pure SVG; colours come from CSS variables.
 */

const P = (x, y, z = 0) => [(x - y) * 0.866, (x + y) * 0.5 - z];
const pts = (list) => list.map(([x, y, z]) => P(x, y, z).map((n) => n.toFixed(1)).join(',')).join(' ');
const flat = (x, y, z = 0, s = 1) => {
  const [e, f] = P(x, y, z);
  return `matrix(${0.866 * s} ${0.5 * s} ${-0.866 * s} ${0.5 * s} ${e} ${f})`;
};

const Poly = ({ q, className }) => <polygon points={pts(q)} className={className} />;
const Rect = ({ x, y, w, d, z = 0, className = 'hd-paper' }) => (
  <Poly q={[[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]]} className={className} />
);
/** A card with a visible thickness edge. */
const Card = ({ x, y, w, d, z = 0, h = 3, className = 'hd-paper' }) => (
  <g>
    <Poly q={[[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]} className="hd-edge" />
    <Poly q={[[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]} className="hd-edge-dark" />
    <Poly q={[[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]} className={className} />
  </g>
);
const Line = ({ a, b, z = 0, className = 'hd-line' }) => {
  const [x1, y1] = P(a[0], a[1], z);
  const [x2, y2] = P(b[0], b[1], z);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} className={className} />;
};
const Disc = ({ x, y, r, z = 0, className = 'hd-ink' }) => {
  const [cx, cy] = P(x, y, z);
  return <ellipse cx={cx} cy={cy} rx={r * 1.2247} ry={r * 0.7071} className={className} />;
};
const Shadow = ({ x, y, w, d, off = 10 }) => <Rect x={x + off} y={y + off} w={w} d={d} z={0} className="hd-shadow" />;
const Tick = ({ x, y, z }) => (
  <polyline points={pts([[x, y, z], [x + 2.5, y + 3.5, z], [x + 7, y - 2.5, z]])} className="hd-tick" fill="none" />
);
const Label = ({ x, y, z, children, size = 7, weight = 600, className = 'hd-text' }) => (
  <text transform={flat(x, y, z, 1)} fontSize={size} fontWeight={weight} className={className}>{children}</text>
);

export const HeroDevice = () => {
  const grid = [];
  for (let i = -260; i <= 260; i += 40) {
    grid.push(<Line key={`a${i}`} a={[i, -260]} b={[i, 260]} className="hd-grid" />);
    grid.push(<Line key={`b${i}`} a={[-260, i]} b={[260, i]} className="hd-grid" />);
  }
  return (
    <svg className="hd" viewBox="-255 -175 470 310" role="img" aria-label="Illustration of the Exam View mobile app with schedule, verification and audit cards">
      <g>{grid}</g>

      <Shadow x={-130} y={50} w={95} d={90} />
      <Shadow x={-35} y={-95} w={70} d={170} off={14} />
      <Shadow x={60} y={30} w={100} d={80} />

      {/* guide lines */}
      <g>
        <Line a={[-60, 20]} b={[-60, 120]} className="hd-line" />
        <Line a={[-130, 140]} b={[-20, 140]} className="hd-line" />
        <Line a={[90, -40]} b={[90, 30]} className="hd-line" />
        <Line a={[30, 110]} b={[130, 110]} className="hd-line" />
      </g>

      {/* checklist (bottom left) */}
      <Card x={-130} y={50} w={95} d={90} z={0} />
      <Label x={-124} y={64} z={3}>Checklist</Label>
      {[78, 94, 110, 126].map((y, i) => (
        <g key={y}>
          <Rect x={-124} y={y - 4} w={9} d={9} z={3} className={i < 2 ? 'hd-accent' : 'hd-paper'} />
          {i < 2 && <Tick x={-122.5} y={y} z={3} />}
          <Line a={[-106, y]} b={[-106 + 52 - i * 8, y]} z={3} className={i < 2 ? 'hd-bold' : 'hd-line'} />
        </g>
      ))}

      {/* the phone */}
      <Card x={-35} y={-95} w={70} d={170} z={40} h={5} />
      <Rect x={-30} y={-90} w={60} d={160} z={45} className="hd-screen" />
      <Rect x={-9} y={-86} w={18} d={5} z={45} className="hd-ink" />
      <Label x={-24} y={-70} z={45} size={8} weight={700}>Live centers</Label>
      {[-52, -26, 0, 26].map((y, i) => (
        <g key={y}>
          <Rect x={-25} y={y} w={50} d={20} z={45} className="hd-row" />
          <Disc x={-18} y={y + 10} r={3.2} z={45} className={i === 1 ? 'hd-amber' : 'hd-green'} />
          <Line a={[-11, y + 7]} b={[10, y + 7]} z={45} className="hd-bold" />
          <Line a={[-11, y + 13]} b={[2, y + 13]} z={45} className="hd-line" />
          <Rect x={14} y={y + 5} w={9} d={9} z={45} className={i === 1 ? 'hd-paper' : 'hd-accent'} />
          {i !== 1 && <Tick x={15.5} y={y + 9} z={45} />}
        </g>
      ))}
      <Rect x={-25} y={52} w={50} d={12} z={45} className="hd-nav" />
      {[-17, -6, 5, 16].map((x) => <Disc key={x} x={x + 4} y={58} r={2.4} z={45} className="hd-dot-solid" />)}

      {/* shift card (left) */}
      <Card x={-125} y={-30} w={80} d={70} z={70} />
      <Rect x={-125} y={-30} w={26} d={9} z={73} className="hd-ink" />
      <Label x={-123} y={-23} z={73} size={6} className="hd-text-inv">SHIFT A</Label>
      {[-14, 0, 14].map((y, i) => (
        <g key={y}>
          <Line a={[-118, y]} b={[-104, y]} z={73} className="hd-line" />
          <Rect x={-98} y={y - 4} w={44 - i * 8} d={8} z={73} className={i === 1 ? 'hd-accent-soft' : 'hd-row'} />
        </g>
      ))}

      {/* identity card (right, high) */}
      <Card x={60} y={-80} w={82} d={72} z={110} />
      <Disc x={84} y={-56} r={11} z={113} className="hd-soft" />
      <Disc x={84} y={-60} r={4} z={113} className="hd-ink" />
      <Disc x={84} y={-48} r={8} z={113} className="hd-ink" />
      <Disc x={102} y={-46} r={6} z={113} className="hd-green" />
      <Tick x={99} y={-46} z={113} />
      <Line a={[70, -24]} b={[120, -24]} z={113} className="hd-bold" />
      <Line a={[70, -17]} b={[104, -17]} z={113} className="hd-line" />

      {/* audit chart (bottom right) */}
      <Card x={60} y={30} w={104} d={84} z={20} />
      <Label x={68} y={44} z={23}>Audit trail</Label>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const h = [10, 16, 12, 22, 18, 28, 24][i];
        return <Rect key={i} x={70 + i * 12} y={104 - h} w={7} d={h} z={23} className={i === 5 ? 'hd-accent' : 'hd-soft'} />;
      })}
      <Line a={[68, 105]} b={[152, 105]} z={23} className="hd-line" />
    </svg>
  );
};
