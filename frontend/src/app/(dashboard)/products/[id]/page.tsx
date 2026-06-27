"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, Barcode, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BarcodeMapper } from "@/components/products/barcode-mapper";
import { apiClient } from "@/services/api-client";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMappingBarcode, setIsMappingBarcode] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await apiClient.get(`/products/${id}`);
      setProduct(res.data);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 404) {
        router.push("/products");
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteBarcode = async (barcodeId: string) => {
    if (!confirm("Remove this barcode mapping?")) return;
    try {
      await apiClient.delete(`/barcodes/${barcodeId}`);
      fetchProduct(); // refresh list
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading product details...</div>;
  if (!product) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/products" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1"/> Back to Products
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{product.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider">{product.category}</span>
              <span className="text-sm text-gray-500 font-medium">{product.size_ml}ml</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {product.status}
              </span>
            </div>
          </div>
          <Button variant="outline"><Edit className="h-4 w-4 mr-2"/> Edit Details</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Key Info */}
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Product Specifications</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <p className="text-sm text-gray-500 mb-1">MRP (₹)</p>
                <p className="font-medium text-lg text-gray-900">₹{product.mrp}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">SCM Code</p>
                <p className="font-mono text-gray-900 bg-gray-50 inline-block px-2 py-0.5 rounded border">{product.scm_code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Case Size</p>
                <p className="font-medium text-gray-900">{product.case_size ? `${product.case_size} units/case` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Added On</p>
                <p className="font-medium text-gray-900">{new Date(product.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Barcode className="h-5 w-5"/> Mapped Barcodes</h3>
              <Button size="sm" onClick={() => setIsMappingBarcode(true)}>Add Barcode</Button>
            </div>
            
            {product.barcodes && product.barcodes.length > 0 ? (
              <div className="space-y-3">
                {product.barcodes.map((b: any) => (
                  <div key={b.id} className="flex justify-between items-center bg-gray-50 border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Barcode className="h-5 w-5 text-gray-400"/>
                      <span className="font-mono text-lg tracking-wider">{b.barcode_value}</span>
                      <span className="text-xs text-gray-500 bg-white border px-2 py-0.5 rounded-full">{b.format || '1D'}</span>
                    </div>
                    <button onClick={() => deleteBarcode(b.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-md transition-colors">
                      <Trash2 className="h-4 w-4"/>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                <Barcode className="h-8 w-8 mx-auto text-gray-300 mb-2"/>
                <p>No barcodes mapped yet.</p>
                <p className="text-sm">Scan a barcode to link it to this product.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar / Stock Info */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6 text-center">
            <Package className="h-10 w-10 text-blue-500 mx-auto mb-3"/>
            <h3 className="text-blue-900 font-semibold text-lg">Current Stock</h3>
            <p className="text-5xl font-bold text-blue-700 mt-2">{product.current_stock}</p>
            <p className="text-sm text-blue-600/80 mt-1">units available</p>
          </div>
        </div>
      </div>

      {isMappingBarcode && (
        <BarcodeMapper 
          productId={product.id} 
          onClose={() => setIsMappingBarcode(false)} 
          onMapped={fetchProduct} 
        />
      )}
    </div>
  );
}
