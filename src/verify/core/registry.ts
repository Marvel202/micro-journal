import type { VerifiableUnit, Verifier } from "./types";

const units = new Map<string, VerifiableUnit<any>>();
const verifiers = new Map<string, Verifier>();

export function registerUnit<P>(unit: VerifiableUnit<P>): void {
  if (units.has(unit.name)) {
    throw new Error(`Duplicate unit name: ${unit.name}`);
  }
  units.set(unit.name, unit as VerifiableUnit<any>);
}

export function registerVerifier(v: Verifier): void {
  if (verifiers.has(v.name)) {
    throw new Error(`Duplicate verifier name: ${v.name}`);
  }
  verifiers.set(v.name, v);
}

export function getUnit(name: string): VerifiableUnit<any> | undefined {
  return units.get(name);
}

export function listUnits(): VerifiableUnit<any>[] {
  return Array.from(units.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function listVerifiers(): Verifier[] {
  return Array.from(verifiers.values());
}
