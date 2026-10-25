// Calage musical — analyse librosa dans analysis/beat_data.json (house-vibez, 122 BPM, résidu max 18,7 ms).
// Le film démarre sur le temps 112 de la piste ; le drop tombe sur le temps local 4.
export const FPS = 30;
export const BEAT_INT = 0.4917855; // s
export const SOURCE_BEAT0 = 5.9894124 + 112 * BEAT_INT; // 61.069 s : temps local 0 dans la piste
export const beatT = (n: number) => n * BEAT_INT;
export const beatF = (n: number) => Math.round(beatT(n) * FPS);
