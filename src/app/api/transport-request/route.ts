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
} from '@/lib/transport-request/validation';


export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';


const RATE_LIMIT_WINDOW_MS =
  10 * 60 * 1000;

const RATE_LIMIT_MAX_REQUESTS =
  8;


type RateLimitEntry = {
  count:
    number;

  resetAt:
    number;
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


function errorResponse(
  message:
    string,

  status =
    400,

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
        .split(
          ','
        )[0]
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


function isRateLimited(
  ip:
    string
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


function buildFieldErrors(
  issues:
    Array<{
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
   * 2. RATE LIMIT
   * =========================================
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
   * =========================================
   * 3. ЧИТАЕМ FORMDATA
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
      'TRANSPORT REQUEST FORMDATA ERROR:',
      error
    );


    return errorResponse(
      'Не удалось прочитать данные заявки.',
      400
    );
  }


  /*
   * =========================================
   * 4. СОБИРАЕМ ПОЛЯ ЗАЯВКИ
   * =========================================
   */
  const rawData = {
    managerEmail:
      getText(
        formData,
        'managerEmail'
      ),

    customer:
      getText(
        formData,
        'customer'
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
   * =========================================
   * 5. ПРОВЕРЯЕМ ДАННЫЕ
   * =========================================
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
   * =========================================
   * 6. ПРОВЕРЯЕМ ПРЕДПОЧТИТЕЛЬНЫЙ ТРАНСПОРТ
   * =========================================
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
   * =========================================
   * 7. ПРЕОБРАЗУЕМ ЧИСЛОВЫЕ ЗНАЧЕНИЯ
   * =========================================
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
   * =========================================
   * 8. СОЗДАЁМ НОМЕР ЗАЯВКИ
   * =========================================
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
   * =========================================
   * 9. СОЗДАЁМ ЗАЯВКУ
   * =========================================
   *
   * На этом этапе счета ещё не загружаются.
   *
   * Они будут отправлены следующим этапом:
   *
   * /api/transport-request/invoice
   *
   * Старые invoiceFile* поля пока остаются
   * обязательными в модели для совместимости,
   * поэтому записываем временные значения.
   */
  let savedRequest:
    {
      id:
        string;

      requestNumber:
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

            customer:
              data.customer,

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

            invoiceFileName:
              'Счета загружаются отдельно',

            invoiceFileType:
              'pending',

            invoiceFileSize:
              0,

            comment:
              data.comment ??
              null,

            telegramTextSent:
              false,

            telegramFileSent:
              false,

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

            requestNumber:
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
   * =========================================
   * 10. ВОЗВРАЩАЕМ ID ДЛЯ ЗАГРУЗКИ СЧЕТОВ
   * =========================================
   *
   * На клиенте после этого:
   *
   * 1. загружаются счета поставщика;
   * 2. загружаются наши счета;
   * 3. проверяется наличие минимум одного
   *    файла каждого типа;
   * 4. заявка финализируется.
   */
  return NextResponse.json(
    {
      success:
        true,

      requestId:
        savedRequest.id,

      requestNumber:
        savedRequest.requestNumber,

      createdAt:
        savedRequest.createdAt,

      message:
        'Заявка создана. Теперь необходимо загрузить счета от поставщика и наши счета.',

      invoiceRequirements: {
        supplierRequired:
          true,

        ourRequired:
          true,

        minimumSupplierFiles:
          1,

        minimumOurFiles:
          1,

        maximumSupplierFiles:
          10,

        maximumOurFiles:
          10,
      },
    },
    {
      status:
        201,
    }
  );
}