"use client";

import React, { useEffect, useRef } from "react";
import { usePlaybackStore } from "../../store/usePlaybackStore";

interface EqualizerVisualizerProps {
  active: boolean;
}

export const EqualizerVisualizer: React.FC<EqualizerVisualizerProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const { audioRef, isPlaying } = usePlaybackStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 300;
      canvas.height = canvas.parentElement?.clientHeight || 80;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Particles fallback definition (used when no audio context or CORS block)
    const particles: { x: number; y: number; size: number; speedY: number; color: string }[] = [];
    const colors = ["rgba(139, 92, 246, 0.4)", "rgba(236, 72, 153, 0.3)", "rgba(59, 130, 246, 0.3)"];
    
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 20,
        size: Math.random() * 4 + 2,
        speedY: Math.random() * 1.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Try setting up true Web Audio Analyser
    const setupAudioAnalyser = () => {
      if (!audioRef || audioContextRef.current) return;

      try {
        // We set crossOrigin to anonymous to attempt CORS handshake for audio analyser
        audioRef.crossOrigin = "anonymous";
        
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64; // Low fft for quick, smooth visualizer bars
        
        const source = audioCtx.createMediaElementSource(audioRef);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        sourceRef.current = source;
        console.log("[Visualizer] True Web Audio Analyser successfully mounted.");
      } catch (err) {
        console.warn("[Visualizer] CORS restriction or AudioContext setup blocked. Using beautiful particle fallback.");
      }
    };

    if (active && audioRef) {
      setupAudioAnalyser();
    }

    // Draw frame
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!active || !isPlaying) {
        // Static layout when paused
        ctx.fillStyle = "rgba(139, 92, 246, 0.15)";
        const barWidth = (canvas.width / 20) - 2;
        for (let i = 0; i < 20; i++) {
          const barHeight = Math.sin(i * 0.3) * 10 + 15;
          ctx.fillRect(i * (barWidth + 2), canvas.height - barHeight, barWidth, barHeight);
        }
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      // Check if we can pull real-time frequency data
      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        const barWidth = (canvas.width / bufferLength) - 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = percent * canvas.height * 0.85 + 4;

          // Create a premium dynamic purple gradient for each bar
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
          gradient.addColorStop(0, "rgba(99, 102, 241, 0.8)"); // Indigo
          gradient.addColorStop(1, "rgba(236, 72, 153, 0.8)");  // Pink

          ctx.fillStyle = gradient;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          
          x += barWidth + 1.5;
        }
      } else {
        // --- HIGH FIDELITY PARTICLE WAVE FALLBACK ---
        // Render sleek wave
        const time = Date.now() * 0.004;
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(139, 92, 246, 0.45)";
        ctx.beginPath();
        
        for (let i = 0; i < canvas.width; i++) {
          const y = canvas.height * 0.5 + 
            Math.sin(i * 0.02 + time) * 15 * Math.sin(time * 0.5) +
            Math.cos(i * 0.008 + time * 1.5) * 8;
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();

        // Render rising glowing bubbles
        particles.forEach(p => {
          p.y -= p.speedY * 1.2;
          if (p.y < 0) {
            p.y = canvas.height + Math.random() * 20;
            p.x = Math.random() * canvas.width;
          }
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.shadowBlur = 0; // Reset
        });
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioRef, isPlaying, active]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full max-h-[80px] opacity-75 pointer-events-none rounded-lg"
    />
  );
};
