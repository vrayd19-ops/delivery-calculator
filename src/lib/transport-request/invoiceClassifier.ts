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


const OCR_PDF_PAGES =
  2;


const OCR_IMAGE_WIDTH =
  2200;


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


async function recognizeImages(
  images:
    Buffer[]
) {
  if (
    images.length ===
    0
  ) {
    return {
      text:
        '',

      layoutLines:
        [] as OcrLayoutLine[],
    };
  }


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
          '300',
      });


    const texts:
      string[] =
        [];


    const layoutLines:
      OcrLayoutLine[] =
        [];


    for (
      let imageIndex =
        0;
      imageIndex <
        images.length;
      imageIndex +=
        1
    ) {
      const result =
        await worker
          .recognize(
            images[
              imageIndex
            ],
            {
              rotateAuto:
                true,
            },
            {
              text:
                true,

              tsv:
                true,
            }
          );


      if (
        result.data.text
          .trim()
      ) {
        texts.push(
          result.data.text
        );
      }


      const tsv =
        result.data.tsv ??
        '';


      layoutLines.push(
        ...parseTsvLines(
          tsv,
          imageIndex *
            1000
        )
      );
    }


    return {
      text:
        texts
          .join(
            '\n\n'
          )
          .trim(),

      layoutLines,
    };
  } finally {
    await worker
      .terminate();
  }
}


async function extractPdfText(
  file:
    File
): Promise<ExtractedDocument> {
  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );


  const parser =
    new PDFParse({
      data:
        buffer,

      CanvasFactory,
    });


  try {
    const textResult =
      await parser
        .getText();


    const directText =
      normalizeDocumentText(
        textResult.text ??
        ''
      );


    const directParsed =
      parseInvoiceText(
        directText,
        []
      );


    const directKind =
      detectInvoiceKind(
        directParsed,
        directText,
        []
      );


    if (
      directKind !==
      'UNKNOWN'
    ) {
      return {
        text:
          directText,

        recognitionMethod:
          'PDF_TEXT',

        layoutLines:
          [],
      };
    }


    const screenshotResult =
      await parser
        .getScreenshot({
          first:
            OCR_PDF_PAGES,

          desiredWidth:
            OCR_IMAGE_WIDTH,

          imageDataUrl:
            false,

          imageBuffer:
            true,
        });


    const images =
      screenshotResult.pages
        .map(
          (
            page
          ) =>
            Buffer.from(
              page.data
            )
        )
        .filter(
          (
            image
          ) =>
            image.length >
            0
        );


    const ocr =
      await recognizeImages(
        images
      );


    return {
      text:
        ocr.text,

      recognitionMethod:
        'OCR',

      layoutLines:
        ocr.layoutLines,
    };
  } finally {
    await parser
      .destroy();
  }
}


async function extractImageText(
  file:
    File
): Promise<ExtractedDocument> {
  const image =
    Buffer.from(
      await file.arrayBuffer()
    );


  const ocr =
    await recognizeImages([
      image,
    ]);


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
  file:
    File
): Promise<ExtractedDocument> {
  const lowerName =
    file.name
      .toLowerCase();


  if (
    file.type ===
      'application/pdf' ||
    lowerName.endsWith(
      '.pdf'
    )
  ) {
    return extractPdfText(
      file
    );
  }


  return extractImageText(
    file
  );
}


export async function classifyTransportRequestInvoice(
  input: {
    file:
      File;

    expectedKind:
      TransportRequestInvoiceKind;
  }
): Promise<InvoiceClassificationResult> {
  const extracted =
    await extractDocumentText(
      input.file
    );


  if (
    !extracted.text
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
        extracted
          .recognitionMethod,

      message:
        'Не удалось прочитать текст счёта. Загрузите более чёткий PDF или изображение.',
    };
  }


  const parsed =
    parseInvoiceText(
      extracted.text,
      extracted.layoutLines
    );


  const detectedKind =
    detectInvoiceKind(
      parsed,
      extracted.text,
      extracted.layoutLines
    );


  const accepted =
    detectedKind ===
    input.expectedKind;


  console.log(
    'TRANSPORT REQUEST INVOICE CLASSIFICATION:',
    {
      fileName:
        input.file.name,

      expectedKind:
        input.expectedKind,

      detectedKind,

      recognitionMethod:
        extracted
          .recognitionMethod,

      ourCompanyInn:
        OUR_COMPANY_INN,

      ourCompanyRole:
        detectOurCompanyRole(
          extracted.text,
          extracted.layoutLines
        ),

      supplierName:
        parsed.supplierName,

      supplierInn:
        parsed.supplierInn,

      buyerName:
        parsed.buyerName,

      buyerInn:
        parsed.buyerInn,

      layoutLinesNearOurInn:
        extracted.layoutLines
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
      extracted
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