type TransportRequestInvoiceKind =
  | 'SUPPLIER'
  | 'OUR';


type SendInvoiceInput = {
  requestNumber: string;

  kind:
    TransportRequestInvoiceKind;

  file:
    File;
};


type TelegramDocumentResponse = {
  ok: boolean;

  result?: {
    message_id?:
      number;
  };

  description?:
    string;
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


function cleanText(
  value:
    string
) {
  return value
    .replace(
      /\u0000/g,
      ''
    )
    .trim();
}


function invoiceKindLabel(
  kind:
    TransportRequestInvoiceKind
) {
  if (
    kind ===
    'SUPPLIER'
  ) {
    return 'Счёт от поставщика';
  }

  return 'Наш счёт';
}


export async function sendTransportRequestInvoiceDocumentToTelegram(
  input:
    SendInvoiceInput
) {
  const token =
    requireTelegramEnv(
      'TELEGRAM_BOT_TOKEN'
    );

  const chatId =
    requireTelegramEnv(
      'TELEGRAM_CHAT_ID'
    );


  const label =
    invoiceKindLabel(
      input.kind
    );


  const formData =
    new FormData();


  formData.set(
    'chat_id',
    chatId
  );


  formData.set(
    'caption',
    `${label} — заявка ${cleanText(
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


  let result:
    TelegramDocumentResponse;

  try {
    result =
      await response.json() as
        TelegramDocumentResponse;
  } catch {
    throw new Error(
      `Telegram вернул некорректный ответ. HTTP ${response.status}`
    );
  }


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


  const messageId =
    result.result
      ?.message_id;


  return {
    success:
      true,

    messageId:
      messageId
        ? String(
            messageId
          )
        : null,
  };
}