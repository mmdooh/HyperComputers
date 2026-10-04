import { getClient, element, money, nameOf, statusBadge, laptopImage, CONFIG } from './supabase.js';

const $ = selector => document.querySelector(selector);
const form = $('#laptop-form');
const editor = $('#editor');
let client, laptops = [], editing = null, saving = false, authRevision = 0;

function notice(text, error = false) {
  $('#admin-message').textContent = text;
  $('#admin-message').classList.toggle('error', error);
  $('#admin-message').hidden = !text;
}

async function loadLaptops() {
  const { data, error } = await client.from('laptops').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  laptops = data;
  const rows = data.map(laptop => {
    const row = element('article', 'admin-row');
    const info = element('div', 'admin-info');
    info.append(element('h3', '', nameOf(laptop)), element('span', 'price', money(laptop.price)), statusBadge(laptop.status));
    const actions = element('div', 'actions');
    for (const [label, action, danger] of [
      ['Edit', () => openEditor(laptop)],
      [laptop.status === 'sold' ? 'Mark available' : 'Mark sold', () => changeStatus(laptop)],
      ['Delete', () => deleteLaptop(laptop), true],
    ]) {
      const button = element('button', `button ${danger ? 'danger' : 'secondary'}`, label);
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await action(); } catch (error) { notice(error.message, true); }
        finally { button.disabled = false; }
      });
      actions.append(button);
    }
    row.append(laptopImage(laptop), info, actions); return row;
  });
  $('#admin-list').replaceChildren(...(rows.length ? rows : [element('p', 'notice', 'Your collection is empty. Add your first laptop to get started.')]));
}

async function updateSession(session) {
  const revision = ++authRevision;
  $('#dashboard').hidden = true; $('#login-section').hidden = true;
  if (editor.open) editor.close();
  if (!session) { $('#login-section').hidden = false; notice(''); return; }
  const { data: isAdmin, error } = await client.rpc('is_admin');
  if (revision !== authRevision) return;
  if (error || !isAdmin) {
    await client.auth.signOut();
    $('#login-section').hidden = false;
    notice(error ? 'Could not verify admin access. Check your Supabase setup.' : 'This account does not have admin access.', true);
    return;
  }
  $('#dashboard').hidden = false;
  try { await loadLaptops(); if (revision === authRevision) notice(''); }
  catch (error) { notice(`Could not load laptops: ${error.message}`, true); }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const values = new FormData(event.target);
    const { error } = await client.auth.signInWithPassword({ email: values.get('email').trim(), password: values.get('password') });
    if (error) throw error;
    event.target.reset();
  } catch (error) { notice(error.message, true); }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  const { error } = await client.auth.signOut(); if (error) notice(error.message, true);
});

function openEditor(laptop = null) {
  editing = laptop; form.reset(); $('#form-message').textContent = '';
  $('#editor-title').textContent = laptop ? 'Edit laptop' : 'Add laptop';
  if (laptop) for (const key of ['brand', 'model', 'cpu', 'ram', 'storage', 'gpu', 'price', 'status', 'description']) form.elements[key].value = laptop[key] ?? '';
  form.elements.image.required = !laptop;
  editor.showModal();
}
$('#add-laptop').addEventListener('click', () => openEditor());
for (const id of ['#close-editor', '#cancel-editor']) $(id).addEventListener('click', () => { if (!saving) editor.close(); });
editor.addEventListener('cancel', event => { if (saving) event.preventDefault(); });

// Only remove files from this project's bucket, never arbitrary URLs.
async function removeImage(url) {
  const prefix = `${CONFIG.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/laptop-images/`;
  if (!url || !url.startsWith(prefix)) return;
  const path = decodeURIComponent(url.slice(prefix.length));
  const { error } = await client.storage.from('laptop-images').remove([path]);
  if (error) throw error;
}

form.addEventListener('submit', async event => {
  event.preventDefault(); if (saving) return;
  saving = true; $('#form-message').textContent = '';
  const values = new FormData(form);
  const buttons = [...editor.querySelectorAll('button')]; buttons.forEach(button => button.disabled = true);
  let uploadedUrl = null, committed = false;
  try {
    const record = {};
    for (const field of ['brand', 'model', 'cpu', 'ram', 'storage', 'gpu', 'description']) record[field] = values.get(field).trim();
    for (const field of ['brand', 'model', 'cpu', 'ram', 'storage', 'gpu']) if (!record[field]) throw new Error(`${field.toUpperCase()} cannot be blank.`);
    record.price = Number(values.get('price')); record.status = values.get('status');
    if (!Number.isFinite(record.price) || record.price < 0 || record.price > 99999999.99) throw new Error('Enter a valid price.');
    record.image_url = editing?.image_url || '';
    const file = values.get('image');
    if (file.size) {
      const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      if (!extensions[file.type] || file.size > 5 * 1024 * 1024) throw new Error('Choose a JPEG, PNG, or WebP image under 5 MB.');
      const path = `${crypto.randomUUID()}.${extensions[file.type]}`;
      const { error } = await client.storage.from('laptop-images').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploadedUrl = client.storage.from('laptop-images').getPublicUrl(path).data.publicUrl;
      record.image_url = uploadedUrl;
    }
    if (!record.image_url) throw new Error('Please choose a laptop image.');
    const query = editing ? client.from('laptops').update(record).eq('id', editing.id) : client.from('laptops').insert(record);
    const { error } = await query.select('id').single();
    if (error) throw error;
    committed = true;
    let cleanupWarning = '';
    if (uploadedUrl && editing?.image_url) {
      try { await removeImage(editing.image_url); } catch { cleanupWarning = ' The old image could not be removed; you can delete it in Supabase Storage.'; }
    }
    editor.close(); notice(`Laptop saved.${cleanupWarning}`);
    try { await loadLaptops(); } catch { notice('Laptop saved. Reload this page to refresh the list.', true); }
  } catch (error) {
    let cleanupWarning = '';
    if (uploadedUrl && !committed) {
      try { await removeImage(uploadedUrl); } catch { cleanupWarning = ' An unused upload remains in Supabase Storage.'; }
    }
    $('#form-message').textContent = error.message + cleanupWarning;
  } finally { saving = false; buttons.forEach(button => button.disabled = false); }
});

async function changeStatus(laptop) {
  const status = laptop.status === 'sold' ? 'available' : 'sold';
  const { error } = await client.from('laptops').update({ status }).eq('id', laptop.id).select('id').single();
  if (error) throw error;
  notice(`Marked ${status}.`); await loadLaptops();
}
async function deleteLaptop(laptop) {
  if (!confirm(`Delete ${nameOf(laptop)}? This cannot be undone.`)) return;
  const { error } = await client.from('laptops').delete().eq('id', laptop.id).select('id').single();
  if (error) throw error;
  let warning = '';
  try { await removeImage(laptop.image_url); } catch { warning = ' Its image could not be removed; delete it in Supabase Storage.'; }
  notice(`Laptop deleted.${warning}`); await loadLaptops();
}

async function initialize() {
  try {
    client = await getClient();
    // Defer Supabase calls outside the auth callback to avoid holding its session lock.
    client.auth.onAuthStateChange((event, session) => {
      if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) setTimeout(() => updateSession(session), 0);
    });
  } catch (error) { notice(error.message, true); }
}
initialize();
