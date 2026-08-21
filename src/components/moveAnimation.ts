import type { Move, MoveStep, Position } from "../game/types";

export const MOVE_ANIMATION_STEP_MS = 310;
export const CAPTURE_ANIMATION_STEP_MS = 360;
export const MOVE_ANIMATION_SETTLE_MS = 160;
export const REDUCED_MOTION_LAST_MOVE_MS = 650;

export type VisualMoveStep = MoveStep & {
  index: number;
};

export function getVisualMoveSteps(move: Move): VisualMoveStep[] {
  const steps = move.steps.length > 0 ? move.steps : [{ from: move.from, to: move.to, captured: move.captures[0] }];

  return steps.map((step, index) => ({ ...step, index }));
}

export function getVisualMoveStepDuration(step: MoveStep): number {
  return step.captured ? CAPTURE_ANIMATION_STEP_MS : MOVE_ANIMATION_STEP_MS;
}

export function getVisualMoveDuration(move: Move, reduceMotion: boolean): number {
  if (reduceMotion) return REDUCED_MOTION_LAST_MOVE_MS;

  const steps = getVisualMoveSteps(move);
  const stepsDuration = steps.reduce((total, step) => total + getVisualMoveStepDuration(step), 0);

  return stepsDuration + MOVE_ANIMATION_SETTLE_MS;
}

export function getMoveAnimationKey(move: Move): string {
  const stepsKey = getVisualMoveSteps(move)
    .map((step) => `${positionKey(step.from)}-${positionKey(step.to)}-${step.captured ? positionKey(step.captured) : "none"}`)
    .join("|");

  return `${move.pieceId}:${stepsKey}`;
}

export function getCaptureStepIndex(steps: MoveStep[], capture: Position): number {
  const index = steps.findIndex((step) => step.captured && samePosition(step.captured, capture));
  return index >= 0 ? index : 0;
}

export function positionKey(position: Position): string {
  return `${position.row},${position.col}`;
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}
