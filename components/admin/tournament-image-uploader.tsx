"use client";

import { useRef, useState } from "react";
import { ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";

interface Props {
  value?: string;
  onChange: (url: string) => void;
}

export function TournamentImageUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se admiten imágenes (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La imagen no puede superar 8 MB");
      return;
    }

    setUploading(true);
    try {
      const { imageUrl } = await adminService.upload.tournamentImage(file);
      onChange(imageUrl);
      toast.success("Imagen subida correctamente");
    } catch {
      toast.error("Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-border aspect-[1200/630] bg-secondary">
          <img
            src={value}
            alt="Banner del torneo"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-white/90 text-black font-semibold hover:bg-white"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-black/70 text-white font-semibold hover:bg-black border border-white/30"
            >
              <X size={13} /> Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-[1200/630] rounded-lg border-2 border-dashed border-border hover:border-[#D4AF37] hover:bg-[rgba(212,175,55,0.03)] transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-[#D4AF37]"
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              <span className="text-xs">Subiendo…</span>
            </>
          ) : (
            <>
              <ImageIcon size={24} />
              <span className="text-xs font-medium">Subir imagen del torneo</span>
              <span className="text-[10px]">JPG, PNG o WebP · máx. 8 MB · 1200×630 recomendado</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
