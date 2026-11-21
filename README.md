# makefun-csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in replacement for make.fun's csv-reader 1.0.0. Its `run(input)`
returns exactly the same `{columns, rows, errors}` for every input — including
every broken-row case (stray CRs, unterminated quotes, quote junk, short and
long rows) — but scans with native string search (`indexOf`, a delimiter
regex, `replace`/`match`) and slicing instead of building each field one
character at a time. Verified byte-identical against the reference on the
kit's practice set and several thousand fuzzed broken-CSV inputs, and about
2.6x faster end to end on the practice set.

## Run it

```sh
MAKEFUN_INPUT_DIR=/input MAKEFUN_OUTPUT_DIR=/output node main.ts
```

`main.ts` reads every case from `cases.json` in the input directory, answers
each with `solve.js`'s `run`, and writes `answers.json` to the output
directory.

---

<sub>Entered on [make.fun](https://make.fun/?ref=v4mq9950&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
