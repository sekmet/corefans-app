import React from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionHeader, SaveButton } from "./common";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

export default function RatesPage() {
  const { toast } = useToast();
  const ratesForm = useForm<{ paid: boolean; price: number; promoPrice?: number | ""; promoRange?: DateRange | undefined }>({
    defaultValues: { paid: false, price: 5, promoPrice: "", promoRange: undefined },
    mode: "onChange",
  });

  function onSave(values: { paid: boolean; price: number; promoPrice?: number | ""; promoRange?: DateRange | undefined }) {
    if (!values.paid && (!values.price || values.price < 0)) {
      toast({ title: "Invalid", description: "Enter a valid price.", variant: "destructive" as any });
      return;
    }
    toast({ title: "Pricing saved", description: "Your pricing settings have been updated." });
  }

  return (
    <section>
      <SectionHeader title="Rates & Pricing" description="Set your pricing and promotions." />
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Configure monetization settings (coming soon).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 max-w-xl">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Paid profile</div>
              <p className="text-xs text-muted-foreground">Enable to charge for access to your content.</p>
            </div>
            <Switch checked={ratesForm.watch("paid")} onCheckedChange={(v) => ratesForm.setValue("paid", v)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="monthlyPrice">Monthly price (USD)</Label>
            <Input id="monthlyPrice" type="number" step="0.5" min={0} {...ratesForm.register("price", { valueAsNumber: true })} />
          </div>
          {/* Pricing tiers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[5, 10, 20].map((v) => (
              <Card key={v} className="cursor-pointer transition hover:shadow" onClick={() => ratesForm.setValue("price", v)}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">${v}/mo</CardTitle>
                  <CardDescription>Recommended</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="promoPrice">Promo price (optional)</Label>
            <Input id="promoPrice" type="number" step="0.5" min={0} {...ratesForm.register("promoPrice", { valueAsNumber: true })} />
          </div>
          {/* Promo date range */}
          <div className="grid gap-2">
            <Label>Promotion period</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <CalendarIcon className="mr-2 size-4" />
                  {ratesForm.watch("promoRange")?.from && ratesForm.watch("promoRange")?.to
                    ? `${ratesForm.watch("promoRange")!.from!.toLocaleDateString()} – ${ratesForm.watch("promoRange")!.to!.toLocaleDateString()}`
                    : "Select range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0">
                <Calendar
                  mode="range"
                  selected={ratesForm.watch("promoRange")}
                  onSelect={(r) => ratesForm.setValue("promoRange", r)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="pt-2">
            <SaveButton onClick={ratesForm.handleSubmit(onSave)} loading={ratesForm.formState.isSubmitting}>Save pricing</SaveButton>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
