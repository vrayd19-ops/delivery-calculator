import {
  z,
} from 'zod';


export const MAX_INVOICE_FILE_SIZE =
  10 * 1024 * 1024;


export const ALLOWED_INVOICE_MIME_TYPES =
  [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ] as const;


function emptyToUndefined(
  value:
    unknown
) {
  if (
    typeof value !==
    'string'
  ) {
    return value;
  }

  const trimmed =
    value.trim();

  return trimmed ===
    ''
    ? undefined
    : trimmed;
}


function optionalText(
  maxLength:
    number
) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(
        maxLength,
        `Максимальная длина — ${maxLength} символов.`
      )
      .optional()
  );
}


function requiredText(
  message:
    string,

  maxLength:
    number
) {
  return z
    .string()
    .trim()
    .min(
      1,
      message
    )
    .max(
      maxLength,
      `Максимальная длина — ${maxLength} символов.`
    );
}


export function normalizeDecimalValue(
  value:
    string
) {
  return Number(
    value
      .trim()
      .replace(
        ',',
        '.'
      )
  );
}


function isPositiveDecimal(
  value:
    string
) {
  const normalized =
    value
      .trim()
      .replace(
        ',',
        '.'
      );

  if (
    !/^\d+(?:\.\d+)?$/.test(
      normalized
    )
  ) {
    return false;
  }

  const number =
    Number(
      normalized
    );

  return (
    Number.isFinite(
      number
    ) &&
    number >
    0
  );
}


function isValidPhone(
  value:
    string
) {
  const trimmed =
    value.trim();

  if (
    !/^[+\d\s()\-]+$/.test(
      trimmed
    )
  ) {
    return false;
  }

  const digits =
    trimmed.replace(
      /\D/g,
      ''
    );

  return (
    digits.length >=
    10 &&
    digits.length <=
    15
  );
}


function isValidTime(
  value:
    string
) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
    value.trim()
  );
}


function parseDateParts(
  value:
    string
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value
    );

  if (!match) {
    return null;
  }

  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12,
        0,
        0
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}


function getTodayInMoscow() {
  const formatter =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          'Europe/Moscow',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',
      }
    );

  const parts =
    formatter.formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (
        part
      ) =>
        part.type ===
        'year'
    )?.value;

  const month =
    parts.find(
      (
        part
      ) =>
        part.type ===
        'month'
    )?.value;

  const day =
    parts.find(
      (
        part
      ) =>
        part.type ===
        'day'
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}


function isValidLoadingDate(
  value:
    string
) {
  if (
    !parseDateParts(
      value
    )
  ) {
    return false;
  }

  const today =
    getTodayInMoscow();

  if (!today) {
    return false;
  }

  return value >=
    today;
}


function isYandexMapsUrl(
  value:
    string
) {
  let url:
    URL;

  try {
    url =
      new URL(
        value
      );
  } catch {
    return false;
  }

  if (
    url.protocol !==
      'https:' &&
    url.protocol !==
      'http:'
  ) {
    return false;
  }

  const hostname =
    url.hostname
      .toLowerCase()
      .replace(
        /\.$/,
        ''
      );

  const allowedHosts =
    [
      'yandex.ru',
      'www.yandex.ru',
      'maps.yandex.ru',
      'yandex.com',
      'www.yandex.com',
      'maps.yandex.com',
      'yandex.com.tr',
      'www.yandex.com.tr',
      'maps.yandex.com.tr',
      'yandex.kz',
      'www.yandex.kz',
      'maps.yandex.kz',
      'yandex.by',
      'www.yandex.by',
      'maps.yandex.by',
      'yandex.uz',
      'www.yandex.uz',
      'maps.yandex.uz',
      'yandex.com.ge',
      'www.yandex.com.ge',
      'maps.yandex.com.ge',
    ];

  if (
    allowedHosts.includes(
      hostname
    )
  ) {
    return true;
  }

  if (
    hostname ===
      'yandex.app.link' ||
    hostname.endsWith(
      '.yandex.app.link'
    )
  ) {
    return true;
  }

  return false;
}


