import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function PageBreadcrumb({ items, className }: PageBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1 text-sm text-muted-foreground", className)}
      data-testid="breadcrumb-nav"
    >
      <Link href="/" className="flex items-center hover:text-foreground transition-colors shrink-0">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
            {isLast || !item.href ? (
              <span
                className={cn(
                  "truncate max-w-[200px]",
                  isLast ? "text-foreground font-medium" : "hover:text-foreground transition-colors"
                )}
                data-testid={`breadcrumb-item-${index}`}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="truncate max-w-[200px] hover:text-foreground transition-colors"
                data-testid={`breadcrumb-item-${index}`}
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
