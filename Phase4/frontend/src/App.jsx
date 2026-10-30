import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Category Styling ────────────────────────────────────────────────────────
const CATEGORY_STYLES = {
  'UI':             { color: '#38bdf8', glow: 'rgba(56,189,248,0.35)',  bg: 'rgba(56,189,248,0.12)',  label: 'UI' },
  'API / Routing':  { color: '#818cf8', glow: 'rgba(129,140,248,0.35)', bg: 'rgba(129,140,248,0.12)', label: 'API' },
  'Authentication': { color: '#fb7185', glow: 'rgba(251,113,133,0.35)', bg: 'rgba(251,113,133,0.12)', label: 'AUTH' },
  'Storage / DB':   { color: '#34d399', glow: 'rgba(52,211,153,0.35)',  bg: 'rgba(52,211,153,0.12)',  label: 'DB' },
  'Service':        { color: '#fbbf24', glow: 'rgba(251,191,36,0.35)',  bg: 'rgba(251,191,36,0.12)',  label: 'SVC' },
  'Module':         { color: '#a78bfa', glow: 'rgba(167,139,250,0.35)', bg: 'rgba(167,139,250,0.12)', label: 'MOD' },
};

const getCatStyle = (cat) => CATEGORY_STYLES[cat] || CATEGORY_STYLES['Module'];

const SEV_STYLES = {
  CRITICAL: { bg: 'rgba(244,63,94,0.15)',  color: '#f43f5e', border: '#f43f5e', bar: '#f43f5e' },
  HIGH:     { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '#f59e0b', bar: '#f59e0b' },
  MEDIUM:   { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '#38bdf8', bar: '#38bdf8' },
  LOW:      { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '#475569', bar: '#475569' },
};

