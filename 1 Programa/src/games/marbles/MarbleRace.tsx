import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Crown, Flag, Gauge, Gem, Play, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import type { DrawMode, MarbleDifficulty, MarbleFinishRule, Participant } from "../../core/types";
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
  type MarbleTrackEventType,
  type MarbleTrack,
  type PreparedMarbleRace,
  type TrackObstacleType,
  type TrackSectionType,
  type TrackZoneType,
} from "./marbleRaceEngine";
import { disposeMarbleRace3D, drawMarbleRace3D, type MarbleFollowCameraStyle } from "./marbleRace3d";

type RacePhase = "ready" | "racing" | "finished";
const getMarbleCameraIntroMs = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 1_400;

const failedWebglCanvases = new WeakSet<HTMLCanvasElement>();
type MarbleRenderMode = "webgl" | "fallback";
const cameraStyleLabels: Record<MarbleFollowCameraStyle, string> = {
  chase: "PERSECUCIÓN",
  onboard: "A BORDO",
  trackside: "LATERAL",
  aerial: "AÉREA",
};

interface RankingItem {
  racer: MarbleRacer;
  progress: number;
  finished: boolean;
  powerActive: boolean;
  incomingPowerActive: boolean;
  activePower: MarblePower | null;
  activeTrackEvent: MarbleTrackEventType | null;
  recovering: boolean;
  position: number;
}

interface RaceEvent {
  id: string;
  title: string;
  detail: string;
  tone: MarblePower | MarbleTrackEventType | "race" | "risk" | "finish";
}

const powerDescriptions: Record<MarblePower, string> = {
  boost: "acelera",
  shield: "protege",
  freeze: "congela a un rival que va adelante",
  reverse: "invierte el impulso de un rival que va adelante",
  giant: "aumenta tamaño",
  tiny: "reduce a un rival que va adelante",
  restart: "envía a un rival delantero al inicio",
};

const trackEventLabels: Record<MarbleTrackEventType, string> = {
  freeze: "Pista congelada",
  river: "Río",
  tornado: "Tornado",
  quake: "Temblor",
};

const compactRanking = <T extends { racer: MarbleRacer }>(items: T[]) => {
  if (items.length <= 8) return items;
  const leaders = items.slice(0, 5);
  const last = items[items.length - 1];
  return leaders.some((item) => item.racer.id === last.racer.id)
    ? leaders
    : [...leaders, last];
};

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

