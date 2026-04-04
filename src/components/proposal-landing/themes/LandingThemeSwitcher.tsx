/**
 * LandingThemeSwitcher.tsx — Floating theme selector for /pl/:token
 * 
 * Visible only for authenticated users (vendedor logado).
 * Switches between 3 visual models via URL param ?modelo=N.
 * RB-17: no console.log
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Palette } from "lucide-react";
import { type LandingTheme, THEME_NAMES, parseModelo } from "./landingThemes";

export function LandingThemeSwitcher() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);

  const current = parseModelo(searchParams.get("modelo"));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  if (!isLoggedIn) return null;

  const switchTheme = (m: LandingTheme) => {
    const params = new URLSearchParams(searchParams);
    if (m === 1) {
      params.delete("modelo");
    } else {
      params.set("modelo", String(m));
    }
    setSearchParams(params, { replace: true });
    setOpen(false);
  };

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 9999,
    }}>
      {open && (
        <div style={{
          position: "absolute", bottom: 52, right: 0,
          background: "#1e293b", borderRadius: 12, padding: 8,
          boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column", gap: 4,
          minWidth: 160,
        }}>
          {([1, 2, 3] as LandingTheme[]).map(m => (
            <button
              key={m}
              onClick={() => switchTheme(m)}
              style={{
                background: current === m ? "rgba(245,158,11,0.15)" : "transparent",
                border: current === m ? "1px solid rgba(245,158,11,0.3)" : "1px solid transparent",
                borderRadius: 8, padding: "8px 12px",
                color: current === m ? "#F59E0B" : "#94A3B8",
                fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                textAlign: "left", transition: "all 0.15s",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {m}. {THEME_NAMES[m]}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        title="Trocar modelo visual"
        style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          border: "2px solid rgba(255,255,255,0.2)",
          color: "#0A0A0F", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 15px rgba(245,158,11,0.4)",
          transition: "all 0.2s",
        }}
      >
        <Palette style={{ width: 20, height: 20 }} />
      </button>
    </div>
  );
}
