export function excelSerialToIsoDate(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 30000 || number > 70000) return "";
  const millis = Math.round((number - 25569) * 86400 * 1000);
  return new Date(millis).toISOString().slice(0, 10);
}

export function normalizeIsoDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { value: "", raw: "", normalized: false, reason: "empty" };

  const serialDate = excelSerialToIsoDate(raw);
  if (serialDate) return { value: serialDate, raw, normalized: true, reason: "excel_serial" };

  let match = raw.match(/^(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) match = raw.match(/^(20\d{2})年(\d{1,2})月(\d{1,2})日?$/);
  if (!match) return { value: raw, raw, normalized: false, reason: "unrecognized_or_ambiguous" };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidUtcDate(year, month, day)) {
    return { value: raw, raw, normalized: false, reason: "invalid_date" };
  }

  return {
    value: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    raw,
    normalized: true,
    reason: "full_date_text",
  };
}

export function normalizeDateValue(value) {
  return normalizeIsoDate(value).value;
}

function isValidUtcDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
