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
  normalizeDecimalValue,
  transportRequestSchema,
  validateInvoiceFile,
} from '@/lib/transport-request/validation';

import {
  sendTransportRequestInvoiceToTelegram,
  sendTransportRequestTextToTelegram,
} from '@/lib/telegram/transportRequestTelegram';


export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';


/*
 * =========================================
 * ПРОСТАЯ ЗАЩИТА ОТ ЧАСТЫХ ПОВТОРОВ
 * =========================================
 *
 * Это дополнительная защита поверх:
 *
 * - обязательной авторизации;
 * - honeypot;
 * - блокировки кнопки на frontend.
 *
 * Для одного экземпляра сервера
 * ограничиваем количество запросов
 * от одного IP.
 */
const RATE_LIMIT_WINDOW_MS =
  10 * 60 * 1000;

const RATE_LIMIT_MAX_REQUESTS =
  8;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit =
  globalThis as typeof globalThis & {
    transportRequestRateLimit?:
      Map<
        string,
        RateLimitEntry
      >;
  };

const rateLimitStore =
  globalForRateLimit
    .transportRequestRateLimit ??
  new Map<
    string,
    RateLimitEntry
  >();

if (
  process.env.NODE_ENV !==
  'production'
) {
  globalForRateLimit
    .transportRequestRateLimit =
    rateLimitStore;
}


/*
 * =========================================
 * БЕЗОПАСНЫЙ JSON-ОТВЕТ
 * =========================================
 */
function errorResponse(
  message: string,
  status = 400,
  fieldErrors?:
    Record<
      string,
      string
    >
) {
  return NextResponse.json(
    {
      success:
        false,

      message,

      ...(fieldErrors
        ? {
            fieldErrors,
          }
        : {}),
    },
    {
      status,
    }
  );
}


/*
 * =========================================
 * IP ПОЛЬЗОВАТЕЛЯ
 * =========================================
 */
function getClientIp(
  request:
    NextRequest
) {
  const forwarded =
    request.headers.get(
      'x-forwarded-for'
    );

  if (forwarded) {
    return (
      forwarded
        .split(',')[0]
        ?.trim() ||
      'unknown'
    );
  }

  const realIp =
    request.headers.get(
      'x-real-ip'
    );

  return (
    realIp?.trim() ||
    'unknown'
  );
}


/*
 * =========================================
 * RATE LIMIT
 * =========================================
 */
function isRateLimited(
  ip: string
) {
  const now =
    Date.now();

  const existing =
    rateLimitStore.get(
      ip
    );

  if (
    !existing ||
    existing.resetAt <=
      now
  ) {
    rateLimitStore.set(
      ip,
      {
        count:
          1,

        resetAt:
          now +
          RATE_LIMIT_WINDOW_MS,
      }
    );

    return false;
  }

  if (
    existing.count >=
    RATE_LIMIT_MAX_REQUESTS
  ) {
    return true;
  }

  existing.count +=
    1;

  rateLimitStore.set(
    ip,
    existing
  );

  return false;
}


/*
 * =========================================
 * ПОЛУЧЕНИЕ СТРОКИ ИЗ FORMDATA
 * =========================================
 */
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


/*
 * =========================================
 * ПРОВЕРКА РАСШИРЕНИЯ ФАЙЛА
 * =========================================
 */
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


/*
 * =========================================
 * БЕЗОПАСНОЕ ИМЯ ФАЙЛА
 * =========================================
 */
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


/*
 * =========================================
 * ОШИБКИ ZOD В ФОРМАТ ДЛЯ FRONTEND
 * =========================================
 */
function buildFieldErrors(
  issues: Array<{
    path:
      PropertyKey[];

    message:
      string;
  }>
) {
  const fieldErrors:
    Record<
      string,
      string
    > = {};

  for (
    const issue
    of issues
  ) {
    const firstPath =
      issue.path[0];

    if (
      typeof firstPath !==
      'string'
    ) {
      continue;
    }

    if (
      !fieldErrors[
        firstPath
      ]
    ) {
      fieldErrors[
        firstPath
      ] =
        issue.message;
    }
  }

  return fieldErrors;
}


/*
 * =========================================
 * ДАТА YYYY-MM-DD → DATE
 * =========================================
 */
function parseDateOnly(
  value:
    string
) {
  const [
    yearText,
    monthText,
    dayText,
  ] =
    value.split(
      '-'
    );

  const year =
    Number(
      yearText
    );

  const month =
    Number(
      monthText
    );

  const day =
    Number(
      dayText
    );

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0
    )
  );
}


