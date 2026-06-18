// A focused BibTeX reader for import-only use (concept §3 Source, §6.5).
//
// It is intentionally lean: it splits a .bib file into entries, pulls the
// citekey + a handful of display fields, and keeps each entry's raw text
// verbatim. The raw text is the source of truth, so imperfect field extraction
// never loses information. @string macros / @preamble / @comment are skipped.

export interface BibEntry {
  key: string;
  type: string;
  fields: Record<string, string>;
  raw: string;
}

export interface ParsedSource {
  key: string;
  author: string | null;
  year: string | null;
  title: string | null;
  venue: string | null;
  raw_bibtex: string;
}

// Strip whitespace and the braces used only for capitalization protection.
function cleanValue(v: string): string {
  return v
    .replace(/\s+/g, " ")
    .replace(/[{}]/g, "")
    .trim();
}

function splitKeyAndFields(body: string): { key: string; fieldsStr: string } {
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      return { key: body.slice(0, i).trim(), fieldsStr: body.slice(i + 1) };
    }
  }
  return { key: body.trim(), fieldsStr: "" };
}

function parseFields(s: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const n = s.length;
  let i = 0;
  while (i < n) {
    while (i < n && (/\s/.test(s[i]) || s[i] === ",")) i++;
    if (i >= n) break;

    let eq = i;
    while (eq < n && s[eq] !== "=") eq++;
    if (eq >= n) break;
    const name = s.slice(i, eq).trim().toLowerCase();
    i = eq + 1;
    while (i < n && /\s/.test(s[i])) i++;

    let value = "";
    if (s[i] === "{") {
      let depth = 0;
      const start = i;
      for (; i < n; i++) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      value = s.slice(start + 1, i - 1);
    } else if (s[i] === '"') {
      const start = i + 1;
      i++;
      let depth = 0;
      for (; i < n; i++) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") depth--;
        else if (s[i] === '"' && depth === 0) break;
      }
      value = s.slice(start, i);
      i++;
    } else {
      const start = i;
      let depth = 0;
      for (; i < n; i++) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") depth--;
        else if (s[i] === "," && depth === 0) break;
      }
      value = s.slice(start, i);
    }

    if (name) fields[name] = cleanValue(value);
  }
  return fields;
}

export function parseBibtex(input: string): BibEntry[] {
  const out: BibEntry[] = [];
  const n = input.length;
  let i = 0;
  while (i < n) {
    const at = input.indexOf("@", i);
    if (at === -1) break;

    let j = at + 1;
    while (j < n && /[A-Za-z]/.test(input[j])) j++;
    const type = input.slice(at + 1, j).toLowerCase();
    while (j < n && /\s/.test(input[j])) j++;

    const open = input[j];
    if (open !== "{" && open !== "(") {
      i = at + 1;
      continue;
    }

    // Find the entry's closing delimiter, tracking brace depth.
    let depth = 0;
    let end = -1;
    for (let k = j; k < n; k++) {
      const ch = input[k];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      if (open === "{" ? ch === "}" && depth === 0 : ch === ")" && depth === 0) {
        end = k;
        break;
      }
    }
    if (end === -1) break;

    const raw = input.slice(at, end + 1);
    const body = input.slice(j + 1, end);
    i = end + 1;

    if (type === "comment" || type === "preamble" || type === "string") continue;

    const { key, fieldsStr } = splitKeyAndFields(body);
    if (!key) continue;
    out.push({ key, type, fields: parseFields(fieldsStr), raw });
  }
  return out;
}

export function entryToSource(e: BibEntry): ParsedSource {
  const f = e.fields;
  const year = f.year || (f.date ? f.date.slice(0, 4) : "") || null;
  const venue =
    f.journal || f.booktitle || f.publisher || f.school || f.institution || f.howpublished || null;
  return {
    key: e.key,
    author: f.author || f.editor || null,
    year: year || null,
    title: f.title || null,
    venue,
    raw_bibtex: e.raw,
  };
}

function firstAuthorLast(author: string): string {
  const parts = author.split(/\s+and\s+/i);
  const first = parts[0].trim();
  const last = first.includes(",")
    ? first.split(",")[0].trim()
    : (first.split(/\s+/).pop() ?? first);
  return last + (parts.length > 1 ? " et al." : "");
}

// Short disambiguating label, e.g. "Smith et al. (2018)".
export function shortLabel(author: string | null, year: string | null): string {
  const a = author ? firstAuthorLast(author) : "Anon.";
  return a + (year ? ` (${year})` : "");
}
