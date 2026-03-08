import type { AffineMatrix, CalibrationPoint } from '@/types';

function leastSquaresSolve(A: number[][], B: number[]): number[] {
  const rows = A.length;
  const cols = A[0].length;

  const AtA: number[][] = Array.from({ length: cols }, () =>
    new Array(cols).fill(0),
  );
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < rows; k++) {
        sum += A[k][i] * A[k][j];
      }
      AtA[i][j] = sum;
    }
  }

  const AtB: number[] = new Array(cols).fill(0);
  for (let i = 0; i < cols; i++) {
    let sum = 0;
    for (let k = 0; k < rows; k++) {
      sum += A[k][i] * B[k];
    }
    AtB[i] = sum;
  }

  const n = cols;
  const augmented: number[][] = AtA.map((row, i) => [...row, AtB[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(augmented[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > maxVal) {
        maxVal = Math.abs(augmented[row][col]);
        maxRow = row;
      }
    }

    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    const pivot = augmented[col][col];
    for (let j = col; j <= n; j++) {
      augmented[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  return augmented.map((row) => row[n]);
}

export function computeAffineTransform(
  points: CalibrationPoint[],
): AffineMatrix {
  const A: number[][] = [];
  const B: number[] = [];

  for (const p of points) {
    A.push([p.gpsLng, p.gpsLat, 1, 0, 0, 0]);
    A.push([0, 0, 0, p.gpsLng, p.gpsLat, 1]);
    B.push(p.pixelX);
    B.push(p.pixelY);
  }

  const params = leastSquaresSolve(A, B);

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
  m: AffineMatrix,
): { x: number; y: number } {
  return {
    x: m.a * lng + m.b * lat + m.tx,
    y: m.c * lng + m.d * lat + m.ty,
  };
}

export function pixelToGps(
  px: number,
  py: number,
  m: AffineMatrix,
): { lat: number; lng: number } {
  const det = m.a * m.d - m.b * m.c;
  return {
    lng: (m.d * (px - m.tx) - m.b * (py - m.ty)) / det,
    lat: (-m.c * (px - m.tx) + m.a * (py - m.ty)) / det,
  };
}
