import { useEffect } from "react";

const EVENT = "files:changed";
export const notifyFilesChanged = () => window.dispatchEvent(new Event(EVENT));

/** Lets pages refresh after an upload or delete that happened in a global dialog. */
export function useFilesChanged(callback: () => void) {
  useEffect(() => {
    window.addEventListener(EVENT, callback);
    return () => window.removeEventListener(EVENT, callback);
  }, [callback]);
}
