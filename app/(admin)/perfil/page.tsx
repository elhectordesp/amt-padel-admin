"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/admin/header";
import { ErrorState } from "@/components/admin/error-state";
import { ChangePasswordForm, ProfileForm } from "@/components/admin/account-forms";
import { MY_PROFILE_QUERY_KEY, getMyProfile } from "@/lib/account";

/** La cuenta del admin o del club: sus datos y cambiar la contraseña. */
export default function PerfilPage() {
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn:  getMyProfile,
  });

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Mi perfil" />
      <div className="flex-1 p-4 sm:p-6 space-y-5 max-w-3xl">
        {isLoading ? (
          <div className="h-56 rounded-lg bg-card animate-pulse border border-border" />
        ) : isError || !profile ? (
          <ErrorState message="No se pudieron cargar tus datos." onRetry={() => refetch()} />
        ) : (
          // key: tras guardar, el formulario arranca de los datos nuevos
          <ProfileForm key={JSON.stringify(profile)} profile={profile} />
        )}
        <ChangePasswordForm />
      </div>
    </div>
  );
}