const drawTrackEvents = (
  context: CanvasRenderingContext2D,
  track: MarbleTrack,
  scalePoint: (point: { x: number; y: number }) => ScaledTrackPoint,
  elapsedMs: number,
) => {
  track.events.forEach((event, index) => {
    const point = getTrackPosition(track.points, event.progress);
    const scaled = scalePoint(point);
    const pulse = 1 + Math.sin(elapsedMs / 180 + index) * 0.12;
    context.save();
    context.translate(scaled.x, scaled.y);
    context.rotate(Math.atan2(point.tangentY, point.tangentX));
    context.scale(pulse, pulse);
    context.strokeStyle = event.color;
    context.fillStyle = `${event.color}35`;
    context.shadowColor = event.color;
    context.shadowBlur = 14;
    context.lineWidth = event.type === "quake" ? 4 : 3;
    if (event.type === "river") {
      context.fillRect(-48, -17, 96, 34);
      [-10, 0, 10].forEach((offset) => {
        context.beginPath(); context.moveTo(-44, offset); context.bezierCurveTo(-18, offset - 7, 18, offset + 7, 44, offset); context.stroke();
      });
    } else if (event.type === "tornado") {
      [12, 21, 30].forEach((radius) => { context.beginPath(); context.ellipse(0, 0, radius, radius * 0.45, elapsedMs / 800, 0, Math.PI * 1.72); context.stroke(); });
    } else if (event.type === "freeze") {
      context.fillRect(-46, -18, 92, 36);
      context.beginPath(); context.moveTo(-38, 12); context.lineTo(-12, -12); context.lineTo(7, 10); context.lineTo(35, -11); context.stroke();
    } else {
      [-34, -12, 10].forEach((offset) => { context.beginPath(); context.moveTo(offset, -17); context.lineTo(offset + 12, 0); context.lineTo(offset + 3, 17); context.stroke(); });
    }
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
  webglCanvas: HTMLCanvasElement,
  fallbackCanvas: HTMLCanvasElement,
  race: PreparedMarbleRace,
  elapsedMs: number,
  phase: RacePhase,
  followRacerId: string | null,
  followCameraStyle: MarbleFollowCameraStyle,
): MarbleRenderMode => {
  if (!failedWebglCanvases.has(webglCanvas)) {
    try {
      drawMarbleRace3D(webglCanvas, race, elapsedMs, phase, followRacerId, followCameraStyle);
      return "webgl";
    } catch (error) {
      failedWebglCanvases.add(webglCanvas);
      disposeMarbleRace3D(webglCanvas);
      console.warn("Fortuna Real no pudo iniciar la escena 3D; se usará el render compatible.", error);
    }
  }
  const bounds = fallbackCanvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(520, bounds.width);
  const height = Math.max(480, bounds.height);
  if (fallbackCanvas.width !== Math.round(width * ratio) || fallbackCanvas.height !== Math.round(height * ratio)) {
    fallbackCanvas.width = Math.round(width * ratio);
    fallbackCanvas.height = Math.round(height * ratio);
  }
  const context = fallbackCanvas.getContext("2d");
  if (!context) throw new Error("No fue posible iniciar el render compatible 2D.");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const paddingX = Math.max(54, width * 0.045);
  const paddingY = Math.max(38, height * 0.04);
  const scalePoint = (point: { x: number; y: number }) => ({
    x: paddingX + point.x * (width - paddingX * 2),
    y: paddingY + point.y * (height - paddingY * 2),
  });
  const scaledPoints = race.track.points.map(scalePoint);
  const staticLayer = getStaticTrackLayer(fallbackCanvas, race, width, height, ratio, scalePoint, scaledPoints);
  context.drawImage(staticLayer, 0, 0, width, height);

  race.track.zones.forEach((zone) => {
    const point = getTrackPosition(race.track.points, zone.centerProgress);
    const scaled = scalePoint(point);
    drawZoneFeature(context, zone.type, zone.label, zone.color, scaled.x, scaled.y, Math.atan2(point.tangentY, point.tangentX), zone.scale, elapsedMs);
  });
  drawPowerZones(context, race.track, scalePoint, elapsedMs);
  drawTrackEvents(context, race.track, scalePoint, elapsedMs);

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
  const visualRaceElapsed = phase === "ready" ? 0 : Math.max(0, elapsedMs - getMarbleCameraIntroMs());
  const ordered = [...race.racers].sort((first, second) =>
    getMarbleProgress(first, visualRaceElapsed, race.track).progress - getMarbleProgress(second, visualRaceElapsed, race.track).progress,
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
    const raceElapsed = phase === "ready" ? 0 : Math.max(0, elapsedMs - getMarbleCameraIntroMs());
    const state = getMarbleProgress(racer, raceElapsed, race.track);
    const point = getTrackPosition(race.track.points, state.progress);
    const scaled = scalePoint(point);
    const nearbyObstacle = race.track.obstacles.find((obstacle) => Math.abs(obstacle.progress - state.progress) < 0.018);
    const collisionWobble = nearbyObstacle
      ? Math.sin(elapsedMs / 43 + racer.number * 1.71) * 10 * nearbyObstacle.scale * (1 - Math.abs(nearbyObstacle.progress - state.progress) / 0.018)
      : 0;
    const recoveryOffset = state.recovering
      ? state.recoveryDirection * Math.sin(state.recoveryPhase * Math.PI) * Math.min(race.track.trackWidth * 0.76, 38)
      : 0;
    const offset = racer.lane * Math.min(race.track.trackWidth * 0.34, 12 + count * 0.08)
      + collisionWobble
      + ("lateralImpulse" in state ? state.lateralImpulse * 2.35 : 0)
      + recoveryOffset;
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
    const y = stagingY + (trackY - stagingY) * smoothLaunch + state.recoveryDrop * 10;
    const radius = baseRadius * state.radiusScale;

    context.save();
    if (state.activePower || state.recovering) {
      context.shadowColor = state.recovering ? "#ff793d" : racer.accent;
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
    if (racer.previousWinner) {
      context.fillStyle = "#ffc52f";
      context.strokeStyle = "#6e3a00";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x - radius * 0.72, y - radius - 4);
      context.lineTo(x - radius * 0.58, y - radius - 11);
      context.lineTo(x - radius * 0.18, y - radius - 6);
      context.lineTo(x, y - radius - 13);
      context.lineTo(x + radius * 0.2, y - radius - 6);
      context.lineTo(x + radius * 0.6, y - radius - 11);
      context.lineTo(x + radius * 0.72, y - radius - 4);
      context.closePath();
      context.fill();
      context.stroke();
    }
    if (count <= 40 && radius >= 6) {
      context.fillStyle = "#031014";
      context.font = `900 ${Math.max(6, radius * 0.88)}px Arial`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(racer.number), x, y + 0.3);
    }
    context.restore();
  });
  return "fallback";
};

