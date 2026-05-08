// Mirror of backend Pydantic models. Keep in sync with backend/app/models/qr_config.py.

export type WifiAuth = 'WPA' | 'WEP' | 'nopass';

export type DotShape = 'square' | 'rounded' | 'dots' | 'extra-rounded' | 'classy';
export type CornerSquareShape = 'square' | 'rounded' | 'dot';
export type CornerDotShape = 'square' | 'dot';
export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';
export type ImageFormat = 'png' | 'svg' | 'jpeg' | 'webp';

export type DataKind =
  | 'url'
  | 'text'
  | 'wifi'
  | 'vcard'
  | 'email'
  | 'sms'
  | 'phone'
  | 'geo'
  | 'event';

export interface UrlData {
  kind: 'url';
  url: string;
}

export interface TextData {
  kind: 'text';
  text: string;
}

export interface WifiData {
  kind: 'wifi';
  ssid: string;
  password: string;
  encryption: WifiAuth;
  hidden: boolean;
}

export interface VCardData {
  kind: 'vcard';
  first_name: string;
  last_name: string;
  org: string | null;
  title_role: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  address: string | null;
}

export interface EmailData {
  kind: 'email';
  to: string;
  subject: string | null;
  body: string | null;
}

export interface SmsData {
  kind: 'sms';
  to: string;
  message: string | null;
}

export interface PhoneData {
  kind: 'phone';
  number: string;
}

export interface GeoData {
  kind: 'geo';
  lat: number;
  lng: number;
}

export interface EventData {
  kind: 'event';
  title: string;
  start: string;
  end: string;
  location: string | null;
  description: string | null;
}

export type DataPayload =
  | UrlData
  | TextData
  | WifiData
  | VCardData
  | EmailData
  | SmsData
  | PhoneData
  | GeoData
  | EventData;

export interface GradientStop {
  offset: number;
  color: string;
}

export interface Gradient {
  type: 'linear' | 'radial';
  rotation: number;
  stops: GradientStop[];
}

export interface ColorOrGradient {
  color?: string | null;
  gradient?: Gradient | null;
}

export type LogoMode = 'silhouette';
export type BgRemovalMethod = 'none' | 'color';

export interface LogoConfig {
  image_data_url?: string | null;
  image_url?: string | null;
  site_url?: string | null;
  mode: LogoMode;
  size_ratio: number;

  // Silhouette mode
  logo_dot_color: string;
  preserve_logo_colors: boolean;
  logo_dot_scale: number;
  space_around: number;
  draw_border: boolean;

  // Detail / contrast
  subpixel: number;
  auto_contrast: boolean;
  auto_detail: boolean;

  bg_removal_method: BgRemovalMethod;
  bg_removal_color: string;
  bg_removal_threshold: number;
}

export interface StyleConfig {
  size: number;
  margin: number;
  error_correction: ErrorCorrection;
  matrix_version?: number | null;
  dot_shape: DotShape;
  dot_scale: number;
  dot_color: ColorOrGradient;
  background: ColorOrGradient;
  corner_square_shape: CornerSquareShape;
  corner_square_color?: string | null;
  corner_dot_shape: CornerDotShape;
  corner_dot_color?: string | null;
  logo?: LogoConfig | null;
}

export interface GenerateRequest {
  data: DataPayload;
  style: StyleConfig;
  format: ImageFormat;
}

export interface BatchItem {
  name?: string | null;
  request: GenerateRequest;
}

export interface BatchRequest {
  items: BatchItem[];
}

export interface Preset {
  id: string;
  name: string;
  description?: string | null;
  style: StyleConfig;
}
