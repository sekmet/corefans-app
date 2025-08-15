import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Search } from "lucide-react";
import { SectionHeader } from "./common";
import { useUserDisplay } from "./hooks";
import { useToast } from "@/components/ui/use-toast";
import { DEMO_REFERRALS } from "./demo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function ReferralsPage() {
  const { name } = useUserDisplay();
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  function copyReferral() {
    const link = `${window.location.origin}/signup?ref=${encodeURIComponent(name.toLowerCase())}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Copied", description: "Referral link copied to clipboard." });
    });
  }

  const stats = useMemo(() => {
    const clicks = DEMO_REFERRALS.length * 5; // demo
    const signed = DEMO_REFERRALS.filter((r) => r.status !== "clicked").length;
    const converted = DEMO_REFERRALS.filter((r) => r.status === "converted").length;
    const earnings = DEMO_REFERRALS.reduce((acc, r) => acc + r.earnings, 0);
    return { clicks, signed, converted, earnings };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEMO_REFERRALS;
    return DEMO_REFERRALS.filter((r) =>
      r.name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q) || r.status.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <section>
      <SectionHeader title="Referrals" description="Invite friends and earn rewards." />
      <Card>
        <CardHeader>
          <CardTitle>Share your link</CardTitle>
          <CardDescription>Copy your unique referral link.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 max-w-xl">
          <div className="flex items-center gap-2">
            <Input readOnly value={`${window.location.origin}/signup?ref=${name.toLowerCase()}`} />
            <Button type="button" variant="outline" size="icon" onClick={copyReferral}>
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Share this link with your audience.</p>
        </CardContent>
      </Card>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Clicks</CardDescription>
            <CardTitle className="text-xl">{stats.clicks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Sign-ups</CardDescription>
            <CardTitle className="text-xl">{stats.signed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Conversions</CardDescription>
            <CardTitle className="text-xl">{stats.converted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardDescription>Earnings</CardDescription>
            <CardTitle className="text-xl">${stats.earnings.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <div className="mt-4 max-w-xl">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input placeholder="Search referrals by name, @username or status" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {/* Referral list */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Referral list</CardTitle>
          <CardDescription>Your latest referred users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarFallback>{r.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">@{r.username}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{r.joined}</TableCell>
                    <TableCell>
                      <Badge variant={r.earnings > 0 ? "default" : "secondary"}>${r.earnings.toFixed(2)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "converted" ? "default" : r.status === "signed_up" ? "secondary" : "outline"}>
                        {r.status}
                      </Badge>
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
