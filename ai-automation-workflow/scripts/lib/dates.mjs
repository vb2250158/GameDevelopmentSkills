export {
  excelSerialToIsoDate,
  normalizeDateValue,
  normalizeIsoDate,
} from "../../../read-tencent-docs-opendoc/scripts/dates.mjs";

export function isNormalizedIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}
