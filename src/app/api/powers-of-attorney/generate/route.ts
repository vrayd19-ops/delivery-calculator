import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RequestData = {
  supplier?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceAmount?: string;
  driverFullName?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssueDate?: string;
  needCoverLetter?: boolean;
};

function value(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function today() {
  const date = new Date();

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

async function loadFont() {
  const fontPath = path.join(
    process.cwd(),
    'public',
    'fonts',
    'arial.ttf',
  );

  return fs.readFile(fontPath);
}

function drawText(
  page: any,
  font: any,
  text: string,
  x: number,
  y: number,
  size = 10,
) {
  if (!text) {
    return;
  }

  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawLine(
  page: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  page.drawLine({
    start: {
      x: x1,
      y: y1,
    },
    end: {
      x: x2,
      y: y2,
    },
    thickness: 0.7,
    color: rgb(0, 0, 0),
  });
}

function drawRect(
  page: any,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: 0.7,
    borderColor: rgb(0, 0, 0),
  });
}

function drawPowerOfAttorney(
  pdf: PDFDocument,
  font: any,
  data: RequestData,
) {
  const page = pdf.addPage([842, 595]);

  const supplier = value(data.supplier);
  const invoiceNumber = value(data.invoiceNumber);
  const invoiceDate = value(data.invoiceDate);
  const invoiceAmount = value(data.invoiceAmount);
  const driverFullName = value(data.driverFullName);
  const passportSeries = value(data.passportSeries);
  const passportNumber = value(data.passportNumber);
  const passportIssuedBy = value(data.passportIssuedBy);
  const passportIssueDate = value(data.passportIssueDate);

  const margin = 35;

  drawText(
    page,
    font,
    'Типовая межотраслевая форма № М-2',
    margin,
    565,
    8,
  );

  drawText(
    page,
    font,
    'Утверждена постановлением Госкомстата России',
    margin,
    554,
    7,
  );

  drawText(
    page,
    font,
    'от 30.10.1997 № 71а',
    margin,
    544,
    7,
  );

  drawText(
    page,
    font,
    'Код по ОКУД 0315001',
    650,
    565,
    8,
  );

  drawText(
    page,
    font,
    'ДОВЕРЕННОСТЬ',
    330,
    535,
    14,
  );

  drawText(
    page,
    font,
    `№ ${invoiceNumber || '________'}`,
    60,
    505,
    10,
  );

  drawText(
    page,
    font,
    `Дата выдачи: ${today()}`,
    500,
    505,
    10,
  );

  drawText(
    page,
    font,
    'Организация: ООО «ГЛАВГЕНСТРОЙ»',
    margin,
    475,
    10,
  );

  drawText(
    page,
    font,
    `Поставщик: ${supplier}`,
    margin,
    455,
    10,
  );

  drawText(
    page,
    font,
    `Счет: № ${invoiceNumber || '—'} от ${
      invoiceDate || '—'
    }`,
    margin,
    435,
    10,
  );

  drawText(
    page,
    font,
    `Сумма счета: ${invoiceAmount || '—'}`,
    margin,
    415,
    10,
  );

  drawText(
    page,
    font,
    'Доверенность выдана:',
    margin,
    380,
    10,
  );

  drawText(
    page,
    font,
    `Фамилия, имя, отчество: ${driverFullName}`,
    margin,
    360,
    10,
  );

  drawText(
    page,
    font,
    `Паспорт: серия ${passportSeries}, № ${passportNumber}`,
    margin,
    340,
    10,
  );

  drawText(
    page,
    font,
    `Выдан: ${passportIssuedBy || '—'}`,
    margin,
    320,
    10,
  );

  drawText(
    page,
    font,
    `Дата выдачи паспорта: ${passportIssueDate || '—'}`,
    margin,
    300,
    10,
  );

  drawText(
    page,
    font,
    'Получение материальных ценностей по счету поставщика.',
    margin,
    260,
    10,
  );

  drawText(
    page,
    font,
    `Поставщик: ${supplier}`,
    margin,
    240,
    10,
  );

  drawText(
    page,
    font,
    `Счет № ${invoiceNumber || '—'} от ${
      invoiceDate || '—'
    }`,
    margin,
    220,
    10,
  );

  drawText(
    page,
    font,
    'Подпись лица, получившего доверенность:',
    margin,
    175,
    10,
  );

  drawLine(
    page,
    300,
    172,
    520,
    172,
  );

  drawText(
    page,
    font,
    'Руководитель организации',
    margin,
    120,
    10,
  );

  drawLine(
    page,
    200,
    117,
    390,
    117,
  );

  drawText(
    page,
    font,
    'Главный бухгалтер',
    430,
    120,
    10,
  );

  drawLine(
    page,
    550,
    117,
    730,
    117,
  );

  drawRect(
    page,
    35,
    35,
    772,
    55,
  );

  drawText(
    page,
    font,
    'Отметка о получении материальных ценностей',
    50,
    70,
    8,
  );

  drawText(
    page,
    font,
    `Поставщик: ${supplier}`,
    50,
    52,
    8,
  );

  return page;
}

function drawCoverLetter(
  pdf: PDFDocument,
  font: any,
  data: RequestData,
) {
  const page = pdf.addPage([595, 842]);

  const supplier = value(data.supplier);
  const invoiceNumber = value(data.invoiceNumber);
  const invoiceDate = value(data.invoiceDate);
  const invoiceAmount = value(data.invoiceAmount);
  const driverFullName = value(data.driverFullName);
  const passportSeries = value(data.passportSeries);
  const passportNumber = value(data.passportNumber);

  drawText(
    page,
    font,
    'ООО «ГЛАВГЕНСТРОЙ»',
    60,
    770,
    14,
  );

  drawText(
    page,
    font,
    `Исх. № ${invoiceNumber || '____'} от ${today()}`,
    60,
    745,
    10,
  );

  drawText(
    page,
    font,
    'В ООО «Металлсервис-Москва»',
    60,
    695,
    11,
  );

  drawText(
    page,
    font,
    'СОПРОВОДИТЕЛЬНОЕ ПИСЬМО',
    170,
    650,
    13,
  );

  const lines = [
    `Уважаемые коллеги!`,
    '',
    `ООО «ГЛАВГЕНСТРОЙ» направляет водителя ${driverFullName}`,
    `для получения товара по счету № ${invoiceNumber || '—'} от ${
      invoiceDate || '—'
    }.`,
    '',
    `Сумма счета: ${invoiceAmount || '—'}.`,
    '',
    `Паспорт водителя: серия ${passportSeries || '—'},`,
    `№ ${passportNumber || '—'}.`,
    '',
    'Просим выдать товар указанному представителю.',
  ];

  let y = 610;

  for (const line of lines) {
    drawText(
      page,
      font,
      line,
      60,
      y,
      10,
    );

    y -= 22;
  }

  drawText(
    page,
    font,
    'Генеральный директор ООО «ГЛАВГЕНСТРОЙ»',
    60,
    270,
    10,
  );

  drawLine(
    page,
    60,
    250,
    280,
    250,
  );

  drawText(
    page,
    font,
    'М.П.',
    60,
    215,
    10,
  );

  drawText(
    page,
    font,
    `Поставщик: ${supplier}`,
    60,
    160,
    9,
  );

  return page;
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as RequestData;

    if (!value(body.supplier)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Не указан поставщик.',
        },
        { status: 400 },
      );
    }

    if (!value(body.driverFullName)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Не указано ФИО водителя.',
        },
        { status: 400 },
      );
    }

    if (
      !value(body.passportSeries) ||
      !value(body.passportNumber)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Не указаны серия и номер паспорта.',
        },
        { status: 400 },
      );
    }

    const pdf = await PDFDocument.create();

    pdf.registerFontkit(fontkit);

    const fontBytes = await loadFont();

    const font = await pdf.embedFont(
      fontBytes,
      {
        subset: true,
      },
    );

    drawPowerOfAttorney(
      pdf,
      font,
      body,
    );

    const supplier = value(body.supplier)
      .toLowerCase()
      .replaceAll('ё', 'е');

    const needCoverLetter =
      Boolean(body.needCoverLetter) ||
      supplier.includes(
        'металлсервис-москва',
      ) ||
      supplier.includes(
        'металлсервис москва',
      );

    if (needCoverLetter) {
      drawCoverLetter(
        pdf,
        font,
        body,
      );
    }

    const bytes = await pdf.save();

    const fileName =
      needCoverLetter
        ? `Доверенность_и_письмо_${sanitizeFileName(
            value(body.driverFullName),
          )}.pdf`
        : `Доверенность_${sanitizeFileName(
            value(body.driverFullName),
          )}.pdf`;

    return new NextResponse(
      Buffer.from(bytes),
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(
            fileName,
          )}"`,
          'Content-Length': String(
            bytes.length,
          ),
        },
      },
    );
  } catch (error) {
    console.error(
      'Powers of attorney generation error:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось сформировать документы.',
      },
      { status: 500 },
    );
  }
}