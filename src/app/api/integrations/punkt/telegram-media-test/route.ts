import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramChat = {
  id: number;
  type: string;
  title?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

type TelegramGetUpdatesResponse = {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
};

type TelegramWebhookResponse = {
  ok: boolean;
  result?: {
    url?: string;
  };
  description?: string;
};

type TelegramSendMessageResponse = {
  ok: boolean;
  result?: TelegramMessage;
  description?: string;
};

function requireEnv(
  name:
    | "TELEGRAM_BOT_TOKEN"
    | "PUNKT_BRT_INTEGRATION_KEY",
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Не задана переменная ${name}.`,
    );
  }

  return value;
}

function buildTestMessage(): string {
  const date =
    new Intl.DateTimeFormat(
      "ru-RU",
      {
        timeZone:
          "Europe/Moscow",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      },
    ).format(new Date());

  return [
    date,
    "",
    "ТЕСТОВАЯ ОТПРАВКА ФОТО И ВИДЕО",
    "",
    "Ведутся работы по упрощению работы экспедитора, менеджера и логиста 😉",
  ].join("\n");
}

async function telegramRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        ...init,
        cache: "no-store",
        signal:
          AbortSignal.timeout(
            15000,
          ),
      },
    );

  const data =
    (await response.json()) as T;

  if (!response.ok) {
    throw new Error(
      `Telegram HTTP ${response.status}`,
    );
  }

  return data;
}

export async function POST(
  request: Request,
) {
  try {
    const integrationKey =
      requireEnv(
        "PUNKT_BRT_INTEGRATION_KEY",
      );

    const suppliedKey =
      request.headers
        .get(
          "x-punkt-integration-key",
        )
        ?.trim();

    if (
      !suppliedKey ||
      suppliedKey !==
        integrationKey
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Недействительный ключ интеграции.",
        },
        {
          status: 401,
        },
      );
    }

    const token =
      requireEnv(
        "TELEGRAM_BOT_TOKEN",
      );

    const baseUrl =
      `https://api.telegram.org/bot${token}`;

    const webhook =
      await telegramRequest<TelegramWebhookResponse>(
        `${baseUrl}/getWebhookInfo`,
      );

    if (!webhook.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            webhook.description ??
            "Telegram не вернул информацию о webhook.",
        },
        {
          status: 502,
        },
      );
    }

    const webhookUrl =
      webhook.result?.url?.trim() ??
      "";

    if (webhookUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "У Telegram-бота включён webhook. getUpdates использовать нельзя.",
          webhookConfigured:
            true,
        },
        {
          status: 409,
        },
      );
    }

    const updates =
      await telegramRequest<TelegramGetUpdatesResponse>(
        `${baseUrl}/getUpdates?limit=100&timeout=0`,
      );

    if (!updates.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            updates.description ??
            "Telegram getUpdates вернул ошибку.",
        },
        {
          status: 502,
        },
      );
    }

    const target =
      [...(updates.result ?? [])]
        .reverse()
        .find((update) => {
          const message =
            update.message;

          if (!message?.text) {
            return false;
          }

          const isGroup =
            message.chat.type ===
              "group" ||
            message.chat.type ===
              "supergroup";

          const isCommand =
            message.text
              .trim()
              .toLowerCase()
              .startsWith(
                "/punkt_media_test",
              );

          return (
            isGroup &&
            isCommand
          );
        });

    if (!target?.message) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Команда /punkt_media_test не найдена в последних обновлениях Telegram.",
          instruction:
            "Отправьте /punkt_media_test@USERNAME_БОТА в нужную группу и повторите запрос.",
        },
        {
          status: 404,
        },
      );
    }

    const chat =
      target.message.chat;

    const body =
      new URLSearchParams();

    body.set(
      "chat_id",
      String(chat.id),
    );

    body.set(
      "text",
      buildTestMessage(),
    );

    const sent =
      await telegramRequest<TelegramSendMessageResponse>(
        `${baseUrl}/sendMessage`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",
          },

          body,
        },
      );

    if (!sent.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            sent.description ??
            "Telegram не подтвердил отправку тестового сообщения.",
        },
        {
          status: 502,
        },
      );
    }

    return NextResponse.json({
      ok: true,

      telegram: {
        chatId:
          String(chat.id),

        chatTitle:
          chat.title ?? null,

        chatType:
          chat.type,

        testMessageId:
          sent.result
            ?.message_id ??
          null,
      },

      message:
        "Тестовое сообщение успешно отправлено существующим ботом БРТ.",
    });
  } catch (error) {
    console.error(
      "PUNKT TELEGRAM MEDIA TEST ERROR:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка.",
      },
      {
        status: 500,
      },
    );
  }
}