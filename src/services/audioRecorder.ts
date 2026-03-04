/**
 * Audio Recording Service — SRP-compliant, separated from UI.
 * Handles MediaRecorder with cross-browser MIME type detection.
 */

export interface RecordedAudio {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Navegador não suporta gravação de áudio.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const preferred = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  let mimeType = "";
  if (window.MediaRecorder?.isTypeSupported) {
    mimeType = preferred.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  const startedAt = Date.now();

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stop = () =>
    new Promise<RecordedAudio>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Falha ao gravar áudio."));
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        const durationMs = Date.now() - startedAt;
        stream.getTracks().forEach((t) => t.stop());
        resolve({ blob, mimeType: blob.type, durationMs });
      };
      recorder.stop();
    });

  recorder.start();

  return { stop, recorder, mimeType: recorder.mimeType || mimeType };
}
