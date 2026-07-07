import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AuthenticatedImage({ photoId, alt = 'Foto da instalação', className = '' }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;

    async function load() {
      try {
        const blob = await api.getContractPhotoBlob(photoId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (error) return <div className={`photo-placeholder ${className}`}>Foto indisponível</div>;
  if (!src) return <div className={`photo-placeholder loading ${className}`}>Carregando...</div>;

  return <img src={src} alt={alt} className={className} />;
}
