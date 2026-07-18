export const createSpectrogramColorLut = (size = 256) => Array.from(
  { length: size },
  (_, index) => {
    const unit = index / Math.max(1, size - 1);
    const hue = 30 - unit * 14;
    const saturation = 60 + unit * 30;
    const lightness = 6 + unit * 66;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
);

export const createSpectrogramRowRuns = ({ height, cells }) => {
  const runs = new Uint16Array(cells * 2);
  for (let cell = 0; cell < cells; cell += 1) {
    const sourceStart = Math.ceil((cell * height) / cells);
    const sourceEnd = Math.ceil(((cell + 1) * height) / cells);
    runs[cell * 2] = height - sourceEnd;
    runs[cell * 2 + 1] = sourceEnd - sourceStart;
  }
  return runs;
};
