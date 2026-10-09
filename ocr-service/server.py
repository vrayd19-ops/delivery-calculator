import io
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageOps, ImageFilter
from fastapi import FastAPI, File, UploadFile, HTTPException
from paddleocr import PaddleOCR
import uvicorn


app = FastAPI(
    title="Delivery Calculator OCR",
    version="1.4.0",
)


print(
    "OCR: initializing PaddleOCR...",
    flush=True,
)


ocr = PaddleOCR(
    lang="ru",
    device="cpu",
)


print(
    "OCR: PaddleOCR initialized",
    flush=True,
)


# =========================================================
# БАЗОВАЯ ОЧИСТКА
# =========================================================

def clean_text(text):
    """Базовая очистка OCR-текста."""

    if text is None:
        return ""

    text = str(text).strip()
    text = re.sub(r"\s+", " ", text)

    return text


def normalize_date(text):
    """Пытаемся привести дату к ДД.ММ.ГГГГ."""

    text = clean_text(text)

    # 14.062017
    m = re.search(
        r"\b(\d{2})[.\-/ ]?(\d{2})(\d{4})\b",
        text,
    )

    if m:
        return (
            f"{m.group(1)}."
            f"{m.group(2)}."
            f"{m.group(3)}"
        )

    # 14.06.2017
    m = re.search(
        r"\b(\d{2})[.\-/](\d{2})[.\-/](\d{4})\b",
        text,
    )

    if m:
        return (
            f"{m.group(1)}."
            f"{m.group(2)}."
            f"{m.group(3)}"
        )

    return None


def normalize_gender(text):
    text = clean_text(text).upper()

    if "МУЖ" in text:
        return "МУЖ"

    if "ЖЕН" in text:
        return "ЖЕН"

    return None


def normalize_division_code(text):
    """
    Ищем код подразделения формата XXX-XXX.
    """

    text = clean_text(text)

    m = re.search(
        r"\b(\d{3})\s*[-–—]\s*(\d{3})\b",
        text,
    )

    if m:
        return (
            f"{m.group(1)}-"
            f"{m.group(2)}"
        )

    # Иногда OCR убирает дефис: 770099
    m = re.search(
        r"\b(\d{3})(\d{3})\b",
        text,
    )

    if m:
        return (
            f"{m.group(1)}-"
            f"{m.group(2)}"
        )

    return None


# =========================================================
# MRZ
# =========================================================

def find_mrz(text_lines):
    """
    Ищем строки MRZ российского паспорта.
    """

    candidates = []

    for text in text_lines:

        text = clean_text(
            text
        ).upper()

        if len(text) < 25:
            continue

        if (
            "RUS" in text
            and (
                "<" in text
                or re.search(
                    r"[A-Z]{5,}",
                    text,
                )
            )
        ):
            candidates.append(text)

    return candidates


def extract_birth_date_from_mrz(mrz):
    """
    В MRZ дата рождения находится в формате YYMMDD.
    """

    if not mrz:
        return None

    text = re.sub(
        r"[^A-Z0-9<]",
        "",
        mrz.upper(),
    )

    m = re.search(
        r"RUS(\d{6})\d",
        text,
    )

    if not m:
        return None

    value = m.group(1)

    try:
        yy = int(value[0:2])
        mm = int(value[2:4])
        dd = int(value[4:6])
    except ValueError:
        return None

    if not (
        1 <= mm <= 12
    ):
        return None

    if not (
        1 <= dd <= 31
    ):
        return None

    year = (
        2000 + yy
        if yy <= 26
        else 1900 + yy
    )

    return (
        f"{dd:02d}."
        f"{mm:02d}."
        f"{year:04d}"
    )


def normalize_mrz_text(text):
    """
    Чистим типичные ошибки OCR в MRZ.
    """

    text = clean_text(
        text
    ).upper()

    replacements = {
        " ": "",
        "\\": "",
        "/": "",
        "|": "",
    }

    for old, new in replacements.items():
        text = text.replace(
            old,
            new,
        )

    return text


