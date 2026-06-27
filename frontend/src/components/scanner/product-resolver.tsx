"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/api-client";
import { Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ResolvedProduct {
  id: string;
  name: string;
  category: string;
  size_ml: number;
  mrp: number;
  current_stock: number;
  scm_code: string;
}

interface ProductResolverProps {
  barcode: string | null;
  onResolved: (product: ResolvedProduct | null) => void;
}

export function ProductResolver({ barcode, onResolved }: ProductResolverProps) {
  const [product, setProduct] = useState<ResolvedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!barcode) {
      setProduct(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const resolveBarcode = async () => {
      setLoading(true);
      setError(null);
      setProduct(null);
      
      try {
        const res = await apiClient.get(`/barcodes/lookup?value=${barcode}`);
        if (isMounted) {
          setProduct(res.data);
          onResolved(res.data);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Lookup error:", err);
          if (err.response?.status === 404) {
            setError("Unknown Barcode");
          } else {
            setError(`Error ${err.response?.status || 'Network'}: ${err.response?.data?.detail || err.message}`);
          }
          onResolved(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    resolveBarcode();
    
    return () => { isMounted = false; };
  }, [barcode, onResolved]);

  if (!barcode) {
    return (
      <div className="w-full p-8 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 bg-gray-50">
        <Package className="h-10 w-10 mb-3 opacity-50" />
        <p className="text-sm font-medium">Scan a product to begin</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full p-4 border rounded-xl bg-white shadow-sm animate-pulse flex gap-4 items-center">
        <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 border border-red-200 bg-red-50 rounded-xl flex items-start gap-3 text-red-700">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">{error}</p>
          <p className="text-sm mt-1 mb-3">Barcode <span className="font-mono bg-red-100 px-1 rounded">{barcode}</span> could not be found.</p>
          {error === "Unknown Barcode" && (
             <Button variant="outline" size="sm" className="bg-white hover:bg-red-50 text-red-700 border-red-200" onClick={() => window.location.href='/products'}>
               Map this barcode
             </Button>
          )}
        </div>
      </div>
    );
  }

  if (product) {
    return (
      <div className="w-full p-4 border rounded-xl bg-white shadow-sm flex items-start gap-4">
        <div className="h-12 w-12 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center shrink-0">
          <Package className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-medium">{product.category}</span>
            <span>{product.size_ml}ml</span>
            <span>•</span>
            <span className="font-semibold text-gray-700">₹{product.mrp}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500 uppercase font-semibold">Stock</p>
          <p className={`text-lg font-bold ${product.current_stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {product.current_stock ?? 0}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
