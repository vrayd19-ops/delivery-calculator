import {
  createHash,
} from 'node:crypto';

import {
  copyFile,
  mkdir,
} from 'node:fs/promises';

import {
  tmpdir,
} from 'node:os';

import {
  join,
} from 'node:path';

import {
  CanvasFactory,
} from 'pdf-parse/worker';

import {
  PDFParse,
} from 'pdf-parse';

import {
  createWorker,
  OEM,
  PSM,
} from 'tesseract.js';


export type TransportRequestInvoiceKind =
  | 'SUPPLIER'
  | 'OUR';


export type DetectedInvoiceKind =
  | TransportRequestInvoiceKind
  | 'UNKNOWN';


type OurCompanyRole =
  | 'SUPPLIER'
  | 'BUYER'
  | 'UNKNOWN';


type ParsedInvoiceData = {
  isInvoice:
    boolean;

  supplierName:
    string;

  supplierInn:
    string;

  buyerName:
    string;

  buyerInn:
    string;

  invoiceNumber:
    string;

  invoiceDate:
    string;

  invoiceAmount:
    string;
};


type ExtractedDocument = {
  text:
    string;

  recognitionMethod:
    'PDF_TEXT'
    | 'OCR';
};


export type InvoiceClassificationResult = {
  accepted:
    boolean;

  detectedKind:
    DetectedInvoiceKind;

  supplierName:
    string;

  supplierInn:
    string;

  buyerName:
    string;

  buyerInn:
    string;

  recognitionMethod:
    'PDF_TEXT'
    | 'OCR';

  message:
    string;

  invoiceNumber?:
    string;

  invoiceDate?:
    string;

  invoiceAmount?:
    string;
};


type CachedClassification = {
  expiresAt:
    number;

  result:
    InvoiceClassificationResult;
};


type ClassifierGlobalState = {
  cache:
    Map<
      string,
      CachedClassification
    >;

  inFlight:
    Map<
      string,
      Promise<InvoiceClassificationResult>
    >;

  ocrTail:
    Promise<void>;
};


const OUR_COMPANY_INN = '9204569514';

const SECOND_OUR_COMPANY_INN = '9718232572';


function containsOurCompanyInn(
  value:
    string
): boolean {
  const normalized =
    normalizeInn(
      value
    );

  return (
    normalized.includes(
      OUR_COMPANY_INN
    ) ||
    normalized.includes(
      SECOND_OUR_COMPANY_INN
    )
  );
}


function getOurCompanyInn(
  value:
    string
): string {
  const normalized =
    normalizeInn(
      value
    );

  if (
    normalized.includes(
      SECOND_OUR_COMPANY_INN
    )
  ) {
    return SECOND_OUR_COMPANY_INN;
  }

  if (
    normalized.includes(
      OUR_COMPANY_INN
    )
  ) {
    return OUR_COMPANY_INN;
  }

  return '';
}


function isOurCompanyInn(
  value:
    string
): boolean {
  return (
    value ===
      OUR_COMPANY_INN ||
    value ===
      SECOND_OUR_COMPANY_INN
  );
}


/*
 * Для определения сторон счёта обычно достаточно
 * первой страницы.
 *
 * Вторая используется только если первая страница
 * не позволила определить роль ООО «ГГС».
 */
const OCR_PDF_PAGES =
  1;


/*
 * Уменьшено с 2200 -> 1400 -> 1200.
 *
 * Это существенно уменьшает bitmap,
 * создаваемый PDF.js и Canvas.
 */
const OCR_IMAGE_WIDTH =
  1200;


/*
 * Высокий DPI нам для определения сторон счёта
 * не требуется.
 */
const OCR_DPI =
  '150';


const CLASSIFICATION_CACHE_TTL_MS =
  10 * 60 * 1000;


const CLASSIFICATION_CACHE_MAX_ENTRIES =
  30;


const CLASSIFIER_VERSION =
  'low-memory-v2-rus-text-only';


const LOCAL_TESSDATA_DIRECTORY =
  join(
    tmpdir(),
    'brt-tessdata-rus'
  );


const RUS_TRAINEDDATA_SOURCE =
  join(
    process.cwd(),
    'node_modules',
    '@tesseract.js-data',
    'rus',
    '4.0.0_best_int',
    'rus.traineddata.gz'
  );


const RUS_TRAINEDDATA_TARGET =
  join(
    LOCAL_TESSDATA_DIRECTORY,
    'rus.traineddata.gz'
  );


const TESSERACT_WORKER_PATH =
  join(
    process.cwd(),
    'node_modules',
    'tesseract.js',
    'src',
    'worker-script',
    'node',
    'index.js'
  );


let prepareTessdataPromise:
  Promise<string> |
  null =
    null;


const globalForClassifier =
  globalThis as typeof globalThis & {
    transportRequestInvoiceClassifierState?:
      ClassifierGlobalState;
  };


const classifierState:
  ClassifierGlobalState =
    globalForClassifier
      .transportRequestInvoiceClassifierState ??
    {
      cache:
        new Map<
          string,
          CachedClassification
        >(),

      inFlight:
        new Map<
          string,
          Promise<InvoiceClassificationResult>
        >(),

      ocrTail:
        Promise.resolve(),
    };


globalForClassifier
  .transportRequestInvoiceClassifierState =
  classifierState;


function normalizeDocumentText(
  value:
    string
) {
  return value
    .replace(
      /\r\n?/g,
      '\n'
    )
    .replace(
      /\u00a0/g,
      ' '
    )
    .replace(
      /[«»„“”]/g,
      '"'
    )
    .replace(
      /[ \t]+/g,
      ' '
    )
    .replace(
      /\n[ \t]+/g,
      '\n'
    )
    .replace(
      /\n{3,}/g,
      '\n\n'
    )
    .trim();
}


function normalizeInn(
  value:
    string
) {
  return value
    .replace(
      /[ОOоo]/g,
      '0'
    )
    .replace(
      /[ІIil|]/g,
      '1'
    )
    .replace(
      /[Зз]/g,
      '3'
    )
    .replace(
      /\D/g,
      ''
    );
}


function isValidInnLength(
  value:
    string
) {
  return (
    value.length ===
      10 ||
    value.length ===
      12
  );
}


