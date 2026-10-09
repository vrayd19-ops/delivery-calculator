import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  prisma,
} from '@/lib/db';

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

import {
  sendTransportRequestInvoiceDocumentToTelegram,
} from '@/lib/telegram/transportRequestInvoiceTelegram';


export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';


const MAX_FILES_PER_KIND =
  10;


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


function cleanFileName(
  value:
    string
) {
  const cleaned =
    value
      .replace(
        /[\u0000-\u001f\u007f]/g,
        ''
      )
      .replace(
        /[\\/]/g,
        '_'
      )
      .trim();

  return (
    cleaned ||
    'invoice'
  ).slice(
    0,
    240
  );
}


function kindLabel(
  kind:
    InvoiceKind
) {
  if (
    kind ===
    'SUPPLIER'
  ) {
    return 'счёта от поставщика';
  }

  return 'нашего счёта';
}


async function updateLegacyInvoiceSummary(
  transportRequestId:
    string
) {
  const invoices =
    await prisma
      .transportRequestInvoice
      .findMany({
        where: {
          transportRequestId,
        },

        orderBy: [
          {
            kind:
              'asc',
          },

          {
            sortOrder:
              'asc',
          },

          {
            createdAt:
              'asc',
          },
        ],

        select: {
          fileName:
            true,

          fileType:
            true,

          fileSize:
            true,
        },
      });


  const fileNames =
    invoices
      .map(
        (
          invoice
        ) =>
          invoice.fileName
      )
      .join(
        ', '
      );


  const fileTypes =
    invoices
      .map(
        (
          invoice
        ) =>
          invoice.fileType
      )
      .join(
        ', '
      );


  const totalSize =
    invoices.reduce(
      (
        sum,
        invoice
      ) =>
        sum +
        invoice.fileSize,

      0
    );


  await prisma
    .transportRequest
    .update({
      where: {
        id:
          transportRequestId,
      },

      data: {
        invoiceFileName:
          fileNames ||
          'Счета загружаются',

        invoiceFileType:
          fileTypes ||
          'application/octet-stream',

        invoiceFileSize:
          totalSize,
      },
    });
}


