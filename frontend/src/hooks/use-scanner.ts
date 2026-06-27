import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader, Result } from '@zxing/library';

export function useScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCamera(false);
      setCameraError("Media devices API not available. Make sure you are using HTTPS or localhost.");
      return;
    }

    // 1. First explicitly request camera permission so we get real device IDs and labels
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        // 2. Stop the initial stream, we just needed it for permissions
        stream.getTracks().forEach(track => track.stop());
        
        // 3. Now enumerate devices (labels and IDs will be available)
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        setHasCamera(videoDevices.length > 0);
        
        if (videoDevices.length > 0) {
          const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          setCurrentDeviceId(backCamera ? backCamera.deviceId : videoDevices[0].deviceId);
        }
      })
      .catch((err) => {
        console.error("Camera access error:", err);
        setHasCamera(false);
        if (err.name === 'NotAllowedError') {
          setCameraError("Camera permission was denied.");
        } else if (err.name === 'NotFoundError') {
          setCameraError("No camera device was found on this computer.");
        } else {
          setCameraError(err.message || "Failed to access camera.");
        }
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = useCallback(async (onDetect: (text: string) => void) => {
    // If currentDeviceId is not yet set, we cannot start
    if (!videoRef.current || !currentDeviceId) return;
    
    try {
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }
      setIsScanning(true);
      
      readerRef.current.decodeFromVideoDevice(
        currentDeviceId, 
        videoRef.current, 
        (result: Result, err: any) => {
          if (result) {
            onDetect(result.getText());
          }
          if (err && !(err.name === 'NotFoundException')) {
            console.error(err);
          }
        }
      );
    } catch (err) {
      console.error("Failed to start scanner:", err);
      setIsScanning(false);
    }
  }, [currentDeviceId]);

  const stopScanning = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.reset();
    }
    setIsScanning(false);
  }, []);

  const switchCamera = useCallback(() => {
    if (devices.length < 2) return;
    stopScanning();
    
    setCurrentDeviceId(prevId => {
      const currentIndex = devices.findIndex(d => d.deviceId === prevId);
      const nextIndex = (currentIndex + 1) % devices.length;
      return devices[nextIndex].deviceId;
    });
  }, [devices, stopScanning]);

  return {
    videoRef,
    isScanning,
    hasCamera,
    cameraError,
    devices,
    currentDeviceId,
    startScanning,
    stopScanning,
    switchCamera
  };
}
