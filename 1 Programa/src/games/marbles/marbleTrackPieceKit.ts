import * as THREE from "three";
import type { TrackSection, TrackSectionType } from "./marbleRaceEngine";

export interface MarbleTrackPieceSpecification {
  nominalLength: number;
  maximumHeight: number;
  shoulder: number;
  description: string;
}

/** Medidas en unidades de mundo; una unidad equivale a un metro del contrato 3D. */
export const MARBLE_TRACK_PIECE_SPECS: Record<TrackSectionType, MarbleTrackPieceSpecification> = {
  start: { nominalLength: 2.4, maximumHeight: 1.72, shoulder: 0.29, description: "Compuerta de salida con dintel y balizas" },
  straight: { nominalLength: 2, maximumHeight: 0.34, shoulder: 0.29, description: "Cassette recto con traviesas y seguros laterales" },
  curve: { nominalLength: 2.1, maximumHeight: 0.62, shoulder: 0.34, description: "Curva peraltada con actuadores exteriores" },
  "s-curve": { nominalLength: 2.4, maximumHeight: 0.58, shoulder: 0.34, description: "Serpentina reforzada con apoyos alternos" },
  tunnel: { nominalLength: 2.25, maximumHeight: 1.62, shoulder: 0.31, description: "Túnel de costillas y conducto superior" },
  funnel: { nominalLength: 2.2, maximumHeight: 0.74, shoulder: 0.42, description: "Embudo gravitatorio abierto" },
  split: { nominalLength: 2.35, maximumHeight: 0.58, shoulder: 0.38, description: "Bifurcación con divisor luminoso" },
  "speed-zone": { nominalLength: 2.4, maximumHeight: 0.32, shoulder: 0.29, description: "Módulo turbo de tres etapas" },
  "ice-zone": { nominalLength: 2.25, maximumHeight: 0.78, shoulder: 0.35, description: "Canal glacial con protecciones de cristal" },
  finish: { nominalLength: 2.4, maximumHeight: 1.72, shoulder: 0.29, description: "Meta real con arco de lectura" },
};

const metal = (color: THREE.ColorRepresentation, roughness = 0.25) => new THREE.MeshStandardMaterial({
  color,
  metalness: 0.86,
  roughness,
});

const emissive = (color: THREE.ColorRepresentation, intensity = 1.25) => new THREE.MeshStandardMaterial({
  color,
  emissive: color,
  emissiveIntensity: intensity,
  metalness: 0.42,
  roughness: 0.24,
});

const glass = (color: THREE.ColorRepresentation) => new THREE.MeshPhysicalMaterial({
  color,
  emissive: color,
  emissiveIntensity: 0.24,
  metalness: 0.05,
  roughness: 0.1,
  transparent: true,
  opacity: 0.68,
  transmission: 0.16,
  clearcoat: 1,
});

const add = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const createArrowGeometry = () => {
  const arrow = new THREE.Shape();
  arrow.moveTo(-0.3, 0.45);
  arrow.lineTo(0, 0.72);
  arrow.lineTo(0.3, 0.45);
  arrow.lineTo(0.12, 0.45);
  arrow.lineTo(0.12, -0.56);
  arrow.lineTo(-0.12, -0.56);
  arrow.lineTo(-0.12, 0.45);
  arrow.closePath();
  const geometry = new THREE.ShapeGeometry(arrow);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
};

const addArch = (group: THREE.Group, width: number, z: number, color: THREE.ColorRepresentation) => {
  add(group, new THREE.TorusGeometry(width * 0.57, 0.075, 7, 18, Math.PI), metal(color, 0.2), [0, 0.12, z], [0, 0, Math.PI]);
};

/**
 * Crea el detalle visible de una pieza. El deck continuo sigue siendo una sola
 * cinta para evitar grietas; este kit aporta carcasa, barandas y la silueta de
 * cada módulo sobre el punto medio de la sección.
 */
