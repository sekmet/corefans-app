import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    const res = await authClient.signUp.email(
      { name: values.name, email: values.email, password: values.password },
      { onError: (ctx) => { toast({ title: "Sign up failed", description: ctx.error.message }); } }
    );
    if (!res.error) {
      navigate("/profile", { replace: true });
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left: form column */}
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">Create your account</h1>
              <p className="text-sm text-muted-foreground">Sign up with email and password</p>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <Input placeholder="Your name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <Input type="email" placeholder="you@example.com" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">Password</label>
                <Input type="password" placeholder="••••••••" {...form.register("password")} />
                {form.formState.errors.password && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full">Create Account</Button>
            </form>
            <p className="text-center text-sm mt-4">Already have an account? <Link to="/login" className="underline">Sign in</Link></p>
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
