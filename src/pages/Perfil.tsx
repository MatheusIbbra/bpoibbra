import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Save, Loader2, Camera, Mail, Phone, Users, Calendar, MapPin, Pencil } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PrivacySection } from "@/components/profile/PrivacySection";
import { ChangePasswordCard } from "@/components/profile/ChangePasswordCard";
import { PushNotificationSettings } from "@/components/profile/PushNotificationSettings";
import { AchievementsBadges } from "@/components/profile/AchievementsBadges";
import { useCurrentUserRole } from "@/hooks/useUserRoles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

export default function Perfil() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const { data: currentRole } = useCurrentUserRole();
  const isStaff = currentRole && currentRole !== "cliente";

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, phone, cpf, birth_date, gender, address")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [uploading, setUploading] = useState(false);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  useEffect(() => {
    if (profile) {
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.phone) setPhone(formatPhone(profile.phone));
      if ((profile as any)?.gender) setGender((profile as any).gender);
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async (data: { fullName: string; phone: string; gender: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: data.fullName, phone: data.phone, gender: data.gender })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-profile"] });
      toast.success("Perfil atualizado com sucesso!");
      setEditing(false);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar perfil: " + error.message);
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 2MB"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-profile"] });
      toast.success("Foto atualizada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ fullName, phone, gender });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const genderLabel = (g: string | null | undefined) => {
    if (!g) return "Não informado";
    const map: Record<string, string> = { male: "Masculino", female: "Feminino", other: "Outro", prefer_not_say: "Prefiro não informar" };
    return map[g] || g;
  };

  if (isLoading) {
    return (
      <AppLayout title="Perfil">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Perfil">
      <div className="max-w-lg mx-auto space-y-5 pb-8">
        {/* ── Profile Card ── */}
        <Card className="overflow-hidden">
          <div className="h-20 w-full" style={{ background: "linear-gradient(135deg, hsl(var(--brand-deep)), hsl(var(--brand-highlight)))" }} />
          <CardContent className="relative pt-0 pb-6 px-6">
            {/* Avatar centered, overlapping banner */}
            <div className="flex justify-center -mt-12 mb-4">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-card shadow-lg">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback
                    className="text-xl font-bold"
                    style={{ backgroundColor: "hsl(var(--brand-deep))", color: "white" }}
                  >
                    {getInitials(profile?.full_name || fullName)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
            </div>

            {/* Name & email */}
            <div className="text-center mb-5">
              <h2 className="text-lg font-semibold text-foreground">{profile?.full_name || "Usuário"}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>

            {!editing ? (
              <>
                {/* Read-only info rows */}
                <div className="space-y-3">
                  <InfoRow icon={Phone} label="Telefone" value={profile?.phone ? formatPhone(profile.phone) : "Não informado"} />
                  <InfoRow icon={Users} label="Sexo" value={genderLabel((profile as any)?.gender)} />
                  {(profile as any)?.birth_date && (
                    <InfoRow icon={Calendar} label="Nascimento" value={format(new Date((profile as any).birth_date + "T12:00:00"), "dd/MM/yyyy")} />
                  )}
                  {(profile as any)?.cpf && (
                    <InfoRow icon={Mail} label="CPF" value={(profile as any).cpf} />
                  )}
                  {(profile as any)?.address && (
                    <InfoRow icon={MapPin} label="Endereço" value={(profile as any).address} />
                  )}
                </div>

                <Button
                  onClick={() => setEditing(true)}
                  className="w-full mt-6"
                  variant="outline"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar dados
                </Button>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Sexo</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Feminino</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                      <SelectItem value="prefer_not_say">Prefiro não informar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex gap-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateProfile.isPending} className="flex-1">
                    {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <AchievementsBadges />
        <ChangePasswordCard />
        <PrivacySection />
        <PushNotificationSettings />
      </div>
    </AppLayout>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-secondary/20">
      <div className="h-8 w-8 rounded-lg bg-secondary/40 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">{label}</p>
        <p className="text-sm text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