// ─── Floating Node Card ───────────────────────────────────────────────────────
// Appears near the clicked node, auto-positioned to stay inside the panel.
function NodeCard({ node, screenX, screenY, containerRef, onClose }) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState({ x: screenX + 18, y: screenY - 60 });
  const style = getCatStyle(node.category);

  // Clamp card inside the container bounds after mount
  useEffect(() => {
    if (!cardRef.current || !containerRef.current) return;
    const card = cardRef.current.getBoundingClientRect();
    const box  = containerRef.current.getBoundingClientRect();

    let x = screenX + 18;
    let y = screenY - 60;

    // Clamp right edge
    if (x + card.width > box.right - 8)  x = screenX - card.width - 18;
    // Clamp bottom edge
    if (y + card.height > box.bottom - 8) y = box.bottom - card.height - 8;
    // Clamp top edge
    if (y < box.top + 8) y = box.top + 8;
    // Clamp left edge
    if (x < box.left + 8) x = box.left + 8;

    setPos({ x: x - box.left, y: y - box.top });
  }, [screenX, screenY]);

  return (
    <div
      ref={cardRef}
      style={{
        position: 'absolute',
        left: pos.x,
        top:  pos.y,
        width: 280,
        background: 'rgba(10,14,23,0.97)',
        border: `1px solid ${style.color}55`,
        borderRadius: 12,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${style.color}22, 0 0 24px ${style.glow}`,
        backdropFilter: 'blur(20px)',
        zIndex: 20,
        animation: 'cardPop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
        transformOrigin: 'top left',
        overflow: 'hidden',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Coloured top accent bar */}
      <div style={{ height: 3, background: `linear-gradient(to right, ${style.color}, transparent)` }} />

      <div style={{ padding: '12px 14px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px',
                color: style.color, background: style.bg,
                padding: '2px 8px', borderRadius: 4, border: `1px solid ${style.color}44`,
              }}>
                {node.category}
              </span>
              <span style={{ fontSize: 10, color: '#475569' }}>
                {node.locations?.length || 0} {node.locations?.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', lineHeight: 1.3, margin: 0 }}>
              {node.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: 14, width: 24, height: 24, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.12)'; e.target.style.color = '#f8fafc'; }}
            onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.06)'; e.target.style.color = '#64748b'; }}
          >
            ✕
          </button>
        </div>

        {/* Summary */}
        <p style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 10px 0' }}>
          {node.summary}
        </p>

        {/* Code locations */}
        {node.locations?.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#475569', marginBottom: 5 }}>
              Code Locations
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 130, overflowY: 'auto' }}>
              {node.locations.map((loc, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '5px 9px', borderRadius: 5, fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', gap: 8 }}
                >
                  <span style={{ color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    📄 {loc.file}
                  </span>
                  <span style={{ color: '#f59e0b', fontWeight: 700, flexShrink: 0, fontSize: 10 }}>
                    L{loc.start_line}–{loc.end_line}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── SVG Force Graph ─────────────────────────────────────────────────────────
function ForceGraph({ nodes, edges, selectedId, onSelect, onNodeScreenClick }) {
  const svgRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [dragging, setDragging] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState(null);
  const animRef = useRef(null);
  const posRef = useRef({});
  const velRef = useRef({});
  const didDragRef = useRef(false);  // distinguish click vs drag

  const W = 800, H = 480;
  const NODE_R = 38;

  // Initialize positions in a circle
  useEffect(() => {
    if (!nodes.length) return;
    const n = nodes.length;
    const newPos = {};
    const newVel = {};
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n;
      const r = Math.min(160, 60 + n * 22);
      newPos[node.id] = {
        x: W / 2 + r * Math.cos(angle),
        y: H / 2 + r * Math.sin(angle),
      };
      newVel[node.id] = { x: 0, y: 0 };
    });
    posRef.current = newPos;
    velRef.current = newVel;
    setPositions({ ...newPos });
  }, [nodes.map(n => n.id).join(',')]);

  // Force simulation
  useEffect(() => {
    if (!nodes.length) return;
    let frame = 0;
    const tick = () => {
      const pos = posRef.current;
      const vel = velRef.current;
      const ids = nodes.map(n => n.id);

      ids.forEach(id => {
        let fx = 0, fy = 0;
        const p = pos[id];
        if (!p) return;

        // Repulsion between nodes
        ids.forEach(id2 => {
          if (id2 === id) return;
          const p2 = pos[id2];
          if (!p2) return;
          const dx = p.x - p2.x, dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 5000 / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });

        // Attraction along edges
        edges.forEach(e => {
          let otherId = null;
          if (e.source === id) otherId = e.target;
          else if (e.target === id) otherId = e.source;
          if (!otherId) return;
          const p2 = pos[otherId];
          if (!p2) return;
          const dx = p2.x - p.x, dy = p2.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ideal = NODE_R * 4.5;
          const force = (dist - ideal) * 0.018;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });

        // Center gravity
        fx += (W / 2 - p.x) * 0.006;
        fy += (H / 2 - p.y) * 0.006;

        const damping = 0.82;
        vel[id] = {
          x: (vel[id].x + fx) * damping,
          y: (vel[id].y + fy) * damping,
        };
        pos[id] = {
          x: Math.max(NODE_R + 8, Math.min(W - NODE_R - 8, p.x + vel[id].x * 0.016)),
          y: Math.max(NODE_R + 8, Math.min(H - NODE_R - 8, p.y + vel[id].y * 0.016)),
        };
      });

      frame++;
      if (frame % 2 === 0) setPositions({ ...pos });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes.map(n => n.id).join(','), edges.length]);

  // Convert SVG coords → screen coords
  const svgToScreen = useCallback((svgX, svgY) => {
    if (!svgRef.current) return { x: svgX, y: svgY };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = rect.width / W;
    const scaleY = rect.height / H;
    return {
      x: rect.left + (svgX + pan.x) * scaleX,
      y: rect.top  + (svgY + pan.y) * scaleY,
    };
  }, [pan]);

  const handleNodeMouseDown = (e, id) => {
    e.stopPropagation();
    didDragRef.current = false;
    setDragging(id);
  };

  const handleNodeMouseUp = (e, id) => {
    e.stopPropagation();
    if (!didDragRef.current) {
      // It was a clean click — fire the screen-coord callback
      const svgPos = posRef.current[id];
      if (svgPos) {
        const screen = svgToScreen(svgPos.x, svgPos.y);
        onNodeScreenClick(nodes.find(n => n.id === id), screen);
      }
    }
    setDragging(null);
  };

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX - pan.x;
    const my = (e.clientY - rect.top) * scaleY - pan.y;

    if (dragging) {
      didDragRef.current = true;
      posRef.current[dragging] = { x: mx, y: my };
      velRef.current[dragging] = { x: 0, y: 0 };
    } else if (panStart) {
      setPan(p => ({
        x: p.x + (e.clientX - panStart.x) * scaleX,
        y: p.y + (e.clientY - panStart.y) * scaleY,
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [dragging, panStart, pan]);

  const handleMouseUp = () => { setDragging(null); setPanStart(null); };
  const handleSvgMouseDown = (e) => {
    if (e.target === svgRef.current || e.target.tagName === 'rect') {
      setPanStart({ x: e.clientX, y: e.clientY });
      onNodeScreenClick(null, null); // close card on background click
    }
  };

  if (!nodes.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🕸️</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8' }}>No Graph Loaded</div>
        <div style={{ fontSize: 12, marginTop: 6, color: '#64748b', textAlign: 'center', maxWidth: 260 }}>
          Provide a local path or upload a <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>.zip</code> of a git repo to map its components.
        </div>
      </div>
    );
  }

  const arrowId = 'arrowhead';

  return (
    <svg
      ref={svgRef}
      viewBox={`${-pan.x} ${-pan.y} ${W} ${H}`}
      style={{ width: '100%', height: '100%', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseDown={handleSvgMouseDown}
    >
      <defs>
        <marker id={arrowId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="rgba(148,163,184,0.55)" />
        </marker>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect x={-pan.x} y={-pan.y} width={W} height={H} fill="url(#grid)" />

      {/* Edges */}
      {edges.map((edge, idx) => {
        const src = positions[edge.source];
        const tgt = positions[edge.target];
        if (!src || !tgt) return null;
        const dx = tgt.x - src.x, dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        const x1 = src.x + ux * (NODE_R + 2);
        const y1 = src.y + uy * (NODE_R + 2);
        const x2 = tgt.x - ux * (NODE_R + 14);
        const y2 = tgt.y - uy * (NODE_R + 14);
        const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2 - 20;
        return (
          <g key={idx}>
            <path
              d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
              fill="none"
              stroke="rgba(148,163,184,0.25)"
              strokeWidth="1.5"
              markerEnd={`url(#${arrowId})`}
            />
            <text
              x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8}
              textAnchor="middle" fill="rgba(148,163,184,0.6)"
              fontSize="9" fontFamily="JetBrains Mono, monospace"
              style={{ pointerEvents: 'none' }}
            >
              {edge.relationship}
            </text>
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const pos = positions[node.id];
        if (!pos) return null;
        const style = getCatStyle(node.category);
        const isSelected = node.id === selectedId;
        const shortName = node.name.length > 18 ? node.name.slice(0, 16) + '…' : node.name;
        const words = shortName.split(' ');
        const line1 = words.slice(0, 2).join(' ');
        const line2 = words.slice(2).join(' ');

        return (
          <g
            key={node.id}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onMouseUp={(e) => handleNodeMouseUp(e, node.id)}
            style={{ cursor: 'pointer' }}
          >
            {/* Outer glow ring (always, brighter when selected) */}
            <circle cx={pos.x} cy={pos.y} r={NODE_R + 8}
              fill="none"
              stroke={style.color}
              strokeWidth={isSelected ? 1.5 : 0.5}
              opacity={isSelected ? 0.5 : 0.2}
            />
            {/* Glow fill when selected */}
            {isSelected && (
              <circle cx={pos.x} cy={pos.y} r={NODE_R + 14}
                fill={style.glow}
                style={{ filter: 'blur(10px)' }}
              />
            )}
            {/* Node body */}
            <circle
              cx={pos.x} cy={pos.y} r={NODE_R}
              fill={isSelected ? style.bg : 'rgba(12,18,34,0.95)'}
              stroke={style.color}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            {/* Category label */}
            <text
              x={pos.x} y={pos.y - 13}
              textAnchor="middle" fill={style.color}
              fontSize="9" fontWeight="800" fontFamily="JetBrains Mono, monospace"
              letterSpacing="1"
              style={{ pointerEvents: 'none' }}
            >
              {style.label}
            </text>
            {/* Node name — split across 1-2 lines */}
            <text x={pos.x} y={pos.y + (line2 ? 2 : 6)}
              textAnchor="middle" fill="#f1f5f9"
              fontSize="10.5" fontWeight="600" fontFamily="Inter, sans-serif"
              style={{ pointerEvents: 'none' }}>
              {line1}
            </text>
            {line2 && (
              <text x={pos.x} y={pos.y + 15}
                textAnchor="middle" fill="#94a3b8"
                fontSize="9.5" fontFamily="Inter, sans-serif"
                style={{ pointerEvents: 'none' }}>
                {line2}
              </text>
            )}
            {/* File-count badge */}
            <circle cx={pos.x + NODE_R - 8} cy={pos.y - NODE_R + 8} r={9}
              fill="#060a12" stroke={style.color} strokeWidth="1.2" />
            <text x={pos.x + NODE_R - 8} y={pos.y - NODE_R + 12}
              textAnchor="middle" fill={style.color}
              fontSize="8" fontWeight="800" fontFamily="Inter, sans-serif"
              style={{ pointerEvents: 'none' }}>
              {node.locations?.length || 0}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [repoPath, setRepoPath] = useState('');
  const [repoData, setRepoData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gitError, setGitError] = useState('');

  // Floating card state: { node, x, y } where x/y are page-relative screen coords
  const [cardState, setCardState] = useState(null);
  const graphContainerRef = useRef(null);

  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [messages, setMessages] = useState([
    {
      sender: 'agent',
      text: '👋 Welcome to **AegisGraph AI**.\n\nPoint me at any local git repo — I\'ll map its architecture, scan for vulnerabilities, and answer your questions via local **Gemma 4**.',
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentThinking]);

  const analyzeLocal = async (customPath) => {
    const targetPath = (customPath !== undefined ? customPath : repoPath).trim();
    if (!targetPath) { setGitError('Enter a local directory path.'); return; }
    setGitError('');
    setIsLoading(true);
    setCardState(null);
    try {
      const res = await fetch(`${API_BASE}/v1/repo/analyze-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGitError(data.detail || data.message || 'Failed to scan repository.');
        setRepoData(null);
        return;
      }
      setRepoData(data);
      addAgentMsg(`✅ Mapped **${data.repo_name}** (${data.files_scanned} files)\n• **${data.functional_nodes?.length || 0}** functional components found\n• **${data.vulnerabilities?.length || 0}** security issues detected`);
    } catch {
      setGitError('Network or server error while scanning repository.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleZipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGitError('');
    setIsLoading(true);
    setCardState(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/v1/repo/upload-zip`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setGitError(data.detail || data.message || 'Failed to analyze ZIP.');
        setRepoData(null);
        return;
      }
      setRepoData(data);
      addAgentMsg(`📦 Parsed **${data.repo_name}** from ZIP (${data.files_scanned} files)\n• **${data.functional_nodes?.length || 0}** nodes  •  **${data.vulnerabilities?.length || 0}** vulnerabilities`);
    } catch {
      setGitError('Error uploading repository archive.');
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const addAgentMsg = (text, mode) => {
    setMessages(prev => [...prev, { sender: 'agent', text, mode }]);
  };

  // Node click: receives the node object + screen {x,y}
  const handleNodeScreenClick = useCallback((node, screen) => {
    if (!node || !screen) {
      setCardState(null);
      return;
    }
    setCardState({ node, x: screen.x, y: screen.y });
  }, []);

  const sendMessage = async (textToSend) => {
    const query = (textToSend || chatInput).trim();
    if (!query || isAgentThinking) return;
    setChatInput('');
    setMessages(prev => [...prev, { sender: 'user', text: query }]);
    setIsAgentThinking(true);
    try {
      const res = await fetch(`${API_BASE}/v1/agent/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          repo_name: repoData?.repo_name || 'No Repository',
          nodes: repoData?.functional_nodes || [],
          edges: repoData?.functional_edges || [],
          vulnerabilities: repoData?.vulnerabilities || [],
          model: 'gemma4:e4b',
        }),
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        addAgentMsg(data.answer, data.mode);
      } else {
        addAgentMsg(`⚠️ ${data.detail || data.message || 'Unable to generate response.'}`);
      }
    } catch {
      addAgentMsg('❌ Could not reach the local agent backend.');
    } finally {
      setIsAgentThinking(false);
    }
  };

  const filteredVulns = (repoData?.vulnerabilities || []).filter(v =>
    severityFilter === 'ALL' || v.severity === severityFilter
  );

  const vulnCounts = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].reduce((acc, s) => {
    acc[s] = (repoData?.vulnerabilities || []).filter(v => v.severity === s).length;
    return acc;
  }, {});

  // Convert page coords to container-relative
  const containerRelative = cardState && graphContainerRef.current
    ? (() => {
        const box = graphContainerRef.current.getBoundingClientRect();
        return { x: cardState.x - box.left, y: cardState.y - box.top };
      })()
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#080c14', color: '#f8fafc', fontFamily: 'Inter, -apple-system, sans-serif', overflow: 'hidden' }}>

      {/* ── Top Bar ── */}
      <header style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: 'rgba(10,14,23,0.95)', backdropFilter: 'blur(12px)', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 0 14px rgba(99,102,241,0.5)' }}>🛡️</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>AegisGraph AI</span>
          <span style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.07)' }}>Local · Offline</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12 }}>
          {repoData ? (
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <strong>{repoData.repo_name}</strong> · {repoData.files_scanned} files
            </span>
          ) : (
            <span style={{ color: '#475569' }}>No repository loaded</span>
          )}
          <span style={{ color: '#818cf8', background: 'rgba(99,102,241,0.12)', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.25)', fontSize: 11 }}>
            🤖 Gemma 4:e4b (Local Ollama)
          </span>
        </div>
      </header>

      {/* ── 3-Panel Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ══════════════════════════════════════════════════════ */}
        {/* PANEL 1 — Left: Repo Ingestion + Agent Chat           */}
        {/* ══════════════════════════════════════════════════════ */}
        <section style={{ width: 320, minWidth: 280, maxWidth: 380, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', background: '#0a0f1c', flexShrink: 0 }}>

          {/* Repo Input */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0c1220' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#475569', marginBottom: 10 }}>
              📁 Repository Source
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Path to local .git repo…"
                value={repoPath}
                onChange={e => setRepoPath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyzeLocal()}
                style={{ flex: 1, background: '#1a2235', border: gitError ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '7px 10px', borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
              />
              <button
                onClick={() => analyzeLocal()}
                disabled={isLoading}
                style={{ background: isLoading ? '#334155' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 6, padding: '0 14px', fontWeight: 700, fontSize: 12, cursor: isLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', boxShadow: isLoading ? 'none' : '0 0 12px rgba(99,102,241,0.4)' }}
              >
                {isLoading ? '…' : 'Scan'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => { setRepoPath('.'); analyzeLocal('.'); }}
                style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Use current project (.)
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Upload .zip
              </button>
              <input ref={fileInputRef} type="file" accept=".zip" onChange={handleZipUpload} style={{ display: 'none' }} />
            </div>

            {gitError && (
              <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 6, color: '#fb7185', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>⚠️</span> <span>{gitError}</span>
              </div>
            )}

            {isLoading && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(to right, #6366f1, #10b981)', animation: 'pulseBar 1.4s ease-in-out infinite', width: '60%' }} />
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4, textAlign: 'center' }}>Scanning repository…</div>
              </div>
            )}
          </div>

          {/* Agent Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#475569' }}>🤖 Gemma 4 Agent</span>
              <span style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Ready
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
                  <div style={{
                    background: m.sender === 'user' ? 'linear-gradient(135deg,#4f46e5,#6366f1)' : 'rgba(30,41,59,0.8)',
                    color: '#fff',
                    padding: '9px 13px',
                    borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    border: m.sender === 'user' ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  }}>
                    {m.text}
                  </div>
                  {m.mode === 'graph_grounded_fallback' && (
                    <div style={{ fontSize: 9, color: '#475569', marginTop: 3, paddingLeft: 4 }}>⚡ Graph-grounded fallback</div>
                  )}
                  {m.mode === 'ollama_gemma4_live' && (
                    <div style={{ fontSize: 9, color: '#10b981', marginTop: 3, paddingLeft: 4 }}>✨ Live Gemma 4:e4b</div>
                  )}
                </div>
              ))}
              {isAgentThinking && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.07)', padding: '8px 12px', borderRadius: '12px 12px 12px 2px', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                  <span style={{ animation: 'blink 1s step-start infinite' }}>●</span> Analyzing…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 5, overflowX: 'auto' }}>
              {[['🏗️ Architecture', 'Explain the functional architecture and data flow'], ['🐛 Top Bugs', 'What are the highest severity vulnerabilities and how to fix them?']].map(([label, prompt]) => (
                <button key={label} onClick={() => sendMessage(prompt)}
                  style={{ fontSize: 10, padding: '4px 9px', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', background: '#0c1220', display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Ask about the codebase…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                style={{ flex: 1, background: '#1a2235', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 11px', borderRadius: 6, fontSize: 12.5, outline: 'none' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isAgentThinking || !chatInput.trim()}
                style={{ background: chatInput.trim() ? '#6366f1' : '#1e293b', color: chatInput.trim() ? '#fff' : '#475569', border: 'none', borderRadius: 6, padding: '0 13px', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 13, transition: 'all 0.15s' }}
              >
                →
              </button>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════ */}
        {/* PANEL 2 — Middle: Knowledge Graph                    */}
        {/* ══════════════════════════════════════════════════════ */}
        <section
          ref={graphContainerRef}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#060a12', position: 'relative', overflow: 'hidden', minWidth: 0 }}
        >
          {/* Graph header */}
          <div style={{ height: 44, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', background: '#0a0f1c', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Functional Knowledge Graph</span>
              {repoData && (
                <span style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4 }}>
                  {repoData.functional_nodes?.length || 0} nodes · {repoData.functional_edges?.length || 0} edges
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, color: '#475569' }}>Click node to inspect · Drag to move</span>
          </div>

          {/* Graph canvas — fills remaining space */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <ForceGraph
              nodes={repoData?.functional_nodes || []}
              edges={repoData?.functional_edges || []}
              selectedId={cardState?.node?.id}
              onSelect={() => {}}
              onNodeScreenClick={handleNodeScreenClick}
            />

            {/* Floating NodeCard */}
            {cardState && containerRelative && (
              <NodeCard
                node={cardState.node}
                screenX={containerRelative.x}
                screenY={containerRelative.y}
                containerRef={graphContainerRef}
                onClose={() => setCardState(null)}
              />
            )}

            {/* Category Legend */}
            {repoData && (
              <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(8,12,20,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 12px', backdropFilter: 'blur(8px)', zIndex: 5 }}>
                {Object.entries(CATEGORY_STYLES).slice(0, 5).map(([cat, s]) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, fontSize: 10, color: '#94a3b8' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: `0 0 5px ${s.color}` }} />
                    {cat}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════ */}
        {/* PANEL 3 — Right: Vulnerability Priority List          */}
        {/* ══════════════════════════════════════════════════════ */}
        <section style={{ width: 300, minWidth: 260, maxWidth: 360, borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', background: '#0a0f1c', flexShrink: 0 }}>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0c1220' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#475569' }}>🐛 Vulnerability Priority</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{repoData?.vulnerabilities?.length || 0} total</span>
            </div>

            {/* Severity bar */}
            {repoData && repoData.vulnerabilities?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => {
                    const count = vulnCounts[s] || 0;
                    const total = repoData.vulnerabilities.length;
                    return count > 0 ? (
                      <div key={s} style={{ flex: count / total, background: SEV_STYLES[s].bar }} />
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 4 }}>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => {
                const count = s === 'ALL' ? (repoData?.vulnerabilities?.length || 0) : (vulnCounts[s] || 0);
                const active = severityFilter === s;
                const sev = SEV_STYLES[s];
                return (
                  <button key={s}
                    onClick={() => setSeverityFilter(s)}
                    style={{ flex: 1, background: active ? (sev ? sev.bg : 'rgba(99,102,241,0.15)') : 'rgba(255,255,255,0.03)', color: active ? (sev ? sev.color : '#818cf8') : '#475569', border: active ? `1px solid ${sev ? sev.border : '#6366f1'}` : '1px solid rgba(255,255,255,0.05)', borderRadius: 5, padding: '4px 2px', fontSize: 9, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px', lineHeight: 1.6 }}>
                    {s === 'ALL' ? 'ALL' : s.slice(0, 3)}<br />
                    <span style={{ fontSize: 11, fontWeight: 800 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredVulns.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: '#475569', fontSize: 12 }}>
                {repoData
                  ? repoData.vulnerabilities?.length === 0
                    ? <><div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>No vulnerabilities detected.</>
                    : '✅ No findings match this filter.'
                  : <><div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>Scan a repository to view security findings.</>
                }
              </div>
            ) : (
              filteredVulns.map(v => {
                const badge = SEV_STYLES[v.severity] || SEV_STYLES.LOW;
                return (
                  <div key={v.id} style={{ background: '#111827', borderRadius: 8, border: `1px solid ${badge.border}33`, borderLeft: `3px solid ${badge.color}`, padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: badge.color, background: badge.bg, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.5px' }}>
                        {v.severity}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#38bdf8' }}>
                        {v.file}:{v.line}
                      </span>
                    </div>
                    <h4 style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{v.title}</h4>
                    {v.code_snippet && (
                      <div style={{ background: '#0a0f1c', padding: '5px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#cbd5e1', overflowX: 'auto', whiteSpace: 'pre', borderLeft: `2px solid ${badge.color}44` }}>
                        {v.code_snippet}
                      </div>
                    )}
                    <p style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.45 }}>{v.description}</p>
                    <div style={{ fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '6px 9px', borderRadius: 5, border: '1px solid rgba(16,185,129,0.2)', lineHeight: 1.4 }}>
                      💡 <strong>Fix:</strong> {v.fix}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ── Global Styles ── */}
      <style>{`
        @keyframes cardPop {
          0%   { opacity: 0; transform: scale(0.88) translateY(6px); }
          100% { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes pulseBar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        input::placeholder { color: #334155; }
      `}</style>
    </div>
  );
}
