import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flag, Gauge, Gem, Play, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import type { DrawMode, MarbleDifficulty, Participant } from "../../core/types";
import { fortunaAudio } from "../../shared/audio/audioEngine";
import {
  createMarbleSeed,
  difficultyLabels,
  getMarbleProgress,
  getTrackPosition,
  powerLabels,
  prepareMarbleRace,
  type MarblePower,
  type MarbleRacer,
  type MarbleTrack,
  type PreparedMarbleRace,
  type TrackObstacleType,
  type TrackSectionType,
  type TrackZoneType,
} from "./marbleRaceEngine";
import { disposeMarbleRace3D, drawMarbleRace3D } from "./marbleRace3d";

type RacePhase = "ready" | "racing" | "finished";

const webglFallbackCanvases = new WeakSet<HTMLCanvasElement>();

interface RankingItem {
  racer: MarbleRacer;
  progress: number;
  finished: boolean;
}

interface PowerEvent {
  id: string;
  participantName: string;
  power: MarblePower;
}

interface ScaledTrackPoint {
  x: number;
  y: number;
  tangentX?: number;
  tangentY?: number;
}

const traceTrack = (context: CanvasRenderingContext2D, points: readonly ScaledTrackPoint[]) => {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
};

const drawMechanicalBackground = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const background = context.createRadialGradient(width * 0.48, height * 0.44, 20, width * 0.48, height * 0.44, width * 0.8);
  background.addColorStop(0, "#0b2026");
  background.addColorStop(0.48, "#061318");
  background.addColorStop(1, "#010609");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(62,122,132,.055)";
  context.lineWidth = 1;
  const grid = Math.max(31, Math.round(width / 31));
  for (let x = 0; x < width; x += grid) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  for (let y = 0; y < height; y += grid) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }

  const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.22, width / 2, height / 2, height * 0.78);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.72)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
};

const drawTrackLayers = (
  context: CanvasRenderingContext2D,
  points: readonly ScaledTrackPoint[],
  trackWidth: number,
) => {
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";

  context.save();
  context.translate(0, 11);
  traceTrack(context, points);
  context.strokeStyle = "rgba(0,0,0,.72)";
  context.lineWidth = trackWidth + 30;
  context.shadowColor = "#000";
  context.shadowBlur = 22;
  context.stroke();
  context.restore();

  traceTrack(context, points);
  context.strokeStyle = "#06090a";
  context.lineWidth = trackWidth + 32;
  context.stroke();
  traceTrack(context, points);
  context.strokeStyle = "#9c6721";
  context.lineWidth = trackWidth + 25;
  context.stroke();
  traceTrack(context, points);
  context.strokeStyle = "#282b2c";
  context.lineWidth = trackWidth + 18;
  context.stroke();
  traceTrack(context, points);
  context.strokeStyle = "#0a0f11";
  context.lineWidth = trackWidth + 9;
  context.stroke();
  traceTrack(context, points);
  context.strokeStyle = "#24292b";
  context.lineWidth = trackWidth;
  context.stroke();
  traceTrack(context, points);
  context.strokeStyle = "rgba(2,18,22,.92)";
  context.lineWidth = trackWidth - 12;
  context.stroke();
  traceTrack(context, points);
  context.setLineDash([9, 13]);
  context.strokeStyle = "rgba(9,224,223,.22)";
  context.lineWidth = 2;
  context.stroke();
  context.setLineDash([]);
  context.restore();
};

