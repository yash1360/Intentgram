/**
 * TypeScript utilities for profile and category management
 * Provides type-safe functions with better error handling and type checking
 */

// Type definitions
export interface Profile {
  id: string;
  name: string;
  username: string;
  imageDataUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  profiles: Profile[];
}

export interface NormalizedInstagramUrl {
  username: string;
  url: string;
}

export interface InstagramDeepLink {
  appUrl: string;
  webUrl: string;
}

export interface InstagramProfileData {
  name: string;
  username: string;
  imageUrl: string | null;
}

// Storage key constant
export const STORAGE_KEY = 'profiles.v2' as const;

/**
 * Type-safe function to read categories from localStorage
 * @returns Array of categories, or empty array if none exist or on error
 */
export function readCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    
    const parsed: unknown = JSON.parse(raw);
    
    // Type guard to ensure parsed data is an array
    if (!Array.isArray(parsed)) {
      console.warn('Invalid data format in localStorage');
      return [];
    }
    
    // Validate that each item has the required Category structure
    return parsed.filter((item): item is Category => 
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'name' in item &&
      'profiles' in item &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      Array.isArray(item.profiles)
    );
  } catch (error) {
    console.error('Error reading categories from localStorage:', error);
    return [];
  }
}

/**
 * Type-safe function to write categories to localStorage
 * @param categories - Array of categories to store
 * @throws Error if categories is not an array
 */
export function writeCategories(categories: Category[]): void {
  if (!Array.isArray(categories)) {
    throw new TypeError('Categories must be an array');
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch (error) {
    console.error('Error writing categories to localStorage:', error);
    throw new Error('Failed to save categories to localStorage');
  }
}

/**
 * Get the current category from URL parameters
 * @returns The category if found, null otherwise
 */
export function getCurrentCategory(): Category | null {
  const urlParams = new URLSearchParams(window.location.search);
  const categoryId = urlParams.get('category');
  
  if (!categoryId) return null;
  
  const categories = readCategories();
  return categories.find((c: Category) => c.id === categoryId) ?? null;
}

/**
 * Normalize and validate an Instagram URL
 * @param url - The Instagram URL to normalize
 * @returns Normalized URL object with username and URL, or null if invalid
 */
export function normalizeInstagramUrl(url: string): NormalizedInstagramUrl | null {
  if (typeof url !== 'string' || !url.trim()) {
    return null;
  }
  
  try {
    const u = new URL(url);
    const hostname = u.hostname.replace(/^www\./, '');
    
    if (!/instagram\.com$/i.test(hostname)) {
      return null;
    }
    
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    
    const username = parts[0];
    if (!username || username.length === 0) {
      return null;
    }
    
    return {
      username,
      url: `https://instagram.com/${username}`
    };
  } catch (error) {
    console.warn('Invalid URL format:', error);
    return null;
  }
}

/**
 * Generate Instagram deep link URLs for app and web
 * @param username - Instagram username
 * @returns Object with appUrl and webUrl
 */
export function instaDeepLink(username: string): InstagramDeepLink {
  if (typeof username !== 'string' || !username.trim()) {
    throw new TypeError('Username must be a non-empty string');
  }
  
  const encodedUsername = encodeURIComponent(username);
  return {
    appUrl: `instagram://user?username=${encodedUsername}`,
    webUrl: `https://instagram.com/${encodedUsername}`
  };
}

/**
 * Fetch Instagram profile data from public API
 * @param username - Instagram username to fetch
 * @returns Profile data with name, username, and imageUrl
 */
export async function fetchInstagramProfile(username: string): Promise<InstagramProfileData> {
  if (typeof username !== 'string' || !username.trim()) {
    throw new TypeError('Username must be a non-empty string');
  }
  
  try {
    const response = await fetch(`https://www.instagram.com/${username}/?__a=1&__d=dis`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: unknown = await response.json();
    
    // Type guard for Instagram API response
    if (
      typeof data === 'object' &&
      data !== null &&
      'graphql' in data &&
      typeof data.graphql === 'object' &&
      data.graphql !== null &&
      'user' in data.graphql &&
      typeof data.graphql.user === 'object' &&
      data.graphql.user !== null
    ) {
      const user = data.graphql.user as {
        full_name?: string;
        username?: string;
        profile_pic_url_hd?: string;
        profile_pic_url?: string;
      };
      
      if (!user.username) {
        throw new Error('Invalid profile data: missing username');
      }
      
      return {
        name: user.full_name ?? username,
        username: user.username,
        imageUrl: user.profile_pic_url_hd ?? user.profile_pic_url ?? null
      };
    }
    
    throw new Error('Invalid profile data structure');
  } catch (error) {
    console.warn('Failed to fetch Instagram data:', error);
    // Return fallback data instead of throwing
    return {
      name: username,
      username: username,
      imageUrl: null
    };
  }
}

/**
 * Convert a File object to a data URL
 * @param file - File object to convert
 * @returns Promise resolving to data URL string, or undefined if no file provided
 */
export async function fileToDataUrl(file: File | null | undefined): Promise<string | undefined> {
  if (!file) {
    return undefined;
  }
  
  if (!(file instanceof File)) {
    throw new TypeError('Expected a File object');
  }
  
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Fetch an image from a URL and convert it to a data URL
 * @param imageUrl - URL of the image to fetch
 * @returns Promise resolving to data URL string, or null if fetch fails
 */
export async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
    throw new TypeError('Image URL must be a non-empty string');
  }
  
  try {
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to data URL'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading blob'));
      };
      
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Failed to fetch image:', error);
    return null;
  }
}

