import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Download, Eye, Trash2, Search, Calendar, Ship } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { useState } from "react";
import type { Proforma } from "@shared/schema";

export default function Proformas() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { data: proformas, isLoading } = useQuery<Proforma[]>({ queryKey: ["/api/proformas"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/proformas/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
      toast({ title: "Proforma deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const filteredProformas = proformas?.filter((p) =>
    p.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.toCompany?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cargoType?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const statusColors: Record<string, string> = {
    draft: "secondary",
    sent: "default",
    approved: "default",
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-proformas-title">Proforma Invoices</h1>
          <p className="text-muted-foreground text-sm">Manage your proforma disbursement accounts.</p>
        </div>
        <Link href="/proformas/new">
          <Button className="gap-2" data-testid="button-new-proforma">
            <Plus className="w-4 h-4" /> New Proforma
          </Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search proformas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-proformas"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filteredProformas.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead className="hidden md:table-cell">To</TableHead>
                <TableHead className="hidden sm:table-cell">Purpose</TableHead>
                <TableHead>Total (USD)</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProformas.map((pda) => (
                <TableRow key={pda.id} data-testid={`row-proforma-list-${pda.id}`}>
                  <TableCell className="font-medium">{pda.referenceNumber}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{pda.toCompany || "-"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary" className="text-xs">{pda.purposeOfCall}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">${pda.totalUsd?.toLocaleString()}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={statusColors[pda.status] as any || "secondary"} className="text-xs capitalize">{pda.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {pda.createdAt ? new Date(pda.createdAt).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/proformas/${pda.id}`}>
                        <Button size="icon" variant="ghost" data-testid={`button-view-proforma-${pda.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(pda.id)} data-testid={`button-delete-proforma-${pda.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center space-y-4">
          <FileText className="w-16 h-16 text-muted-foreground/20 mx-auto" />
          <div>
            <h3 className="font-serif font-semibold text-lg">No Proformas Found</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {searchTerm ? "No proformas match your search." : "Create your first proforma to get started."}
            </p>
          </div>
          {!searchTerm && (
            <Link href="/proformas/new">
              <Button className="gap-2" data-testid="button-create-first-proforma-list">
                <Plus className="w-4 h-4" /> Create Proforma
              </Button>
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
