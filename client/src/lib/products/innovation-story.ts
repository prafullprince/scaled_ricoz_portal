// `cue` is the fraction of the source video at which its path changes direction or branches
// (start ring, first crossing marker, second crossing marker, fan-out of new paths).
export const innovationStory = [
  { cue: 0, label: "Start with a real need", lines: ["Every useful product", "starts with a question."], thought: "What could work better for the people using it?" },
  { cue: 0.31, label: "Explore a new direction", lines: ["Different perspectives.", "Better possibilities."], thought: "We connect business understanding with product thinking." },
  { cue: 0.45, label: "Engineer the idea", lines: ["Turn clear thinking", "into useful technology."], thought: "Purposeful engineering brings the idea into focus." },
  { cue: 0.58, label: "Build what comes next", lines: ["Innovation is a journey.", "Keep building forward."], thought: "Learn. Refine. Build around real business needs." },
] as const;

// Position of the travelling light in the source frame (0–1 of video width/height), sampled from the video.
const pathTrack = [
  [0, 0.84, 0.685], [0.06, 0.8, 0.665], [0.1, 0.775, 0.657], [0.2, 0.716, 0.636], [0.3, 0.676, 0.618],
  [0.36, 0.637, 0.602], [0.44, 0.605, 0.588], [0.5, 0.567, 0.574], [0.56, 0.551, 0.568], [0.6, 0.532, 0.555],
  [0.7, 0.495, 0.543], [0.8, 0.459, 0.528], [0.9, 0.43, 0.512], [1, 0.391, 0.498],
] as const;

function loopFraction(time: number, duration: number) {
  const length = Number.isFinite(duration) && duration > 0 ? duration : 10;
  const elapsed = Number.isFinite(time) && time >= 0 ? time : 0;
  return (elapsed % length) / length;
}

export function innovationFrame(time: number, duration: number) {
  const fraction = loopFraction(time, duration);
  let index = 0;
  while (index + 1 < innovationStory.length && fraction >= innovationStory[index + 1].cue) index++;
  const start = innovationStory[index].cue;
  const end = index + 1 < innovationStory.length ? innovationStory[index + 1].cue : 1;
  return { index, progress: (fraction - start) / (end - start) };
}

export function innovationPathPoint(time: number, duration: number) {
  const fraction = loopFraction(time, duration);
  let segment = 0;
  while (segment + 2 < pathTrack.length && fraction >= pathTrack[segment + 1][0]) segment++;
  const [t0, x0, y0] = pathTrack[segment];
  const [t1, x1, y1] = pathTrack[segment + 1];
  const mix = Math.min(1, Math.max(0, (fraction - t0) / (t1 - t0)));
  return { x: x0 + (x1 - x0) * mix, y: y0 + (y1 - y0) * mix };
}

// The cue point where the current thought's path change happens.
export function innovationAnchor(index: number) {
  const cue = innovationStory[Math.min(Math.max(index, 0), innovationStory.length - 1)].cue;
  return innovationPathPoint(cue, 1);
}

// Hero video `object-position`; keeps the travelling light visible when narrow screens crop the sides.
export const innovationVideoFocus = { x: 0.78, y: 0.5 } as const;
