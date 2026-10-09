'use client';

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react';

import styles from './PowersOfAttorney.module.css';

type ParsedData = {
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: string;
  driverFullName: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssueDate: string;
};

const emptyData: ParsedData = {
  supplier: '',
  invoiceNumber: '',
  invoiceDate: '',
  invoiceAmount: '',
  driverFullName: '',
  passportSeries: '',
  passportNumber: '',
  passportIssuedBy: '',
  passportIssueDate: '',
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} КБ`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function FileCard({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  return (
    <div className={styles.fileCard}>
      <div className={styles.filePreview}>
        {file.type === 'application/pdf' ? 'PDF' : 'IMG'}
      </div>

      <div className={styles.fileInfo}>
        <div className={styles.fileName}>
          {file.name}
        </div>

        <div className={styles.fileMeta}>
          <span>
            {file.type === 'application/pdf' ? 'PDF' : 'Изображение'}
          </span>
          <span>•</span>
          <span>{formatFileSize(file.size)}</span>
        </div>
      </div>

      <div className={styles.fileActions}>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={onRemove}
        >
          Удалить
        </button>
      </div>
    </div>
  );
}

function UploadBox({
  title,
  description,
  file,
  onFile,
  onRemove,
}: {
  title: string;
  description: string;
  file: File | null;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];

    if (selected) {
      onFile(selected);
    }

    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActive(false);

    const dropped = event.dataTransfer.files?.[0];

    if (dropped) {
      onFile(dropped);
    }
  };

  if (file) {
    return (
      <FileCard
        file={file}
        onRemove={onRemove}
      />
    );
  }

  return (
    <div
      className={`${styles.dropZone} ${
        active ? styles.dropZoneActive : ''
      }`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setActive(false);
      }}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className={styles.hiddenFileInput}
        onChange={handleInput}
      />

      <div className={styles.uploadIcon}>
        ↑
      </div>

      <strong>
        {title}
      </strong>

      <span>
        {description}
      </span>

      <small>
        PDF, JPG или PNG • до 10 МБ
      </small>
    </div>
  );
}

export default function PowersOfAttorneyForm() {
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);

  const [data, setData] = useState<ParsedData>(emptyData);

  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const update = (field: keyof ParsedData, value: string) => {
    setData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const validateFile = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Можно загрузить только PDF, JPG или PNG.');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Размер файла не должен превышать 10 МБ.');
      return false;
    }

    setError('');
    return true;
  };

  const handleInvoiceFile = (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    setInvoiceFile(file);
    setSuccess('');
  };

  const handlePassportFile = (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    setPassportFile(file);
    setSuccess('');
  };

  const parseDocuments = async () => {
    setError('');
    setSuccess('');

    if (!invoiceFile) {
      setError('Сначала загрузите счёт поставщика.');
      return;
    }

    if (!passportFile) {
      setError('Сначала загрузите паспорт водителя.');
      return;
    }

    setIsParsing(true);

    try {
      const formData = new FormData();

      formData.append('invoice', invoiceFile);
      formData.append('passport', passportFile);

      const response = await fetch(
        '/api/powers-of-attorney/parse',
        {
          method: 'POST',
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || 'Не удалось распознать документы.',
        );
      }

      setData({
        ...emptyData,
        ...result.data,
      });

      setSuccess(
        'Документы распознаны. Проверьте данные перед созданием доверенности.',
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось распознать документы.',
      );
    } finally {
      setIsParsing(false);
    }
  };

  const generateDocuments = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!data.supplier) {
      setError('Не указана организация из счёта.');
      return;
    }

    if (!data.driverFullName) {
      setError('Не указано ФИО водителя.');
      return;
    }

    if (!data.passportSeries || !data.passportNumber) {
      setError('Не заполнены серия и номер паспорта.');
      return;
    }

    setIsGenerating(true);

    try {
      const normalizedSupplier = data.supplier
        .toLowerCase()
        .replaceAll('ё', 'е');

      const needCoverLetter =
        normalizedSupplier.includes('металлсервис-москва') ||
        normalizedSupplier.includes('металлсервис москва');

      const response = await fetch(
        '/api/powers-of-attorney/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            needCoverLetter,
          }),
        },
      );

      if (response.status === 404) {
        setSuccess(
          needCoverLetter
            ? 'Данные проверены. Для ООО «Металлсервис-Москва» будут сформированы доверенность и сопроводительное письмо. Серверный генератор документов ещё не подключён.'
            : 'Данные проверены. Генератор доверенности ещё не подключён.',
        );

        return;
      }

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || 'Не удалось создать документы.',
        );
      }

      if (result.downloadUrl) {
        window.location.href = result.downloadUrl;
        return;
      }

      setSuccess(
        needCoverLetter
          ? 'Доверенность и сопроводительное письмо сформированы.'
          : 'Доверенность сформирована.',
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось создать документы.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const normalizedSupplier = data.supplier
    .toLowerCase()
    .replaceAll('ё', 'е');

  const needCoverLetter =
    normalizedSupplier.includes('металлсервис-москва') ||
    normalizedSupplier.includes('металлсервис москва');

  return (
    <form
      className={styles.form}
      onSubmit={generateDocuments}
    >
      <div className={styles.uploadGrid}>
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionNumber}>
              1
            </div>

            <div>
              <h2 className={styles.sectionTitle}>
                Счёт поставщика
              </h2>

              <p className={styles.sectionDescription}>
                Загрузите счёт. Организация, номер,
                дата и сумма будут распознаны автоматически.
              </p>
            </div>
          </div>

          <UploadBox
            title="Загрузить счёт"
            description="Перетащите файл сюда или нажмите для выбора"
            file={invoiceFile}
            onFile={handleInvoiceFile}
            onRemove={() => {
              setInvoiceFile(null);
              setSuccess('');
            }}
          />
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionNumber}>
              2
            </div>

            <div>
              <h2 className={styles.sectionTitle}>
                Паспорт водителя
              </h2>

              <p className={styles.sectionDescription}>
                Загрузите страницу паспорта с паспортными данными.
              </p>
            </div>
          </div>

          <UploadBox
            title="Загрузить паспорт"
            description="Перетащите файл сюда или нажмите для выбора"
            file={passportFile}
            onFile={handlePassportFile}
            onRemove={() => {
              setPassportFile(null);
              setSuccess('');
            }}
          />
        </section>
      </div>

      <section className={`${styles.card} ${styles.reviewCard}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionNumber}>
            3
          </div>

          <div>
            <h2 className={styles.sectionTitle}>
              Данные документов
            </h2>

            <p className={styles.sectionDescription}>
              После распознавания обязательно проверьте данные.
              Их можно исправить вручную.
            </p>
          </div>
        </div>

        <button
          type="button"
          className={styles.submitButton}
          onClick={parseDocuments}
          disabled={
            isParsing ||
            !invoiceFile ||
            !passportFile
          }
        >
          {isParsing
            ? 'Распознаваем документы…'
            : 'Распознать документы'}
        </button>

        <div className={styles.divider} />

        <h3 className={styles.subheading}>
          Данные счёта
        </h3>

        <div className={styles.twoColumns}>
          <div className={styles.field}>
            <label className={styles.label}>
              Организация
            </label>

            <input
              className={styles.input}
              value={data.supplier}
              onChange={(event) =>
                update('supplier', event.target.value)
              }
              placeholder="ООО «...»"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Номер счёта
            </label>

            <input
              className={styles.input}
              value={data.invoiceNumber}
              onChange={(event) =>
                update('invoiceNumber', event.target.value)
              }
              placeholder="№ счёта"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Дата счёта
            </label>

            <input
              className={styles.input}
              value={data.invoiceDate}
              onChange={(event) =>
                update('invoiceDate', event.target.value)
              }
              placeholder="Дата счёта"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Сумма счёта
            </label>

            <input
              className={styles.input}
              value={data.invoiceAmount}
              onChange={(event) =>
                update('invoiceAmount', event.target.value)
              }
              placeholder="0,00 ₽"
            />
          </div>
        </div>

        <div className={styles.divider} />

        <h3 className={styles.subheading}>
          Данные водителя
        </h3>

        <div className={styles.field}>
          <label className={styles.label}>
            ФИО водителя
            <span className={styles.required}>
              *
            </span>
          </label>

          <input
            className={styles.input}
            value={data.driverFullName}
            onChange={(event) =>
              update('driverFullName', event.target.value)
            }
            placeholder="Фамилия Имя Отчество"
          />
        </div>

        <div className={styles.passportGrid}>
          <div className={styles.field}>
            <label className={styles.label}>
              Серия паспорта
              <span className={styles.required}>
                *
              </span>
            </label>

            <input
              className={styles.input}
              value={data.passportSeries}
              onChange={(event) =>
                update('passportSeries', event.target.value)
              }
              placeholder="0000"
              maxLength={4}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Номер паспорта
              <span className={styles.required}>
                *
              </span>
            </label>

            <input
              className={styles.input}
              value={data.passportNumber}
              onChange={(event) =>
                update('passportNumber', event.target.value)
              }
              placeholder="000000"
              maxLength={6}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Дата выдачи
            </label>

            <input
              className={styles.input}
              value={data.passportIssueDate}
              onChange={(event) =>
                update('passportIssueDate', event.target.value)
              }
              placeholder="Дата выдачи"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Кем выдан паспорт
          </label>

          <input
            className={styles.input}
            value={data.passportIssuedBy}
            onChange={(event) =>
              update('passportIssuedBy', event.target.value)
            }
            placeholder="Наименование органа"
          />
        </div>
      </section>

      {needCoverLetter && (
        <div className={styles.documentRule}>
          <div className={styles.documentRuleIcon}>
            ✓
          </div>

          <div>
            <strong>
              ООО «Металлсервис-Москва»
            </strong>

            <span>
              Для этой организации будут подготовлены
              доверенность и сопроводительное письмо.
            </span>
          </div>
        </div>
      )}

      {error && (
        <div
          className={styles.documentRule}
          role="alert"
        >
          <div className={styles.documentRuleIcon}>
            !
          </div>

          <div>
            <strong>
              Ошибка
            </strong>

            <span>
              {error}
            </span>
          </div>
        </div>
      )}

      {success && (
        <div className={styles.documentRule}>
          <div className={styles.documentRuleIcon}>
            ✓
          </div>

          <div>
            <strong>
              Готово
            </strong>

            <span>
              {success}
            </span>
          </div>
        </div>
      )}

      <div className={styles.submitArea}>
        <div className={styles.submitNote}>
          После проверки данных нажмите кнопку создания
          документов. Перед использованием доверенности
          проверьте ФИО и паспортные данные.
        </div>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={
            isGenerating ||
            !data.supplier ||
            !data.driverFullName ||
            !data.passportSeries ||
            !data.passportNumber
          }
        >
          {isGenerating
            ? 'Подготавливаем…'
            : needCoverLetter
              ? 'Создать доверенность и письмо'
              : 'Создать доверенность'}
        </button>
      </div>
    </form>
  );
}