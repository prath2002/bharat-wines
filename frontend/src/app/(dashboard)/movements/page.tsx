"use client";

import { useState, useEffect } from "react";
import { Download, Search, Filter, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/api-client";
import { format } from "date-fns";
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

export default function MovementsPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [movementType, setMovementType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchMovements();
  }, [movementType, startDate, endDate]);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      let url = "/movements?limit=100";
      if (movementType) url += `&movement_type=${movementType}`;
      if (startDate) url += `&start_date=${startDate}T00:00:00Z`;
      if (endDate) url += `&end_date=${endDate}T23:59:59Z`;
      
      const res = await apiClient.get(url);
      setMovements(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      let url = "/movements/export?";
      if (movementType) url += `&movement_type=${movementType}`;
      if (startDate) url += `&start_date=${startDate}T00:00:00Z`;
      if (endDate) url += `&end_date=${endDate}T23:59:59Z`;
      
      const res = await apiClient.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Movements_Report.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export movements report");
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "SALE": 
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20 font-bold tracking-wider px-2 py-0.5 shadow-[0_0_10px_rgba(34,197,94,0.1)]">SALE</Badge>;
      case "RETURN": 
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 font-bold tracking-wider px-2 py-0.5">RETURN</Badge>;
      case "DAMAGE": 
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20 font-bold tracking-wider px-2 py-0.5">DAMAGE</Badge>;
      case "PURCHASE": 
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20 font-bold tracking-wider px-2 py-0.5">PURCHASE</Badge>;
      case "OPENING": 
        return <Badge variant="secondary" className="bg-secondary/50 font-bold tracking-wider px-2 py-0.5">OPENING</Badge>;
      default: 
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Movement History</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Audit log of all inventory changes across your store.</p>
        </div>
        <Button onClick={handleExport} className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]">
          <Download className="w-4 h-4 mr-2" /> Export to Excel
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-md">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">Movement Type</label>
            <select 
              className="w-full border border-border/50 bg-background rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/50 text-sm text-foreground transition-shadow"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="SALE">Sale</option>
              <option value="RETURN">Return</option>
              <option value="DAMAGE">Damage</option>
              <option value="PURCHASE">Purchase</option>
              <option value="OPENING">Opening</option>
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">Start Date</label>
            <Input 
              type="date"
              className="bg-background border-border/50 focus-visible:ring-primary/50"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1 w-full">
            <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">End Date</label>
            <Input 
              type="date"
              className="bg-background border-border/50 focus-visible:ring-primary/50"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="w-full md:w-auto">
            <Button variant="outline" className="w-full md:w-auto hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30" onClick={() => { setMovementType(""); setStartDate(""); setEndDate(""); }}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/50 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Notes</th>
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
                    <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-8" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                  </tr>
                ))
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <History className="h-10 w-10 text-muted-foreground/50" />
                      <p>No movements found matching filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                movements.map((m: any, idx: number) => (
                  <motion.tr variants={rowVariants} key={idx} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap font-mono text-[12px]">
                      {format(new Date(m.created_at), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground group-hover:text-primary transition-colors">{m.product_name}</td>
                    <td className="px-6 py-4">
                      {getTypeBadge(m.movement_type)}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">{m.quantity}</td>
                    <td className="px-6 py-4 text-muted-foreground text-[13px]">{m.user_name || 'System'}</td>
                    <td className="px-6 py-4 text-muted-foreground text-[13px] max-w-[200px] truncate" title={m.notes}>{m.notes || '-'}</td>
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