export function MarbleRace({
  participants,
  mode,
  difficulty,
  finishRule,
  disabled,
  previousWinnerIds,
  initialSeed,
  onCommit,
  onDifficultyChange,
  onFinishRuleChange,
  onTrackPrepared,
  onFinish,
}: {
  participants: Participant[];
  mode: DrawMode;
  difficulty: MarbleDifficulty;
  finishRule: MarbleFinishRule;
  disabled: boolean;
  previousWinnerIds: ReadonlySet<string>;
  initialSeed?: string;
  onCommit: (seed: string) => void;
  onDifficultyChange: (difficulty: MarbleDifficulty) => void;
  onFinishRuleChange: (finishRule: MarbleFinishRule) => void;
  onTrackPrepared?: (track: MarbleTrack) => void;
  onFinish: (racer: MarbleRacer, label: string) => void;
}) {
  const [seed, setSeed] = useState(() => initialSeed?.trim() || createMarbleSeed());
  const [resumedSeed] = useState(() => Boolean(initialSeed?.trim()));
  const [roundParticipants] = useState(() => participants);
  const [roundPreviousWinnerIds] = useState(() => new Set(previousWinnerIds));
  const [phase, setPhase] = useState<RacePhase>("ready");
  const [commitError, setCommitError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [raceEvents, setRaceEvents] = useState<RaceEvent[]>([]);
  const [fps, setFps] = useState(60);
  const [renderMode, setRenderMode] = useState<MarbleRenderMode>("webgl");
  const [cameraTargetId, setCameraTargetId] = useState<string | null>(null);
  const [cameraStyle, setCameraStyle] = useState<MarbleFollowCameraStyle>("chase");
  const [cameraDirectorEnabled, setCameraDirectorEnabled] = useState(true);
  const renderModeRef = useRef<MarbleRenderMode>("webgl");
  const cameraTargetRef = useRef<string | null>(null);
  const cameraStyleRef = useRef<MarbleFollowCameraStyle>("chase");
  const cameraDirectorRef = useRef(true);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);
  const finishTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const triggeredPowersRef = useRef(new Set<string>());
  const trackedPositionRef = useRef<string | null>(null);
  const directorCandidateRef = useRef<{ id: string | null; since: number }>({ id: null, since: 0 });
  const directorLastSwitchRef = useRef(0);
  const race = useMemo(
    () => prepareMarbleRace(roundParticipants, mode, seed, difficulty, roundPreviousWinnerIds, finishRule),
    [difficulty, finishRule, mode, roundParticipants, roundPreviousWinnerIds, seed],
  );

  const paint = useCallback((elapsedMs: number, currentPhase: RacePhase) => {
    const webglCanvas = webglCanvasRef.current;
    const fallbackCanvas = fallbackCanvasRef.current;
    if (!webglCanvas || !fallbackCanvas) return;
    const nextRenderMode = drawRace(webglCanvas, fallbackCanvas, race, elapsedMs, currentPhase, cameraTargetRef.current, cameraStyleRef.current);
    if (nextRenderMode !== renderModeRef.current) {
      renderModeRef.current = nextRenderMode;
      setRenderMode(nextRenderMode);
    }
  }, [race]);

  useEffect(() => {
    onTrackPrepared?.(race.track);
  }, [onTrackPrepared, race.track]);

  useEffect(() => {
    const redraw = () => paint(
      phase === "finished" ? race.selected.durationMs + getMarbleCameraIntroMs() : 0,
      phase,
    );
    redraw();
    const observer = new ResizeObserver(redraw);
    if (webglCanvasRef.current) observer.observe(webglCanvasRef.current);
    return () => observer.disconnect();
  }, [paint, phase, race.selected.durationMs]);

  useEffect(() => {
    mountedRef.current = true;
    const webglCanvas = webglCanvasRef.current;
    return () => {
      mountedRef.current = false;
      window.cancelAnimationFrame(frameRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
      if (webglCanvas) disposeMarbleRace3D(webglCanvas);
    };
  }, []);

  const resetPreparedRace = () => {
    setPhase("ready");
    setRanking([]);
    setRaceEvents([]);
    trackedPositionRef.current = null;
    directorCandidateRef.current = { id: null, since: 0 };
    directorLastSwitchRef.current = 0;
    triggeredPowersRef.current.clear();
  };

  const changeCameraTarget = (nextTargetId: string) => {
    const nextTarget = nextTargetId || null;
    cameraDirectorRef.current = false;
    setCameraDirectorEnabled(false);
    cameraTargetRef.current = nextTarget;
    setCameraTargetId(nextTarget);
    fortunaAudio.playClick();
    if (phase !== "racing") {
      paint(phase === "finished" ? race.selected.durationMs + getMarbleCameraIntroMs() : 0, phase);
    }
  };

  const setDirectorCameraTarget = (nextTargetId: string | null) => {
    if (cameraTargetRef.current === nextTargetId) return;
    cameraTargetRef.current = nextTargetId;
    setCameraTargetId(nextTargetId);
  };

  const toggleCameraDirector = () => {
    const nextEnabled = !cameraDirectorRef.current;
    cameraDirectorRef.current = nextEnabled;
    setCameraDirectorEnabled(nextEnabled);
    if (nextEnabled) {
      const targetId = ranking.length > 0
        ? (finishRule === "first" ? ranking[0] : ranking[ranking.length - 1])?.racer.id
        : (finishRule === "first" ? race.racers[0] : race.racers[race.racers.length - 1])?.id;
      setDirectorCameraTarget(targetId ?? null);
    }
    fortunaAudio.playClick();
  };

  const stepCameraTarget = (direction: -1 | 1) => {
    if (race.racers.length === 0) return;
    const currentIndex = cameraTargetId
      ? race.racers.findIndex((racer) => racer.id === cameraTargetId)
      : direction > 0 ? -1 : 0;
    const nextIndex = (currentIndex + direction + race.racers.length) % race.racers.length;
    changeCameraTarget(race.racers[nextIndex].id);
  };

  const cycleCameraStyle = () => {
    const styles: MarbleFollowCameraStyle[] = ["chase", "onboard", "trackside", "aerial"];
    const nextStyle = styles[(styles.indexOf(cameraStyle) + 1) % styles.length];
    cameraStyleRef.current = nextStyle;
    setCameraStyle(nextStyle);
    fortunaAudio.playClick();
  };

  const regenerateTrack = () => {
    if (phase !== "ready" || resumedSeed) return;
    fortunaAudio.playClick();
    setSeed(createMarbleSeed());
    resetPreparedRace();
  };

  const changeDifficulty = (nextDifficulty: MarbleDifficulty) => {
    if (phase !== "ready" || resumedSeed || nextDifficulty === difficulty) return;
    fortunaAudio.playClick();
    onDifficultyChange(nextDifficulty);
    setSeed(createMarbleSeed());
    resetPreparedRace();
  };

  const changeFinishRule = (nextFinishRule: MarbleFinishRule) => {
    if (phase !== "ready" || resumedSeed || nextFinishRule === finishRule) return;
    fortunaAudio.playClick();
    onFinishRuleChange(nextFinishRule);
    setSeed(createMarbleSeed());
    resetPreparedRace();
  };

  const startRace = () => {
    if (disabled || phase !== "ready") return;
    try {
      onCommit(seed);
      setCommitError(null);
    } catch {
      setCommitError("La semilla no coincide con el compromiso persistente de esta carrera.");
      return;
    }
    setPhase("racing");
    setRaceEvents([{
      id: `start-${seed}`,
      title: "Compuerta abierta",
      detail: `${participants.length} canicas entran en carrera`,
      tone: "race",
    }]);
    trackedPositionRef.current = null;
    directorCandidateRef.current = { id: null, since: performance.now() };
    directorLastSwitchRef.current = 0;
    triggeredPowersRef.current.clear();
    fortunaAudio.playMarbleStart();
    const startedAt = performance.now();
    let lastUiUpdate = startedAt;
    let fpsWindow = startedAt;
    let frameCount = 0;
    const finishAt = race.selected.durationMs;
    const cameraIntroMs = getMarbleCameraIntroMs();
    const uiUpdateInterval = race.racers.length > 120 ? 320 : race.racers.length > 72 ? 250 : 180;

    const tick = (now: number) => {
      if (!mountedRef.current) return;
      const elapsed = now - startedAt;
      frameCount += 1;
      paint(elapsed, "racing");

      if (now - lastUiUpdate >= uiUpdateInterval) {
        const orderedRacers = race.racers
          .map((racer) => {
            const state = getMarbleProgress(racer, Math.max(0, elapsed - cameraIntroMs), race.track);
            return {
              racer,
              progress: state.progress,
              finished: state.finished,
              powerActive: state.powerActive,
              incomingPowerActive: state.incomingPowerActive,
              activePower: state.activePower,
              activeTrackEvent: state.activeTrackEvent,
              recovering: state.recovering,
            };
          })
          .sort((first, second) => second.progress - first.progress)
          .map((item, index) => ({ ...item, position: index + 1 }));
        setRanking(compactRanking(orderedRacers));
        const trackedRacer = finishRule === "first"
          ? orderedRacers[0]
          : orderedRacers[orderedRacers.length - 1];
        if (cameraDirectorRef.current) {
          const candidate = directorCandidateRef.current;
          if (candidate.id !== trackedRacer.racer.id) {
            directorCandidateRef.current = { id: trackedRacer.racer.id, since: now };
          } else if (
            cameraTargetRef.current !== trackedRacer.racer.id
            && now - candidate.since >= 850
            && now - directorLastSwitchRef.current >= 1_350
          ) {
            setDirectorCameraTarget(trackedRacer.racer.id);
            directorLastSwitchRef.current = now;
          }
        }
        const positionEvent: RaceEvent | null = (
          elapsed > cameraIntroMs + 300
          && trackedPositionRef.current
          && trackedPositionRef.current !== trackedRacer.racer.id
        ) ? {
            id: `position-${trackedRacer.racer.id}-${Math.round(elapsed)}`,
            title: finishRule === "first" ? "Cambio de líder" : "Cambio en la cola",
            detail: finishRule === "first"
              ? `${trackedRacer.racer.participant.name} toma la punta`
              : `${trackedRacer.racer.participant.name} marcha en último lugar`,
            tone: finishRule === "first" ? "race" : "risk",
          } satisfies RaceEvent : null;
        trackedPositionRef.current = trackedRacer.racer.id;
        const activeGlobalEvent = race.track.events.find((event) =>
          trackedRacer.progress >= event.startProgress && trackedRacer.progress <= event.endProgress,
        );
        const globalEventId = activeGlobalEvent ? `track-event-${activeGlobalEvent.id}` : null;
        const globalEvent: RaceEvent | null = activeGlobalEvent && globalEventId && !triggeredPowersRef.current.has(globalEventId)
          ? {
              id: `${globalEventId}-${Math.round(elapsed)}`,
              title: activeGlobalEvent.title,
              detail: activeGlobalEvent.detail,
              tone: activeGlobalEvent.type,
            }
          : null;
        if (globalEventId && globalEvent) triggeredPowersRef.current.add(globalEventId);
        const newEvents = orderedRacers.flatMap(({ racer, powerActive, recovering }) => {
          const events: RaceEvent[] = [];
          const powerEventId = `power-${racer.id}`;
          if (racer.power && powerActive && !triggeredPowersRef.current.has(powerEventId)) {
            triggeredPowersRef.current.add(powerEventId);
            const target = racer.powerTargetId
              ? race.racers.find((candidate) => candidate.id === racer.powerTargetId)
              : null;
            events.push({
              id: `${powerEventId}-${elapsed}`,
              title: `${racer.participant.name} · ${powerLabels[racer.power]}`,
              detail: target
                ? `${powerDescriptions[racer.power]}: ${target.participant.name}`
                : powerDescriptions[racer.power],
              tone: racer.power,
            });
          }
          const recoveryEventId = `recovery-${racer.id}`;
          if (recovering && !triggeredPowersRef.current.has(recoveryEventId)) {
            triggeredPowersRef.current.add(recoveryEventId);
            events.push({
              id: `${recoveryEventId}-${elapsed}`,
              title: `${racer.participant.name} · rescate automático`,
              detail: "Salió del canal y vuelve de forma segura a la compuerta inicial",
              tone: "risk",
            });
          }
          return events;
        }).slice(0, 3);
        if (globalEvent || positionEvent || newEvents.length > 0) {
          setRaceEvents((current) => [
            ...(globalEvent ? [globalEvent] : []),
            ...newEvents,
            ...(positionEvent ? [positionEvent] : []),
            ...current,
          ].slice(0, 4));
        }
        if (globalEvent || newEvents.length > 0) {
          fortunaAudio.playMarblePower();
        }
        lastUiUpdate = now;
      }

      if (now - fpsWindow >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - fpsWindow)));
        fpsWindow = now;
        frameCount = 0;
      }

      if (elapsed >= finishAt + cameraIntroMs) {
        setPhase("finished");
        setRaceEvents((current) => [({
          id: `finish-${race.selected.id}`,
          title: "Resultado en meta",
          detail: `${race.selected.participant.name} cruza ${finishRule === "first" ? "primero" : "en último lugar"}`,
          tone: "finish",
        } satisfies RaceEvent), ...current].slice(0, 4));
        paint(finishAt + cameraIntroMs, "finished");
        fortunaAudio.playMarbleFinish();
        const resultLabel = `Canica #${race.selected.number} · llegó ${finishRule === "first" ? "primera" : "de última"}`;
        finishTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) onFinish(race.selected, resultLabel);
        }, 650);
        return;
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
  };

  const status = phase === "ready" ? "Pista lista" : phase === "racing" ? "Carrera en vivo" : "Resultado confirmado";
  const statusDetail = phase === "ready"
    ? `${race.track.name} · compromiso ${race.track.signature.toUpperCase()}`
    : `${finishRule === "first" ? "La primera" : "La última"} canica en meta ${mode === "direct" ? "gana" : "queda eliminada"}`;
  const displayedRanking: RankingItem[] = ranking.length > 0
    ? ranking
    : compactRanking(race.racers.map((racer, index) => ({
        racer,
        progress: 0,
        finished: false,
        powerActive: false,
        incomingPowerActive: false,
        activePower: null,
        activeTrackEvent: null,
        recovering: false,
        position: index + 1,
      })));
  const omittedRankingCount = Math.max(0, race.racers.length - displayedRanking.length);
  const recentRaceEvents = raceEvents.slice(0, 3);
  const maximumTrackHeight = Math.max(
    ...race.track.points.map((point) => point.elevation ?? 0),
    ...race.track.sections.map((section) => section.bridgeLift),
  );
  const followedState = ranking.find((item) => item.racer.id === cameraTargetId);

  return (
    <div
      className={`marble-race marble-race--${phase}`}
      data-marble-count={participants.length}
      data-fps={fps}
      data-difficulty={difficulty}
      data-track-signature={race.track.signature}
      data-track-sections={race.track.sections.length}
      data-track-points={race.track.points.length}
      data-track-bridges={race.track.sections.filter((section) => section.bridgeLift > 0).length}
      data-track-zones={race.track.zones.length}
      data-track-width={race.track.trackWidth}
      data-obstacles={race.track.obstacles.length}
      data-power-zones={race.track.powerZones.length}
      data-track-events={race.track.events.length}
      data-map-scale={race.track.mapScale}
      data-finish-rule={finishRule}
      data-comeback-powers={race.racers.filter((racer) => racer.powerTargetId).length}
      data-recovery-racers={race.racers.filter((racer) => racer.recoveryAt < 1).length}
      data-camera-target={cameraTargetId ?? "overview"}
      data-camera-style={cameraTargetId ? cameraStyle : "overview"}
      data-camera-director={cameraDirectorEnabled ? "automatic" : "manual"}
      data-release-stage="beta"
    >
      <div className="marble-race-status" aria-live="polite">
        <span className="marble-race-status__icon">{phase === "racing" ? <Gauge size={18} /> : <Gem size={18} />}</span>
        <div className="marble-race-status__copy"><strong>{status}</strong><small>{statusDetail}</small></div>
        <div className="marble-race-status__metrics">
          <span className="is-primary">{difficultyLabels[difficulty]}</span>
          <span>Riesgo {race.track.risk}/5</span>
          <span>{race.track.powerZones.length} poderes</span>
          <span>{race.track.events.length} eventos</span>
          <span>Altura {maximumTrackHeight.toFixed(1)} m</span>
          <span>{phase === "racing" ? `${fps} FPS` : `${participants.length} canicas`}</span>
        </div>
      </div>

      <div className="marble-arena">
        <div className="marble-canvas-stack">
          <canvas
            ref={webglCanvasRef}
            className={`marble-canvas marble-canvas--webgl ${renderMode === "webgl" ? "is-active" : "is-inactive"}`}
            aria-hidden={renderMode !== "webgl"}
            aria-label={renderMode === "webgl" ? `Escenario 3D ${race.track.name}, dificultad ${difficultyLabels[difficulty]}, ${race.track.sections.length} secciones y ${participants.length} canicas` : undefined}
          />
          <canvas
            ref={fallbackCanvasRef}
            className={`marble-canvas marble-canvas--fallback ${renderMode === "fallback" ? "is-active" : "is-inactive"}`}
            aria-hidden={renderMode !== "fallback"}
            aria-label={renderMode === "fallback" ? `Vista compatible 2D de ${race.track.name}, dificultad ${difficultyLabels[difficulty]}, ${race.track.sections.length} secciones y ${participants.length} canicas` : undefined}
          />
        </div>

        <div className={`marble-render-badge marble-render-badge--${renderMode}`} role="status" aria-live="polite">
          <span /> {renderMode === "fallback" ? "VISTA COMPATIBLE 2D" : phase === "racing" && cameraTargetId ? "CÁMARA CANICA EN VIVO" : phase === "racing" ? "CARRERA 3D EN VIVO" : "PISTA 3D VALIDADA"}
        </div>

        <div className="marble-camera-control">
          <Camera size={16} aria-hidden="true" />
          <span><strong>CÁMARA CINEMÁTICA</strong><small>{followedState?.recovering ? "Rescate automático en cámara" : cameraDirectorEnabled ? finishRule === "first" ? "Director estable: sigue al líder" : "Director estable: sigue la última" : cameraTargetId ? `${cameraStyleLabels[cameraStyle]} · seguimiento manual` : "Vista general manual"}</small></span>
          <div className="marble-camera-control__switcher">
            <button type="button" onClick={() => stepCameraTarget(-1)} disabled={renderMode === "fallback"} aria-label="Seguir la canica anterior"><ChevronLeft size={15} /></button>
            <select
              aria-label="Seguir a un participante desde su canica"
              value={cameraTargetId ?? ""}
              onChange={(event) => changeCameraTarget(event.target.value)}
              disabled={renderMode === "fallback"}
            >
              <option value="">Vista general</option>
              {race.racers.map((racer) => (
                <option
                  key={racer.id}
                  value={racer.id}
                  data-recovery-at={racer.recoveryAt < 1 ? racer.recoveryAt.toFixed(3) : "none"}
                  data-comeback-chance={racer.comebackChance.toFixed(3)}
                  data-power-target={racer.powerTargetId ?? "none"}
                >
                  {racer.number}. {racer.participant.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => stepCameraTarget(1)} disabled={renderMode === "fallback"} aria-label="Seguir la canica siguiente"><ChevronRight size={15} /></button>
          </div>
          <div className="marble-camera-control__actions">
            <button
              type="button"
              className={`marble-camera-control__director ${cameraDirectorEnabled ? "is-active" : ""}`}
              onClick={toggleCameraDirector}
              disabled={renderMode === "fallback"}
              aria-pressed={cameraDirectorEnabled}
              aria-label={cameraDirectorEnabled ? "Desactivar director automático" : "Activar director automático"}
            >
              <Sparkles size={13} /> AUTO
            </button>
            <button
              type="button"
              className="marble-camera-control__mode"
              onClick={cycleCameraStyle}
              disabled={renderMode === "fallback" || !cameraTargetId}
              aria-label={`Cambiar estilo de cámara. Estilo actual: ${cameraStyleLabels[cameraStyle]}`}
            >
              <Camera size={13} /> {cameraStyleLabels[cameraStyle]}
            </button>
          </div>
        </div>

        <aside className="marble-live-ranking" aria-label="Clasificación de la carrera">
          <div className="marble-live-ranking__heading">
            <span><Gauge size={14} /> {phase === "ready" ? "Participantes listos" : "Clasificación"}</span>
            <small>{finishRule === "first" ? "PRIMERO DECIDE" : "ÚLTIMO DECIDE"}</small>
          </div>
          <div className="marble-live-ranking__list" role="list">
            {displayedRanking.map((item, index) => {
              const isAtRisk = mode === "elimination" && item.position === race.racers.length;
              return (
                <Fragment key={item.racer.id}>
                  {omittedRankingCount > 0 && index === displayedRanking.length - 1 && (
                    <span
                      className="marble-ranking-omitted"
                      role="separator"
                      aria-label={`${omittedRankingCount} posiciones intermedias ocultas`}
                    >
                      <i aria-hidden="true" /> {omittedRankingCount} posiciones ocultas <i aria-hidden="true" />
                    </span>
                  )}
                  <span className={isAtRisk ? "is-at-risk" : ""} role="listitem">
                    <b>{item.position}</b><i style={{ background: item.racer.accent }} />
                    <strong>{item.racer.participant.name}{item.racer.previousWinner && <Crown size={10} fill="currentColor" aria-label="Ganador anterior" />}</strong>
                    <small className={`marble-ranking-power marble-ranking-power--${item.activePower ?? item.racer.power ?? "none"}`}>
                      {item.recovering
                        ? "Rescate al inicio"
                        : item.incomingPowerActive && item.racer.incomingPower
                          ? `Bajo ${powerLabels[item.racer.incomingPower]}`
                          : item.powerActive && item.racer.power
                            ? `${item.racer.powerTargetId ? "Lanza" : "Activa"} ${powerLabels[item.racer.power]}`
                            : item.racer.power
                              ? `Tiene ${powerLabels[item.racer.power]}`
                              : "Sin poder"}
                    </small>
                    <em>{isAtRisk ? "RIESGO" : item.finished ? "META" : phase === "ready" ? "LISTO" : `${Math.round(item.progress * 100)}%`}</em>
                  </span>
                </Fragment>
              );
            })}
          </div>
        </aside>

        <section className={`marble-event-feed ${recentRaceEvents.length ? "has-event" : ""}`} aria-live="polite" aria-atomic="false">
          <span className="marble-event-feed__label"><WandSparkles size={12} /> Eventos de carrera</span>
          {recentRaceEvents.length ? (
            <div className="marble-event-feed__list">
              {recentRaceEvents.map((event) => (
                <strong key={event.id} className={`marble-event-feed__event marble-event-feed__event--${event.tone}`}>
                  {event.title}
                  <small>{event.detail}</small>
                </strong>
              ))}
            </div>
          ) : (
            <strong className="marble-event-feed__empty">Los eventos aparecerán durante la carrera</strong>
          )}
        </section>

        <div className="marble-map-hud">
          <span>MAPA ACTUAL</span>
          <strong>{race.track.name}</strong>
          <div><small>{difficultyLabels[difficulty]}</small><small>{race.track.lengthRating}</small><small>Altura {maximumTrackHeight.toFixed(1)} m</small><small>{race.track.events.length} eventos</small><small>Riesgo {race.track.risk}/5</small></div>
        </div>
      </div>

      <div className="marble-power-quick-legend" aria-label="Poderes y eventos disponibles en esta dificultad">
        <span><WandSparkles size={13} /> Poderes y eventos</span>
        {race.track.powerZones.map((zone) => zone.power).filter((power, index, powers) => powers.indexOf(power) === index).map((power) => (
          <small className={`marble-power-quick marble-power-quick--${power}`} key={power} title={powerDescriptions[power]} aria-label={`${powerLabels[power]}: ${powerDescriptions[power]}`}>
            <i /> {powerLabels[power]}
          </small>
        ))}
        {race.track.events.map((event) => event.type).filter((event, index, events) => events.indexOf(event) === index).map((event) => (
          <small className={`marble-power-quick marble-power-quick--event-${event}`} key={`event-${event}`}>
            <i /> {trackEventLabels[event]}
          </small>
        ))}
      </div>

      <div className="marble-controls">
        <div className="marble-preflight-options">
          <div className="marble-difficulty-switch" role="radiogroup" aria-label="Dificultad de la pista">
            <span>Dificultad</span>
            {(["easy", "medium", "hard"] as const).map((level) => (
              <button
                type="button"
                role="radio"
                aria-checked={difficulty === level}
                key={level}
                className={difficulty === level ? "is-active" : ""}
                onClick={() => changeDifficulty(level)}
                disabled={phase !== "ready" || resumedSeed}
              >
                {difficultyLabels[level]}
              </button>
            ))}
          </div>
          <div className="marble-finish-rule-switch" role="radiogroup" aria-label="Posición que decide el resultado">
            <span>Decide</span>
            {(["first", "last"] as const).map((rule) => (
              <button
                type="button"
                role="radio"
                aria-checked={finishRule === rule}
                key={rule}
                className={finishRule === rule ? "is-active" : ""}
                onClick={() => changeFinishRule(rule)}
                disabled={phase !== "ready" || resumedSeed}
              >
                {rule === "first" ? "Primero" : "Último"}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="start-button marble-start-button" onClick={startRace} disabled={disabled || phase !== "ready"} aria-describedby="marble-race-help">
          {phase === "racing" ? <><span className="spinner-dot" /> Carrera en curso…</> : phase === "finished" ? <><Flag size={18} /> Carrera finalizada</> : <><Play size={19} fill="currentColor" /> Iniciar carrera</>}
        </button>
        <button type="button" className="text-button marble-regenerate" onClick={regenerateTrack} disabled={phase !== "ready" || resumedSeed}>
          <RefreshCw size={15} /> Generar otro mapa
        </button>
      </div>
      <small id="marble-race-help" className="marble-generation-note"><Sparkles size={11} /> {commitError ?? (resumedSeed ? "Ronda recuperada: mapa y dificultad quedan bloqueados para conservar el compromiso." : "Mapa validado; puedes cambiar dificultad o generar otro antes de iniciar.")}</small>
    </div>
  );
}
