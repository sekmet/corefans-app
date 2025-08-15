import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { SectionHeader, SaveButton } from "./common";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Use upper, lower, and a number"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((val) => val.newPassword === val.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

function getPasswordStrength(pwd?: string) {
  if (!pwd) return { percent: 0, label: "Password strength" };
  let score = 0;
  if (pwd.length >= 8) score += 25;
  if (/[A-Z]/.test(pwd)) score += 25;
  if (/[a-z]/.test(pwd)) score += 25;
  if (/\d/.test(pwd)) score += 25;
  const labels = ["Very weak", "Weak", "Okay", "Good", "Strong"];
  const idx = Math.min(4, Math.floor(score / 25));
  return { percent: score, label: labels[idx] };
}

export default function AccountPage() {
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onChange",
  });

  const strength = getPasswordStrength(passwordForm.watch("newPassword"));

  function onSavePassword(values: PasswordFormValues) {
    toast({ title: "Password updated", description: "Your password was changed successfully." });
    passwordForm.reset();
  }

  return (
    <section>
      <SectionHeader title="Account & Password" description="Update your password and secure your account." />
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use a strong password with upper/lowercase and numbers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onSavePassword)} className="grid gap-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type={showCurrent ? "text" : "password"} {...field} />
                      </FormControl>
                      <Button type="button" variant="outline" onClick={() => setShowCurrent((v) => !v)}>
                        {showCurrent ? "Hide" : "Show"}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type={showNew ? "text" : "password"} {...field} />
                      </FormControl>
                      <Button type="button" variant="outline" onClick={() => setShowNew((v) => !v)}>
                        {showNew ? "Hide" : "Show"}
                      </Button>
                    </div>
                    <Progress value={strength.percent} className="h-2" />
                    <p className="text-xs text-muted-foreground">{strength.label}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type={showConfirm ? "text" : "password"} {...field} />
                      </FormControl>
                      <Button type="button" variant="outline" onClick={() => setShowConfirm((v) => !v)}>
                        {showConfirm ? "Hide" : "Show"}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <SaveButton type="submit" loading={passwordForm.formState.isSubmitting}>Save changes</SaveButton>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </section>
  );
}
