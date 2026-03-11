/**
 * Theme definitions for the statusline.
 *
 * Each theme provides 8 semantic color roles (RGB hex values).
 * Role names describe *purpose*, not color — so themes can
 * freely assign any hue to each role.
 */

export interface ThemePalette {
  /** Model name, primary accent */
  primary: number;
  /** Directory path, secondary info */
  secondary: number;
  /** Git branch, low-usage indicator */
  success: number;
  /** Medium-usage indicator */
  warning: number;
  /** High-usage indicator */
  caution: number;
  /** Dirty marker, critical-usage indicator */
  danger: number;
  /** Labels, supplementary text */
  muted: number;
  /** Effort high, special accent */
  accent: number;
}

export const themes: Record<string, ThemePalette> = {
  default: {
    primary: 0x0099ff,
    secondary: 0x56b6c2,
    success: 0x00af50,
    warning: 0xffb055,
    caution: 0xe6c800,
    danger: 0xff5555,
    muted: 0xdcdcdc,
    accent: 0xb48cff,
  },

  "tokyo-night": {
    primary: 0x7aa2f7,    // signature blue
    secondary: 0x7dcfff,  // light cyan — distinct but cohesive
    success: 0x787c99,    // muted gray-blue
    warning: 0xff9e64,    // TN orange
    caution: 0xe0af68,    // TN yellow
    danger: 0xf7768e,     // TN red/pink
    muted: 0x565f89,      // TN comment gray
    accent: 0xbb9af7,     // TN purple
  },

  "tokyo-night-storm": {
    primary: 0x7aa2f7,
    secondary: 0x7dcfff,
    success: 0x9ece6a,
    warning: 0xff9e64,
    caution: 0xe0af68,
    danger: 0xf7768e,
    muted: 0xc0caf5,
    accent: 0xbb9af7,
  },

  "tokyo-night-light": {
    primary: 0x34548a,
    secondary: 0x0f4b6e,
    success: 0x485e30,
    warning: 0x965027,
    caution: 0x8f5e15,
    danger: 0x8c4351,
    muted: 0x6172b0,
    accent: 0x5a4a78,
  },

  "catppuccin-mocha": {
    primary: 0x89b4fa,
    secondary: 0x94e2d5,
    success: 0xa6e3a1,
    warning: 0xfab387,
    caution: 0xf9e2af,
    danger: 0xf38ba8,
    muted: 0xcdd6f4,
    accent: 0xcba6f7,
  },

  "dracula": {
    primary: 0x6272a4,
    secondary: 0x8be9fd,
    success: 0x50fa7b,
    warning: 0xffb86c,
    caution: 0xf1fa8c,
    danger: 0xff5555,
    muted: 0xf8f8f2,
    accent: 0xbd93f9,
  },

  "solarized-dark": {
    primary: 0x268bd2,
    secondary: 0x2aa198,
    success: 0x859900,
    warning: 0xcb4b16,
    caution: 0xb58900,
    danger: 0xdc322f,
    muted: 0x93a1a1,
    accent: 0xd33682,
  },

  "gruvbox-dark": {
    primary: 0x83a598,
    secondary: 0x8ec07c,
    success: 0xb8bb26,
    warning: 0xfe8019,
    caution: 0xfabd2f,
    danger: 0xfb4934,
    muted: 0xebdbb2,
    accent: 0xd3869b,
  },

  "nord": {
    primary: 0x81a1c1,
    secondary: 0x88c0d0,
    success: 0xa3be8c,
    warning: 0xd08770,
    caution: 0xebcb8b,
    danger: 0xbf616a,
    muted: 0xd8dee9,
    accent: 0xb48ead,
  },

  "one-dark": {
    primary: 0x61afef,
    secondary: 0x56b6c2,
    success: 0x98c379,
    warning: 0xd19a66,
    caution: 0xe5c07b,
    danger: 0xe06c75,
    muted: 0xabb2bf,
    accent: 0xc678dd,
  },

  "github-dark": {
    primary: 0x58a6ff,
    secondary: 0x39d2c0,
    success: 0x3fb950,
    warning: 0xd29922,
    caution: 0xd29922,
    danger: 0xf85149,
    muted: 0xc9d1d9,
    accent: 0xbc8cff,
  },

  "kanagawa": {
    primary: 0x7e9cd8,
    secondary: 0x7fb4ca,
    success: 0x76946a,
    warning: 0xffa066,
    caution: 0xdca561,
    danger: 0xc34043,
    muted: 0xdcd7ba,
    accent: 0x957fb8,
  },

  "rose-pine": {
    primary: 0x31748f,
    secondary: 0xc4a7e7,
    success: 0x9ccfd8,
    warning: 0xea9a97,
    caution: 0xf6c177,
    danger: 0xeb6f92,
    muted: 0xe0def4,
    accent: 0xc4a7e7,
  },
};

export const themeNames = Object.keys(themes);

export function resolveTheme(name: string): ThemePalette {
  return themes[name] ?? themes["default"];
}
