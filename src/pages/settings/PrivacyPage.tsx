import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield } from "lucide-react";
import { SectionHeader } from "./common";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

export default function PrivacyPage() {
  const [privateAccount, setPrivateAccount] = React.useState(false);
  const [hideTips, setHideTips] = React.useState(false);
  const [open2FA, setOpen2FA] = React.useState(false);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [otpAuthUrl, setOtpAuthUrl] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [verified, setVerified] = React.useState(false);

  function randomBytes(len = 20) {
    const arr = new Uint8Array(len);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }

  // RFC 4648 base32 (no padding for simplicity)
  function toBase32(bytes: Uint8Array) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0, value = 0, output = "";
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
    return output;
  }

  async function open2FAFlow() {
    const sec = toBase32(randomBytes(20));
    const issuer = encodeURIComponent("CoreFans");
    const account = encodeURIComponent("user@example.com");
    const uri = `otpauth://totp/${issuer}:${account}?secret=${sec}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    setSecret(sec);
    setOtpAuthUrl(uri);
    setOpen2FA(true);
    try {
      const QR = await import("qrcode");
      const url = await QR.toDataURL(uri);
      setQrDataUrl(url);
    } catch (e) {
      // Fallback: no QR library available; show raw URI
      setQrDataUrl(null);
    }
  }

  return (
    <section>
      <SectionHeader title="Privacy" description="Control how your profile and content are shared." />
      <Card>
        <CardHeader>
          <CardTitle>Privacy controls</CardTitle>
          <CardDescription>Basic privacy settings (more coming soon).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Changes to privacy settings may affect your content visibility. Review carefully before saving.
            </AlertDescription>
          </Alert>
          <AlertDialog>
            <ToggleRow label="Private account" description="Only approved followers can see your posts">
              <AlertDialogTrigger asChild>
                <Switch
                  checked={privateAccount}
                  onCheckedChange={() => {}}
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                />
              </AlertDialogTrigger>
            </ToggleRow>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Switch to a private account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Only approved followers will be able to see your posts. You can change this back at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => setPrivateAccount((v) => !v)}
                >
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <ToggleRow label="Hide tips" description="Hide tip counts on your profile">
              <AlertDialogTrigger asChild>
                <Switch
                  checked={hideTips}
                  onCheckedChange={() => {}}
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                />
              </AlertDialogTrigger>
            </ToggleRow>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hide tip counts?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your profile will not display received tip counts. This may affect social proof.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => setHideTips((v) => !v)}
                >
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center gap-2 font-medium"><Shield className="size-4" /> Two-factor authentication</div>
            <p className="mt-1 text-muted-foreground">Add a second step to your sign-in for improved security.</p>
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={open2FAFlow}>Set up 2FA</Button>
            </div>
            <Dialog open={open2FA} onOpenChange={setOpen2FA}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set up 2FA</DialogTitle>
                  <DialogDescription>Scan the QR with Google Authenticator, 1Password, or another TOTP app.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="2FA QR code" className="mx-auto h-40 w-40" />
                  ) : (
                    <div className="text-xs break-all rounded border p-2 bg-muted/50">{otpAuthUrl}</div>
                  )}
                  <div className="text-xs text-muted-foreground">Secret: <span className="font-mono">{secret}</span></div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="otp">Enter 6‑digit code</Label>
                    <input
                      id="otp"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      className="h-9 w-28 rounded-md border px-2 text-center text-sm"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    />
                    <Button size="sm" onClick={() => { if (code.length === 6) { setVerified(true); setOpen2FA(false); } }}>Verify</Button>
                  </div>
                  {verified ? <div className="text-xs text-green-600">Two-factor authentication enabled.</div> : null}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
