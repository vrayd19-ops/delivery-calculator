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


type OcrLayoutLine = {
  page:
    number;

  block:
    number;

  paragraph:
    number;

  line:
    number;

  text:
    string;

  left:
    number;

  top:
    number;

  right:
    number;

  bottom:
    number;
};


type ExtractedDocument = {
  text:
    string;

  recognitionMethod:
    'PDF_TEXT'
    | 'OCR';

  layoutLines:
    OcrLayoutLine[];
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


const OUR_COMPANY_INN =
  '9204569514';


/*
 * На счетах реквизиты поставщика и покупателя почти всегда
 * находятся на первой странице.
 *
 * Если первой страницы оказалось недостаточно,
 * допускаем OCR второй страницы, но строго последовательно.
 */
const OCR_PDF_PAGES =
  2;


/*
 * Раньше использовалось 2200 px.
 *
 * При лимите Northflank 256 MB такая картинка вместе с
 * PDF.js + Canvas + Tesseract могла приводить к OOMKilled.
 */
const OCR_IMAGE_WIDTH =
  1400;


const OCR_DPI =
  '200';


const CLASSIFICATION_CACHE_TTL_MS =
  10 * 60 * 1000;


const CLASSIFICATION_CACHE_MAX_ENTRIES =
  30;


const CLASSIFIER_VERSION =
  'low-memory-v1';


const LOCAL_TESSDATA_DIRECTORY =
  join(
    tmpdir(),
    'brt-tessdata'
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


const ENG_TRAINEDDATA_SOURCE =
  join(
    process.cwd(),
    'node_modules',
    '@tesseract.js-data',
    'eng',
    '4.0.0_best_int',
    'eng.traineddata.gz'
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


const RUS_TRAINEDDATA_TARGET =
  join(
    LOCAL_TESSDATA_DIRECTORY,
    'rus.traineddata.gz'
  );


const ENG_TRAINEDDATA_TARGET =
  join(
    LOCAL_TESSDATA_DIRECTORY,
    'eng.traineddata.gz'
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

    text:
      match[0],
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
        1000
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
    )
  );
}


function classifyRoleText(
  value:
    string
): OurCompanyRole {
  if (
    /Покупатель|Заказчик/i.test(
      value
    )
  ) {
    return 'BUYER';
  }


  if (
    /Поставщик|Исполнитель/i.test(
      value
    )
  ) {
    return 'SUPPLIER';
  }


  return 'UNKNOWN';
}


function parseTsvLines(
  tsv:
    string,

  pageOffset:
    number
): OcrLayoutLine[] {
  if (
    !tsv.trim()
  ) {
    return [];
  }


  type MutableLine = {
    page:
      number;

    block:
      number;

    paragraph:
      number;

    line:
      number;

    words:
      string[];

    left:
      number;

    top:
      number;

    right:
      number;

    bottom:
      number;
  };


  const groups =
    new Map<
      string,
      MutableLine
    >();


  const rows =
    tsv
      .split(
        /\r?\n/
      )
      .slice(
        1
      );


  for (
    const row of rows
  ) {
    if (
      !row.trim()
    ) {
      continue;
    }


    const columns =
      row.split(
        '\t'
      );


    if (
      columns.length <
      12
    ) {
      continue;
    }


    const level =
      Number(
        columns[0]
      );


    if (
      level !==
      5
    ) {
      continue;
    }


    const page =
      Number(
        columns[1]
      ) +
      pageOffset;


    const block =
      Number(
        columns[2]
      );


    const paragraph =
      Number(
        columns[3]
      );


    const line =
      Number(
        columns[4]
      );


    const left =
      Number(
        columns[6]
      );


    const top =
      Number(
        columns[7]
      );


    const width =
      Number(
        columns[8]
      );


    const height =
      Number(
        columns[9]
      );


    const word =
      columns
        .slice(
          11
        )
        .join(
          '\t'
        )
        .trim();


    if (
      !word
    ) {
      continue;
    }


    if (
      !Number.isFinite(
        left
      ) ||
      !Number.isFinite(
        top
      ) ||
      !Number.isFinite(
        width
      ) ||
      !Number.isFinite(
        height
      )
    ) {
      continue;
    }


    const key =
      [
        page,
        block,
        paragraph,
        line,
      ].join(
        ':'
      );


    const right =
      left +
      width;


    const bottom =
      top +
      height;


    const existing =
      groups.get(
        key
      );


    if (
      existing
    ) {
      existing.words.push(
        word
      );

      existing.left =
        Math.min(
          existing.left,
          left
        );

      existing.top =
        Math.min(
          existing.top,
          top
        );

      existing.right =
        Math.max(
          existing.right,
          right
        );

      existing.bottom =
        Math.max(
          existing.bottom,
          bottom
        );

      continue;
    }


    groups.set(
      key,
      {
        page,
        block,
        paragraph,
        line,
        words:
          [
            word,
          ],
        left,
        top,
        right,
        bottom,
      }
    );
  }


  return Array.from(
    groups.values()
  )
    .map(
      (
        item
      ) => ({
        page:
          item.page,

        block:
          item.block,

        paragraph:
          item.paragraph,

        line:
          item.line,

        text:
          item.words
            .join(
              ' '
            ),

        left:
          item.left,

        top:
          item.top,

        right:
          item.right,

        bottom:
          item.bottom,
      })
    )
    .sort(
      (
        a,
        b
      ) => {
        if (
          a.page !==
          b.page
        ) {
          return (
            a.page -
            b.page
          );
        }


        if (
          a.top !==
          b.top
        ) {
          return (
            a.top -
            b.top
          );
        }


        return (
          a.left -
          b.left
        );
      }
    );
}


function lineContainsOurInn(
  line:
    OcrLayoutLine
) {
  return normalizeInn(
    line.text
  ).includes(
    OUR_COMPANY_INN
  );
}


function lineCenterY(
  line:
    OcrLayoutLine
) {
  return (
    line.top +
    line.bottom
  ) / 2;
}


function lineHeight(
  line:
    OcrLayoutLine
) {
  return Math.max(
    1,
    line.bottom -
      line.top
  );
}


function detectOurCompanyRoleFromLayout(
  lines:
    OcrLayoutLine[]
): OurCompanyRole {
  if (
    lines.length ===
    0
  ) {
    return 'UNKNOWN';
  }


  const ourInnLines =
    lines.filter(
      lineContainsOurInn
    );


  if (
    ourInnLines.length ===
    0
  ) {
    return 'UNKNOWN';
  }


  const roleLines =
    lines
      .map(
        (
          line
        ) => ({
          line,

          role:
            classifyRoleText(
              line.text
            ),
        })
      )
      .filter(
        (
          item
        ) =>
          item.role !==
          'UNKNOWN'
      );


  for (
    const ourLine of
      ourInnLines
  ) {
    const sameLineRole =
      classifyRoleText(
        ourLine.text
      );


    if (
      sameLineRole !==
      'UNKNOWN'
    ) {
      return sameLineRole;
    }


    const candidates =
      roleLines
        .filter(
          (
            item
          ) =>
            item.line.page ===
            ourLine.page
        )
        .map(
          (
            item
          ) => {
            const verticalDistance =
              Math.abs(
                lineCenterY(
                  item.line
                ) -
                lineCenterY(
                  ourLine
                )
              );


            const horizontalPenalty =
              item.line.left <=
                ourLine.left
                ? 0
                : 40;


            return {
              ...item,

              verticalDistance,

              score:
                verticalDistance +
                horizontalPenalty,
            };
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            a.score -
            b.score
        );


    const best =
      candidates[0];


    if (
      !best
    ) {
      continue;
    }


    const allowedVerticalDistance =
      Math.max(
        120,
        lineHeight(
          ourLine
        ) *
          4
      );


    if (
      best.verticalDistance <=
      allowedVerticalDistance
    ) {
      return best.role;
    }
  }


  return 'UNKNOWN';
}


function detectOurCompanyRoleFromText(
  rawText:
    string
): OurCompanyRole {
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


  const supplierHasOurInn =
    normalizeInn(
      supplierSection
    ).includes(
      OUR_COMPANY_INN
    );


  const buyerHasOurInn =
    normalizeInn(
      buyerSection
    ).includes(
      OUR_COMPANY_INN
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


function detectOurCompanyRole(
  rawText:
    string,

  layoutLines:
    OcrLayoutLine[]
): OurCompanyRole {
  if (
    layoutLines.length >
    0
  ) {
    const layoutRole =
      detectOurCompanyRoleFromLayout(
        layoutLines
      );


    if (
      layoutRole !==
      'UNKNOWN'
    ) {
      return layoutRole;
    }
  }


  return detectOurCompanyRoleFromText(
    rawText
  );
}


function parseInvoiceText(
  rawText:
    string,

  layoutLines:
    OcrLayoutLine[]
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
      text,
      layoutLines
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
    string,

  layoutLines:
    OcrLayoutLine[]
): DetectedInvoiceKind {
  if (
    !data.isInvoice
  ) {
    return 'UNKNOWN';
  }


  const ourCompanyRole =
    detectOurCompanyRole(
      rawText,
      layoutLines
    );


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


  await Promise.all([
    copyFile(
      RUS_TRAINEDDATA_SOURCE,
      RUS_TRAINEDDATA_TARGET
    ),

    copyFile(
      ENG_TRAINEDDATA_SOURCE,
      ENG_TRAINEDDATA_TARGET
    ),
  ]);


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
    Buffer,

  pageOffset =
    0
) {
  return withOcrLock(
    async () => {
      const langPath =
        await getLocalTessdataDirectory();


      const worker =
        await createWorker(
          [
            'rus',
            'eng',
          ],
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
            tessedit_pageseg_mode:
              PSM.AUTO,

            preserve_interword_spaces:
              '1',

            user_defined_dpi:
              OCR_DPI,
          });


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

                tsv:
                  true,
              }
            );


        const tsv =
          result.data.tsv ??
          '';


        return {
          text:
            result.data.text
              .trim(),

          layoutLines:
            parseTsvLines(
              tsv,
              pageOffset
            ),
        };
      } finally {
        await worker
          .terminate();
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
      document.text,
      document.layoutLines
    );


  const detectedKind =
    detectInvoiceKind(
      parsed,
      document.text,
      document.layoutLines
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
     * Для определения поставщика/покупателя нет необходимости
     * читать весь многостраничный PDF.
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
     * Важный момент для памяти:
     *
     * рендерим только ОДНУ страницу.
     * Не создаём массив изображений двух страниц по 2200 px.
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


    /*
     * Получаем PNG до destroy().
     *
     * После выхода из этой функции PDF.js и canvas будут
     * полностью уничтожены ДО запуска Tesseract.
     */
    if (
      Buffer.isBuffer(
        page.data
      )
    ) {
      return page.data;
    }


    return Buffer.from(
      page.data
    );
  } finally {
    await parser
      .destroy();
  }
}


async function extractPdfText(
  buffer:
    Buffer
): Promise<ExtractedDocument> {
  /*
   * 1. Сначала дешёвый текстовый слой.
   *
   * PDF.js после этой функции уже уничтожен.
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

        layoutLines:
          [],
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
   * 2. Если текстового слоя недостаточно — OCR.
   *
   * Каждая страница проходит:
   *
   * PDF -> PNG -> destroy PDF.js -> OCR -> terminate Tesseract.
   *
   * PDF.js и Tesseract не должны одновременно удерживать
   * тяжёлые структуры в памяти.
   */
  let combinedText =
    '';

  const combinedLayoutLines:
    OcrLayoutLine[] =
    [];


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


    const ocr =
      await recognizeSingleImage(
        image,
        (
          pageNumber -
          1
        ) *
          1000
      );


    if (
      ocr.text
    ) {
      combinedText =
        [
          combinedText,
          ocr.text,
        ]
          .filter(
            Boolean
          )
          .join(
            '\n\n'
          );
    }


    combinedLayoutLines.push(
      ...ocr.layoutLines
    );


    const currentDocument:
      ExtractedDocument =
      {
        text:
          combinedText,

        recognitionMethod:
          'OCR',

        layoutLines:
          combinedLayoutLines,
      };


    const currentInspection =
      inspectDocument(
        currentDocument
      );


    /*
     * Как только роль ГГС определена, вторую страницу
     * вообще не рендерим.
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

    layoutLines:
      combinedLayoutLines,
  };
}


async function extractImageText(
  buffer:
    Buffer
): Promise<ExtractedDocument> {
  const ocr =
    await recognizeSingleImage(
      buffer
    );


  return {
    text:
      ocr.text,

    recognitionMethod:
      'OCR',

    layoutLines:
      ocr.layoutLines,
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
      input.extracted.text,
      input.extracted.layoutLines
    );


  const detectedKind =
    detectInvoiceKind(
      parsed,
      input.extracted.text,
      input.extracted.layoutLines
    );


  const accepted =
    detectedKind ===
    input.expectedKind;


  const ourCompanyRole =
    detectOurCompanyRole(
      input.extracted.text,
      input.extracted.layoutLines
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

      /*
       * Не выводим в лог сотни OCR-строк.
       * Оставляем максимум 20 диагностических строк.
       */
      layoutLinesNearOurInn:
        input.extracted
          .layoutLines
          .filter(
            (
              line
            ) =>
              lineContainsOurInn(
                line
              ) ||
              classifyRoleText(
                line.text
              ) !==
                'UNKNOWN'
          )
          .slice(
            0,
            20
          )
          .map(
            (
              line
            ) => ({
              page:
                line.page,

              text:
                line.text,

              left:
                line.left,

              top:
                line.top,

              right:
                line.right,

              bottom:
                line.bottom,
            })
          ),
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
   * Читаем файл только один раз.
   */
  const buffer =
    Buffer.from(
      await input.file
        .arrayBuffer()
    );


  /*
   * validate и последующий /invoice получают один и тот же
   * файл повторно.
   *
   * Поэтому используем SHA-256 и не запускаем OCR второй раз
   * в течение короткого промежутка.
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
   * Если браузер случайно отправил два одинаковых запроса
   * одновременно, второй не создаёт второй Tesseract worker.
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