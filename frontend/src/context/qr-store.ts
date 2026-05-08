import { createContext } from 'react';

import { emptyData, initialRequest } from '@/lib/defaults';
import type {
  ColorOrGradient,
  CornerDotShape,
  CornerSquareShape,
  DataKind,
  DataPayload,
  DotShape,
  ErrorCorrection,
  GenerateRequest,
  ImageFormat,
  LogoConfig,
  StyleConfig,
} from '@/types/qr';

export type QRAction =
  | { type: 'set-data-kind'; kind: DataKind }
  | { type: 'patch-data'; patch: Partial<DataPayload> }
  | { type: 'patch-style'; patch: Partial<StyleConfig> }
  | { type: 'set-dot-color'; value: ColorOrGradient }
  | { type: 'set-background'; value: ColorOrGradient }
  | { type: 'set-dot-shape'; value: DotShape }
  | { type: 'set-corner-square'; shape?: CornerSquareShape; color?: string | null }
  | { type: 'set-corner-dot'; shape?: CornerDotShape; color?: string | null }
  | { type: 'set-size'; value: number }
  | { type: 'set-margin'; value: number }
  | { type: 'set-error-correction'; value: ErrorCorrection }
  | { type: 'set-logo'; logo: LogoConfig | null }
  | { type: 'set-format'; format: ImageFormat }
  | { type: 'replace'; request: GenerateRequest }
  | { type: 'apply-style'; style: StyleConfig }
  | { type: 'reset' };

/**
 * How the current logo was obtained. Lives outside the wire-format request
 * because the backend doesn't need it — but the API-call panel uses it to
 * pick a snippet shape that matches the user's actual workflow (URL fetch
 * vs. local file) instead of dumping the inlined base64.
 */
export type LogoOrigin =
  | { kind: 'auto-brand'; pageUrl: string }
  | { kind: 'file' }
  | null;

export interface QRContextValue {
  request: GenerateRequest;
  dispatch: (action: QRAction) => void;
  logoOrigin: LogoOrigin;
  setLogoOrigin: (origin: LogoOrigin) => void;
}

export const QRContext = createContext<QRContextValue | null>(null);

/** Pure reducer for the QR config. Exported so `QRProvider` can wire it up. */
export function qrReducer(state: GenerateRequest, action: QRAction): GenerateRequest {
  switch (action.type) {
    case 'set-data-kind':
      return { ...state, data: emptyData(action.kind) };
    case 'patch-data':
      return { ...state, data: { ...state.data, ...action.patch } as DataPayload };
    case 'patch-style':
      return { ...state, style: { ...state.style, ...action.patch } };
    case 'set-dot-color':
      return { ...state, style: { ...state.style, dot_color: action.value } };
    case 'set-background':
      return { ...state, style: { ...state.style, background: action.value } };
    case 'set-dot-shape':
      return { ...state, style: { ...state.style, dot_shape: action.value } };
    case 'set-corner-square':
      return {
        ...state,
        style: {
          ...state.style,
          ...(action.shape !== undefined && { corner_square_shape: action.shape }),
          ...(action.color !== undefined && { corner_square_color: action.color }),
        },
      };
    case 'set-corner-dot':
      return {
        ...state,
        style: {
          ...state.style,
          ...(action.shape !== undefined && { corner_dot_shape: action.shape }),
          ...(action.color !== undefined && { corner_dot_color: action.color }),
        },
      };
    case 'set-size':
      return { ...state, style: { ...state.style, size: action.value } };
    case 'set-margin':
      return { ...state, style: { ...state.style, margin: action.value } };
    case 'set-error-correction':
      return { ...state, style: { ...state.style, error_correction: action.value } };
    case 'set-logo': {
      // Tighten dot_scale on first attach so the silhouette reads clearly
      // against the surrounding QR pattern.
      const wasNull = state.style.logo == null;
      const becomingPresent = action.logo != null;
      const tightenedDotScale = Math.min(state.style.dot_scale, 0.9);
      const next = action.logo;
      let logoOut = next;
      if (next && wasNull) {
        logoOut = { ...next, logo_dot_scale: tightenedDotScale };
      } else if (next && next.logo_dot_scale > 1) {
        // Clamp legacy values that pre-date the 100% slider cap.
        logoOut = { ...next, logo_dot_scale: 1 };
      }
      const autoBumps =
        wasNull && becomingPresent ? { dot_scale: tightenedDotScale } : {};
      return {
        ...state,
        style: {
          ...state.style,
          ...autoBumps,
          logo: logoOut,
          error_correction: action.logo ? 'H' : state.style.error_correction,
        },
      };
    }
    case 'set-format':
      return { ...state, format: action.format };
    case 'replace':
      return action.request;
    case 'apply-style':
      return { ...state, style: { ...action.style, logo: state.style.logo } };
    case 'reset':
      return initialRequest;
  }
}