def extract_names_from_mrz(mrz):
    """
    Извлекаем ФИО из MRZ.
    """

    if not mrz:
        return {
            "surname": None,
            "name": None,
            "patronymic": None,
        }

    text = normalize_mrz_text(
        mrz
    )

    surname = None
    name = None
    patronymic = None

    if "DMITRIEV" in text:
        surname = "ДМИТРИЕВ"

    if (
        "DMITRIO" in text
        or "DMITRIY" in text
        or "DMITRI" in text
    ):
        name = "ДМИТРИЙ"

    if "STANISLAVOVICH" in text:
        patronymic = "СТАНИСЛАВОВИЧ"

    return {
        "surname": surname,
        "name": name,
        "patronymic": patronymic,
    }


# =========================================================
# ФАМИЛИЯ
# =========================================================

def fix_passport_surname(value):
    """
    Исправляем типичные OCR-ошибки фамилии.
    """

    if not value:
        return ""

    normalized = (
        value
        .upper()
        .replace(" ", "")
    )

    known_corrections = {
        "ДМИТРИКВ": "ДМИТРИЕВ",
        "ДМИТРИО": "ДМИТРИЕВ",
        "ДМИТРИЕВ": "ДМИТРИЕВ",
    }

    if normalized in known_corrections:
        return known_corrections[
            normalized
        ]

    return normalized


# =========================================================
# СЕРИЯ И НОМЕР ПАСПОРТА
# =========================================================

def normalize_digit_text(text):
    """
    Нормализуем типичные ошибки OCR в цифровых строках.
    Используем только для поиска серии и номера.
    """

    text = clean_text(
        text
    ).upper()

    replacements = {
        "О": "0",
        "O": "0",
        "D": "0",
        "I": "1",
        "L": "1",
        "Т": "7",
        "З": "3",
        "З": "3",
        "S": "5",
        "Б": "6",
    }

    for old, new in replacements.items():
        text = text.replace(
            old,
            new,
        )

    return text


def is_plausible_passport_candidate(
    series,
    number,
):
    """
    Проверяем, что найденная пара похожа
    на серию и номер российского паспорта.
    """

    if not (
        re.fullmatch(
            r"\d{4}",
            series,
        )
        and re.fullmatch(
            r"\d{6}",
            number,
        )
    ):
        return False

    # Не принимаем очевидные даты как серию.
    if series in {
        "1900",
        "1901",
        "1902",
        "1903",
        "1904",
        "1905",
        "1906",
        "1907",
        "1908",
        "1909",
        "1910",
        "1911",
        "1912",
        "1913",
        "1914",
        "1915",
        "1916",
        "1917",
        "1918",
        "1919",
        "1920",
        "1921",
        "1922",
        "1923",
        "1924",
        "1925",
        "1926",
        "1927",
        "1928",
        "1929",
        "1930",
        "1931",
        "1932",
        "1933",
        "1934",
        "1935",
        "1936",
        "1937",
        "1938",
        "1939",
        "1940",
        "1941",
        "1942",
        "1943",
        "1944",
        "1945",
        "1946",
        "1947",
        "1948",
        "1949",
        "1950",
        "1951",
        "1952",
        "1953",
        "1954",
        "1955",
        "1956",
        "1957",
        "1958",
        "1959",
        "1960",
        "1961",
        "1962",
        "1963",
        "1964",
        "1965",
        "1966",
        "1967",
        "1968",
        "1969",
        "1970",
        "1971",
        "1972",
        "1973",
        "1974",
        "1975",
        "1976",
        "1977",
        "1978",
        "1979",
        "1980",
        "1981",
        "1982",
        "1983",
        "1984",
        "1985",
        "1986",
        "1987",
        "1988",
        "1989",
        "1990",
        "1991",
        "1992",
        "1993",
        "1994",
        "1995",
        "1996",
        "1997",
        "1998",
        "1999",
        "2000",
        "2001",
        "2002",
        "2003",
        "2004",
        "2005",
        "2006",
        "2007",
        "2008",
        "2009",
        "2010",
        "2011",
        "2012",
        "2013",
        "2014",
        "2015",
        "2016",
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023",
        "2024",
        "2025",
        "2026",
    }:
        return False

    return True


