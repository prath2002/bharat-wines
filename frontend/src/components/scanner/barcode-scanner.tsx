"use client";

import { useEffect, useRef } from "react";
import { useScanner } from "@/hooks/use-scanner";
import { Camera, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive: boolean;
}

export function BarcodeScanner({ onScan, isActive }: BarcodeScannerProps) {
  const { videoRef, isScanning, hasCamera, cameraError, devices, startScanning, stopScanning, switchCamera } = useScanner();
  const lastScannedRef = useRef<{ code: string; time: number } | null>(null);

  useEffect(() => {
    if (isActive && hasCamera) {
      startScanning((code) => {
        const now = Date.now();
        const last = lastScannedRef.current;
        
        // Debounce: prevent same barcode scanning within 2 seconds
        if (!last || last.code !== code || now - last.time > 2000) {
          // Play beep sound
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
          } catch (e) {
            console.error("Audio beep failed", e);
          }
          
          lastScannedRef.current = { code, time: now };
          onScan(code);
        }
      });
    } else {
      stopScanning();
    }
    
    return () => {
      stopScanning();
    };
  }, [isActive, hasCamera, startScanning, stopScanning, onScan]);

  if (hasCamera === false) {
    return (
      <div className="w-full h-full bg-muted/50 flex flex-col items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm font-medium">Camera access denied or unavailable.</p>
        <p className="text-xs opacity-70 mt-1 mb-2">Please use manual entry.</p>
        {cameraError && (
          <p className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded max-w-[80%] text-center">
            {cameraError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-inner group">
      <video 
        ref={videoRef} 
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      
      {/* Viewfinder overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-3/4 h-1/2 max-w-sm max-h-48 border-2 border-white/50 rounded-lg relative">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 -mt-1 -ml-1 rounded-tl" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 -mt-1 -mr-1 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 -mb-1 -ml-1 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 -mb-1 -mr-1 rounded-br" />
            {/* Animated laser line */}
            {isScanning && (
              <div className="w-full h-0.5 bg-green-500/80 shadow-[0_0_8px_2px_rgba(34,197,94,0.6)] absolute top-1/2 animate-scan-laser" />
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {devices.length > 1 && (
          <Button 
            variant="secondary" 
            size="icon" 
            className="rounded-full bg-white/20 hover:bg-white/40 backdrop-blur text-white border-none"
            onClick={switchCamera}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status indicator */}
      <div className="absolute top-4 left-4">
        {isScanning ? (
          <span className="flex items-center text-xs font-medium bg-green-500/20 text-green-400 px-2 py-1 rounded-full backdrop-blur">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
            Scanning
          </span>
        ) : (
          <span className="flex items-center text-xs font-medium bg-gray-500/20 text-gray-300 px-2 py-1 rounded-full backdrop-blur">
            <Camera className="w-3 h-3 mr-1" />
            Paused
          </span>
        )}
      </div>
    </div>
  );
}
