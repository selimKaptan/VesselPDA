import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import type { Port } from "@shared/schema";

interface PortLookupInputProps {
  value: string;
  onChange: (portId: string, portName: string, portCode?: string) => void;
  placeholder?: string;
  className?: string;
  countryFilter?: string;
}

export function PortLookupInput({ value, onChange, placeholder = "Select port...", className, countryFilter }: PortLookupInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search]);

  const queryEnabled = countryFilter
    ? debouncedSearch.length >= 1
    : debouncedSearch.length >= 2;

  const { data: ports, isLoading } = useQuery<Port[]>({
    queryKey: ["/api/ports", { q: debouncedSearch, country: countryFilter ?? "" }],
    queryFn: async () => {
      if (!queryEnabled) return [];
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (countryFilter) params.set("country", countryFilter);
      const res = await fetch(`/api/ports?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: queryEnabled,
  });

  const { data: countryPorts } = useQuery<Port[]>({
    queryKey: ["/api/ports", { country: countryFilter ?? "", noSearch: true }],
    queryFn: async () => {
      if (!countryFilter) return [];
      const res = await fetch(`/api/ports?country=${encodeURIComponent(countryFilter)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!countryFilter && !debouncedSearch,
    staleTime: 5 * 60 * 1000,
  });

  const displayPorts = debouncedSearch ? ports : (countryFilter ? countryPorts : []);
  const selectedPort = displayPorts?.find((p) => p.id.toString() === value)
    ?? ports?.find((p) => p.id.toString() === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          data-testid="button-port-lookup"
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 opacity-50" />
            {selectedPort ? (
              <span className="truncate">
                {selectedPort.name} {selectedPort.code ? `(${selectedPort.code})` : ""}
              </span>
            ) : value ? (
              <span className="truncate text-muted-foreground">Port #{value}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={countryFilter ? "Liman / terminal ara..." : "Search port name or LOCODE..."}
            value={search}
            onValueChange={setSearch}
            data-testid="input-port-search"
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && !debouncedSearch && !countryFilter && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search...
              </div>
            )}
            {!isLoading && debouncedSearch && (!displayPorts || displayPorts.length === 0) && (
              <CommandEmpty>No port found.</CommandEmpty>
            )}
            <CommandGroup>
              {displayPorts?.map((port) => (
                <CommandItem
                  key={port.id}
                  value={port.id.toString()}
                  onSelect={() => {
                    onChange(port.id.toString(), port.name, port.code || undefined);
                    setOpen(false);
                  }}
                  data-testid={`item-port-${port.id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === port.id.toString() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{port.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {port.code} • {port.country}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
