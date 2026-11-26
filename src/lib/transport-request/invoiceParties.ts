export const OUR_COMPANIES = [
  { inn: '9204569514', canonicalName: 'ООО ГГС', aliases: ['ГГС', 'ГЛАВГЕНСТРОЙ'] },
  { inn: '9718232572', canonicalName: 'ООО ЛСТ', aliases: ['ЛСТ', 'ЛИСТ СТАЛИ'] },
] as const;

export type InvoiceKind = 'OUR' | 'SUPPLIER';
export type DetectedKind = InvoiceKind | 'INTERNAL' | 'UNKNOWN';
type Party = { inn: string; name: string };

function normalizeName(value: string) {
  return value.toUpperCase().replace(/["«»„“”]/g, ' ').trim()
    .replace(/^ООО\s+|\s+ООО$/g, '').trim().replace(/\s+/g, ' ');
}

export function getOurCompany(party: Party) {
  if (/^(?:\d{10}|\d{12})$/.test(party.inn)) {
    return OUR_COMPANIES.find(company => company.inn === party.inn);
  }
  const name = normalizeName(party.name);
  return OUR_COMPANIES.find(company => company.aliases.some(alias => alias === name));
}

export function classifyInvoiceParties(seller: Party, buyer: Party) {
  const supplierCompany = getOurCompany(seller);
  const buyerCompany = getOurCompany(buyer);
  const detectedKind: DetectedKind = supplierCompany
    ? (buyerCompany ? 'INTERNAL' : 'OUR')
    : (buyerCompany ? 'SUPPLIER' : 'UNKNOWN');
  return { detectedKind, supplierCompany, buyerCompany };
}

export function matchInvoiceBlock(seller: Party, buyer: Party, expected: InvoiceKind, manualKind?: InvoiceKind) {
  const { detectedKind, supplierCompany, buyerCompany } = classifyInvoiceParties(seller, buyer);
  const accepted = detectedKind === expected || (detectedKind === 'INTERNAL' && manualKind === expected);
  const side = detectedKind === 'INTERNAL' && accepted ? expected : detectedKind;
  const company = side === 'OUR' ? supplierCompany : side === 'SUPPLIER' ? buyerCompany : undefined;
  let message: string;
  if (detectedKind === 'UNKNOWN') {
    message = 'Ни одна из сторон не распознана как компания группы. Проверьте продавца, покупателя и их ИНН.';
  } else if (detectedKind === 'INTERNAL' && !accepted) {
    message = 'Обе стороны счёта относятся к компаниям группы. Требуется ручной выбор типа счёта.';
  } else if (side === 'OUR') {
    message = 'Продавец: ' + company?.canonicalName + (accepted ? '.' : '. Перенесите документ в «Наши счета».');
  } else {
    message = 'Покупатель: ' + company?.canonicalName + (accepted ? '.' : '. Перенесите документ в «Счета от поставщика».');
  }
  return { accepted, detectedKind, message, ourCompanyInn: company?.inn ?? null, ourCompanyName: company?.canonicalName ?? null };
}
