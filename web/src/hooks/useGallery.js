import { useQuery } from "./useQuery";

import { listGalleryPosts } from "../services/galleryApi";
import { toArray } from "../utils/toArray";

/**
 * Active gallery posts from GET /api/gallery/gallery/.
 *
 * The backend's queryset already returns only active posts for
 * anonymous visitors, so there is no client-side filtering here.
 */
export function useGallery() {
  const { data, error, loading, refetch } = useQuery(
    "/gallery/gallery/",
    listGalleryPosts,
    {
      select: toArray,
    }
  );

  return { posts: data || [], loading, error, reload: refetch };
}
