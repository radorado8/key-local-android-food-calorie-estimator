export function escapeCsvField(value) {
  const normalized = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function parseCsvRow(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

export function parseFiniteNumber(value) {
  const parsed = Number.parseFloat(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}