/*
 * =========================================
 * ТЕКУЩИЙ ГОД ПО МОСКВЕ
 * =========================================
 */
function getMoscowYear() {
  const formatted =
    new Intl.DateTimeFormat(
      'en-US',
      {
        year:
          'numeric',

        timeZone:
          'Europe/Moscow',
      }
    ).format(
      new Date()
    );

  return Number(
    formatted
  );
}


/*
 * =========================================
 * ГЕНЕРАЦИЯ НОМЕРА ЗАЯВКИ
 * =========================================
 *
 * Используем отдельный счётчик в БД:
 *
 * TR-2026-000001
 * TR-2026-000002
 * ...
 */
async function createRequestNumber() {
  const year =
    getMoscowYear();

  const counter =
    await prisma
      .transportRequestCounter
      .upsert({
        where: {
          year,
        },

        create: {
          year,

          value:
            1,
        },

        update: {
          value: {
            increment:
              1,
          },
        },
      });

  return `TR-${year}-${String(
    counter.value
  ).padStart(
    6,
    '0'
  )}`;
}


/*
 * =========================================
 * ОСНОВНОЙ POST ENDPOINT
 * =========================================
 */
export async function POST(
  request:
    NextRequest
) {
  /*
   * -----------------------------------------
   * 1. АВТОРИЗАЦИЯ
   * -----------------------------------------
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
   * -----------------------------------------
   * 2. RATE LIMIT
   * -----------------------------------------
   */
  const clientIp =
    getClientIp(
      request
    );

  if (
    isRateLimited(
      clientIp
    )
  ) {
    return errorResponse(
      'Слишком много попыток отправки. Подождите несколько минут и попробуйте снова.',
      429
    );
  }


  /*
   * -----------------------------------------
   * 3. ЧИТАЕМ FORMDATA
   * -----------------------------------------
   */
  let formData:
    FormData;

  try {
    formData =
      await request.formData();
  } catch {
    return errorResponse(
      'Не удалось прочитать данные заявки.',
      400
    );
  }


  /*
   * -----------------------------------------
   * 4. СОБИРАЕМ ТЕКСТОВЫЕ ПОЛЯ
   * -----------------------------------------
   */
  const rawData = {
    managerEmail:
      getText(
        formData,
        'managerEmail'
      ),

    loadingDate:
      getText(
        formData,
        'loadingDate'
      ),

    desiredPickupTime:
      getText(
        formData,
        'desiredPickupTime'
      ),

    preferredVehicleTypeId:
      getText(
        formData,
        'preferredVehicleTypeId'
      ),

    totalWeight:
      getText(
        formData,
        'totalWeight'
      ),

    cargoLength:
      getText(
        formData,
        'cargoLength'
      ),

    needsStakes:
      getText(
        formData,
        'needsStakes'
      ),

    logisticsFitCheck:
      getText(
        formData,
        'logisticsFitCheck'
      ) ===
      'yes'
        ? 'yes'
        : 'no',

    loadingAddress:
      getText(
        formData,
        'loadingAddress'
      ),

    loadingMapUrl:
      getText(
        formData,
        'loadingMapUrl'
      ),

    loadingContactName:
      getText(
        formData,
        'loadingContactName'
      ),

    loadingContactPhone:
      getText(
        formData,
        'loadingContactPhone'
      ),

    loadingUntil:
      getText(
        formData,
        'loadingUntil'
      ),

    unloadingAddress:
      getText(
        formData,
        'unloadingAddress'
      ),

    unloadingMapUrl:
      getText(
        formData,
        'unloadingMapUrl'
      ),

    unloadingContactName:
      getText(
        formData,
        'unloadingContactName'
      ),

    unloadingContactPhone:
      getText(
        formData,
        'unloadingContactPhone'
      ),

    unloadingUntil:
      getText(
        formData,
        'unloadingUntil'
      ),

    comment:
      getText(
        formData,
        'comment'
      ),

    honeypot:
      getText(
        formData,
        'website'
      ),
  };


  /*
   * -----------------------------------------
   * 5. СЕРВЕРНАЯ ZOD-ВАЛИДАЦИЯ
   * -----------------------------------------
   */
  const parsed =
    transportRequestSchema
      .safeParse(
        rawData
      );

  if (
    !parsed.success
  ) {
    const fieldErrors =
      buildFieldErrors(
        parsed.error.issues
      );

    const firstMessage =
      parsed.error
        .issues[0]
        ?.message ||
      'Проверьте заполненные данные.';

    return errorResponse(
      firstMessage,
      400,
      fieldErrors
    );
  }

  const data =
    parsed.data;


  /*
   * -----------------------------------------
   * 6. ПРОВЕРЯЕМ ФАЙЛ
   * -----------------------------------------
   */
  const invoiceEntry =
    formData.get(
      'invoiceFile'
    );

  const invoiceFile =
    invoiceEntry instanceof
      File
      ? invoiceEntry
      : null;

  const fileValidation =
    validateInvoiceFile(
      invoiceFile
    );

  if (
    !fileValidation.success
  ) {
    return errorResponse(
      fileValidation.message,
      400,
      {
        invoiceFile:
          fileValidation.message,
      }
    );
  }

  if (
    !invoiceFile
  ) {
    return errorResponse(
      'Прикрепите фото или PDF счёта на погрузку.',
      400,
      {
        invoiceFile:
          'Прикрепите фото или PDF счёта на погрузку.',
      }
    );
  }

  if (
    !isAllowedFileExtension(
      invoiceFile.name
    )
  ) {
    return errorResponse(
      'Допустимы только PDF, JPG, JPEG, PNG или WEBP.',
      400,
      {
        invoiceFile:
          'Допустимы только PDF, JPG, JPEG, PNG или WEBP.',
      }
    );
  }

  const invoiceFileName =
    cleanFileName(
      invoiceFile.name
    );


  /*
   * -----------------------------------------
   * 7. ПРОВЕРЯЕМ ПРЕДПОЧТИТЕЛЬНЫЙ ТРАНСПОРТ
   * -----------------------------------------
   */
  let preferredVehicle:
    {
      id:
        string;

      name:
        string;
    } |
    null =
      null;

  if (
    data.preferredVehicleTypeId
  ) {
    preferredVehicle =
      await prisma
        .vehicleType
        .findFirst({
          where: {
            id:
              data.preferredVehicleTypeId,

            isActive:
              true,
          },

          select: {
            id:
              true,

            name:
              true,
          },
        });

    if (
      !preferredVehicle
    ) {
      return errorResponse(
        'Выбранный транспорт больше недоступен. Выберите другой вариант.',
        400,
        {
          preferredVehicleTypeId:
            'Выбранный транспорт больше недоступен.',
        }
      );
    }
  }


  /*
   * -----------------------------------------
   * 8. ПРЕОБРАЗУЕМ ЧИСЛА
   * -----------------------------------------
   */
  const totalWeight =
    normalizeDecimalValue(
      data.totalWeight
    );

  const cargoLength =
    normalizeDecimalValue(
      data.cargoLength
    );

  const needsStakes =
    data.needsStakes ===
    'yes';

  const logisticsFitCheck =
    data.logisticsFitCheck ===
    'yes';

  const loadingDate =
    parseDateOnly(
      data.loadingDate
    );


  /*
   * -----------------------------------------
   * 9. СОЗДАЁМ НОМЕР
   * -----------------------------------------
   */
  let requestNumber:
    string;

  try {
    requestNumber =
      await createRequestNumber();
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST NUMBER ERROR:',
      error
    );

    return errorResponse(
      'Не удалось создать номер заявки. Попробуйте ещё раз.',
      500
    );
  }


  /*
   * -----------------------------------------
   * 10. СОХРАНЯЕМ ЗАЯВКУ В БД
   * -----------------------------------------
   */
  let savedRequest:
    {
      id:
        string;

      createdAt:
        Date;
    };

  try {
    savedRequest =
      await prisma
        .transportRequest
        .create({
          data: {
            requestNumber,

            createdByUserId:
              user.id,

            managerEmail:
              data.managerEmail,

            loadingDate,

            desiredPickupTime:
              data.desiredPickupTime ??
              null,

            preferredVehicleTypeId:
              preferredVehicle
                ?.id ??
              null,

            preferredVehicleName:
              preferredVehicle
                ?.name ??
              null,

            totalWeight,

            cargoLength,

            needsStakes,

            logisticsFitCheck,

            loadingAddress:
              data.loadingAddress ??
              null,

            loadingMapUrl:
              data.loadingMapUrl ??
              null,

            loadingContactName:
              data.loadingContactName,

            loadingContactPhone:
              data.loadingContactPhone,

            loadingUntil:
              data.loadingUntil,

            unloadingAddress:
              data.unloadingAddress ??
              null,

            unloadingMapUrl:
              data.unloadingMapUrl ??
              null,

            unloadingContactName:
              data.unloadingContactName,

            unloadingContactPhone:
              data.unloadingContactPhone,

            unloadingUntil:
              data.unloadingUntil,

            invoiceFileName,

            invoiceFileType:
              invoiceFile.type,

            invoiceFileSize:
              invoiceFile.size,

            comment:
              data.comment ??
              null,

            telegramTextSent:
              false,

            telegramFileSent:
              false,

            telegramSent:
              false,
          },

          select: {
            id:
              true,

            createdAt:
              true,
          },
        });
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST DATABASE ERROR:',
      error
    );

    return errorResponse(
      'Не удалось сохранить заявку. Попробуйте ещё раз.',
      500
    );
  }


  /*
   * -----------------------------------------
   * 11. ОТПРАВЛЯЕМ ТЕКСТ В TELEGRAM
   * -----------------------------------------
   */
  let telegramMessageId:
    string |
    null =
      null;

  try {
    const telegramResult =
      await sendTransportRequestTextToTelegram({
        requestNumber,

        createdAt:
          savedRequest.createdAt,

        managerEmail:
          data.managerEmail,

        loadingDate,

        desiredPickupTime:
          data.desiredPickupTime ??
          null,

        preferredVehicleName:
          preferredVehicle
            ?.name ??
          null,

        totalWeight,

        cargoLength,

        needsStakes,

        logisticsFitCheck,

        loadingAddress:
          data.loadingAddress ??
          null,

        loadingMapUrl:
          data.loadingMapUrl ??
          null,

        loadingContactName:
          data.loadingContactName,

        loadingContactPhone:
          data.loadingContactPhone,

        loadingUntil:
          data.loadingUntil,

        unloadingAddress:
          data.unloadingAddress ??
          null,

        unloadingMapUrl:
          data.unloadingMapUrl ??
          null,

        unloadingContactName:
          data.unloadingContactName,

        unloadingContactPhone:
          data.unloadingContactPhone,

        unloadingUntil:
          data.unloadingUntil,

        invoiceFileName,

        comment:
          data.comment ??
          null,
      });

    telegramMessageId =
      telegramResult
        .messageId;

    await prisma
      .transportRequest
      .update({
        where: {
          id:
            savedRequest.id,
        },

        data: {
          telegramTextSent:
            true,

          telegramMessageId,
        },
      });
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST TELEGRAM TEXT ERROR:',
      error
    );

    await prisma
      .transportRequest
      .update({
        where: {
          id:
            savedRequest.id,
        },

        data: {
          telegramTextSent:
            false,

          telegramFileSent:
            false,

          telegramSent:
            false,

          telegramError:
            'Не удалось отправить текст заявки в Telegram.',
        },
      })
      .catch(
        (
          updateError
        ) => {
          console.error(
            'TRANSPORT REQUEST STATUS UPDATE ERROR:',
            updateError
          );
        }
      );

    return errorResponse(
      'Заявка сохранена, но не удалось передать её ответственному менеджеру. Попробуйте отправить заявку ещё раз или обратитесь к администратору.',
      502
    );
  }


  /*
   * -----------------------------------------
   * 12. ОТПРАВЛЯЕМ СЧЁТ В TELEGRAM
   * -----------------------------------------
   */
  try {
    await sendTransportRequestInvoiceToTelegram({
      requestNumber,

      file:
        invoiceFile,
    });

    await prisma
      .transportRequest
      .update({
        where: {
          id:
            savedRequest.id,
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
        },
      });
  } catch (
    error
  ) {
    console.error(
      'TRANSPORT REQUEST TELEGRAM FILE ERROR:',
      error
    );

    await prisma
      .transportRequest
      .update({
        where: {
          id:
            savedRequest.id,
        },

        data: {
          telegramTextSent:
            true,

          telegramFileSent:
            false,

          telegramSent:
            false,

          telegramMessageId,

          telegramError:
            'Текст заявки отправлен, но файл счёта не доставлен в Telegram.',
        },
      })
      .catch(
        (
          updateError
        ) => {
          console.error(
            'TRANSPORT REQUEST STATUS UPDATE ERROR:',
            updateError
          );
        }
      );

    return errorResponse(
      'Данные заявки сохранены, но счёт не удалось отправить в Telegram. Заявка не считается полностью отправленной.',
      502
    );
  }


  /*
   * -----------------------------------------
   * 13. УСПЕХ
   * -----------------------------------------
   */
  return NextResponse.json(
    {
      success:
        true,

      requestNumber,
    },
    {
      status:
        201,
    }
  );
}