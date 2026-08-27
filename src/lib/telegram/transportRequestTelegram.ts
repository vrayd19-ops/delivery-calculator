type TelegramTransportRequestData = {
  requestNumber: string;

  createdAt: Date;

  managerEmail: string;

  loadingDate: Date;

  desiredPickupTime?:
    | string
    | null;

  preferredVehicleName?:
    | string
    | null;

  totalWeight: number;

  cargoLength: number;

  needsStakes: boolean;

  logisticsFitCheck: boolean;

  loadingAddress?:
    | string
    | null;

  loadingMapUrl?:
    | string
    | null;

  loadingContactName: string;

  loadingContactPhone: string;

  loadingUntil: string;

  unloadingAddress?:
    | string
    | null;

  unloadingMapUrl?:
    | string
    | null;

  unloadingContactName: string;

  unloadingContactPhone: string;

  unloadingUntil: string;

  invoiceFileName: string;

  comment?:
    | string
    | null;
};

type TelegramSendMessageResponse = {
  ok: boolean;

  result?: {
    message_id?: number;
  };

  description?: string;
};

function requireTelegramEnv(
  name:
    | 'TELEGRAM_BOT_TOKEN'
    | 'TELEGRAM_CHAT_ID'
) {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `Не настроена переменная ${name}`
    );
  }

  return value;
}

function formatDate(
  value: Date
) {
  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day:
        '2-digit',

      month:
        '2-digit',

      year:
        'numeric',

      timeZone:
        'Europe/Moscow',
    }
  ).format(
    value
  );
}

function formatTime(
  value: Date
) {
  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      hour:
        '2-digit',

      minute:
        '2-digit',

      hour12:
        false,

      timeZone:
        'Europe/Moscow',
    }
  ).format(
    value
  );
}

function yesNo(
  value: boolean
) {
  return value
    ? 'Да'
    : 'Нет';
}

function cleanText(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return '';
  }

  return String(value)
    .replace(
      /\u0000/g,
      ''
    )
    .trim();
}

export function buildTransportRequestTelegramMessage(
  data:
    TelegramTransportRequestData
) {
  const lines:
    string[] = [];

  lines.push(
    '🚚 НОВАЯ ЗАЯВКА НА ТРАНСПОРТ'
  );

  lines.push('');

  lines.push(
    `Заявка: ${cleanText(
      data.requestNumber
    )}`
  );

  lines.push(
    `Дата: ${formatDate(
      data.createdAt
    )}`
  );

  lines.push(
    `Время: ${formatTime(
      data.createdAt
    )}`
  );

  lines.push('');

  lines.push(
    '👤 МЕНЕДЖЕР'
  );

  lines.push(
    `Email: ${cleanText(
      data.managerEmail
    )}`
  );

  lines.push('');

  lines.push(
    '📅 ПОДАЧА МАШИНЫ'
  );

  lines.push(
    `Дата погрузки: ${formatDate(
      data.loadingDate
    )}`
  );

  if (
    data.desiredPickupTime
  ) {
    lines.push(
      `Желаемое время подачи: ${cleanText(
        data.desiredPickupTime
      )}`
    );
  }

  if (
    data.preferredVehicleName
  ) {
    lines.push(
      `Предпочтительный транспорт: ${cleanText(
        data.preferredVehicleName
      )}`
    );
  } else {
    lines.push(
      'Предпочтительный транспорт: подобрать логисту'
    );
  }

  lines.push('');

  lines.push(
    '📦 ГРУЗ'
  );

  lines.push(
    `Общий тоннаж: ${data.totalWeight} т`
  );

  lines.push(
    `Максимальная длина: ${data.cargoLength} м`
  );

  lines.push(
    `Коники: ${yesNo(
      data.needsStakes
    )}`
  );

  lines.push(
    `Уточнить у логиста, поместится ли груз в одну машину: ${yesNo(
      data.logisticsFitCheck
    )}`
  );

  lines.push('');

  lines.push(
    '📍 ПОГРУЗКА'
  );

  if (
    data.loadingAddress
  ) {
    lines.push(
      `Адрес: ${cleanText(
        data.loadingAddress
      )}`
    );
  }

  if (
    data.loadingMapUrl
  ) {
    lines.push(
      `Яндекс Карты: ${cleanText(
        data.loadingMapUrl
      )}`
    );
  }

  lines.push('');

  lines.push(
    `Контакт: ${cleanText(
      data.loadingContactName
    )}`
  );

  lines.push(
    `Телефон: ${cleanText(
      data.loadingContactPhone
    )}`
  );

  lines.push(
    `Работают до: ${cleanText(
      data.loadingUntil
    )}`
  );

  lines.push('');

  lines.push(
    '🏁 ВЫГРУЗКА'
  );

  if (
    data.unloadingAddress
  ) {
    lines.push(
      `Адрес: ${cleanText(
        data.unloadingAddress
      )}`
    );
  }

  if (
    data.unloadingMapUrl
  ) {
    lines.push(
      `Яндекс Карты: ${cleanText(
        data.unloadingMapUrl
      )}`
    );
  }

  lines.push('');

  lines.push(
    `Контакт: ${cleanText(
      data.unloadingContactName
    )}`
  );

  lines.push(
    `Телефон: ${cleanText(
      data.unloadingContactPhone
    )}`
  );

  lines.push(
    `Принимают до: ${cleanText(
      data.unloadingUntil
    )}`
  );

  lines.push('');

  lines.push(
    '📎 СЧЁТ НА ПОГРУЗКУ'
  );

  lines.push(
    'Прикреплён: Да'
  );

  lines.push(
    `Файл: ${cleanText(
      data.invoiceFileName
    )}`
  );

  if (
    data.comment
  ) {
    lines.push('');

    lines.push(
      '💬 КОММЕНТАРИЙ'
    );

    lines.push(
      cleanText(
        data.comment
      )
    );
  }

  return lines.join(
    '\n'
  );
}

