import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function SpiderVerseDiagram({ show, onComplete }: { show: boolean, onComplete: () => void }) {
  const [nodes, setNodes] = useState<{ id: number, x: number, y: number, label: string }[]>([]);

  useEffect(() => {
    if (show) {
      // Generate some random nodes for the web
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const newNodes = [
        { id: 1, x: center.x, y: center.y - 100, label: "Project Created!" },
        { id: 2, x: center.x + 150, y: center.y + 50, label: "Database Sync" },
        { id: 3, x: center.x - 150, y: center.y + 50, label: "Checklist init" },
        { id: 4, x: center.x, y: center.y + 150, label: "Client Assigned" },
        { id: 5, x: center.x - 200, y: center.y - 80, label: "Workflow Active" },
        { id: 6, x: center.x + 200, y: center.y - 80, label: "Ready" },
      ];
      setNodes(newNodes);

      const timer = setTimeout(() => {
        onComplete();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center overflow-hidden mix-blend-screen bg-slate-900/40 backdrop-blur-sm">
      {/* Halftone / Glitch background overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.5, 1, 0] }}
        transition={{ duration: 0.5, times: [0, 0.2, 0.5, 0.8, 1] }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] mix-blend-overlay"
        style={{
          backgroundImage: 'radial-gradient(circle, #ff0055 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          opacity: 0.2
        }}
      />
      
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <filter id="glitch">
            <feOffset dx="4" dy="-2" in="SourceGraphic" result="red-shift" />
            <feColorMatrix in="red-shift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
            <feOffset dx="-4" dy="2" in="SourceGraphic" result="blue-shift" />
            <feColorMatrix in="blue-shift" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
            <feBlend mode="screen" in="red" in2="blue" />
            <feBlend mode="screen" in2="SourceGraphic" />
          </filter>
        </defs>

        {nodes.map((node, i) => {
          return nodes.slice(i + 1).map((target, j) => {
            // Draw lines between some nodes
            if (Math.random() > 0.5) return null;
            return (
              <motion.line
                key={`line-${i}-${j}`}
                x1={node.x}
                y1={node.y}
                x2={target.x}
                y2={target.y}
                stroke="#ff0088"
                strokeWidth="2"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: [0, 1, 0.8] }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                filter="url(#glitch)"
              />
            );
          });
        })}
      </svg>

      {nodes.map((node, i) => (
        <motion.div
          key={node.id}
          className="absolute font-black text-2xl uppercase tracking-tighter"
          style={{ 
            left: node.x, 
            top: node.y,
            transform: 'translate(-50%, -50%)',
            color: i % 2 === 0 ? '#00ffff' : '#ff0055',
            textShadow: '3px 3px 0 #000, -2px -2px 0 #ff00ff'
          }}
          initial={{ scale: 0, opacity: 0, rotate: -20 }}
          animate={{ 
            scale: [0, 1.5, 1], 
            opacity: 1,
            rotate: [Math.random() * -40, Math.random() * 20, Math.random() * -10],
            x: [0, Math.random() * 20 - 10, 0],
            y: [0, Math.random() * 20 - 10, 0]
          }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 10, 
            delay: i * 0.1,
            rotate: {
              repeat: Infinity,
              repeatType: "mirror",
              duration: 0.2
            },
            x: {
              repeat: Infinity,
              repeatType: "mirror",
              duration: 0.15
            },
            y: {
              repeat: Infinity,
              repeatType: "mirror",
              duration: 0.12
            }
          }}
        >
          {node.label}
        </motion.div>
      ))}

      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-black uppercase text-transparent bg-clip-text bg-gradient-to-br from-[#ff0055] to-[#00ffff]"
        style={{
          WebkitTextStroke: '2px white',
          filter: 'drop-shadow(5px 5px 0px #000) drop-shadow(-5px -5px 0px #ff00ff)'
        }}
        initial={{ scale: 0, opacity: 0, rotateZ: 45 }}
        animate={{ scale: 1, opacity: 1, rotateZ: [-10, 10, -5, 5, 0] }}
        transition={{ type: "spring", damping: 12, stiffness: 100 }}
      >
        CREATED
      </motion.div>
    </div>
  );
}
