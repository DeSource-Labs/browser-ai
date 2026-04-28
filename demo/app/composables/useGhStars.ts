import { ref, onMounted } from 'vue';

const CACHE_KEY = '@desource/browser-ai-demo.gh-stars';
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const DEFAULT_REPO = import.meta.env.PUBLIC_GITHUB_REPO || '';

/**
 * Fetches the star count for a GitHub repository
 * @param repo - Repository in format "owner/repo"
 * @returns Promise<number> - The star count
 */
export const getStarsCount = async (repo: string = DEFAULT_REPO): Promise<number> => {
  if (!repo) {
    return 0;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}`);

  if (!response.ok) {
    return 0;
  }

  const data = await response.json();
  return data.stargazers_count || 0;
};

const readCachedStars = () => {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (!cachedData) {
      return null;
    }

    return JSON.parse(cachedData) as { count: number; timestamp: number };
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
};

const writeCachedStars = (count: number) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        count,
        timestamp: Date.now()
      })
    );
  } catch {
    // Ignore storage errors; the star badge can still render without persistence.
  }
};

const getFreshStarsCount = async () => {
  try {
    return await getStarsCount();
  } catch {
    return 0;
  }
};

export function useGhStars() {
  const stars = ref<number | undefined>(undefined);

  const fetchStars = async () => {
    const cachedData = readCachedStars();
    const now = Date.now();

    if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
      stars.value = cachedData.count;
      return;
    }

    const count = await getFreshStarsCount();
    writeCachedStars(count);
    stars.value = count;
  };

  onMounted(() => {
    fetchStars();
  });

  return stars;
}
