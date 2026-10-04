import { getClient, element, money, nameOf, statusBadge, laptopImage, whatsappLink, specifications } from './supabase.js';

const catalog = document.querySelector('#catalog');
const message = document.querySelector('#catalog-message');
const retry = document.querySelector('#retry');
const dialog = document.querySelector('#details');
document.querySelector('#close-details').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog && event.offsetX < 0) dialog.close(); });

function showDetails(laptop) {
  const content = document.querySelector('#details-content');
  const image = laptopImage(laptop); image.classList.add('detail-image');
  const title = element('h2', '', nameOf(laptop)); title.id = 'details-title';
  const priceRow = element('div', 'price-row'); priceRow.append(element('span', 'price', money(laptop.price)), statusBadge(laptop.status));
  content.replaceChildren(image, title, specifications(laptop), priceRow,
    element('p', 'description', laptop.description || 'Contact us for more information about this laptop.'), whatsappLink(laptop));
  dialog.showModal();
}

function card(laptop) {
  const article = element('article', 'card');
  const content = element('div', 'card-content');
  const priceRow = element('div', 'price-row'); priceRow.append(element('span', 'price', money(laptop.price)), statusBadge(laptop.status));
  const actions = element('div', 'actions');
  const details = element('button', 'button secondary', 'Details');
  details.setAttribute('aria-label', `Details for ${nameOf(laptop)}`);
  details.addEventListener('click', () => showDetails(laptop));
  actions.append(whatsappLink(laptop), details);
  content.append(element('p', 'card-brand', laptop.brand), element('h3', '', nameOf(laptop)), specifications(laptop), priceRow, actions);
  article.append(laptopImage(laptop), content); return article;
}

async function loadLaptops() {
  message.hidden = false; message.classList.remove('error'); message.textContent = 'Loading laptops…'; retry.hidden = true;
  try {
    const client = await getClient();
    // Fetch on every page load; admin changes need no static-site redeploy.
    const { data, error } = await client.from('laptops').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    catalog.replaceChildren(...data.map(card));
    document.querySelector('#catalog-count').textContent = `${data.length} laptop${data.length === 1 ? '' : 's'}`;
    message.textContent = 'New arrivals are on their way. Check back soon.'; message.hidden = data.length > 0;
  } catch (error) {
    console.error(error); message.classList.add('error');
    message.textContent = error.message.includes('not connected') ? error.message : 'We couldn’t load the laptops. Please try again.'; retry.hidden = false;
  }
}
retry.addEventListener('click', loadLaptops);
loadLaptops();
