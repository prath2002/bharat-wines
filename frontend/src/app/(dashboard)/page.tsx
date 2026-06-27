"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { 
  ShoppingBag, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  AlertTriangle,
  Package,
  FileText,
  ScanBarcode,
  TrendingUp,
  Tag
} from "lucide-react";
import { apiClient } from "@/services/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Badge } from "@/components/ui/badge";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function DashboardHome() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await apiClient.get("/reports/dashboard-summary");
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 md:p-8 max-w-7xl mx-auto space-y-8"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Real-time metrics and alerts for your store.</p>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Summary Cards */}
          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-primary/20 text-primary rounded-xl shadow-[inset_0_0_10px_rgba(124,58,237,0.2)] border border-primary/20">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Sales</p>
                <h3 className="text-3xl font-bold text-foreground font-heading">
                  <AnimatedCounter value={stats?.today_sales || 0} />
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-blue-500/20 text-blue-500 rounded-xl shadow-[inset_0_0_10px_rgba(59,130,246,0.2)] border border-blue-500/20">
                <ArrowDownToLine className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Purchases</p>
                <h3 className="text-3xl font-bold text-foreground font-heading">
                  <AnimatedCounter value={stats?.today_purchases || 0} />
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl shadow-[inset_0_0_10px_rgba(245,158,11,0.2)] border border-amber-500/20">
                <ArrowUpFromLine className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Returns</p>
                <h3 className="text-3xl font-bold text-foreground font-heading">
                  <AnimatedCounter value={stats?.today_returns || 0} />
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-destructive/20 text-destructive rounded-xl shadow-[inset_0_0_10px_rgba(239,68,68,0.2)] border border-destructive/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Damages</p>
                <h3 className="text-3xl font-bold text-foreground font-heading">
                  <AnimatedCounter value={stats?.today_damage || 0} />
                </h3>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b border-border/50 bg-muted/20">
              <CardTitle className="flex items-center text-lg">
                <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-2 gap-4 flex-1">
              <Link href="/sale" className="group relative flex flex-col items-center justify-center p-6 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl transition-all overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <ScanBarcode className="w-8 h-8 text-primary mb-3 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300" />
                <span className="font-medium text-primary">New Sale</span>
              </Link>
              
              <Link href="/return" className="group relative flex flex-col items-center justify-center p-6 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-xl transition-all overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <ArrowUpFromLine className="w-8 h-8 text-amber-500 mb-3 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300" />
                <span className="font-medium text-amber-600 dark:text-amber-500">Return Item</span>
              </Link>

              <Link href="/damage" className="group relative flex flex-col items-center justify-center p-6 bg-destructive/5 hover:bg-destructive/10 border border-destructive/20 rounded-xl transition-all overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <AlertTriangle className="w-8 h-8 text-destructive mb-3 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300" />
                <span className="font-medium text-destructive">Record Damage</span>
              </Link>

              <Link href="/imports" className="group relative flex flex-col items-center justify-center p-6 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-xl transition-all overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <FileText className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300" />
                <span className="font-medium text-blue-600 dark:text-blue-500">Import Stock</span>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Alerts & Pending Actions */}
        <motion.div variants={itemVariants}>
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b border-border/50 bg-muted/20">
              <CardTitle className="flex items-center text-lg">
                <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
                Alerts & Pending Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-border/50 hover:bg-muted/30 transition-colors group">
                <div className="flex items-center">
                  <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg mr-4 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)] group-hover:scale-105 transition-transform">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Low Stock Alerts</h4>
                    <p className="text-sm text-muted-foreground">Products below minimum threshold</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={stats?.low_stock_count > 0 ? "destructive" : "secondary"} className="text-sm px-3 py-1">
                    {stats?.low_stock_count || 0}
                  </Badge>
                  <Link href="/reports">
                    <Button variant="outline" size="sm" className="hidden sm:flex">View Report</Button>
                  </Link>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 border-b border-border/50 hover:bg-muted/30 transition-colors group">
                <div className="flex items-center">
                  <div className="p-2 bg-primary/20 text-primary rounded-lg mr-4 border border-primary/20 shadow-[0_0_10px_rgba(124,58,237,0.1)] group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Pending TP Approvals</h4>
                    <p className="text-sm text-muted-foreground">Awaiting management review</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={stats?.pending_tp_count > 0 ? "default" : "secondary"} className="text-sm px-3 py-1">
                    {stats?.pending_tp_count || 0}
                  </Badge>
                  <Button variant="outline" size="sm" disabled className="hidden sm:flex">Review</Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors group">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-500/20 text-blue-500 rounded-lg mr-4 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)] group-hover:scale-105 transition-transform">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Pending MRP Changes</h4>
                    <p className="text-sm text-muted-foreground">Mismatches requiring approval</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={stats?.pending_mrp_count > 0 ? "default" : "secondary"} className="text-sm px-3 py-1">
                    {stats?.pending_mrp_count || 0}
                  </Badge>
                  <Button variant="outline" size="sm" disabled className="hidden sm:flex">Review</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
