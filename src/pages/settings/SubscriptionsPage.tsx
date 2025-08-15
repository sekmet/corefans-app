import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "./common";
import { DEMO_SUBSCRIPTIONS } from "./demo";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search } from "lucide-react";

function Placeholder() {
  return <div className="text-sm text-muted-foreground">This section is under construction. Stay tuned!</div>;
}

export default function SubscriptionsPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  const stats = useMemo(() => {
    const total = DEMO_SUBSCRIPTIONS.length;
    const active = DEMO_SUBSCRIPTIONS.filter((s) => s.status === "active").length;
    const canceled = DEMO_SUBSCRIPTIONS.filter((s) => s.status === "canceled").length;
    const mrr = DEMO_SUBSCRIPTIONS.filter((s) => s.status === "active").reduce((a, s) => a + s.price, 0);
    return { total, active, canceled, mrr };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEMO_SUBSCRIPTIONS.filter((s) => {
      const matchesQ = !q || s.plan.toLowerCase().includes(q) || s.status.toLowerCase().includes(q);
      const matchesStatus = status === "all" || s.status === status;
      return matchesQ && matchesStatus;
    });
  }, [query, status]);

  function handleAction(id: string, action: "cancel" | "renew" | "modify") {
    toast({ title: "Action", description: `${action} requested for subscription ${id}` });
  }

  return (
    <section>
      <SectionHeader title="Subscriptions" description="Manage your subscriptions." />

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Canceled</CardDescription>
            <CardTitle className="text-xl">{stats.canceled}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>MRR</CardDescription>
            <CardTitle className="text-xl">${stats.mrr.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>Manage current plans and renewals</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-3">
            <div className="flex items-center gap-2 max-w-sm w-full">
              <Search className="size-4 text-muted-foreground" />
              <Input placeholder="Search by plan or status" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="min-w-[180px]">
              <Select value={status} onValueChange={(v) => setStatus(v)}>
                <SelectTrigger aria-label="Status filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Renews</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.plan}</TableCell>
                    <TableCell>{s.started}</TableCell>
                    <TableCell>{s.renews}</TableCell>
                    <TableCell>${s.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {s.status === "active" ? (
                            <DropdownMenuItem onClick={() => handleAction(s.id, "cancel")}>Cancel</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleAction(s.id, "renew")}>Renew</DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleAction(s.id, "modify")}>Modify</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
