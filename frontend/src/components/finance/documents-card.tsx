"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  deleteDocument, DocumentType, FinanceDocument, listBillDocuments, listPaymentDocuments,
  uploadBillDocument, uploadPaymentDocument,
} from "@/services/documents";

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: "Invoice",
  PURCHASE_ORDER: "Purchase order",
  PAYMENT_PROOF: "Payment proof",
  RECEIPT: "Receipt",
  SUPPORTING: "Supporting document",
};

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function apiErrorDetail(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
}

const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/api\/v1$/, "");

function DocumentList({ documents, onDeleted }: { documents: FinanceDocument[]; onDeleted: () => void }) {
  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => { toast.success("Document removed"); onDeleted(); },
    onError: (e: unknown) => toast.error(apiErrorDetail(e, "Failed to remove document")),
  });

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No documents attached.</p>;
  }

  return (
    <ul className="divide-y divide-border/40">
      {documents.map((doc) => (
        <li key={doc.id} className="py-2.5 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          <a
            href={`${apiBase}${doc.file_url}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 min-w-0 text-sm text-foreground hover:text-primary hover:underline underline-offset-4 truncate"
          >
            {DOC_TYPE_LABELS[doc.doc_type]}
          </a>
          <Button
            variant="ghost" size="icon" aria-label="Remove document"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => removeMutation.mutate(doc.id)}
            disabled={removeMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function UploadDialog({ onUpload }: { onUpload: (docType: DocumentType, file: File) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<DocumentType>("SUPPORTING");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload(docType, file);
      setOpen(false);
      setFile(null);
    } catch (e) {
      setError(apiErrorDetail(e, "Failed to upload document"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setFile(null); setError(null); } }}>
      <DialogTrigger render={<Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add document</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Attach a document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm">{error}</div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="doc_type">Document type</Label>
            <select id="doc_type" className={selectClass} value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
              {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc_file">File</Label>
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2.5 text-sm text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/30">
              <Upload className="h-4 w-4" />
              {file ? file.name : "Choose a file"}
              <input id="doc_file" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <Button className="w-full" onClick={handleUpload} disabled={!file || uploading}>
            {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsCard({ billId }: { billId: string }) {
  const queryClient = useQueryClient();
  const docsQuery = useQuery({ queryKey: ["bill-documents", billId], queryFn: () => listBillDocuments(billId) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bill-documents", billId] });

  return (
    <Card className="border-border/50">
      <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Documents</CardTitle>
        <UploadDialog onUpload={async (docType, file) => { await uploadBillDocument(billId, docType, file); toast.success("Document uploaded"); invalidate(); }} />
      </CardHeader>
      <CardContent className="p-5">
        <DocumentList documents={docsQuery.data ?? []} onDeleted={invalidate} />
      </CardContent>
    </Card>
  );
}

export function PaymentDocumentsInline({ paymentId }: { paymentId: string }) {
  const queryClient = useQueryClient();
  const docsQuery = useQuery({ queryKey: ["payment-documents", paymentId], queryFn: () => listPaymentDocuments(paymentId) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payment-documents", paymentId] });

  return (
    <div className="mt-2 pl-12">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Proof documents</span>
        <UploadDialog onUpload={async (docType, file) => { await uploadPaymentDocument(paymentId, docType, file); toast.success("Document uploaded"); invalidate(); }} />
      </div>
      <DocumentList documents={docsQuery.data ?? []} onDeleted={invalidate} />
    </div>
  );
}