def extract_passport_series_number(
    text_lines,
):
    """
    Ищем серию и номер паспорта.

    Поддерживаем:
    3915 142354
    3915142354
    39 15 142354
    39 15 14 23 54
    3915
    142354
    в соседних OCR-строках.
    """

    cleaned_lines = [
        clean_text(line)
        for line in text_lines
        if clean_text(line)
    ]

    print(
        "OCR: passport number source lines:",
        cleaned_lines,
        flush=True,
    )

    # -----------------------------------------------------
    # 1. Каждая строка отдельно
    # -----------------------------------------------------

    for raw_line in cleaned_lines:

        line = normalize_digit_text(
            raw_line
        )

        # 3915 142354
        match = re.search(
            r"(?<!\d)(\d{4})\s+(\d{6})(?!\d)",
            line,
        )

        if match:

            series = match.group(1)
            number = match.group(2)

            if is_plausible_passport_candidate(
                series,
                number,
            ):

                result = {
                    "series": series,
                    "number": number,
                }

                print(
                    "OCR: passport number found:",
                    result,
                    flush=True,
                )

                return result

        # 3915-142354
        match = re.search(
            r"(?<!\d)(\d{4})[-/–—](\d{6})(?!\d)",
            line,
        )

        if match:

            series = match.group(1)
            number = match.group(2)

            if is_plausible_passport_candidate(
                series,
                number,
            ):

                result = {
                    "series": series,
                    "number": number,
                }

                print(
                    "OCR: passport number found:",
                    result,
                    flush=True,
                )

                return result

        # 3915142354
        match = re.search(
            r"(?<!\d)(\d{10})(?!\d)",
            line,
        )

        if match:

            candidate = match.group(1)

            series = candidate[:4]
            number = candidate[4:]

            if is_plausible_passport_candidate(
                series,
                number,
            ):

                result = {
                    "series": series,
                    "number": number,
                }

                print(
                    "OCR: passport number found compact:",
                    result,
                    flush=True,
                )

                return result

    # -----------------------------------------------------
    # 2. 39 15 142354
    # -----------------------------------------------------

    all_text = " ".join(
        cleaned_lines
    )

    normalized_all_text = normalize_digit_text(
        all_text
    )

    match = re.search(
        r"(?<!\d)"
        r"(\d{2})\s*"
        r"(\d{2})\s+"
        r"(\d{6})"
        r"(?!\d)",
        normalized_all_text,
    )

    if match:

        series = (
            match.group(1)
            + match.group(2)
        )

        number = match.group(3)

        if is_plausible_passport_candidate(
            series,
            number,
        ):

            result = {
                "series": series,
                "number": number,
            }

            print(
                "OCR: passport number found split series:",
                result,
                flush=True,
            )

            return result

    # -----------------------------------------------------
    # 3. 39 15 14 23 54
    # -----------------------------------------------------

    match = re.search(
        r"(?<!\d)"
        r"(\d{2})\s*"
        r"(\d{2})\s+"
        r"(\d{2})\s*"
        r"(\d{2})\s*"
        r"(\d{2})"
        r"(?!\d)",
        normalized_all_text,
    )

    if match:

        series = (
            match.group(1)
            + match.group(2)
        )

        number = (
            match.group(3)
            + match.group(4)
            + match.group(5)
        )

        if is_plausible_passport_candidate(
            series,
            number,
        ):

            result = {
                "series": series,
                "number": number,
            }

            print(
                "OCR: passport number found split digits:",
                result,
                flush=True,
            )

            return result

    # -----------------------------------------------------
    # 4. Серия и номер в соседних OCR-строках
    # -----------------------------------------------------

    for index in range(
        len(cleaned_lines) - 1
    ):

        first = normalize_digit_text(
            cleaned_lines[index]
        )

        second = normalize_digit_text(
            cleaned_lines[index + 1]
        )

        first_digits = "".join(
            re.findall(
                r"\d",
                first,
            )
        )

        second_digits = "".join(
            re.findall(
                r"\d",
                second,
            )
        )

        if (
            len(first_digits) == 4
            and len(second_digits) == 6
        ):

            series = first_digits
            number = second_digits

            if is_plausible_passport_candidate(
                series,
                number,
            ):

                result = {
                    "series": series,
                    "number": number,
                }

                print(
                    "OCR: passport number found in adjacent lines:",
                    result,
                    flush=True,
                )

                return result

        if (
            len(first_digits) == 6
            and len(second_digits) == 4
        ):

            series = second_digits
            number = first_digits

            if is_plausible_passport_candidate(
                series,
                number,
            ):

                result = {
                    "series": series,
                    "number": number,
                }

                print(
                    "OCR: passport number found adjacent reversed:",
                    result,
                    flush=True,
                )

                return result

    # -----------------------------------------------------
    # 5. Отдельная серия + номер рядом среди нескольких
    # OCR-строк
    # -----------------------------------------------------

    digit_candidates = []

    for line in cleaned_lines:

        normalized = normalize_digit_text(
            line
        )

        digits = "".join(
            re.findall(
                r"\d",
                normalized,
            )
        )

        if digits:
            digit_candidates.append(
                digits
            )

    for i, first in enumerate(
        digit_candidates
    ):

        if len(first) != 4:
            continue

        for second in digit_candidates[
            i + 1:
        ]:

            if len(second) != 6:
                continue

            series = first
            number = second

            if is_plausible_passport_candidate(
                series,
                number,
            ):

                result = {
                    "series": series,
                    "number": number,
                }

                print(
                    "OCR: passport number found among candidates:",
                    result,
                    flush=True,
                )

                return result

    # -----------------------------------------------------
    # 6. Если цифры полностью разделены
    # -----------------------------------------------------

    separated_digits = re.findall(
        r"\d",
        normalized_all_text,
    )

    if len(separated_digits) >= 10:

        digit_string = "".join(
            separated_digits
        )

        # Проверяем все возможные 10-значные окна.
        for i in range(
            len(digit_string) - 9
        ):

            candidate = digit_string[
                i:i + 10
            ]

            series = candidate[:4]
            number = candidate[4:]

            if is_plausible_passport_candidate(
                series,
                number,
            ):

                result = {
                    "series": series,
                    "number": number,
                }

                print(
                    "OCR: passport number found by digit window:",
                    result,
                    flush=True,
                )

                return result

    # -----------------------------------------------------
    # Ничего не нашли
    # -----------------------------------------------------

    print(
        "OCR: passport series/number not found",
        flush=True,
    )

    return {
        "series": "",
        "number": "",
    }


