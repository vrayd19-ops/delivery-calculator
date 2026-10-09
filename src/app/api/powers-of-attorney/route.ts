import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

type ParsedDocumentData = {
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: string;
  driverFullName: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssueDate: string;
};

function emptyResult(): ParsedDocumentData {
  return {
    supplier: '',
    invoiceNumber: '',
    invoiceDate: '',
    invoiceAmount: '',
    driverFullName: '',
    passportSeries: '',
    passportNumber: '',
    passportIssuedBy: '',
    passportIssueDate: '',
  };
}

function cleanJsonText(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function normalizeResult(value: unknown): ParsedDocumentData {
  const source =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};

  const asString = (key: keyof ParsedDocumentData) => {
    const raw = source[key];
    return typeof raw === 'string' ? raw.trim() : '';
  };

  return {
    supplier: asString('supplier'),
    invoiceNumber: asString('invoiceNumber'),
    invoiceDate: asString('invoiceDate'),
    invoiceAmount: asString('invoiceAmount'),
    driverFullName: asString('driverFullName'),
    passportSeries: asString('passportSeries'),
    passportNumber: asString('passportNumber'),
    passportIssuedBy: asString('passportIssuedBy'),
    passportIssueDate: asString('passportIssueDate'),
  };
}

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString('base64');
}

function validateFile(file: File | null, label: string) {
  if (!file) {
    return `${label}: файл не выбран.`;
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return `${label}: можно загрузить только PDF, JPG или PNG.`;
  }

  if (file.size > MAX_FILE_SIZE) {
    return `${label}: размер файла не должен превышать 10 МБ.`;
  }

  return null;
}

async function toOpenAIContent(file: File) {
  const base64 = await fileToBase64(file);

  if (file.type === 'application/pdf') {
    return {
      type: 'input_file' as const,
      filename: file.name || 'document.pdf',
      file_data: `data:application/pdf;base64,${base64}`,
    };
  }

  return {
    type: 'input_image' as const,
    image_url: `data:${file.type};base64,${base64}`,
    detail: 'high' as const,
  };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Необходима авторизация.',
        },
        {
          status: 401,
        }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: 'На сервере не настроен OPENAI_API_KEY.',
        },
        {
          status: 500,
        }
      );
    }

    const formData = await request.formData();

    const invoiceValue = formData.get('invoice');
    const passportValue = formData.get('passport');

    const invoiceFile =
      invoiceValue instanceof File
        ? invoiceValue
        : null;

    const passportFile =
      passportValue instanceof File
        ? passportValue
        : null;

    const invoiceError = validateFile(
      invoiceFile,
      'Счёт'
    );

    if (invoiceError) {
      return NextResponse.json(
        {
          ok: false,
          error: invoiceError,
        },
        {
          status: 400,
        }
      );
    }

    const passportError = validateFile(
      passportFile,
      'Паспорт'
    );

    if (passportError) {
      return NextResponse.json(
        {
          ok: false,
          error: passportError,
        },
        {
          status: 400,
        }
      );
    }

    const invoiceContent =
      await toOpenAIContent(invoiceFile!);

    const passportContent =
      await toOpenAIContent(passportFile!);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: 'gpt-5.4',
      store: false,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Ты распознаёшь данные из двух документов для подготовки доверенности.',
                '',
                'Первый приложенный документ — счёт поставщика.',
                'Второй приложенный документ — паспорт водителя.',
                '',
                'Из счёта извлеки:',
                '- supplier: точное наименование поставщика;',
                '- invoiceNumber: номер счёта без слова "Счёт";',
                '- invoiceDate: дату счёта в формате YYYY-MM-DD;',
                '- invoiceAmount: итоговую сумму счёта в рублях, как она указана в документе.',
                '',
                'Из паспорта извлеки:',
                '- driverFullName: ФИО полностью;',
                '- passportSeries: 4 цифры серии;',
                '- passportNumber: 6 цифр номера;',
                '- passportIssuedBy: кем выдан паспорт;',
                '- passportIssueDate: дату выдачи в формате YYYY-MM-DD.',
                '',
                'Правила:',
                '- Ничего не выдумывай.',
                '- Если значение не удаётся уверенно прочитать, верни пустую строку.',
                '- Не добавляй комментарии и пояснения.',
                '- Верни только один JSON-объект без Markdown.',
                '',
                'Формат ответа:',
                '{"supplier":"","invoiceNumber":"","invoiceDate":"","invoiceAmount":"","driverFullName":"","passportSeries":"","passportNumber":"","passportIssuedBy":"","passportIssueDate":""}',
              ].join('\n'),
            },
            invoiceContent,
            passportContent,
          ],
        },
      ],
    });

    const rawText = response.output_text ?? '';

    if (!rawText.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Не удалось получить распознанные данные.',
        },
        {
          status: 502,
        }
      );
    }

    let parsed = emptyResult();

    try {
      parsed = normalizeResult(
        JSON.parse(cleanJsonText(rawText))
      );
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Не удалось разобрать результат распознавания. Попробуйте загрузить более чёткие файлы.',
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      data: parsed,
    });
  } catch (error) {
    console.error(
      'Powers of attorney parse error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Не удалось распознать документы. Попробуйте ещё раз.',
      },
      {
        status: 500,
      }
    );
  }
}
