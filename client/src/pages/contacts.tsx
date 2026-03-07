import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Users, 
  UserPlus, 
  Search, 
  LayoutGrid, 
  List, 
  Star, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Download,
  Filter,
  Check,
  Building2,
  Anchor,
  Ship,
  Briefcase
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertBrokerContactSchema, type BrokerContact } from "@shared/schema";
import { exportToCsv } from "@/lib/export-csv";
import { fmtDate } from "@/lib/formatDate";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export default function ContactsPage() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<BrokerContact | null>(null);

  const { data: contacts = [], isLoading } = useQuery<BrokerContact[]>({
    queryKey: ["/api/broker-contacts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/broker-contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker-contacts"] });
      toast({ title: "Success", description: "Contact created successfully" });
      setIsCreateDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/broker-contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker-contacts"] });
      toast({ title: "Success", description: "Contact updated successfully" });
      setEditingContact(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/broker-contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker-contacts"] });
      toast({ title: "Success", description: "Contact deleted successfully" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertBrokerContactSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      contactType: "shipowner",
      email: "",
      phone: "",
      mobile: "",
      country: "",
      city: "",
      address: "",
      website: "",
      vesselTypes: "",
      tradeRoutes: "",
      rating: 0,
      isFavorite: false,
      notes: "",
    },
  });

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch = 
        contact.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.contactName?.toLowerCase() || "").includes(searchQuery.toLowerCase());
      
      const matchesType = typeFilter === "all" || contact.contactType === typeFilter;
      const matchesFavorite = !showFavoritesOnly || contact.isFavorite;

      return matchesSearch && matchesType && matchesFavorite;
    });
  }, [contacts, searchQuery, typeFilter, showFavoritesOnly]);

  const stats = useMemo(() => {
    return {
      total: contacts.length,
      shipowners: contacts.filter(c => c.contactType === "shipowner").length,
      charterers: contacts.filter(c => c.contactType === "charterer").length,
      thisMonth: contacts.filter(c => {
        const date = new Date(c.createdAt || "");
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length
    };
  }, [contacts]);

  const handleExport = () => {
    exportToCsv("broker_contacts.csv", filteredContacts);
  };

  const handleEdit = (contact: BrokerContact) => {
    setEditingContact(contact);
    form.reset({
      companyName: contact.companyName,
      contactName: contact.contactName || "",
      contactType: contact.contactType as any,
      email: contact.email || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      country: contact.country || "",
      city: contact.city || "",
      address: contact.address || "",
      website: contact.website || "",
      vesselTypes: contact.vesselTypes || "",
      tradeRoutes: contact.tradeRoutes || "",
      rating: contact.rating || 0,
      isFavorite: contact.isFavorite || false,
      notes: contact.notes || "",
    });
  };

  const onSubmit = (data: any) => {
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleFavorite = (contact: BrokerContact) => {
    updateMutation.mutate({ 
      id: contact.id, 
      data: { isFavorite: !contact.isFavorite } 
    });
  };

  const getContactIcon = (type: string) => {
    switch (type) {
      case "shipowner": return <Ship className="w-4 h-4" />;
      case "charterer": return <Anchor className="w-4 h-4" />;
      case "broker": return <Briefcase className="w-4 h-4" />;
      default: return <Building2 className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contact Book</h1>
          <p className="text-muted-foreground">Manage your business contacts and CRM.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isCreateDialogOpen || !!editingContact} onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              setEditingContact(null);
              form.reset();
            } else {
              setIsCreateDialogOpen(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-contact">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                <DialogDescription>
                  Enter the details of the contact below.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-company-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-contact-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-contact-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="shipowner">Shipowner</SelectItem>
                              <SelectItem value="charterer">Charterer</SelectItem>
                              <SelectItem value="broker">Broker</SelectItem>
                              <SelectItem value="operator">Operator</SelectItem>
                              <SelectItem value="trader">Trader</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-mobile" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-country" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vesselTypes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vessel Types / Interests</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Bulk, Tanker" data-testid="input-vessel-types" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tradeRoutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trade Routes</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Med, Black Sea" data-testid="input-trade-routes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-contact">
                      {editingContact ? "Update Contact" : "Create Contact"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-1">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-1">
            <CardTitle className="text-sm font-medium">Shipowners</CardTitle>
            <Ship className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.shipowners}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-1">
            <CardTitle className="text-sm font-medium">Charterers</CardTitle>
            <Anchor className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.charterers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-1">
            <CardTitle className="text-sm font-medium">Added This Month</CardTitle>
            <UserPlus className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies or names..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-filter-type">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="shipowner">Shipowners</SelectItem>
              <SelectItem value="charterer">Charterers</SelectItem>
              <SelectItem value="broker">Brokers</SelectItem>
              <SelectItem value="operator">Operators</SelectItem>
              <SelectItem value="trader">Traders</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant={showFavoritesOnly ? "default" : "outline"} 
            size="icon"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="shrink-0"
            data-testid="button-filter-favorites"
          >
            <Star className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
          </Button>
        </div>
        <div className="flex items-center border rounded-md p-1 bg-muted/50">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 px-2"
            data-testid="button-view-grid"
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 px-2"
            data-testid="button-view-list"
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">No contacts found</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Try adjusting your search or filters, or add a new contact to your book.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => setIsCreateDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add First Contact
          </Button>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="group hover-elevate transition-all overflow-visible">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/5 text-primary">
                      {contact.companyName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                      {contact.companyName}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-0.5">
                      {getContactIcon(contact.contactType)}
                      <span className="capitalize">{contact.contactType}</span>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 no-default-hover-elevate"
                    onClick={() => toggleFavorite(contact)}
                  >
                    <Star className={`h-4 w-4 ${contact.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 no-default-hover-elevate">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(contact)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteMutation.mutate(contact.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-2 text-sm">
                  {contact.contactName && (
                    <div className="flex items-center gap-2 text-foreground">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      {contact.contactName}
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      <Mail className="w-4 h-4" />
                      {contact.email}
                    </div>
                  )}
                  {(contact.phone || contact.mobile) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {contact.phone || contact.mobile}
                    </div>
                  )}
                  {(contact.city || contact.country) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {contact.city}{contact.city && contact.country ? ", " : ""}{contact.country}
                    </div>
                  )}
                </div>

                {(contact.vesselTypes || contact.tradeRoutes) && (
                  <div className="flex flex-wrap gap-1 mt-4">
                    {contact.vesselTypes?.split(',').map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 h-4">
                        {t.trim()}
                      </Badge>
                    ))}
                    {contact.tradeRoutes?.split(',').map((r, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-1.5 h-4">
                        {r.trim()}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-2 flex justify-between items-center text-[11px] text-muted-foreground border-t bg-muted/20">
                <span>Created: {fmtDate(contact.createdAt)}</span>
                <span className="flex items-center gap-1">
                  Deals: {contact.pastDealCount || 0}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Last Deal</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 no-default-hover-elevate p-0"
                        onClick={() => toggleFavorite(contact)}
                      >
                        <Star className={`h-3 w-3 ${contact.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                      </Button>
                      {contact.companyName}
                    </div>
                  </TableCell>
                  <TableCell>{contact.contactName || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {contact.contactType}
                    </Badge>
                  </TableCell>
                  <TableCell>{contact.country || "—"}</TableCell>
                  <TableCell>{fmtDate(contact.lastDealDate)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(contact)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