const drawTrackHardware = (
  context: CanvasRenderingContext2D,
  track: MarbleTrack,
  scalePoint: (point: { x: number; y: number }) => ScaledTrackPoint,
) => {
  const halfWidth = track.trackWidth / 2;
  for (let progress = 0.006; progress < 0.997; progress += 0.014) {
    const point = getTrackPosition(track.points, progress);
    const scaled = scalePoint(point);
    const normalX = -point.tangentY;
    const normalY = point.tangentX;
    context.strokeStyle = "rgba(5,7,8,.88)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(scaled.x + normalX * (halfWidth - 2), scaled.y + normalY * (halfWidth - 2));
    context.lineTo(scaled.x - normalX * (halfWidth - 2), scaled.y - normalY * (halfWidth - 2));
    context.stroke();
    context.fillStyle = progress % 0.028 < 0.014 ? "#d39a38" : "#76501d";
    for (const side of [-1, 1]) {
      context.beginPath();
      context.arc(scaled.x + normalX * (halfWidth + 10) * side, scaled.y + normalY * (halfWidth + 10) * side, 2.7, 0, Math.PI * 2);
      context.fill();
    }
  }

  track.zones.slice(1, -1).forEach((zone, index) => {
    const point = getTrackPosition(track.points, zone.centerProgress);
    const scaled = scalePoint(point);
    context.fillStyle = "#111719";
    context.strokeStyle = index % 2 === 0 ? "#b37b29" : "#5d431f";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(scaled.x, scaled.y, 13 * zone.scale, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#d8a33c";
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((angle) => {
      context.beginPath();
      context.arc(scaled.x + Math.cos(angle) * 9 * zone.scale, scaled.y + Math.sin(angle) * 9 * zone.scale, 1.7, 0, Math.PI * 2);
      context.fill();
    });
  });
};

const traceOctagon = (context: CanvasRenderingContext2D, radius: number) => {
  context.beginPath();
  for (let index = 0; index < 8; index += 1) {
    const angle = Math.PI / 8 + index * Math.PI / 4;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
};

const drawZoneBase = (
  context: CanvasRenderingContext2D,
  type: TrackZoneType,
  color: string,
  x: number,
  y: number,
  angle: number,
  scale: number,
) => {
  const radius = 47 * scale;
  context.save();
  context.translate(x, y + 10 * scale);
  context.rotate(angle);
  context.fillStyle = "rgba(0,0,0,.72)";
  context.shadowColor = "#000";
  context.shadowBlur = 22;
  if (type === "turbo") {
    context.beginPath(); context.roundRect(-radius * 1.4, -radius * 0.72, radius * 2.8, radius * 1.44, 18 * scale); context.fill();
  } else {
    traceOctagon(context, radius * 1.18); context.fill();
  }
  context.restore();

  context.save();
  context.translate(x, y);
  context.rotate(angle);
  const plate = context.createRadialGradient(0, -radius * 0.2, 2, 0, 0, radius * 1.25);
  plate.addColorStop(0, "#263034");
  plate.addColorStop(0.58, "#111719");
  plate.addColorStop(1, "#05090b");
  context.fillStyle = plate;
  context.strokeStyle = "#9b6b2b";
  context.lineWidth = 5 * scale;
  if (type === "turbo") {
    context.beginPath(); context.roundRect(-radius * 1.35, -radius * 0.68, radius * 2.7, radius * 1.36, 17 * scale); context.fill(); context.stroke();
  } else {
    traceOctagon(context, radius * 1.12); context.fill(); context.stroke();
  }
  context.strokeStyle = `${color}55`;
  context.lineWidth = 2;
  context.beginPath(); context.arc(0, 0, radius * 0.86, 0, Math.PI * 2); context.stroke();
  context.strokeStyle = "rgba(218,162,61,.42)";
  context.beginPath(); context.arc(0, 0, radius * 1.02, 0, Math.PI * 2); context.stroke();
  for (let index = 0; index < 8; index += 1) {
    const spokeAngle = index * Math.PI / 4;
    context.strokeStyle = "rgba(194,135,42,.24)";
    context.beginPath();
    context.moveTo(Math.cos(spokeAngle) * radius * 0.68, Math.sin(spokeAngle) * radius * 0.68);
    context.lineTo(Math.cos(spokeAngle) * radius, Math.sin(spokeAngle) * radius);
    context.stroke();
    context.fillStyle = "#d3a044";
    context.beginPath();
    context.arc(Math.cos(spokeAngle) * radius, Math.sin(spokeAngle) * radius, 2.2 * scale, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
};

const drawCrystal = (context: CanvasRenderingContext2D, x: number, y: number, height: number) => {
  const gradient = context.createLinearGradient(x, y - height, x, y);
  gradient.addColorStop(0, "#f3ffff");
  gradient.addColorStop(0.25, "#8fe9ff");
  gradient.addColorStop(1, "#227d9b");
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(x, y - height);
  context.lineTo(x + height * 0.3, y);
  context.lineTo(x - height * 0.3, y);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.7)";
  context.stroke();
};

const drawZoneFeature = (
  context: CanvasRenderingContext2D,
  type: TrackZoneType,
  label: string,
  color: string,
  x: number,
  y: number,
  angle: number,
  scale: number,
  elapsedMs: number,
) => {
  const pulse = 1 + Math.sin(elapsedMs / 420) * 0.055;
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.scale(scale, scale);
  context.shadowColor = color;
  context.shadowBlur = 13;

  if (type === "launch") {
    context.fillStyle = "#8b5d25";
    [-33, 33].forEach((offset) => {
      context.fillRect(-15, offset - 6, 30, 12);
      context.fillStyle = "#c69a54";
      context.beginPath(); context.arc(-15, offset, 7, 0, Math.PI * 2); context.arc(15, offset, 7, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#8b5d25";
    });
  } else if (type === "turbo") {
    context.fillStyle = `${color}aa`;
    [-34, -11, 12, 35].forEach((offset) => {
      context.beginPath();
      context.moveTo(offset - 10, 13); context.lineTo(offset + 4, 0); context.lineTo(offset - 10, -13); context.closePath();
      context.fill();
    });
  } else if (type === "turbine") {
    context.rotate(elapsedMs / 780);
    context.fillStyle = "rgba(246,189,53,.78)";
    for (let index = 0; index < 6; index += 1) {
      context.rotate(Math.PI / 3);
      context.beginPath(); context.moveTo(8, -5); context.quadraticCurveTo(39, -19, 42, 2); context.quadraticCurveTo(23, 10, 8, 5); context.closePath(); context.fill();
    }
    context.fillStyle = "#061116";
    context.beginPath(); context.arc(0, 0, 12, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "#e3ad47"; context.lineWidth = 4; context.stroke();
  } else if (type === "ice") {
    context.fillStyle = "rgba(84,191,230,.22)";
    context.beginPath(); context.ellipse(0, 0, 48, 29, 0, 0, Math.PI * 2); context.fill();
    drawCrystal(context, -31, 7, 38);
    drawCrystal(context, 2, 11, 52);
    drawCrystal(context, 31, 8, 34);
  } else if (type === "portal") {
    context.scale(pulse, pulse);
    context.strokeStyle = color; context.lineWidth = 8;
    context.beginPath(); context.arc(0, 0, 34, 0, Math.PI * 2); context.stroke();
    context.strokeStyle = "rgba(255,255,255,.46)"; context.lineWidth = 2;
    context.beginPath(); context.arc(0, 0, 25, 0, Math.PI * 2); context.stroke();
    context.fillStyle = "rgba(133,52,205,.26)";
    context.beginPath(); context.arc(0, 0, 21, 0, Math.PI * 2); context.fill();
  } else if (type === "forge") {
    context.save();
    context.rotate(Math.sin(elapsedMs / 510) * 0.48);
    context.fillStyle = "#9b6329"; context.fillRect(-5, -47, 10, 58);
    const steel = context.createLinearGradient(-27, -52, 27, -32);
    steel.addColorStop(0, "#444d50"); steel.addColorStop(0.5, "#d5dedf"); steel.addColorStop(1, "#535d60");
    context.fillStyle = steel; context.fillRect(-29, -54, 58, 22);
    context.restore();
    context.fillStyle = "rgba(239,107,69,.56)";
    [-27, 27].forEach((offset) => {
      context.beginPath(); context.moveTo(offset - 9, 24); context.lineTo(offset, -4); context.lineTo(offset + 9, 24); context.closePath(); context.fill();
    });
  } else if (type === "gravity") {
    for (let ring = 0; ring < 4; ring += 1) {
      context.rotate(elapsedMs / (1600 + ring * 420));
      context.strokeStyle = `${color}${["cc", "99", "66", "44"][ring]}`;
      context.lineWidth = 4 - ring * 0.6;
      context.beginPath();
      context.ellipse(0, 0, 16 + ring * 9, 9 + ring * 5, ring * 0.62, 0, Math.PI * 1.65);
      context.stroke();
    }
    context.fillStyle = "#010207";
    context.beginPath(); context.arc(0, 0, 10, 0, Math.PI * 2); context.fill();
  } else {
    context.strokeStyle = "#f6bd35"; context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-24, 12); context.lineTo(-30, -18); context.lineTo(-11, -5); context.lineTo(0, -29); context.lineTo(11, -5); context.lineTo(30, -18); context.lineTo(24, 12); context.closePath();
    context.stroke();
  }
  context.restore();

  context.save();
  context.translate(x, y);
  context.fillStyle = "rgba(2,9,13,.91)";
  context.strokeStyle = `${color}99`;
  context.lineWidth = 1;
  const labelWidth = Math.max(62, label.length * 5.3);
  context.beginPath(); context.roundRect(-labelWidth / 2, -62 * scale, labelWidth, 18, 7); context.fill(); context.stroke();
  context.fillStyle = color;
  context.font = "900 7px Montserrat, Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label.toUpperCase(), 0, -53 * scale);
  context.restore();
};

const drawSectionDecoration = (
  context: CanvasRenderingContext2D,
  type: TrackSectionType,
  x: number,
  y: number,
  angle: number,
  elapsedMs: number,
  scale: number,
) => {
  if (["start", "finish", "straight", "curve", "s-curve"].includes(type)) return;
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.scale(scale, scale);
  if (type === "tunnel") {
    context.strokeStyle = "#a77731";
    context.lineWidth = 6;
    [-19, 0, 19].forEach((offset) => {
      context.beginPath();
      context.arc(offset, 0, 31, Math.PI, Math.PI * 2);
      context.stroke();
    });
    context.fillStyle = "rgba(0,0,0,.42)";
    context.fillRect(-25, -28, 50, 11);
  } else if (type === "split") {
    context.fillStyle = "#d8a039";
    context.beginPath();
    context.moveTo(-22, 0); context.lineTo(0, -13); context.lineTo(22, 0); context.lineTo(0, 13); context.closePath();
    context.fill();
    context.fillStyle = "#071116";
    context.beginPath(); context.arc(0, 0, 7, 0, Math.PI * 2); context.fill();
  } else if (type === "funnel") {
    context.strokeStyle = "#d37aff";
    context.lineWidth = 3;
    context.beginPath(); context.arc(0, 0, 26 + Math.sin(elapsedMs / 340) * 2, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(0, 0, 14, 0, Math.PI * 2); context.stroke();
  } else {
    const color = type === "ice-zone" ? "#8eeaff" : "#05dce1";
    context.fillStyle = `${color}33`;
    context.fillRect(-31, -23, 62, 46);
    context.fillStyle = color;
    [-18, 0, 18].forEach((offset) => {
      context.beginPath();
      context.moveTo(offset - 7, 9); context.lineTo(offset, -9); context.lineTo(offset + 7, 9); context.closePath();
      context.fill();
    });
  }
  context.restore();
};

const drawObstacle = (
  context: CanvasRenderingContext2D,
  type: TrackObstacleType,
  x: number,
  y: number,
  elapsedMs: number,
  scale: number,
) => {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.lineWidth = 3;
  context.shadowColor = "rgba(0,0,0,.85)";
  context.shadowBlur = 9;
  if (type === "spinner") {
    context.rotate(elapsedMs / 480);
    context.strokeStyle = "#f6bd35";
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(-29, 0); context.lineTo(29, 0);
    context.moveTo(0, -29); context.lineTo(0, 29);
    context.stroke();
    context.fillStyle = "#07161c";
    context.beginPath(); context.arc(0, 0, 9, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "#ba7e26"; context.stroke();
  } else if (type === "bumpers") {
    [-19, 0, 19].forEach((offset, index) => {
      const gradient = context.createRadialGradient(offset - 2, -4, 1, offset, 0, 9);
      gradient.addColorStop(0, "#fff");
      gradient.addColorStop(0.3, index % 2 === 0 ? "#09e0df" : "#f6bd35");
      gradient.addColorStop(1, "#061014");
      context.fillStyle = gradient;
      context.beginPath(); context.arc(offset, (index % 2) * 10 - 5, 9, 0, Math.PI * 2); context.fill();
    });
  } else if (type === "gate") {
    context.strokeStyle = "#e95b45";
    context.lineWidth = 5;
    context.strokeRect(-29, -11, 58, 22);
    context.fillStyle = "rgba(233,91,69,.55)";
    context.fillRect(-26, -7, 16 + (Math.sin(elapsedMs / 320) + 1) * 9, 14);
  } else if (type === "boost") {
    context.fillStyle = "#09e0df";
    [-16, 0, 16].forEach((offset) => {
      context.beginPath();
      context.moveTo(offset - 7, 10); context.lineTo(offset, -10); context.lineTo(offset + 7, 10); context.closePath();
      context.fill();
    });
  } else if (type === "ice") {
    context.fillStyle = "rgba(116,230,255,.52)";
    context.fillRect(-31, -15, 62, 30);
    context.strokeStyle = "rgba(255,255,255,.86)";
    context.beginPath();
    context.moveTo(-23, 8); context.lineTo(-10, -8); context.lineTo(3, 8); context.lineTo(20, -8); context.stroke();
  } else if (type === "portal") {
    context.strokeStyle = "#d97cff";
    context.lineWidth = 6;
    context.beginPath(); context.arc(0, 0, 23 + Math.sin(elapsedMs / 260) * 3, 0, Math.PI * 2); context.stroke();
    context.strokeStyle = "rgba(217,124,255,.35)";
    context.beginPath(); context.arc(0, 0, 31, 0, Math.PI * 2); context.stroke();
  } else if (type === "hammer") {
    context.rotate(Math.sin(elapsedMs / 390) * 0.72);
    context.fillStyle = "#8c5728";
    context.fillRect(-4, -35, 8, 70);
    context.fillStyle = "#9ba4a5";
    context.strokeStyle = "#3a4244";
    context.fillRect(-22, -38, 44, 20);
    context.strokeRect(-22, -38, 44, 20);
  } else {
    context.strokeStyle = "#f6bd35";
    context.lineWidth = 6;
    context.beginPath(); context.arc(0, 0, 27, 0, Math.PI * 2); context.stroke();
    context.fillStyle = "#071116";
    context.beginPath(); context.arc(0, 0, 12, 0, Math.PI * 2); context.fill();
  }
  context.restore();
};

const drawPowerZones = (
  context: CanvasRenderingContext2D,
  track: MarbleTrack,
  scalePoint: (point: { x: number; y: number }) => ScaledTrackPoint,
  elapsedMs: number,
) => {
  track.powerZones.forEach((zone, index) => {
    const point = getTrackPosition(track.points, zone.progress);
    const scaled = scalePoint(point);
    const angle = Math.atan2(point.tangentY, point.tangentX);
    context.save();
    context.translate(scaled.x, scaled.y);
    context.rotate(angle);
    context.scale(zone.scale, zone.scale);
    context.shadowColor = zone.color;
    context.shadowBlur = 12 + Math.sin(elapsedMs / 260 + index) * 4;
    context.fillStyle = `${zone.color}88`;
    [-18, 0, 18].forEach((offset) => {
      context.beginPath();
      context.moveTo(offset - 7, 10); context.lineTo(offset + 3, 0); context.lineTo(offset - 7, -10); context.closePath();
      context.fill();
    });
    context.restore();
  });
};

const drawStartAndFinish = (
  context: CanvasRenderingContext2D,
  start: ScaledTrackPoint,
  finish: ScaledTrackPoint,
) => {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 10px Montserrat, Arial";
  context.fillStyle = "#f6bd35";
  context.fillRect(start.x - 39, start.y - 6, 78, 12);
  context.fillStyle = "#071116";
  context.fillText("SALIDA", start.x, start.y - 19);
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      context.fillStyle = (row + column) % 2 === 0 ? "#f7f7eb" : "#071116";
      context.fillRect(finish.x - 40 + column * 8, finish.y - 8 + row * 8, 8, 8);
    }
  }
  context.fillStyle = "#eefcfe";
  context.fillText("META", finish.x, finish.y + 25);
  context.restore();
};

interface StaticTrackLayer {
  key: string;
  canvas: HTMLCanvasElement;
}

const staticTrackLayers = new WeakMap<HTMLCanvasElement, StaticTrackLayer>();

const getStaticTrackLayer = (
  target: HTMLCanvasElement,
  race: PreparedMarbleRace,
  width: number,
  height: number,
  ratio: number,
  scalePoint: (point: { x: number; y: number }) => ScaledTrackPoint,
  scaledPoints: readonly ScaledTrackPoint[],
) => {
  const key = `${race.track.signature}-${Math.round(width)}x${Math.round(height)}@${ratio}`;
  const cached = staticTrackLayers.get(target);
  if (cached?.key === key) return cached.canvas;

  const layer = document.createElement("canvas");
  layer.width = Math.round(width * ratio);
  layer.height = Math.round(height * ratio);
  const context = layer.getContext("2d");
  if (!context) return layer;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawMechanicalBackground(context, width, height);
  race.track.zones.forEach((zone) => {
    const point = getTrackPosition(race.track.points, zone.centerProgress);
    const scaled = scalePoint(point);
    drawZoneBase(context, zone.type, zone.color, scaled.x, scaled.y, Math.atan2(point.tangentY, point.tangentX), zone.scale);
  });
  drawTrackLayers(context, scaledPoints, race.track.trackWidth);
  drawTrackHardware(context, race.track, scalePoint);
  race.track.sections.forEach((section) => {
    const progress = (section.startProgress + section.endProgress) / 2;
    const point = getTrackPosition(race.track.points, progress);
    const scaled = scalePoint(point);
    const zone = race.track.zones.find((candidate) => candidate.id === section.zoneId);
    drawSectionDecoration(context, section.type, scaled.x, scaled.y, Math.atan2(point.tangentY, point.tangentX), 0, Math.min(1.08, zone?.scale ?? 1));
  });
  drawStartAndFinish(context, scaledPoints[0], scaledPoints[scaledPoints.length - 1]);
  staticTrackLayers.set(target, { key, canvas: layer });
  return layer;
};

const drawRace = (
  canvas: HTMLCanvasElement,
  race: PreparedMarbleRace,
  elapsedMs: number,
  phase: RacePhase,
) => {
  if (!webglFallbackCanvases.has(canvas)) {
    try {
      drawMarbleRace3D(canvas, race, elapsedMs, phase);
      return;
    } catch (error) {
      webglFallbackCanvases.add(canvas);
      console.warn("Fortuna Real no pudo iniciar la escena 3D; se usarÃ¡ el render compatible.", error);
    }
  }
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(520, bounds.width);
  const height = Math.max(480, bounds.height);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const paddingX = Math.max(54, width * 0.045);
  const paddingY = Math.max(38, height * 0.04);
  const scalePoint = (point: { x: number; y: number }) => ({
    x: paddingX + point.x * (width - paddingX * 2),
    y: paddingY + point.y * (height - paddingY * 2),
  });
  const scaledPoints = race.track.points.map(scalePoint);
  const staticLayer = getStaticTrackLayer(canvas, race, width, height, ratio, scalePoint, scaledPoints);
  context.drawImage(staticLayer, 0, 0, width, height);

  race.track.zones.forEach((zone) => {
    const point = getTrackPosition(race.track.points, zone.centerProgress);
    const scaled = scalePoint(point);
    drawZoneFeature(context, zone.type, zone.label, zone.color, scaled.x, scaled.y, Math.atan2(point.tangentY, point.tangentX), zone.scale, elapsedMs);
  });
  drawPowerZones(context, race.track, scalePoint, elapsedMs);

  race.track.obstacles.forEach((obstacle) => {
    const point = getTrackPosition(race.track.points, obstacle.progress);
    const scaled = scalePoint(point);
    drawObstacle(context, obstacle.type, scaled.x, scaled.y, elapsedMs, obstacle.scale);
  });

  const start = scaledPoints[0];

  const count = race.racers.length;
  const baseRadius = count > 150 ? 3.2 : count > 90 ? 4 : count > 48 ? 5 : count > 22 ? 6.2 : 8.5;
  const drawDetailed = count <= 90;
  const selectedId = phase === "finished" ? race.selected.id : null;
  const ordered = [...race.racers].sort((first, second) =>
    getMarbleProgress(first, elapsedMs).progress - getMarbleProgress(second, elapsedMs).progress,
  );
  const stagingColumns = Math.max(2, Math.ceil(Math.sqrt(count * 1.08)));
  const stagingRows = Math.ceil(count / stagingColumns);
  const stagingSpacing = Math.max(6.7, baseRadius * 2.2);

  if (phase === "ready") {
    const bayWidth = stagingColumns * stagingSpacing + 20;
    const bayHeight = stagingRows * stagingSpacing + 20;
    context.fillStyle = "rgba(4,12,15,.88)";
    context.strokeStyle = "rgba(211,154,56,.75)";
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(start.x - bayWidth / 2, start.y - bayHeight / 2, bayWidth, bayHeight, 16);
    context.fill();
    context.stroke();
  }

  ordered.forEach((racer) => {
    const state = getMarbleProgress(racer, phase === "ready" ? 0 : elapsedMs);
    const point = getTrackPosition(race.track.points, state.progress);
    const scaled = scalePoint(point);
    const nearbyObstacle = race.track.obstacles.find((obstacle) => Math.abs(obstacle.progress - state.progress) < 0.018);
    const collisionWobble = nearbyObstacle
      ? Math.sin(elapsedMs / 43 + racer.number * 1.71) * 10 * nearbyObstacle.scale * (1 - Math.abs(nearbyObstacle.progress - state.progress) / 0.018)
      : 0;
    const offset = racer.lane * Math.min(race.track.trackWidth * 0.34, 12 + count * 0.08) + collisionWobble;
    const trackX = scaled.x - point.tangentY * offset;
    const trackY = scaled.y + point.tangentX * offset;
    const stagingIndex = racer.number - 1;
    const stagingColumn = stagingIndex % stagingColumns;
    const stagingRow = Math.floor(stagingIndex / stagingColumns);
    const stagingX = start.x + (stagingColumn - (stagingColumns - 1) / 2) * stagingSpacing;
    const stagingY = start.y + (stagingRow - (stagingRows - 1) / 2) * stagingSpacing;
    const launchBlend = phase === "ready" ? 0 : Math.min(1, elapsedMs / 760);
    const smoothLaunch = launchBlend * launchBlend * (3 - 2 * launchBlend);
    const x = stagingX + (trackX - stagingX) * smoothLaunch;
    const y = stagingY + (trackY - stagingY) * smoothLaunch;
    const radius = baseRadius * state.radiusScale;

    context.save();
    if (state.powerActive) {
      context.shadowColor = racer.accent;
      context.shadowBlur = 16;
    }
    if (racer.id === selectedId) {
      context.strokeStyle = "#fff1a8";
      context.lineWidth = 3;
      context.beginPath(); context.arc(x, y, radius + 6, 0, Math.PI * 2); context.stroke();
    }
    if (drawDetailed) {
      const marbleGradient = context.createRadialGradient(x - radius * 0.35, y - radius * 0.42, 1, x, y, radius);
      marbleGradient.addColorStop(0, "#ffffff");
      marbleGradient.addColorStop(0.2, racer.accent);
      marbleGradient.addColorStop(1, racer.color);
      context.fillStyle = marbleGradient;
    } else {
      context.fillStyle = racer.accent;
    }
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "rgba(0,0,0,.8)"; context.lineWidth = 1; context.stroke();
    if (count <= 40 && radius >= 6) {
      context.fillStyle = "#031014";
      context.font = `900 ${Math.max(6, radius * 0.88)}px Arial`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(racer.number), x, y + 0.3);
    }
    context.restore();
  });
};

export function MarbleRace({
  participants,
  mode,
  difficulty,
  disabled,
  onDifficultyChange,
  onTrackPrepared,
  onFinish,
}: {
  participants: Participant[];
  mode: DrawMode;
  difficulty: MarbleDifficulty;
  disabled: boolean;
  onDifficultyChange: (difficulty: MarbleDifficulty) => void;
  onTrackPrepared?: (track: MarbleTrack) => void;
  onFinish: (racer: MarbleRacer, label: string) => void;
}) {
  const [seed, setSeed] = useState(createMarbleSeed);
  const [phase, setPhase] = useState<RacePhase>("ready");
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [powerEvents, setPowerEvents] = useState<PowerEvent[]>([]);
  const [fps, setFps] = useState(60);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);
  const finishTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const triggeredPowersRef = useRef(new Set<string>());
  const race = useMemo(
    () => prepareMarbleRace(participants, mode, seed, difficulty),
    [difficulty, mode, participants, seed],
  );

  const paint = useCallback((elapsedMs: number, currentPhase: RacePhase) => {
    if (canvasRef.current) drawRace(canvasRef.current, race, elapsedMs, currentPhase);
  }, [race]);

  useEffect(() => {
    onTrackPrepared?.(race.track);
  }, [onTrackPrepared, race.track]);

  useEffect(() => {
    const redraw = () => paint(phase === "finished" ? race.selected.durationMs : 0, phase);
    redraw();
    const observer = new ResizeObserver(redraw);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [paint, phase, race.selected.durationMs]);

  useEffect(() => {
    mountedRef.current = true;
    const canvas = canvasRef.current;
    return () => {
      mountedRef.current = false;
      window.cancelAnimationFrame(frameRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
      if (canvas) disposeMarbleRace3D(canvas);
    };
  }, []);

  const resetPreparedRace = () => {
    setPhase("ready");
    setRanking([]);
    setPowerEvents([]);
    triggeredPowersRef.current.clear();
  };

  const regenerateTrack = () => {
    if (phase === "racing") return;
    fortunaAudio.playClick();
    setSeed(createMarbleSeed());
    resetPreparedRace();
  };

  const changeDifficulty = (nextDifficulty: MarbleDifficulty) => {
    if (phase === "racing" || nextDifficulty === difficulty) return;
    fortunaAudio.playClick();
    onDifficultyChange(nextDifficulty);
    setSeed(createMarbleSeed());
    resetPreparedRace();
  };

  const startRace = () => {
    if (disabled || phase === "racing") return;
    setPhase("racing");
    setPowerEvents([]);
    triggeredPowersRef.current.clear();
    fortunaAudio.playMarbleStart();
    const startedAt = performance.now();
    let lastUiUpdate = startedAt;
    let fpsWindow = startedAt;
    let frameCount = 0;
    const finishAt = race.selected.durationMs;

    const tick = (now: number) => {
      if (!mountedRef.current) return;
      const elapsed = now - startedAt;
      frameCount += 1;
      paint(elapsed, "racing");

      if (now - lastUiUpdate >= 180) {
        const orderedRacers = race.racers
          .map((racer) => {
            const state = getMarbleProgress(racer, elapsed);
            return { racer, progress: state.progress, finished: state.finished };
          })
          .sort((first, second) => second.progress - first.progress);
        setRanking(orderedRacers.slice(0, 6));
        const newEvents = race.racers.flatMap((racer) => {
          if (!racer.power || triggeredPowersRef.current.has(racer.id)) return [];
          const state = getMarbleProgress(racer, elapsed);
          if (!state.powerActive) return [];
          triggeredPowersRef.current.add(racer.id);
          return [{
            id: `${racer.id}-${elapsed}`,
            participantName: racer.participant.name,
            power: racer.power,
          } satisfies PowerEvent];
        }).slice(0, 3);
        if (newEvents.length > 0) {
          setPowerEvents((current) => [...newEvents, ...current].slice(0, 3));
          fortunaAudio.playMarblePower();
        }
        lastUiUpdate = now;
      }

      if (now - fpsWindow >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - fpsWindow)));
        fpsWindow = now;
        frameCount = 0;
      }

      if (elapsed >= finishAt) {
        setPhase("finished");
        paint(finishAt, "finished");
        fortunaAudio.playMarbleFinish();
        const resultLabel = mode === "direct"
          ? `Canica #${race.selected.number} · llegó primera`
          : `Canica #${race.selected.number} · llegó de última`;
        finishTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) onFinish(race.selected, resultLabel);
        }, 650);
        return;
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
  };

  const status = phase === "ready" ? "Pista validada" : phase === "racing" ? "Carrera en vivo" : "Resultado confirmado";

  return (
    <div
      className={`marble-race marble-race--${phase}`}
      data-marble-count={participants.length}
      data-fps={fps}
      data-difficulty={difficulty}
      data-track-signature={race.track.signature}
      data-track-sections={race.track.sections.length}
      data-track-zones={race.track.zones.length}
      data-track-width={race.track.trackWidth}
      data-obstacles={race.track.obstacles.length}
      data-power-zones={race.track.powerZones.length}
    >
      <div className="marble-race-status" aria-live="polite">
        <span className="marble-race-status__icon">{phase === "racing" ? <Gauge size={18} /> : <Gem size={18} />}</span>
        <div><strong>{status}</strong><small>{race.track.name} · semilla {race.track.signature.toUpperCase()}</small></div>
        <div className="marble-race-status__metrics">
          <span>{race.track.sections.length} secciones</span>
          <span>{race.track.zones.length} zonas</span>
          <span>{race.track.obstacles.length} trampas</span>
          <span>{race.track.powerZones.length} {race.track.powerZones.length === 1 ? "poder" : "poderes"}</span>
          <span>{phase === "racing" ? `${fps} FPS` : `${participants.length} canicas`}</span>
        </div>
      </div>

      <div className="marble-arena">
        <canvas
          ref={canvasRef}
          aria-label={`Escenario 3D ${race.track.name}, dificultad ${difficultyLabels[difficulty]}, ${race.track.sections.length} secciones y ${participants.length} canicas`}
        />

        <div className="marble-render-badge"><span /> ESCENA 3D</div>

        {(phase === "racing" || phase === "finished") && (
          <div className="marble-live-ranking">
            <div><Gauge size={14} /> Clasificación en vivo</div>
            {ranking.map((item, index) => (
              <span key={item.racer.id}>
                <b>{index + 1}</b><i style={{ background: item.racer.accent }} />
                <strong>{item.racer.participant.name}</strong><em>{item.finished ? "META" : `${Math.round(item.progress * 100)}%`}</em>
              </span>
            ))}
          </div>
        )}

        {powerEvents.length > 0 && (
          <div className="marble-power-feed">
            {powerEvents.map((event) => (
              <span key={event.id}><WandSparkles size={12} /><strong>{event.participantName}</strong> · {powerLabels[event.power]}</span>
            ))}
          </div>
        )}

        <div className="marble-map-stamp">
          <span>MAPA ALEATORIO</span>
          <strong>{difficultyLabels[difficulty]}</strong>
          <small>{race.track.lengthRating} · riesgo {race.track.risk}/5 · 100% conectado</small>
        </div>
      </div>

      <div className="marble-controls">
        <div className="marble-difficulty-switch" aria-label="Dificultad de la pista">
          {(["easy", "medium", "hard"] as const).map((level) => (
            <button
              type="button"
              key={level}
              className={difficulty === level ? "is-active" : ""}
              onClick={() => changeDifficulty(level)}
              disabled={phase === "racing" || phase === "finished"}
            >
              {difficultyLabels[level]}
            </button>
          ))}
        </div>
        <button type="button" className="start-button marble-start-button" onClick={startRace} disabled={disabled || phase === "racing" || phase === "finished"}>
          {phase === "racing" ? <><span className="spinner-dot" /> Carrera en curso…</> : phase === "finished" ? <><Flag size={18} /> Carrera finalizada</> : <><Play size={19} fill="currentColor" /> Iniciar carrera</>}
        </button>
        <button type="button" className="text-button marble-regenerate" onClick={regenerateTrack} disabled={phase === "racing"}>
          <RefreshCw size={15} /> Generar otro mapa
        </button>
      </div>
      <small className="marble-generation-note"><Sparkles size={11} /> Cada semilla ensambla zonas y secciones compatibles; la ruta se valida antes de abrir la compuerta.</small>
    </div>
  );
}