/**
 * Create a new profile object with generated ID
 * @param name - Profile name
 * @param username - Instagram username
 * @param imageDataUrl - Optional image data URL
 * @returns New Profile object
 */
export function createProfile(
  name: string,
  username: string,
  imageDataUrl?: string
): Profile {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('Name must be a non-empty string');
  }
  
  if (typeof username !== 'string' || !username.trim()) {
    throw new TypeError('Username must be a non-empty string');
  }
  
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    username: username.trim(),
    imageDataUrl: imageDataUrl?.trim() || undefined
  };
}

/**
 * Create a new category object with generated ID
 * @param name - Category name
 * @param profiles - Optional array of profiles (defaults to empty array)
 * @returns New Category object
 */
export function createCategory(
  name: string,
  profiles: Profile[] = []
): Category {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('Name must be a non-empty string');
  }
  
  if (!Array.isArray(profiles)) {
    throw new TypeError('Profiles must be an array');
  }
  
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    profiles: [...profiles] // Create a copy to avoid mutations
  };
}

/**
 * Find a category by ID
 * @param categoryId - The category ID to search for
 * @returns The category if found, null otherwise
 */
export function findCategoryById(categoryId: string): Category | null {
  if (typeof categoryId !== 'string' || !categoryId.trim()) {
    return null;
  }
  
  const categories = readCategories();
  return categories.find((c: Category) => c.id === categoryId) ?? null;
}

/**
 * Add a profile to a category
 * @param categoryId - The category ID to add the profile to
 * @param profile - The profile to add
 * @returns true if successful, false if category not found
 */
export function addProfileToCategory(categoryId: string, profile: Profile): boolean {
  const categories = readCategories();
  const categoryIndex = categories.findIndex((c: Category) => c.id === categoryId);
  
  if (categoryIndex === -1) {
    return false;
  }
  
  categories[categoryIndex].profiles.push(profile);
  writeCategories(categories);
  return true;
}

/**
 * Remove a profile from a category
 * @param categoryId - The category ID
 * @param profileId - The profile ID to remove
 * @returns true if successful, false if category or profile not found
 */
export function removeProfileFromCategory(categoryId: string, profileId: string): boolean {
  const categories = readCategories();
  const categoryIndex = categories.findIndex((c: Category) => c.id === categoryId);
  
  if (categoryIndex === -1) {
    return false;
  }
  
  const profileIndex = categories[categoryIndex].profiles.findIndex(
    (p: Profile) => p.id === profileId
  );
  
  if (profileIndex === -1) {
    return false;
  }
  
  categories[categoryIndex].profiles.splice(profileIndex, 1);
  writeCategories(categories);
  return true;
}

/**
 * Delete a category by ID
 * @param categoryId - The category ID to delete
 * @returns true if successful, false if category not found
 */
export function deleteCategory(categoryId: string): boolean {
  const categories = readCategories();
  const initialLength = categories.length;
  const filtered = categories.filter((c: Category) => c.id !== categoryId);
  
  if (filtered.length === initialLength) {
    return false; // Category not found
  }
  
  writeCategories(filtered);
  return true;
}

