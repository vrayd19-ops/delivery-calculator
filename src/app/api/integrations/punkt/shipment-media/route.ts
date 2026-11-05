import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramMessage = {
  message_id: number;
};

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type MediaItem = {
  type: "photo" | "video";
  file: File;
};

type PublicationMetadata = {
  publicationDate: string | null;
  requestNumber: string | null;
  objectName: string | null;
  customerName: string | null;
  managerName: string | null;
  controlName: string | null;
  description: string | null;
  testMode: boolean;
};

const MAX_FILES = 30;

function requireEnv(
  name:
    | "TELEGRAM_BOT_TOKEN"
    | "TELEGRAM_MEDIA_CHAT_ID"
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

function getText(
  formData: FormData,
  name: string,
): string | null {
  const value =
    formData.get(name);

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function getFiles(
  formData: FormData,
  name: string,
): File[] {
  return formData
    .getAll(name)
    .filter(
      (
        value,
      ): value is File =>
        value instanceof File &&
        value.size > 0,
    );
}

function formatPublicationDate(
  raw: string | null,
): string {
  if (
    raw &&
    /^\d{2}\.\d{2}\.\d{2}$/.test(
      raw,
    )
  ) {
    return raw;
  }

  if (raw) {
    const parsed =
      new Date(raw);

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return new Intl.DateTimeFormat(
        "ru-RU",
        {
          timeZone:
            "Europe/Moscow",
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        },
      ).format(parsed);
    }
  }

  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    },
  ).format(new Date());
}

function buildCaption(
  metadata:
    PublicationMetadata,
): string {
  const lines: string[] = [];

  lines.push(
    formatPublicationDate(
      metadata.publicationDate,
    ),
  );

  if (metadata.testMode) {
    lines.push("");
    lines.push(
      "ТЕСТОВАЯ ОТПРАВКА ФОТО И ВИДЕО",
    );
  }

  if (metadata.objectName) {
    lines.push("");
    lines.push(
      `Объект: ${metadata.objectName}`,
    );
  }

  if (metadata.customerName) {
    lines.push(
      `Заказчик: ${metadata.customerName}`,
    );
  }

  if (metadata.managerName) {
    lines.push(
      `Ведет: ${metadata.managerName}`,
    );
  }

  if (metadata.controlName) {
    lines.push(
      `Контроль: ${metadata.controlName}`,
    );
  }

  if (metadata.description) {
    lines.push("");
    lines.push(
      metadata.description,
    );
  }

  if (metadata.testMode) {
    lines.push("");
    lines.push(
      "Ведутся работы по упрощению работы экспедитора, менеджера и логиста 😉",
    );
  }

  return lines.join("\n");
}

function validatePhoto(
  file: File,
): void {
  const allowed =
    new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

  if (
    !allowed.has(file.type)
  ) {
    throw new Error(
      `Формат фотографии ${file.name} пока не поддерживается для Telegram: ${file.type || "неизвестный формат"}.`,
    );
  }
}

function validateVideo(
  file: File,
): void {
  const allowed =
    new Set([
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-m4v",
    ]);

  if (
    !allowed.has(file.type)
  ) {
    throw new Error(
      `Формат видео ${file.name} не поддерживается: ${file.type || "неизвестный формат"}.`,
    );
  }
}

async function telegramFetch<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        ...init,
        cache: "no-store",

        signal:
          AbortSignal.timeout(
            120000,
          ),
      },
    );

  let data:
    TelegramResponse<T>;

  try {
    data =
      (await response.json()) as
        TelegramResponse<T>;
  } catch {
    throw new Error(
      `Telegram вернул некорректный ответ. HTTP ${response.status}.`,
    );
  }

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.description ??
        `Telegram HTTP ${response.status}.`,
    );
  }

  if (
    data.result === undefined
  ) {
    throw new Error(
      "Telegram не вернул результат отправки.",
    );
  }

  return data.result;
}

async function sendSingleMedia({
  token,
  chatId,
  item,
  caption,
}: {
  token: string;
  chatId: string;
  item: MediaItem;
  caption?: string;
}): Promise<number[]> {
  const body =
    new FormData();

  body.set(
    "chat_id",
    chatId,
  );

  if (caption) {
    body.set(
      "caption",
      caption,
    );
  }

  if (
    item.type === "photo"
  ) {
    body.set(
      "photo",
      item.file,
      item.file.name,
    );

    const result =
      await telegramFetch<TelegramMessage>(
        `https://api.telegram.org/bot${token}/sendPhoto`,
        {
          method: "POST",
          body,
        },
      );

    return [
      result.message_id,
    ];
  }

  body.set(
    "video",
    item.file,
    item.file.name,
  );

  body.set(
    "supports_streaming",
    "true",
  );

  const result =
    await telegramFetch<TelegramMessage>(
      `https://api.telegram.org/bot${token}/sendVideo`,
      {
        method: "POST",
        body,
      },
    );

  return [
    result.message_id,
  ];
}