export const transportRequestSchema =
  z
    .object({
      managerEmail:
        z
          .string()
          .trim()
          .min(
            1,
            'Укажите почту менеджера.'
          )
          .email(
            'Укажите корректную почту менеджера.'
          )
          .max(
            254,
            'Почта менеджера слишком длинная.'
          ),

      customer:
        requiredText(
          'Укажите заказчика.',
          300
        ),

      loadingDate:
        z
          .string()
          .trim()
          .min(
            1,
            'Укажите дату погрузки.'
          )
          .refine(
            (
              value
            ) =>
              isValidLoadingDate(
                value
              ),
            {
              message:
                'Укажите корректную дату погрузки не раньше сегодняшнего дня.',
            }
          ),

      desiredPickupTime:
        optionalText(
          5
        )
          .refine(
            (
              value
            ) =>
              value ===
                undefined ||
              isValidTime(
                value
              ),
            {
              message:
                'Укажите корректное время подачи машины.',
            }
          ),

      preferredVehicleTypeId:
        optionalText(
          100
        ),

      totalWeight:
        requiredText(
          'Укажите общий тоннаж.',
          30
        )
          .refine(
            (
              value
            ) =>
              isPositiveDecimal(
                value
              ),
            {
              message:
                'Общий тоннаж должен быть числом больше 0.',
            }
          ),

      cargoLength:
        requiredText(
          'Укажите максимальную длину груза.',
          30
        )
          .refine(
            (
              value
            ) =>
              isPositiveDecimal(
                value
              ),
            {
              message:
                'Максимальная длина груза должна быть числом больше 0.',
            }
          ),

      needsStakes:
        z
          .enum(
            [
              'yes',
              'no',
            ],
            {
              message:
                'Укажите, нужны ли коники.',
            }
          ),

      logisticsFitCheck:
        z
          .enum(
            [
              'yes',
              'no',
            ]
          )
          .default(
            'no'
          ),

      loadingAddress:
        optionalText(
          1000
        ),

      loadingMapUrl:
        optionalText(
          2000
        )
          .refine(
            (
              value
            ) =>
              value ===
                undefined ||
              isYandexMapsUrl(
                value
              ),
            {
              message:
                'Укажите корректную ссылку на Яндекс Карты.',
            }
          ),

      loadingContactName:
        requiredText(
          'Укажите имя контактного лица на погрузке.',
          200
        ),

      loadingContactPhone:
        requiredText(
          'Укажите телефон контактного лица на погрузке.',
          100
        )
          .refine(
            (
              value
            ) =>
              isValidPhone(
                value
              ),
            {
              message:
                'Укажите корректный телефон на погрузке.',
            }
          ),

      loadingUntil:
        requiredText(
          'Укажите, до скольки работает погрузка.',
          5
        )
          .refine(
            (
              value
            ) =>
              isValidTime(
                value
              ),
            {
              message:
                'Укажите корректное время работы погрузки.',
            }
          ),

      unloadingAddress:
        optionalText(
          1000
        ),

      unloadingMapUrl:
        optionalText(
          2000
        )
          .refine(
            (
              value
            ) =>
              value ===
                undefined ||
              isYandexMapsUrl(
                value
              ),
            {
              message:
                'Укажите корректную ссылку на Яндекс Карты.',
            }
          ),

      unloadingContactName:
        requiredText(
          'Укажите имя контактного лица на выгрузке.',
          200
        ),

      unloadingContactPhone:
        requiredText(
          'Укажите телефон контактного лица на выгрузке.',
          100
        )
          .refine(
            (
              value
            ) =>
              isValidPhone(
                value
              ),
            {
              message:
                'Укажите корректный телефон на выгрузке.',
            }
          ),

      unloadingUntil:
        requiredText(
          'Укажите, до скольки принимают на объекте.',
          5
        )
          .refine(
            (
              value
            ) =>
              isValidTime(
                value
              ),
            {
              message:
                'Укажите корректное время приёмки на объекте.',
            }
          ),

      comment:
        optionalText(
          5000
        ),

      honeypot:
        optionalText(
          500
        ),
    })
    .superRefine(
      (
        data,
        ctx
      ) => {
        if (
          !data.loadingAddress &&
          !data.loadingMapUrl
        ) {
          const message =
            'Укажите точный адрес погрузки или ссылку на Яндекс Карты.';

          ctx.addIssue({
            code:
              'custom',

            path: [
              'loadingAddress',
            ],

            message,
          });

          ctx.addIssue({
            code:
              'custom',

            path: [
              'loadingMapUrl',
            ],

            message,
          });
        }

        if (
          !data.unloadingAddress &&
          !data.unloadingMapUrl
        ) {
          const message =
            'Укажите точный адрес выгрузки или ссылку на Яндекс Карты.';

          ctx.addIssue({
            code:
              'custom',

            path: [
              'unloadingAddress',
            ],

            message,
          });

          ctx.addIssue({
            code:
              'custom',

            path: [
              'unloadingMapUrl',
            ],

            message,
          });
        }

        if (
          data.honeypot
        ) {
          ctx.addIssue({
            code:
              'custom',

            path: [
              'honeypot',
            ],

            message:
              'Не удалось отправить заявку.',
          });
        }
      }
    );


export type TransportRequestFormData =
  z.infer<
    typeof transportRequestSchema
  >;


export type InvoiceFileValidationResult =
  | {
      success:
        true;
    }
  | {
      success:
        false;

      message:
        string;
    };


export function validateInvoiceFile(
  file:
    File |
    null
): InvoiceFileValidationResult {
  if (!file) {
    return {
      success:
        false,

      message:
        'Прикрепите фото или PDF счёта на погрузку.',
    };
  }

  if (
    file.size <=
    0
  ) {
    return {
      success:
        false,

      message:
        'Прикреплённый файл пустой. Выберите другой файл.',
    };
  }

  if (
    file.size >
    MAX_INVOICE_FILE_SIZE
  ) {
    return {
      success:
        false,

      message:
        'Размер файла не должен превышать 10 МБ.',
    };
  }

  const allowedMimeTypes:
    readonly string[] =
      ALLOWED_INVOICE_MIME_TYPES;

  if (
    !allowedMimeTypes.includes(
      file.type
    )
  ) {
    return {
      success:
        false,

      message:
        'Допустимы только PDF, JPG, JPEG, PNG или WEBP.',
    };
  }

  return {
    success:
      true,
  };
}