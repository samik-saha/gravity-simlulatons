/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Activity, Info } from 'lucide-react';

interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  color: string;
}

const G = 1; // Gravitational constant (scaled for simulation)
const MAX_TRAIL_LENGTH = 10000;
const VEL_SCALE = 40; // Pixels per unit velocity

const COLORS = ['#FF4D4D', '#4D94FF', '#4DFF88', '#FFD700', '#FF00FF', '#00FFFF'];

const SCENARIO_DATA: Record<string, () => Body[]> = {
  RANDOM: () => {
    const b: Body[] = [];
    for (let i = 0; i < 3; i++) {
      b.push({
        id: Math.random().toString(),
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 400,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        mass: 50 + Math.random() * 100,
        color: COLORS[i % COLORS.length],
      });
    }
    return b;
  },
  BINARY_STAR: () => [
    { id: 'b1', x: -80, y: 0, vx: 0, vy: 0.8, mass: 150, color: COLORS[0] },
    { id: 'b2', x: 80, y: 0, vx: 0, vy: -0.8, mass: 150, color: COLORS[1] }
  ],
  PLANET_STAR: () => [
    { id: 's1', x: 0, y: 0, vx: 0, vy: 0, mass: 600, color: COLORS[3] },
    { id: 'p1', x: 220, y: 0, vx: 0, vy: 1.65, mass: 10, color: COLORS[1] }
  ],
  CIRCUMBINARY: () => [
    { id: 'bs1', x: -35, y: 0, vx: 0, vy: 1, mass: 200, color: COLORS[0] },
    { id: 'bs2', x: 35, y: 0, vx: 0, vy: -1, mass: 200, color: COLORS[1] },
    { id: 'p1', x: 280, y: 0, vx: 0, vy: 1.2, mass: 5, color: COLORS[5] }
  ],
  TWO_PLANETS: () => [
    { id: 'sun', x: 0, y: 0, vx: 0, vy: 0, mass: 800, color: COLORS[3] },
    { id: 'p1', x: 160, y: 0, vx: 0, vy: 2.22, mass: 5, color: COLORS[2] },
    { id: 'p2', x: 280, y: 0, vx: 0, vy: 1.68, mass: 8, color: COLORS[4] }
  ]
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailsRef = useRef<Record<string, { x: number; y: number }[]>>({});
  const bodiesRef = useRef<Body[]>(SCENARIO_DATA.BINARY_STAR());
  
  // Camera Refs for ultra-fluid panning/zooming
  const offsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);

  // UI State
  const [isPlaying, setIsPlaying] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [zoomUI, setZoomUI] = useState(1);
  const [timeStep, setTimeStep] = useState(0.05);
  const [stepsPerFrame, setStepsPerFrame] = useState(1);
  const [activeInteraction, setActiveInteraction] = useState<{
    type: 'BODY' | 'VELOCITY' | 'PAN' | 'NONE';
    index: number | null;
  }>({ type: 'NONE', index: null });
  
  const [, setTick] = useState(0);
  const hasMoved = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const requestRef = useRef<number>(null);

  const updatePhysics = (currentBodies: Body[], currentTs: number) => {
    const nextBodies = currentBodies.map(b => ({ ...b }));
    for (let i = 0; i < nextBodies.length; i++) {
      let ax = 0, ay = 0;
      for (let j = 0; j < nextBodies.length; j++) {
        if (i === j) continue;
        const dx = nextBodies[j].x - nextBodies[i].x;
        const dy = nextBodies[j].y - nextBodies[i].y;
        const distSq = dx * dx + dy * dy;
        const softening = 5;
        const force = (G * nextBodies[j].mass) / (distSq + softening);
        const dist = Math.sqrt(distSq + softening);
        ax += force * (dx / dist);
        ay += force * (dy / dist);
      }
      nextBodies[i].vx += ax * currentTs;
      nextBodies[i].vy += ay * currentTs;
    }
    for (let i = 0; i < nextBodies.length; i++) {
      nextBodies[i].x += nextBodies[i].vx * currentTs;
      nextBodies[i].y += nextBodies[i].vy * currentTs;
    }
    return nextBodies;
  };

  const animate = () => {
    if (isPlaying) {
      for (let s = 0; s < stepsPerFrame; s++) {
        bodiesRef.current = updatePhysics(bodiesRef.current, timeStep);
      }
      bodiesRef.current.forEach(b => {
        if (!trailsRef.current[b.id]) trailsRef.current[b.id] = [];
        const trail = trailsRef.current[b.id];
        const last = trail[trail.length - 1];
        if (!last || Math.sqrt((b.x - last.x) ** 2 + (b.y - last.y) ** 2) > 2) {
          trail.push({ x: b.x, y: b.y });
          if (trail.length > MAX_TRAIL_LENGTH) trail.shift();
        }
      });
      setTick(t => t + 1);
    }
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2 + offsetRef.current.x, canvas.height / 2 + offsetRef.current.y);
        ctx.scale(zoomRef.current, zoomRef.current);

        if (showTrails) {
          bodiesRef.current.forEach(body => {
            const trail = trailsRef.current[body.id];
            if (!trail || trail.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = body.color;
            ctx.lineWidth = 1.0;
            ctx.globalAlpha = 0.4;
            ctx.moveTo(trail[0].x, trail[0].y);
            const skip = Math.max(1, Math.floor(trail.length / 2000));
            for (let i = skip; i < trail.length; i += skip) ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          });
        }

        bodiesRef.current.forEach(body => {
          ctx.beginPath();
          ctx.arc(body.x, body.y, Math.sqrt(body.mass) * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = body.color;
          ctx.fill();
          if (stepsPerFrame < 15) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = body.color;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          if (!isPlaying) {
            const vEndX = body.x + body.vx * VEL_SCALE;
            const vEndY = body.y + body.vy * VEL_SCALE;
            ctx.beginPath();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 / zoomRef.current;
            ctx.globalAlpha = 0.8;
            ctx.moveTo(body.x, body.y);
            ctx.lineTo(vEndX, vEndY);
            ctx.stroke();
            const angle = Math.atan2(vEndY - body.y, vEndX - body.x);
            const headLen = 8 / zoomRef.current;
            ctx.beginPath();
            ctx.moveTo(vEndX, vEndY);
            ctx.lineTo(vEndX - headLen * Math.cos(angle - Math.PI/6), vEndY - headLen * Math.sin(angle - Math.PI/6));
            ctx.moveTo(vEndX, vEndY);
            ctx.lineTo(vEndX - headLen * Math.cos(angle + Math.PI/6), vEndY - headLen * Math.sin(angle + Math.PI/6));
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }
        });
        ctx.restore();
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, timeStep, stepsPerFrame, showTrails]); // Depend on showTrails to refresh loop closure if needed

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    lastMousePos.current = { x: clientX, y: clientY };
    hasMoved.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const worldX = (x - canvas.width / 2 - offsetRef.current.x) / zoomRef.current;
    const worldY = (y - canvas.height / 2 - offsetRef.current.y) / zoomRef.current;

    if (!isPlaying) {
      const bodies = bodiesRef.current;
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const vEndX = body.x + body.vx * VEL_SCALE;
        const vEndY = body.y + body.vy * VEL_SCALE;
        const distToV = Math.sqrt((worldX - vEndX) ** 2 + (worldY - vEndY) ** 2);
        if (distToV < 15 / zoomRef.current) {
          setActiveInteraction({ type: 'VELOCITY', index: i });
          return;
        }
        const distToBody = Math.sqrt((worldX - body.x) ** 2 + (worldY - body.y) ** 2);
        const radius = Math.sqrt(body.mass) * 1.5;
        if (distToBody < radius + 10 / zoomRef.current) {
          setActiveInteraction({ type: 'BODY', index: i });
          return;
        }
      }
    }
    setActiveInteraction({ type: 'PAN', index: null });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeInteraction.type === 'NONE') return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - lastMousePos.current.x;
    const dy = clientY - lastMousePos.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;

    if (activeInteraction.type === 'PAN') {
      offsetRef.current.x += dx;
      offsetRef.current.y += dy;
    } else if (activeInteraction.type === 'BODY' && activeInteraction.index !== null) {
      const b = bodiesRef.current[activeInteraction.index];
      updateBodyRef(activeInteraction.index, { x: b.x + dx / zoomRef.current, y: b.y + dy / zoomRef.current });
    } else if (activeInteraction.type === 'VELOCITY' && activeInteraction.index !== null) {
      const b = bodiesRef.current[activeInteraction.index];
      updateBodyRef(activeInteraction.index, { vx: b.vx + dx / (zoomRef.current * VEL_SCALE), vy: b.vy + dy / (zoomRef.current * VEL_SCALE) });
    }
    lastMousePos.current = { x: clientX, y: clientY };
  };

  const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeInteraction.type === 'PAN' && !hasMoved.current) handleClick(e);
    setActiveInteraction({ type: 'NONE', index: null });
  };

  const handleMouseLeave = () => setActiveInteraction({ type: 'NONE', index: null });

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let clientX, clientY;
    if ('changedTouches' in e) {
      clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
    }
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const worldX = (x - canvas.width / 2 - offsetRef.current.x) / zoomRef.current;
    const worldY = (y - canvas.height / 2 - offsetRef.current.y) / zoomRef.current;

    const bodies = bodiesRef.current;
    const clickedBodyIndex = bodies.findIndex(body => {
      const dx = body.x - worldX, dy = body.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = Math.sqrt(body.mass) * 1.5;
      return dist <= radius + 10 / zoomRef.current;
    });

    if (clickedBodyIndex !== -1) {
      if (bodies.length > 1) {
        bodiesRef.current = bodies.filter((_, i) => i !== clickedBodyIndex);
        setTick(t => t + 1);
      }
    } else if (bodies.length < 3) {
      const id = Math.random().toString();
      const newBody: Body = {
        id, x: worldX, y: worldY, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
        mass: 50 + Math.random() * 100,
        color: COLORS.find(c => !bodies.some(b => b.color === c)) || COLORS[bodies.length % COLORS.length],
      };
      trailsRef.current[id] = [];
      bodiesRef.current = [...bodies, newBody];
      setTick(t => t + 1);
    }
  };

  const updateBodyRef = (index: number, updates: Partial<Body>) => {
    const next = [...bodiesRef.current];
    if (index < 0 || index >= next.length) return;
    next[index] = { ...next[index], ...updates };
    if ('x' in updates || 'y' in updates) trailsRef.current[next[index].id] = [];
    bodiesRef.current = next;
    setTick(t => t + 1);
  };

  const resetSimulation = () => {
    bodiesRef.current = SCENARIO_DATA.BINARY_STAR();
    trailsRef.current = {};
    offsetRef.current = { x: 0, y: 0 };
    setTick(t => t + 1);
  };

  const loadScenario = (key: string) => {
    bodiesRef.current = SCENARIO_DATA[key]();
    trailsRef.current = {};
    offsetRef.current = { x: 0, y: 0 };
    zoomRef.current = 1; setZoomUI(1);
    setIsPlaying(true);
    setTick(t => t + 1);
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] overflow-hidden font-sans text-white">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
        className={`fixed inset-0 w-full h-full ${activeInteraction.type !== 'NONE' && activeInteraction.type !== 'PAN' ? 'cursor-grabbing' : 'cursor-grab'}`}
      />

      <div className="absolute top-0 right-0 h-full w-72 p-4 pb-12 z-10 pointer-events-none flex flex-col gap-2 overflow-y-auto overflow-x-hidden transition-all">
        <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-2.5 rounded-2xl border border-white/10 flex flex-col gap-2">
          <h2 className="text-[8px] font-bold uppercase tracking-widest opacity-40 ml-1">Universal Presets</h2>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(SCENARIO_DATA).map(([key]) => (
              <button key={key} onClick={() => loadScenario(key)} className="text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all">
                <div className="text-[9px] font-bold whitespace-nowrap overflow-hidden text-ellipsis opacity-80">{key.replace('_', ' ')}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-3 rounded-2xl border border-white/10 flex flex-col gap-2.5">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-lg font-bold tracking-tighter uppercase italic leading-none">{bodiesRef.current.length}-Body System</h1>
              <p className="text-[8px] font-mono opacity-30 uppercase tracking-widest mt-0.5">Gravitational Dynamics</p>
            </div>
            <button onClick={() => setShowTrails(!showTrails)} className={`p-1.5 rounded-lg transition-all border ${showTrails ? 'bg-white/20 border-white/30' : 'bg-transparent border-white/10 opacity-50'}`} title="Toggle Trails"><Activity size={12} /></button>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setIsPlaying(!isPlaying)} className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg transition-all border border-white/10 flex items-center justify-center gap-1.5">
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              <span className="text-[9px] uppercase font-bold tracking-tight">{isPlaying ? 'Pause' : 'Resume'}</span>
            </button>
            <button onClick={resetSimulation} className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg transition-all border border-white/10" title="Reset"><RotateCcw size={12} /></button>
          </div>
        </div>

        <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] uppercase font-mono opacity-50"><label>Zoom</label><span>{zoomUI.toFixed(1)}x</span></div>
              <input type="range" min="0.1" max="3" step="0.1" value={zoomUI} onChange={(e) => { const val = parseFloat(e.target.value); setZoomUI(val); zoomRef.current = val; }} className="w-full accent-white h-1" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] uppercase font-mono opacity-50"><label>Time Step</label><span>{timeStep.toFixed(3)}</span></div>
              <input type="range" min="0.001" max="0.1" step="0.001" value={timeStep} onChange={(e) => setTimeStep(parseFloat(e.target.value))} className="w-full accent-white h-1" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] uppercase font-mono opacity-50"><label>Sim Speed</label><span>{stepsPerFrame}x</span></div>
              <input type="range" min="1" max="50" step="1" value={stepsPerFrame} onChange={(e) => setStepsPerFrame(parseInt(e.target.value))} className="w-full accent-white h-1" />
            </div>
          </div>
        </div>

        <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-3 rounded-2xl border border-white/10 flex flex-col gap-2">
          <h2 className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-1">Dynamics Control</h2>
          <div className="flex flex-col gap-2">
            {bodiesRef.current.map((body, i) => (
              <div key={body.id} className="flex flex-col gap-1.5 p-2 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: body.color, boxShadow: `0 0 5px ${body.color}` }} />
                    <span className="text-[9px] font-mono uppercase opacity-40">Body {i + 1}</span>
                  </div>
                  {!isPlaying && <span className="text-[8px] font-mono opacity-20 uppercase tracking-tighter italic">Manual Mode</span>}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[7px] uppercase font-mono opacity-30">Mass</label>
                    <input type="number" value={Math.round(body.mass)} onChange={(e) => updateBodyRef(i, { mass: Math.max(1, parseInt(e.target.value) || 0) })} className="bg-black/30 border border-white/5 rounded px-1 py-0.5 text-[9px] font-mono w-full focus:border-white/20 outline-none transition-colors" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[7px] uppercase font-mono opacity-30">X Pos</label>
                    <input type="number" value={Math.round(body.x)} disabled={isPlaying} onChange={(e) => updateBodyRef(i, { x: parseInt(e.target.value) || 0 })} className={`bg-black/30 border border-white/5 rounded px-1 py-0.5 text-[9px] font-mono w-full focus:border-white/20 outline-none transition-colors ${isPlaying ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:border-white/10'}`} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[7px] uppercase font-mono opacity-30">Y Pos</label>
                    <input type="number" value={Math.round(body.y)} disabled={isPlaying} onChange={(e) => updateBodyRef(i, { y: parseInt(e.target.value) || 0 })} className={`bg-black/30 border border-white/5 rounded px-1 py-0.5 text-[9px] font-mono w-full focus:border-white/20 outline-none transition-colors ${isPlaying ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:border-white/10'}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {bodiesRef.current.length > 1 && (
          <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex flex-col gap-2">
            <h2 className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-1">Proximity (AU)</h2>
            <div className="flex flex-col gap-1.5">
              {(() => {
                const b = bodiesRef.current;
                const p = [];
                for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
                  const dx = b[i].x - b[j].x, dy = b[i].y - b[j].y;
                  p.push({ i, j, dist: Math.sqrt(dx*dx + dy*dy) });
                }
                return p.map((pair, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5">
                        <div className="w-1 h-2 rounded-full opacity-60" style={{ backgroundColor: b[pair.i].color }} />
                        <div className="w-1 h-2 rounded-full opacity-60" style={{ backgroundColor: b[pair.j].color }} />
                      </div>
                      <span className="text-[9px] font-mono opacity-50">B{pair.i + 1}↔{pair.j + 1}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold">{(pair.dist / 10).toFixed(1)} AU</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        <div className="pointer-events-auto mt-auto bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 mb-1.5 opacity-40"><Info size={12} /><h3 className="text-[9px] font-bold uppercase tracking-widest">Physics</h3></div>
          <p className="text-[10px] opacity-60 leading-tight font-sans italic">Chaotic 3-body simulation using semi-implicit Euler integration.</p>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        input[type=range] { -webkit-appearance: none; background: rgba(255, 255, 255, 0.1); height: 4px; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: white; cursor: pointer; }
      `}} />
    </div>
  );
}
