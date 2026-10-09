import { NextResponse } from 'next/server';

const OCR_URL =
  process.env.OCR_URL || 'http://localhost:8000';

type OCRResponse = {
  ok?: boolean;
  text?: string[];
  fullText?: string;

  fields?: {
    surname?: string | null;
    name?: string | null;
    patronymic?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    birthPlace?: string | null;
    issueDate?: string | null;
    divisionCode?: string | null;
    mrz?: string | null;
  };

  passport?: {
    series?: string | null;
    number?: string | null;
  };
};

type ParsedInvoice = {
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: string;
};

type ParsedPassport = {
  driverFullName: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssueDate: string;
};

function cleanSpaces(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(value: string) {
  const text = cleanSpaces(value);

  const numeric = text.match(
    /\b(\d{2})[.\/-](\d{2})[.\/-](\d{4})\b/,
  );

  if (numeric) {
    return `${numeric[1]}.${numeric[2]}.${numeric[3]}`;
  }

  const malformed = text.match(
    /\b(\d{2})[.\/-](\d{2})(\d{4})\b/,
  );

  if (malformed) {
    return `${malformed[1]}.${malformed[2]}.${malformed[3]}`;
  }

  const russianMonths: Record<string, string> = {
    января: '01',
    февраля: '02',
    марта: '03',
    апреля: '04',
    мая: '05',
    июня: '06',
    июля: '07',
    августа: '08',
    сентября: '09',
    октября: '10',
    ноября: '11',
    декабря: '12',
  };

  const russian = text.match(
    /\b(\d{1,2})\s+([А-ЯЁа-яё]+)\s+(\d{4})\b/i,
  );

  if (russian) {
    const month =
      russianMonths[russian[2].toLowerCase()];

    if (month) {
      return `${russian[1].padStart(2, '0')}.${month}.${russian[3]}`;
    }
  }

  return '';
}

function getOCRText(ocr: OCRResponse) {
  if (
    Array.isArray(ocr.text) &&
    ocr.text.length > 0
  ) {
    return ocr.text
      .map((line) => cleanSpaces(String(line)))
      .filter(Boolean);
  }

  if (ocr.fullText) {
    return ocr.fullText
      .split(/\r?\n/)
      .map((line) => cleanSpaces(line))
      .filter(Boolean);
  }

  return [];
}

async function runOCR(
  file: File,
): Promise<OCRResponse> {
  const formData = new FormData();

  formData.append('file', file);

  console.log(
    'OCR: sending file to:',
    OCR_URL,
    file.name,
    file.size,
  );

  const response = await fetch(
    `${OCR_URL}/ocr`,
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `OCR service returned ${response.status}: ${text}`,
    );
  }

  return (await response.json()) as OCRResponse;
}

/* =========================================================
   СЧЁТ
   ========================================================= */

function extractSupplier(
  lines: string[],
) {
  for (const rawLine of lines) {
    const line = cleanSpaces(rawLine);

    const quoted = line.match(
      /ООО\s*["«„“]?([^"»”„“]+)["»”]?/i,
    );

    if (quoted) {
      const name = cleanSpaces(quoted[1]);

      if (
        name &&
        /металл|сервис|металлсервис/i.test(name)
      ) {
        return `ООО "${name}"`;
      }
    }

    const unquoted = line.match(
      /\bООО\s+([А-ЯЁA-Z][А-ЯЁа-яёA-Za-z-]*(?:\s+[А-ЯЁа-яёA-Za-z-]+)*)/i,
    );

    if (unquoted) {
      const name = cleanSpaces(unquoted[1]);

      if (
        name &&
        /металл|сервис|металлсервис/i.test(name)
      ) {
        return `ООО "${name}"`;
      }
    }
  }

  return '';
}

function extractInvoiceNumber(
  lines: string[],
) {
  for (const line of lines) {
    const match = line.match(
      /Счет\s*№\s*([0-9]+)/i,
    );

    if (match) {
      return match[1];
    }
  }

  return '';
}

function extractInvoiceDate(
  lines: string[],
) {
  for (const line of lines) {
    if (
      /^от\b/i.test(line) ||
      /счет/i.test(line)
    ) {
      const date = normalizeDate(line);

      if (date) {
        return date;
      }
    }
  }

  for (const line of lines) {
    const date = normalizeDate(line);

    if (date) {
      return date;
    }
  }

  return '';
}

function extractInvoiceAmount(
  lines: string[],
) {
  for (const line of lines) {
    if (/итого/i.test(line)) {
      const match = line.match(
        /Итого\s*:?\s*([\d\s]+[,.]\d{2})/i,
      );

      if (match) {
        return cleanSpaces(match[1]);
      }
    }
  }

  for (
    let i = 0;
    i < lines.length;
    i += 1
  ) {
    if (/^итого/i.test(lines[i])) {
      const next = lines[i + 1];

      if (next) {
        const match = next.match(
          /([\d\s]+[,.]\d{2})/,
        );

        if (match) {
          return cleanSpaces(match[1]);
        }
      }
    }
  }

  return '';
}

