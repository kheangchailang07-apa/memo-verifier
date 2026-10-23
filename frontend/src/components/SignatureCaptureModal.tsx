import React, { useEffect, useRef, useState } from 'react';
import { normalizeSignatureImage, trimSignatureCanvas } from '../utils/signature';
import { X, PenLine, Upload, Eraser, Check, Loader2, AlertCircle } from 'lucide-react';

type CaptureMode = 'draw' | 'upload';

interface SignatureCaptureModalProps {
  open: boolean;
  onClose: () => void;
  /** Receives the PNG data URL and the display file name of the signature. */
  onSave: (dataUrl: string, fileName: string) => void | Promise<void>;
  /** Currently stored signature, shown as the starting point. */
  initialDataUrl?: string | null;
  initialFileName?: string | null;
  /** Title of the dialog, e.g. "Add your electronic signature". */
  title?: string;
  /** Name of the account the signature belongs to. */
  ownerName?: string;
}

/** Internal resolution of the drawing pad (the CSS size scales it down). */
const PAD_WIDTH = 900;
const PAD_HEIGHT = 280;

/**
 * Signature capture: either draw the signature with a mouse/finger or upload
 * a PNG/JPEG artwork exported from a signature tool such as Canva. Both routes
 * end up as a trimmed PNG data URL that can be stored and printed on the
 * acknowledgement proof PDF.
 */
export const SignatureCaptureModal: React.FC<SignatureCaptureModalProps> = ({
  open,
  onClose,
  onSave,
  initialDataUrl = null,
  initialFileName = '',
  title = 'Add your electronic signature',
  ownerName = '',
}) => {
  const [mode, setMode] = useState<CaptureMode>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(initialDataUrl);
  const [fileName, setFileName] = useState<string>(initialFileName || '');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // A fresh pad every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setPreview(initialDataUrl || null);
    setFileName(initialFileName || '');
    setMode('draw');
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
    }
  }, [open, initialDataUrl, initialFileName]);

  // The pad is drawn on a transparent background so the trim step can cut
  // exactly around the ink and the PDF shows no white box.
  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    setIsDrawing(true);
    const point = getPoint(event);
    lastPointRef.current = point;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + 0.01, point.y + 0.01);
    ctx.stroke();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    event.preventDefault();
    const point = getPoint(event);
    const last = lastPointRef.current || point;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    setIsDrawing(false);
  };

  const clearPad = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPreview(null);
    setError(null);
  };

  const hasInk = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 20) return true;
    }
    return false;
  };

  const handleUpload = async (file?: File) => {
    if (!file) return;
    setError(null);
    setIsProcessing(true);
    try {
      const normalized = await normalizeSignatureImage(file);
      setPreview(normalized.dataUrl);
      setFileName(normalized.fileName);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'The signature image could not be processed.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setIsProcessing(true);
    try {
      let dataUrl: string | null = null;
      let name = fileName;

      if (mode === 'draw') {
        if (!hasInk()) {
          setError('Draw your signature in the box before saving.');
          setIsProcessing(false);
          return;
        }
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('The signature pad is not ready.');
        dataUrl = trimSignatureCanvas(canvas);
        name = name || 'drawn-signature';
      } else {
        dataUrl = preview;
        if (!dataUrl) {
          setError('Upload a signature image first.');
          setIsProcessing(false);
          return;
        }
      }

      await onSave(dataUrl, name);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : 'The signature could not be saved.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {ownerName ? `${ownerName} — ` : ''}
              This signature is printed on your acknowledgement proof PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-200/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Mode switch */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
            <button
              type="button"
              onClick={() => setMode('draw')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                mode === 'draw'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Draw</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                mode === 'upload'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload image</span>
            </button>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'draw' ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2">
                <canvas
                  ref={canvasRef}
                  width={PAD_WIDTH}
                  height={PAD_HEIGHT}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  onPointerCancel={stopDrawing}
                  className={`w-full h-[150px] touch-none rounded-lg ${
                    isDrawing ? 'cursor-grabbing' : 'cursor-crosshair'
                  }`}
                />
                <div className="flex items-center justify-between px-1 pt-2">
                  <span className="text-[10px] text-slate-400">
                    Sign with your mouse, trackpad or finger.
                  </span>
                  <button
                    type="button"
                    onClick={clearPad}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {isProcessing ? 'Processing…' : 'Choose a PNG or JPEG image'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Export your artwork from Canva (PNG with a transparent background works best).
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => void handleUpload(e.target.files?.[0])}
                />
              </label>

              {preview && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3">
                  <div className="h-20 flex items-center justify-center">
                    <img
                      src={preview}
                      alt="Signature preview"
                      className="max-h-20 max-w-full object-contain"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 text-center truncate">
                    {fileName || 'signature.png'}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isProcessing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-bold flex items-center gap-1.5"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Use this signature</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
