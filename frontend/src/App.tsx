import { useState } from 'react';

import { ApiPanel } from './components/ApiPanel';
import { BatchDialog } from './components/BatchDialog';
import { DataForms } from './components/DataForms';
import { ExportPanel } from './components/ExportPanel';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { HistoryPanel } from './components/HistoryPanel';
import { LogoUpload } from './components/LogoUpload';
import { PacksManager } from './components/PacksManager';
import { QRPreview } from './components/QRPreview';
import { Section } from './components/Section';
import { StyleControls } from './components/StyleControls';
import { TemplatesGallery } from './components/TemplatesGallery';
import { QRProvider } from './context/QRContext';
import { ToasterProvider } from './context/Toaster';
import { useQR } from './hooks/useQR';
import { cn } from './lib/utils';

type SavedTab = 'history' | 'packs' | 'presets';

function PanelTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="border-border flex gap-3 border-b">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px border-b px-1 pb-2 font-mono text-[11px] uppercase tracking-wider transition-colors',
            active === t.id
              ? 'border-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Workspace({ onOpenBatch }: { onOpenBatch: () => void }) {
  const { request } = useQR();
  const [savedTab, setSavedTab] = useState<SavedTab>('history');
  const isUrl = request.data.kind === 'url';

  return (
    <main className="relative">
      <Hero />

      <div className="border-border mx-auto max-w-7xl border-t px-6 py-8">
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-12">
          {/* LEFT — config */}
          <div className="flex flex-col gap-7 lg:col-span-4">
            <Section title="Logo" apiPath="style.logo">
              <LogoUpload />
            </Section>

            <Section title="Style" apiPath="style.*">
              <StyleControls />
            </Section>

            {!isUrl && (
              <Section title="Data" apiPath="data.*">
                <DataForms />
              </Section>
            )}
            {isUrl && (
              <details className="text-muted-foreground group">
                <summary className="hover:text-foreground inline-flex cursor-pointer items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
                  <span className="text-accent">+</span> different data type
                </summary>
                <div className="mt-3">
                  <DataForms />
                </div>
              </details>
            )}
          </div>

          {/* CENTER — preview + export */}
          <div className="lg:col-span-4 flex flex-col items-center gap-5">
            <QRPreview />
            <div className="border-border w-full max-w-[420px] border-t pt-4">
              <ExportPanel />
            </div>
          </div>

          {/* RIGHT — API + saved */}
          <div className="lg:col-span-4 flex flex-col gap-7">
            <div className="h-[440px] min-h-[400px]">
              <ApiPanel />
            </div>

            <Section
              title="Saved"
              rightSlot={
                <button
                  type="button"
                  onClick={onOpenBatch}
                  className="text-muted-foreground hover:text-foreground font-mono text-[10px] uppercase tracking-wider"
                >
                  Batch ↗
                </button>
              }
            >
              <PanelTabs<SavedTab>
                tabs={[
                  { id: 'history', label: 'History' },
                  { id: 'packs', label: 'Packs' },
                  { id: 'presets', label: 'Presets' },
                ]}
                active={savedTab}
                onChange={setSavedTab}
              />
              <div className="mt-3">
                {savedTab === 'history' && <HistoryPanel />}
                {savedTab === 'packs' && <PacksManager />}
                {savedTab === 'presets' && <TemplatesGallery />}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}

function AppShell() {
  const [batchOpen, setBatchOpen] = useState(false);

  return (
    <div className="text-foreground bg-background relative min-h-screen">
      <Header onOpenBatch={() => setBatchOpen(true)} />
      <Workspace onOpenBatch={() => setBatchOpen(true)} />

      <footer className="border-border text-muted-foreground mx-auto max-w-7xl border-t px-6 py-5 font-mono text-[11px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Tessera · open source · MIT
          </span>
          <div className="flex items-center gap-4 uppercase tracking-wider">
            <a className="hover:text-foreground transition-colors" href="/api/docs" target="_blank" rel="noreferrer">
              /api/docs
            </a>
            <a className="hover:text-foreground transition-colors" href="https://github.com/nikiomori/tessera" target="_blank" rel="noreferrer">
              github
            </a>
          </div>
        </div>
      </footer>

      <BatchDialog open={batchOpen} onClose={() => setBatchOpen(false)} />
    </div>
  );
}

export function App() {
  return (
    <ToasterProvider>
      <QRProvider>
        <AppShell />
      </QRProvider>
    </ToasterProvider>
  );
}
