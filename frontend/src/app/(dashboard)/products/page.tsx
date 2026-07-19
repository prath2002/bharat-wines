"use client";

import { useState, useEffect } from "react";
import { Plus, Search, MoreVertical, Edit, Package, Archive, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { apiClient } from "@/services/api-client";
import { motion, AnimatePresence } from "framer-motion";

const tableVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    category: "WINE",
    size_ml: 750,
    mrp: "",
    scm_code: "",
    case_size: "",
    purchase_price: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const fetchProducts = async () => {
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiClient.get(`/products${query}`);
      setProducts(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        size_ml: Number(formData.size_ml),
        mrp: Number(formData.mrp),
        scm_code: formData.scm_code,
        case_size: formData.case_size ? Number(formData.case_size) : null,
        purchase_price: formData.purchase_price ? Number(formData.purchase_price) : null,
      };

      const res = await apiClient.post("/products", payload);

      if (res.status !== 200 && res.status !== 201) {
        throw new Error(res.data.detail || "Failed to create product");
      }

      setIsAddModalOpen(false);
      setFormData({ name: "", category: "WINE", size_ml: 750, mrp: "", scm_code: "", case_size: "", purchase_price: "" });
      fetchProducts();
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      const errorMessage = Array.isArray(errorDetail) 
        ? errorDetail.map(e => `${e.loc.join('.')}: ${e.msg}`).join('\n') 
        : errorDetail || err.message;
      alert(`Failed to save: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Manage your catalog and view individual product details.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Link href="/products/unknown-barcodes" className="w-full md:w-auto">
            <Button variant="outline" className="w-full">Unknown Barcodes Queue</Button>
          </Link>
          <Button onClick={() => setIsAddModalOpen(true)} className="w-full md:w-auto shadow-[0_0_10px_var(--color-primary)]">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      <div className="flex items-center w-full max-w-md relative">
        <Search className="h-5 w-5 text-muted-foreground absolute left-3" />
        <Input 
          type="text" 
          placeholder="Search products by name..." 
          className="pl-10 h-12 w-full bg-card/60 border-border/50 backdrop-blur-md shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden border-border/50 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">MRP</th>
                <th className="px-6 py-4 hidden sm:table-cell">Purchase Price</th>
                <th className="px-6 py-4 hidden md:table-cell">SCM Code</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <motion.tbody 
              variants={tableVariants}
              initial="hidden"
              animate="show"
              className="divide-y divide-border/50"
            >
              {loading ? (
                Array.from({length: 5}).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4 hidden sm:table-cell"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-12" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4 hidden md:table-cell"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-8 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Box className="h-10 w-10 text-muted-foreground/50" />
                      <p>No products found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <motion.tr variants={rowVariants} key={p.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <Link href={`/products/${p.id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="font-mono text-[10px] tracking-wider px-2 py-0.5 bg-secondary/50">
                        {p.category}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{p.size_ml}ml</td>
                    <td className="px-6 py-4 font-bold text-foreground">₹{p.mrp}</td>
                    <td className="px-6 py-4 font-medium text-muted-foreground hidden sm:table-cell">{p.purchase_price ? `₹${p.purchase_price}` : '-'}</td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-[11px] hidden md:table-cell">{p.scm_code}</td>
                    <td className="px-6 py-4">
                      <Badge variant={p.status === 'ACTIVE' ? 'default' : 'destructive'} className={p.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-green-500/20 dark:text-green-400' : ''}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/products/${p.id}`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">View Details</Button>
                      </Link>
                    </td>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border/50 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 bg-muted/20">
                <h2 className="text-xl font-heading font-bold text-foreground">Add New Product</h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Product Name</label>
                  <Input required type="text" className="bg-background" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Category</label>
                    <select className="w-full h-10 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 outline-none" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                      <option value="WINE">WINE</option>
                      <option value="BEER">BEER</option>
                      <option value="IMFL">IMFL</option>
                      <option value="MML">MML</option>
                      <option value="CL">CL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Size (ml)</label>
                    <select className="w-full h-10 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 outline-none" value={formData.size_ml} onChange={(e) => setFormData({...formData, size_ml: Number(e.target.value)})}>
                      <option value={90}>90 ml</option>
                      <option value={180}>180 ml</option>
                      <option value={375}>375 ml</option>
                      <option value={750}>750 ml</option>
                      <option value={1000}>1000 ml</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-muted-foreground">MRP (₹)</label>
                    <Input required type="number" min="1" step="0.01" className="bg-background" value={formData.mrp} onChange={(e) => setFormData({...formData, mrp: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Case Size (Qty)</label>
                    <Input type="number" min="1" className="bg-background" value={formData.case_size} onChange={(e) => setFormData({...formData, case_size: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Purchase Price (₹)</label>
                    <Input type="number" min="0" step="0.01" className="bg-background" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-muted-foreground">SCM Code</label>
                    <Input required type="text" className="bg-background font-mono" value={formData.scm_code} onChange={(e) => setFormData({...formData, scm_code: e.target.value})} />
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end gap-3 border-t border-border/50 pt-6">
                  <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting} className="shadow-[0_0_10px_var(--color-primary)]">{submitting ? 'Saving...' : 'Save Product'}</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
