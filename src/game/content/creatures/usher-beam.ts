/**
 * The Usher-Bot's flashlight cone (GDD §9.3: 96 px long, 30°), shared by its gameplay
 * (usher-bot.ts: who stands in the light) and its art (usher-bot.art.ts: the cone sprites).
 * The axis tilts 8° down from the lamp so the cone sweeps the floor ahead (our choice).
 */
export const BEAM = { len: 96, half: (15 * Math.PI) / 180, tilt: (8 * Math.PI) / 180 } as const;
