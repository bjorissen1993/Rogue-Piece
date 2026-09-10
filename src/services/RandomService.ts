export class RandomService {
  private readonly seed: string;

  constructor(seed: string) {
    this.seed = seed;
  }

  getSeed(): string {
    return this.seed;
  }

  next(): number {
    return Math.random();
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  roll(sides: number): number {
    return this.nextInt(1, sides);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty list");
    }
    return items[Math.floor(this.next() * items.length)]!;
  }

    pickWeighted<T extends { weight: number }>(items: readonly T[]): T {
    const eligible = items.filter((item) => item.weight > 0);
    if (eligible.length === 0) {
      throw new Error("Cannot pick from weights that are all zero");
    }
    const total = eligible.reduce((sum, item) => sum + item.weight, 0);
    let ticket = this.next() * total;
    for (const item of eligible) {
      ticket -= item.weight;
      if (ticket <= 0) {
        return item;
      }
    }
    return eligible[eligible.length - 1]!;
  }

  sampleWeighted<T extends { weight: number }>(items: readonly T[], count: number): T[] {
    const pool = items.filter((item) => item.weight > 0);
    const picked: T[] = [];
    const remaining = [...pool];
    while (picked.length < count && remaining.length > 0) {
      const choice = this.pickWeighted(remaining);
      picked.push(choice);
      const index = remaining.indexOf(choice);
      remaining.splice(index, 1);
    }
    return picked;
  }
}

export function createRng(seed: string): RandomService {
  return new RandomService(seed);
}
