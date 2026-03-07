import { useState, useRef } from "react";
import { 
  Download, 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Table as TableIcon,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Voyage } from "@shared/schema";

interface ImportPortExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voyages: Voyage[];
}

export function ImportPortExpensesDialog({ open, onOpenChange, voyages }: ImportPortExpensesDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [voyageId, setVoyageId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setFile(null);
    setPreview([]);
    setVoyageId("");
    setIsImporting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file.", variant: "destructive" });
      return;
    }

    setFile(selectedFile);
    
    // Simple CSV parser for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      const headers = lines[0].split(",").map(h => h.trim());
      const data = lines.slice(1, 6).filter(l => l.trim()).map(line => {
        const values = line.split(",").map(v => v.trim());
        return headers.reduce((obj: any, header, i) => {
          obj[header] = values[i];
          return obj;
        }, {});
      });
      setPreview(data);
      setStep(2);
    };
    reader.readAsText(selectedFile);
  };

  const handleDownloadTemplate = () => {
    const headers = ["date", "description", "category", "amount", "currency", "vendor", "receiptNumber"];
    const example = ["2024-03-10", "Port Dues for Voyage", "port_dues", "1500.50", "USD", "Port Authority", "REC-12345"];
    const csvContent = headers.join(",") + "\n" + example.join(",");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "port_expenses_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return;
    
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (voyageId) formData.append("voyageId", voyageId);

      const res = await fetch("/api/port-expenses/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to import expenses");
      }

      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/port-expenses"] });
      toast({ title: "Import Successful", description: `Successfully imported ${result.count} expenses.` });
      onOpenChange(false);
      reset();
    } catch (error: any) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if(!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Import Port Expenses
          </DialogTitle>
          <DialogDescription>
            Bulk upload expenses from a CSV file.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">Click to upload CSV</h3>
                  <p className="text-sm text-muted-foreground mb-4">or drag and drop your file here</p>
                  <Button variant="outline" size="sm" type="button">Select File</Button>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex items-start gap-3">
                <Download className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold mb-1">Need a template?</h4>
                  <p className="text-xs text-muted-foreground mb-3">Download our CSV template to ensure your data is formatted correctly.</p>
                  <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={handleDownloadTemplate}>
                    Download Template
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium">{file?.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs h-7">Change File</Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Preview (First 5 rows)</Label>
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {preview.length > 0 && Object.keys(preview[0]).map(header => (
                            <TableHead key={header} className="text-[10px] whitespace-nowrap">{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row).map((val: any, j) => (
                              <TableCell key={j} className="text-[10px] whitespace-nowrap">{val}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Link to Voyage (Optional)</Label>
                <Select value={voyageId} onValueChange={setVoyageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select voyage..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {voyages.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.vesselName} — {v.status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {step === 2 && (
            <Button 
              onClick={handleImport} 
              disabled={isImporting}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <TableIcon className="w-4 h-4" />
                  Confirm Import
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
