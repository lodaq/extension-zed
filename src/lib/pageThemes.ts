export type PageThemeColors = {
  background: string
  text: string
  surface: string
  accent: string
  accentText: string
  border: string
}

export type PageTheme = {
  id: string
  name: string
  mode: "light" | "dark"
  colors: PageThemeColors
}

/**
 * shadcn/ui-inspired palettes in hex for use on pages without shadcn tokens.
 */
export const PAGE_THEMES = Object.freeze([
  {
    id: "vercel",
    name: "Vercel",
    mode: "dark",
    colors: {
      background: "#0a0a0a",
      text: "#fafafa",
      surface: "#171717",
      accent: "#e5e5e5",
      accentText: "#171717",
      border: "#232323",
    },
  },
  {
    id: "supabase",
    name: "Supabase",
    mode: "dark",
    colors: {
      background: "#0a0a0a",
      text: "#fafafa",
      surface: "#171717",
      accent: "#00bc7d",
      accentText: "#0a0a0a",
      border: "#232323",
    },
  },
  {
    id: "claude",
    name: "Claude",
    mode: "light",
    colors: {
      background: "#ffffff",
      text: "#0c0a09",
      surface: "#f3f1f1",
      accent: "#ca3500",
      accentText: "#fff7ed",
      border: "#e8e4e3",
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    mode: "dark",
    colors: {
      background: "#0c090c",
      text: "#fafafa",
      surface: "#1d161e",
      accent: "#c4b4ff",
      accentText: "#0c090c",
      border: "#242324",
    },
  },
] as const satisfies readonly PageTheme[])

export function getPageTheme(id: unknown): PageTheme | undefined {
  return PAGE_THEMES.find((theme) => theme.id === id)
}
