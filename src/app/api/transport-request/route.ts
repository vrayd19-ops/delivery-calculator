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
  const user =
    await getCurrentUser();

  if (!user) {
    return errorResponse(
      'Необходимо войти в систему.',
      401
    );
  }


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


  const invoiceFiles =
    formData
      .getAll('invoiceFile')
      .filter(
        (entry): entry is File =>
          entry instanceof File
      );

  if (
    invoiceFiles.length ===
    0
  ) {
    return errorResponse(
      'Прикрепите хотя бы один счёт.',
      400,
      {
        invoiceFile:
          'Прикрепите хотя бы один счёт.',
      }
    );
  }

  const MAX_INVOICE_FILES = 10;

  if (
    invoiceFiles.length >
    MAX_INVOICE_FILES
  ) {
    return errorResponse(
      `Можно прикрепить не более ${MAX_INVOICE_FILES} счетов за одну заявку.`,
      400,
      {
        invoiceFile:
          `Можно прикрепить не более ${MAX_INVOICE_FILES} счетов за одну заявку.`,
      }
    );
  }

  for (const invoiceFile of invoiceFiles) {
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
  }

  const invoiceFileNames =
    invoiceFiles
      .map((file) =>
        cleanFileName(
          file.name
        )
      );

  const invoiceFileName =
    invoiceFileNames.join(', ');

  const invoiceFileType =
    invoiceFiles
      .map(
        (file) =>
          file.type ||
          'application/octet-stream'
      )
      .join(', ');

  const invoiceFileSize =
    invoiceFiles.reduce(
      (total, file) =>
        total +
        file.size,
      0
    );


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

            invoiceFileName,

            invoiceFileType,

            invoiceFileSize,

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

        customer:
          data.customer,

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
      'Заявка сохранена, но не удалось передать её логисту. Попробуйте отправить заявку ещё раз или обратитесь к администратору.',
      502
    );
  }


  try {
    for (const invoiceFile of invoiceFiles) {
      await sendTransportRequestInvoiceToTelegram({
        requestNumber,

        file:
          invoiceFile,
      });
    }

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
            'Текст заявки отправлен, но один или несколько файлов счетов не доставлены в Telegram.',
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
      'Данные заявки сохранены, но один или несколько счетов не удалось отправить в Telegram. Заявка не считается полностью отправленной.',
      502
    );
  }


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