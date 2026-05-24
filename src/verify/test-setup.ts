// Marks the jsdom environment as an act() environment so React stops warning
// when the runner uses act() to flush effects.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom doesn't implement Blob URLs. EntryCard calls URL.createObjectURL on
// photo Blobs in a useEffect, so stub them out for the verifier matrix.
if (typeof URL.createObjectURL === "undefined") {
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:mock", writable: true });
}
if (typeof URL.revokeObjectURL === "undefined") {
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, writable: true });
}
