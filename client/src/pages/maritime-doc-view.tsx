import { useParams, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaritimeDocEditor } from "@/components/maritime-doc-editor";

export default function MaritimeDocView() {
  const { id } = useParams<{ id: string }>();
  const docId = parseInt(id ?? "0");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-5">
          <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
            <Link href="/voyages">
              <ArrowLeft className="w-4 h-4" /> Back to Voyages
            </Link>
          </Button>
        </div>

        {docId > 0 ? (
          <MaritimeDocEditor docId={docId} />
        ) : (
          <div className="text-center py-16 text-muted-foreground">Invalid document ID.</div>
        )}
      </div>
    </div>
  );
}
