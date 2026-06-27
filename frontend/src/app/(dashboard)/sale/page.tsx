"use client";

import { useState, useCallback } from "react";
import { BarcodeScanner } from "@/components/scanner/barcode-scanner";
import { ProductResolver, ResolvedProduct } from "@/components/scanner/product-resolver";
import { QuantityInput } from "@/components/scanner/quantity-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/services/api-client";
import { ShoppingCart, Undo2, CheckCircle2, Loader2, X, ScanLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SessionMovement {
  id: string;
  productName: string;
  quantity: number;
  time: Date;
  isReversed: boolean;
}

export default function SalePage() {
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<ResolvedProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionMovement[]>([]);
  const [lastSuccessToast, setLastSuccessToast] = useState<string | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(true);

  const handleScan = (code: string) => {
    if (!activeProduct) {
      setScannedBarcode(code);
      setQuantity(1);
      setLastSuccessToast(null);
    }
  };

  const handleProductResolved = useCallback((product: ResolvedProduct | null) => {
    setActiveProduct(product);
    if (!product) {
      setIsScannerActive(false);
    } else {
      setIsScannerActive(false);
    }
  }, []);

  const clearCurrentScan = () => {
    setScannedBarcode(null);
    setActiveProduct(null);
    setIsScannerActive(true);
    setLastSuccessToast(null);
  };

  const handleConfirmSale = async () => {
    if (!activeProduct) return;
    
    setIsSubmitting(true);
    try {
      const res = await apiClient.post("/movements", {
        product_id: activeProduct.id,
        movement_type: "SALE",
        quantity: quantity,
        notes: "POS Sale"
      });
      
      const movementId = res.data.id;
      
      setSessionHistory(prev => [
        {
          id: movementId,
          productName: activeProduct.name,
          quantity: quantity,
          time: new Date(),
          isReversed: false
        },
        ...prev
      ].slice(0, 10));
      
      setLastSuccessToast(`Sold ${quantity}x ${activeProduct.name}`);
      
      setScannedBarcode(null);
      setActiveProduct(null);
      setQuantity(1);
      setIsScannerActive(true);
      
      setTimeout(() => setLastSuccessToast(null), 3000);
      
    } catch (err: any) {
      alert("Failed to record sale: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = async (movementId: string) => {
    const movementToUndo = sessionHistory.find(m => m.id === movementId);
    if (!movementToUndo || movementToUndo.isReversed) return;
    
    if (!confirm(`Are you sure you want to undo the sale of ${movementToUndo.quantity}x ${movementToUndo.productName}?`)) return;

    try {
      alert("Undo requires fetching the movement details to create a reverse RETURN. (Feature coming soon!)");
    } catch (err) {
      alert("Failed to undo sale");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background max-w-3xl mx-auto md:py-6 md:px-4">
      <div className="flex-1 overflow-y-auto pb-24 md:pb-0 px-4 py-4 md:px-0 space-y-4">
        
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-heading font-bold flex items-center text-foreground">
            <div className="p-2 bg-primary/20 rounded-lg mr-3 shadow-[0_0_10px_var(--color-primary)] border border-primary/20">
              <ScanLine className="h-5 w-5 text-primary" /> 
            </div>
            Scan Sale
          </h1>
          <Button variant="outline" size="sm" onClick={() => setIsScannerActive(!isScannerActive)} className="rounded-full shadow-sm">
            {isScannerActive ? "Pause Scanner" : "Resume Scanner"}
          </Button>
        </div>

        {/* Scanner Component Wrapper */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-black rounded-2xl overflow-hidden shadow-xl border border-white/10 aspect-square md:aspect-video"
        >
           <BarcodeScanner onScan={handleScan} isActive={isScannerActive} />
           
           {/* Success Toast Overlay */}
           <AnimatePresence>
             {lastSuccessToast && (
               <motion.div 
                 initial={{ opacity: 0, y: -20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.9 }}
                 className="absolute top-4 left-0 right-0 flex justify-center z-50"
               >
                 <div className="bg-primary/90 backdrop-blur-md border border-primary text-primary-foreground px-4 py-2.5 rounded-full font-medium shadow-[0_4px_20px_var(--color-primary)] flex items-center text-sm">
                   <CheckCircle2 className="w-5 h-5 mr-2" />
                   {lastSuccessToast}
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </motion.div>

        {!scannedBarcode && isScannerActive && (
          <div className="text-center p-4 text-muted-foreground text-sm font-medium animate-pulse">
            Point camera at a barcode to scan automatically.
          </div>
        )}

        {/* Product Resolution & Confirmation Area */}
        <AnimatePresence>
          {scannedBarcode && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-4"
            >
              <div className="relative">
                <ProductResolver 
                  barcode={scannedBarcode} 
                  onResolved={handleProductResolved} 
                />
                <button 
                  onClick={clearCurrentScan}
                  className="absolute -top-3 -right-3 bg-muted/80 backdrop-blur border border-border/50 hover:bg-muted rounded-full p-1.5 shadow-md transition-colors z-10"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
              
              {activeProduct && (
                <Card className="border-primary/30 shadow-[0_4px_30px_rgba(124,58,237,0.1)]">
                  <CardContent className="p-5 flex flex-col space-y-5">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Adjust Quantity</p>
                      <QuantityInput 
                        value={quantity} 
                        onChange={setQuantity} 
                        min={1} 
                        max={Math.max(activeProduct.current_stock || 1, 9999)} 
                      />
                      
                      {activeProduct.current_stock < quantity && (
                        <p className="text-sm text-destructive font-medium bg-destructive/10 px-3 py-1 rounded-full border border-destructive/20">
                          Warning: Selling more than current stock ({activeProduct.current_stock})
                        </p>
                      )}
                    </div>
                    
                    <button 
                      className="w-full h-16 text-xl font-bold bg-gradient-to-br from-primary to-primary/80 hover:to-primary text-primary-foreground rounded-2xl shadow-[0_0_25px_rgba(124,58,237,0.5)] transition-all active:scale-[0.98] flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                      onClick={handleConfirmSale}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-7 h-7 animate-spin" />
                      ) : (
                        <span className="flex items-center">
                          Confirm Sale <span className="mx-3 opacity-50 font-normal">|</span> ₹{(activeProduct.mrp * quantity).toFixed(2)}
                        </span>
                      )}
                    </button>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Session History */}
        {sessionHistory.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">Session History</h3>
            <Card className="overflow-hidden border-border/50">
              <ul className="divide-y divide-border/50">
                {sessionHistory.map((item) => (
                  <li key={item.id} className="p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col">
                      <span className={`font-medium text-sm ${item.isReversed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.quantity}x {item.productName}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        {item.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                      </span>
                    </div>
                    {!item.isReversed && (
                      <Button variant="ghost" size="sm" onClick={() => handleUndo(item.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2.5 rounded-lg transition-colors">
                        <Undo2 className="w-4 h-4 mr-1.5" /> Undo
                      </Button>
                    )}
                    {item.isReversed && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-2 py-1 rounded-md border border-destructive/20">Reversed</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}
        
      </div>
    </div>
  );
}
