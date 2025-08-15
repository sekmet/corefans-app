import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SectionHeader, FormError, SaveButton } from "./common";
import { useToast } from "@/components/ui/use-toast";
import { useUserDisplay } from "./hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSession } from "@/lib/auth-client";
import { getMyProfile, updateMyProfile, presignUpload, uploadFileToSignedUrl } from "@/lib/profile";

const profileSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and _ allowed"),
  website: z.string().url("Enter a valid URL").or(z.literal("")),
  country: z.string().min(1, "Select a country"),
  location: z.string().optional(),
  birthday: z.date().optional(),
  avatar: z.instanceof(File).optional().or(z.string().optional()),
  cover: z.instanceof(File).optional().or(z.string().optional()),
});

type ProfileValues = z.infer<typeof profileSchema>;

const COUNTRIES = [
  "United States",
  "Brazil",
  "United Kingdom",
  "Germany",
  "France",
  "Canada",
  "Australia",
  "India",
  "Japan",
  "South Korea",
  "Argentina",
  "Mexico",
];

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function useDropzone(onFiles: (files: FileList) => void) {
  const [dragOver, setDragOver] = useState(false);
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
    },
    [onFiles]
  );
  return { dragOver, onDragOver, onDragLeave, onDrop };
}

type CropState = { x: number; y: number; scale: number };

