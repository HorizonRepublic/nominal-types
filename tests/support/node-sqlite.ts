import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { Sequelize } from 'sequelize';

interface Outcome {
  lastID?: number;
  changes?: number;
}

type Callback = (this: Outcome, error: Error | null, rows?: unknown) => void;

type Parameters = readonly unknown[] | Record<string, unknown>;

const bindable = (value: unknown): SQLInputValue => {
  if (typeof value === 'boolean') {
    return Number(value);
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'string' ||
    value instanceof Uint8Array
  ) {
    return value;
  }

  throw new TypeError(`SQLite cannot store a ${typeof value}`);
};

// The driver Sequelize expects from the `sqlite3` package, over the SQLite that ships with Node,
// so the tests need no native build.
class Database {
  public readonly filename: string;
  readonly #database: DatabaseSync;

  public constructor(filename: string, _mode: number, opened: (error: Error | null) => void) {
    this.filename = filename;
    this.#database = new DatabaseSync(filename);
    queueMicrotask(() => {
      opened(null);
    });
  }

  public serialize(queries: () => unknown): void {
    queries();
  }

  public run(sql: string, parameters: Parameters = [], done?: Callback): void {
    this.#execute(sql, parameters, done, (statement, values) => {
      const result = statement.run(...values);

      return [{ lastID: Number(result.lastInsertRowid), changes: Number(result.changes) }];
    });
  }

  public all(sql: string, parameters: Parameters | Callback, done?: Callback): void {
    const [values, callback] =
      typeof parameters === 'function' ? [[], parameters] : [parameters, done];

    this.#execute(sql, values, callback, (statement, bound) => [{}, statement.all(...bound)]);
  }

  public close(done?: (error: Error | null) => void): void {
    if (this.#database.isOpen) {
      this.#database.close();
    }

    done?.(null);
  }

  #execute(
    sql: string,
    parameters: Parameters,
    done: Callback | undefined,
    query: (
      statement: ReturnType<DatabaseSync['prepare']>,
      values: [Record<string, SQLInputValue>, ...SQLInputValue[]],
    ) => [Outcome, unknown?],
  ): void {
    let outcome: Outcome = {};
    let rows: unknown;
    let failure: Error | null = null;

    try {
      const values: [Record<string, SQLInputValue>, ...SQLInputValue[]] = Array.isArray(parameters)
        ? [{}, ...parameters.map((value) => bindable(value))]
        : [
            Object.fromEntries(
              Object.entries(parameters).map(([key, value]) => [key, bindable(value)]),
            ),
          ];

      [outcome, rows] = query(this.#database.prepare(sql), values);
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
    }

    done?.call(outcome, failure, rows);
  }
}

const driver = { OPEN_READWRITE: 2, OPEN_CREATE: 4, Database };

/**
 * An in-memory SQLite database for Sequelize, backed by `node:sqlite`.
 */
export const memorySequelize = (): Sequelize =>
  new Sequelize({ dialect: 'sqlite', dialectModule: driver, storage: ':memory:', logging: false });
