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


const OUR_COMPANY_INN =
  '9204569514';


/*
 * Для определения сторон счёта обычно достаточно
 * первой страницы.
 *
 * Вторая используется только если первая страница
 * не позволила определить роль ООО «ГГС».
 */
const OCR_PDF_PAGES =
  2;


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
) {
  return extractAllInns(
    section
  ).includes(
    OUR_COMPANY_INN
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
        inn !==
        OUR_COMPANY_INN
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
      'Это счёт от поставщика. ' +
      'ООО «ГГС» с ИНН 9204569514 указано как покупатель. ' +
      'Переместите файл в блок «Счета от поставщика».'
    );
  }


  if (
    expectedKind ===
      'SUPPLIER' &&
    detectedKind ===
      'OUR'
  ) {
    return (
      'Это наш счёт. ' +
      'ООО «ГГС» с ИНН 9204569514 указано как поставщик. ' +
      'Переместите файл в блок «Наши счета».'
    );
  }


  if (
    detectedKind ===
      'UNKNOWN'
  ) {
    return (
      'Не удалось определить роль ООО «ГГС» с ИНН 9204569514 в этом счёте. ' +
      'Проверьте качество файла и убедитесь, что загружен именно счёт.'
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


async function recognizeSingleImage(
  image:
    Buffer
) {
  return withOcrLock(
    async () => {
      const langPath =
        await getLocalTessdataDirectory();


      console.log(
        'INVOICE OCR: starting low-memory Russian worker'
      );


      /*
       * Только rus.
       *
       * Английская модель больше не загружается.
       */
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
                message.status ===
                'recognizing text'
              ) {
                console.log(
                  'INVOICE OCR:',
                  `${Math.round(
                    message.progress *
                      100
                  )}%`
                );
              }
            },
          }
        );


      try {
        await worker
          .setParameters({
            /*
             * SPARSE_TEXT обычно легче для документов,
             * где нам нужно найти отдельные строки и реквизиты,
             * а не идеально восстановить всю верстку.
             */
            tessedit_pageseg_mode:
              PSM.SPARSE_TEXT,

            user_defined_dpi:
              OCR_DPI,
          });


        /*
         * Запрашиваем только text.
         *
         * TSV раньше создавал дополнительные данные
         * с координатами каждого слова и увеличивал
         * расход памяти.
         */
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
      } finally {
        await worker
          .terminate();


        console.log(
          'INVOICE OCR: worker terminated'
        );
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

      recognitionMethod:
        input.extracted
          .recognitionMethod,

      message:
        'Не удалось прочитать текст счёта. Загрузите более чёткий PDF или изображение.',
    };
  }


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
    detectedKind ===
    input.expectedKind;


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

      ourCompanyInn:
        OUR_COMPANY_INN,

      ourCompanyRole,

      supplierName:
        parsed.supplierName,

      supplierInn:
        parsed.supplierInn,

      buyerName:
        parsed.buyerName,

      buyerInn:
        parsed.buyerInn,

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