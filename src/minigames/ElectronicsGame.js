import { createOscilloscopeBench3D } from './OscilloscopeGame.js';

export const COLOR_CODES = [
  { name: 'Noir', digit: 0, mult: 1, hex: '#111827' },
  { name: 'Marron', digit: 1, mult: 10, hex: '#78350f' },
  { name: 'Rouge', digit: 2, mult: 100, hex: '#dc2626' },
  { name: 'Orange', digit: 3, mult: 1000, hex: '#f97316' },
  { name: 'Jaune', digit: 4, mult: 10000, hex: '#facc15' },
  { name: 'Vert', digit: 5, mult: 100000, hex: '#16a34a' },
  { name: 'Bleu', digit: 6, mult: 1000000, hex: '#2563eb' },
  { name: 'Violet', digit: 7, mult: 10000000, hex: '#9333ea' },
  { name: 'Gris', digit: 8, mult: null, hex: '#64748b' },
  { name: 'Blanc', digit: 9, mult: null, hex: '#f8fafc' }
];

export function computeResistorOhms(b1, b2, b3MultIdx) {
  const mult = COLOR_CODES[b3MultIdx]?.mult;
  if (!mult) return 0;
  return (b1 * 10 + b2) * mult;
}

export function formatOhms(ohms) {
  if (ohms >= 1000000) return `${(ohms / 1000000).toFixed(2).replace(/\.00$/, '')} MΩ`;
  if (ohms >= 1000) return `${(ohms / 1000).toFixed(2).replace(/\.00$/, '')} kΩ`;
  return `${ohms} Ω`;
}

export function simulateLedCircuit(vcc, ledUf, ohms, ledForwardPolarity) {
  if (!ledForwardPolarity) {
    return { status: 'reversed', currentMa: 0, vLed: 0, message: 'LED polarisée en inverse : aucun courant ne passe (0 mA).' };
  }
  if (ohms <= 0) {
    return { status: 'burned', currentMa: 999, vLed: vcc, message: 'Court-circuit ! Résistance nulle : la LED a grillé instantanément !' };
  }
  const currentMa = ((vcc - ledUf) / ohms) * 1000;
  if (currentMa > 32) {
    return {
      status: 'burned',
      currentMa: Math.round(currentMa * 10) / 10,
      vLed: ledUf,
      message: `Surintensité (${currentMa.toFixed(1)} mA > 30 mA) ! La LED a grillé !`
    };
  }
  if (currentMa < 6) {
    return {
      status: 'dim',
      currentMa: Math.round(currentMa * 10) / 10,
      vLed: ledUf,
      message: `Courant trop faible (${currentMa.toFixed(1)} mA). La LED éclaire à peine (visez 15–22 mA).`
    };
  }
  return {
    status: 'ok',
    currentMa: Math.round(currentMa * 10) / 10,
    vLed: ledUf,
    message: `Circuit nominal ! Courant mesuré : ${currentMa.toFixed(1)} mA — LED allumée !`
  };
}

export function simulateDividerCircuit(vin, r1Ohms, r2Ohms) {
  if (r1Ohms <= 0 || r2Ohms <= 0) return { vout: 0, ok: false, message: 'Résistances invalides.' };
  const vout = vin * (r2Ohms / (r1Ohms + r2Ohms));
  const ok = vout >= 3.1 && vout <= 3.45;
  return {
    vout: Math.round(vout * 100) / 100,
    ok,
    message: ok
      ? `Parfait ! Vout = ${vout.toFixed(2)} V (compatible entrée GPIO 3.3V ESP32).`
      : vout > 3.45
        ? `DANGER : Vout = ${vout.toFixed(2)} V (> 3.45 V) risque de détruire l'ESP32 !`
        : `Vout = ${vout.toFixed(2)} V trop faible pour détecter un niveau logique HAUT.`
  };
}

export const ELEC_STAGES = [
  { id: 1, name: '1. Loi d’Ohm & Code Couleur' },
  { id: 2, name: '2. Pont Diviseur 5V → 3.3V' },
  { id: 3, name: '3. Mesures Oscilloscope 3D' }
];

export function createElectronicsGame(api) {
  return createOscilloscopeBench3D(api, { variant: 'electronics' });
}