function cleanPartyName(
  value:
    string
) {
  const normalized =
    value
      .replace(
        /^[\s:;,\-–—]+/,
        ''
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();


  const organizationMatch =
    normalized.match(
      /(?:ООО|АО|ПАО|ОАО|ЗАО|ИП)\s+[^,\n;]{1,150}/i
    );


  if (
    organizationMatch
  ) {
    return organizationMatch[0]
      .trim()
      .slice(
        0,
        180
      );
  }


  return normalized
    .slice(
      0,
      180
    );
}


function extractInnFromText(
  value:
    string
) {
  const matches =
    value.matchAll(
      /ИНН\s*[:№]?\s*([0-9ОOоoІIil|Зз\s\-]{10,24})/gi
    );


  for (
    const match of matches
  ) {
    const inn =
      normalizeInn(
        match[1] ??
        ''
      );


    if (
      isValidInnLength(
        inn
      )
    ) {
      return inn;
    }
  }


  return '';
}


function extractAllInns(
  value:
    string
) {
  const result =
    new Set<string>();


  const matches =
    value.matchAll(
      /ИНН\s*[:№]?\s*([0-9ОOоoІIil|Зз\s\-]{10,24})/gi
    );


  for (
    const match of matches
  ) {
    const inn =
      normalizeInn(
        match[1] ??
        ''
      );


    if (
      isValidInnLength(
        inn
      )
    ) {
      result.add(
        inn
      );
    }
  }


  return Array.from(
    result
  );
}


function findFirstRegex(
  text:
    string,

  regex:
    RegExp,

  startIndex =
    0
) {
  const source =
    text.slice(
      startIndex
    );


  const match =
    source.match(
      regex
    );


  if (
    !match ||
    match.index ===
      undefined
  ) {
    return null;
  }


  return {
    index:
      startIndex +
      match.index,

    length:
      match[0].length,
  };
}


const SUPPLIER_LABEL =
  /(?:Поставщик(?![А-Яа-яЁё])(?:\s*\(\s*Исполнитель\s*\))?|Исполнитель(?![А-Яа-яЁё]))\s*:?\s*/i;


const BUYER_LABEL =
  /(?:Покупатель(?![А-Яа-яЁё])(?:\s*\(\s*Заказчик\s*\))?|Заказчик(?![А-Яа-яЁё]))\s*:?\s*/i;


function extractRoleSection(
  text:
    string,

  role:
    'SUPPLIER'
    | 'BUYER'
) {
  const ownPattern =
    role ===
      'SUPPLIER'
      ? SUPPLIER_LABEL
      : BUYER_LABEL;


  const oppositePattern =
    role ===
      'SUPPLIER'
      ? BUYER_LABEL
      : SUPPLIER_LABEL;


  const ownMatch =
    findFirstRegex(
      text,
      ownPattern
    );


  if (
    !ownMatch
  ) {
    return '';
  }


  const contentStart =
    ownMatch.index +
    ownMatch.length;


  const oppositeMatch =
    findFirstRegex(
      text,
      oppositePattern,
      contentStart
    );


  let contentEnd =
    Math.min(
      text.length,
      contentStart +
        1200
    );


  if (
    oppositeMatch &&
    oppositeMatch.index >
      contentStart
  ) {
    contentEnd =
      Math.min(
        contentEnd,
        oppositeMatch.index
      );
  }


  const genericStop =
    text
      .slice(
        contentStart,
        contentEnd
      )
      .search(
        /\n\s*(?:Основание|Товары|Услуги|№\s*Товары|Итого|Всего к оплате)\s*:?/i
      );


  if (
    genericStop >=
    0
  ) {
    contentEnd =
      contentStart +
      genericStop;
  }


  return text
    .slice(
      contentStart,
      contentEnd
    )
    .trim();
}


function extractPartyName(
  section:
    string
) {
  if (
    !section
  ) {
    return '';
  }


  const innIndex =
    section.search(
      /ИНН\s*[:№]?/i
    );


  const beforeInn =
    innIndex >=
      0
      ? section.slice(
          0,
          innIndex
        )
      : section.slice(
          0,
          250
        );


  return cleanPartyName(
    beforeInn
  );
}


function looksLikeInvoice(
  text:
    string
) {
  return (
    /сч[её]т\s+на\s+оплат/i.test(
      text
    ) ||
    /сч[её]т[-\s]?договор/i.test(
      text
    ) ||
    /сч[её]т[-\s]?оферт/i.test(
      text
    ) ||
    (
      /поставщик/i.test(
        text
      ) &&
      /покупатель/i.test(
        text
      )
    ) ||
    (
      /поставщик/i.test(
        text
      ) &&
      /заказчик/i.test(
        text
      )
    )
  );
}


function sectionContainsOurInn(
  section:
    string
): boolean {
  return extractAllInns(
    section
  ).some(
    (inn) =>
      isOurCompanyInn(inn)
  );
}


function detectOurCompanyRoleFromSections(
  text:
    string
): OurCompanyRole {
  const supplierSection =
    extractRoleSection(
      text,
      'SUPPLIER'
    );


  const buyerSection =
    extractRoleSection(
      text,
      'BUYER'
    );


  const supplierHasOurInn =
    sectionContainsOurInn(
      supplierSection
    );


  const buyerHasOurInn =
    sectionContainsOurInn(
      buyerSection
    );


  if (
    buyerHasOurInn &&
    !supplierHasOurInn
  ) {
    return 'BUYER';
  }


  if (
    supplierHasOurInn &&
    !buyerHasOurInn
  ) {
    return 'SUPPLIER';
  }


  return 'UNKNOWN';
}


function findOurInnIndex(
  text:
    string
) {
  const patterns = [
    /9204569514/,
    /9204[\s\-]*569[\s\-]*514/,
    /9204[\s\-]*56[\s\-]*9514/,
  ];


  for (
    const pattern of patterns
  ) {
    const match =
      pattern.exec(
        text
      );


    if (
      match &&
      match.index !==
        undefined
    ) {
      return match.index;
    }
  }


  return -1;
}


function detectOurCompanyRoleFromContext(
  text:
    string
): OurCompanyRole {
  const innIndex =
    findOurInnIndex(
      text
    );


  if (
    innIndex <
    0
  ) {
    return 'UNKNOWN';
  }


  const contextStart =
    Math.max(
      0,
      innIndex -
        700
    );


  const contextEnd =
    Math.min(
      text.length,
      innIndex +
        700
    );


  const context =
    text.slice(
      contextStart,
      contextEnd
    );


  const relativeInnIndex =
    innIndex -
    contextStart;


  const beforeInn =
    context
      .slice(
        0,
        relativeInnIndex
      )
      .toLowerCase();


  const supplierWords = [
    'поставщик',
    'исполнитель',
  ];


  const buyerWords = [
    'покупатель',
    'заказчик',
  ];


  let supplierDistance =
    Number.POSITIVE_INFINITY;


  let buyerDistance =
    Number.POSITIVE_INFINITY;


  for (
    const word of supplierWords
  ) {
    const index =
      beforeInn
        .lastIndexOf(
          word
        );


    if (
      index >=
      0
    ) {
      supplierDistance =
        Math.min(
          supplierDistance,
          beforeInn.length -
            index
        );
    }
  }


  for (
    const word of buyerWords
  ) {
    const index =
      beforeInn
        .lastIndexOf(
          word
        );


    if (
      index >=
      0
    ) {
      buyerDistance =
        Math.min(
          buyerDistance,
          beforeInn.length -
            index
        );
    }
  }


  if (
    buyerDistance <
      supplierDistance &&
    buyerDistance <=
      500
  ) {
    return 'BUYER';
  }


  if (
    supplierDistance <
      buyerDistance &&
    supplierDistance <=
      500
  ) {
    return 'SUPPLIER';
  }


  return 'UNKNOWN';
}


function detectOurCompanyRole(
  rawText:
    string
): OurCompanyRole {
  const text =
    normalizeDocumentText(
      rawText
    );


  const sectionRole =
    detectOurCompanyRoleFromSections(
      text
    );


  if (
    sectionRole !==
    'UNKNOWN'
  ) {
    return sectionRole;
  }


  return detectOurCompanyRoleFromContext(
    text
  );
}



function extractInvoiceNumber(
  text:
    string
): string {
  const patterns = [
    /сч[её]т(?:\s+на\s+оплату)?\s*(?:№|N|#)?\s*([A-Za-zА-Яа-я0-9./_-]{1,40})/iu,
    /(?:№|N|#)\s*([A-Za-zА-Яа-я0-9./_-]{1,40})\s+от/iu,
  ];


  for (
    const pattern of patterns
  ) {
    const match =
      text.match(
        pattern
      );


    if (
      match?.[1]
    ) {
      return match[1]
        .trim();
    }
  }


  return '';
}


function russianMonthNumber(
  month:
    string
): string | null {
  const normalized =
    month
      .toLowerCase()
      .replace(
        /ё/g,
        'е'
      );


  const months:
    Record<
      string,
      string
    > = {
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


  return (
    months[normalized] ??
    null
  );
}


// PUNKT_INVOICE_CLASSIFIER_HOTFIX_V4
function extractInvoiceDate(
  text:
    string
): string {
  const currentYear =
    new Date().getUTCFullYear();

  function validDate(
    dayValue: string,
    monthValue: string,
    yearValue: string
  ): string {
    const day =
      Number(
        dayValue
      );

    const month =
      Number(
        monthValue
      );

    let year =
      Number(
        yearValue
      );

    if (
      yearValue.length ===
      2
    ) {
      year =
        2000 +
        year;
    }

    if (
      !Number.isInteger(day) ||
      !Number.isInteger(month) ||
      !Number.isInteger(year) ||
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12 ||
      year < 2020 ||
      year > currentYear + 1
    ) {
      return '';
    }

    const candidate =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      );

    if (
      candidate.getUTCFullYear() !==
        year ||
      candidate.getUTCMonth() !==
        month - 1 ||
      candidate.getUTCDate() !==
        day
    ) {
      return '';
    }

    return [
      String(year),
      String(month)
        .padStart(
          2,
          '0'
        ),
      String(day)
        .padStart(
          2,
          '0'
        ),
    ].join('-');
  }

  const normalized =
    normalizeDocumentText(
      text
    );

  /*
   * Сначала ищем дату именно в заголовке счёта.
   * Допускаем OCR-разрывы, "от", № и год из 2 или 4 цифр.
   */
  const titlePatterns = [
    /сч[её]т(?:\s+на\s+оплату)?[\s\S]{0,160}?(?:№|N|#)?\s*[A-Za-zА-Яа-я0-9./_-]{0,50}\s+от\s+(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|20\d{2})/iu,
    /(?:№|N|#)\s*[A-Za-zА-Яа-я0-9./_-]{1,50}\s+от\s+(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|20\d{2})/iu,
  ];

  for (
    const pattern of
      titlePatterns
  ) {
    const match =
      normalized.match(
        pattern
      );

    if (match) {
      const result =
        validDate(
          match[1] ?? '',
          match[2] ?? '',
          match[3] ?? ''
        );

      if (result) {
        return result;
      }
    }
  }

  /*
   * Словесная дата:
   * "05 ноября 2026 г."
   */
  const wordMatch =
    normalized.match(
      /сч[её]т(?:\s+на\s+оплату)?[\s\S]{0,160}?\s+от\s+(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(20\d{2})/iu
    );

  if (
    wordMatch
  ) {
    const month =
      russianMonthNumber(
        wordMatch[2] ??
        ''
      );

    if (month) {
      const result =
        validDate(
          wordMatch[1] ??
            '',
          month,
          wordMatch[3] ??
            ''
        );

      if (result) {
        return result;
      }
    }
  }

  /*
   * Осторожный fallback:
   * берём только первые 500 символов документа,
   * чтобы не схватить дату из банковских реквизитов.
   */
  const header =
    normalized.slice(
      0,
      500
    );

  const fallback =
    header.match(
      /(?:от\s+)?(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|20\d{2})/u
    );

  if (
    fallback
  ) {
    return validDate(
      fallback[1] ?? '',
      fallback[2] ?? '',
      fallback[3] ?? ''
    );
  }

  return '';
}


function normalizeMoneyValue(
  value:
    string
): string {
  const normalized =
    value
      .replace(
        /\s/g,
        ''
      )
      .replace(
        ',',
        '.'
      )
      .replace(
        /[^\d.]/g,
        ''
      );


  const number =
    Number(
      normalized
    );


  if (
    !Number.isFinite(
      number
    ) ||
    number < 0
  ) {
    return '';
  }


  return number.toFixed(
    2
  );
}


function extractInvoiceAmount(
  text:
    string
): string {
  const patterns = [
    /итого\s+к\s+оплате\s*:?\s*([\d\s]+(?:[,.]\d{1,2})?)/giu,
    /всего\s+к\s+оплате\s*:?\s*([\d\s]+(?:[,.]\d{1,2})?)/giu,
    /сумма\s+к\s+оплате\s*:?\s*([\d\s]+(?:[,.]\d{1,2})?)/giu,
    /всего\s+наименований[\s\S]{0,160}?на\s+сумму\s*:?\s*([\d\s]+(?:[,.]\d{1,2})?)/giu,
    /всего\s+с\s+ндс\s*:?\s*([\d\s]+(?:[,.]\d{1,2})?)/giu,
    /итого\s*:?\s*([\d\s]+(?:[,.]\d{1,2})?)/giu,
  ];

  for (
    const pattern of patterns
  ) {
    const amounts =
      Array.from(
        text.matchAll(
          pattern
        )
      )
        .map(
          (
            match
          ) =>
            normalizeMoneyValue(
              match[1] ?? ''
            )
        )
        .filter(
          (
            amount
          ) =>
            amount !== '' &&
            Number(amount) > 0
        );

    if (
      amounts.length > 0
    ) {
      return amounts.reduce(
        (
          largest,
          current
        ) =>
          Number(current) >
          Number(largest)
            ? current
            : largest
      );
    }
  }

  return '';
}


function parseInvoiceText(
  rawText:
    string
): ParsedInvoiceData {
  const text =
    normalizeDocumentText(
      rawText
    );


  const supplierSection =
    extractRoleSection(
      text,
      'SUPPLIER'
    );


  const buyerSection =
    extractRoleSection(
      text,
      'BUYER'
    );


  let supplierInn =
    extractInnFromText(
      supplierSection
    );


  let buyerInn =
    extractInnFromText(
      buyerSection
    );


  const allInns =
    extractAllInns(
      text
    );


  const otherInn =
    allInns.find(
      (
        inn
      ) =>
        !isOurCompanyInn(inn)
    ) ??
    '';


  const ourCompanyRole =
    detectOurCompanyRole(
      text
    );


  if (
    ourCompanyRole ===
      'BUYER'
  ) {
    buyerInn =
      getOurCompanyInn(
        text
      ) ||
      OUR_COMPANY_INN;


    if (
      otherInn
    ) {
      supplierInn =
        otherInn;
    }
  }


  if (
    ourCompanyRole ===
      'SUPPLIER'
  ) {
    supplierInn =
      getOurCompanyInn(
        text
      ) ||
      OUR_COMPANY_INN;


    if (
      otherInn
    ) {
      buyerInn =
        otherInn;
    }
  }


  return {
    isInvoice:
      looksLikeInvoice(
        text
      ),

    supplierName:
      extractPartyName(
        supplierSection
      ),

    supplierInn,

    buyerName:
      extractPartyName(
        buyerSection
      ),

    buyerInn,

    invoiceNumber:
      extractInvoiceNumber(
        text
      ),

    invoiceDate:
      extractInvoiceDate(
        text
      ),

    invoiceAmount:
      extractInvoiceAmount(
        text
      ),
  };
}


function detectInvoiceKind(
  data:
    ParsedInvoiceData,

  rawText:
    string
): DetectedInvoiceKind {
  const ourCompanyRole =
    detectOurCompanyRole(
      rawText
    );


  /*
   * Если роль ООО «ГГС» определена однозначно,
   * этого достаточно для классификации.
   *
   * OCR может плохо прочитать слово «счёт»,
   * но хорошо распознать Покупателя / Поставщика и ИНН.
   */
  if (
    ourCompanyRole ===
      'BUYER'
  ) {
    return 'SUPPLIER';
  }


  if (
    ourCompanyRole ===
      'SUPPLIER'
  ) {
    return 'OUR';
  }


  if (
    !data.isInvoice
  ) {
    return 'UNKNOWN';
  }


  return 'UNKNOWN';
}


function buildMismatchMessage(
  expectedKind:
    TransportRequestInvoiceKind,

  detectedKind:
    DetectedInvoiceKind
) {
  if (
    expectedKind ===
      'OUR' &&
    detectedKind ===
      'SUPPLIER'
  ) {
    return (
      'Это закупочный счёт на ООО «ГГС». ' +
      'Загрузите его в блок «Счета от поставщика».'
    );
  }


  if (
    expectedKind ===
      'SUPPLIER' &&
    detectedKind ===
      'OUR'
  ) {
    return (
      'Это наш счёт от ООО «ЛСТ». ' +
      'Загрузите его в блок «Наши счета».'
    );
  }


  if (
    detectedKind ===
      'UNKNOWN'
  ) {
    return (
      'Не удалось определить нужную организацию в счёте. ' +
      'Для закупки покупателем должно быть ООО «ГГС» (ИНН 9204569514), ' +
      'для нашего счёта поставщиком должно быть ООО «ЛСТ» (ИНН 9718232572).'
    );
  }


  return (
    'Документ не соответствует выбранной категории счёта.'
  );
}


async function prepareLocalTessdata() {
  await mkdir(
    LOCAL_TESSDATA_DIRECTORY,
    {
      recursive:
        true,
    }
  );


  /*
   * Копируем только русский язык.
   *
   * Раньше одновременно загружались rus + eng,
   * что значительно увеличивало использование памяти.
   */
  await copyFile(
    RUS_TRAINEDDATA_SOURCE,
    RUS_TRAINEDDATA_TARGET
  );


  return LOCAL_TESSDATA_DIRECTORY;
}


function getLocalTessdataDirectory() {
  if (
    !prepareTessdataPromise
  ) {
    prepareTessdataPromise =
      prepareLocalTessdata();
  }


  return prepareTessdataPromise;
}


async function withOcrLock<T>(
  task:
    () => Promise<T>
): Promise<T> {
  const previous =
    classifierState
      .ocrTail;


  let release:
    () => void =
      () => {};


  classifierState
    .ocrTail =
    new Promise<void>(
      (
        resolve
      ) => {
        release =
          resolve;
      }
    );


  await previous;


  try {
    return await task();
  } finally {
    release();
  }
}


let reusableInvoiceOcrWorkerPromise:
  ReturnType<typeof createWorker> |
  null =
    null;

let reusableInvoiceOcrProgressBucket =
  -1;

async function resetReusableInvoiceOcrWorker() {
  const workerPromise =
    reusableInvoiceOcrWorkerPromise;

  reusableInvoiceOcrWorkerPromise =
    null;

  reusableInvoiceOcrProgressBucket =
    -1;

  if (
    !workerPromise
  ) {
    return;
  }

  try {
    const worker =
      await workerPromise;

    await worker
      .terminate();

    console.log(
      'INVOICE OCR: reusable worker terminated after error'
    );
  } catch {
    // Worker initialization could have failed before an instance existed.
  }
}

async function getReusableInvoiceOcrWorker() {
  if (
    reusableInvoiceOcrWorkerPromise
  ) {
    console.log(
      'INVOICE OCR: reusing Russian worker'
    );

    return reusableInvoiceOcrWorkerPromise;
  }

  reusableInvoiceOcrWorkerPromise =
    (
      async () => {
        const langPath =
          await getLocalTessdataDirectory();

        console.log(
          'INVOICE OCR: starting reusable Russian worker'
        );

        const worker =
          await createWorker(
            'rus',
            OEM.LSTM_ONLY,
            {
              langPath,

              workerPath:
                TESSERACT_WORKER_PATH,

              gzip:
                true,

              cacheMethod:
                'none',

              logger: (
                message
              ) => {
                if (
                  message.status !==
                  'recognizing text'
                ) {
                  return;
                }

                const percent =
                  Math.round(
                    message.progress *
                      100
                  );

                const bucket =
                  percent >= 100
                    ? 10
                    : Math.floor(
                        percent /
                          10
                      );

                if (
                  bucket ===
                  reusableInvoiceOcrProgressBucket
                ) {
                  return;
                }

                reusableInvoiceOcrProgressBucket =
                  bucket;

                console.log(
                  'INVOICE OCR:',
                  `${Math.min(
                    bucket * 10,
                    100
                  )}%`
                );
              },
            }
          );

        await worker
          .setParameters({
            tessedit_pageseg_mode:
              PSM.SPARSE_TEXT,

            user_defined_dpi:
              OCR_DPI,
          });

        return worker;
      }
    )()
      .catch(
        (
          error
        ) => {
          reusableInvoiceOcrWorkerPromise =
            null;

          reusableInvoiceOcrProgressBucket =
            -1;

          throw error;
        }
      );

  return reusableInvoiceOcrWorkerPromise;
}

async function recognizeSingleImage(
  image:
    Buffer
) {
  return withOcrLock(
    async () => {
      const worker =
        await getReusableInvoiceOcrWorker();

      reusableInvoiceOcrProgressBucket =
        -1;

      try {
        const result =
          await worker
            .recognize(
              image,
              {
                rotateAuto:
                  false,
              },
              {
                text:
                  true,
              }
            );

        return normalizeDocumentText(
          result.data.text ??
            ''
        );
      } catch (
        error
      ) {
        console.error(
          'INVOICE OCR: reusable worker failed, resetting',
          error
        );

        await resetReusableInvoiceOcrWorker();

        throw error;
      }
    }
  );
}


function inspectDocument(
  document:
    ExtractedDocument
) {
  const parsed =
    parseInvoiceText(
      document.text
    );


  const detectedKind =
    detectInvoiceKind(
      parsed,
      document.text
    );


  return {
    parsed,
    detectedKind,
  };
}


async function extractPdfDirectText(
  buffer:
    Buffer
) {
  const parser =
    new PDFParse({
      data:
        buffer,

      CanvasFactory,
    });


  try {
    /*
     * Для определения сторон документа нам нужны
     * максимум первые две страницы.
     */
    const textResult =
      await parser
        .getText({
          first:
            OCR_PDF_PAGES,
        });


    return normalizeDocumentText(
      textResult.text ??
        ''
    );
  } finally {
    await parser
      .destroy();
  }
}


async function renderPdfPage(
  buffer:
    Buffer,

  pageNumber:
    number
) {
  const parser =
    new PDFParse({
      data:
        buffer,

      CanvasFactory,
    });


  try {
    /*
     * Рендерим строго одну страницу.
     *
     * Благодаря этому в памяти никогда не находятся
     * PNG двух страниц одновременно.
     */
    const screenshotResult =
      await parser
        .getScreenshot({
          partial: [
            pageNumber,
          ],

          desiredWidth:
            OCR_IMAGE_WIDTH,

          imageDataUrl:
            false,

          imageBuffer:
            true,
        });


    const page =
      screenshotResult
        .pages[0];


    if (
      !page ||
      !page.data
    ) {
      return null;
    }


    if (
      Buffer.isBuffer(
        page.data
      )
    ) {
      return Buffer.from(
        page.data
      );
    }


    return Buffer.from(
      page.data
    );
  } catch (
    error
  ) {
    /*
     * Если запросили страницу, которой нет,
     * просто прекращаем OCR следующих страниц.
     */
    if (
      pageNumber >
      1
    ) {
      console.warn(
        'INVOICE PDF PAGE RENDER SKIPPED:',
        pageNumber,
        error
      );


      return null;
    }


    throw error;
  } finally {
    /*
     * Критически важно:
     * PDF.js уничтожается до запуска Tesseract.
     */
    await parser
      .destroy();
  }
}


async function extractPdfText(
  buffer:
    Buffer
): Promise<ExtractedDocument> {
  /*
   * ЭТАП 1
   *
   * Сначала пробуем обычный текст PDF.
   * Для цифровых счетов OCR вообще не запускается.
   */
  const directText =
    await extractPdfDirectText(
      buffer
    );


  if (
    directText
  ) {
    const directDocument:
      ExtractedDocument =
      {
        text:
          directText,

        recognitionMethod:
          'PDF_TEXT',
      };


    const directInspection =
      inspectDocument(
        directDocument
      );


    if (
      directInspection
        .detectedKind !==
      'UNKNOWN'
    ) {
      console.log(
        'INVOICE PDF: text layer is sufficient, OCR skipped'
      );


      return directDocument;
    }
  }


  /*
   * ЭТАП 2
   *
   * Только если обычного текста недостаточно,
   * запускаем OCR.
   */
  let combinedText =
    '';


  for (
    let pageNumber =
      1;
    pageNumber <=
      OCR_PDF_PAGES;
    pageNumber +=
      1
  ) {
    console.log(
      'INVOICE OCR PDF PAGE:',
      pageNumber
    );


    const image =
      await renderPdfPage(
        buffer,
        pageNumber
      );


    if (
      !image
    ) {
      break;
    }


    /*
     * К моменту вызова recognizeSingleImage()
     * parser PDF.js уже destroy().
     */
    const pageText =
      await recognizeSingleImage(
        image
      );


    if (
      pageText
    ) {
      combinedText =
        [
          combinedText,
          pageText,
        ]
          .filter(
            Boolean
          )
          .join(
            '\n\n'
          );
    }


    const currentDocument:
      ExtractedDocument =
      {
        text:
          combinedText,

        recognitionMethod:
          'OCR',
      };


    const currentInspection =
      inspectDocument(
        currentDocument
      );


    /*
     * Если уже после первой страницы понятно,
     * где находится ООО «ГГС», вторую страницу
     * не рендерим и не распознаём.
     */
    if (
      currentInspection
        .detectedKind !==
      'UNKNOWN'
    ) {
      console.log(
        'INVOICE OCR: classification resolved on page',
        pageNumber
      );


      return currentDocument;
    }
  }


  return {
    text:
      combinedText,

    recognitionMethod:
      'OCR',
  };
}


async function extractImageText(
  buffer:
    Buffer
): Promise<ExtractedDocument> {
  const text =
    await recognizeSingleImage(
      buffer
    );


  return {
    text,

    recognitionMethod:
      'OCR',
  };
}


async function extractDocumentText(
  input: {
    buffer:
      Buffer;

    fileName:
      string;

    fileType:
      string;
  }
): Promise<ExtractedDocument> {
  const lowerName =
    input.fileName
      .toLowerCase();


  if (
    input.fileType ===
      'application/pdf' ||
    lowerName.endsWith(
      '.pdf'
    )
  ) {
    return extractPdfText(
      input.buffer
    );
  }


  return extractImageText(
    input.buffer
  );
}


function buildClassificationResult(
  input: {
    expectedKind:
      TransportRequestInvoiceKind;

    extracted:
      ExtractedDocument;

    fileName:
      string;
  }
): InvoiceClassificationResult {
  if (
    !input.extracted.text
      .trim()
  ) {
    return {
      accepted:
        false,

      detectedKind:
        'UNKNOWN',

      supplierName:
        '',

      supplierInn:
        '',

      buyerName:
        '',

      buyerInn:
        '',

      invoiceNumber:
        '',

      invoiceDate:
        '',

      invoiceAmount:
        '',

      recognitionMethod:
        input.extracted
          .recognitionMethod,

      message:
        'Не удалось прочитать текст счёта. Загрузите более чёткий PDF или изображение.',
    };
  }


  const amountDebugLines =
    input.extracted.text
      .split(/\r?\n/)
      .filter(
        (line) =>
          /(итог|всего|сумм|оплат|ндс|руб)/iu.test(line)
      );

  console.log(
    'INVOICE AMOUNT OCR LINES:',
    amountDebugLines
  );

  const parsed =
    parseInvoiceText(
      input.extracted.text
    );


  const detectedKind =
    detectInvoiceKind(
      parsed,
      input.extracted.text
    );


  const accepted =
    input.expectedKind ===
      'SUPPLIER'
      ? (
          detectedKind ===
            'SUPPLIER' &&
          isOurCompanyInn(
            parsed.buyerInn
          )
        )
      : (
          detectedKind ===
            'OUR' &&
          isOurCompanyInn(
            parsed.supplierInn
          )
        );


  const ourCompanyRole =
    detectOurCompanyRole(
      input.extracted.text
    );


  console.log(
    'TRANSPORT REQUEST INVOICE CLASSIFICATION:',
    {
      fileName:
        input.fileName,

      expectedKind:
        input.expectedKind,

      detectedKind,

      recognitionMethod:
        input.extracted
          .recognitionMethod,

      ourCompanyInns:
        [
          OUR_COMPANY_INN,
          SECOND_OUR_COMPANY_INN,
        ],

      ourCompanyRole,

      supplierName:
        parsed.supplierName,

      supplierInn:
        parsed.supplierInn,

      buyerName:
        parsed.buyerName,

      buyerInn:
        parsed.buyerInn,

      invoiceNumber:
        parsed.invoiceNumber,

      invoiceDate:
        parsed.invoiceDate,

      invoiceAmount:
        parsed.invoiceAmount,

      textLength:
        input.extracted
          .text.length,
    }
  );


  return {
    accepted,

    detectedKind,

    supplierName:
      parsed.supplierName,

    supplierInn:
      parsed.supplierInn,

    buyerName:
      parsed.buyerName,

    buyerInn:
      parsed.buyerInn,

      invoiceNumber:
        parsed.invoiceNumber,

      invoiceDate:
        parsed.invoiceDate,

      invoiceAmount:
        parsed.invoiceAmount,

    recognitionMethod:
      input.extracted
        .recognitionMethod,

    message:
      accepted
        ? 'Счёт соответствует выбранной категории.'
        : buildMismatchMessage(
            input.expectedKind,
            detectedKind
          ),
  };
}


function cleanupClassificationCache() {
  const now =
    Date.now();


  for (
    const [
      key,
      entry,
    ] of classifierState
      .cache
      .entries()
  ) {
    if (
      entry.expiresAt <=
      now
    ) {
      classifierState
        .cache
        .delete(
          key
        );
    }
  }


  while (
    classifierState
      .cache
      .size >
    CLASSIFICATION_CACHE_MAX_ENTRIES
  ) {
    const firstKey =
      classifierState
        .cache
        .keys()
        .next()
        .value as
        string |
        undefined;


    if (
      !firstKey
    ) {
      break;
    }


    classifierState
      .cache
      .delete(
        firstKey
      );
  }
}


async function classifyBuffer(
  input: {
    buffer:
      Buffer;

    fileName:
      string;

    fileType:
      string;

    expectedKind:
      TransportRequestInvoiceKind;
  }
): Promise<InvoiceClassificationResult> {
  const extracted =
    await extractDocumentText({
      buffer:
        input.buffer,

      fileName:
        input.fileName,

      fileType:
        input.fileType,
    });


  return buildClassificationResult({
    expectedKind:
      input.expectedKind,

    extracted,

    fileName:
      input.fileName,
  });
}


export async function classifyTransportRequestInvoice(
  input: {
    file:
      File;

    expectedKind:
      TransportRequestInvoiceKind;
  }
): Promise<InvoiceClassificationResult> {
  /*
   * Читаем файл один раз.
   */
  const buffer =
    Buffer.from(
      await input.file
        .arrayBuffer()
    );


  /*
   * Кэшируем классификацию одного и того же файла.
   *
   * Это важно потому, что файл может сначала пройти
   * /invoice/validate, а затем снова отправиться в
   * /invoice.
   */
  const fileHash =
    createHash(
      'sha256'
    )
      .update(
        buffer
      )
      .digest(
        'hex'
      );


  const cacheKey =
    [
      CLASSIFIER_VERSION,
      input.expectedKind,
      fileHash,
    ].join(
      ':'
    );


  cleanupClassificationCache();


  const cached =
    classifierState
      .cache
      .get(
        cacheKey
      );


  if (
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    console.log(
      'INVOICE CLASSIFICATION CACHE HIT:',
      input.file.name
    );


    return cached.result;
  }


  /*
   * Если одновременно прилетело несколько одинаковых
   * запросов, не создаём несколько OCR worker.
   */
  const existingInFlight =
    classifierState
      .inFlight
      .get(
        cacheKey
      );


  if (
    existingInFlight
  ) {
    console.log(
      'INVOICE CLASSIFICATION JOIN IN-FLIGHT:',
      input.file.name
    );


    return existingInFlight;
  }


  const classificationPromise =
    classifyBuffer({
      buffer,

      fileName:
        input.file.name,

      fileType:
        input.file.type,

      expectedKind:
        input.expectedKind,
    });


  classifierState
    .inFlight
    .set(
      cacheKey,
      classificationPromise
    );


  try {
    const result =
      await classificationPromise;


    classifierState
      .cache
      .set(
        cacheKey,
        {
          expiresAt:
            Date.now() +
            CLASSIFICATION_CACHE_TTL_MS,

          result,
        }
      );


    cleanupClassificationCache();


    return result;
  } finally {
    classifierState
      .inFlight
      .delete(
        cacheKey
      );
  }
}


// PUNKT_AUTO_SUPPLIER_ITEMS_V1
export type TransportRequestInvoicePosition = {
  name: string;
  quantity: string | null;
  unit: string | null;
  sourceRow: number | null;
};

function normalizePositionUnit(
  value: string,
): string | null {
  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\.$/, "");

  const aliases:
    Record<string, string> = {
      "шт": "шт",
      "штук": "шт",
      "кг": "кг",
      "килограмм": "кг",
      "килограммов": "кг",
      "т": "т",
      "тн": "т",
      "тонна": "т",
      "тонн": "т",
      "м": "м",
      "м.п": "м",
      "м.п.": "м",
      "пог м": "м",
      "пог. м": "м",
      "м2": "м²",
      "м²": "м²",
      "кв м": "м²",
      "кв. м": "м²",
      "м3": "м³",
      "м³": "м³",
      "куб м": "м³",
      "куб. м": "м³",
      "л": "л",
      "литр": "л",
      "литров": "л",
      "компл": "компл.",
      "комплект": "компл.",
      "комплектов": "компл.",
      "упак": "упак.",
      "упаковка": "упак.",
      "упаковок": "упак.",
      "рул": "рул.",
      "рулон": "рул.",
      "рулонов": "рул.",
      "лист": "лист",
      "листов": "лист",
      "ед": "ед.",
      "единица": "ед.",
    };

  return aliases[normalized] ?? null;
}

function cleanPositionQuantity(
  value: string,
): string | null {
  const normalized =
    value
      .trim()
      .replace(/\s+/g, "")
      .replace(",", ".");

  if (
    !/^\d+(?:\.\d{1,3})?$/.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
}

function isPositionStopLine(
  value: string,
): boolean {
  return /^(?:итого|всего\s+к\s+оплате|всего|сумма|в\s+том\s+числе\s+ндс|ндс|итого\s+с\s+ндс|всего\s+наименований)/iu
    .test(
      value.trim(),
    );
}

function isPositionHeaderLine(
  value: string,
): boolean {
  const normalized =
    value
      .trim()
      .toLowerCase();

  return (
    /^(?:№|n|п\/п)$/u.test(
      normalized,
    ) ||
    /(?:наименование|товар|услуг).*(?:кол|ед|цена|сумма)/iu.test(
      normalized,
    ) ||
    /(?:кол-?во|количество|ед\.?s*изм|цена|сумма)/iu.test(
      normalized,
    )
  );
}

function hasLetters(
  value: string,
): boolean {
  return /[A-Za-zА-Яа-яЁё]/u.test(
    value,
  );
}

function looksLikeStandaloneRowNumber(
  lines: string[],
  index: number,
  expectedRow: number | null,
): boolean {
  const match =
    lines[index]?.match(
      /^(\d{1,3})[.)]?$/,
    );

  if (!match) {
    return false;
  }

  const row =
    Number(
      match[1],
    );

  if (
    row < 1 ||
    row > 500
  ) {
    return false;
  }

  if (
    expectedRow !== null &&
    row !== expectedRow
  ) {
    return false;
  }

  for (
    let look = index + 1;
    look <
      Math.min(
        lines.length,
        index + 4,
      );
    look += 1
  ) {
    const next =
      lines[look]?.trim() ??
      "";

    if (!next) {
      continue;
    }

    if (
      isPositionStopLine(
        next,
      )
    ) {
      return false;
    }

    return (
      hasLetters(
        next,
      ) &&
      !isPositionHeaderLine(
        next,
      ) &&
      normalizePositionUnit(
        next,
      ) === null
    );
  }

  return false;
}

function parsePositionBlock(
  rowNumber: number | null,
  parts: string[],
): TransportRequestInvoicePosition | null {
  const cleaned =
    parts
      .map(
        (part) =>
          part
            .replace(/\s+/g, " ")
            .trim(),
      )
      .filter(
        (part) =>
          part &&
          !isPositionHeaderLine(
            part,
          ) &&
          !isPositionStopLine(
            part,
          ),
      );

  if (
    cleaned.length ===
    0
  ) {
    return null;
  }

  const unitExactIndex =
    cleaned.findIndex(
      (part) =>
        normalizePositionUnit(
          part,
        ) !== null,
    );

  if (
    unitExactIndex >=
    0
  ) {
    const unit =
      normalizePositionUnit(
        cleaned[
          unitExactIndex
        ],
      );

    let quantity:
      string | null =
        null;

    for (
      let index =
        unitExactIndex + 1;
      index <
        cleaned.length;
      index += 1
    ) {
      quantity =
        cleanPositionQuantity(
          cleaned[index],
        );

      if (quantity) {
        break;
      }
    }

    if (!quantity) {
      for (
        let index =
          unitExactIndex - 1;
        index >=
          0;
        index -= 1
      ) {
        quantity =
          cleanPositionQuantity(
            cleaned[index],
          );

        if (quantity) {
          break;
        }
      }
    }

    const nameParts =
      cleaned
        .slice(
          0,
          unitExactIndex,
        )
        .filter(
          (part) =>
            !cleanPositionQuantity(
              part,
            ),
        );

    const name =
      nameParts
        .join(" ")
        .replace(
          /^\d{1,3}[.)]?\s*/,
          "",
        )
        .trim();

    if (
      name.length >=
        2 &&
      hasLetters(
        name,
      )
    ) {
      return {
        name:
          name.slice(
            0,
            500,
          ),
        quantity,
        unit,
        sourceRow:
          rowNumber,
      };
    }
  }

  const combined =
    cleaned
      .join(" ")
      .replace(
        /^\d{1,3}[.)]?\s*/,
        "",
      )
      .trim();

  const unitPattern =
    "(?:шт\\.?|штук|кг|килограмм(?:ов)?|тн|т|тонн(?:а|ы)?|пог\\.?\\s*м|м\\.?п\\.?|м²|м2|кв\\.?\\s*м|м³|м3|куб\\.?\\s*м|л|литр(?:ов)?|компл\\.?|комплект(?:ов)?|упак\\.?|упаков(?:ка|ок)|рул\\.?|рулон(?:ов)?|лист(?:ов)?|ед\\.?)";

  const quantityThenUnit =
    combined.match(
      new RegExp(
        "^(.*?)(\\d+(?:[.,]\\d{1,3})?)\\s*(" +
          unitPattern +
          ")(?:\\s|$)",
        "iu",
      ),
    );

  if (
    quantityThenUnit
  ) {
    const name =
      (
        quantityThenUnit[1] ??
        ""
      )
        .trim()
        .replace(
          /[-–—,:;]+$/,
          "",
        )
        .trim();

    const quantity =
      cleanPositionQuantity(
        quantityThenUnit[2] ??
          "",
      );

    const unit =
      normalizePositionUnit(
        quantityThenUnit[3] ??
          "",
      );

    if (
      name.length >=
        2 &&
      hasLetters(
        name,
      ) &&
      quantity &&
      unit
    ) {
      return {
        name:
          name.slice(
            0,
            500,
          ),
        quantity,
        unit,
        sourceRow:
          rowNumber,
      };
    }
  }

  const unitThenQuantity =
    combined.match(
      new RegExp(
        "^(.*?)(" +
          unitPattern +
          ")\\s+(\\d+(?:[.,]\\d{1,3})?)(?:\\s|$)",
        "iu",
      ),
    );

  if (
    unitThenQuantity
  ) {
    const name =
      (
        unitThenQuantity[1] ??
        ""
      )
        .trim()
        .replace(
          /[-–—,:;]+$/,
          "",
        )
        .trim();

    const unit =
      normalizePositionUnit(
        unitThenQuantity[2] ??
          "",
      );

    const quantity =
      cleanPositionQuantity(
        unitThenQuantity[3] ??
          "",
      );

    if (
      name.length >=
        2 &&
      hasLetters(
        name,
      ) &&
      quantity &&
      unit
    ) {
      return {
        name:
          name.slice(
            0,
            500,
          ),
        quantity,
        unit,
        sourceRow:
          rowNumber,
      };
    }
  }

  return null;
}

function parseTransportRequestInvoicePositionsText(
  rawText: string,
): TransportRequestInvoicePosition[] {
  const normalized =
    normalizeDocumentText(
      rawText,
    );

  const lines =
    normalized
      .split("\n")
      .map(
        (line) =>
          line
            .replace(
              /\s+/g,
              " ",
            )
            .trim(),
      )
      .filter(Boolean);

  const result:
    TransportRequestInvoicePosition[] =
      [];

  let current:
    {
      rowNumber:
        number | null;
      parts:
        string[];
    } | null =
      null;

  let expectedRow:
    number | null =
      1;

  let rowsStarted =
    false;

  function flush() {
    if (!current) {
      return;
    }

    const parsed =
      parsePositionBlock(
        current.rowNumber,
        current.parts,
      );

    if (parsed) {
      result.push(
        parsed,
      );
    }

    current =
      null;
  }

  for (
    let index = 0;
    index <
      lines.length;
    index += 1
  ) {
    const line =
      lines[index];

    if (
      isPositionStopLine(
        line,
      )
    ) {
      if (
        rowsStarted
      ) {
        flush();
        break;
      }

      continue;
    }

    const inlineRow =
      line.match(
        /^(\d{1,3})[.)]?\s+(.+)$/,
      );

    const standaloneRow =
      looksLikeStandaloneRowNumber(
        lines,
        index,
        expectedRow,
      );

    if (
      inlineRow &&
      hasLetters(
        inlineRow[2] ??
          "",
      )
    ) {
      const rowNumber =
        Number(
          inlineRow[1],
        );

      if (
        expectedRow ===
          null ||
        rowNumber ===
          expectedRow ||
        !rowsStarted
      ) {
        flush();

        current = {
          rowNumber,
          parts: [
            inlineRow[2] ??
              "",
          ],
        };

        rowsStarted =
          true;

        expectedRow =
          rowNumber +
          1;

        continue;
      }
    }

    if (
      standaloneRow
    ) {
      const rowNumber =
        Number(
          line.replace(
            /[.)]/g,
            "",
          ),
        );

      flush();

      current = {
        rowNumber,
        parts:
          [],
      };

      rowsStarted =
        true;

      expectedRow =
        rowNumber +
        1;

      continue;
    }

    if (
      current
    ) {
      current.parts.push(
        line,
      );
    }
  }

  flush();

  if (
    result.length ===
    0
  ) {
    for (
      const line of
        lines
    ) {
      if (
        isPositionHeaderLine(
          line,
        ) ||
        isPositionStopLine(
          line,
        )
      ) {
        continue;
      }

      const parsed =
        parsePositionBlock(
          null,
          [
            line,
          ],
        );

      if (parsed) {
        result.push(
          parsed,
        );
      }
    }
  }

  const seen =
    new Set<string>();

  return result
    .filter(
      (item) => {
        const key =
          [
            item.sourceRow ??
              "",
            item.name
              .toLowerCase()
              .replace(
                /\s+/g,
                " ",
              ),
            item.quantity ??
              "",
            item.unit ??
              "",
          ].join("|");

        if (
          seen.has(
            key,
          )
        ) {
          return false;
        }

        seen.add(
          key,
        );

        return true;
      },
    )
    .slice(
      0,
      300,
    );
}

export async function extractTransportRequestInvoicePositions(
  input: {
    buffer:
      Buffer;
    fileName:
      string;
    fileType:
      string;
  },
): Promise<
  TransportRequestInvoicePosition[]
> {
  const extracted =
    await extractDocumentText({
      buffer:
        input.buffer,
      fileName:
        input.fileName,
      fileType:
        input.fileType,
    });

  const positions =
    parseTransportRequestInvoicePositionsText(
      extracted.text,
    );

  console.log(
    "SUPPLIER INVOICE POSITIONS:",
    {
      fileName:
        input.fileName,
      recognitionMethod:
        extracted.recognitionMethod,
      count:
        positions.length,
      positions:
        positions.slice(
          0,
          20,
        ),
    },
  );

  return positions;
}