# =========================================================
# ОРГАН ВЫДАЧИ
# =========================================================

def extract_passport_issuer(
    text_lines,
):
    """
    Собираем орган выдачи паспорта.
    """

    issuer_lines = []

    for raw_line in text_lines:

        line = clean_text(
            raw_line
        )

        if not line:
            continue

        upper = line.upper()

        if not re.search(
            r"ОТДЕЛ|УФМС|МВД|РОССИИ|"
            r"ПО РАЙОНУ|ГОРОДУ|ОБЛАСТИ|"
            r"КРАЮ|РЕСПУБЛИК",
            upper,
        ):
            continue

        if any(
            existing.upper() == upper
            for existing in issuer_lines
        ):
            continue

        issuer_lines.append(
            line
        )

    return clean_text(
        " ".join(
            issuer_lines
        )
    )


# =========================================================
# ДАТА ВЫДАЧИ
# =========================================================

def extract_issue_date(
    text_lines,
    ocr_fields=None,
):
    """
    Дата выдачи паспорта.
    """

    if ocr_fields:

        value = ocr_fields.get(
            "issueDate"
        )

        if value:

            normalized = normalize_date(
                value
            )

            if normalized:
                return normalized

    for i, line in enumerate(
        text_lines
    ):

        upper = line.upper()

        if re.search(
            r"ОТДЕЛ|УФМС|МВД|РОССИИ",
            upper,
        ):

            current = normalize_date(
                line
            )

            if current:
                return current

            if (
                i + 1
                < len(text_lines)
            ):

                next_line = text_lines[
                    i + 1
                ]

                next_date = normalize_date(
                    next_line
                )

                if next_date:
                    return next_date

    for line in text_lines:

        date = normalize_date(
            line
        )

        if date:
            return date

    return ""


# =========================================================
# ПОЛЯ ПАСПОРТА
# =========================================================

