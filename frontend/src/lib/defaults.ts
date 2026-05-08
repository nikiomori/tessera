import type {
  DataKind,
  DataPayload,
  GenerateRequest,
  StyleConfig,
} from '@/types/qr';

export const defaultStyle: StyleConfig = {
  size: 512,
  margin: 4,
  error_correction: 'M',
  matrix_version: null,
  dot_shape: 'square',
  dot_scale: 1.0,
  dot_color: { color: '#000000' },
  background: { color: '#FFFFFF' },
  corner_square_shape: 'square',
  corner_dot_shape: 'square',
  corner_square_color: null,
  corner_dot_color: null,
  logo: null,
};

export const defaultLogo = {
  mode: 'silhouette' as const,
  size_ratio: 0.6,
  logo_dot_color: '#000000',
  preserve_logo_colors: true,
  logo_dot_scale: 1.0,
  space_around: 1,
  draw_border: false,
  subpixel: 3,
  auto_contrast: true,
  auto_detail: true,
  bg_removal_method: 'color' as const,
  bg_removal_color: '#FFFFFF',
  bg_removal_threshold: 15,
};

export function emptyData(kind: DataKind): DataPayload {
  switch (kind) {
    case 'url':
      return { kind, url: 'https://example.com' };
    case 'text':
      return { kind, text: 'Hello, world' };
    case 'wifi':
      return { kind, ssid: 'My Network', password: '', encryption: 'WPA', hidden: false };
    case 'vcard':
      return {
        kind,
        first_name: 'Ada',
        last_name: 'Lovelace',
        org: null,
        title_role: null,
        phone: null,
        email: 'ada@example.com',
        url: null,
        address: null,
      };
    case 'email':
      return { kind, to: 'someone@example.com', subject: null, body: null };
    case 'sms':
      return { kind, to: '+15551234567', message: null };
    case 'phone':
      return { kind, number: '+15551234567' };
    case 'geo':
      return { kind, lat: 40.7128, lng: -74.006 };
    case 'event':
      return {
        kind,
        title: 'Team meeting',
        start: '2026-05-10T14:00:00',
        end: '2026-05-10T15:00:00',
        location: null,
        description: null,
      };
  }
}

export const initialRequest: GenerateRequest = {
  data: emptyData('url'),
  style: defaultStyle,
  format: 'png',
};

export const dataKindLabels: Record<DataKind, string> = {
  url: 'URL',
  text: 'Text',
  wifi: 'Wi-Fi',
  vcard: 'vCard',
  email: 'Email',
  sms: 'SMS',
  phone: 'Phone',
  geo: 'Geo',
  event: 'Event',
};
