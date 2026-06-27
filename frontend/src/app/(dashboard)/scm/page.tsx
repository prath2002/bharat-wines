"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Search, FileSpreadsheet } from "lucide-react";
import { apiClient } from "@/services/api-client";
import { format, subDays } from "date-fns";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function SCMPage() {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/scm/report?start_date=${startDate}&end_date=${endDate}`);
      setRecords(res.data.records);
    } catch (error) {
      console.error("Failed to fetch SCM report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  useEffect(() => {
    let result = records;
    if (categoryFilter !== "ALL") {
      result = result.filter(r => r.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.product_name.toLowerCase().includes(q) || 
        r.scm_code.toLowerCase().includes(q)
      );
    }
    setFilteredRecords(result);
  }, [records, categoryFilter, searchQuery]);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const res = await apiClient.get(`/scm/export?start_date=${startDate}&end_date=${endDate}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `scm_report_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Failed to export:", error);
    } finally {
      setDownloading(false);
    }
  };

  // Group by Category
  const grouped = filteredRecords.reduce((acc, record) => {
    if (!acc[record.category]) acc[record.category] = [];
    acc[record.category].push(record);
    return acc;
  }, {} as Record<string, any[]>);

  const categories = Object.keys(grouped).sort();

  return (
    <div className="p-4 md:p-8 max-w-[90rem] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">SCM / Excise Report</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">View and export official State Excise inventory records.</p>
        </div>
        <Button 
          onClick={handleExport}
          disabled={downloading || records.length === 0}
          className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)] disabled:opacity-50"
        >
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export Excel
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-md">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-auto flex-1 md:flex-none">
              <label className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5">Start Date</label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="bg-background border-border/50 focus-visible:ring-primary/50"
              />
            </div>
            <div className="w-full md:w-auto flex-1 md:flex-none">
              <label className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5">End Date</label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="bg-background border-border/50 focus-visible:ring-primary/50"
              />
            </div>
            <div className="w-full md:w-[200px]">
              <label className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5">Category</label>
              <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || "ALL")}>
                <SelectTrigger className="bg-background border-border/50 focus:ring-primary/50">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="IMFL">IMFL</SelectItem>
                  <SelectItem value="MML">MML</SelectItem>
                  <SelectItem value="WINE">Wine</SelectItem>
                  <SelectItem value="BEER">Beer</SelectItem>
                  <SelectItem value="CL">CL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:flex-1">
              <label className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or SCM code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background border-border/50 focus-visible:ring-primary/50"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <Card key={i} className="border-border/50 shadow-md bg-card/60 backdrop-blur-md overflow-hidden">
              <div className="bg-muted/30 px-5 py-4 border-b border-border/50 flex items-center">
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="p-0">
                <table className="w-full">
                  <tbody>
                    {Array.from({length: 3}).map((_, j) => (
                      <tr key={j} className="border-b border-border/50">
                        <td className="px-5 py-4"><Skeleton className="h-5 w-24" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-5 w-48" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-5 w-10 ml-auto" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-5 w-10 ml-auto" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground border border-border/50 rounded-2xl bg-card/30 backdrop-blur-sm flex flex-col items-center">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-foreground">No records found</p>
          <p className="text-sm mt-1">Try adjusting your filters or date range.</p>
        </div>
      ) : (
        <motion.div 
          className="space-y-6"
          initial="hidden"
          animate="show"
          variants={tableVariants}
        >
          {categories.map(category => (
            <motion.div key={category} variants={rowVariants}>
              <Card className="border-border/50 shadow-md bg-card/80 backdrop-blur-md overflow-hidden">
                <div className="bg-muted/40 px-5 py-3 border-b border-border/50">
                  <h3 className="font-heading font-bold text-foreground text-lg tracking-tight">{category}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/20 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/50">
                      <tr>
                        <th className="px-5 py-3">SCM Code</th>
                        <th className="px-5 py-3">Product Name</th>
                        <th className="px-5 py-3 text-right">Size (ML)</th>
                        <th className="px-5 py-3 text-right">Opening</th>
                        <th className="px-5 py-3 text-right text-blue-500">Purchases</th>
                        <th className="px-5 py-3 text-right text-red-500">Sales</th>
                        <th className="px-5 py-3 text-right text-green-500">Returns</th>
                        <th className="px-5 py-3 text-right text-amber-500">Damage</th>
                        <th className="px-5 py-3 text-right font-bold text-foreground">Closing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {grouped[category].map((record: any, i: number) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{record.scm_code}</td>
                          <td className="px-5 py-3 font-medium text-foreground group-hover:text-primary transition-colors">{record.product_name}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{record.size_ml}</td>
                          <td className="px-5 py-3 text-right font-medium text-muted-foreground">{record.opening}</td>
                          <td className="px-5 py-3 text-right font-medium text-blue-500/80">{record.purchases || '-'}</td>
                          <td className="px-5 py-3 text-right font-medium text-red-500/80">{record.sales || '-'}</td>
                          <td className="px-5 py-3 text-right font-medium text-green-500/80">{record.returns || '-'}</td>
                          <td className="px-5 py-3 text-right font-medium text-amber-500/80">{record.damage || '-'}</td>
                          <td className="px-5 py-3 text-right font-bold text-foreground text-base bg-muted/10">{record.closing}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t border-border/50 text-muted-foreground">
                      <tr>
                        <td colSpan={3} className="px-5 py-4 text-right font-bold uppercase tracking-wider text-[11px]">Total {category}</td>
                        <td className="px-5 py-4 text-right font-bold text-foreground">{grouped[category].reduce((sum: number, r: any) => sum + r.opening, 0)}</td>
                        <td className="px-5 py-4 text-right font-bold text-blue-500">{grouped[category].reduce((sum: number, r: any) => sum + r.purchases, 0)}</td>
                        <td className="px-5 py-4 text-right font-bold text-red-500">{grouped[category].reduce((sum: number, r: any) => sum + r.sales, 0)}</td>
                        <td className="px-5 py-4 text-right font-bold text-green-500">{grouped[category].reduce((sum: number, r: any) => sum + r.returns, 0)}</td>
                        <td className="px-5 py-4 text-right font-bold text-amber-500">{grouped[category].reduce((sum: number, r: any) => sum + r.damage, 0)}</td>
                        <td className="px-5 py-4 text-right font-bold text-foreground text-lg">{grouped[category].reduce((sum: number, r: any) => sum + r.closing, 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
