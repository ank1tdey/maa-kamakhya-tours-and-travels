'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const cfg = window.MKTT_CONFIG || {};
  const configured = /^https:\/\/[\w-]+\.supabase\.co$/.test(cfg.SUPABASE_URL || '') &&
    typeof cfg.SUPABASE_ANON_KEY === 'string' && cfg.SUPABASE_ANON_KEY.length > 30;

  const setupNotice = $('#setupNotice');
  const loginView = $('#loginView');
  const appView = $('#appView');
  const required = ['#loginForm', '#signOut', '#packageForm', '#offerForm', '#galleryForm', '#packageList', '#offerList', '#galleryList'];
  const missing = required.filter((selector) => !$(selector));

  if (missing.length) {
    console.error('Admin dashboard HTML is missing required elements:', missing);
    if (setupNotice) {
      setupNotice.hidden = false;
      setupNotice.textContent = 'Dashboard HTML is incomplete. Check the admin page structure.';
    }
    return;
  }

  if (!configured || !window.supabase) {
    if (setupNotice) {
      setupNotice.hidden = false;
      setupNotice.textContent = 'Admin setup is not connected yet. Check config.js and the Supabase CDN script.';
    }
    if (loginView) loginView.hidden = true;
    if (appView) appView.hidden = true;
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const bucket = 'website-gallery';
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  let packages = [];
  let offers = [];
  let photos = [];
  let packagePreviewUrl = null;
  let packageImageRemoved = false;

  const message = (selector, text, isError = false) => {
    const element = $(selector);
    if (!element) return;
    element.textContent = text;
    element.style.color = isError ? '#b42318' : '#2456bd';
  };

  const validateImage = (file) => {
    if (!file) return 'Choose an image first.';
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Choose a JPG, PNG or WebP image.';
    if (file.size > MAX_IMAGE_SIZE) return 'Image must be 5 MB or smaller.';
    return '';
  };

  const extensionFor = (file) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]);
  const newStoragePath = (file, prefix) => `${prefix}/${crypto.randomUUID()}.${extensionFor(file)}`;

  async function uploadImage(file, prefix) {
    const validationError = validateImage(file);
    if (validationError) throw new Error(validationError);
    const path = newStoragePath(file, prefix);
    const { error } = await db.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    });
    if (error) throw error;
    const { data } = db.storage.from(bucket).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function removeStorageFile(path) {
    if (!path) return;
    const { error } = await db.storage.from(bucket).remove([path]);
    if (error) throw error;
  }

  async function refreshData() {
    const [packageResult, offerResult, galleryResult] = await Promise.all([
      db.from('packages').select('*').order('sort_order', { ascending: true }),
      db.from('offers').select('*').order('created_at', { ascending: false }),
      db.from('gallery').select('*').order('created_at', { ascending: false })
    ]);
    for (const result of [packageResult, offerResult, galleryResult]) {
      if (result.error) throw result.error;
    }
    packages = packageResult.data || [];
    offers = offerResult.data || [];
    photos = galleryResult.data || [];
    render();
  }

  async function runQuery(query, target, successText = 'Saved successfully.') {
    try {
      const { error } = await query;
      if (error) throw error;
      message(target, successText);
      await refreshData();
      return true;
    } catch (error) {
      console.error(error);
      message(target, error.message || 'Something went wrong.', true);
      return false;
    }
  }

  function renderList(container, rows, type) {
    container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = `No ${type} added yet.`;
      container.append(empty);
      return;
    }
    rows.forEach((row) => {
      const item = document.createElement('article');
      item.className = 'item';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = row.title || 'Untitled';
      info.append(title);
      const detail = document.createElement('p');
      detail.textContent = type === 'packages'
        ? `${row.description || ''}${row.price == null ? '' : ` · ₹${row.price}`}`
        : `${row.description || ''} · ${row.is_active ? 'Visible' : 'Hidden'}`;
      info.append(detail);
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.dataset[type === 'packages' ? 'editPackage' : 'editOffer'] = String(row.id);
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Delete';
      del.className = 'danger';
      del.dataset[type === 'packages' ? 'deletePackage' : 'deleteOffer'] = String(row.id);
      actions.append(edit, del);
      item.append(info, actions);
      container.append(item);
    });
  }

  function render() {
    renderList($('#packageList'), packages, 'packages');
    renderList($('#offerList'), offers, 'offers');
    const gallery = $('#galleryList');
    gallery.replaceChildren();
    if (!photos.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No gallery photos uploaded yet.';
      gallery.append(empty);
      return;
    }
    photos.forEach((photo) => {
      const card = document.createElement('article');
      card.className = 'photo';
      const img = document.createElement('img');
      img.src = photo.image_url;
      img.alt = photo.alt_text || 'Gallery photo';
      const caption = document.createElement('p');
      caption.textContent = photo.alt_text || '';
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Delete photo';
      del.className = 'danger';
      del.dataset.deletePhoto = String(photo.id);
      card.append(img, caption, del);
      gallery.append(card);
    });
  }

  function clearPackagePreview() {
    if (packagePreviewUrl) URL.revokeObjectURL(packagePreviewUrl);
    packagePreviewUrl = null;
    const wrap = $('#packageImagePreviewWrap');
    const image = $('#packageImagePreview');
    if (wrap) wrap.hidden = true;
    if (image) image.removeAttribute('src');
  }

  function showPackagePreview(src) {
    clearPackagePreview();
    if (!src) return;
    const wrap = $('#packageImagePreviewWrap');
    const image = $('#packageImagePreview');
    if (!wrap || !image) return;
    image.src = src;
    wrap.hidden = false;
  }

  function resetPackage() {
    $('#packageForm').reset();
    $('#packageId').value = '';
    $('#packageCategory').value = 'SIGHTSEEING';
    $('#packageFile').value = '';
    packageImageRemoved = false;
    clearPackagePreview();
    message('#packageMessage', '');
  }

  function resetOffer() {
    $('#offerForm').reset();
    $('#offerId').value = '';
    $('#offerButton').value = 'Enquire Now';
    $('#offerActive').checked = true;
    message('#offerMessage', '');
  }

  function activateTab(tabName) {
    document.querySelectorAll('[data-tab]').forEach((button) => {
      const active = button.dataset.tab === tabName;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    ['packages', 'offers', 'gallery'].forEach((name) => {
      const panel = $(`#${name}Panel`);
      if (panel) panel.hidden = name !== tabName;
    });
  }

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
  });

  $('#packageFile').addEventListener('change', () => {
    const file = $('#packageFile').files[0];
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      $('#packageFile').value = '';
      message('#packageMessage', validationError, true);
      return;
    }
    packageImageRemoved = false;
    packagePreviewUrl = URL.createObjectURL(file);
    const image = $('#packageImagePreview');
    image.src = packagePreviewUrl;
    $('#packageImagePreviewWrap').hidden = false;
    message('#packageMessage', 'Image selected. It will upload when you save the package.');
  });

  $('#removePackageImage').addEventListener('click', () => {
    $('#packageFile').value = '';
    $('#packageImage').value = '';
    packageImageRemoved = true;
    clearPackagePreview();
    message('#packageMessage', 'Image will be removed when you save the package.');
  });

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    message('#loginMessage', 'Signing in…');
    const { error } = await db.auth.signInWithPassword({
      email: $('#email').value.trim(),
      password: $('#password').value
    });
    if (error) {
      message('#loginMessage', error.message, true);
      return;
    }
    await checkSession();
  });

  $('#signOut').addEventListener('click', async () => {
    const { error } = await db.auth.signOut();
    if (error) message('#loginMessage', error.message, true);
    await checkSession();
  });

  $('#packageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('#packageId').value;
    const rawPrice = $('#packagePrice').value.trim();
    const existing = id ? packages.find((item) => String(item.id) === id) : null;
    const selectedFile = $('#packageFile').files[0];
    const row = {
      title: $('#packageTitle').value.trim(),
      description: $('#packageDescription').value.trim(),
      category: $('#packageCategory').value.trim() || 'SIGHTSEEING',
      price: rawPrice === '' ? null : Number(rawPrice),
      image_url: $('#packageImage').value.trim() || null,
      image_path: existing?.image_path || null
    };

    if (!row.title || !row.description || (row.price !== null && (!Number.isFinite(row.price) || row.price < 0))) {
      message('#packageMessage', 'Enter a package name, description and a valid non-negative price.', true);
      return;
    }
    if (selectedFile) {
      const validationError = validateImage(selectedFile);
      if (validationError) {
        message('#packageMessage', validationError, true);
        return;
      }
    }

    let newlyUploadedPath = null;
    try {
      if (selectedFile) {
        message('#packageMessage', 'Uploading image…');
        const uploaded = await uploadImage(selectedFile, 'packages');
        newlyUploadedPath = uploaded.path;
        row.image_url = uploaded.url;
        row.image_path = uploaded.path;
      } else if (packageImageRemoved) {
        row.image_url = null;
        row.image_path = null;
      }

      const result = id
        ? await db.from('packages').update(row).eq('id', id)
        : await db.from('packages').insert(row);
      if (result.error) throw result.error;

      // Delete the previous managed image only after the database update succeeds.
      if (existing?.image_path && existing.image_path !== row.image_path) {
        try {
          await removeStorageFile(existing.image_path);
        } catch (storageError) {
          console.error('Package saved, but old image cleanup failed:', storageError);
          message('#packageMessage', 'Package saved, but the old image could not be removed from storage.', true);
          await refreshData();
          resetPackage();
          return;
        }
      }

      message('#packageMessage', id ? 'Package updated.' : 'Package added.');
      resetPackage();
      await refreshData();
    } catch (error) {
      if (newlyUploadedPath) {
        try { await removeStorageFile(newlyUploadedPath); }
        catch (cleanupError) { console.error('Could not clean up failed package upload:', cleanupError); }
      }
      console.error(error);
      message('#packageMessage', error.message || 'Could not save package.', true);
    }
  });

  $('#offerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('#offerId').value;
    const row = {
      title: $('#offerTitle').value.trim(),
      description: $('#offerDescription').value.trim(),
      button_label: $('#offerButton').value.trim() || 'Enquire Now',
      is_active: $('#offerActive').checked
    };
    if (!row.title || !row.description) {
      message('#offerMessage', 'Enter an offer title and description.', true);
      return;
    }
    const query = id ? db.from('offers').update(row).eq('id', id) : db.from('offers').insert(row);
    const saved = await runQuery(query, '#offerMessage', id ? 'Offer updated.' : 'Offer added.');
    if (saved) resetOffer();
  });

  $('#galleryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = $('#galleryFile').files[0];
    const altText = $('#galleryAlt').value.trim();
    const validationError = validateImage(file);
    if (validationError) {
      message('#galleryMessage', validationError, true);
      return;
    }
    if (!altText) {
      message('#galleryMessage', 'Add a short image description.', true);
      return;
    }
    let uploadedPath = null;
    try {
      message('#galleryMessage', 'Uploading photo…');
      const uploaded = await uploadImage(file, 'gallery');
      uploadedPath = uploaded.path;
      const { error } = await db.from('gallery').insert({
        image_path: uploaded.path,
        image_url: uploaded.url,
        alt_text: altText
      });
      if (error) throw error;
      $('#galleryForm').reset();
      message('#galleryMessage', 'Photo uploaded successfully.');
      await refreshData();
    } catch (error) {
      if (uploadedPath) {
        try { await removeStorageFile(uploadedPath); }
        catch (cleanupError) { console.error('Could not clean up failed gallery upload:', cleanupError); }
      }
      console.error(error);
      message('#galleryMessage', error.message || 'Photo upload failed.', true);
    }
  });

  $('#packageList').addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-package]');
    const del = event.target.closest('[data-delete-package]');
    if (edit) {
      const row = packages.find((item) => String(item.id) === edit.dataset.editPackage);
      if (!row) return;
      resetPackage();
      $('#packageId').value = row.id;
      $('#packageTitle').value = row.title || '';
      $('#packageDescription').value = row.description || '';
      $('#packageCategory').value = row.category || 'SIGHTSEEING';
      $('#packagePrice').value = row.price ?? '';
      $('#packageImage').value = row.image_path ? '' : (row.image_url || '');
      packageImageRemoved = false;
      if (row.image_url) showPackagePreview(row.image_url);
      activateTab('packages');
      $('#packageTitle').focus();
    }
    if (del && window.confirm('Delete this package? Its uploaded image will also be removed.')) {
      const row = packages.find((item) => String(item.id) === del.dataset.deletePackage);
      if (!row) return;
      const { error } = await db.from('packages').delete().eq('id', row.id);
      if (error) {
        message('#packageMessage', error.message || 'Could not delete package.', true);
        return;
      }
      if (row.image_path) {
        try { await removeStorageFile(row.image_path); }
        catch (storageError) {
          console.error('Package deleted, but image cleanup failed:', storageError);
          message('#packageMessage', 'Package deleted, but its stored image could not be removed.', true);
          await refreshData();
          return;
        }
      }
      message('#packageMessage', 'Package deleted.');
      await refreshData();
    }
  });

  $('#offerList').addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-offer]');
    const del = event.target.closest('[data-delete-offer]');
    if (edit) {
      const row = offers.find((item) => String(item.id) === edit.dataset.editOffer);
      if (!row) return;
      $('#offerId').value = row.id;
      $('#offerTitle').value = row.title || '';
      $('#offerDescription').value = row.description || '';
      $('#offerButton').value = row.button_label || 'Enquire Now';
      $('#offerActive').checked = Boolean(row.is_active);
      activateTab('offers');
      $('#offerTitle').focus();
    }
    if (del && window.confirm('Delete this offer?')) {
      await runQuery(db.from('offers').delete().eq('id', del.dataset.deleteOffer), '#offerMessage', 'Offer deleted.');
    }
  });

  $('#galleryList').addEventListener('click', async (event) => {
    const del = event.target.closest('[data-delete-photo]');
    if (!del || !window.confirm('Delete this photo?')) return;
    const photo = photos.find((item) => String(item.id) === del.dataset.deletePhoto);
    if (!photo) return;
    try {
      await removeStorageFile(photo.image_path);
      const { error } = await db.from('gallery').delete().eq('id', photo.id);
      if (error) throw error;
      message('#galleryMessage', 'Photo deleted.');
      await refreshData();
    } catch (error) {
      console.error(error);
      message('#galleryMessage', error.message || 'Could not delete photo.', true);
    }
  });

  $('#cancelPackage').addEventListener('click', resetPackage);
  $('#cancelOffer').addEventListener('click', resetOffer);

  async function checkSession() {
    try {
      const { data, error: sessionError } = await db.auth.getSession();
      if (sessionError) throw sessionError;
      const session = data.session;
      if (!session) {
        loginView.hidden = false;
        appView.hidden = true;
        $('#signOut').hidden = true;
        return;
      }
      const { data: admin, error: adminError } = await db.from('admin_users')
        .select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (adminError || !admin) {
        await db.auth.signOut();
        loginView.hidden = false;
        appView.hidden = true;
        $('#signOut').hidden = true;
        message('#loginMessage', adminError?.message || 'Access denied. This account is not an authorised administrator.', true);
        return;
      }
      loginView.hidden = true;
      appView.hidden = false;
      $('#signOut').hidden = false;
      $('#userEmail').textContent = session.user.email || '';
      await refreshData();
    } catch (error) {
      console.error(error);
      loginView.hidden = false;
      appView.hidden = true;
      message('#loginMessage', error.message || 'Unable to load dashboard.', true);
    }
  }

  activateTab('packages');
  checkSession();
})();