async function sendAlbum({
  token,
  chatId,
  items,
  caption,
}: {
  token: string;
  chatId: string;
  items: MediaItem[];
  caption?: string;
}): Promise<number[]> {
  if (
    items.length === 1
  ) {
    return sendSingleMedia({
      token,
      chatId,
      item: items[0],
      caption,
    });
  }

  const body =
    new FormData();

  body.set(
    "chat_id",
    chatId,
  );

  const media =
    items.map(
      (
        item,
        index,
      ) => {
        const attachmentName =
          `media_${index}`;

        body.append(
          attachmentName,
          item.file,
          item.file.name,
        );

        const entry: {
          type: "photo" | "video";
          media: string;
          caption?: string;
          supports_streaming?: boolean;
        } = {
          type:
            item.type,

          media:
            `attach://${attachmentName}`,
        };

        if (
          index === 0 &&
          caption
        ) {
          entry.caption =
            caption;
        }

        if (
          item.type ===
          "video"
        ) {
          entry.supports_streaming =
            true;
        }

        return entry;
      },
    );

  body.set(
    "media",
    JSON.stringify(media),
  );

  const result =
    await telegramFetch<
      TelegramMessage[]
    >(
      `https://api.telegram.org/bot${token}/sendMediaGroup`,
      {
        method: "POST",
        body,
      },
    );

  return result.map(
    (message) =>
      message.message_id,
  );
}

function chunkMedia(
  items: MediaItem[],
): MediaItem[][] {
  const chunks:
    MediaItem[][] = [];

  for (
    let index = 0;
    index < items.length;
    index += 10
  ) {
    chunks.push(
      items.slice(
        index,
        index + 10,
      ),
    );
  }

  return chunks;
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

    const chatId =
      requireEnv(
        "TELEGRAM_MEDIA_CHAT_ID",
      );

    const formData =
      await request.formData();

    const loadingPhotos =
      getFiles(
        formData,
        "loadingPhotos",
      );

    const materialPhotos =
      getFiles(
        formData,
        "materialPhotos",
      );

    const unloadingPhotos =
      getFiles(
        formData,
        "unloadingPhotos",
      );

    const unloadingVideos =
      getFiles(
        formData,
        "unloadingVideos",
      );

    /*
     * ВАЖНО:
     *
     * Документы намеренно не считываются
     * из formData вообще.
     *
     * LOADING_DOCUMENT и
     * UNLOADING_DOCUMENT
     * никогда не попадают в Telegram
     * через этот endpoint.
     */

    const photoFiles = [
      ...loadingPhotos,
      ...materialPhotos,
      ...unloadingPhotos,
    ];

    for (
      const file of photoFiles
    ) {
      validatePhoto(file);
    }

    for (
      const file of unloadingVideos
    ) {
      validateVideo(file);
    }

    const mediaItems:
      MediaItem[] = [
        ...loadingPhotos.map(
          (file) => ({
            type:
              "photo" as const,
            file,
          }),
        ),

        ...materialPhotos.map(
          (file) => ({
            type:
              "photo" as const,
            file,
          }),
        ),

        ...unloadingPhotos.map(
          (file) => ({
            type:
              "photo" as const,
            file,
          }),
        ),

        ...unloadingVideos.map(
          (file) => ({
            type:
              "video" as const,
            file,
          }),
        ),
      ];

    if (
      mediaItems.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Нет фото или видео для публикации.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      mediaItems.length >
      MAX_FILES
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Слишком много файлов. Максимум: ${MAX_FILES}.`,
        },
        {
          status: 400,
        },
      );
    }

    const metadata:
      PublicationMetadata = {
        publicationDate:
          getText(
            formData,
            "publicationDate",
          ),

        requestNumber:
          getText(
            formData,
            "requestNumber",
          ),

        objectName:
          getText(
            formData,
            "objectName",
          ),

        customerName:
          getText(
            formData,
            "customerName",
          ),

        managerName:
          getText(
            formData,
            "managerName",
          ),

        controlName:
          getText(
            formData,
            "controlName",
          ),

        description:
          getText(
            formData,
            "description",
          ),

        testMode:
          getText(
            formData,
            "testMode",
          ) === "true",
      };

    const caption =
      buildCaption(
        metadata,
      );

    const chunks =
      chunkMedia(
        mediaItems,
      );

    const messageIds:
      number[] = [];

    for (
      let index = 0;
      index < chunks.length;
      index += 1
    ) {
      const ids =
        await sendAlbum({
          token,
          chatId,

          items:
            chunks[index],

          caption:
            index === 0
              ? caption
              : undefined,
        });

      messageIds.push(
        ...ids,
      );
    }

    return NextResponse.json({
      ok: true,

      publication: {
        requestNumber:
          metadata.requestNumber,

        loadingPhotos:
          loadingPhotos.length,

        materialPhotos:
          materialPhotos.length,

        unloadingPhotos:
          unloadingPhotos.length,

        unloadingVideos:
          unloadingVideos.length,

        totalMedia:
          mediaItems.length,

        messageIds,
      },

      documentsIncluded:
        false,
    });
  } catch (error) {
    console.error(
      "PUNKT SHIPMENT MEDIA TELEGRAM ERROR:",
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