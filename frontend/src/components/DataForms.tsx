import { useQR } from '@/hooks/useQR';
import { dataKindLabels } from '@/lib/defaults';
import { cn } from '@/lib/utils';
import type {
  DataKind,
  DataPayload,
  EmailData,
  EventData,
  GeoData,
  PhoneData,
  SmsData,
  TextData,
  VCardData,
  WifiAuth,
  WifiData,
} from '@/types/qr';

import { Row } from './Section';

const KINDS: DataKind[] = ['url', 'text', 'wifi', 'vcard', 'email', 'sms', 'phone', 'geo', 'event'];

const inputClass =
  'border-border bg-surface-1 placeholder:text-muted-foreground focus:border-accent w-full rounded-md border px-3 py-2 font-mono text-[13px] focus:outline-none transition-colors';

export function DataForms() {
  const { request, dispatch } = useQR();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => dispatch({ type: 'set-data-kind', kind: k })}
            className={cn(
              'rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors',
              request.data.kind === k
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border hover:border-accent/50 hover:bg-muted text-foreground/80',
            )}
          >
            {dataKindLabels[k]}
          </button>
        ))}
      </div>

      {request.data.kind !== 'url' && (
        <DataFormBody data={request.data} onPatch={(patch) => dispatch({ type: 'patch-data', patch })} />
      )}
      {request.data.kind === 'url' && (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          The URL is captured by the hero input above. Switch to a different type if you don't need a website link.
        </p>
      )}
    </div>
  );
}

