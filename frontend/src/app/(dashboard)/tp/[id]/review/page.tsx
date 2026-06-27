"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertTriangle, XCircle, ArrowLeft, AlertCircle, PlusCircle, Edit2, Save } from "lucide-react";
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
    case_size: "12"
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
        case_size: parseInt(newProductForm.case_size) || 12
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
      case_size: "12"
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
      className="max-w-[90rem] mx-auto space-y-6 pb-24 px-4 xl:px-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4">
        <Link href="/tp">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hidden md:flex">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/tp" className="md:hidden text-muted-foreground mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-foreground">Review Transport Permit</h2>
            <Badge className={
              receipt.status === 'DRAFT' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20' 
              : 'bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20'
            }>
              {receipt.status === 'DRAFT' ? 'Review Required' : receipt.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1.5 text-sm md:text-base">Please verify the AI extraction before finalizing into inventory.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Metadata & Document */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-md">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <CardTitle className="text-foreground text-lg flex items-center">
                Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">TP Number</div>
                  <div className="font-medium text-foreground">{receipt.tp_number}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Date</div>
                  <div className="font-medium text-foreground">{receipt.tp_date}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Supplier Name</div>
                  <div className="font-medium text-foreground">{receipt.supplier_name}</div>
                </div>
              </div>
              
              {receipt.extracted_data && (
                <div className="space-y-4">
                  <div className="h-px w-full bg-border/50 my-4" />
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">All Extracted Data</div>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 overflow-x-auto">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                      {JSON.stringify(receipt.extracted_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-md sticky top-6">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-foreground text-lg">Source Document</CardTitle>
              <a href={getFileUrl(receipt.file_url)} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 text-xs font-semibold uppercase tracking-wider transition-colors">
                Open Full
              </a>
            </CardHeader>
            <CardContent className="p-0">
               <div className="w-full aspect-[1/1.4] bg-muted/30 flex items-center justify-center overflow-hidden relative group">
                  <iframe 
                    src={getFileUrl(receipt.file_url)} 
                    title="TP File" 
                    className="w-full h-full border-0" 
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm pointer-events-none">
                    <Button variant="outline" className="border-white/20 bg-black/50 text-white hover:bg-white hover:text-black transition-colors pointer-events-auto" onClick={() => window.open(getFileUrl(receipt.file_url), '_blank')}>
                      View Document
                    </Button>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Line Items */}
        <div className="lg:col-span-8 space-y-6">
          
          <AnimatePresence>
            {hasMRPMismatch && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <Alert className="bg-destructive/5 border-destructive/20 shadow-[0_4px_20px_rgba(239,68,68,0.1)]">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <AlertTitle className="text-destructive font-bold">MRP Mismatch Detected</AlertTitle>
                  <AlertDescription className="text-destructive/80 mt-1 leading-relaxed">
                    The AI detected an MRP on this permit that differs from your master catalog. Approving this receipt will automatically create an <strong className="text-destructive">MRP Change Request</strong> for management review.
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <Card className="border-border/50 shadow-md bg-card/80 backdrop-blur-md overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <CardTitle className="text-foreground text-lg">Extracted Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-4 w-1/3">Extracted Details</th>
                    <th className="px-5 py-4 w-1/4">Catalog Mapping</th>
                    <th className="px-5 py-4 text-center">Batch</th>
                    <th className="px-5 py-4 text-right">Qty</th>
                    <th className="px-5 py-4 text-right">MRP</th>
                    <th className="px-5 py-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {receipt.lines.map((line: any) => {
                    const matchedProd = catalog.find(c => c.id === line.product_id);
                    const isMismatch = matchedProd && line.extracted_mrp && matchedProd.mrp !== line.extracted_mrp;
                    
                    return (
                      <tr key={line.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{line.extracted_product_name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {line.extracted_size && (
                              <Badge variant="secondary" className="bg-secondary/50 text-[10px] px-1.5 py-0 font-mono">
                                {line.extracted_size}
                              </Badge>
                            )}
                            {line.extracted_scm_code && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                SCM: {line.extracted_scm_code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {line.product_id ? (
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{matchedProd?.name || 'Loading...'}</span>
                                <span className="text-[11px] text-muted-foreground font-mono">{matchedProd?.size_ml}ml</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors ml-auto opacity-0 group-hover:opacity-100"
                                onClick={() => handleMapProduct(line.id, "")}
                                title="Unmap product"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <Select onValueChange={(val: any) => { if (val) handleMapProduct(line.id, val as string); }}>
                                <SelectTrigger className="w-full h-9 text-xs bg-background border-border/50 focus:ring-primary/50 shadow-sm transition-shadow">
                                  <SelectValue placeholder="Select Product..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  {catalog.map(c => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">
                                      {c.name} <span className="text-muted-foreground font-mono ml-1">({c.size_ml}ml)</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-2">
                                <div className="h-px bg-border/50 flex-1"></div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Or</span>
                                <div className="h-px bg-border/50 flex-1"></div>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs w-full border-primary/30 text-primary hover:bg-primary/10 shadow-sm transition-colors"
                                onClick={() => openCreateModal(line)}
                              >
                                <PlusCircle className="h-3 w-3 mr-1.5" /> Create New
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {editingLineId === line.id ? (
                            <Input 
                              value={editValues.batch_number} 
                              onChange={e => setEditValues({...editValues, batch_number: e.target.value})} 
                              className="h-8 text-xs w-24 mx-auto"
                              placeholder="Batch"
                            />
                          ) : (
                            <span className="font-mono text-xs">{line.batch_number || "-"}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {editingLineId === line.id ? (
                            <Input 
                              type="number"
                              value={editValues.total_bottles} 
                              onChange={e => setEditValues({...editValues, total_bottles: e.target.value})} 
                              className="h-8 text-xs w-16 ml-auto"
                            />
                          ) : (
                            <span className="font-bold text-foreground text-lg">+{line.total_bottles}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {editingLineId === line.id ? (
                            <Input 
                              type="number"
                              value={editValues.extracted_mrp} 
                              onChange={e => setEditValues({...editValues, extracted_mrp: e.target.value})} 
                              className="h-8 text-xs w-20 ml-auto"
                            />
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <span className={`font-bold ${isMismatch ? "text-destructive" : "text-foreground"}`}>
                                ₹{line.extracted_mrp}
                              </span>
                              {isMismatch && (
                                <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 border-destructive/30 text-destructive bg-destructive/5 line-through">
                                  DB: ₹{matchedProd.mrp}
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {editingLineId === line.id ? (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => saveLine(line.id)} disabled={isSavingLine}>
                              {isSavingLine ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all" onClick={() => startEditing(line)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Action Bar */}
      {receipt.status === 'DRAFT' && (
        <motion.div 
          initial={{ y: 100 }} 
          animate={{ y: 0 }} 
          className="fixed bottom-0 left-0 right-0 z-40 p-4 pointer-events-none"
        >
          <div className="max-w-[90rem] mx-auto flex justify-end">
            <div className="bg-background/80 backdrop-blur-xl p-4 border border-border/50 rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.4)] flex items-center gap-4 pointer-events-auto">
              <Button variant="ghost" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-semibold px-6">
                Reject & Delete
              </Button>
              <Button 
                className="h-12 px-8 font-bold text-base bg-gradient-to-r from-primary to-primary/80 hover:scale-105 active:scale-95 shadow-[0_0_20px_var(--color-primary)] border-0 disabled:opacity-50 transition-all"
                disabled={!allLinesMatched || approving}
                onClick={handleApprove}
              >
                {approving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                {allLinesMatched ? "Approve & Update Inventory" : "Please Map All Products First"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Create Product Modal */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-border/50 shadow-2xl bg-card">
          <DialogHeader className="p-6 border-b border-border/50 bg-muted/20">
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
          <DialogFooter className="p-6 border-t border-border/50 bg-muted/10 flex sm:justify-end gap-3">
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
