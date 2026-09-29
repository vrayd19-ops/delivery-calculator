'use client';

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Check,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  RotateCcw,
  Send,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

import styles
  from './TransportRequest.module.css';


type VehicleOption = {
  id:
    string;

  name:
    string;
};


type Props = {
  vehicles:
    VehicleOption[];

  defaultManagerEmail:
    string;
};


type FieldErrors =
  Record<
    string,
    string
  >;


type FormValues = {
  managerEmail:
    string;

  customer:
    string;

  loadingDate:
    string;

  desiredPickupTime:
    string;

  preferredVehicleTypeId:
    string;

  totalWeight:
    string;

  cargoLength:
    string;

  needsStakes:
    '' |
    'yes' |
    'no';

  logisticsFitCheck:
    boolean;

  loadingAddress:
    string;

  loadingMapUrl:
    string;

  loadingContactName:
    string;

  loadingContactPhone:
    string;

  loadingUntil:
    string;

  unloadingAddress:
    string;

  unloadingMapUrl:
    string;

  unloadingContactName:
    string;

  unloadingContactPhone:
    string;

  unloadingUntil:
    string;

  comment:
    string;
};


const MAX_FILE_SIZE =
  4 * 1024 * 1024;


const ALLOWED_TYPES =
  [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];


function todayInputValue() {
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset();

  const local =
    new Date(
      now.getTime() -
      offset *
      60 *
      1000
    );

  return local
    .toISOString()
    .slice(
      0,
      10
    );
}


function formatFileSize(
  bytes:
    number
) {
  if (
    bytes <
    1024
  ) {
    return `${bytes} Б`;
  }

  if (
    bytes <
    1024 *
      1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(
      1
    )} КБ`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(
    1
  )} МБ`;
}


function parseDecimal(
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


function isValidEmail(
  value:
    string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim()
  );
}


function isValidYandexUrl(
  value:
    string
) {
  if (!value.trim()) {
    return true;
  }

  try {
    const url =
      new URL(
        value.trim()
      );

    const host =
      url.hostname
        .toLowerCase();

    return (
      host ===
        'yandex.ru' ||
      host.endsWith(
        '.yandex.ru'
      ) ||
      host ===
        'yandex.com' ||
      host.endsWith(
        '.yandex.com'
      ) ||
      host ===
        'yandex.by' ||
      host.endsWith(
        '.yandex.by'
      ) ||
      host ===
        'yandex.kz' ||
      host.endsWith(
        '.yandex.kz'
      ) ||
      host ===
        'yandex.uz' ||
      host.endsWith(
        '.yandex.uz'
      ) ||
      host ===
        'yandex.app.link' ||
      host.endsWith(
        '.yandex.app.link'
      )
    );
  } catch {
    return false;
  }
}


function fieldClass(
  error?:
    string
) {
  return error
    ? `${styles.input} ${styles.inputError}`
    : styles.input;
}


