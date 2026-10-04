// These are PUBLIC settings. Never paste a service_role key here.
export const CONFIG = {
  supabaseUrl: 'https://lmpxrbprqhgpaiteszhn.supabase.co',
  supabaseAnonKey: 'sb_publishable_oi9k6OGzZj8ok3bDfjQbUw_2_wqMdPQ',
  whatsappNumber: '96171815944', // Country code + number, digits only, e.g. 96170123456.
};

let clientPromise;
export function getClient() {
  if (!clientPromise) clientPromise = (async () => {
    if (!CONFIG.supabaseUrl.startsWith('https://') || CONFIG.supabaseAnonKey.startsWith('YOUR_')) {
      throw new Error('The catalog is not connected yet. Add your Supabase settings in js/supabase.js.');
    }
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
    return createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  })().catch(error => { clientPromise = undefined; throw error; });
  return clientPromise;
}

// Always render database text as text, never as HTML.
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export const money = value => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
  minimumFractionDigits: 0,
}).format(Number(value));
export const nameOf = laptop => `${laptop.brand} ${laptop.model}`;
export function statusBadge(status) {
  return element('span', `status ${status === 'sold' ? 'sold' : ''}`, status === 'sold' ? 'Sold' : 'Available');
}
export function laptopImage(laptop) {
  const wrap = element('div', 'image-wrap');
  const fallback = () => wrap.replaceChildren(element('span', 'image-placeholder', 'Image coming soon'));
  try {
    const url = new URL(laptop.image_url);
    if (url.protocol !== 'https:') throw new Error('Invalid image URL');
    const img = element('img');
    img.alt = nameOf(laptop); img.loading = 'lazy'; img.src = url.href;
    img.addEventListener('error', fallback, { once: true }); wrap.append(img);
  } catch { fallback(); }
  return wrap;
}
export function whatsappLink(laptop) {
  const link = element('a', 'button', 'WhatsApp');
  if (!/^[1-9]\d{6,14}$/.test(CONFIG.whatsappNumber)) {
    const unavailable = element('button', 'button', 'WhatsApp');
    unavailable.type = 'button'; unavailable.title = 'The shop contact number has not been configured.';
    unavailable.addEventListener('click', () => alert('The shop contact number has not been configured yet.'));
    return unavailable;
  }
  link.href = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(`Hello, I am interested in ${nameOf(laptop)} - ${money(laptop.price)}`)}`;
  link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
export function specifications(laptop) {
  const list = element('dl', 'specs');
  for (const [label, value] of [['CPU', laptop.cpu],['RAM', laptop.ram], ['SSD', laptop.storage], ['GPU', laptop.gpu]]) {
    const row = element('div'); row.append(element('dt', '', label), element('dd', '', value)); list.append(row);
  }
  return list;
}
