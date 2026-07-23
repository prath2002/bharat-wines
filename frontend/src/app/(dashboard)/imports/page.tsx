"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle, AlertCircle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api-client";

export default function ImportsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiClient.post("/imports/opening-inventory", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setJobId(res.data.import_job_id);

      const previewRes = await apiClient.get(`/imports/${res.data.import_job_id}/preview`);
      setPreviewData(previewRes.data);
    } catch (err) {
      console.error(err);
      alert("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const processImport = async () => {
    if (!jobId) return;
    setProcessing(true);
    
    try {
      await apiClient.post(`/imports/${jobId}/process`);

      // Poll for status
      const interval = setInterval(async () => {
        const statusRes = await apiClient.get(`/imports/${jobId}/status`);
        const statusData = statusRes.data;

        setStatus(statusData);

        if (statusData.status === "DONE" || statusData.status === "ERROR") {
          clearInterval(interval);
          setProcessing(false);
        }
      }, 2000);

    } catch (err) {
      console.error(err);
      alert("Failed to start processing");
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Imports</h1>
          <p className="text-muted-foreground mt-1">Bulk upload opening inventory and catalogs.</p>
        </div>
        <Button variant="outline" onClick={() => window.open(`${apiClient.defaults.baseURL}/imports/template`)}>
          Download Template
        </Button>
      </div>

      {!jobId && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center bg-gray-50/50 text-gray-900 hover:bg-gray-50 transition-colors">
          <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Upload Spreadsheet</h3>
          <p className="text-sm text-gray-500 mb-6">Drag and drop your .xlsx or .csv file here, or click to browse</p>
          
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".xlsx, .csv"
            onChange={handleFileChange}
          />
          <Button onClick={() => document.getElementById("file-upload")?.click()}>
            <span>{file ? file.name : "Select File"}</span>
          </Button>

          {file && (
            <div className="mt-6">
              <Button onClick={uploadFile} disabled={uploading}>
                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Upload and Preview"}
              </Button>
            </div>
          )}
        </div>
      )}

      {jobId && !status && previewData.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white text-gray-900 p-6 rounded-xl border shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Preview Data (First 10 Rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Size (ml)</th>
                    <th className="px-6 py-3">MRP</th>
                    <th className="px-6 py-3">Purchase Price</th>
                    <th className="px-6 py-3">SCM Code</th>
                    <th className="px-6 py-3">Opening Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{row["Product Name"]}</td>
                      <td className="px-6 py-4">{row["Category"]}</td>
                      <td className="px-6 py-4">{row["Size (ml)"]}</td>
                      <td className="px-6 py-4">₹{row["MRP"]}</td>
                      <td className="px-6 py-4">₹{row["Purchase Price"]}</td>
                      <td className="px-6 py-4">{row["SCM Code"]}</td>
                      <td className="px-6 py-4">{row["Opening Quantity"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 flex justify-end gap-4">
              <Button variant="outline" onClick={() => { setJobId(null); setFile(null); }}>Cancel</Button>
              <Button onClick={processImport} disabled={processing}>
                {processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Confirm and Import"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className="bg-white text-gray-900 p-6 rounded-xl border shadow-sm text-center">
          {status.status === "PROCESSING" && (
            <div className="py-8">
              <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin mb-4" />
              <h3 className="text-xl font-semibold">Processing Import...</h3>
              <p className="text-gray-500 mt-2">Please wait while we create products and update stock levels.</p>
            </div>
          )}
          
          {status.status === "DONE" && (
            <div className="py-8">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-green-700">Import Completed Successfully</h3>
              
              <div className="mt-6 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-500">Products Created</p>
                  <p className="text-2xl font-bold">{status.summary?.products_created || 0}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-500">Products Updated</p>
                  <p className="text-2xl font-bold">{status.summary?.products_updated || 0}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-500">Stock Movements</p>
                  <p className="text-2xl font-bold">{status.summary?.movements_created || 0}</p>
                </div>
              </div>

              {status.summary?.errors?.length > 0 && (
                <div className="mt-8 text-left max-w-2xl mx-auto bg-red-50 border border-red-200 p-4 rounded-lg text-red-800">
                  <p className="font-semibold mb-2 flex items-center gap-2"><AlertCircle className="h-5 w-5"/> Some rows had errors:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {status.summary.errors.map((e: any, i: number) => (
                      <li key={i}>Row {e.row}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button className="mt-8" onClick={() => window.location.reload()}>Start New Import</Button>
            </div>
          )}

          {status.status === "ERROR" && (
            <div className="py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-red-700">Import Failed</h3>
              <p className="text-red-600 mt-2">{status.summary?.error || "An unknown error occurred"}</p>
              <Button className="mt-6" variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