export async function sendTransportRequestTextToTelegram(
  data:
    TelegramTransportRequestData
) {
  const token =
    requireTelegramEnv(
      'TELEGRAM_BOT_TOKEN'
    );

  const chatId =
    requireTelegramEnv(
      'TELEGRAM_CHAT_ID'
    );

  const message =
    buildTransportRequestTelegramMessage(
      data
    );

  const response =
    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method:
          'POST',

        headers: {
          'content-type':
            'application/json',
        },

        body:
          JSON.stringify({
            chat_id:
              chatId,

            text:
              message,

            disable_web_page_preview:
              true,
          }),

        cache:
          'no-store',
      }
    );

  const result =
    await response.json() as
      TelegramSendMessageResponse;

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      `Telegram sendMessage error: ${
        result.description ||
        response.status
      }`
    );
  }

  const messageId =
    result.result
      ?.message_id;

  return {
    messageId:
      messageId
        ? String(
            messageId
          )
        : null,
  };
}

export async function sendTransportRequestInvoiceToTelegram(
  input: {
    requestNumber:
      string;

    file:
      File;
  }
) {
  const token =
    requireTelegramEnv(
      'TELEGRAM_BOT_TOKEN'
    );

  const chatId =
    requireTelegramEnv(
      'TELEGRAM_CHAT_ID'
    );

  const formData =
    new FormData();

  formData.set(
    'chat_id',
    chatId
  );

  formData.set(
    'caption',
    `Счёт на погрузку — заявка ${cleanText(
      input.requestNumber
    )}`
  );

  formData.set(
    'document',
    input.file,
    input.file.name
  );

  const response =
    await fetch(
      `https://api.telegram.org/bot${token}/sendDocument`,
      {
        method:
          'POST',

        body:
          formData,

        cache:
          'no-store',
      }
    );

  const result =
    await response.json() as
      TelegramSendMessageResponse;

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      `Telegram sendDocument error: ${
        result.description ||
        response.status
      }`
    );
  }

  return {
    success:
      true,
  };
}