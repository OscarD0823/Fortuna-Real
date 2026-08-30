const normalizeDegrees = (value: number) => ((value % 360) + 360) % 360;

export const calculateSpinRotations = ({
  entryCount,
  targetIndex,
  ballLandingAngle,
  currentWheelRotation,
  currentBallRotation,
}: {
  entryCount: number;
  targetIndex: number;
  ballLandingAngle: number;
  currentWheelRotation: number;
  currentBallRotation: number;
}) => {
  const sliceDegrees = 360 / entryCount;
  const ballLandingPosition = normalizeDegrees(ballLandingAngle);
  const desiredWheelPosition = normalizeDegrees(
    ballLandingPosition - targetIndex * sliceDegrees,
  );
  const currentWheelPosition = normalizeDegrees(currentWheelRotation);
  const wheelAdjustment = normalizeDegrees(desiredWheelPosition - currentWheelPosition);
  const currentBallPosition = normalizeDegrees(currentBallRotation);
  const ballAdjustment = normalizeDegrees(currentBallPosition - ballLandingPosition);

  return {
    wheelRotation: currentWheelRotation + 7 * 360 + wheelAdjustment,
    ballRotation: currentBallRotation - 9 * 360 - ballAdjustment,
  };
};
