// Faster drop-in for csv-reader 1.0.0: returns exactly the same {columns, rows, errors}
// for every input {text, header}, but scans with native string search (indexOf / regex)
// and slicing instead of building every field one character at a time.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

const DELIM = /[,\n\r]/g;
const CR_BREAK = /\r\n|\r/g;
const LF = /\n/g;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const n = text.length;

  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  // Replicates the reference's readUnquoted: reads onto startValue up to the next
  // comma or line break; a CR not followed by LF is dropped (stray_cr).
  // Returns {value, ended, added} where added counts the characters kept.
  function readUnquoted(startValue) {
    let parts = null;
    let segStart = pos;
    let added = 0;
    for (;;) {
      DELIM.lastIndex = pos;
      const m = DELIM.exec(text);
      if (m === null) {
        added += n - segStart;
        pos = n;
        if (parts !== null) {
          parts.push(text.slice(segStart, n));
          return { value: startValue + parts.join(''), ended: END, added };
        }
        return { value: startValue + text.slice(segStart, n), ended: END, added };
      }
      const idx = m.index;
      const ch = m[0];
      if (ch === '\r' && !(idx + 1 < n && text.charCodeAt(idx + 1) === 10)) {
        // Stray CR: kept segment ends here, the CR itself is dropped.
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, idx));
        added += idx - segStart;
        pos = idx + 1;
        segStart = pos;
        continue;
      }
      // Comma, LF, or CRLF ends the field.
      added += idx - segStart;
      let value;
      if (parts !== null) {
        parts.push(text.slice(segStart, idx));
        value = startValue + parts.join('');
      } else {
        value = startValue + text.slice(segStart, idx);
      }
      if (ch === ',') {
        pos = idx + 1;
        return { value, ended: COMMA, added };
      }
      if (ch === '\n') {
        pos = idx + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      pos = idx + 2; // CRLF
      line += 1;
      return { value, ended: LINE_BREAK, added };
    }
  }

  // Replicates the reference's readQuoted: the opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let parts = null;
    let segStart = pos + 1;
    let p = pos + 1;
    let raw;
    for (;;) {
      const q = text.indexOf('"', p);
      if (q === -1) {
        // The quote never closes: literal character, re-read as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return readUnquoted('"');
      }
      if (q + 1 < n && text.charCodeAt(q + 1) === 34) {
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, q), '"');
        p = q + 2;
        segStart = p;
        continue;
      }
      raw = parts !== null ? parts.join('') + text.slice(segStart, q) : text.slice(segStart, q);
      pos = q + 1;
      break;
    }
    let value;
    if (raw.indexOf('\r') !== -1) {
      value = raw.replace(CR_BREAK, '\n');
      const mm = value.match(LF);
      if (mm !== null) line += mm.length;
    } else {
      const mm = raw.match(LF);
      if (mm !== null) line += mm.length;
      value = raw;
    }
    if (pos >= n) return { value, ended: END };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    const junk = readUnquoted(value);
    if (junk.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    let ended;
    do {
      quoted = text.charCodeAt(pos) === 34;
      const field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
      ended = field.ended;
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
