import { libraries } from './libraries.ts';
import { scenarios } from './scenarios.ts';

let failures = 0;

for (const library of libraries) {
  for (const scenario of scenarios) {
    const check = scenario.pick(library);

    if (check === undefined) {
      continue;
    }

    const wrong = scenario.inputs.filter(
      (input) => library.accepted(check(input)) !== scenario.valid,
    );

    if (wrong.length > 0) {
      failures += 1;
      console.log(
        `${library.name}, ${scenario.title}: ${wrong.length} answers wrong, such as ${JSON.stringify(wrong[0])?.slice(0, 80)}`,
      );
    }
  }
}

console.log(
  failures === 0 ? 'every check answers as expected' : `${failures} checks answer wrongly`,
);
process.exitCode = failures === 0 ? 0 : 1;
