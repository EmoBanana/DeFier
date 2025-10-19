"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = (resolvedTheme ?? theme) === "dark";

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="glass card-shadow inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm text-app-foreground/80 hover:text-app-foreground transition-colors ring-1 ring-black/5 dark:ring-white/10"
    >
      {mounted && isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}


