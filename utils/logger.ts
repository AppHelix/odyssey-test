export function log(...args: any[]) {
  const ts = new Date().toISOString();
  console.log(`[${ts}]`, ...args);
}
