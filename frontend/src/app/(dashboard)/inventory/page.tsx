"use client";

import { useState, useEffect } from "react";
import { Download, Search, AlertCircle, Filter, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/api-client";
import Link from "next/link";
import { motion } from "framer-motion";

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

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [category, setCategory] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  useEffect(() => {
    fetchInventory();
  }, [category, stockFilter]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      let url = "/inventory?limit=1000";
      if (category) url += `&category=${category}`;
      if (stockFilter === "low") {
        url += "&max_stock=10";
      } else if (stockFilter === "out") {
        url += "&max_stock=0";
      }
      
      const res = await apiClient.get(url);
      setInventory(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      let url = "/inventory/export?";
      if (category) url += `&category=${category}`;
      if (stockFilter === "low") url += "&max_stock=10";
      if (stockFilter === "out") url += "&max_stock=0";
      
      const res = await apiClient.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Inventory_Report.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export inventory report");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Inventory Report</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">View current stock levels for all products.</p>
        </div>
        <Button onClick={handleExport} className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]">
          <Download className="w-4 h-4 mr-2" /> Export to Excel
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-md">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">Category</label>
            <select 
              className="w-full border border-border/50 bg-background rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 text-sm text-foreground transition-shadow"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="IMFL">IMFL</option>
              <option value="BEER">BEER</option>
              <option value="WINE">WINE</option>
              <option value="CL">CL</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">Stock Status</label>
            <select 
              className="w-full border border-border/50 bg-background rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 text-sm text-foreground transition-shadow"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">All Stock Levels</option>
              <option value="low">Low Stock (&le; 10)</option>
              <option value="out">Out of Stock (0)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/50 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">MRP</th>
                <th className="px-6 py-4 text-right">Current Stock</th>
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
                    <td className="px-6 py-4"><Skeleton className="h-5 w-12" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-12 ml-auto" /></td>
                  </tr>
                ))
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <PackageOpen className="h-10 w-10 text-muted-foreground/50" />
                      <p>No products found matching filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                inventory.map((item: any, idx: number) => (
                  <motion.tr variants={rowVariants} key={idx} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/products/${item.product_id}`} className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        {item.product_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="font-mono text-[10px] tracking-wider px-2 py-0.5 bg-secondary/50">
                        {item.category}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{item.size_ml}ml</td>
                    <td className="px-6 py-4 font-bold text-foreground">₹{item.mrp}</td>
                    <td className="px-6 py-4 text-right">
                      <Badge 
                        variant={item.current_stock === 0 ? "destructive" : item.current_stock <= 10 ? "secondary" : "default"}
                        className={`text-sm px-3 py-1 font-bold ${
                          item.current_stock === 0 ? 'bg-destructive/10 text-destructive border-destructive/20' 
                          : item.current_stock <= 10 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20' 
                          : 'bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20'
                        }`}
                      >
                        {item.current_stock}
                      </Badge>
                    </td>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