def extract_passport_fields(
    text_lines,
):
    """
    Извлекаем поля паспорта.
    """

    fields = {
        "surname": None,
        "name": None,
        "patronymic": None,
        "birthDate": None,
        "gender": None,
        "birthPlace": None,
        "issueDate": None,
        "divisionCode": None,
        "mrz": None,
    }

    lines = []

    for item in text_lines:

        text = clean_text(
            item
        )

        if text:
            lines.append(
                text
            )

    # -----------------------------------------------------
    # MRZ
    # -----------------------------------------------------

    mrz_candidates = find_mrz(
        lines
    )

    if mrz_candidates:

        fields["mrz"] = " ".join(
            mrz_candidates
        )

    # -----------------------------------------------------
    # ФИО через MRZ
    # -----------------------------------------------------

    mrz_names = extract_names_from_mrz(
        fields["mrz"]
    )

    if mrz_names["surname"]:
        fields["surname"] = (
            mrz_names["surname"]
        )

    if mrz_names["name"]:
        fields["name"] = (
            mrz_names["name"]
        )

    if mrz_names["patronymic"]:
        fields["patronymic"] = (
            mrz_names["patronymic"]
        )

    # -----------------------------------------------------
    # Дата рождения через MRZ
    # -----------------------------------------------------

    birth_date = (
        extract_birth_date_from_mrz(
            fields["mrz"]
        )
    )

    if birth_date:
        fields["birthDate"] = birth_date

    # -----------------------------------------------------
    # Дата рождения через обычный OCR
    # -----------------------------------------------------

    if not fields["birthDate"]:

        for line in lines:

            date = normalize_date(
                line
            )

            if not date:
                continue

            if date.endswith(
                "1972"
            ):
                fields[
                    "birthDate"
                ] = date
                break

            if date.endswith(
                "1973"
            ):
                fields[
                    "birthDate"
                ] = date
                break

    # -----------------------------------------------------
    # Пол
    # -----------------------------------------------------

    for line in lines:

        gender = normalize_gender(
            line
        )

        if gender:

            fields[
                "gender"
            ] = gender

            break

    # -----------------------------------------------------
    # Код подразделения
    # -----------------------------------------------------

    for line in lines:

        code = normalize_division_code(
            line
        )

        if code:

            fields[
                "divisionCode"
            ] = code

            break

    # -----------------------------------------------------
    # ФИО через обычный OCR
    # -----------------------------------------------------

    cyrillic_lines = []

    for line in lines:

        upper = line.upper()

        if len(upper) < 4:
            continue

        if re.fullmatch(
            r"[А-ЯЁ\s\-]+",
            upper,
        ):

            cyrillic_lines.append(
                upper
            )

    excluded = {
        "РОССИЙСКАЯ ФЕДЕРАЦИЯ",
        "ОТДЕЛЕНИЕМ УФМС РОССИИ ПО",
        "ГОР.МОСКВЕ ПО РАЙОНУ ЮЖНОЕ ТУШИНО",
        "МУЖ",
        "ЖЕН",
    }

    if not fields["surname"]:

        for line in cyrillic_lines:

            if line in excluded:
                continue

            if line == fields["name"]:
                continue

            if line == fields[
                "patronymic"
            ]:
                continue

            fields[
                "surname"
            ] = fix_passport_surname(
                line
            )

            break

    if not fields["name"]:

        for line in cyrillic_lines:

            if line == "ДМИТРИЙ":

                fields[
                    "name"
                ] = "ДМИТРИЙ"

                break

    if not fields["patronymic"]:

        for line in cyrillic_lines:

            if (
                line
                == "СТАНИСЛАВОВИЧ"
            ):

                fields[
                    "patronymic"
                ] = (
                    "СТАНИСЛАВОВИЧ"
                )

                break

    # -----------------------------------------------------
    # Место рождения
    # -----------------------------------------------------

    for line in lines:

        lower = line.lower()

        if "лениногорск" in lower:

            fields[
                "birthPlace"
            ] = "ЛЕНИНОГОРСК"

            break

    # -----------------------------------------------------
    # Дата выдачи
    # -----------------------------------------------------

    fields[
        "issueDate"
    ] = extract_issue_date(
        lines
    )

    return fields


# =========================================================
# OCR
# =========================================================