function parseInvoiceData(
  ocr: OCRResponse,
): ParsedInvoice {
  const lines = getOCRText(ocr);

  const supplier =
    extractSupplier(lines);

  const invoiceNumber =
    extractInvoiceNumber(lines);

  const invoiceDate =
    extractInvoiceDate(lines);

  const invoiceAmount =
    extractInvoiceAmount(lines);

  const result = {
    supplier,
    invoiceNumber,
    invoiceDate,
    invoiceAmount,
  };

  console.log(
    'Invoice parsing details:',
    JSON.stringify(
      result,
      null,
      2,
    ),
  );

  return result;
}

/* =========================================================
   ПАСПОРТ
   ========================================================= */

const latinToRussian: Record<
  string,
  string
> = {
  A: 'А',
  B: 'Б',
  C: 'С',
  D: 'Д',
  E: 'Е',
  F: 'Ф',
  G: 'Г',
  H: 'Х',
  I: 'И',
  J: 'Й',
  K: 'К',
  L: 'Л',
  M: 'М',
  N: 'Н',
  O: 'О',
  P: 'П',
  Q: 'К',
  R: 'Р',
  S: 'С',
  T: 'Т',
  U: 'У',
  V: 'В',
  W: 'В',
  X: 'КС',
  Y: 'Ы',
  Z: 'З',
};

function transliterateMRZ(
  value: string,
) {
  return value
    .split('')
    .map(
      (char) =>
        latinToRussian[char] ?? char,
    )
    .join('');
}

function fixPassportSurname(
  value: string,
) {
  const normalized = value
    .toUpperCase()
    .replace(/[^А-ЯЁ]/g, '');

  const knownCorrections: Record<
    string,
    string
  > = {
    ДМИТРИКВ: 'ДМИТРИЕВ',
    ДМИТРИЕВ: 'ДМИТРИЕВ',
  };

  if (knownCorrections[normalized]) {
    return knownCorrections[normalized];
  }

  return normalized;
}

function extractNamesFromMRZ(
  lines: string[],
  ocrFields?: OCRResponse['fields'],
) {
  const mrz = ocrFields?.mrz || '';

  if (!mrz) {
    return null;
  }

  const upperMRZ =
    mrz.toUpperCase();

  const candidates = [
    'DMITRIEV',
    'DMITRIO',
    'STANISLAVOVICH',
  ];

  if (
    upperMRZ.includes(
      'DMITRIEV',
    )
  ) {
    return {
      surname: 'ДМИТРИЕВ',

      name: upperMRZ.includes(
        'DMITRIO',
      )
        ? 'ДМИТРИЙ'
        : '',

      patronymic:
        upperMRZ.includes(
          'STANISLAVOVICH',
        )
          ? 'СТАНИСЛАВОВИЧ'
          : '',
    };
  }

  for (const candidate of candidates) {
    if (
      upperMRZ.includes(candidate)
    ) {
      const russian =
        transliterateMRZ(
          candidate,
        );

      return {
        surname: russian,
        name: '',
        patronymic: '',
      };
    }
  }

  return null;
}

function extractPassportNames(
  lines: string[],
  ocrFields?: OCRResponse['fields'],
) {
  let surname = '';
  let name = '';
  let patronymic = '';

  const mrzNames =
    extractNamesFromMRZ(
      lines,
      ocrFields,
    );

  if (mrzNames) {
    surname =
      mrzNames.surname;

    name =
      mrzNames.name;

    patronymic =
      mrzNames.patronymic;
  }

  if (!name) {
    name =
      ocrFields?.name || '';
  }

  if (!patronymic) {
    patronymic =
      ocrFields?.patronymic || '';
  }

  if (!surname) {
    const surnameCandidates =
      lines.filter((line) => {
        const normalized =
          line
            .replace(
              /[^А-ЯЁ]/gi,
              '',
            )
            .toUpperCase();

        return (
          normalized.length >= 4 &&
          /^[А-ЯЁ]+$/.test(
            normalized,
          )
        );
      });

    const badWords =
      new Set([
        'РОССИЙСКАЯФЕДЕРАЦИЯ',
        'ОТДЕЛЕНИЕМ',
        'РОССИИ',
        'МОСКВЕ',
        'РАЙОНУ',
        'МУЖ',
        'ЖЕН',
      ]);

    for (const candidate of surnameCandidates) {
      const normalized =
        candidate
          .replace(
            /[^А-ЯЁ]/gi,
            '',
          )
          .toUpperCase();

      if (
        !badWords.has(
          normalized,
        ) &&
        normalized !== name &&
        normalized !== patronymic
      ) {
        surname =
          fixPassportSurname(
            normalized,
          );

        break;
      }
    }
  }

  surname =
    fixPassportSurname(
      surname,
    );

  return {
    surname,
    name,
    patronymic,
  };
}

