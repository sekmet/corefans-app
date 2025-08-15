import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SectionHeader, SaveButton } from "./common";

const notificationsSchema = z.object({
  productUpdates: z.boolean().default(true),
  newFollowers: z.boolean().default(true),
  comments: z.boolean().default(true),
  tips: z.boolean().default(true),
});

type NotificationsValues = z.infer<typeof notificationsSchema>;

function ToggleRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function NotificationsPage() {
  const notifForm = useForm<NotificationsValues>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: { productUpdates: true, newFollowers: true, comments: true, tips: true },
  });

  function onSave(values: NotificationsValues) {}

  return (
    <section>
      <SectionHeader title="Notifications" description="Choose what you want to be notified about." />
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Push and email notifications for activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-indigo-200 text-indigo-800 hover:bg-indigo-300 border-none"
              onClick={() => {
                notifForm.setValue("productUpdates", true);
                notifForm.setValue("newFollowers", true);
                notifForm.setValue("comments", true);
                notifForm.setValue("tips", true);
              }}
            >
              Enable all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-indigo-200 text-indigo-800 hover:bg-indigo-300 border-none"
              onClick={() => {
                notifForm.setValue("productUpdates", false);
                notifForm.setValue("newFollowers", false);
                notifForm.setValue("comments", false);
                notifForm.setValue("tips", false);
              }}
            >
              Disable all
            </Button>
          </div>
          <ToggleRow label="Product updates" description="News, features, and announcements">
            <Switch checked={notifForm.watch("productUpdates")} onCheckedChange={(v) => notifForm.setValue("productUpdates", v)} />
          </ToggleRow>
          <ToggleRow label="New followers" description="When someone follows you">
            <Switch checked={notifForm.watch("newFollowers")} onCheckedChange={(v) => notifForm.setValue("newFollowers", v)} />
          </ToggleRow>
          <ToggleRow label="Comments" description="When someone comments on your post">
            <Switch checked={notifForm.watch("comments")} onCheckedChange={(v) => notifForm.setValue("comments", v)} />
          </ToggleRow>
          <ToggleRow label="Tips" description="When someone tips you">
            <Switch checked={notifForm.watch("tips")} onCheckedChange={(v) => notifForm.setValue("tips", v)} />
          </ToggleRow>
          <div className="pt-2">
            <SaveButton variant="outline" onClick={notifForm.handleSubmit(onSave)} loading={notifForm.formState.isSubmitting}>Save preferences</SaveButton>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
