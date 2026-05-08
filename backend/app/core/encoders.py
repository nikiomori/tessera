"""Convert a typed `DataPayload` into the string that gets embedded in the QR code.

Each function follows a published spec so generated codes are recognised by
standard scanner apps:

- WIFI:  https://github.com/zxing/zxing/wiki/Barcode-Contents#wi-fi-network-config
- vCard: RFC 6350 (3.0 dialect, widely supported)
- mailto: RFC 6068
- SMSTO: ZXing convention
- tel:   RFC 3966
- geo:   RFC 5870
- VEVENT: RFC 5545 (iCalendar)
"""

from __future__ import annotations

import re
from datetime import datetime
from urllib.parse import quote

from app.models import (
    DataPayload,
    EmailData,
    EventData,
    GeoData,
    PhoneData,
    SmsData,
    TextData,
    UrlData,
    VCardData,
    WifiData,
)

_WIFI_ESCAPE = re.compile(r"([\\;,:\"])")
_VCARD_ESCAPE = re.compile(r"([\\;,])")


def _escape_wifi(s: str) -> str:
    return _WIFI_ESCAPE.sub(r"\\\1", s)


def _escape_vcard(s: str) -> str:
    return _VCARD_ESCAPE.sub(r"\\\1", s).replace("\n", "\\n")


def _format_ical_dt(value: str) -> str:
    """Accept ISO 8601 input, return iCal basic format (UTC if Z present)."""
    cleaned = value.strip()
    try:
        dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"Invalid ISO 8601 datetime: {value!r}") from exc
    if dt.tzinfo is not None:
        return dt.astimezone().strftime("%Y%m%dT%H%M%SZ")
    return dt.strftime("%Y%m%dT%H%M%S")


def encode_url(d: UrlData) -> str:
    return d.url.strip()


def encode_text(d: TextData) -> str:
    return d.text


def encode_wifi(d: WifiData) -> str:
    parts = [
        f"T:{d.encryption.value}",
        f"S:{_escape_wifi(d.ssid)}",
    ]
    if d.encryption != "nopass" and d.password:
        parts.append(f"P:{_escape_wifi(d.password)}")
    parts.append(f"H:{'true' if d.hidden else 'false'}")
    return "WIFI:" + ";".join(parts) + ";;"


def encode_vcard(d: VCardData) -> str:
    last = _escape_vcard(d.last_name or "")
    first = _escape_vcard(d.first_name)
    full_name = f"{first} {last}".strip()
    lines = ["BEGIN:VCARD", "VERSION:3.0", f"N:{last};{first};;;", f"FN:{full_name}"]
    if d.org:
        lines.append(f"ORG:{_escape_vcard(d.org)}")
    if d.title_role:
        lines.append(f"TITLE:{_escape_vcard(d.title_role)}")
    if d.phone:
        lines.append(f"TEL:{d.phone}")
    if d.email:
        lines.append(f"EMAIL:{d.email}")
    if d.url:
        lines.append(f"URL:{d.url}")
    if d.address:
        lines.append(f"ADR:;;{_escape_vcard(d.address)};;;;")
    lines.append("END:VCARD")
    return "\r\n".join(lines)


def encode_email(d: EmailData) -> str:
    query: list[str] = []
    if d.subject:
        query.append("subject=" + quote(d.subject, safe=""))
    if d.body:
        query.append("body=" + quote(d.body, safe=""))
    suffix = "?" + "&".join(query) if query else ""
    return f"mailto:{d.to}{suffix}"


def encode_sms(d: SmsData) -> str:
    if d.message:
        return f"SMSTO:{d.to}:{d.message}"
    return f"SMSTO:{d.to}"


def encode_phone(d: PhoneData) -> str:
    return f"tel:{d.number}"


def encode_geo(d: GeoData) -> str:
    return f"geo:{d.lat},{d.lng}"


def encode_event(d: EventData) -> str:
    lines = [
        "BEGIN:VEVENT",
        f"SUMMARY:{_escape_vcard(d.title)}",
        f"DTSTART:{_format_ical_dt(d.start)}",
        f"DTEND:{_format_ical_dt(d.end)}",
    ]
    if d.location:
        lines.append(f"LOCATION:{_escape_vcard(d.location)}")
    if d.description:
        lines.append(f"DESCRIPTION:{_escape_vcard(d.description)}")
    lines.append("END:VEVENT")
    return "\r\n".join(lines)


def encode_payload(payload: DataPayload) -> str:
    """Dispatch on ``payload.kind`` and return the QR-ready string."""
    match payload.kind:
        case "url":
            return encode_url(payload)
        case "text":
            return encode_text(payload)
        case "wifi":
            return encode_wifi(payload)
        case "vcard":
            return encode_vcard(payload)
        case "email":
            return encode_email(payload)
        case "sms":
            return encode_sms(payload)
        case "phone":
            return encode_phone(payload)
        case "geo":
            return encode_geo(payload)
        case "event":
            return encode_event(payload)
