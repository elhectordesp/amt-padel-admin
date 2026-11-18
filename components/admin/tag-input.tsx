"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  tags:        string[];
  /** Etiquetas que ya usa el club, para sugerirlas al escribir. */
  suggestions: string[];
  onChange:    (tags: string[]) => void;
  disabled?:   boolean;
  /** Solo se ven las etiquetas: sin quitarlas, sin campo y sin sugerencias. */
  readOnly?:   boolean;
  max?:        number;
  maxLength?:  number;
}

/**
 * Etiquetas como chips: se escribe y se añade con Intro o coma; al escribir
 * salen las que el club ya usa. No se repiten (sin distinguir mayúsculas).
 */
export function TagInput({ tags, suggestions, onChange, disabled, readOnly, max = 20, maxLength = 30 }: Props) {
  const [text, setText] = useState("");

  const typed = text.trim().toLowerCase();
  const taken = new Set(tags.map((t) => t.toLowerCase()));
  const options = suggestions
    .filter((s) => !taken.has(s.toLowerCase()) && (typed === "" || s.toLowerCase().includes(typed)))
    .slice(0, 6);

  const add = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, maxLength);
    setText("");
    if (!tag || taken.has(tag.toLowerCase()) || tags.length >= max) return;
    onChange([...tags, tag]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-sm text-muted-foreground">Sin etiquetas</span>}
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[rgba(212,175,55,0.12)] px-2.5 py-1 text-xs text-[#D4AF37]">
            {tag}
            {!readOnly && (
              <button
                type="button"
                aria-label={`Quitar la etiqueta ${tag}`}
                disabled={disabled}
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!readOnly && (
        <>
          <input
            type="text"
            aria-label="Añadir etiqueta"
            value={text}
            disabled={disabled || tags.length >= max}
            maxLength={maxLength}
            placeholder={tags.length >= max ? `Máximo ${max} etiquetas` : "Añadir etiqueta (profe, nivel 3…) y pulsar Intro"}
            onChange={(e) => {
              const v = e.target.value;
              // La coma cierra la etiqueta, como Intro
              if (v.endsWith(",")) add(v.slice(0, -1));
              else setText(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(text);
              }
            }}
            className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
          />
          {options.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Ya usadas:</span>
              {options.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => add(s)}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
