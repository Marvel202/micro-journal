import { registerUnit } from "../core/registry";
import { composerUnit } from "./Composer.verify";
import { entryCardUnit } from "./EntryCard.verify";

let registered = false;

export function ensureUnitsRegistered(): void {
  if (registered) return;
  registerUnit(composerUnit);
  registerUnit(entryCardUnit);
  registered = true;
}
