import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { coreTestnet2 } from "@/lib/wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { injected } from "@wagmi/connectors";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { toast } = useToast();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { refetch } = authClient.useSession();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    const res = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    }, {
      onError: (ctx) => { toast({ title: "Sign in failed", description: ctx.error.message }); },
    });
    if (!res.error) {
      await refetch();
      const to = location.state?.from?.pathname ?? "/profile";
      navigate(to, { replace: true });
    }
  };

  const siwe = async () => {
    try {
      let walletAddress = address;
      if (!isConnected || !walletAddress) {
        const res = await connectAsync({ connector: injected(), chainId: coreTestnet2.id });
        walletAddress = res.accounts?.[0] as typeof address;
      }
      if (!walletAddress) throw new Error("No wallet address");

      const { data: nonceData, error: nonceErr } = await authClient.siwe.nonce({
        walletAddress,
        chainId: coreTestnet2.id,
      });
      if (nonceErr || !nonceData) throw new Error(nonceErr?.message || "Failed to get nonce");

      const message = `CoreFans SIWE\nAddress: ${walletAddress}\nNonce: ${nonceData.nonce}`;
      const signature = await signMessageAsync({ message, account: walletAddress });

      const { error: verifyErr } = await authClient.siwe.verify({
        message,
        signature,
        walletAddress,
        chainId: coreTestnet2.id,
      });
      if (verifyErr) throw new Error(verifyErr.message);

      await refetch();
      toast({ title: "Signed in with Core DAO" });
      const to = location.state?.from?.pathname ?? "/profile";
      navigate(to, { replace: true });
    } catch (e: any) {
      disconnect();
      toast({ title: "SIWE failed", description: e?.message || "Unknown error" });
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left: form column */}
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to your account</p>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <Input type="email" placeholder="you@example.com" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm">Password</label>
                  <a href="#" className="text-xs underline-offset-4 hover:underline">Forgot?</a>
                </div>
                <Input type="password" placeholder="••••••••" {...form.register("password")} />
                {form.formState.errors.password && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full">Sign In</Button>
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:flex after:items-center after:border-t">
                <span className="bg-background text-muted-foreground relative z-10 px-2">or continue with</span>
              </div>
              <Button variant="outline" className="w-full" type="button" onClick={siwe}>
                Sign in with Core DAO
              </Button>
            </form>
            <p className="text-center text-sm mt-4">
              Don’t have an account? <Link to="/signup" className="underline">Create one</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right: media column */}
      <div className="bg-muted relative hidden lg:block">
        <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-background/0 via-background/30 to-primary/20 dark:brightness-[0.9]" />
      </div>
    </div>
  );
}