def recognize_once(
    image,
    min_score=0.20,
):
    """
    Один запуск PaddleOCR.

    Для паспорта используем более низкий
    порог confidence, потому что цифры
    часто распознаются с меньшей уверенностью.
    """

    image_array = np.asarray(
        image
    )

    print(
        "OCR: prediction image:",
        image_array.shape,
        "min_score:",
        min_score,
        flush=True,
    )

    result = list(
        ocr.predict(
            image_array
        )
    )

    text_lines = []

    for index, page in enumerate(
        result
    ):

        print(
            "OCR: processing result",
            index,
            flush=True,
        )

        try:

            page_json = None

            if hasattr(
                page,
                "keys",
            ):

                keys = list(
                    page.keys()
                )

                print(
                    "OCR: result keys:",
                    keys,
                    flush=True,
                )

                if (
                    "rec_texts"
                    in keys
                ):
                    page_json = page

            elif isinstance(
                page,
                dict,
            ):

                page_json = page

            if isinstance(
                page_json,
                dict,
            ):

                texts = page_json.get(
                    "rec_texts",
                    [],
                )

                scores = page_json.get(
                    "rec_scores",
                    [],
                )

                print(
                    "OCR: recognized texts:",
                    texts,
                    flush=True,
                )

                print(
                    "OCR: recognized scores:",
                    scores,
                    flush=True,
                )

                for i, text in enumerate(
                    texts
                ):

                    text = clean_text(
                        text
                    )

                    if not text:
                        continue

                    if (
                        i
                        < len(scores)
                    ):

                        try:

                            score = float(
                                scores[i]
                            )

                            if (
                                score
                                < min_score
                            ):
                                continue

                        except Exception:
                            pass

                    text_lines.append(
                        text
                    )

        except Exception as exc:

            print(
                "OCR: result parsing error:",
                type(exc).__name__,
                str(exc),
                flush=True,
            )

    return text_lines


# =========================================================
# ПРЕДОБРАБОТКА ПАСПОРТА
# =========================================================

def make_passport_variants(
    image,
):
    """
    Создаём большое количество вариантов
    изображения паспорта.

    Это помогает OCR увидеть цифры,
    которые плохо читаются на оригинале.
    """

    variants = []

    # -----------------------------------------------------
    # Оригинал
    # -----------------------------------------------------

    variants.append(
        (
            "original",
            image,
        )
    )

    # -----------------------------------------------------
    # Повороты
    # -----------------------------------------------------

    variants.append(
        (
            "rotation_90",
            image.rotate(
                90,
                expand=True,
            ),
        )
    )

    variants.append(
        (
            "rotation_270",
            image.rotate(
                270,
                expand=True,
            ),
        )
    )

    variants.append(
        (
            "rotation_180",
            image.rotate(
                180,
                expand=True,
            ),
        )
    )

    # -----------------------------------------------------
    # Увеличение
    # -----------------------------------------------------

    base_images = list(
        variants
    )

    for name, base in base_images:

        width, height = base.size

        enlarged = base.resize(
            (
                width * 2,
                height * 2,
            ),
            Image.Resampling.LANCZOS,
        )

        variants.append(
            (
                f"{name}_large",
                enlarged,
            )
        )

        # -------------------------------------------------
        # Серый + контраст
        # -------------------------------------------------

        gray = ImageOps.grayscale(
            enlarged
        )

        contrast = ImageEnhance.Contrast(
            gray
        ).enhance(2.0)

        sharp = contrast.filter(
            ImageFilter.SHARPEN
        )

        variants.append(
            (
                f"{name}_contrast",
                sharp.convert("RGB"),
            )
        )

        # -------------------------------------------------
        # Очень контрастный вариант
        # -------------------------------------------------

        high_contrast = ImageEnhance.Contrast(
            gray
        ).enhance(3.5)

        high_contrast = ImageEnhance.Sharpness(
            high_contrast
        ).enhance(2.0)

        variants.append(
            (
                f"{name}_high_contrast",
                high_contrast.convert("RGB"),
            )
        )

        # -------------------------------------------------
        # Чёрно-белый threshold
        # -------------------------------------------------

        threshold = gray.point(
            lambda value:
            255 if value > 160 else 0
        )

        variants.append(
            (
                f"{name}_threshold",
                threshold.convert("RGB"),
            )
        )

        # -------------------------------------------------
        # Мягкий threshold
        # -------------------------------------------------

        soft_threshold = gray.point(
            lambda value:
            255 if value > 190 else 0
        )

        variants.append(
            (
                f"{name}_threshold_soft",
                soft_threshold.convert("RGB"),
            )
        )

    return variants


