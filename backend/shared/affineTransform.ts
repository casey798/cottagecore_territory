import { CalibrationPoint, AffineMatrix } from './types';

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const m = A[0].length;

  // A^T * A
  const AtA: number[][] = Array.from({ length: m }, () => Array(m).fill(0) as number[]);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[k][i] * A[k][j];
      }
      AtA[i][j] = sum;
    }
  }

  // A^T * b
  const Atb: number[] = Array(m).fill(0) as number[];
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += A[k][i] * b[k];
    }
    Atb[i] = sum;
  }

  // Gaussian elimination with partial pivoting on AtA | Atb
  const aug: number[][] = AtA.map((row, i) => [...row, Atb[i]]);

  for (let col = 0; col < m; col++) {
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error('Singular matrix — cannot solve');
    }

    for (let j = col; j <= m; j++) {
      aug[col][j] /= pivot;
    }

    for (let row = 0; row < m; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j <= m; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map((row) => row[m]);
}

export function computeAffineTransform(points: CalibrationPoint[]): AffineMatrix {
  if (points.length < 3) {
    throw new Error('At least 3 calibration points required');
  }

  const n = points.length;
  const A: number[][] = [];
  const B: number[] = [];

  for (const p of points) {
    A.push([p.gpsLng, p.gpsLat, 1, 0, 0, 0]);
    A.push([0, 0, 0, p.gpsLng, p.gpsLat, 1]);
    B.push(p.pixelX);
    B.push(p.pixelY);
  }

  const params = solveLinearSystem(A, B);

  return {
    a: params[0],
    b: params[1],
    tx: params[2],
    c: params[3],
    d: params[4],
    ty: params[5],
  };
}

export function gpsToPixel(
  lat: number,
  lng: number,
  m: AffineMatrix
): { x: number; y: number } {
  return {
    x: m.a * lng + m.b * lat + m.tx,
    y: m.c * lng + m.d * lat + m.ty,
  };
}

export function pixelToGps(
  px: number,
  py: number,
  m: AffineMatrix
): { lat: number; lng: number } {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) {
    throw new Error('Degenerate transform — determinant is zero');
  }
  return {
    lng: (m.d * (px - m.tx) - m.b * (py - m.ty)) / det,
    lat: (-m.c * (px - m.tx) + m.a * (py - m.ty)) / det,
  };
}
