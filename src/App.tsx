/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Settings2, Info } from 'lucide-react';

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
const MAX_TRAIL_LENGTH = 200;

const COLORS = ['#FF4D4D', '#4D94FF', '#4DFF88', '#FFD700', '#FF00FF', '#00FFFF'];

const generateRandomBodies = (): Body[] => {
  const bodies: Body[] = [];
  for (let i = 0; i < 3; i++) {
    bodies.push({
      x: (Math.random() - 0.5) * 400,
      y: (Math.random() - 0.5) * 400,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      mass: 50 + Math.random() * 100,
      color: COLORS[i % COLORS.length],
      trail: [],
    });
  }
  return bodies;
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bodies, setBodies] = useState<Body[]>(generateRandomBodies());
  const [isPlaying, setIsPlaying] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [timeStep, setTimeStep] = useState(0.05);
  const [stepsPerFrame, setStepsPerFrame] = useState(1);
  const requestRef = useRef<number>(null);

  const updatePhysics = (currentBodies: Body[], currentTs: number) => {
    const nextBodies = currentBodies.map(b => ({ ...b, trail: [...b.trail] }));

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

      // Update trail
      nextBodies[i].trail.push({ x: nextBodies[i].x, y: nextBodies[i].y });
      if (nextBodies[i].trail.length > MAX_TRAIL_LENGTH) {
        nextBodies[i].trail.shift();
      }
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
        return current;
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
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoom, zoom);

      // Draw trails
      if (showTrails) {
        bodies.forEach(body => {
          if (body.trail.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = body.color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.4;
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
  }, [bodies, zoom, showTrails]);

  const resetSimulation = () => {
    setBodies(generateRandomBodies());
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] overflow-hidden font-sans text-white">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-move"
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 p-8 z-10 pointer-events-none w-full flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter uppercase italic mb-1">
            3-Body System
          </h1>
          <p className="text-xs font-mono opacity-50 uppercase tracking-widest">
            Gravitational Dynamics Simulation
          </p>
        </div>

        <div className="pointer-events-auto flex gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all border border-white/10"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={resetSimulation}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all border border-white/10"
            title="Reset"
          >
            <RotateCcw size={20} />
          </button>
          <button
            onClick={() => setShowTrails(!showTrails)}
            className={`p-3 backdrop-blur-md rounded-full transition-all border ${showTrails ? 'bg-white/30 border-white/40' : 'bg-white/10 border-white/10 hover:bg-white/20'}`}
            title="Toggle Trails"
          >
            <Settings2 size={20} />
          </button>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-6">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-mono opacity-50">Zoom Level</label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-24 accent-white"
          />
        </div>

        <div className="h-8 w-[1px] bg-white/10" />

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-mono opacity-50">Time Step ({timeStep.toFixed(3)})</label>
          <input
            type="range"
            min="0.001"
            max="0.1"
            step="0.001"
            value={timeStep}
            onChange={(e) => setTimeStep(parseFloat(e.target.value))}
            className="w-24 accent-white"
          />
        </div>
        
        <div className="h-8 w-[1px] bg-white/10" />

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-mono opacity-50">Sim Speed ({stepsPerFrame}x)</label>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={stepsPerFrame}
            onChange={(e) => setStepsPerFrame(parseInt(e.target.value))}
            className="w-24 accent-white"
          />
        </div>
        
        <div className="h-8 w-[1px] bg-white/10" />

        <div className="flex gap-4">
          {bodies.map((body, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: body.color, boxShadow: `0 0 8px ${body.color}` }} 
              />
              <span className="text-xs font-mono opacity-80">M:{body.mass}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Info Panel */}
      <div className="absolute bottom-8 right-8 z-10">
        <div className="group relative">
          <button className="p-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all">
            <Info size={18} className="opacity-50" />
          </button>
          <div className="absolute bottom-full right-0 mb-4 w-64 p-4 bg-black/80 backdrop-blur-2xl rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <h3 className="text-sm font-bold mb-2">Simulation Details</h3>
            <p className="text-xs opacity-70 leading-relaxed">
              This visualizer uses a semi-implicit Euler integration method to solve the N-body problem. 
              The three-body problem is famously chaotic, meaning small changes in initial conditions 
              lead to vastly different outcomes over time.
            </p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
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
