// Fonctions mathématiques reproductibles au bit près d'un moteur JavaScript à l'autre.
//
// Pourquoi : le serveur rejoue les combats de la Tour pour vérifier le classement (src/sim/rejeu.ts). Or le résultat
// de Math.sin, Math.cos, Math.atan2, Math.exp et Math.hypot n'est pas fixé par la norme : Safari, Firefox et Node
// peuvent différer du dernier bit, et le combat rejoué finit par diverger. Les opérations + - × ÷ et Math.sqrt, elles,
// sont exactes partout (IEEE 754) : tout est donc écrit ici avec elles seules.
//
// Règle : dans src/sim, aucun appel direct à ces cinq fonctions de Math (tests/dmath.test.ts le vérifie).
// Précision : environ 1e-13, largement assez pour le jeu.
const PI = Math.PI,
  TAU = 2 * PI,
  PI_2 = PI / 2,
  LN2 = 0.6931471805599453;

export const hypot = (x: number, y: number) => Math.sqrt(x * x + y * y);

// sinus sur [-π/2, π/2] : série de Taylor en x², jusqu'à x^21
function sinNoyau(x: number) {
  const x2 = x * x;
  let s = -1 / 51090942171709440000; // 1/21!
  s = s * x2 + 1 / 121645100408832000;
  s = s * x2 - 1 / 355687428096000;
  s = s * x2 + 1 / 1307674368000;
  s = s * x2 - 1 / 6227020800;
  s = s * x2 + 1 / 39916800;
  s = s * x2 - 1 / 362880;
  s = s * x2 + 1 / 5040;
  s = s * x2 - 1 / 120;
  s = s * x2 + 1 / 6;
  return x - x * x2 * s;
}
export function sin(x: number) {
  if (!Number.isFinite(x)) return NaN;
  let r = x - TAU * Math.round(x / TAU); // dans [-π, π]
  if (r > PI_2) r = PI - r;
  else if (r < -PI_2) r = -PI - r;
  return sinNoyau(r);
}
export const cos = (x: number) => sin(x + PI_2);

// arc tangente sur [0, +∞[ : deux réductions atan(z) = 2 atan(z / (1 + √(1 + z²))), puis série de Taylor
function atanPos(z: number) {
  let inv = false;
  if (z > 1) {
    z = 1 / z;
    inv = true;
  }
  z = z / (1 + Math.sqrt(1 + z * z));
  z = z / (1 + Math.sqrt(1 + z * z)); // z ≤ tan(π/16) ≈ 0,199
  const z2 = z * z;
  let s = 1 / 23;
  s = 1 / 21 - z2 * s;
  s = 1 / 19 - z2 * s;
  s = 1 / 17 - z2 * s;
  s = 1 / 15 - z2 * s;
  s = 1 / 13 - z2 * s;
  s = 1 / 11 - z2 * s;
  s = 1 / 9 - z2 * s;
  s = 1 / 7 - z2 * s;
  s = 1 / 5 - z2 * s;
  s = 1 / 3 - z2 * s;
  const a = 4 * (z - z * z2 * s);
  return inv ? PI_2 - a : a;
}
export function atan2(y: number, x: number) {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x),
    ay = Math.abs(y);
  let a = ax === 0 ? PI_2 : atanPos(ay / ax);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

// exponentielle : e^x = 2^k × e^r avec |r| ≤ ln 2 / 2, série de Taylor pour e^r
export function exp(x: number) {
  if (Number.isNaN(x)) return NaN;
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x / LN2),
    r = x - k * LN2;
  let s = 1 / 6227020800; // 1/13!
  s = s * r + 1 / 479001600;
  s = s * r + 1 / 39916800;
  s = s * r + 1 / 3628800;
  s = s * r + 1 / 362880;
  s = s * r + 1 / 40320;
  s = s * r + 1 / 5040;
  s = s * r + 1 / 720;
  s = s * r + 1 / 120;
  s = s * r + 1 / 24;
  s = s * r + 1 / 6;
  s = s * r + 1 / 2;
  s = s * r + 1;
  s = s * r + 1;
  // 2^k par multiplications exactes (Math.pow n'est pas garanti exact partout)
  let p = 1;
  const f = k < 0 ? 0.5 : 2;
  for (let i = Math.abs(k); i > 0; i--) p *= f;
  return s * p;
}