export default function ProfilePage() {
  const { toast } = useToast();
  const { name } = useUserDisplay();
  const { data: session } = useSession();
  const [showDemoBanner, setShowDemoBanner] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>();
  const [coverPreview, setCoverPreview] = useState<string | undefined>();
  const [avatarRef, setAvatarRef] = useState<{ bucket: string; key: string } | null>(null);
  const [coverRef, setCoverRef] = useState<{ bucket: string; key: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cropOpen, setCropOpen] = useState(false);
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, scale: 1 });
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number } | null>(null);
  const cropViewportRef = useRef<HTMLDivElement | null>(null);
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: name || "",
      username: "",
      website: "",
      location: "",
      country: "",
      birthday: undefined,
    },
    mode: "onChange",
  });
  const avatarDZ = useDropzone(async (files) => {
    const f = files?.[0];
    if (f) {
      const url = await toDataUrl(f);
      setAvatarPreview(url);
      profileForm.setValue("avatar", f as any, { shouldDirty: true });
    }
  });
  const coverDZ = useDropzone(async (files) => {
    const f = files?.[0];
    if (f) {
      const url = await toDataUrl(f);
      setCoverPreview(url);
      profileForm.setValue("cover", f as any, { shouldDirty: true });
      setCropOpen(true);
    }
  });

  async function cropCoverImage(srcUrl: string, state: CropState, outW = 1200, outH = 400): Promise<{ blob: Blob; dataUrl: string }>
  {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = srcUrl;
    });

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const baseScale = Math.max(outW / imgW, outH / imgH);
    const actualScale = baseScale * Math.max(1, state.scale);

    const srcW = outW / actualScale;
    const srcH = outH / actualScale;
    const cx = imgW / 2 - state.x / actualScale;
    const cy = imgH / 2 - state.y / actualScale;
    let sx = Math.max(0, Math.min(imgW - srcW, cx - srcW / 2));
    let sy = Math.max(0, Math.min(imgH - srcH, cy - srcH / 2));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, outW, outH);

    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.92));
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    return { blob, dataUrl };
  }

  const onStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    dragState.current = { dragging: true, startX: pt.clientX, startY: pt.clientY };
  };
  const onMoveDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragState.current?.dragging) return;
    const pt = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    const dx = pt.clientX - dragState.current.startX;
    const dy = pt.clientY - dragState.current.startY;
    dragState.current.startX = pt.clientX;
    dragState.current.startY = pt.clientY;
    setCrop((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
  };
  const onEndDrag = () => {
    if (dragState.current) dragState.current.dragging = false;
  };

  

  // Load initial profile
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const p = await getMyProfile();
        if (cancelled) return;
        // Set existing image refs and previews
        if (p.avatarBucket && p.avatarKey) setAvatarRef({ bucket: p.avatarBucket, key: p.avatarKey });
        if (p.coverBucket && p.coverKey) setCoverRef({ bucket: p.coverBucket, key: p.coverKey });
        setAvatarPreview(p.avatarUrl || undefined);
        setCoverPreview(p.coverUrl || undefined);
        // Reset form values
        profileForm.reset({
          displayName: p.displayName || name || "",
          username: p.username || "",
          website: p.website || "",
          country: p.country || "",
          location: p.location || "",
          birthday: p.birthday ? new Date(p.birthday) : undefined,
          avatar: undefined,
          cover: undefined,
        });
      } catch (e: any) {
        toast({ title: "Failed to load profile", description: e?.message || String(e), variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const onSaveProfile = async (values: ProfileValues) => {
    try {
      const userId = (session as any)?.user?.id || "me";
      // Prepare avatar upload
      let nextAvatar = avatarRef;
      const avatarFile = values.avatar instanceof File ? values.avatar : undefined;
      if (avatarFile) {
        const avatarKey = `avatars/${userId}-${Date.now()}`;
        const avatarBucket = "thumbs"; // image bucket
        const signed = await presignUpload({ bucket: avatarBucket, key: avatarKey, contentType: avatarFile.type || "application/octet-stream" });
        await uploadFileToSignedUrl(signed.url, avatarFile, avatarFile.type);
        nextAvatar = { bucket: signed.bucket, key: signed.key };
      }

      // Prepare cover upload
      let nextCover = coverRef;
      const coverFile = values.cover instanceof File ? values.cover : undefined;
      if (coverFile) {
        const coverKey = `covers/${userId}-${Date.now()}.jpg`;
        const coverBucket = "thumbs";
        const signed = await presignUpload({ bucket: coverBucket, key: coverKey, contentType: coverFile.type || "image/jpeg" });
        await uploadFileToSignedUrl(signed.url, coverFile, coverFile.type || "image/jpeg");
        nextCover = { bucket: signed.bucket, key: signed.key };
      }

      // Map birthday to YYYY-MM-DD
      const birthdayStr = values.birthday ? new Date(values.birthday).toISOString().slice(0, 10) : null;

      await updateMyProfile({
        displayName: values.displayName,
        username: values.username,
        website: values.website || "",
        country: values.country || "",
        location: values.location || "",
        birthday: birthdayStr,
        avatarBucket: nextAvatar?.bucket ?? null,
        avatarKey: nextAvatar?.key ?? null,
        coverBucket: nextCover?.bucket ?? null,
        coverKey: nextCover?.key ?? null,
      });

      // Post-save: reflect current refs and previews
      setAvatarRef(nextAvatar ?? null);
      setCoverRef(nextCover ?? null);
      // Refresh previews with fresh signed URLs from server and reset form dirty state
      try {
        const refreshed = await getMyProfile();
        setAvatarPreview(refreshed.avatarUrl || undefined);
        setCoverPreview(refreshed.coverUrl || undefined);
        profileForm.reset({
          displayName: refreshed.displayName || values.displayName,
          username: refreshed.username || values.username,
          website: refreshed.website || values.website || "",
          country: refreshed.country || values.country || "",
          location: refreshed.location || values.location || "",
          birthday: refreshed.birthday ? new Date(refreshed.birthday) : values.birthday,
          avatar: undefined,
          cover: undefined,
        });
      } catch {}
      toast({ title: "Profile saved", description: "Your profile has been updated." });
    } catch (e: any) {
      const msg = e?.message || String(e);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <section>
      <SectionHeader title="Profile" description="Update your public profile information." />
      {showDemoBanner ? (
        <Alert className="mb-3">
          <AlertTitle>Demo environment</AlertTitle>
          <AlertDescription>
            This is a demo workspace. Some changes may not persist between sessions.
          </AlertDescription>
          <div className="mt-2">
            <Button size="sm" variant="ghost" onClick={() => setShowDemoBanner(false)}>Dismiss</Button>
          </div>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>These details are visible on your profile.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <Form {...profileForm}>
            <div className="grid gap-4 max-w-xl">
              <FormField
                control={profileForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="username" {...field} />
                    </FormControl>
                    <FormDescription>This will be your unique handle.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between">
                          {field.value ? field.value : "Select location"}
                          <ChevronDown className="ml-2 size-4 opacity-70" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                        <Command>
                          <CommandInput placeholder="Search city..." />
                          <CommandEmpty>No results.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {["New York, USA", "São Paulo, Brazil", "London, UK", "Berlin, Germany", "Paris, France", "Toronto, Canada"].map((c) => (
                                <CommandItem key={c} value={c} onSelect={(v) => profileForm.setValue("location", v)}>
                                  {c}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Country combobox */}
              <FormField
                control={profileForm.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between">
                          {field.value ? field.value : "Select country"}
                          <ChevronDown className="ml-2 size-4 opacity-70" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                        <Command>
                          <CommandInput placeholder="Search country..." />
                          <CommandEmpty>No results.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {COUNTRIES.map((c) => (
                                <CommandItem
                                  key={c}
                                  value={c}
                                  onSelect={(v) => {
                                    profileForm.setValue("country", v);
                                  }}
                                >
                                  {c}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Birthday date picker */}
              <FormField
                control={profileForm.control}
                name="birthday"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Birthday</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start">
                          <CalendarIcon className="mr-2 size-4" />
                          {field.value ? field.value.toLocaleDateString() : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(d) => field.onChange(d)}
                          captionLayout="dropdown"
                          fromYear={1950}
                          toYear={new Date().getFullYear()}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>We won’t share your birthday publicly.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Avatar drag & drop */}
              <div
                className={`grid gap-2 ${avatarDZ.dragOver ? "ring-2 ring-indigo-400" : ""}`}
                onDragOver={avatarDZ.onDragOver}
                onDragLeave={avatarDZ.onDragLeave}
                onDrop={avatarDZ.onDrop}
              >
                <Label>Avatar</Label>
                <div
                  className={`flex items-center gap-4 rounded-md border p-3 ${avatarPreview ? "" : "bg-muted/50"}`}
                >
                  <Avatar className="size-16">
                    {avatarPreview ? (
                      <AvatarImage src={avatarPreview} alt="Avatar preview" />
                    ) : (
                      <AvatarFallback>{(profileForm.getValues("displayName") || "U").slice(0, 2)}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const url = await toDataUrl(f);
                          setAvatarPreview(url);
                          profileForm.setValue("avatar", f as any, { shouldDirty: true });
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Drag & drop supported.</p>
                  </div>
                </div>
              </div>

              {/* Cover upload + crop dialog scaffold */}
              <div
                className={`grid gap-2 ${coverDZ.dragOver ? "ring-2 ring-indigo-400" : ""}`}
                onDragOver={coverDZ.onDragOver}
                onDragLeave={coverDZ.onDragLeave}
                onDrop={coverDZ.onDrop}
              >
                <Label>Cover photo</Label>
                <div className="rounded-md border p-3">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover preview" className="h-32 w-full object-cover rounded" />
                  ) : (
                    <div className="h-24 w-full grid place-items-center text-sm text-muted-foreground">No cover selected</div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      id="cover"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const url = await toDataUrl(f);
                          setCoverPreview(url);
                          profileForm.setValue("cover", f as any, { shouldDirty: true });
                          setCropOpen(true);
                        }
                      }}
                    />
                    <Dialog open={cropOpen} onOpenChange={setCropOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Adjust cover</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-3">
                          {coverPreview ? (
                            <div
                              ref={cropViewportRef}
                              className="relative h-40 w-full overflow-hidden rounded bg-muted select-none cursor-grab active:cursor-grabbing"
                              onMouseDown={onStartDrag as any}
                              onMouseMove={onMoveDrag as any}
                              onMouseUp={onEndDrag}
                              onMouseLeave={onEndDrag}
                              onTouchStart={onStartDrag as any}
                              onTouchMove={onMoveDrag as any}
                              onTouchEnd={onEndDrag}
                            >
                              <img
                                src={coverPreview}
                                alt="Crop"
                                style={{ transform: `scale(${crop.scale}) translate(${crop.x}px, ${crop.y}px)` }}
                                className="h-full w-full object-cover"
                                draggable={false}
                              />
                            </div>
                          ) : null}
                          <Label htmlFor="zoom">Zoom</Label>
                          <Input
                            id="zoom"
                            type="range"
                            min={1}
                            max={2}
                            step={0.01}
                            value={crop.scale}
                            onChange={(e) => setCrop((c) => ({ ...c, scale: Number(e.target.value) }))}
                          />
                        </div>
                        <DialogFooter className="gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setCrop({ x: 0, y: 0, scale: 1 })}
                          >
                            Reset
                          </Button>
                          <Button
                            type="button"
                            onClick={async () => {
                              if (!coverPreview) return;
                              try {
                                const { blob, dataUrl } = await cropCoverImage(coverPreview, crop);
                                const croppedFile = new File([blob], "cover.jpg", { type: "image/jpeg" });
                                setCoverPreview(dataUrl);
                                profileForm.setValue("cover", croppedFile as any, { shouldDirty: true });
                                setCropOpen(false);
                                toast({ title: "Cover updated", description: "Your cropped cover was applied." });
                              } catch (e) {
                                toast({ title: "Crop failed", description: "Please try again.", variant: "destructive" });
                              }
                            }}
                          >
                            Done
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <SaveButton
                  onClick={profileForm.handleSubmit(onSaveProfile)}
                  loading={profileForm.formState.isSubmitting}
                  disabled={!profileForm.formState.isDirty || !profileForm.formState.isValid}
                >
                  Save profile
                </SaveButton>
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>
    </section>
  );
}
