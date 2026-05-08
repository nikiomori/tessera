from app.core.encoders import encode_payload
from app.models import (
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


def test_url_passthrough() -> None:
    assert encode_payload(UrlData(url="https://example.com")) == "https://example.com"


def test_text_passthrough() -> None:
    assert encode_payload(TextData(text="hello\nworld")) == "hello\nworld"


def test_wifi_wpa() -> None:
    out = encode_payload(WifiData(ssid="My;WiFi", password='p:a"s,s', encryption="WPA"))
    assert out == 'WIFI:T:WPA;S:My\\;WiFi;P:p\\:a\\"s\\,s;H:false;;'


def test_wifi_no_password_when_open() -> None:
    out = encode_payload(WifiData(ssid="open", encryption="nopass"))
    assert out == "WIFI:T:nopass;S:open;H:false;;"


def test_vcard_basic() -> None:
    out = encode_payload(VCardData(first_name="Ada", last_name="Lovelace", email="a@x.io"))
    assert "BEGIN:VCARD" in out
    assert "FN:Ada Lovelace" in out
    assert "EMAIL:a@x.io" in out
    assert out.endswith("END:VCARD")


def test_email_with_subject_body() -> None:
    out = encode_payload(EmailData(to="a@b.io", subject="hi there", body="line 1"))
    assert out.startswith("mailto:a@b.io?")
    assert "subject=hi%20there" in out
    assert "body=line%201" in out


def test_sms() -> None:
    assert encode_payload(SmsData(to="+15551234567", message="hi")) == "SMSTO:+15551234567:hi"


def test_phone() -> None:
    assert encode_payload(PhoneData(number="+15551234567")) == "tel:+15551234567"


def test_geo() -> None:
    assert encode_payload(GeoData(lat=40.7128, lng=-74.0060)) == "geo:40.7128,-74.006"


def test_event() -> None:
    out = encode_payload(
        EventData(
            title="Meet", start="2026-05-10T14:00:00", end="2026-05-10T15:00:00", location="X"
        )
    )
    assert "BEGIN:VEVENT" in out
    assert "SUMMARY:Meet" in out
    assert "DTSTART:20260510T140000" in out
    assert "LOCATION:X" in out
    assert out.endswith("END:VEVENT")
