"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertTriangle, XCircle, ArrowLeft, AlertCircle, PlusCircle, Edit2, Save, Maximize2, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function TPReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [catalog, setCatalog] = useState<any[]>([]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    size_ml: "",
    mrp: "",
    category: "IMFL",
    scm_code: "",
    case_size: "12",
    purchase_price: ""
  });

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [isSavingLine, setIsSavingLine] = useState(false);

  const getFileUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith('http')) return url;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const baseUrl = apiUrl.replace('/api/v1', '');
    return `${baseUrl}${url}`;
  };

  const startEditing = (line: any) => {
    setEditingLineId(line.id);
    setEditValues({
      total_bottles: line.total_bottles,
      extracted_mrp: line.extracted_mrp,
      batch_number: line.batch_number || ""
    });
  };

  const saveLine = async (lineId: string) => {
    setIsSavingLine(true);
    try {
      await apiClient.put(`/tp/receipts/${params.id}/lines/${lineId}`, editValues);
      setEditingLineId(null);
      await fetchReceipt();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update line");
    } finally {
      setIsSavingLine(false);
    }
  };

  useEffect(() => {
    fetchReceipt();
    fetchCatalog();
  }, [params.id]);

  const fetchReceipt = async () => {
    try {
      const response = await apiClient.get(`/tp/receipts/${params.id}`);
      const data = response.data;
      setReceipt(data);
      
      if (data.status === "PROCESSING") {
        setTimeout(fetchReceipt, 2000);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError("Failed to load receipt. It may not exist.");
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const response = await apiClient.get("/products");
      setCatalog(response.data.data);
    } catch (err) {
      console.error("Failed to fetch catalog", err);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setError(null);
    try {
      await apiClient.post(`/tp/receipts/${params.id}/approve`);
      router.push("/tp");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to approve receipt");
      setApproving(false);
    }
  };

  const handleReject = async () => {
    try {
      await apiClient.post(`/tp/receipts/${params.id}/reject`);
      router.push("/tp");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to reject receipt");
    }
  };

  const handleMapProduct = async (lineId: string, productId: string) => {
    try {
      await apiClient.put(`/tp/receipts/${params.id}/lines/${lineId}`, {
        product_id: productId
      });
      await fetchReceipt();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to map product");
    }
  };

  const handleCreateProduct = async () => {
    setCreatingProduct(true);
    try {
      const productData = {
        name: newProductForm.name,
        category: newProductForm.category,
        size_ml: parseInt(newProductForm.size_ml) || 0,
        mrp: parseFloat(newProductForm.mrp) || 0,
        scm_code: newProductForm.scm_code,
        case_size: parseInt(newProductForm.case_size) || 12,
        purchase_price: newProductForm.purchase_price ? parseFloat(newProductForm.purchase_price) : null
      };
      
      const productRes = await apiClient.post("/products", productData);
      const newProductId = productRes.data.id;
      
      await apiClient.put(`/tp/receipts/${params.id}/lines/${currentLineId}`, {
        product_id: newProductId
      });
      
      await fetchCatalog();
      await fetchReceipt();
      
      setIsProductModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create product");
    } finally {
      setCreatingProduct(false);
    }
  };

  const openCreateModal = (line: any) => {
    setCurrentLineId(line.id);
    setNewProductForm({
      name: line.extracted_product_name,
      size_ml: line.extracted_size?.replace(/[^0-9]/g, '') || "",
      mrp: line.extracted_mrp?.toString() || "",
      category: "IMFL",
      scm_code: "",
      case_size: "12",
      purchase_price: ""
    });
    setIsProductModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
          <Loader2 className="h-16 w-16 text-primary animate-spin mb-6 relative z-10" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">AI is analyzing the document...</h2>
        <p className="text-muted-foreground mt-2 max-w-md text-center">Extracting products, quantities, and cross-referencing with your master catalog via fuzzy matching.</p>
      </div>
    );
  }

  if (error && !receipt) {
    return (
      <div className="p-8 text-center text-destructive min-h-[60vh] flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8">
        <div className="bg-destructive/10 p-6 rounded-full mb-6">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Error Loading Document</h2>
        <p className="text-muted-foreground mb-8 max-w-md">{error}</p>
        <Link href="/tp">
          <Button variant="outline">Return to TP Dashboard</Button>
        </Link>
      </div>
    );
  }

  const allLinesMatched = receipt.lines.every((l: any) => l.product_id !== null);
  const hasMRPMismatch = receipt.lines.some((l:any) => {
    const p = catalog.find(c => c.id === l.product_id);
    return p && l.extracted_mrp && p.mrp !== l.extracted_mrp;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[90rem] mx-auto space-y-6 pb-32 px-4 xl:px-8 font-sans"
    >
      {/* Header & Metadata Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-start gap-4">
          <Link href="/tp" className="mt-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-2">Review Transport Permit</h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium uppercase tracking-wider text-[11px]">TP Number</span>
                <span className="font-semibold text-foreground bg-muted/30 px-2 py-0.5 rounded-md font-mono">{receipt.tp_number}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium uppercase tracking-wider text-[11px]">Date</span>
                <span className="font-semibold text-foreground">{receipt.tp_date}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium uppercase tracking-wider text-[11px]">Supplier</span>
                <span className="font-semibold text-foreground">{receipt.supplier_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium uppercase tracking-wider text-[11px]">Status</span>
                <Badge className={
                  receipt.status === 'DRAFT' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 px-3' 
                  : 'bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20 px-3'
                }>
                  {receipt.status === 'DRAFT' ? 'Review Required' : receipt.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive mb-6">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="font-bold">Cannot Approve</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Source Document */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-md sticky top-6 overflow-hidden rounded-2xl">
            <CardHeader className="border-b border-border/40 bg-muted/10 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-foreground text-lg font-heading">Source Document</CardTitle>
              <a href={getFileUrl(receipt.file_url)} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex items-center text-sm font-medium">
                <Maximize2 className="h-4 w-4 mr-1.5" /> Full Screen
              </a>
            </CardHeader>
            <CardContent className="p-0">
               <div className="w-full aspect-[1/1.3] bg-muted/20 flex items-center justify-center relative group">
                  <iframe 
                    src={getFileUrl(receipt.file_url)} 
                    title="TP File" 
                    className="w-full h-full border-0" 
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px] pointer-events-none">
                    <Button variant="outline" className="border-white/20 bg-black/50 text-white hover:bg-white hover:text-black transition-colors pointer-events-auto rounded-full px-6" onClick={() => window.open(getFileUrl(receipt.file_url), '_blank')}>
                      <Maximize2 className="h-4 w-4 mr-2" /> View Original
                    </Button>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Line Items List */}
        <div className="lg:col-span-7 space-y-4">
          <AnimatePresence>
            {hasMRPMismatch && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <Alert className="bg-amber-500/5 border-amber-500/30 rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <AlertTitle className="text-amber-500 font-bold">MRP Mismatch Detected</AlertTitle>
                  <AlertDescription className="text-amber-500/80 mt-1 leading-relaxed">
                    Some items have an MRP different from your master catalog. Approving will require an <strong className="text-amber-500 font-semibold">MRP Change Request</strong> for management review.
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mb-2 mt-1">
            <h3 className="text-lg font-heading font-bold text-foreground">Extracted Line Items</h3>
            <span className="text-sm text-muted-foreground font-medium">{receipt.lines.length} items found</span>
          </div>

          <div className="space-y-4">
            {receipt.lines.map((line: any, index: number) => {
              const matchedProd = catalog.find(c => c.id === line.product_id);
              const isMismatch = matchedProd && line.extracted_mrp && matchedProd.mrp !== line.extracted_mrp;
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={line.id} 
                >
                  <Card className={`border overflow-hidden shadow-sm transition-all duration-300 ${isMismatch ? 'border-amber-500/40 bg-amber-500/[0.02]' : 'border-border/40 bg-card/60 backdrop-blur-md hover:border-primary/30 hover:shadow-md hover:bg-card/80'}`}>
                    <div className="p-5">
                      {/* Top Row: Extracted Info & Warning */}
                      <div className="flex items-start justify-between mb-4 gap-4">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-foreground leading-tight">{line.extracted_product_name}</h4>
                          <div className="flex items-center gap-3 mt-2">
                            {line.extracted_size && (
                              <Badge variant="outline" className="bg-background text-[11px] font-mono rounded-md text-muted-foreground">
                                {line.extracted_size}
                              </Badge>
                            )}
                            {line.extracted_scm_code && (
                              <span className="text-xs text-muted-foreground font-mono flex items-center">
                                <span className="uppercase tracking-wider text-[10px] mr-1 opacity-70">SCM:</span> {line.extracted_scm_code}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Right side: MRP & Qty Display (when not editing) */}
                        {!editingLineId || editingLineId !== line.id ? (
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center justify-end gap-4 mb-1">
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Qty</span>
                                <span className="text-lg font-bold text-foreground">+{line.total_bottles}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">MRP</span>
                                <span className={`text-lg font-bold ${isMismatch ? 'text-amber-500' : 'text-foreground'}`}>₹{line.extracted_mrp}</span>
                              </div>
                            </div>
                            {isMismatch && (
                              <div className="flex items-center justify-end text-amber-500 text-xs mt-1">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Catalog: ₹{matchedProd.mrp}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {/* Middle: Data Entry / Edit Mode */}
                      {editingLineId === line.id && (
                        <div className="bg-muted/30 p-4 rounded-xl border border-border/50 mb-4 grid grid-cols-3 gap-4 animate-in fade-in zoom-in-95">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Batch Number</Label>
                            <Input 
                              value={editValues.batch_number} 
                              onChange={e => setEditValues({...editValues, batch_number: e.target.value})} 
                              className="h-9 bg-background focus:ring-primary/50"
                              placeholder="Optional"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Quantity (+)</Label>
                            <Input 
                              type="number"
                              value={editValues.total_bottles} 
                              onChange={e => setEditValues({...editValues, total_bottles: e.target.value})} 
                              className="h-9 font-bold bg-background focus:ring-primary/50"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">MRP (₹)</Label>
                            <Input 
                              type="number"
                              value={editValues.extracted_mrp} 
                              onChange={e => setEditValues({...editValues, extracted_mrp: e.target.value})} 
                              className="h-9 font-bold bg-background focus:ring-primary/50"
                            />
                          </div>
                        </div>
                      )}

                      <div className="h-px bg-border/40 w-full my-4"></div>

                      {/* Bottom Row: Mapping & Actions */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 max-w-md">
                          {line.product_id ? (
                            <div className="flex items-center p-2 rounded-lg bg-primary/5 border border-primary/10">
                              <CheckCircle className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{matchedProd?.name || 'Loading...'}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{matchedProd?.size_ml}ml • {matchedProd?.category}</p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                onClick={() => handleMapProduct(line.id, "")}
                                title="Change mapping"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Select onValueChange={(val: any) => { if (val) handleMapProduct(line.id, val as string); }}>
                                <SelectTrigger className="w-full h-10 text-sm bg-background border-border/50 focus:ring-primary/50 transition-all rounded-lg">
                                  <div className="flex items-center text-muted-foreground">
                                    <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                                    <SelectValue placeholder="Map to catalog product..." />
                                  </div>
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  {catalog.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name} <span className="text-muted-foreground font-mono ml-2 text-xs">({c.size_ml}ml)</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button 
                                variant="outline" 
                                className="h-10 px-3 border-primary/30 text-primary hover:bg-primary/10 transition-colors flex-shrink-0 rounded-lg"
                                onClick={() => openCreateModal(line)}
                              >
                                <PlusCircle className="h-4 w-4 mr-1.5" /> New
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Edit Actions */}
                        <div className="flex items-center gap-2">
                          {editingLineId === line.id ? (
                            <>
                              <Button variant="ghost" className="h-9 px-3 rounded-lg text-muted-foreground" onClick={() => setEditingLineId(null)}>Cancel</Button>
                              <Button className="h-9 px-4 rounded-lg bg-primary text-primary-foreground shadow-[0_0_15px_var(--color-primary)] opacity-90 hover:opacity-100" onClick={() => saveLine(line.id)} disabled={isSavingLine}>
                                {isSavingLine ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-9 px-3 text-muted-foreground hover:text-foreground rounded-lg bg-muted/30" onClick={() => startEditing(line)}>
                              <Edit2 className="h-4 w-4 mr-2" /> Edit Details
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Action Bar */}
      {receipt.status === 'DRAFT' && (
        <motion.div 
          initial={{ y: 100 }} 
          animate={{ y: 0 }} 
          className="fixed bottom-0 left-0 right-0 z-40 p-6 pointer-events-none"
        >
          <div className="max-w-[90rem] mx-auto flex justify-end">
            <div className="bg-card/90 backdrop-blur-xl p-3 pl-6 border border-border/50 rounded-full shadow-[0_10px_50px_rgba(0,0,0,0.5)] flex items-center gap-6 pointer-events-auto">
              
              <div className="text-sm font-medium text-muted-foreground mr-2">
                {allLinesMatched ? (
                  <span className="flex items-center text-green-500">
                    <CheckCircle className="h-4 w-4 mr-1.5" /> All mapped
                  </span>
                ) : (
                  <span className="flex items-center text-amber-500">
                    <AlertCircle className="h-4 w-4 mr-1.5" /> Missing mappings
                  </span>
                )}
              </div>

              <div className="h-8 w-px bg-border/50 hidden sm:block"></div>

              <Button 
                variant="ghost" 
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-semibold px-4 rounded-full"
                onClick={handleReject}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Reject & Delete
              </Button>
              <Button 
                className="h-12 px-8 font-bold text-base rounded-full bg-gradient-to-r from-primary to-primary/80 hover:scale-105 active:scale-95 shadow-[0_0_25px_var(--color-primary)] border-0 disabled:opacity-50 transition-all text-white"
                disabled={!allLinesMatched || approving}
                onClick={handleApprove}
              >
                {approving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                Approve & Update Inventory
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Create Product Modal */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-border/50 shadow-2xl bg-card rounded-2xl">
          <DialogHeader className="p-6 border-b border-border/50 bg-muted/10">
            <DialogTitle className="text-xl font-heading font-bold text-foreground">Create New Product</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              Add a new product to your master catalog and automatically map it.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Name</Label>
              <Input 
                id="name" 
                value={newProductForm.name} 
                onChange={e => setNewProductForm({...newProductForm, name: e.target.value})} 
                className="bg-background focus-visible:ring-primary/50" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</Label>
                <Select value={newProductForm.category} onValueChange={(v: any) => setNewProductForm({...newProductForm, category: v || "IMFL"})}>
                  <SelectTrigger className="bg-background focus:ring-primary/50">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMFL">IMFL</SelectItem>
                    <SelectItem value="BEER">Beer</SelectItem>
                    <SelectItem value="WINE">Wine</SelectItem>
                    <SelectItem value="BREEZER">Breezer / RTD</SelectItem>
                    <SelectItem value="CL">CL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="size" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Size (ML)</Label>
                <Input 
                  id="size" 
                  type="number"
                  value={newProductForm.size_ml} 
                  onChange={e => setNewProductForm({...newProductForm, size_ml: e.target.value})} 
                  className="bg-background focus-visible:ring-primary/50" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="mrp" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">MRP (₹)</Label>
                <Input 
                  id="mrp" 
                  type="number"
                  value={newProductForm.mrp} 
                  onChange={e => setNewProductForm({...newProductForm, mrp: e.target.value})} 
                  className="bg-background focus-visible:ring-primary/50" 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="case_size" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Case Size (Qty)</Label>
                <Input 
                  id="case_size" 
                  type="number"
                  value={newProductForm.case_size} 
                  onChange={e => setNewProductForm({...newProductForm, case_size: e.target.value})} 
                  className="bg-background focus-visible:ring-primary/50" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="purchase_price" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchase Price (₹)</Label>
                <Input 
                  id="purchase_price" 
                  type="number"
                  value={newProductForm.purchase_price} 
                  onChange={e => setNewProductForm({...newProductForm, purchase_price: e.target.value})} 
                  className="bg-background focus-visible:ring-primary/50" 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scm_code" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SCM Code</Label>
                <Input 
                  id="scm_code" 
                  value={newProductForm.scm_code} 
                  onChange={e => setNewProductForm({...newProductForm, scm_code: e.target.value})} 
                  className="bg-background font-mono focus-visible:ring-primary/50" 
                  placeholder="Unique identifier"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 border-t border-border/50 bg-muted/5 flex sm:justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsProductModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} disabled={creatingProduct || !newProductForm.name || !newProductForm.scm_code} className="shadow-[0_0_10px_var(--color-primary)]">
              {creatingProduct ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
              Save & Map
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
