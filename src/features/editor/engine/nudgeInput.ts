export type NudgeKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export type NudgeInput = {
  x: number;
  y: number;
  heldKeys: Set<NudgeKey>;
};

export function createNudgeInput(): NudgeInput {
  return { x: 0, y: 0, heldKeys: new Set() };
}

export function pressNudgeKey(input: NudgeInput, key: NudgeKey, step: number): { x: number; y: number } {
  const x = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
  const y = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
  input.x += x;
  input.y += y;
  input.heldKeys.add(key);
  return { x, y };
}

export function releaseNudgeKey(input: NudgeInput, key: NudgeKey): boolean {
  input.heldKeys.delete(key);
  return input.heldKeys.size === 0;
}
