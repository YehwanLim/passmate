// Browser persistence is intentionally delete-only. Reports and resume text
// are retrieved from authenticated APIs instead of device storage.

function browserStorages(): Storage[] {
  if (typeof window === "undefined") return [];
  return [window.localStorage, window.sessionStorage];
}

/** Removes every legacy PassMate entry on this device. */
export function clearPassMateStorage(): void {
  for (const storage of browserStorages()) {
    try {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith("passmate_")) storage.removeItem(key);
      }
    } catch {
      // Storage can be unavailable in private browser modes.
    }
  }
}
