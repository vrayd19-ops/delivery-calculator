import Decimal from 'decimal.js';
export const rublesToKopeks = (value: string | number | Decimal) => BigInt(new Decimal(value).mul(100).toDecimalPlaces(0).toString());
export const kopeksToRubles = (value: bigint) => new Decimal(value.toString()).div(100);
export const formatRub = (kopeks: bigint | string | number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(kopeks) / 100);
