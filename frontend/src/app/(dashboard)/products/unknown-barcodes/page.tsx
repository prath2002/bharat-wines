"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Trash2, AlertCircle, ArrowLeft } from "lucide-react";
import { apiClient } from "@/services/api-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function UnknownBarcodesPage() {
  const [barcodes, setBarcodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Mapping state
  const [mappingId, setMappingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchUnknownBarcodes();
  }, []);

  const fetchUnknownBarcodes = async () => {
    try {
      const res = await apiClient.get("/unknown-barcodes");
      setBarcodes(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleIgnore = async (id: string) => {
    if (!confirm("Are you sure you want to ignore this scan?")) return;
    try {
      await apiClient.post(`/unknown-barcodes/${id}/ignore`);
      fetchUnknownBarcodes();
    } catch (err) {
      console.error(err);
    }
  };

  const searchProducts = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const res = await apiClient.get(`/products?search=${encodeURIComponent(q)}&limit=5`);
      setSearchResults(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleMap = async (productId: string) => {
    if (!mappingId) return;
    try {
      await apiClient.post(`/unknown-barcodes/${mappingId}/map`, {
        product_id: productId
      });
      
      setMappingId(null);
      setSearchQuery("");
      fetchUnknownBarcodes();
    } catch (err: any) {
      alert("Error mapping barcode");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/products" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1"/> Back to Products
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Unknown Barcodes Queue</h1>
        <p className="text-muted-foreground mt-1">Review barcodes that were scanned but not found in the system.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Barcode Value</th>
              <th className="px-6 py-4">Scanned At</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={3} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : barcodes.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-gray-500">
                  <AlertCircle className="h-10 w-10 mx-auto text-green-400 mb-3"/>
                  <p className="text-lg font-medium text-gray-900">Queue is empty!</p>
                  <p className="text-sm">All scanned barcodes are currently mapped.</p>
                </td>
              </tr>
            ) : (
              barcodes.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-lg font-semibold tracking-wider text-gray-900">
                    {b.barcode_value}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(b.scanned_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 flex items-center gap-3">
                    <Button variant="default" size="sm" onClick={() => setMappingId(b.id)}>
                      <MapPin className="h-4 w-4 mr-2"/> Map to Product
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleIgnore(b.id)}>
                      Ignore
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mappingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-lg mb-4">Map to Existing Product</h3>
            
            <div className="relative mb-6">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input 
                type="text" 
                className="w-full border rounded-lg pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search products by name..."
                value={searchQuery}
                onChange={(e) => searchProducts(e.target.value)}
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
              {searching ? (
                <p className="text-center text-sm text-gray-500 py-4">Searching...</p>
              ) : searchResults.length > 0 ? (
                searchResults.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-blue-50 cursor-pointer" onClick={() => handleMap(p.id)}>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.size_ml}ml • ₹{p.mrp}</p>
                    </div>
                    <Button size="sm" variant="outline">Select</Button>
                  </div>
                ))
              ) : searchQuery.length >= 2 ? (
                <p className="text-center text-sm text-gray-500 py-4">No products found.</p>
              ) : null}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => { setMappingId(null); setSearchQuery(""); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