export default function TransportRequestForm({
  vehicles,
  defaultManagerEmail,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );


  const [
    values,
    setValues,
  ] =
    useState<FormValues>({
      managerEmail:
        defaultManagerEmail,

      customer:
        '',

      loadingDate:
        '',

      desiredPickupTime:
        '',

      preferredVehicleTypeId:
        '',

      totalWeight:
        '',

      cargoLength:
        '',

      needsStakes:
        '',

      logisticsFitCheck:
        false,

      loadingAddress:
        '',

      loadingMapUrl:
        '',

      loadingContactName:
        '',

      loadingContactPhone:
        '',

      loadingUntil:
        '',

      unloadingAddress:
        '',

      unloadingMapUrl:
        '',

      unloadingContactName:
        '',

      unloadingContactPhone:
        '',

      unloadingUntil:
        '',

      comment:
        '',
    });


  const [
    invoiceFiles,
    setInvoiceFiles,
  ] =
    useState<File[]>(
      []
    );


  const [
    isDragging,
    setIsDragging,
  ] =
    useState(
      false
    );


  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false
    );


  const [
    fieldErrors,
    setFieldErrors,
  ] =
    useState<FieldErrors>(
      {}
    );


  const [
    serverError,
    setServerError,
  ] =
    useState(
      ''
    );


  const [
    successNumber,
    setSuccessNumber,
  ] =
    useState(
      ''
    );


  const [
    showMissingFieldsModal,
    setShowMissingFieldsModal,
  ] =
    useState(
      false
    );


  const today =
    useMemo(
      () =>
        todayInputValue(),
      []
    );


  const selectedVehicleName =
    useMemo(
      () =>
        vehicles.find(
          (
            vehicle
          ) =>
            vehicle.id ===
            values
              .preferredVehicleTypeId
        )?.name ||
        'Подобрать логисту',
      [
        vehicles,
        values
          .preferredVehicleTypeId,
      ]
    );



  function clearFieldError(
    name:
      string
  ) {
    setFieldErrors(
      (
        current
      ) => {
        if (
          !current[
            name
          ]
        ) {
          return current;
        }

        const next = {
          ...current,
        };

        delete next[
          name
        ];

        return next;
      }
    );
  }


  function updateValue(
    name:
      keyof FormValues,

    value:
      string |
      boolean
  ) {
    setValues(
      (
        current
      ) => ({
        ...current,

        [name]:
          value,
      })
    );

    clearFieldError(
      name
    );

    setServerError(
      ''
    );
  }


  function validateFile(
    file:
      File
  ) {
    if (
      !ALLOWED_TYPES.includes(
        file.type
      )
    ) {
      return 'Допустимы только PDF, JPG, JPEG, PNG или WEBP.';
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return 'Для отправки через текущий сервер размер файла не должен превышать 4 МБ.';
    }

    if (
      file.size <=
      0
    ) {
      return 'Файл пустой. Выберите другой файл.';
    }

    return '';
  }


  function chooseFiles(
    files: File[]
  ) {
    if (
      files.length ===
      0
    ) {
      return;
    }

    const nextFiles = [
      ...invoiceFiles,
    ];

    for (const file of files) {
      const validationMessage =
        validateFile(
          file
        );

      if (validationMessage) {
        setFieldErrors(
          (current) => ({
            ...current,
            invoiceFile:
              validationMessage,
          })
        );
        continue;
      }

      const duplicate =
        nextFiles.some(
          (existing) =>
            existing.name ===
              file.name &&
            existing.size ===
              file.size &&
            existing.lastModified ===
              file.lastModified
        );

      if (!duplicate) {
        nextFiles.push(
          file
        );
      }
    }

    if (
      nextFiles.length >
      10
    ) {
      setFieldErrors(
        (current) => ({
          ...current,
          invoiceFile:
            'Можно прикрепить не более 10 счетов за одну заявку.',
        })
      );

      setInvoiceFiles(
        nextFiles.slice(
          0,
          10
        )
      );
    } else {
      setInvoiceFiles(
        nextFiles
      );

      clearFieldError(
        'invoiceFile'
      );
    }

    setServerError(
      ''
    );
  }


  function handleFileInput(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    chooseFiles(
      Array.from(
        event.target.files ||
        []
      )
    );

    event.target.value = '';
  }


  function handleDrop(
    event:
      DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    setIsDragging(
      false
    );

    chooseFiles(
      Array.from(
        event.dataTransfer.files
      )
    );
  }


  function removeFile(
    index: number
  ) {
    setInvoiceFiles(
      (current) =>
        current.filter(
          (_, currentIndex) =>
            currentIndex !==
            index
        )
    );

    clearFieldError(
      'invoiceFile'
    );
  }



  function validateForm() {
    const errors:
      FieldErrors = {};


    if (
      !values.managerEmail
        .trim()
    ) {
      errors.managerEmail =
        'Укажите почту менеджера.';
    } else if (
      !isValidEmail(
        values.managerEmail
      )
    ) {
      errors.managerEmail =
        'Укажите корректный email менеджера.';
    }


    if (
      !values.customer
        .trim()
    ) {
      errors.customer =
        'Укажите заказчика.';
    }


    if (
      !values.loadingDate
    ) {
      errors.loadingDate =
        'Укажите дату погрузки.';
    } else if (
      values.loadingDate <
      today
    ) {
      errors.loadingDate =
        'Дата погрузки не может быть раньше сегодняшнего дня.';
    }


    const weight =
      parseDecimal(
        values.totalWeight
      );

    if (
      !Number.isFinite(
        weight
      ) ||
      weight <=
        0
    ) {
      errors.totalWeight =
        'Укажите общий тоннаж больше 0.';
    }


    const cargoLength =
      parseDecimal(
        values.cargoLength
      );

    if (
      !Number.isFinite(
        cargoLength
      ) ||
      cargoLength <=
        0
    ) {
      errors.cargoLength =
        'Укажите максимальную длину груза больше 0.';
    }


    if (
      !values.needsStakes
    ) {
      errors.needsStakes =
        'Укажите, нужны ли коники.';
    }


    if (
      !values.loadingAddress
        .trim() &&
      !values.loadingMapUrl
        .trim()
    ) {
      errors.loadingAddress =
        'Укажите точный адрес погрузки или ссылку на Яндекс Карты.';

      errors.loadingMapUrl =
        errors.loadingAddress;
    }


    if (
      values.loadingMapUrl &&
      !isValidYandexUrl(
        values.loadingMapUrl
      )
    ) {
      errors.loadingMapUrl =
        'Укажите корректную ссылку на Яндекс Карты.';
    }


    if (
      !values
        .loadingContactName
        .trim()
    ) {
      errors.loadingContactName =
        'Укажите имя контактного лица.';
    }


    if (
      !values
        .loadingContactPhone
        .trim()
    ) {
      errors.loadingContactPhone =
        'Укажите телефон на погрузке.';
    }


    if (
      !values.loadingUntil
    ) {
      errors.loadingUntil =
        'Укажите, до скольки работает погрузка.';
    }


    if (
      !values.unloadingAddress
        .trim() &&
      !values.unloadingMapUrl
        .trim()
    ) {
      errors.unloadingAddress =
        'Укажите точный адрес выгрузки или ссылку на Яндекс Карты.';

      errors.unloadingMapUrl =
        errors.unloadingAddress;
    }


    if (
      values.unloadingMapUrl &&
      !isValidYandexUrl(
        values.unloadingMapUrl
      )
    ) {
      errors.unloadingMapUrl =
        'Укажите корректную ссылку на Яндекс Карты.';
    }


    if (
      !values
        .unloadingContactName
        .trim()
    ) {
      errors.unloadingContactName =
        'Укажите имя контактного лица.';
    }


    if (
      !values
        .unloadingContactPhone
        .trim()
    ) {
      errors.unloadingContactPhone =
        'Укажите телефон на выгрузке.';
    }


    if (
      !values.unloadingUntil
    ) {
      errors.unloadingUntil =
        'Укажите, до скольки принимают на объекте.';
    }


    if (
      invoiceFiles.length ===
      0
    ) {
      errors.invoiceFile =
        'Прикрепите хотя бы один счёт.';
    }


    setFieldErrors(
      errors
    );


    const firstError =
      Object.keys(
        errors
      )[0];


    if (firstError) {
      setShowMissingFieldsModal(
        true
      );

      window.setTimeout(
        () => {
          const element =
            document.querySelector(
              `[data-field="${firstError}"]`
            );

          element?.scrollIntoView({
            behavior:
              'smooth',

            block:
              'center',
          });
        },
        50
      );
    }


    return (
      Object.keys(
        errors
      ).length ===
      0
    );
  }


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();


    if (
      submitting
    ) {
      return;
    }


    setServerError(
      ''
    );


    if (
      !validateForm()
    ) {
      return;
    }


    if (
      invoiceFiles.length ===
      0
    ) {
      setShowMissingFieldsModal(
        true
      );

      return;
    }


    setSubmitting(
      true
    );


    try {
      const formData =
        new FormData();


      formData.set(
        'managerEmail',
        values.managerEmail.trim()
      );


      formData.set(
        'customer',
        values.customer.trim()
      );


      formData.set(
        'loadingDate',
        values.loadingDate
      );


      formData.set(
        'desiredPickupTime',
        values.desiredPickupTime
      );


      formData.set(
        'preferredVehicleTypeId',
        values
          .preferredVehicleTypeId
      );


      formData.set(
        'totalWeight',
        values.totalWeight
      );


      formData.set(
        'cargoLength',
        values.cargoLength
      );


      formData.set(
        'needsStakes',
        values.needsStakes
      );


      formData.set(
        'logisticsFitCheck',
        values.logisticsFitCheck
          ? 'yes'
          : 'no'
      );


      formData.set(
        'loadingAddress',
        values.loadingAddress.trim()
      );


      formData.set(
        'loadingMapUrl',
        values.loadingMapUrl.trim()
      );


      formData.set(
        'loadingContactName',
        values
          .loadingContactName
          .trim()
      );


      formData.set(
        'loadingContactPhone',
        values
          .loadingContactPhone
          .trim()
      );


      formData.set(
        'loadingUntil',
        values.loadingUntil
      );


      formData.set(
        'unloadingAddress',
        values
          .unloadingAddress
          .trim()
      );


      formData.set(
        'unloadingMapUrl',
        values
          .unloadingMapUrl
          .trim()
      );


      formData.set(
        'unloadingContactName',
        values
          .unloadingContactName
          .trim()
      );


      formData.set(
        'unloadingContactPhone',
        values
          .unloadingContactPhone
          .trim()
      );


      formData.set(
        'unloadingUntil',
        values.unloadingUntil
      );


      formData.set(
        'comment',
        values.comment.trim()
      );


      formData.set(
        'website',
        ''
      );


      for (const invoiceFile of invoiceFiles) {
        formData.append(
          'invoiceFile',
          invoiceFile,
          invoiceFile.name
        );
      }


      const response =
        await fetch(
          '/api/transport-request',
          {
            method:
              'POST',

            body:
              formData,
          }
        );


      const result =
        await response.json();


      if (
        response.status ===
        401
      ) {
        window.location.href =
          '/login';

        return;
      }


      if (
        !response.ok ||
        !result.success
      ) {
        if (
          result.fieldErrors &&
          typeof result.fieldErrors ===
            'object'
        ) {
          setFieldErrors(
            result.fieldErrors
          );

          if (
            Object.keys(
              result.fieldErrors
            ).length >
            0
          ) {
            setShowMissingFieldsModal(
              true
            );
          }
        }


        setServerError(
          result.message ||
          'Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз.'
        );

        return;
      }


      setSuccessNumber(
        result.requestNumber
      );
    } catch (
      error
    ) {
      console.error(
        'TRANSPORT REQUEST CLIENT ERROR:',
        error
      );


      setServerError(
        'Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.'
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }


  if (
    successNumber
  ) {
    return (
      <div
        className={
          styles.successCard
        }
      >

        <div
          className={
            styles.successIcon
          }
        >
          <Check
            size={
              30
            }
          />
        </div>


        <div
          className={
            styles.successEyebrow
          }
        >
          Готово
        </div>


        <h2
          className={
            styles.successTitle
          }
        >
          Заявка отправлена
        </h2>


        <p
          className={
            styles.successText
          }
        >
          Информация передана
          ответственному менеджеру.
        </p>


        <div
          className={
            styles.successNumber
          }
        >
          {successNumber}
        </div>


        <button
          type="button"
          className={
            styles.secondaryButton
          }
          onClick={
            () => {
              setSuccessNumber(
                ''
              );

              setInvoiceFiles(
                []
              );

              setValues({
                managerEmail:
                  defaultManagerEmail,

                customer:
                  '',

                loadingDate:
                  '',

                desiredPickupTime:
                  '',

                preferredVehicleTypeId:
                  '',

                totalWeight:
                  '',

                cargoLength:
                  '',

                needsStakes:
                  '',

                logisticsFitCheck:
                  false,

                loadingAddress:
                  '',

                loadingMapUrl:
                  '',

                loadingContactName:
                  '',

                loadingContactPhone:
                  '',

                loadingUntil:
                  '',

                unloadingAddress:
                  '',

                unloadingMapUrl:
                  '',

                unloadingContactName:
                  '',

                unloadingContactPhone:
                  '',

                unloadingUntil:
                  '',

                comment:
                  '',
              });

              setFieldErrors(
                {}
              );

              setServerError(
                ''
              );

              setShowMissingFieldsModal(
                false
              );
            }
          }
        >
          <RotateCcw
            size={
              16
            }
          />

          Создать ещё одну заявку
        </button>

      </div>
    );
  }


  return (
    <>
      {showMissingFieldsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Не все поля заполнены"
          onClick={
            () =>
              setShowMissingFieldsModal(
                false
              )
          }
          style={{
            position:
              'fixed',

            inset:
              0,

            zIndex:
              99999,

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            padding:
              20,

            background:
              'rgba(35, 29, 26, 0.42)',

            backdropFilter:
              'blur(3px)',
          }}
        >
          <div
            onClick={
              (
                event
              ) =>
                event
                  .stopPropagation()
            }
            style={{
              position:
                'relative',

              width:
                'min(92vw, 460px)',

              padding:
                '34px 30px 28px',

              border:
                '1px solid #e1d7d1',

              borderRadius:
                18,

              background:
                '#ffffff',

              boxShadow:
                '0 24px 70px rgba(50, 38, 31, 0.24)',

              textAlign:
                'center',
            }}
          >
            <button
              type="button"
              aria-label="Закрыть уведомление"
              onClick={
                () =>
                  setShowMissingFieldsModal(
                    false
                  )
              }
              style={{
                position:
                  'absolute',

                top:
                  12,

                right:
                  12,

                display:
                  'flex',

                width:
                  34,

                height:
                  34,

                alignItems:
                  'center',

                justifyContent:
                  'center',

                border:
                  '1px solid #e4dcd7',

                borderRadius:
                  9,

                background:
                  '#faf8f6',

                color:
                  '#74665e',

                cursor:
                  'pointer',
              }}
            >
              <X
                size={
                  17
                }
              />
            </button>


            <div
              style={{
                display:
                  'flex',

                width:
                  52,

                height:
                  52,

                alignItems:
                  'center',

                justifyContent:
                  'center',

                margin:
                  '0 auto 18px',

                borderRadius:
                  16,

                background:
                  '#756055',

                color:
                  '#ffffff',

                fontSize:
                  26,

                fontWeight:
                  800,
              }}
            >
              !
            </div>


            <div
              style={{
                marginBottom:
                  9,

                color:
                  '#2d2825',

                fontSize:
                  22,

                fontWeight:
                  800,

                lineHeight:
                  1.25,
              }}
            >
              читай внимательно и заполняй все пункты
            </div>


            <div
              style={{
                marginBottom:
                  22,

                color:
                  '#827872',

                fontSize:
                  12,

                lineHeight:
                  1.55,
              }}
            >
              В заявке остались
              незаполненные обязательные
              поля. Они отмечены ниже.
            </div>


            <button
              type="button"
              onClick={
                () =>
                  setShowMissingFieldsModal(
                    false
                  )
              }
              style={{
                minWidth:
                  145,

                minHeight:
                  43,

                padding:
                  '0 20px',

                border:
                  0,

                borderRadius:
                  10,

                background:
                  '#756055',

                color:
                  '#ffffff',

                fontFamily:
                  'inherit',

                fontSize:
                  12,

                fontWeight:
                  750,

                cursor:
                  'pointer',
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}


      <form
        className={
          styles.form
        }
        onSubmit={
          handleSubmit
        }
        noValidate
      >

        <section
          className={
            styles.card
          }
        >

          <div
            className={
              styles.sectionHeader
            }
          >

            <div
              className={
                styles.sectionNumber
              }
            >
              1
            </div>

            <div>

              <h2
                className={
                  styles.sectionTitle
                }
              >
                Общая информация
              </h2>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Кто создаёт заявку
                и когда требуется
                транспорт.
              </p>

            </div>

          </div>


          <div
            className={
              styles.twoColumns
            }
          >

            <div
              className={
                styles.field
              }
              data-field="managerEmail"
            >

              <label
                className={
                  styles.label
                }
              >
                Почта менеджера
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <input
                type="email"
                className={
                  fieldClass(
                    fieldErrors
                      .managerEmail
                  )
                }
                value={
                  values.managerEmail
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'managerEmail',
                      event.target.value
                    )
                }
                placeholder="manager@company.ru"
                autoComplete="email"
              />

              {fieldErrors.managerEmail && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .managerEmail
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.field
              }
              data-field="customer"
            >

              <label
                className={
                  styles.label
                }
              >
                Заказчик
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <input
                type="text"
                className={
                  fieldClass(
                    fieldErrors
                      .customer
                  )
                }
                value={
                  values.customer
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'customer',
                      event.target.value
                    )
                }
                placeholder={'ООО "Организация"'}
                autoComplete="organization"
              />

              {fieldErrors.customer && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .customer
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.field
              }
              data-field="loadingDate"
            >

              <label
                className={
                  styles.label
                }
              >
                Дата погрузки
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <input
                type="date"
                min={
                  today
                }
                className={
                  fieldClass(
                    fieldErrors
                      .loadingDate
                  )
                }
                value={
                  values.loadingDate
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'loadingDate',
                      event.target.value
                    )
                }
              />

              {fieldErrors.loadingDate && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .loadingDate
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.field
              }
            >

              <label
                className={
                  styles.label
                }
              >
                Желаемое время подачи машины
              </label>

              <input
                type="time"
                className={
                  styles.input
                }
                value={
                  values.desiredPickupTime
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'desiredPickupTime',
                      event.target.value
                    )
                }
              />

              <div
                className={
                  styles.hint
                }
              >
                Необязательно.
                Например, 09:00.
              </div>

            </div>


            <div
              className={
                styles.field
              }
              data-field="preferredVehicleTypeId"
            >

              <label
                className={
                  styles.label
                }
              >
                Предпочтительный транспорт
              </label>

              <select
                className={
                  fieldClass(
                    fieldErrors
                      .preferredVehicleTypeId
                  )
                }
                value={
                  values
                    .preferredVehicleTypeId
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'preferredVehicleTypeId',
                      event.target.value
                    )
                }
              >

                <option value="">
                  Не выбрано / подобрать логисту
                </option>

                {vehicles.map(
                  (
                    vehicle
                  ) => (
                    <option
                      key={
                        vehicle.id
                      }
                      value={
                        vehicle.id
                      }
                    >
                      {
                        vehicle.name
                      }
                    </option>
                  )
                )}

              </select>

              {fieldErrors.preferredVehicleTypeId && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .preferredVehicleTypeId
                  }
                </div>
              )}

            </div>

          </div>

        </section>


        <section
          className={
            styles.card
          }
        >

          <div
            className={
              styles.sectionHeader
            }
          >

            <div
              className={
                styles.sectionNumber
              }
            >
              2
            </div>

            <div>

              <h2
                className={
                  styles.sectionTitle
                }
              >
                Параметры груза
              </h2>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Основные параметры
                для выбора подходящей
                машины.
              </p>

            </div>

          </div>


          <div
            className={
              styles.twoColumns
            }
          >

            <div
              className={
                styles.field
              }
              data-field="totalWeight"
            >

              <label
                className={
                  styles.label
                }
              >
                Общий тоннаж
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <div
                className={
                  styles.inputWithUnit
                }
              >

                <input
                  type="text"
                  inputMode="decimal"
                  className={
                    fieldClass(
                      fieldErrors
                        .totalWeight
                    )
                  }
                  value={
                    values.totalWeight
                  }
                  onChange={
                    (
                      event
                    ) =>
                      updateValue(
                        'totalWeight',
                        event.target.value
                      )
                  }
                  placeholder="12,5"
                />

                <span
                  className={
                    styles.unit
                  }
                >
                  т
                </span>

              </div>

              <div
                className={
                  styles.hint
                }
              >
                Можно вводить
                1,5 или 1.5.
              </div>

              {fieldErrors.totalWeight && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .totalWeight
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.field
              }
              data-field="cargoLength"
            >

              <label
                className={
                  styles.label
                }
              >
                Максимальная длина груза
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <div
                className={
                  styles.inputWithUnit
                }
              >

                <input
                  type="text"
                  inputMode="decimal"
                  className={
                    fieldClass(
                      fieldErrors
                        .cargoLength
                    )
                  }
                  value={
                    values.cargoLength
                  }
                  onChange={
                    (
                      event
                    ) =>
                      updateValue(
                        'cargoLength',
                        event.target.value
                      )
                  }
                  placeholder="11,7"
                />

                <span
                  className={
                    styles.unit
                  }
                >
                  м
                </span>

              </div>

              {fieldErrors.cargoLength && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .cargoLength
                  }
                </div>
              )}

            </div>

          </div>


          <div
            className={
              styles.field
            }
            data-field="needsStakes"
          >

            <label
              className={
                styles.label
              }
            >
              Нужны ли коники?
              <span
                className={
                  styles.required
                }
              >
                *
              </span>
            </label>

            <div
              className={
                styles.segmented
              }
            >

              <button
                type="button"
                className={
                  values.needsStakes ===
                  'yes'
                    ? `${styles.segmentButton} ${styles.segmentButtonActive}`
                    : styles.segmentButton
                }
                onClick={
                  () =>
                    updateValue(
                      'needsStakes',
                      'yes'
                    )
                }
              >
                Да
              </button>

              <button
                type="button"
                className={
                  values.needsStakes ===
                  'no'
                    ? `${styles.segmentButton} ${styles.segmentButtonActive}`
                    : styles.segmentButton
                }
                onClick={
                  () =>
                    updateValue(
                      'needsStakes',
                      'no'
                    )
                }
              >
                Нет
              </button>

            </div>

            <div
              className={
                styles.hint
              }
            >
              Укажите, требуется ли
              перевозка груза с
              использованием коников.
            </div>

            {fieldErrors.needsStakes && (
              <div
                className={
                  styles.errorText
                }
              >
                {
                  fieldErrors
                    .needsStakes
                }
              </div>
            )}

          </div>


          <label
            className={
              styles.checkCard
            }
          >

            <input
              type="checkbox"
              checked={
                values
                  .logisticsFitCheck
              }
              onChange={
                (
                  event
                ) =>
                  updateValue(
                    'logisticsFitCheck',
                    event.target.checked
                  )
              }
            />

            <span
              className={
                styles.customCheckbox
              }
            >
              {values.logisticsFitCheck && (
                <Check
                  size={
                    15
                  }
                />
              )}
            </span>

            <span>

              <strong>
                Уточнить у логиста,
                поместится ли весь груз
                в одну машину
              </strong>

              <small>
                Поставьте галочку,
                если перед отправкой
                машины логист должен
                проверить вместимость
                всего груза.
              </small>

            </span>

          </label>

        </section>


        <div
          className={
            styles.locationGrid
          }
        >

          <section
            className={
              styles.card
            }
          >

            <div
              className={
                styles.sectionHeader
              }
            >

              <div
                className={
                  styles.sectionNumber
                }
              >
                3
              </div>

              <div>

                <h2
                  className={
                    styles.sectionTitle
                  }
                >
                  Погрузка
                </h2>

                <p
                  className={
                    styles.sectionDescription
                  }
                >
                  Где забрать груз
                  и с кем связаться
                  на месте.
                </p>

              </div>

            </div>


            <div
              className={
                styles.field
              }
              data-field="loadingAddress"
            >

              <label
                className={
                  styles.label
                }
              >
                Точный адрес погрузки
              </label>

              <input
                type="text"
                className={
                  fieldClass(
                    fieldErrors
                      .loadingAddress
                  )
                }
                value={
                  values.loadingAddress
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'loadingAddress',
                      event.target.value
                    )
                }
                placeholder="Московская область, Балашиха, ..."
              />

            </div>


            <div
              className={
                styles.orDivider
              }
            >
              или
            </div>


            <div
              className={
                styles.field
              }
              data-field="loadingMapUrl"
            >

              <label
                className={
                  styles.label
                }
              >
                Ссылка на Яндекс Карты — погрузка
              </label>

              <input
                type="url"
                className={
                  fieldClass(
                    fieldErrors
                      .loadingMapUrl
                  )
                }
                value={
                  values.loadingMapUrl
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'loadingMapUrl',
                      event.target.value
                    )
                }
                placeholder="https://yandex.ru/maps/..."
              />

              <div
                className={
                  styles.hint
                }
              >
                Укажите точный адрес
                или вставьте ссылку
                на точку в Яндекс Картах.
              </div>

              {(fieldErrors.loadingAddress ||
                fieldErrors.loadingMapUrl) && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .loadingMapUrl ||
                    fieldErrors
                      .loadingAddress
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.divider
              }
            />


            <div
              className={
                styles.field
              }
              data-field="loadingContactName"
            >

              <label
                className={
                  styles.label
                }
              >
                Имя контактного лица
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <input
                type="text"
                className={
                  fieldClass(
                    fieldErrors
                      .loadingContactName
                  )
                }
                value={
                  values
                    .loadingContactName
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'loadingContactName',
                      event.target.value
                    )
                }
                placeholder="Иван"
              />

              {fieldErrors.loadingContactName && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .loadingContactName
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.field
              }
              data-field="loadingContactPhone"
            >

              <label
                className={
                  styles.label
                }
              >
                Телефон
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <input
                type="tel"
                className={
                  fieldClass(
                    fieldErrors
                      .loadingContactPhone
                  )
                }
                value={
                  values
                    .loadingContactPhone
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'loadingContactPhone',
                      event.target.value
                    )
                }
                placeholder="+7 999 123-45-67"
              />

              {fieldErrors.loadingContactPhone && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .loadingContactPhone
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.field
              }
              data-field="loadingUntil"
            >

              <label
                className={
                  styles.label
                }
              >
                До скольки работает погрузка?
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <input
                type="time"
                className={
                  fieldClass(
                    fieldErrors
                      .loadingUntil
                  )
                }
                value={
                  values.loadingUntil
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'loadingUntil',
                      event.target.value
                    )
                }
              />

              {fieldErrors.loadingUntil && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .loadingUntil
                  }
                </div>
              )}

            </div>

          </section>


          <section
            className={
              styles.card
            }
          >

            <div
              className={
                styles.sectionHeader
              }
            >

              <div
                className={
                  styles.sectionNumber
                }
              >
                4
              </div>

              <div>

                <h2
                  className={
                    styles.sectionTitle
                  }
                >
                  Выгрузка
                </h2>

                <p
                  className={
                    styles.sectionDescription
                  }
                >
                  Куда доставить груз
                  и кто принимает
                  на объекте.
                </p>

              </div>

            </div>


            <div
              className={
                styles.field
              }
              data-field="unloadingAddress"
            >

              <label
                className={
                  styles.label
                }
              >
                Точный адрес выгрузки
              </label>

              <input
                type="text"
                className={
                  fieldClass(
                    fieldErrors
                      .unloadingAddress
                  )
                }
                value={
                  values
                    .unloadingAddress
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'unloadingAddress',
                      event.target.value
                    )
                }
                placeholder="Москва, ..."
              />

            </div>


            <div
              className={
                styles.orDivider
              }
            >
              или
            </div>


            <div
              className={
                styles.field
              }
              data-field="unloadingMapUrl"
            >

              <label
                className={
                  styles.label
                }
              >
                Ссылка на Яндекс Карты — выгрузка
              </label>

              <input
                type="url"
                className={
                  fieldClass(
                    fieldErrors
                      .unloadingMapUrl
                  )
                }
                value={
                  values
                    .unloadingMapUrl
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'unloadingMapUrl',
                      event.target.value
                    )
                }
                placeholder="https://yandex.ru/maps/..."
              />

              <div
                className={
                  styles.hint
                }
              >
                Укажите точный адрес
                или вставьте ссылку
                на точку в Яндекс Картах.
              </div>

              {(fieldErrors.unloadingAddress ||
                fieldErrors.unloadingMapUrl) && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .unloadingMapUrl ||
                    fieldErrors
                      .unloadingAddress
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.divider
              }
            />


            <div
              className={
                styles.field
              }
              data-field="unloadingContactName"
            >

              <label
                className={
                  styles.label
                }
              >
                Имя контактного лица
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <input
                type="text"
                className={
                  fieldClass(
                    fieldErrors
                      .unloadingContactName
                  )
                }
                value={
                  values
                    .unloadingContactName
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'unloadingContactName',
                      event.target.value
                    )
                }
                placeholder="Сергей"
              />

              {fieldErrors.unloadingContactName && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .unloadingContactName
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.field
              }
              data-field="unloadingContactPhone"
            >

              <label
                className={
                  styles.label
                }
              >
                Телефон
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <input
                type="tel"
                className={
                  fieldClass(
                    fieldErrors
                      .unloadingContactPhone
                  )
                }
                value={
                  values
                    .unloadingContactPhone
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'unloadingContactPhone',
                      event.target.value
                    )
                }
                placeholder="+7 999 123-45-67"
              />

              {fieldErrors.unloadingContactPhone && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .unloadingContactPhone
                  }
                </div>
              )}

            </div>


            <div
              className={
                styles.field
              }
              data-field="unloadingUntil"
            >

              <label
                className={
                  styles.label
                }
              >
                До скольки принимают на объекте?
                <span
                  className={
                    styles.required
                  }
                >
                  *
                </span>
              </label>

              <input
                type="time"
                className={
                  fieldClass(
                    fieldErrors
                      .unloadingUntil
                  )
                }
                value={
                  values
                    .unloadingUntil
                }
                onChange={
                  (
                    event
                  ) =>
                    updateValue(
                      'unloadingUntil',
                      event.target.value
                    )
                }
              />

              {fieldErrors.unloadingUntil && (
                <div
                  className={
                    styles.errorText
                  }
                >
                  {
                    fieldErrors
                      .unloadingUntil
                  }
                </div>
              )}

            </div>

          </section>

        </div>


        <section
          className={
            styles.card
          }
        >

          <div
            className={
              styles.sectionHeader
            }
          >

            <div
              className={
                styles.sectionNumber
              }
            >
              5
            </div>

            <div>

              <h2
                className={
                  styles.sectionTitle
                }
              >
                Счета на погрузку
              </h2>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Прикрепите один или несколько
                счетов: фото, скриншоты или PDF.
              </p>

            </div>

          </div>


          <div
            data-field="invoiceFile"
          >

            <div
              className={
                isDragging
                  ? `${styles.dropZone} ${styles.dropZoneActive}`
                  : fieldErrors.invoiceFile
                    ? `${styles.dropZone} ${styles.dropZoneError}`
                    : styles.dropZone
              }
              onDragOver={
                (
                  event
                ) => {
                  event.preventDefault();

                  setIsDragging(
                    true
                  );
                }
              }
              onDragLeave={
                () =>
                  setIsDragging(
                    false
                  )
              }
              onDrop={
                handleDrop
              }
              onClick={
                () =>
                  fileInputRef
                    .current
                    ?.click()
              }
              role="button"
              tabIndex={
                0
              }
              onKeyDown={
                (
                  event
                ) => {
                  if (
                    event.key ===
                      'Enter' ||
                    event.key ===
                      ' '
                  ) {
                    fileInputRef
                      .current
                      ?.click();
                  }
                }
              }
            >

              <UploadCloud
                size={
                  32
                }
              />

              <strong>
                Перетащите счета сюда
                или нажмите для выбора файлов
              </strong>

              <span>
                PDF, JPG, JPEG, PNG или WEBP
              </span>

              <small>
                До 10 счетов, каждый до 4 МБ
              </small>

            </div>


            <input
              ref={
                fileInputRef
              }
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={
                handleFileInput
              }
              className={
                styles.hiddenFileInput
              }
            />


            {invoiceFiles.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  marginTop: 14,
                }}
              >
                {invoiceFiles.map(
                  (file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                      className={
                        styles.fileCard
                      }
                    >
                      <div
                        className={
                          styles.filePreview
                        }
                      >
                        {file.type.startsWith(
                          'image/'
                        ) ? (
                          <ImageIcon
                            size={
                              28
                            }
                          />
                        ) : (
                          <FileText
                            size={
                              28
                            }
                          />
                        )}
                      </div>

                      <div
                        className={
                          styles.fileInfo
                        }
                      >
                        <div
                          className={
                            styles.fileName
                          }
                        >
                          {file.name}
                        </div>

                        <div
                          className={
                            styles.fileMeta
                          }
                        >
                          <span>
                            {file.type || 'Файл'}
                          </span>

                          <span>·</span>

                          <span>
                            {formatFileSize(
                              file.size
                            )}
                          </span>
                        </div>
                      </div>

                      <div
                        className={
                          styles.fileActions
                        }
                      >
                        <button
                          type="button"
                          className={
                            styles.deleteButton
                          }
                          onClick={() =>
                            removeFile(
                              index
                            )
                          }
                        >
                          <Trash2
                            size={
                              15
                            }
                          />

                          Удалить
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}


            {fieldErrors.invoiceFile && (
              <div
                className={
                  styles.errorText
                }
              >
                {
                  fieldErrors
                    .invoiceFile
                }
              </div>
            )}

          </div>

        </section>


        <section
          className={
            styles.card
          }
        >

          <div
            className={
              styles.sectionHeader
            }
          >

            <div
              className={
                styles.sectionNumber
              }
            >
              6
            </div>

            <div>

              <h2
                className={
                  styles.sectionTitle
                }
              >
                Комментарий к заявке
              </h2>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Необязательная
                дополнительная информация.
              </p>

            </div>

          </div>


          <textarea
            className={
              styles.textarea
            }
            value={
              values.comment
            }
            onChange={
              (
                event
              ) =>
                updateValue(
                  'comment',
                  event.target.value
                )
            }
            placeholder="Дополнительная информация для логиста или водителя"
            rows={
              5
            }
          />

        </section>


        <section
          className={
            `${styles.card} ${styles.reviewCard}`
          }
        >

          <div
            className={
              styles.sectionHeader
            }
          >

            <div
              className={
                styles.sectionNumber
              }
            >
              7
            </div>

            <div>

              <h2
                className={
                  styles.sectionTitle
                }
              >
                Проверьте заявку
              </h2>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Короткая проверка
                перед отправкой.
              </p>

            </div>

          </div>


          <div
            className={
              styles.reviewGrid
            }
          >

            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Менеджер
              </span>

              <strong>
                {
                  values.managerEmail ||
                  '—'
                }
              </strong>
            </div>


            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Заказчик
              </span>

              <strong>
                {
                  values.customer ||
                  '—'
                }
              </strong>
            </div>


            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Дата погрузки
              </span>

              <strong>
                {
                  values.loadingDate ||
                  '—'
                }
              </strong>
            </div>


            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Транспорт
              </span>

              <strong>
                {
                  selectedVehicleName
                }
              </strong>
            </div>


            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Груз
              </span>

              <strong>
                {values.totalWeight ||
                  '—'}{' '}
                т /{' '}
                {values.cargoLength ||
                  '—'}{' '}
                м
              </strong>
            </div>


            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Коники
              </span>

              <strong>
                {
                  values.needsStakes ===
                  'yes'
                    ? 'Да'
                    : values.needsStakes ===
                      'no'
                      ? 'Нет'
                      : '—'
                }
              </strong>
            </div>


            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Проверка логистом
              </span>

              <strong>
                {
                  values
                    .logisticsFitCheck
                    ? 'Да'
                    : 'Нет'
                }
              </strong>
            </div>


            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Погрузка
              </span>

              <strong>
                {
                  values.loadingAddress ||
                  values.loadingMapUrl ||
                  '—'
                }
              </strong>
            </div>


            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Выгрузка
              </span>

              <strong>
                {
                  values.unloadingAddress ||
                  values.unloadingMapUrl ||
                  '—'
                }
              </strong>
            </div>


            <div
              className={
                styles.reviewItem
              }
            >
              <span>
                Счета
              </span>

              <strong>
                {
                  invoiceFiles.length >
                  0
                    ? `${invoiceFiles.length}: ${invoiceFiles
                        .map(
                          (file) =>
                            file.name
                        )
                        .join(', ')}`
                    : 'Не прикреплены'
                }
              </strong>
            </div>

          </div>

        </section>


        {serverError && (
          <div
            className={
              styles.serverError
            }
          >
            {serverError}
          </div>
        )}


        <div
          className={
            styles.submitArea
          }
        >

          <div
            className={
              styles.submitNote
            }
          >
            После отправки данные
            заявки и прикреплённые
            счета будут переданы
            логисту.
          </div>


          <button
            type="submit"
            disabled={
              submitting
            }
            className={
              styles.submitButton
            }
          >

            {submitting ? (
              <>
                <LoaderCircle
                  size={
                    18
                  }
                  className={
                    styles.spinner
                  }
                />

                Отправляем заявку…
              </>
            ) : (
              <>
                <Send
                  size={
                    18
                  }
                />

                Отправить заявку на транспорт
              </>
            )}

          </button>

        </div>


        <div
          className={
            styles.honeypot
          }
          aria-hidden="true"
        >
          <label>
            Website

            <input
              type="text"
              name="website"
              tabIndex={
                -1
              }
              autoComplete="off"
            />
          </label>
        </div>

      </form>
    </>
  );
}
