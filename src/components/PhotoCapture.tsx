import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { uploadRulePhoto } from '../lib/storage';

interface PhotoCaptureProps {
  tournament_id: string;
  player_number: number;
  rule_key: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onClear: () => void;
}

export default function PhotoCapture({
  tournament_id,
  player_number,
  rule_key,
  currentUrl,
  onUploaded,
  onClear,
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onChoose = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadRulePhoto({
        tournament_id,
        player_number,
        rule_key,
        file,
      });
      onUploaded(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setBusy(false);
      // Reset the input so picking the same file twice still fires onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        Photo
      </div>
      {/* No `capture` attribute — iOS Safari has long-standing bugs with
          the in-line camera (black viewfinder, no shutter). Without it,
          iOS shows the native sheet with Take Photo / Photo Library /
          Files; Android shows a similar chooser. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
      {currentUrl ? (
        <div className="flex items-center gap-2">
          <img
            src={currentUrl}
            alt="Captured proof"
            className="h-16 w-16 rounded-lg border border-slate-700 object-cover"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={onChoose}
              disabled={busy}
              className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-200 disabled:opacity-50"
            >
              {busy ? 'Uploading…' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-rose-300"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onChoose}
          disabled={busy}
          className="self-start rounded-md border border-dashed border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : '📷 Take or pick a photo'}
        </button>
      )}
    </div>
  );
}
