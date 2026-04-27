import React from "react";

const nord0 = "#2e3440";
const nord1 = "#3b4252";
const nord2 = "#434c5e";
const nord3 = "#4c566a";
const nord4 = "#d8dee9";
const nord5 = "#e5e9f0";
const nord6 = "#eceff4";
const nord7 = "#8fbcbb";
const nord8 = "#88c0d0";
const nord9 = "#81a1c1";
const nord10 = "#5e81ac";
const nord11 = "#bf616a";
const nord12 = "#d08770";
const nord13 = "#ebcb8b";
const nord14 = "#a3be8c";
const nord15 = "#b48ead";

export interface Theme {
  fg: { default: string; muted: string; emphasis: string };
  bg: { base: string; surface: string; overlay: string; selection: string };
  accent: { primary: string; secondary: string };
  status: { success: string; warning: string; error: string; info: string };
  border: { default: string; focused: string };
}

export const nordTheme: Theme = {
  fg: { default: nord4, muted: nord3, emphasis: nord6 },
  bg: { base: nord0, surface: nord1, overlay: nord1, selection: nord9 },
  accent: { primary: nord9, secondary: nord15 },
  status: { success: nord14, warning: nord13, error: nord11, info: nord8 },
  border: { default: nord3, focused: nord9 }
};

export const fallbackTheme: Theme = {
  fg: { default: "white", muted: "gray", emphasis: "white" },
  bg: {
    base: "black",
    surface: "black",
    overlay: "black",
    selection: "cyan"
  },
  accent: { primary: "cyan", secondary: "magenta" },
  status: { success: "green", warning: "yellow", error: "red", info: "cyan" },
  border: { default: "gray", focused: "cyan" }
};

type ColorLevel = "truecolor" | "256" | "16" | "none";

function detectColorLevel(): ColorLevel {
  if (process.env.NO_COLOR !== undefined) {
    return "none";
  }

  const colorTerm = process.env.COLORTERM;
  if (colorTerm === "truecolor" || colorTerm === "24bit") {
    return "truecolor";
  }

  const term = process.env.TERM ?? "";
  if (term.includes("256color")) {
    return "256";
  }

  return "16";
}

export function resolveTheme(): Theme {
  const colorLevel = detectColorLevel();
  if (colorLevel === "none" || colorLevel === "16") {
    return fallbackTheme;
  }

  return nordTheme;
}

export const ThemeContext = React.createContext<Theme>(nordTheme);

export function useTheme(): Theme {
  return React.useContext(ThemeContext);
}

export const ThemeProvider = ThemeContext.Provider;
