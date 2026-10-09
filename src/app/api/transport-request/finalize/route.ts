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
  sendTransportRequestTextToTelegram,
} from '@/lib/telegram/transportRequestTelegram';


export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';


const MAX_FILES_PER_KIND =
  10;


type FinalizeBody = {
  transportRequestId?:
    unknown;

  supplierExpectedCount?:
    unknown;

  ourExpectedCount?:
    unknown;
};


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


function parseExpectedCount(
  value:
    unknown
) {
  if (
    typeof value !==
    'number'
  ) {
    return null;
  }


  if (
    !Number.isInteger(
      value
    )
  ) {
    return null;
  }


  if (
    value <
      1 ||
    value >
      MAX_FILES_PER_KIND
  ) {
    return null;
  }


  return value;
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
   * 2. ЧИТАЕМ JSON
   * =========================================
   */
  let body:
    FinalizeBody;


  try {
    body =
      await request.json() as
        FinalizeBody;
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST FINALIZE JSON ERROR:',
      error
    );


    return errorResponse(
      'Не удалось прочитать данные завершения заявки.',
      400
    );
  }


  /*
   * =========================================
   * 3. ПРОВЕРЯЕМ ID ЗАЯВКИ
   * =========================================
   */
  const transportRequestId =
    typeof body.transportRequestId ===
      'string'
      ? body.transportRequestId
          .trim()
      : '';


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
   * 4. ПРОВЕРЯЕМ ОЖИДАЕМОЕ КОЛИЧЕСТВО
   * =========================================
   */
  const supplierExpectedCount =
    parseExpectedCount(
      body.supplierExpectedCount
    );


  const ourExpectedCount =
    parseExpectedCount(
      body.ourExpectedCount
    );


  if (
    supplierExpectedCount ===
    null
  ) {
    return errorResponse(
      'Для счетов от поставщика должен быть выбран минимум 1 и максимум 10 файлов.',
      400
    );
  }


  if (
    ourExpectedCount ===
    null
  ) {
    return errorResponse(
      'Для наших счетов должен быть выбран минимум 1 и максимум 10 файлов.',
      400
    );
  }


  /*
   * =========================================
   * 5. ПОЛУЧАЕМ ЗАЯВКУ
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

        include: {
          invoices: {
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
          },
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


  /*
   * =========================================
   * 6. ПРОВЕРЯЕМ ДОСТУП
   * =========================================
   */
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


  /*
   * =========================================
   * 7. ЕСЛИ УЖЕ ОТПРАВЛЕНО
   * =========================================
   *
   * Повторный запрос не должен ещё раз
   * отправлять сообщение в Telegram.
   */
  if (
    transportRequest
      .telegramSent
  ) {
    return NextResponse.json(
      {
        success:
          true,

        alreadyFinalized:
          true,

        requestId:
          transportRequest.id,

        requestNumber:
          transportRequest
            .requestNumber,

        message:
          'Заявка уже была отправлена.',
      }
    );
  }


  /*
   * =========================================
   * 8. БЕРЁМ ТОЛЬКО УСПЕШНО ОТПРАВЛЕННЫЕ
   *    В TELEGRAM СЧЕТА
   * =========================================
   */
  const sentSupplierInvoices =
    transportRequest
      .invoices
      .filter(
        (
          invoice
        ) =>
          invoice.kind ===
            'SUPPLIER' &&
          invoice.telegramSent
      );


  const sentOurInvoices =
    transportRequest
      .invoices
      .filter(
        (
          invoice
        ) =>
          invoice.kind ===
            'OUR' &&
          invoice.telegramSent
      );


  /*
   * =========================================
   * 9. ОБЯЗАТЕЛЬНО МИНИМУМ ПО ОДНОМУ
   * =========================================
   */
  if (
    sentSupplierInvoices.length ===
    0
  ) {
    return errorResponse(
      'Необходимо прикрепить и успешно отправить минимум один счёт от поставщика.',
      409
    );
  }


  if (
    sentOurInvoices.length ===
    0
  ) {
    return errorResponse(
      'Необходимо прикрепить и успешно отправить минимум один наш счёт.',
      409
    );
  }


  /*
   * =========================================
   * 10. ПРОВЕРЯЕМ, ЧТО ОТПРАВИЛИСЬ ВСЕ
   *     ВЫБРАННЫЕ ПОЛЬЗОВАТЕЛЕМ ФАЙЛЫ
   * =========================================
   */
  if (
    sentSupplierInvoices.length <
    supplierExpectedCount
  ) {
    return errorResponse(
      `Не все счета от поставщика отправлены. Выбрано: ${supplierExpectedCount}, успешно отправлено: ${sentSupplierInvoices.length}.`,
      409
    );
  }


  if (
    sentOurInvoices.length <
    ourExpectedCount
  ) {
    return errorResponse(
      `Не все наши счета отправлены. Выбрано: ${ourExpectedCount}, успешно отправлено: ${sentOurInvoices.length}.`,
      409
    );
  }


  /*
   * =========================================
   * 11. ФОРМИРУЕМ СВОДКУ ПО ДОКУМЕНТАМ
   * =========================================
   */
  const supplierNames =
    sentSupplierInvoices
      .slice(
        0,
        supplierExpectedCount
      )
      .map(
        (
          invoice
        ) =>
          invoice.fileName
      );


  const ourNames =
    sentOurInvoices
      .slice(
        0,
        ourExpectedCount
      )
      .map(
        (
          invoice
        ) =>
          invoice.fileName
      );


  const invoiceFileName =
    [
      `Счета от поставщика (${supplierNames.length}): ${supplierNames.join(
        ', '
      )}`,

      `Наши счета (${ourNames.length}): ${ourNames.join(
        ', '
      )}`,
    ].join(
      ' | '
    );


  /*
   * =========================================
   * 12. ОТПРАВЛЯЕМ ОСНОВНОЙ ТЕКСТ ЗАЯВКИ
   * =========================================
   */
  let telegramMessageId:
    string |
    null =
      null;


  try {
    const telegramResult =
      await sendTransportRequestTextToTelegram({
        requestNumber:
          transportRequest
            .requestNumber,

        createdAt:
          transportRequest
            .createdAt,

        managerEmail:
          transportRequest
            .managerEmail,

        customer:
          transportRequest
            .customer,

        loadingDate:
          transportRequest
            .loadingDate,

        desiredPickupTime:
          transportRequest
            .desiredPickupTime,

        preferredVehicleName:
          transportRequest
            .preferredVehicleName,

        totalWeight:
          Number(
            transportRequest
              .totalWeight
          ),

        cargoLength:
          Number(
            transportRequest
              .cargoLength
          ),

        needsStakes:
          transportRequest
            .needsStakes,

        logisticsFitCheck:
          transportRequest
            .logisticsFitCheck,

        loadingAddress:
          transportRequest
            .loadingAddress,

        loadingMapUrl:
          transportRequest
            .loadingMapUrl,

        loadingContactName:
          transportRequest
            .loadingContactName,

        loadingContactPhone:
          transportRequest
            .loadingContactPhone,

        loadingUntil:
          transportRequest
            .loadingUntil,

        unloadingAddress:
          transportRequest
            .unloadingAddress,

        unloadingMapUrl:
          transportRequest
            .unloadingMapUrl,

        unloadingContactName:
          transportRequest
            .unloadingContactName,

        unloadingContactPhone:
          transportRequest
            .unloadingContactPhone,

        unloadingUntil:
          transportRequest
            .unloadingUntil,

        invoiceFileName,

        comment:
          transportRequest
            .comment,
      });


    telegramMessageId =
      telegramResult
        .messageId;
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST FINALIZE TELEGRAM TEXT ERROR:',
      error
    );


    await prisma
      .transportRequest
      .update({
        where: {
          id:
            transportRequest.id,
        },

        data: {
          telegramTextSent:
            false,

          telegramFileSent:
            true,

          telegramSent:
            false,

          telegramError:
            'Счета отправлены, но не удалось отправить основную информацию заявки в Telegram.',
        },
      })
      .catch(
        (
          updateError
        ) => {
          console.error(
            'TRANSPORT REQUEST FINALIZE STATUS ERROR:',
            updateError
          );
        }
      );


    return errorResponse(
      'Счета отправлены, но основную информацию заявки не удалось передать логисту. Попробуйте завершить отправку ещё раз.',
      502
    );
  }


  /*
   * =========================================
   * 13. ПОМЕЧАЕМ ЗАЯВКУ ПОЛНОСТЬЮ
   *     ОТПРАВЛЕННОЙ
   * =========================================
   */
  try {
    await prisma
      .transportRequest
      .update({
        where: {
          id:
            transportRequest.id,
        },

        data: {
          telegramTextSent:
            true,

          telegramFileSent:
            true,

          telegramSent:
            true,

          telegramMessageId,

          telegramError:
            null,

          invoiceFileName,

          invoiceFileType:
            'multiple',

          invoiceFileSize:
            [
              ...sentSupplierInvoices.slice(
                0,
                supplierExpectedCount
              ),

              ...sentOurInvoices.slice(
                0,
                ourExpectedCount
              ),
            ].reduce(
              (
                total,
                invoice
              ) =>
                total +
                invoice.fileSize,

              0
            ),
        },
      });
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST FINALIZE DATABASE ERROR:',
      error
    );


    return errorResponse(
      'Информация передана в Telegram, но не удалось обновить статус заявки в базе данных.',
      500
    );
  }


  /*
   * =========================================
   * 14. УСПЕХ
   * =========================================
   */
  return NextResponse.json(
    {
      success:
        true,

      requestId:
        transportRequest.id,

      requestNumber:
        transportRequest
          .requestNumber,

      supplierInvoiceCount:
        supplierExpectedCount,

      ourInvoiceCount:
        ourExpectedCount,

      message:
        'Заявка и все обязательные счета успешно отправлены.',
    }
  );
}