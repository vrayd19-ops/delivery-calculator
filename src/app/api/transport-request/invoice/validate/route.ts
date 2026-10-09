import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  getCurrentUser,
} from '@/lib/auth';

import {
  validateInvoiceFile,
} from '@/lib/transport-request/validation';

import {
  classifyTransportRequestInvoice,
  type TransportRequestInvoiceKind,
} from '@/lib/transport-request/invoiceClassifier';


export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';


type InvoiceKind =
  TransportRequestInvoiceKind;


function errorResponse(
  message:
    string,

  status =
    400
) {
  return NextResponse.json(
    {
      success:
        false,

      message,
    },
    {
      status,
    }
  );
}


function getText(
  formData:
    FormData,

  name:
    string
) {
  const value =
    formData.get(
      name
    );


  if (
    typeof value !==
    'string'
  ) {
    return '';
  }


  return value.trim();
}


function isInvoiceKind(
  value:
    string
): value is InvoiceKind {
  return (
    value ===
      'SUPPLIER' ||
    value ===
      'OUR'
  );
}


function isAllowedFileExtension(
  fileName:
    string
) {
  const normalized =
    fileName
      .trim()
      .toLowerCase();


  return (
    normalized.endsWith(
      '.pdf'
    ) ||
    normalized.endsWith(
      '.jpg'
    ) ||
    normalized.endsWith(
      '.jpeg'
    ) ||
    normalized.endsWith(
      '.png'
    ) ||
    normalized.endsWith(
      '.webp'
    )
  );
}


export async function POST(
  request:
    NextRequest
) {
  /*
   * =========================================
   * 1. АВТОРИЗАЦИЯ
   * =========================================
   */
  const user =
    await getCurrentUser();


  if (!user) {
    return errorResponse(
      'Необходимо войти в систему.',
      401
    );
  }


  /*
   * =========================================
   * 2. ЧИТАЕМ FORMDATA
   * =========================================
   */
  let formData:
    FormData;


  try {
    formData =
      await request.formData();
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST INVOICE VALIDATE FORMDATA ERROR:',
      error
    );


    return errorResponse(
      'Не удалось прочитать файл счёта.',
      400
    );
  }


  /*
   * =========================================
   * 3. ТИП СЧЁТА
   * =========================================
   */
  const rawKind =
    getText(
      formData,
      'kind'
    );


  if (
    !isInvoiceKind(
      rawKind
    )
  ) {
    return errorResponse(
      'Некорректный тип счёта.',
      400
    );
  }


  const kind =
    rawKind;


  /*
   * =========================================
   * 4. ПОЛУЧАЕМ ФАЙЛ
   * =========================================
   */
  const fileEntry =
    formData.get(
      'file'
    );


  const file =
    fileEntry instanceof
      File
      ? fileEntry
      : null;


  /*
   * =========================================
   * 5. ОБЫЧНАЯ ПРОВЕРКА ФАЙЛА
   * =========================================
   */
  const fileValidation =
    validateInvoiceFile(
      file
    );


  if (
    !fileValidation.success
  ) {
    return errorResponse(
      fileValidation.message,
      400
    );
  }


  if (!file) {
    return errorResponse(
      'Прикрепите файл счёта.',
      400
    );
  }


  if (
    !isAllowedFileExtension(
      file.name
    )
  ) {
    return errorResponse(
      'Допустимы только PDF, JPG, JPEG, PNG или WEBP.',
      400
    );
  }


  /*
   * =========================================
   * 6. РАСПОЗНАЁМ СЧЁТ
   * =========================================
   *
   * ВАЖНО:
   *
   * Здесь:
   * - НЕ создаётся заявка;
   * - НЕ создаётся запись счёта в БД;
   * - НЕ отправляется файл в Telegram;
   * - НЕ отправляется текст заявки.
   *
   * Endpoint только проверяет документ.
   */
  let classification:
    Awaited<
      ReturnType<
        typeof classifyTransportRequestInvoice
      >
    >;


  try {
    classification =
      await classifyTransportRequestInvoice({
        file,

        expectedKind:
          kind,
      });
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST INVOICE PREVALIDATION ERROR:',
      error
    );


    return errorResponse(
      'Не удалось проверить счёт. Заявка не отправлена. Попробуйте ещё раз.',
      503
    );
  }


  /*
   * =========================================
   * 7. НЕПРАВИЛЬНЫЙ СЧЁТ
   * =========================================
   */
  if (
    !classification.accepted
  ) {
    return NextResponse.json(
      {
        success:
          false,

        accepted:
          false,

        message:
          classification.message,

        classification: {
          detectedKind:
            classification
              .detectedKind,

          supplierName:
            classification
              .supplierName,

          supplierInn:
            classification
              .supplierInn,

          buyerName:
            classification
              .buyerName,

          buyerInn:
            classification
              .buyerInn,

          recognitionMethod:
            classification
              .recognitionMethod,
        },
      },
      {
        status:
          422,
      }
    );
  }


  /*
   * =========================================
   * 8. СЧЁТ ПРОШЁЛ ПРОВЕРКУ
   * =========================================
   */
  return NextResponse.json(
    {
      success:
        true,

      accepted:
        true,

      message:
        'Счёт успешно проверен.',

      classification: {
        detectedKind:
          classification
            .detectedKind,

        supplierName:
          classification
            .supplierName,

        supplierInn:
          classification
            .supplierInn,

        buyerName:
          classification
            .buyerName,

        buyerInn:
          classification
            .buyerInn,

        recognitionMethod:
          classification
            .recognitionMethod,
      },
    },
    {
      status:
        200,
    }
  );
}