const monthDay =
  '(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|02-(?:0[1-9]|1\\d|2[0-8]))';
const leapYear = '(?:\\d\\d(?:0[48]|[2468][048]|[13579][26])|(?:[02468][048]|[13579][26])00)';

/**
 * Internal: RFC 3339 `full-date` with a real calendar day, leap years included, as a pattern
 * fragment.
 */
export const fullDate: string = `(?:\\d{4}-${monthDay}|${leapYear}-02-29)`;

/**
 * Internal: RFC 3339 `partial-time` without the leap second `60`, and with at most nine fraction
 * digits, the nanoseconds Temporal holds.
 */
export const partialTime = '(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?';

/**
 * Internal: `partialTime` with the seconds optional, `hh:mm` as HTML `time` and `datetime-local`
 * inputs send it.
 */
export const wallTime = '(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d{1,9})?)?';

/**
 * Internal: RFC 3339 `time-offset`, `Z` or a numeric offset up to `±23:59`.
 */
export const timeOffset = '(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)';

/**
 * Internal: a numeric `time-numoffset` up to `±23:59` that states the local offset, so without
 * `-00:00`, which RFC 9557 §2 reads as "offset unknown", like `Z`.
 */
export const localOffset =
  '(?:\\+(?:[01]\\d|2[0-3]):[0-5]\\d|-(?:00:(?:0[1-9]|[1-5]\\d)|(?:0[1-9]|1\\d|2[0-3]):[0-5]\\d))';

/**
 * Internal: an IANA time zone name as RFC 9557 `time-zone-name` writes it, such as
 * `America/Argentina/Buenos_Aires`, in at most three parts as every name of the database has.
 */
export const timeZoneName = '[A-Za-z._][\\w.+-]{0,13}(?:/[A-Za-z._][\\w.+-]{0,13}){0,2}';

/**
 * Internal: a whole-string pattern from fragments.
 */
export const whole = (source: string): RegExp => new RegExp(`^${source}$`, 'u');

const digitsAt = (text: string, start: number, end: number): number =>
  Number(text.slice(start, end));

/**
 * Internal: the year, month and day of text that starts with a `full-date`.
 */
export const dateFields = (text: string): readonly [number, number, number] => [
  digitsAt(text, 0, 4),
  digitsAt(text, 5, 7),
  digitsAt(text, 8, 10),
];

const fractionEnd = (text: string, start: number): number =>
  start + text.slice(start).search(/\D|$/u);

/**
 * Internal: the hour, minute, second, millisecond, microsecond and nanosecond of text holding a
 * `partial-time` from `start`, its seconds possibly left out.
 */
export const timeFields = (
  text: string,
  start: number,
): readonly [number, number, number, number, number, number] => {
  const fraction =
    text.at(start + 8) === '.'
      ? `${text.slice(start + 9, fractionEnd(text, start + 9))}00000000`.slice(0, 9)
      : '000000000';

  return [
    digitsAt(text, start, start + 2),
    digitsAt(text, start + 3, start + 5),
    text.at(start + 5) === ':' ? digitsAt(text, start + 6, start + 8) : 0,
    digitsAt(fraction, 0, 3),
    digitsAt(fraction, 3, 6),
    digitsAt(fraction, 6, 9),
  ];
};

/**
 * Internal: the days from 1970-01-01 to a date of the proleptic Gregorian calendar, year 0
 * included.
 */
export const epochDays = (year: number, month: number, day: number): number => {
  const shifted = month <= 2 ? year - 1 : year;
  const era = Math.floor(shifted / 400);
  const yearOfEra = shifted - era * 400;
  const dayOfYear = Math.floor((153 * ((month + 9) % 12) + 2) / 5) + day - 1;

  return (
    era * 146_097 +
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear -
    719_468
  );
};

/**
 * Internal: the seconds a `time-offset` at the end of text adds to UTC, `Z` being zero.
 */
export const offsetSeconds = (text: string): number => {
  if (text.endsWith('Z')) {
    return 0;
  }

  const seconds =
    digitsAt(text, text.length - 5, text.length - 3) * 3600 +
    digitsAt(text, text.length - 2, text.length) * 60;

  return text.at(-6) === '-' ? -seconds : seconds;
};
