import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, Crop, Trash2, Loader2 } from 'lucide-react';
import type { ImageWidgetProps, WidgetNode } from '@/lib/schema';
import { useTreeStore } from '@/stores/tree-store';
import { api, ApiError, NetworkError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ContentField } from './content-field';
import { ImageCropper } from './image-cropper';

/**
 * Image content: prefer backend asset upload (B8) so `src` is a hosted
 * time-limited object-store URL. Falls back to a data URL only
 * when there is no project id (demo) or the upload request fails.
 */
export function ImageContent({ node }: { node: WidgetNode }) {
  const { projectId } = useParams();
  const setProps = useTreeStore((s) => s.setProps);
  const props = node.props as ImageWidgetProps;
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const applySrc = (src: string) => {
    setProps(node.id, { src, width: undefined, height: undefined });
  };

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Could not read file.'));
      };
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      if (projectId && projectId !== 'demo') {
        try {
          const result = await api.uploadAsset(projectId, file);
          applySrc(result.url);
          return;
        } catch (err) {
          // Fall through to data URL so the user still gets a preview.
          const msg =
            err instanceof ApiError || err instanceof NetworkError
              ? err.message
              : 'Upload failed — using a local preview.';
          setError(msg);
        }
      }
      const dataUrl = await readAsDataUrl(file);
      applySrc(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load image.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ContentField label="Image">
        {props.src ? (
          <div className="overflow-hidden rounded-md border border-border">
            <div className="flex items-center justify-center bg-surface-sunken p-2">
              <img src={props.src} alt={props.alt} className="max-h-40 w-auto object-contain" />
            </div>
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border-strong bg-surface-sunken text-2xs text-foreground-subtle">
            No image
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            className="flex-1"
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? 'Uploading…' : props.src ? 'Replace' : 'Upload'}
          </Button>
          {props.src && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCropping((c) => !c)}
                disabled={uploading}
              >
                <Crop className="h-3.5 w-3.5" />
                Crop
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setProps(node.id, { src: '' })}
                aria-label="Remove image"
                disabled={uploading}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
        {error && <p className="mt-1 text-2xs text-danger">{error}</p>}
        {props.src && !props.src.startsWith('data:') && (
          <p className="mt-1 text-2xs text-foreground-subtle">Stored on project assets (B8).</p>
        )}
      </ContentField>

      {cropping && props.src && (
        <ImageCropper
          src={props.src}
          onApply={async (dataUrl) => {
            // Crop produces a data URL; re-upload as a blob when we have a project.
            setCropping(false);
            setUploading(true);
            setError(null);
            try {
              if (projectId && projectId !== 'demo') {
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], 'crop.png', { type: blob.type || 'image/png' });
                try {
                  const result = await api.uploadAsset(projectId, file);
                  applySrc(result.url);
                  return;
                } catch {
                  /* keep data URL */
                }
              }
              applySrc(dataUrl);
            } finally {
              setUploading(false);
            }
          }}
          onCancel={() => setCropping(false)}
        />
      )}

      <ContentField label="Alt text" hint="Describe the image for screen readers and SEO.">
        <Input
          key={props.alt}
          defaultValue={props.alt}
          onBlur={(e) => setProps(node.id, { alt: e.target.value })}
          placeholder="e.g. Team collaborating at a desk"
          className="h-8"
        />
      </ContentField>

      <ContentField label="Or image URL">
        <Input
          key={
            typeof props.src === 'string' && !props.src.startsWith('data:') ? props.src : 'data'
          }
          defaultValue={props.src.startsWith('data:') ? '' : props.src}
          placeholder="https://…"
          spellCheck={false}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v) setProps(node.id, { src: v, width: undefined, height: undefined });
          }}
          className="h-8"
        />
      </ContentField>
    </div>
  );
}
