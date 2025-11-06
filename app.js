const STORAGE_KEY = 'profiles.v2';

/** @typedef {{ id: string; name: string; username: string; imageDataUrl?: string }} Profile */
/** @typedef {{ id: string; name: string; keyword: string; profiles: Profile[] }} Category */

const cardsRow = document.getElementById('cardsRow');
const addDialog = document.getElementById('addProfileDialog');
const addForm = document.getElementById('addProfileForm');
const cancelAddBtn = document.getElementById('cancelAdd');

// Tabs
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    document.getElementById(id).classList.add('active');
  });
});

function readCategories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/** @param {Category[]} categories */
function writeCategories(categories) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

function getCurrentCategory() {
  const urlParams = new URLSearchParams(window.location.search);
  const categoryId = urlParams.get('category');
  if (!categoryId) return null;
  const categories = readCategories();
  return categories.find(c => c.id === categoryId) || null;
}

function normalizeInstagramUrl(url) {
  try {
    const u = new URL(url);
    if (!/instagram\.com$/i.test(u.hostname.replace(/^www\./, ''))) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    const username = parts[0];
    if (!username) return null;
    return { username, url: `https://instagram.com/${username}` };
  } catch {
    return null;
  }
}

function instaDeepLink(username) {
  // instagram://user?username=USERNAME works on iOS/Android; fall back to web
  return {
    appUrl: `instagram://user?username=${encodeURIComponent(username)}`,
    webUrl: `https://instagram.com/${encodeURIComponent(username)}`
  };
}

function createAddCard() {
  const add = document.createElement('div');
  add.className = 'add-card';
  const btn = document.createElement('button');
  btn.className = 'add-btn';
  btn.setAttribute('aria-label', 'Add profile');
  btn.textContent = '+';
  const label = document.createElement('span');
  label.textContent = 'Add a profile';
  add.appendChild(btn);
  add.appendChild(label);
  btn.addEventListener('click', () => addDialog.showModal());
  return add;
}

async function fetchInstagramProfile(username) {
  try {
    // Use Instagram's public API endpoint (no auth required for basic profile data)
    const response = await fetch(`https://www.instagram.com/${username}/?__a=1&__d=dis`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) throw new Error('Profile not found');
    const data = await response.json();
    
    const user = data.graphql?.user;
    if (!user) throw new Error('Invalid profile data');
    
    return {
      name: user.full_name || username,
      username: user.username,
      imageUrl: user.profile_pic_url_hd || user.profile_pic_url
    };
  } catch (error) {
    console.warn('Failed to fetch Instagram data:', error);
    return {
      name: username,
      username: username,
      imageUrl: null
    };
  }
}

function renderCategories() {
  const categories = readCategories();
  cardsRow.innerHTML = '';
  
  if (categories.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <h3>No categories yet</h3>
      <p>Create your first category to organize profiles</p>
    `;
    cardsRow.appendChild(empty);
  }
  
  categories.forEach(category => {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div class="category-info">
        <h3>${category.name}</h3>
      </div>
      <button class="btn primary" onclick="openCategory('${category.id}')">Open</button>
    `;
    cardsRow.appendChild(card);
  });
  
  const addCategoryCard = createAddCategoryCard();
  cardsRow.appendChild(addCategoryCard);
}