async function updateParentFileStatus(
  transportRequestId:
    string
) {
  const [
    supplierCount,
    ourCount,
    failedCount,
  ] =
    await Promise.all([
      prisma
        .transportRequestInvoice
        .count({
          where: {
            transportRequestId,

            kind:
              'SUPPLIER',

            telegramSent:
              true,
          },
        }),

      prisma
        .transportRequestInvoice
        .count({
          where: {
            transportRequestId,

            kind:
              'OUR',

            telegramSent:
              true,
          },
        }),

      prisma
        .transportRequestInvoice
        .count({
          where: {
            transportRequestId,

            telegramSent:
              false,
          },
        }),
    ]);


  const allRequiredFilesSent =
    supplierCount >
      0 &&
    ourCount >
      0 &&
    failedCount ===
      0;


  await prisma
    .transportRequest
    .update({
      where: {
        id:
          transportRequestId,
      },

      data: {
        telegramFileSent:
          allRequiredFilesSent,

        telegramSent:
          false,

        telegramError:
          allRequiredFilesSent
            ? null
            : undefined,
      },
    });
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
      'TRANSPORT REQUEST INVOICE FORMDATA ERROR:',
      error
    );

    return errorResponse(
      'Не удалось прочитать файл счёта.',
      400
    );
  }


  /*
   * =========================================
   * 3. ID ЗАЯВКИ
   * =========================================
   */
  const transportRequestId =
    getText(
      formData,
      'transportRequestId'
    );


  if (
    !transportRequestId
  ) {
    return errorResponse(
      'Не указан идентификатор заявки.',
      400
    );
  }


  /*
   * =========================================
   * 4. ТИП СЧЁТА
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
   * 5. ПРОВЕРЯЕМ ЗАЯВКУ И ДОСТУП
   * =========================================
   */
  const transportRequest =
    await prisma
      .transportRequest
      .findUnique({
        where: {
          id:
            transportRequestId,
        },

        select: {
          id:
            true,

          requestNumber:
            true,

          createdByUserId:
            true,

          telegramSent:
            true,
        },
      });


  if (
    !transportRequest
  ) {
    return errorResponse(
      'Заявка не найдена.',
      404
    );
  }


  const isAdmin =
    user.role ===
    'ADMIN';


  if (
    !isAdmin &&
    transportRequest
      .createdByUserId !==
      user.id
  ) {
    return errorResponse(
      'У вас нет доступа к этой заявке.',
      403
    );
  }


  if (
    transportRequest
      .telegramSent
  ) {
    return errorResponse(
      'Заявка уже полностью отправлена. Добавление счетов недоступно.',
      409
    );
  }


  /*
   * =========================================
   * 6. ПРОВЕРЯЕМ ЛИМИТ ФАЙЛОВ
   * =========================================
   */
  const currentCount =
    await prisma
      .transportRequestInvoice
      .count({
        where: {
          transportRequestId,

          kind,
        },
      });


  if (
    currentCount >=
    MAX_FILES_PER_KIND
  ) {
    return errorResponse(
      `Можно прикрепить не более ${MAX_FILES_PER_KIND} файлов для ${kindLabel(
        kind
      )}.`,
      400
    );
  }


  /*
   * =========================================
   * 7. ПОЛУЧАЕМ И ПРОВЕРЯЕМ ФАЙЛ
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


  const fileName =
    cleanFileName(
      file.name
    );


  const fileType =
    file.type ||
    'application/octet-stream';


  /*
   * =========================================
   * 8. ПРОВЕРЯЕМ ДУБЛИКАТ И НЕУДАЧНУЮ
   *    ПРЕДЫДУЩУЮ ПОПЫТКУ
   * =========================================
   */
  const existingInvoice =
    await prisma
      .transportRequestInvoice
      .findFirst({
        where: {
          transportRequestId,

          kind,

          fileName,

          fileSize:
            file.size,
        },

        orderBy: {
          createdAt:
            'desc',
        },

        select: {
          id:
            true,

          telegramSent:
            true,
        },
      });


  if (
    existingInvoice
      ?.telegramSent
  ) {
    return errorResponse(
      'Этот файл уже прикреплён к заявке.',
      409
    );
  }


  /*
   * =========================================
   * 9. ПРОВЕРЯЕМ, В ПРАВИЛЬНЫЙ ЛИ
   *    БЛОК ЗАГРУЖЕН СЧЁТ
   * =========================================
   *
   * OUR:
   * наша организация должна быть
   * поставщиком / исполнителем.
   *
   * SUPPLIER:
   * наша организация должна быть
   * покупателем / заказчиком,
   * а поставщик должен иметь другой ИНН.
   *
   * Если проверить документ не удалось,
   * файл НЕ сохраняется и НЕ отправляется
   * в Telegram.
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
      'TRANSPORT REQUEST INVOICE CLASSIFICATION ERROR:',
      error
    );


    return errorResponse(
      'Не удалось проверить принадлежность счёта. Файл не отправлен. Попробуйте ещё раз.',
      503
    );
  }


  if (
    !classification.accepted
  ) {
    console.warn(
      'TRANSPORT REQUEST INVOICE REJECTED:',
      {
        requestNumber:
          transportRequest
            .requestNumber,

        expectedKind:
          kind,

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

        fileName,
      }
    );


    return errorResponse(
      classification.message,
      422
    );
  }


  /*
   * =========================================
   * 10. СОЗДАЁМ ИЛИ ПЕРЕИСПОЛЬЗУЕМ ЗАПИСЬ
   *     О СЧЁТЕ
   * =========================================
   */
  let savedInvoice:
    {
      id:
        string;
    };


  try {
    if (
      existingInvoice
    ) {
      savedInvoice =
        await prisma
          .transportRequestInvoice
          .update({
            where: {
              id:
                existingInvoice.id,
            },

            data: {
              fileType,

              telegramSent:
                false,

              telegramMessageId:
                null,

              telegramError:
                null,
            },

            select: {
              id:
                true,
            },
          });
    } else {
      savedInvoice =
        await prisma
          .transportRequestInvoice
          .create({
            data: {
              transportRequestId:
                transportRequest.id,

              kind,

              sortOrder:
                currentCount,

              fileName,

              fileType,

              fileSize:
                file.size,

              telegramSent:
                false,

              telegramMessageId:
                null,

              telegramError:
                null,
            },

            select: {
              id:
                true,
            },
          });
    }
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST INVOICE DATABASE SAVE ERROR:',
      error
    );

    return errorResponse(
      'Не удалось сохранить информацию о счёте.',
      500
    );
  }


  /*
   * =========================================
   * 11. ОТПРАВЛЯЕМ ФАЙЛ В TELEGRAM
   * =========================================
   */
  let telegramMessageId:
    string |
    null =
      null;


  try {
    const telegramResult =
      await sendTransportRequestInvoiceDocumentToTelegram({
        requestNumber:
          transportRequest
            .requestNumber,

        kind,

        file,
      });


    telegramMessageId =
      telegramResult
        .messageId;


    await prisma
      .transportRequestInvoice
      .update({
        where: {
          id:
            savedInvoice.id,
        },

        data: {
          telegramSent:
            true,

          telegramMessageId,

          telegramError:
            null,
        },
      });
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST INVOICE TELEGRAM ERROR:',
      error
    );


    await prisma
      .transportRequestInvoice
      .update({
        where: {
          id:
            savedInvoice.id,
        },

        data: {
          telegramSent:
            false,

          telegramMessageId:
            null,

          telegramError:
            'Не удалось отправить файл счёта в Telegram.',
        },
      })
      .catch(
        (
          updateError
        ) => {
          console.error(
            'TRANSPORT REQUEST INVOICE STATUS UPDATE ERROR:',
            updateError
          );
        }
      );


    await prisma
      .transportRequest
      .update({
        where: {
          id:
            transportRequest.id,
        },

        data: {
          telegramFileSent:
            false,

          telegramSent:
            false,

          telegramError:
            `Не удалось отправить ${kindLabel(
              kind
            )} в Telegram.`,
        },
      })
      .catch(
        (
          updateError
        ) => {
          console.error(
            'TRANSPORT REQUEST PARENT STATUS UPDATE ERROR:',
            updateError
          );
        }
      );


    return errorResponse(
      `Не удалось отправить файл ${kindLabel(
        kind
      )}. Попробуйте ещё раз.`,
      502
    );
  }


  /*
   * =========================================
   * 12. ОБНОВЛЯЕМ СТАРЫЕ СВОДНЫЕ ПОЛЯ
   * =========================================
   */
  try {
    await updateLegacyInvoiceSummary(
      transportRequest.id
    );
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST LEGACY INVOICE SUMMARY ERROR:',
      error
    );
  }


  /*
   * =========================================
   * 13. ОБНОВЛЯЕМ СТАТУС ФАЙЛОВ ЗАЯВКИ
   * =========================================
   */
  try {
    await updateParentFileStatus(
      transportRequest.id
    );
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST FILE STATUS ERROR:',
      error
    );
  }


  /*
   * =========================================
   * 14. СЧИТАЕМ ТЕКУЩЕЕ КОЛИЧЕСТВО
   * =========================================
   */
  const [
    supplierCount,
    ourCount,
  ] =
    await Promise.all([
      prisma
        .transportRequestInvoice
        .count({
          where: {
            transportRequestId:
              transportRequest.id,

            kind:
              'SUPPLIER',

            telegramSent:
              true,
          },
        }),

      prisma
        .transportRequestInvoice
        .count({
          where: {
            transportRequestId:
              transportRequest.id,

            kind:
              'OUR',

            telegramSent:
              true,
          },
        }),
    ]);


  /*
   * =========================================
   * 15. УСПЕШНЫЙ ОТВЕТ
   * =========================================
   */
  return NextResponse.json(
    {
      success:
        true,

      invoice: {
        id:
          savedInvoice.id,

        kind,

        fileName,

        fileType,

        fileSize:
          file.size,

        telegramSent:
          true,

        telegramMessageId,
      },

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
      },

      counts: {
        supplier:
          supplierCount,

        our:
          ourCount,
      },

      requirementsSatisfied:
        supplierCount >
          0 &&
        ourCount >
          0,
    },
    {
      status:
        201,
    }
  );
}