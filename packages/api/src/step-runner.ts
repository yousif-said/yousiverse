/**
 * Runs one named piece of a background job and returns its result. The job runner (Inngest)
 * runs each step as its own request, retries it on its own, and remembers its result, so a
 * step's name must be the same every time the job is replayed.
 */
export type StepRunner = <Result>(name: string, work: () => Promise<Result>) => Promise<Result>;

export function inBatches<Item>(items: Item[], size: number): Item[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}
