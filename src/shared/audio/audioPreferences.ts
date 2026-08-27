export const parseAudioVolume = (value: string | null): number => {
  if (value === null || value.trim() === "") return 0.8;
  const volume = Number(value);
  return Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : 0.8;
};