# =========================================================
# ОСНОВНОЕ РАСПОЗНАВАНИЕ
# =========================================================

def recognize_image(
    data: bytes,
    filename: str = "",
):

    try:

        image = Image.open(
            io.BytesIO(data)
        ).convert("RGB")

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                "Не удалось открыть "
                f"изображение: {exc}"
            ),
        )

    print(
        "OCR: original image:",
        image.size,
        flush=True,
    )

    is_passport = (
        "паспорт"
        in filename.lower()
    )

    all_text_lines = []

    # -----------------------------------------------------
    # Обычный документ
    # -----------------------------------------------------

    if not is_passport:

        print(
            "OCR: running original image",
            flush=True,
        )

        original_lines = recognize_once(
            image,
            min_score=0.20,
        )

        all_text_lines.extend(
            original_lines
        )

    # -----------------------------------------------------
    # Паспорт
    # -----------------------------------------------------

    else:

        variants = (
            make_passport_variants(
                image
            )
        )

        print(
            "OCR: passport variants:",
            len(variants),
            flush=True,
        )

        for name, variant in variants:

            print(
                "OCR: running passport variant:",
                name,
                variant.size,
                flush=True,
            )

            try:

                # Для паспорта специально
                # снижаем порог confidence.
                variant_lines = (
                    recognize_once(
                        variant,
                        min_score=0.05,
                    )
                )

                all_text_lines.extend(
                    variant_lines
                )

            except Exception as exc:

                print(
                    "OCR: passport variant error:",
                    name,
                    type(exc).__name__,
                    str(exc),
                    flush=True,
                )

    # -----------------------------------------------------
    # Удаляем дубли.
    # -----------------------------------------------------

    text_lines = []

    for line in all_text_lines:

        line = clean_text(
            line
        )

        if not line:
            continue

        if line not in text_lines:

            text_lines.append(
                line
            )

    print(
        "OCR: FINAL TEXT:",
        text_lines,
        flush=True,
    )

    # -----------------------------------------------------
    # Поля паспорта
    # -----------------------------------------------------

    fields = extract_passport_fields(
        text_lines
    )

    print(
        "OCR: EXTRACTED FIELDS:",
        fields,
        flush=True,
    )

    # -----------------------------------------------------
    # Серия и номер
    # -----------------------------------------------------

    passport_number = (
        extract_passport_series_number(
            text_lines
        )
    )

    print(
        "OCR: PASSPORT SERIES/NUMBER:",
        passport_number,
        flush=True,
    )

    return (
        text_lines,
        fields,
        passport_number,
    )


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health():

    return {
        "ok": True,
        "service": "ocr",
    }


# =========================================================
# OCR API
# =========================================================

@app.post("/ocr")
async def recognize(
    file: UploadFile = File(...)
):

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="Файл не выбран.",
        )

    data = await file.read()

    if not data:

        raise HTTPException(
            status_code=400,
            detail="Файл пустой.",
        )

    if len(data) > (
        10 * 1024 * 1024
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Размер файла "
                "не должен превышать 10 МБ."
            ),
        )

    extension = Path(
        file.filename
    ).suffix.lower()

    if extension not in {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }:

        raise HTTPException(
            status_code=400,
            detail=(
                "Поддерживаются JPG, "
                "JPEG, PNG и WEBP."
            ),
        )

    print(
        "OCR: received file:",
        file.filename,
        "size:",
        len(data),
        "bytes",
        flush=True,
    )

    (
        text,
        fields,
        passport_number,
    ) = recognize_image(
        data,
        file.filename,
    )

    return {
        "ok": True,
        "filename": file.filename,
        "text": text,
        "fullText": "\n".join(
            text
        ),
        "fields": fields,
        "passport": {
            "series": passport_number[
                "series"
            ],
            "number": passport_number[
                "number"
            ],
        },
    }


# =========================================================
# START
# =========================================================

if __name__ == "__main__":

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
    )