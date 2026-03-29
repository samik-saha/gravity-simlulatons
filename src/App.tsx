/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Activity, Info } from 'lucide-react';

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  color: string;
  trail: { x: number; y: number }[];
}

const G = 1; // Gravitational constant (scaled for simulation)
const MAX_TRAIL_LENGTH = 10000;

const COLORS = ['#FF4D4D', '#4D94FF', '#4DFF88', '#FFD700', '#FF00FF', '#00FFFF'];

const SCENARIOS = {
  RANDOM: {
    label: "Random Chaos",
    bodies: () => {
      const b: Body[] = [];
      for (let i = 0; i < 3; i++) {
        b.push({
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 400,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          mass: 50 + Math.random() * 100,
          color: COLORS[i % COLORS.length],
          trail: [],
        });
      }
      return b;
    }
  },
  BINARY_STAR: {
    label: "Binary Star",
    bodies: () => [
      { x: -80, y: 0, vx: 0, vy: 0.8, mass: 150, color: COLORS[0], trail: [] },
      { x: 80, y: 0, vx: 0, vy: -0.8, mass: 150, color: COLORS[1], trail: [] }
    ]
  },
  PLANET_STAR: {
    label: "Planet & Star",
    bodies: () => [
      { x: 0, y: 0, vx: 0, vy: 0, mass: 600, color: COLORS[3], trail: [] },
      { x: 220, y: 0, vx: 0, vy: 1.65, mass: 10, color: COLORS[1], trail: [] }
    ]
  },
  CIRCUMBINARY: {
    label: "Circumbinary",
    bodies: () => [
      { x: -35, y: 0, vx: 0, vy: 1.8, mass: 200, color: COLORS[0], trail: [] },
      { x: 35, y: 0, vx: 0, vy: -1.8, mass: 200, color: COLORS[1], trail: [] },
      { x: 280, y: 0, vx: 0, vy: 1.2, mass: 5, color: COLORS[5], trail: [] }
    ]
  },
  TWO_PLANETS: {
    label: "Solar System",
    bodies: () => [
      { x: 0, y: 0, vx: 0, vy: 0, mass: 800, color: COLORS[3], trail: [] },
      { x: 160, y: 0, vx: 0, vy: 2.22, mass: 5, color: COLORS[2], trail: [] },
      { x: 280, y: 0, vx: 0, vy: 1.68, mass: 8, color: COLORS[4], trail: [] }
    ]
  }
};

