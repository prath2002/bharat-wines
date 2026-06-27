"use client";

import { useState, useEffect } from "react";
import { Download, TrendingUp, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/api-client";
import { format, subDays, startOfMonth } from "date-fns";
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

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"revenue" | "low_stock">("revenue");
  
  const [revenueData, setRevenueData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [lowStockData, setLowStockData] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === "revenue") {
      fetchRevenue();
    } else if (activeTab === "low_stock") {
      fetchLowStock();
    }
  }, [activeTab]);

  const fetchLowStock = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/reports/low-stock?threshold=10');
      setLowStockData(res.data);
    } catch (err) {
      console.error("Failed to fetch low stock", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/reports/revenue?start_date=${startDate}T00:00:00Z&end_date=${endDate}T23:59:59Z`);
      setRevenueData(res.data);
    } catch (err) {
      console.error("Failed to fetch revenue", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportRevenue = async () => {
    try {
      const res = await apiClient.get(`/reports/revenue/export?start_date=${startDate}T00:00:00Z&end_date=${endDate}T23:59:59Z`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Revenue_Report_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export revenue report");
    }
  };

  const setPreset = (preset: "today" | "last7" | "last30" | "thisMonth") => {
    const today = new Date();
    setEndDate(format(today, "yyyy-MM-dd"));
    
    if (preset === "today") setStartDate(format(today, "yyyy-MM-dd"));
    if (preset === "last7") setStartDate(format(subDays(today, 7), "yyyy-MM-dd"));
    if (preset === "last30") setStartDate(format(subDays(today, 30), "yyyy-MM-dd"));
    if (preset === "thisMonth") setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Reports Hub</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Generate and export business performance reports.</p>
        </div>
      </div>

      <div className="flex border-b border-border/50 overflow-x-auto no-scrollbar">
        <button
          className={`px-6 py-4 font-bold text-sm flex items-center whitespace-nowrap transition-colors relative ${activeTab === 'revenue' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('revenue')}
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Revenue Report
          {activeTab === 'revenue' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-2px_10px_var(--color-primary)]" />
          )}
        </button>
        <button
          className={`px-6 py-4 font-bold text-sm flex items-center whitespace-nowrap transition-colors relative ${activeTab === 'low_stock' ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('low_stock')}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Low Stock Alert
          {activeTab === 'low_stock' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-t-full shadow-[0_-2px_10px_rgba(245,158,11,0.5)]" />
          )}
        </button>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "revenue" && (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-md">
              <CardContent className="p-5 space-y-5">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                  <div className="flex flex-col sm:flex-row items-end gap-3 w-full md:w-auto">
                    <div className="w-full sm:w-auto">
                      <label className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5">Start Date</label>
                      <Input type="date" className="bg-background border-border/50 focus-visible:ring-primary/50 h-10 w-full sm:w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="w-full sm:w-auto">
                      <label className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5">End Date</label>
                      <Input type="date" className="bg-background border-border/50 focus-visible:ring-primary/50 h-10 w-full sm:w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <div className="w-full sm:w-auto">
                      <Button onClick={fetchRevenue} disabled={loading} className="w-full h-10 shadow-[0_0_10px_var(--color-primary)] bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground">Apply</Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={() => setPreset("today")} className="flex-1 md:flex-none">Today</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreset("last7")} className="flex-1 md:flex-none">Last 7 Days</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreset("thisMonth")} className="flex-1 md:flex-none">This Month</Button>
                  </div>
                </div>

                <div className="pt-5 border-t border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <p className="text-xs font-bold tracking-wider uppercase text-muted-foreground mb-1">Total Revenue for Period</p>
                    <h2 className="text-4xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-400">
                      ₹{revenueData?.total_revenue?.toLocaleString() || 0}
                    </h2>
                  </div>
                  <Button onClick={handleExportRevenue} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]">
                    <Download className="w-4 h-4 mr-2" /> Export to Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/50 shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Product Name</th>
                      <th className="px-6 py-4">Size</th>
                      <th className="px-6 py-4 text-center">Qty Sold</th>
                      <th className="px-6 py-4 text-right">MRP</th>
                      <th className="px-6 py-4 text-right text-primary">Revenue</th>
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
                          <td className="px-6 py-4"><Skeleton className="h-5 w-12" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-5 w-10 mx-auto" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-5 w-16 ml-auto" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-5 w-24 ml-auto" /></td>
                        </tr>
                      ))
                    ) : revenueData?.breakdown?.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-16 text-muted-foreground">No sales recorded in this period.</td></tr>
                    ) : (
                      revenueData?.breakdown?.map((p: any, i: number) => (
                        <motion.tr variants={rowVariants} key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-semibold text-foreground">{p.product_name}</td>
                          <td className="px-6 py-4 text-muted-foreground">{p.size_ml}ml</td>
                          <td className="px-6 py-4 font-bold text-foreground text-center">
                            <Badge variant="secondary" className="bg-secondary/50 font-mono text-[11px]">{p.quantity_sold}</Badge>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground text-right">₹{p.mrp}</td>
                          <td className="px-6 py-4 text-right font-bold text-green-600 dark:text-green-500">₹{p.revenue.toLocaleString()}</td>
                        </motion.tr>
                      ))
                    )}
                  </motion.tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "low_stock" && (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-md">
              <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center text-amber-500">
                  <div className="p-3 bg-amber-500/20 rounded-xl mr-4 shadow-[0_0_15px_rgba(245,158,11,0.2)] border border-amber-500/20">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-heading font-bold text-foreground">Low Stock Alert Report</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Items currently below the minimum stock threshold of 10.</p>
                  </div>
                </div>
                <Link href="/inventory?filter=low_stock" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30 transition-colors">
                    Manage in Inventory
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/50 shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Product Name</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Size</th>
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
                      Array.from({length: 3}).map((_, i) => (
                        <tr key={i}>
                          <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-5 w-12" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-6 w-10 ml-auto" /></td>
                        </tr>
                      ))
                    ) : lowStockData.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-16 text-foreground font-medium flex flex-col items-center">
                          <div className="p-4 bg-green-500/10 rounded-full text-green-500 mb-3">
                            <TrendingUp className="w-8 h-8" />
                          </div>
                          All products are adequately stocked!
                        </td>
                      </tr>
                    ) : (
                      lowStockData.map((item: any, i: number) => (
                        <motion.tr variants={rowVariants} key={i} className="hover:bg-destructive/5 transition-colors">
                          <td className="px-6 py-4 font-semibold text-foreground">{item.product_name}</td>
                          <td className="px-6 py-4">
                            <Badge variant="secondary" className="bg-secondary/50 font-mono text-[10px] px-2 py-0.5">{item.category}</Badge>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">{item.size_ml}ml</td>
                          <td className="px-6 py-4 text-right">
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 font-bold px-3 py-1 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
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
        )}
      </motion.div>
    </div>
  );
}
