const searchInput = document.getElementById('productSearch');
const filterButtons = [...document.querySelectorAll('.filter-btn')];
const productCards = [...document.querySelectorAll('.catalog-card')];
const productCount = document.getElementById('productCount');
const emptyState = document.getElementById('catalogEmpty');
let activeCategory = new URLSearchParams(location.search).get('category') || 'all';

if (!filterButtons.some(button => button.dataset.filter === activeCategory)) activeCategory = 'all';

function updateCatalog() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = 0;
  productCards.forEach(card => {
    const categoryMatch = activeCategory === 'all' || card.dataset.category === activeCategory;
    const textMatch = !query || `${card.dataset.name} ${card.textContent}`.toLowerCase().includes(query);
    const show = categoryMatch && textMatch;
    card.hidden = !show;
    if (show) visible += 1;
  });
  productCount.textContent = `${visible} product${visible === 1 ? '' : 's'} shown`;
  emptyState.hidden = visible !== 0;
  filterButtons.forEach(button => button.classList.toggle('active', button.dataset.filter === activeCategory));
}

filterButtons.forEach(button => button.addEventListener('click', () => {
  activeCategory = button.dataset.filter;
  history.replaceState({}, '', activeCategory === 'all' ? 'products.html' : `products.html?category=${activeCategory}`);
  updateCatalog();
}));
searchInput.addEventListener('input', updateCatalog);
updateCatalog();