function renderProfiles(category) {
  cardsRow.innerHTML = '';
  
  // Add back button
  const backBtn = document.createElement('button');
  backBtn.className = 'btn ghost back-btn';
  backBtn.innerHTML = 'Back';
  backBtn.onclick = () => {
    window.location.href = 'index.html';
  };
  cardsRow.appendChild(backBtn);
  
  // Category header
  const header = document.createElement('div');
  header.className = 'category-header';
  header.innerHTML = `
    <h2>${category.name}</h2>
  `;
  cardsRow.appendChild(header);
  
  if (category.profiles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <h3>No profiles yet</h3>
      <p>Add profiles to this category</p>
    `;
    cardsRow.appendChild(empty);
  }
  
  category.profiles.forEach(p => {
    const tpl = /** @type {HTMLTemplateElement} */ (document.getElementById('cardTemplate'));
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = p.id;
    const avatar = node.querySelector('.avatar');
    const name = node.querySelector('.name');
    const username = node.querySelector('.username');
    const openBtn = node.querySelector('.btn.open');

    name.textContent = p.name;
    username.textContent = `@${p.username}`;
    if (p.imageDataUrl) {
      avatar.style.backgroundImage = `url(${p.imageDataUrl})`;
    }

    openBtn.addEventListener('click', () => {
      const { appUrl, webUrl } = instaDeepLink(p.username);
      const now = Date.now();
      // Try to open the app link; after a short timeout, navigate to web
      window.location.href = appUrl;
      setTimeout(() => {
        // If app didn't open, this will take over
        if (Date.now() - now < 1800) {
          window.open(webUrl, '_blank');
        }
      }, 1200);
    });

    cardsRow.appendChild(node);
  });

  // Add profile button
  const addCard = createAddCard();
  cardsRow.appendChild(addCard);
}

async function fileToDataUrl(file) {
  if (!file) return undefined;
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createAddCategoryCard() {
  const add = document.createElement('div');
  add.className = 'add-card';
  const btn = document.createElement('button');
  btn.className = 'add-btn';
  btn.setAttribute('aria-label', 'Add category');
  btn.textContent = '+';
  const label = document.createElement('span');
  label.textContent = 'Add a category';
  add.appendChild(btn);
  add.appendChild(label);
  btn.addEventListener('click', () => addCategoryDialog.showModal());
  return add;
}

function openCategory(categoryId) {
  window.location.href = `index.html?category=${categoryId}`;
}

// Make openCategory globally accessible
window.openCategory = openCategory;

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formError = document.getElementById('formError');
  formError.hidden = true;
  formError.textContent = '';

  const url = /** @type {HTMLInputElement} */ (document.getElementById('instagramUrl')).value.trim();
  const file = /** @type {HTMLInputElement} */ (document.getElementById('profileImage')).files?.[0];

  const norm = normalizeInstagramUrl(url);
  if (!norm) {
    formError.textContent = 'Please enter a valid Instagram profile URL.';
    formError.hidden = false;
    return;
  }

  // Show loading state
  const submitBtn = addForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Fetching...';
  submitBtn.disabled = true;

  try {
    // Fetch Instagram profile data
    const profileData = await fetchInstagramProfile(norm.username);
    
    const imageDataUrl = await fileToDataUrl(file);
    const categories = readCategories();
    const currentCategory = getCurrentCategory();
    
    if (!currentCategory) {
      formError.textContent = 'No category selected.';
      formError.hidden = false;
      return;
    }

    const id = crypto.randomUUID();
    const profile = { 
      id, 
      name: profileData.name, 
      username: profileData.username, 
      imageDataUrl: imageDataUrl || (profileData.imageUrl ? await fetchImageAsDataUrl(profileData.imageUrl) : null)
    };
    
    // Update the category
    const categoryIndex = categories.findIndex(c => c.id === currentCategory.id);
    if (categoryIndex !== -1) {
      categories[categoryIndex].profiles.push(profile);
      writeCategories(categories);
      renderProfiles(categories[categoryIndex]);
    }
    
    addDialog.close();
    addForm.reset();
  } catch (error) {
    formError.textContent = 'Failed to fetch profile data. Please try again.';
    formError.hidden = false;
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

cancelAddBtn.addEventListener('click', () => addDialog.close());

// Category management
const addCategoryDialog = document.getElementById('addCategoryDialog');
const addCategoryForm = document.getElementById('addCategoryForm');
const cancelCategoryBtn = document.getElementById('cancelCategory');

addCategoryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formError = document.getElementById('categoryFormError');
  formError.hidden = true;
  formError.textContent = '';

  const name = document.getElementById('categoryName').value.trim();
  const keyword = document.getElementById('categoryKeyword').value.trim();

  if (!name || !keyword) {
    formError.textContent = 'Please fill in all fields.';
    formError.hidden = false;
    return;
  }

  const categories = readCategories();
  const id = crypto.randomUUID();
  const category = { id, name, keyword, profiles: [] };
  categories.push(category);
  writeCategories(categories);
  renderCategories();
  addCategoryDialog.close();
  addCategoryForm.reset();
});

cancelCategoryBtn.addEventListener('click', () => addCategoryDialog.close());


const currentCategory = getCurrentCategory();
if (currentCategory) {
  renderProfiles(currentCategory);
} else {
  renderCategories();
}
