"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/api-client";
import { format } from "date-fns";
import Link from "next/link";
import { Plus, FileText, ChevronRight, FileSearch } from "lucide-react";
import { motion } from "framer-motion";

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function TPReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      const response = await apiClient.get("/tp/receipts");
      setReceipts(response.data);
    } catch (error) {
      console.error("Failed to fetch TP receipts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PROCESSING":
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">Processing (AI)</Badge>;
      case "DRAFT":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]">Review Required</Badge>;
      case "APPROVED":
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20">Approved</Badge>;
      case "REJECTED":
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Rejected</Badge>;
      case "FAILED":
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Extraction Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Transport Permits</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Upload and process state transport permits for automated inventory entry.</p>
        </div>
        <Link href="/tp/upload" className="w-full md:w-auto">
          <Button className="w-full md:w-auto shadow-[0_0_15px_var(--color-primary)] bg-gradient-to-r from-primary to-primary/80 hover:scale-105 active:scale-95 transition-all">
            <Plus className="mr-2 h-4 w-4" /> Upload New TP
          </Button>
        </Link>
      </div>

      <Card className="border-border/50 shadow-md bg-card/80 backdrop-blur-md">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="text-foreground flex items-center">
            <FileText className="mr-2 h-5 w-5 text-primary" />
            Recent TP Receipts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1,2,3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-8 w-24 hidden md:block" />
                </div>
              ))}
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center">
              <FileSearch className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p>No Transport Permits found.</p>
              <p className="text-sm">Upload your first one to get started.</p>
            </div>
          ) : (
            <motion.div 
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="divide-y divide-border/50"
            >
              {receipts.map((receipt) => (
                <Link key={receipt.id} href={`/tp/${receipt.id}/review`} className="block">
                  <motion.div variants={itemVariants} className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 hover:bg-muted/40 transition-colors group">
                    <div className="flex gap-5 items-center mb-4 md:mb-0 w-full md:w-auto">
                      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors">
                          {receipt.tp_number || "Processing TP Number..."}
                        </h4>
                        <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                          <span>{receipt.supplier_name || "Supplier Pending"}</span>
                          <span className="hidden md:inline">&bull;</span>
                          <span className="text-[12px] md:text-sm font-mono">{receipt.tp_date || "Date Pending"}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between w-full md:w-auto gap-6 pl-19 md:pl-0">
                      <div className="text-left md:text-right">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1 md:hidden">Status</div>
                        {getStatusBadge(receipt.status)}
                      </div>
                      
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Uploaded</div>
                        <div className="text-sm text-foreground font-medium">
                          {format(new Date(receipt.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all hidden md:block" />
                    </div>
                  </motion.div>
                </Link>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
