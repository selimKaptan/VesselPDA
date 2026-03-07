import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtDate } from "@/lib/formatDate";

function fmtDate(dt: string | null) {
  if (!dt) return null;
  return fmtDate(dt);
}

function ExpCell({ dt }: { dt: string | null }) {
  if (!dt) return <span className="text-muted-foreground/40">—</span>;
  const now = new Date();
  const d = new Date(dt);
  const days = Math.round((d.getTime() - now.getTime()) / 86400000);
  const dateStr = fmtDate(dt) ?? "—";
  if (days < 0) return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-red-600 dark:text-red-400 font-medium cursor-default">
          {dateStr}<span className="ml-1 text-[10px]">✕</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Expired {Math.abs(days)} days ago</TooltipContent>
    </Tooltip>
  );
  if (days <= 30) return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-amber-600 dark:text-amber-400 font-medium cursor-default">
          {dateStr}<span className="ml-1 text-[10px]">⚠</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Expires in {days} days</TooltipContent>
    </Tooltip>
  );
  return <span className="text-foreground">{dateStr}</span>;
}

type StatusFilter = "all" | "on_board" | "on_leave";

export default function CrewRoster() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: roster = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/vessels/crew-roster"],
    queryFn: async () => {
      const res = await fetch("/api/vessels/crew-roster");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filtered = roster.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        (m.rank ?? "").toLowerCase().includes(q) ||
        (m.vesselName ?? "").toLowerCase().includes(q) ||
        (m.nationality ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusFilters: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "On Board", value: "on_board" },
    { label: "On Leave", value: "on_leave" },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        <div className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm p-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Users2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold">Crew Roster</h1>
              <p className="text-sm text-muted-foreground">All personnel across your fleet</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {statusFilters.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={statusFilter === f.value ? "default" : "outline"}
                onClick={() => setStatusFilter(f.value)}
                data-testid={`filter-status-${f.value}`}
              >
                {f.label}
                {f.value !== "all" && (
                  <span className="ml-1.5 text-[10px] opacity-70">
                    ({roster.filter(m => m.status === f.value || (!m.status && f.value === "on_board")).length})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, rank, vessel..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-crew-roster-search"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : `${filtered.length} crew member${filtered.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="rounded-xl border overflow-x-auto bg-card/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b">
                {["#", "Name", "Rank", "Nationality", "Status", "Vessel", "Contract End", "Passport Exp", "Book Exp", "Medical Fitness Exp"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <Skeleton className="h-4 w-full max-w-[80px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="text-center py-16 text-muted-foreground">
                      <Users2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">No crew members found</p>
                      <p className="text-xs mt-1 opacity-70">Try adjusting your search or filter</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((member: any, idx: number) => {
                const isOnLeave = member.status === "on_leave";
                return (
                  <tr
                    key={member.id}
                    className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                    data-testid={`crew-roster-row-${member.id}`}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground/60 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {member.firstName} {member.lastName}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {member.rank
                        ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-semibold">{member.rank}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {member.nationality || <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={isOnLeave
                          ? "border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:bg-amber-900/20"
                          : "border-green-300 text-green-700 bg-green-50 dark:border-green-600 dark:text-green-400 dark:bg-green-900/20"
                        }
                        data-testid={`status-${member.id}`}
                      >
                        {isOnLeave ? "On Leave" : "On Board"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {member.vesselName
                        ? <span className="font-medium text-primary/80">{member.vesselName}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <ExpCell dt={member.contractEndDate} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <ExpCell dt={member.passportExpiry} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <ExpCell dt={member.seamansBookExpiry} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <ExpCell dt={member.medicalFitnessExpiry} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