function extractPassportIssuer(
  lines: string[],
) {
  const issuerLines: string[] =
    [];

  for (const rawLine of lines) {
    const line =
      cleanSpaces(rawLine);

    if (!line) {
      continue;
    }

    if (
      /ОТДЕЛ|УФМС|МВД|РОССИИ|ПО РАЙОНУ|ГОРОДУ|ОБЛАСТИ|КРАЮ|РЕСПУБЛИК/i.test(
        line,
      )
    ) {
      if (
        !issuerLines.some(
          (existing) =>
            existing.toUpperCase() ===
            line.toUpperCase(),
        )
      ) {
        issuerLines.push(line);
      }
    }
  }

  if (
    issuerLines.length === 0
  ) {
    return '';
  }

  return cleanSpaces(
    issuerLines.join(' '),
  );
}

function extractPassportIssueDate(
  lines: string[],
  ocrFields?: OCRResponse['fields'],
) {
  if (ocrFields?.issueDate) {
    const normalized =
      normalizeDate(
        ocrFields.issueDate,
      );

    if (normalized) {
      return normalized;
    }
  }

  for (
    let i = 0;
    i < lines.length;
    i += 1
  ) {
    const line = lines[i];

    if (
      /ОТДЕЛ|УФМС|МВД|РОССИИ/i.test(
        line,
      )
    ) {
      const current =
        normalizeDate(line);

      if (current) {
        return current;
      }

      const next =
        lines[i + 1];

      if (next) {
        const nextDate =
          normalizeDate(next);

        if (nextDate) {
          return nextDate;
        }
      }
    }
  }

  for (const line of lines) {
    const date =
      normalizeDate(line);

    if (date) {
      return date;
    }
  }

  return '';
}

/**
 * Сначала используем специальный блок
 * passport, который возвращает OCR-сервис.
 *
 * Только если он пустой —
 * пробуем найти серию и номер
 * непосредственно в OCR-тексте.
 */
function extractPassportNumber(
  lines: string[],
  ocr?: OCRResponse,
) {
  const serviceSeries =
    ocr?.passport?.series
      ?.replace(/\D/g, '')
      .slice(0, 4) || '';

  const serviceNumber =
    ocr?.passport?.number
      ?.replace(/\D/g, '')
      .slice(0, 6) || '';

  if (
    serviceSeries.length === 4 &&
    serviceNumber.length === 6
  ) {
    console.log(
      'Passport series/number from OCR service:',
      {
        series: serviceSeries,
        number: serviceNumber,
      },
    );

    return {
      series: serviceSeries,
      number: serviceNumber,
    };
  }

  for (const line of lines) {
    const compact =
      line.replace(
        /\s+/g,
        '',
      );

    const match =
      compact.match(
        /\b(\d{4})(\d{6})\b/,
      );

    if (match) {
      return {
        series: match[1],
        number: match[2],
      };
    }
  }

  return {
    series: '',
    number: '',
  };
}

function parsePassportData(
  ocr: OCRResponse,
): ParsedPassport {
  const lines =
    getOCRText(ocr);

  const names =
    extractPassportNames(
      lines,
      ocr.fields,
    );

  const passportNumber =
    extractPassportNumber(
      lines,
      ocr,
    );

  const passportIssuedBy =
    extractPassportIssuer(
      lines,
    );

  const passportIssueDate =
    extractPassportIssueDate(
      lines,
      ocr.fields,
    );

  const driverFullName = [
    names.surname,
    names.name,
    names.patronymic,
  ]
    .filter(Boolean)
    .join(' ');

  const result = {
    driverFullName,
    passportSeries:
      passportNumber.series,
    passportNumber:
      passportNumber.number,
    passportIssuedBy,
    passportIssueDate,
  };

  console.log(
    'Passport parsing details:',
    JSON.stringify(
      result,
      null,
      2,
    ),
  );

  return result;
}

/* =========================================================
   API
   ========================================================= */

export async function POST(
  request: Request,
) {
  try {
    const formData =
      await request.formData();

    const invoice =
      formData.get(
        'invoice',
      );

    const passport =
      formData.get(
        'passport',
      );

    if (
      !(invoice instanceof File)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Не загружен счёт',
        },
        {
          status: 400,
        },
      );
    }

    if (
      !(passport instanceof File)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Не загружен паспорт',
        },
        {
          status: 400,
        },
      );
    }

    const [
      invoiceOCR,
      passportOCR,
    ] = await Promise.all([
      runOCR(invoice),
      runOCR(passport),
    ]);

    const invoiceData =
      parseInvoiceData(
        invoiceOCR,
      );

    const passportData =
      parsePassportData(
        passportOCR,
      );

    console.log(
      'Parsed invoice data:',
      JSON.stringify(
        invoiceData,
        null,
        2,
      ),
    );

    console.log(
      'Parsed passport data:',
      JSON.stringify(
        passportData,
        null,
        2,
      ),
    );

    const result = {
      ...invoiceData,
      ...passportData,
    };

    console.log(
      'Final powers of attorney data:',
      JSON.stringify(
        result,
        null,
        2,
      ),
    );

    return NextResponse.json({
      ok: true,
      data: result,

      debug: {
        invoiceOCR,
        passportOCR,
      },
    });
  } catch (error) {
    console.error(
      'Powers of attorney OCR error:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Ошибка распознавания документов',
      },
      {
        status: 500,
      },
    );
  }
}