function DataFormBody({
  data,
  onPatch,
}: {
  data: DataPayload;
  onPatch: (patch: Partial<DataPayload>) => void;
}) {
  switch (data.kind) {
    case 'url':
      return null;
    case 'text':
      return (
        <Row label="Text" apiKey="data.text">
          <textarea
            className={cn(inputClass, 'min-h-[120px] resize-y')}
            value={(data as TextData).text}
            onChange={(e) => onPatch({ text: e.target.value } as Partial<TextData>)}
          />
        </Row>
      );
    case 'wifi': {
      const w = data as WifiData;
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Row label="SSID" apiKey="data.ssid">
            <input
              className={inputClass}
              value={w.ssid}
              onChange={(e) => onPatch({ ssid: e.target.value } as Partial<WifiData>)}
            />
          </Row>
          <Row label="Encryption" apiKey="data.encryption">
            <select
              className={inputClass}
              value={w.encryption}
              onChange={(e) => onPatch({ encryption: e.target.value as WifiAuth } as Partial<WifiData>)}
            >
              <option value="WPA">WPA / WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">Open</option>
            </select>
          </Row>
          {w.encryption !== 'nopass' && (
            <Row label="Password" apiKey="data.password">
              <input
                type="text"
                className={inputClass}
                value={w.password}
                onChange={(e) => onPatch({ password: e.target.value } as Partial<WifiData>)}
              />
            </Row>
          )}
          <label className="text-foreground/85 flex items-center gap-2 self-end pb-2 text-[12px]">
            <input
              type="checkbox"
              checked={w.hidden}
              onChange={(e) => onPatch({ hidden: e.target.checked } as Partial<WifiData>)}
            />
            Hidden network
          </label>
        </div>
      );
    }
    case 'vcard': {
      const v = data as VCardData;
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Row label="First name" apiKey="data.first_name">
            <input
              className={inputClass}
              value={v.first_name}
              onChange={(e) => onPatch({ first_name: e.target.value } as Partial<VCardData>)}
            />
          </Row>
          <Row label="Last name" apiKey="data.last_name">
            <input
              className={inputClass}
              value={v.last_name}
              onChange={(e) => onPatch({ last_name: e.target.value } as Partial<VCardData>)}
            />
          </Row>
          <Row label="Organisation" apiKey="data.org">
            <input
              className={inputClass}
              value={v.org ?? ''}
              onChange={(e) => onPatch({ org: e.target.value || null } as Partial<VCardData>)}
            />
          </Row>
          <Row label="Title / Role" apiKey="data.title_role">
            <input
              className={inputClass}
              value={v.title_role ?? ''}
              onChange={(e) => onPatch({ title_role: e.target.value || null } as Partial<VCardData>)}
            />
          </Row>
          <Row label="Phone" apiKey="data.phone">
            <input
              className={inputClass}
              value={v.phone ?? ''}
              onChange={(e) => onPatch({ phone: e.target.value || null } as Partial<VCardData>)}
            />
          </Row>
          <Row label="Email" apiKey="data.email">
            <input
              type="email"
              className={inputClass}
              value={v.email ?? ''}
              onChange={(e) => onPatch({ email: e.target.value || null } as Partial<VCardData>)}
            />
          </Row>
          <Row label="Website" apiKey="data.url">
            <input
              type="url"
              className={inputClass}
              value={v.url ?? ''}
              onChange={(e) => onPatch({ url: e.target.value || null } as Partial<VCardData>)}
            />
          </Row>
          <Row label="Address" apiKey="data.address">
            <input
              className={inputClass}
              value={v.address ?? ''}
              onChange={(e) => onPatch({ address: e.target.value || null } as Partial<VCardData>)}
            />
          </Row>
        </div>
      );
    }
    case 'email': {
      const m = data as EmailData;
      return (
        <div className="flex flex-col gap-3">
          <Row label="To" apiKey="data.to">
            <input
              type="email"
              className={inputClass}
              value={m.to}
              onChange={(e) => onPatch({ to: e.target.value } as Partial<EmailData>)}
            />
          </Row>
          <Row label="Subject" apiKey="data.subject">
            <input
              className={inputClass}
              value={m.subject ?? ''}
              onChange={(e) => onPatch({ subject: e.target.value || null } as Partial<EmailData>)}
            />
          </Row>
          <Row label="Body" apiKey="data.body">
            <textarea
              className={cn(inputClass, 'min-h-[100px]')}
              value={m.body ?? ''}
              onChange={(e) => onPatch({ body: e.target.value || null } as Partial<EmailData>)}
            />
          </Row>
        </div>
      );
    }
    case 'sms': {
      const s = data as SmsData;
      return (
        <div className="flex flex-col gap-3">
          <Row label="Phone number" apiKey="data.to">
            <input
              className={inputClass}
              value={s.to}
              onChange={(e) => onPatch({ to: e.target.value } as Partial<SmsData>)}
            />
          </Row>
          <Row label="Pre-filled message" apiKey="data.message">
            <textarea
              className={cn(inputClass, 'min-h-[80px]')}
              value={s.message ?? ''}
              onChange={(e) => onPatch({ message: e.target.value || null } as Partial<SmsData>)}
            />
          </Row>
        </div>
      );
    }
    case 'phone':
      return (
        <Row label="Phone number" apiKey="data.number" hint="Include country code, e.g. +15551234567">
          <input
            className={inputClass}
            value={(data as PhoneData).number}
            onChange={(e) => onPatch({ number: e.target.value } as Partial<PhoneData>)}
          />
        </Row>
      );
    case 'geo': {
      const g = data as GeoData;
      return (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Latitude" apiKey="data.lat">
            <input
              type="number"
              step="0.0001"
              className={inputClass}
              value={g.lat}
              onChange={(e) => onPatch({ lat: Number(e.target.value) } as Partial<GeoData>)}
            />
          </Row>
          <Row label="Longitude" apiKey="data.lng">
            <input
              type="number"
              step="0.0001"
              className={inputClass}
              value={g.lng}
              onChange={(e) => onPatch({ lng: Number(e.target.value) } as Partial<GeoData>)}
            />
          </Row>
        </div>
      );
    }
    case 'event': {
      const ev = data as EventData;
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Row label="Title" apiKey="data.title">
            <input
              className={inputClass}
              value={ev.title}
              onChange={(e) => onPatch({ title: e.target.value } as Partial<EventData>)}
            />
          </Row>
          <Row label="Location" apiKey="data.location">
            <input
              className={inputClass}
              value={ev.location ?? ''}
              onChange={(e) => onPatch({ location: e.target.value || null } as Partial<EventData>)}
            />
          </Row>
          <Row label="Starts" apiKey="data.start">
            <input
              type="datetime-local"
              className={inputClass}
              value={ev.start.slice(0, 16)}
              onChange={(e) => onPatch({ start: e.target.value } as Partial<EventData>)}
            />
          </Row>
          <Row label="Ends" apiKey="data.end">
            <input
              type="datetime-local"
              className={inputClass}
              value={ev.end.slice(0, 16)}
              onChange={(e) => onPatch({ end: e.target.value } as Partial<EventData>)}
            />
          </Row>
          <Row label="Description" apiKey="data.description">
            <textarea
              className={cn(inputClass, 'sm:col-span-2')}
              value={ev.description ?? ''}
              onChange={(e) => onPatch({ description: e.target.value || null } as Partial<EventData>)}
            />
          </Row>
        </div>
      );
    }
  }
}
