import { NetworkError, ParseError, StrictParseError } from './errors.ts';

export interface Parser {
  /** @throws {ParseError} on bad input. */
  parse(text: string): number;
}

export class StrictParser implements Parser {
  /** @throws {StrictParseError} a subtype of the contract. */
  public parse(text: string): number {
    if (text === '') {
      throw new StrictParseError('empty');
    }

    return text.length;
  }
}

export class LeakyParser implements Parser {
  /** @throws {NetworkError} beyond the contract. -- error: contract */
  public parse(text: string): number {
    if (text === '') {
      throw new NetworkError('offline');
    }

    return text.length;
  }
}

export class InheritingParser implements Parser {
  public parse(text: string): number {
    if (text === '') {
      throw new ParseError('empty');
    }

    return text.length;
  }
}

export class InheritingLeak implements Parser {
  public parse(text: string): number {
    if (text === '') {
      throw new NetworkError('offline'); // error: undocumented
    }

    return text.length;
  }
}

export abstract class Source {
  /** @throws {NetworkError} when the link drops. */
  public abstract read(): string;
}

export class FileSource extends Source {
  /** @throws {RangeError} not in the contract. -- error: contract */
  public read(): string {
    throw new RangeError('no file');
  }
}

export interface Quiet {
  run(): void;
}

export class Loud implements Quiet {
  /** @throws {ParseError} a contract without tags allows nothing. -- error: contract */
  public run(): void {
    throw new ParseError('loud');
  }
}

/** @throws {ParseError} from the field. */
export class Fields {
  public readonly length = parseLength('x');

  public readonly handler = (): never => {
    throw new RangeError('handler'); // error: undocumented
  };
}

export class SilentFields {
  public readonly length = parseLength('x'); // error: undocumented
}

export class WithConstructor {
  public readonly length = parseLength('x'); // error: undocumented

  public constructor() {
    void this.length;
  }
}

export class Child extends Fields {}

export class LeakyChild extends Fields {
  public readonly extra: unknown = JSON.parse('x'); // error: undocumented
}

/** @throws {ParseError} from the parent. */
export class DocumentedChild extends Fields {}

export class QuietChild extends WithConstructor {}

/** @throws {ParseError} for empty text. */
function parseLength(text: string): number {
  if (text === '') {
    throw new ParseError('empty');
  }

  return text.length;
}

export const reader: Parser = {
  parse: (text) => {
    if (text === '') {
      throw new ParseError('empty');
    }

    return text.length;
  },
};

export const leakyReader: Parser = {
  parse(text) {
    throw new NetworkError(text); // error: undocumented
  },
};
