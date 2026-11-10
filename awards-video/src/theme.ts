export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const NAVY_DEEP = '#050d1f';
export const NAVY = '#0b1a33';
export const NAVY_LIGHT = '#16305a';
export const GOLD = '#c9a24a';
export const GOLD_LIGHT = '#f3dc95';
export const GOLD_DARK = '#8a6a26';
export const IVORY = '#f4efe3';

export const FONT = "'Jost', 'Futura PT', 'Futura', sans-serif";

// Metallic gold: a gradient plus a bright band that sweeps across.
export const goldGradient = (sweep: number) =>
	`linear-gradient(100deg, ${GOLD_DARK} 0%, ${GOLD} 25%, ${GOLD_LIGHT} 45%, ${GOLD} 60%, ${GOLD_DARK} 100%),
	 linear-gradient(100deg, transparent ${sweep - 12}%, rgba(255,250,230,0.95) ${sweep}%, transparent ${sweep + 12}%)`;

export const INTRO_SECONDS = 7;
export const FADE_FRAMES = 15;
/** Intro music in public/. Set to null for none. */
export const INTRO_MUSIC: string | null = 'music/intro.m4a';
export const INTRO_MUSIC_VOLUME = 0.9;
export const OUTRO_FRAMES = 30;
export const PLACEHOLDER_SECONDS = 6;