const generateRandomBodies = (): Body[] => SCENARIOS.BINARY_STAR.bodies();

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bodies, setBodies] = useState<Body[]>(generateRandomBodies());
  const [isPlaying, setIsPlaying] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [timeStep, setTimeStep] = useState(0.05);
  const [stepsPerFrame, setStepsPerFrame] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const hasMoved = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const requestRef = useRef<number>(null);

  const updatePhysics = (currentBodies: Body[], currentTs: number) => {
    const nextBodies = currentBodies.map(b => ({ ...b }));

    // Calculate forces and update velocities
    for (let i = 0; i < nextBodies.length; i++) {
      let ax = 0;
      let ay = 0;

      for (let j = 0; j < nextBodies.length; j++) {
        if (i === j) continue;

        const dx = nextBodies[j].x - nextBodies[i].x;
        const dy = nextBodies[j].y - nextBodies[i].y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        // Softening factor to prevent infinite force at zero distance
        const softening = 5;
        const force = (G * nextBodies[j].mass) / (distSq + softening);

        ax += force * (dx / dist);
        ay += force * (dy / dist);
      }

      nextBodies[i].vx += ax * currentTs;
      nextBodies[i].vy += ay * currentTs;
    }

    // Update positions
    for (let i = 0; i < nextBodies.length; i++) {
      nextBodies[i].x += nextBodies[i].vx * currentTs;
      nextBodies[i].y += nextBodies[i].vy * currentTs;

      // Update trail moved to animate loop for performance
    }

    return nextBodies;
  };

  const animate = () => {
    if (isPlaying) {
      setBodies(prev => {
        let current = prev;
        for (let i = 0; i < stepsPerFrame; i++) {
          current = updatePhysics(current, timeStep);
        }
        
        // Update trails once per frame for all physics steps to save performance
        return current.map(b => {
          const nextTrail = [...b.trail, { x: b.x, y: b.y }];
          if (nextTrail.length > MAX_TRAIL_LENGTH) {
            nextTrail.shift();
          }
          return { ...b, trail: nextTrail };
        });
      });
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, timeStep, stepsPerFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y);
      ctx.scale(zoom, zoom);

      // Draw trails
      if (showTrails) {
        bodies.forEach(body => {
          if (body.trail.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = body.color;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.5;
          ctx.moveTo(body.trail[0].x, body.trail[0].y);
          for (let i = 1; i < body.trail.length; i++) {
            ctx.lineTo(body.trail[i].x, body.trail[i].y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        });
      }

      // Draw bodies
      bodies.forEach(body => {
        ctx.beginPath();
        ctx.arc(body.x, body.y, Math.sqrt(body.mass) * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = body.color;
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = body.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.restore();
    };

    const renderLoop = () => {
      draw();
      requestAnimationFrame(renderLoop);
    };

    const renderId = requestAnimationFrame(renderLoop);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(renderId);
    };
  }, [bodies, zoom, showTrails, offset]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    lastMousePos.current = { x: clientX, y: clientY };
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - lastMousePos.current.x;
    const dy = clientY - lastMousePos.current.y;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved.current = true;
    }

    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    lastMousePos.current = { x: clientX, y: clientY };
  };

  const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDragging && !hasMoved.current) {
      handleClick(e);
    }
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let clientX, clientY;
    if ('changedTouches' in e) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const worldX = (x - canvas.width / 2 - offset.x) / zoom;
    const worldY = (y - canvas.height / 2 - offset.y) / zoom;

    const clickedBodyIndex = bodies.findIndex(body => {
      const dx = body.x - worldX;
      const dy = body.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = Math.sqrt(body.mass) * 1.5;
      return dist <= radius + 10 / zoom;
    });

    if (clickedBodyIndex !== -1) {
      if (bodies.length > 1) {
        setBodies(prev => prev.filter((_, i) => i !== clickedBodyIndex));
      }
    } else if (bodies.length < 3) {
      const newBody: Body = {
        x: worldX,
        y: worldY,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        mass: 50 + Math.random() * 100,
        color: COLORS.find(c => !bodies.some(b => b.color === c)) || COLORS[bodies.length % COLORS.length],
        trail: [],
      };
      setBodies(prev => [...prev, newBody]);
    }
  };

  const updateBody = (index: number, updates: Partial<Body>) => {
    setBodies(prev => {
      const next = [...prev];
      if (index < 0 || index >= next.length) return prev;
      next[index] = { ...next[index], ...updates };
      if ('x' in updates || 'y' in updates) {
        next[index].trail = [];
      }
      return next;
    });
  };

  const resetSimulation = () => {
    setBodies(SCENARIOS.BINARY_STAR.bodies());
    setOffset({ x: 0, y: 0 });
  };

  const loadScenario = (key: keyof typeof SCENARIOS) => {
    setBodies(SCENARIOS[key].bodies());
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    setIsPlaying(true);
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] overflow-hidden font-sans text-white">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        className={`absolute inset-0 w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      />

      {/* UI Overlay */}
      {/* Right Sidebar Control Panel */}
      <div className="absolute top-0 right-0 h-full w-72 p-4 pb-12 z-10 pointer-events-none flex flex-col gap-2 overflow-y-auto overflow-x-hidden transition-all">
        {/* Scenario Presets - Compact */}
        <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-2.5 rounded-2xl border border-white/10 flex flex-col gap-2">
          <h2 className="text-[8px] font-bold uppercase tracking-widest opacity-40 ml-1">Universal Presets</h2>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(SCENARIOS).map(([key, scenario]) => (
              <button
                key={key}
                onClick={() => loadScenario(key as keyof typeof SCENARIOS)}
                className="text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all"
              >
                <div className="text-[9px] font-bold whitespace-nowrap overflow-hidden text-ellipsis opacity-80">{scenario.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title & Core Controls */}
        <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-3 rounded-2xl border border-white/10 flex flex-col gap-2.5">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-lg font-bold tracking-tighter uppercase italic leading-none">
                {bodies.length}-Body System
              </h1>
              <p className="text-[8px] font-mono opacity-30 uppercase tracking-widest mt-0.5">
                Gravitational Dynamics
              </p>
            </div>
            <button
              onClick={() => setShowTrails(!showTrails)}
              className={`p-1.5 rounded-lg transition-all border ${showTrails ? 'bg-white/20 border-white/30' : 'bg-transparent border-white/10 opacity-50'}`}
              title="Toggle Trails"
            >
              <Activity size={12} />
            </button>
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg transition-all border border-white/10 flex items-center justify-center gap-1.5"
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              <span className="text-[9px] uppercase font-bold tracking-tight">{isPlaying ? 'Pause' : 'Resume'}</span>
            </button>
            <button
              onClick={resetSimulation}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg transition-all border border-white/10"
              title="Reset"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        {/* Simulation Settings */}
        <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] uppercase font-mono opacity-50">
                <label>Zoom</label>
                <span>{zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-white h-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] uppercase font-mono opacity-50">
                <label>Time Step</label>
                <span>{timeStep.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.1"
                step="0.001"
                value={timeStep}
                onChange={(e) => setTimeStep(parseFloat(e.target.value))}
                className="w-full accent-white h-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] uppercase font-mono opacity-50">
                <label>Sim Speed</label>
                <span>{stepsPerFrame}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={stepsPerFrame}
                onChange={(e) => setStepsPerFrame(parseInt(e.target.value))}
                className="w-full accent-white h-1"
              />
            </div>
          </div>
        </div>

        {/* Bodies & Mass */}
        <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-3 rounded-2xl border border-white/10 flex flex-col gap-2">
          <h2 className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-1">Dynamics Control</h2>
          <div className="flex flex-col gap-2">
            {bodies.map((body, i) => (
              <div key={i} className="flex flex-col gap-1.5 p-2 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: body.color, boxShadow: `0 0 5px ${body.color}` }}
                    />
                    <span className="text-[9px] font-mono uppercase opacity-40">Body {i + 1}</span>
                  </div>
                  {!isPlaying && (
                    <span className="text-[8px] font-mono opacity-20 uppercase tracking-tighter italic">Manual Mode</span>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[7px] uppercase font-mono opacity-30">Mass</label>
                    <input
                      type="number"
                      value={Math.round(body.mass)}
                      onChange={(e) => updateBody(i, { mass: Math.max(1, parseInt(e.target.value) || 0) })}
                      className="bg-black/30 border border-white/5 rounded px-1 py-0.5 text-[9px] font-mono w-full focus:border-white/20 outline-none transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[7px] uppercase font-mono opacity-30">X Pos</label>
                    <input
                      type="number"
                      value={Math.round(body.x)}
                      disabled={isPlaying}
                      onChange={(e) => updateBody(i, { x: parseInt(e.target.value) || 0 })}
                      className={`bg-black/30 border border-white/5 rounded px-1 py-0.5 text-[9px] font-mono w-full focus:border-white/20 outline-none transition-colors ${isPlaying ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:border-white/10'}`}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[7px] uppercase font-mono opacity-30">Y Pos</label>
                    <input
                      type="number"
                      value={Math.round(body.y)}
                      disabled={isPlaying}
                      onChange={(e) => updateBody(i, { y: parseInt(e.target.value) || 0 })}
                      className={`bg-black/30 border border-white/5 rounded px-1 py-0.5 text-[9px] font-mono w-full focus:border-white/20 outline-none transition-colors ${isPlaying ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:border-white/10'}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Distances */}
        {bodies.length > 1 && (
          <div className="pointer-events-auto bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex flex-col gap-2">
            <h2 className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-1">Proximity (AU)</h2>
            <div className="flex flex-col gap-1.5">
              {(() => {
                const pairs = [];
                for (let i = 0; i < bodies.length; i++) {
                  for (let j = i + 1; j < bodies.length; j++) {
                    const dx = bodies[i].x - bodies[j].x;
                    const dy = bodies[i].y - bodies[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    pairs.push({ i, j, dist });
                  }
                }
                return pairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                    <div className="flex items-center gap-1.5">
                        <div className="flex gap-0.5">
                            <div className="w-1 h-2 rounded-full opacity-60" style={{ backgroundColor: bodies[pair.i].color }} />
                            <div className="w-1 h-2 rounded-full opacity-60" style={{ backgroundColor: bodies[pair.j].color }} />
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

        {/* Info Panel - Simplified */}
        <div className="pointer-events-auto mt-auto bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 mb-1.5 opacity-40">
              <Info size={12} />
              <h3 className="text-[9px] font-bold uppercase tracking-widest">Physics</h3>
          </div>
          <p className="text-[10px] opacity-60 leading-tight font-sans italic">
            Chaotic 3-body simulation using semi-implicit Euler integration.
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        input[type=range] {
          -webkit-appearance: none;
          background: rgba(255, 255, 255, 0.1);
          height: 4px;
          border-radius: 2px;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
        }
      `}} />
    </div>
  );
}
