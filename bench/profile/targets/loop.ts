/**
 * Runs `work` for about two seconds, so a profile holds a warm, steady run, and prints how often it
 * ran.
 */
export const loop = (name: string, work: () => unknown, seconds = 2): void => {
  const until = performance.now() + seconds * 1000;
  let runs = 0;

  while (performance.now() < until) {
    work();
    runs += 1;
  }

  console.log(`${name}: ${String(runs)} runs, ${((seconds * 1e6) / runs).toFixed(1)} µs each`);
};