export const createMarbleTrackPiece3D = (section: TrackSection, laneWidth: number) => {
  const spec = MARBLE_TRACK_PIECE_SPECS[section.type];
  const length = THREE.MathUtils.clamp(section.length * 24, spec.nominalLength * 0.64, spec.nominalLength * 1.22);
  const group = new THREE.Group();
  group.name = `KIT_${section.moduleId}`;
  group.userData.asset = {
    moduleId: section.moduleId,
    type: section.type,
    dimensions: { width: laneWidth + spec.shoulder * 2, height: spec.maximumHeight, length },
    sockets: { input: [0, 0, -length / 2], output: [0, 0, length / 2] },
  };

  const steel = metal(0x30393c, 0.24);
  const anthracite = metal(0x12191b, 0.34);
  const brass = metal(0xb57929, 0.2);
  const cyan = emissive(0x0adce0, 1.22);
  const amber = emissive(0xf1ac35, 1.14);

  [-1, 1].forEach((side) => {
    add(group, new THREE.BoxGeometry(0.11, 0.13, length * 0.46), anthracite, [side * (laneWidth / 2 + 0.13), 0.08, 0]);
    add(group, new THREE.BoxGeometry(0.035, 0.035, length * 0.32), side < 0 ? cyan : amber, [side * (laneWidth / 2 + 0.13), 0.17, 0]);
  });

  if (section.type === "start" || section.type === "finish") {
    [-1, 1].forEach((side) => {
      add(group, new THREE.CylinderGeometry(0.13, 0.18, 1.42, 9), brass, [side * laneWidth * 0.63, 0.66, 0]);
      add(group, new THREE.TorusGeometry(0.17, 0.045, 6, 12), section.type === "finish" ? amber : cyan, [side * laneWidth * 0.63, 1.36, 0], [Math.PI / 2, 0, 0]);
    });
    add(group, new THREE.BoxGeometry(laneWidth * 1.45, 0.22, 0.3), brass, [0, 1.42, 0]);
    add(group, new THREE.BoxGeometry(laneWidth * 0.9, 0.07, 0.12), section.type === "finish" ? amber : cyan, [0, 0.26, 0]);
  } else if (section.type === "straight") {
    [-0.28, 0, 0.28].forEach((ratio, index) => {
      add(group, new THREE.BoxGeometry(laneWidth * 0.8, 0.045, 0.075), index === 1 ? brass : steel, [0, 0.145, ratio * length]);
    });
  } else if (section.type === "curve") {
    const outerSide = section.turn >= 0 ? 1 : -1;
    [-0.3, 0, 0.3].forEach((ratio, index) => {
      add(group, new THREE.CylinderGeometry(0.07, 0.11, 0.44 + index * 0.08, 7), brass, [outerSide * laneWidth * 0.57, 0.22, ratio * length], [0, 0, outerSide * 0.28]);
    });
    add(group, new THREE.BoxGeometry(0.12, 0.12, length * 0.65), amber, [outerSide * laneWidth * 0.47, 0.31, 0], [0, outerSide * section.turn * 0.16, 0]);
  } else if (section.type === "s-curve") {
    [-0.34, 0, 0.34].forEach((ratio, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      add(group, new THREE.BoxGeometry(0.1, 0.42, 0.1), brass, [side * laneWidth * 0.54, 0.16, ratio * length], [0, 0, side * 0.32]);
      add(group, new THREE.BoxGeometry(laneWidth * 0.34, 0.06, 0.08), side < 0 ? cyan : amber, [side * laneWidth * 0.2, 0.2, ratio * length], [0, side * 0.42, 0]);
    });
  } else if (section.type === "tunnel") {
    [-0.34, 0, 0.34].forEach((ratio, index) => addArch(group, laneWidth, ratio * length, index === 1 ? 0xd49a38 : 0x505b5e));
    add(group, new THREE.CylinderGeometry(0.08, 0.08, length * 0.82, 8), cyan, [0, laneWidth * 0.58, 0], [Math.PI / 2, 0, 0]);
  } else if (section.type === "funnel") {
    add(group, new THREE.CylinderGeometry(laneWidth * 0.56, laneWidth * 0.3, 0.42, 22, 1, true), metal(0x553765, 0.25), [0, 0.13, 0]);
    add(group, new THREE.TorusGeometry(laneWidth * 0.56, 0.075, 7, 26), emissive(0xd87cff, 0.82), [0, 0.34, 0], [Math.PI / 2, 0, 0]);
  } else if (section.type === "split") {
    add(group, new THREE.ConeGeometry(0.2, 0.88, 3), brass, [0, 0.25, -length * 0.08], [Math.PI / 2, 0, 0]);
    [-1, 1].forEach((side) => add(group, new THREE.BoxGeometry(0.11, 0.11, length * 0.62), side < 0 ? cyan : amber, [side * laneWidth * 0.24, 0.19, length * 0.08], [0, side * 0.17, 0]));
  } else if (section.type === "speed-zone") {
    const arrowGeometry = createArrowGeometry();
    [-0.27, 0, 0.27].forEach((ratio) => add(group, arrowGeometry.clone(), cyan, [0, 0.19, ratio * length], [0, 0, 0], [laneWidth * 0.65, 1, laneWidth * 0.65]));
  } else if (section.type === "ice-zone") {
    add(group, new THREE.BoxGeometry(laneWidth * 0.9, 0.07, length * 0.72), glass(0x8fe9ff), [0, 0.16, 0]);
    [-1, 1].forEach((side) => {
      [-0.26, 0.22].forEach((ratio, index) => add(group, new THREE.ConeGeometry(0.12 + index * 0.04, 0.48 + index * 0.16, 5), glass(0x8fe9ff), [side * laneWidth * 0.48, 0.36, ratio * length]));
    });
  }
  return group;
};
