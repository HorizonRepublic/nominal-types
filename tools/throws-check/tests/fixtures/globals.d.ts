declare namespace Temporal {
  class PlainDate {
    constructor(year: number, month: number, day: number);
    static from(text: string): PlainDate;
  }
}

declare function now<T>(callback: () => T): T;
