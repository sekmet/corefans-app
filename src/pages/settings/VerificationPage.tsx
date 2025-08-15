import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CheckCircle2, FileUp, Mail, Phone } from "lucide-react";
import { SectionHeader } from "./common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

export default function VerificationPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [phoneNum, setPhoneNum] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const completed = useMemo(() => ({
    email: /.+@.+\..+/.test(email),
    phone: phoneNum.replace(/\D/g, "").length >= 7,
    id: !!file,
  }), [email, phoneNum, file]);

  const progress = useMemo(() => {
    const count = (completed.email ? 1 : 0) + (completed.phone ? 1 : 0) + (completed.id ? 1 : 0);
    return (count / 3) * 100;
  }, [completed]);

  function next() {
    if (step === 1 && !completed.email) return;
    if (step === 2 && !completed.phone) return;
    if (step === 3 && !completed.id) return;
    if (step < 3) setStep((s) => (s + 1) as any);
    else toast({ title: "Submitted", description: "Verification submitted. We'll notify you once reviewed." });
  }

  function back() {
    if (step > 1) setStep((s) => (s - 1) as any);
  }

  return (
    <section>
      <SectionHeader title="Verification" description="Verify your identity and get a badge." />
      <Card>
        <CardHeader>
          <CardTitle>Verification</CardTitle>
          <CardDescription>Complete each step to finish verification</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {/* Progress */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          {/* Status checklist */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={completed.email ? "default" : "secondary"} className="inline-flex items-center gap-1">
              <Mail className="size-3" /> Email
              {completed.email && <CheckCircle2 className="size-3" />}
            </Badge>
            <Badge variant={completed.phone ? "default" : "secondary"} className="inline-flex items-center gap-1">
              <Phone className="size-3" /> Phone
              {completed.phone && <CheckCircle2 className="size-3" />}
            </Badge>
            <Badge variant={completed.id ? "default" : "secondary"} className="inline-flex items-center gap-1">
              <FileUp className="size-3" /> ID
              {completed.id && <CheckCircle2 className="size-3" />}
            </Badge>
          </div>

          {/* Step content */}
          {step === 1 && (
            <div className="grid gap-2 max-w-md">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">We'll send a confirmation email.</p>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-2 max-w-md">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" placeholder="+1 555 000 1234" value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)} />
              <p className="text-xs text-muted-foreground">Use a number capable of receiving SMS.</p>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-2 max-w-md">
              <Label htmlFor="id">Government ID</Label>
              <Input id="id" type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <p className="text-xs">Selected: {file.name}</p>}
              <p className="text-xs text-muted-foreground">Accepted: Passport, Driver's License. JPG/PNG/PDF.</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" onClick={back} disabled={step === 1}>Back</Button>
            <Button onClick={next}>{step < 3 ? "Next" : "Submit"}</Button>
          </div>

          {/* Requirements checklist */}
          <div className="pt-2">
            <div className="text-sm font-medium mb-2">Requirements</div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Check className="size-4 text-muted-foreground" /> Valid email address</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-muted-foreground" /> Reachable phone number</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-muted-foreground" /> Clear government-issued ID</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
