"use client";

import { useState, useEffect } from "react";
import { X, Camera, Keyboard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScanner } from "@/hooks/use-scanner";
import { apiClient } from "@/services/api-client";

interface BarcodeMapperProps {
  productId: string;
  onClose: () => void;
  onMapped: () => void;
}

export function BarcodeMapper({ productId, onClose, onMapped }: BarcodeMapperProps) {
  const [mode, setMode] = useState<"CAMERA" | "MANUAL">("CAMERA");
  const [manualValue, setManualValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { videoRef, isScanning, hasCamera, startScanning, stopScanning } = useScanner();

  useEffect(() => {
    if (mode === "CAMERA" && hasCamera) {
      startScanning((decodedText) => {
        handleMapBarcode(decodedText);
      });
    } else {
      stopScanning();
    }
    
    return () => {
      stopScanning();
    };
  }, [mode, hasCamera, startScanning, stopScanning]);

  const handleMapBarcode = async (barcodeValue: string) => {
    if (!barcodeValue.trim()) return;
    setSubmitting(true);
    setError(null);
    stopScanning(); // Pause scanning while submitting

    try {
      await apiClient.post(`/products/${productId}/barcodes`, {
        barcode_value: barcodeValue,
        format: "UNKNOWN", // We can default or extract format if ZXing provides it
      });

      onMapped();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
      // If camera mode, restart scanning after a brief delay so user can try again
      if (mode === "CAMERA") {
        setTimeout(() => {
          startScanning((text) => handleMapBarcode(text));
        }, 2000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Map Barcode</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md"><X className="h-5 w-5"/></button>
        </div>

        <div className="flex border-b bg-gray-50">
          <button 
            className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${mode === 'CAMERA' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setMode('CAMERA')}
          >
            <Camera className="h-4 w-4"/> Camera Scan
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${mode === 'MANUAL' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            onClick={() => setMode('MANUAL')}
          >
            <Keyboard className="h-4 w-4"/> Manual Entry
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0"/>
              <span>{error}</span>
            </div>
          )}

          {mode === "CAMERA" && (
            <div className="flex flex-col items-center">
              {hasCamera === false ? (
                <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-lg w-full">
                  No camera detected or permission denied.
                </div>
              ) : (
                <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 border-4 border-white/20">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-32 border-2 border-red-500/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                  </div>
                  {submitting && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-medium">Processing...</div>}
                </div>
              )}
              <p className="mt-4 text-sm text-gray-500 text-center">
                Point your camera at the barcode. It will scan automatically.
              </p>
            </div>
          )}

          {mode === "MANUAL" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Barcode Value</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full border rounded-lg p-2.5 text-lg font-mono text-center tracking-wider" 
                  value={manualValue} 
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder="e.g. 890123456789"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleMapBarcode(manualValue);
                  }}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => handleMapBarcode(manualValue)}
                disabled={submitting || !manualValue.trim()}
              >
                {submitting ? 'Saving...' : 'Save Mapping'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
