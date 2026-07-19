"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, File, AlertCircle, Loader2, Camera, X, Receipt } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { uploadBill } from "@/services/bills";

export default function BillUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(selectedFile.type)) {
      setError("Invalid file type. Please upload a JPG, PNG, or PDF file.");
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("File is too large. Maximum size is 20MB.");
      return;
    }
    setFile(selectedFile);
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const capturedFile = new window.File([blob], `bill-${Date.now()}.jpg`, { type: "image/jpeg" });
              validateAndSetFile(capturedFile);
              stopCamera();
            }
          },
          "image/jpeg",
          0.9
        );
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadBill(file);
      router.push("/finance/bills");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to upload file. Please try again.");
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto py-10 px-4"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Upload Purchase Bill</h2>
        <p className="text-muted-foreground mt-2 max-w-prose">
          Photograph or upload a supplier bill. AI reads the totals, discounts, and extra charges, and files it under the right company for the finance team.
        </p>
      </div>

      <Card className="border-border/50 shadow-lg bg-card/60 backdrop-blur-md overflow-hidden">
        <CardContent className="p-6 md:p-10">
          {error && (
            <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!file ? (
            <div
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer space-y-6 ${
                isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Receipt className="h-8 w-8 text-primary" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-foreground">Drop the bill here</h3>
                <p className="text-muted-foreground mt-1">or choose how to add it</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto bg-background/50 backdrop-blur-sm hover:bg-muted/80 z-10 relative"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Browse Files
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto bg-background/50 backdrop-blur-sm hover:bg-muted/80 z-10 relative"
                  onClick={(e) => {
                    e.stopPropagation();
                    startCamera();
                  }}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
              </div>

              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80 flex flex-col md:flex-row justify-center gap-2 md:gap-4">
                <span>Supported: JPG, PNG, PDF</span>
                <span className="hidden md:inline">&bull;</span>
                <span>Max size: 20MB</span>
              </div>
            </div>
          ) : (
            <div className="border border-border/50 rounded-2xl p-8 bg-muted/20">
              <div className="flex flex-col md:flex-row items-center text-center md:text-left gap-6 mb-8">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <File className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden w-full">
                  <h4 className="text-xl font-medium text-foreground truncate">{file.name}</h4>
                  <p className="text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button variant="outline" className="w-full md:w-auto" onClick={() => setFile(null)} disabled={uploading}>
                  Change File
                </Button>
              </div>

              {uploading ? (
                <div className="bg-background/50 rounded-2xl p-8 flex flex-col items-center justify-center border border-border/50 shadow-inner">
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-5" />
                  <h4 className="text-xl font-heading font-bold text-foreground">Sending to AI</h4>
                  <p className="text-muted-foreground text-center max-w-md mt-3 leading-relaxed">
                    The bill is being read for totals, discounts, and charges. You can keep working — it will appear in the bill list as a draft in a few seconds.
                  </p>
                </div>
              ) : (
                <Button
                  className="w-full h-16 text-xl font-bold bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.02] shadow-[0_0_25px_var(--color-primary)] border-0 transition-all active:scale-[0.98]"
                  onClick={handleUpload}
                >
                  Read Bill with AI <span className="ml-3 text-2xl">✨</span>
                </Button>
              )}
            </div>
          )}

          {isCameraOpen && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-4">
              <div className="relative w-full max-w-2xl bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                <Button
                  variant="ghost"
                  className="absolute top-2 right-2 text-white hover:bg-white/20 z-10"
                  size="icon"
                  onClick={stopCamera}
                >
                  <X className="h-6 w-6" />
                </Button>

                <video ref={videoRef} className="w-full h-auto max-h-[70vh] object-cover" playsInline />
                <canvas ref={canvasRef} className="hidden" />

                <div className="p-6 bg-card border-t border-border/50 flex justify-center">
                  <Button
                    size="lg"
                    className="w-full md:w-auto h-14 px-12 rounded-full text-lg shadow-[0_0_20px_var(--color-primary)] bg-primary"
                    onClick={capturePhoto}
                  >
                    <Camera className="mr-2 h-6 w-6" /> Capture Photo
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
