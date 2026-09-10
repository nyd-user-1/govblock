import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

// The template's upload hook, on our own route instead of UploadThing
// (2026-09-09): the same names and shape the media nodes read, a POST to
// /api/typeset/upload with the browser's progress events, and a stored file
// served back from the site's bucket. No mock on failure — an upload that did
// not happen is reported, not pretended.

export type UploadedFile = {
  key: string;
  name: string;
  size: number;
  type: string;
  url: string;
};

interface UseUploadFileProps {
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
}

function send(file: File, onProgress: (p: number) => void) {
  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append('file', file, file.name);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as UploadedFile & { error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && json.url) resolve(json);
        else reject(new Error(json.error ?? `Upload failed (${xhr.status}).`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('The upload could not reach the server.'));
    xhr.open('POST', '/api/typeset/upload');
    xhr.send(body);
  });
}

export function useUploadFile({
  onUploadComplete,
  onUploadError,
}: UseUploadFileProps = {}) {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);

  async function uploadFile(file: File) {
    setIsUploading(true);
    setUploadingFile(file);

    try {
      const res = await send(file, (p) => setProgress(Math.min(p, 100)));
      setUploadedFile(res);
      onUploadComplete?.(res);
      return res;
    } catch (error) {
      toast.error(getErrorMessage(error));
      onUploadError?.(error);
      return undefined;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
}

export function getErrorMessage(err: unknown) {
  const unknownError = 'Something went wrong, please try again later.';

  if (err instanceof z.ZodError) {
    const errors = err.issues.map((issue) => issue.message);

    return errors.join('\n');
  }
  if (err instanceof Error) {
    return err.message;
  }
  return unknownError;
}

export function showErrorToast(err: unknown) {
  const errorMessage = getErrorMessage(err);

  return toast.error(errorMessage);
}
