import { useCallback, useEffect, useState } from "react";

import { listGalleryPosts } from "../services/galleryApi";

/**
 * Active gallery posts from GET /api/gallery/gallery/.
 *
 * The backend's queryset already returns only active posts for
 * anonymous visitors, so there is no client-side filtering here.
 */
export function useGallery() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    listGalleryPosts({ signal: controller.signal })
      .then((data) => {
        setPosts(Array.isArray(data) ? data : data?.results || []);
        setLoading(false);
      })
      .catch((apiError) => {
        if (apiError?.isCancelled) {
          return;
        }

        setError(apiError);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  return { posts, loading, error, reload };
}
