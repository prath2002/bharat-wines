"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, File, AlertCircle, Loader2 } from "lucide-react";
import { apiClient } from "@/services/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";

export default function TPUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
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
    
    if (selectedFile.size > 20 * 1024 * 1024) { // 20MB
      setError("File is too large. Maximum size is 20MB.");
      return;
    }
    
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await apiClient.post("/tp/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      
      router.push(`/tp/${response.data.id}/review`);
      
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
        <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Upload Transport Permit</h2>
        <p className="text-muted-foreground mt-2">
          Upload an image or PDF of a state transport permit. Our AI will automatically extract the products, quantities, and match them to your catalog.
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
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer group
                ${isDragging ? "border-primary bg-primary/10 scale-[1.02]" : "border-border/50 hover:border-primary/50 hover:bg-muted/30"}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".jpg,.jpeg,.png,.pdf"
              />
              
              <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_20px_var(--color-primary)] transition-all">
                <UploadCloud className="h-10 w-10 text-primary" />
              </div>
              
              <h3 className="text-xl font-heading font-semibold text-foreground mb-2">Drag & Drop your permit here</h3>
              <p className="text-muted-foreground mb-6">or click to browse from your computer</p>
              
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80 flex flex-col md:flex-row justify-center gap-2 md:gap-4">
                <span>Supported: JPG, PNG, PDF</span>
                <span className="hidden md:inline">&bull;</span>
                <span>Max size: 20MB</span>
              </div>
            </div>
          ) : (
            <div className="border border-border/50 rounded-2xl p-8 bg-muted/20">
              <div className="flex flex-col md:flex-row items-center text-center md:text-left gap-6 mb-8">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(124,58,237,0.2)]">
                  <File className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden w-full">
                  <h4 className="text-xl font-medium text-foreground truncate">{file.name}</h4>
                  <p className="text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full md:w-auto"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                >
                  Change File
                </Button>
              </div>
              
              {uploading ? (
                <div className="bg-background/50 rounded-2xl p-8 flex flex-col items-center justify-center border border-border/50 shadow-inner">
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-5" />
                  <h4 className="text-xl font-heading font-bold text-foreground">AI Processing in Progress</h4>
                  <p className="text-muted-foreground text-center max-w-md mt-3 leading-relaxed">
                    Our AI is reading the document via OCR, extracting structured data, and fuzzily matching it against your catalog. This usually takes 5-10 seconds.
                  </p>
                </div>
              ) : (
                <Button 
                  className="w-full h-16 text-xl font-bold bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.02] shadow-[0_0_25px_var(--color-primary)] border-0 transition-all active:scale-[0.98]"
                  onClick={handleUpload}
                >
                  Process with AI <span className="ml-3 text-2xl">✨</span>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
