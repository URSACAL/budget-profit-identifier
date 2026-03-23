// ============================================================
// SIDEBAR
// ============================================================

function toggleSidebar() {
  document.querySelector('.wrapper').classList.toggle('collapse');
}

function setActive(el) {
  document.querySelectorAll('.sidebar ul li a').forEach(a => a.classList.remove('active'));
  el.classList.add('active');
}

// ============================================================
// SMOOTH SCROLL
// ============================================================

document.querySelectorAll('.sidebar a[href^="#"]').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ============================================================
// IMAGE UPLOAD PREVIEW
// ============================================================

const preview    = document.getElementById('preview');
const imageInput = document.getElementById('imageInput');

if (imageInput) {
  imageInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        // Store image against current product key
        const key = getCurrentProductKey();
        if (key) localStorage.setItem(key + '_image', e.target.result);
      };
      reader.readAsDataURL(this.files[0]);
    }
  });
}

// ============================================================
// VAT RATE TOGGLE
// ============================================================

function toggleVatRate(checkbox) {
  const vatRate = document.getElementById('VAT_RATE');
  vatRate.disabled = !checkbox.checked;
  if (!checkbox.checked) vatRate.value = '';
  calculateOrderSummary();
}

// ============================================================
// MULTI-PRODUCT STORAGE HELPERS
// Products are stored as an array of keys in localStorage:
//   'productKeys'      → JSON array of product name keys
//   '{key}_data'       → product profile data
//   '{key}_image'      → base64 image
//   '{key}_productIng' → productIngTable rows
//   '{key}_productItems'→ productItemsTable rows
// Session-only (cleared on refresh): all other tables
// ============================================================

// Tracks which product is currently loaded (null = new unsaved product)
let currentProductKey = null;

function getCurrentProductKey() {
  return currentProductKey;
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function getAllProductKeys() {
  return JSON.parse(localStorage.getItem('productKeys') || '[]');
}

function getAllProducts() {
  // Returns array of { key, name } sorted alphabetically by name
  return getAllProductKeys()
    .map(key => {
      const raw = localStorage.getItem(key + '_data');
      if (!raw) return null;
      const d = JSON.parse(raw);
      return { key, name: d.name || key };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function registerProductKey(key) {
  const keys = getAllProductKeys();
  if (!keys.includes(key)) {
    keys.push(key);
    localStorage.setItem('productKeys', JSON.stringify(keys));
  }
}

function removeProductKey(key) {
  const keys = getAllProductKeys().filter(k => k !== key);
  localStorage.setItem('productKeys', JSON.stringify(keys));
  // Remove all associated data
  [
    '_data', '_image', '_productIng', '_productItems'
  ].forEach(suffix => localStorage.removeItem(key + suffix));
}

// ============================================================
// NUMERIC CELLS
// ============================================================

const NUMERIC_COLS = {
  ingredientTable: [2, 3, 4],
  itemsTable:      [2, 3, 4],
  opexTable:       [1]
};

const PESO_COLS = {
  ingredientTable: [2, 4],
  itemsTable:      [2, 4],
  opexTable:       [1]
};

function applyNumericCells(tableId) {
  const cols     = NUMERIC_COLS[tableId];
  const pesoCols = PESO_COLS[tableId] || [];
  if (!cols) return;
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
    cols.forEach(colIndex => {
      const td = tr.cells[colIndex];
      if (td) setupNumericCell(td, pesoCols.includes(colIndex));
    });
  });
}

function setupNumericCell(td, showPeso = true) {
  if (!td.textContent.trim()) td.textContent = showPeso ? '₱' : '';

  // Clone to remove duplicate listeners
  const newTd = td.cloneNode(true);
  td.parentNode.replaceChild(newTd, td);

  newTd.addEventListener('keydown', function (e) {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', '.'];
    if (!/^\d$/.test(e.key) && !allowed.includes(e.key)) e.preventDefault();
  });

  newTd.addEventListener('input', function () {
    const val = newTd.textContent.replace(/[^0-9.]/g, '');
    newTd.textContent = showPeso ? '₱' + val : val;
    const range = document.createRange();
    const sel   = window.getSelection();
    range.selectNodeContents(newTd);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    const tr = newTd.closest('tr');
    if (tr) calculateUnitCost(tr);
  });

  newTd.addEventListener('blur', function () {
    const raw = newTd.textContent.replace(/[^0-9.]/g, '');
    if (!raw) newTd.textContent = showPeso ? '₱' : '';
  });
}

// ============================================================
// UNIT DROPDOWNS
// ============================================================

function getUnits(sourceTableId) {
  const units = [];
  document.querySelectorAll(`#${sourceTableId} tbody tr`).forEach(tr => {
    const val = tr.querySelector('td')?.textContent.trim();
    if (val) units.push(val);
  });
  return units;
}

function buildUnitDropdown(td, sourceTableId) {
  const units   = getUnits(sourceTableId);
  const current = td.querySelector('select') ? td.querySelector('select').value : td.textContent.trim();

  td.contentEditable = 'false';
  td.innerHTML = '';

  const select = document.createElement('select');
  select.style.cssText = `
    width: 100%; border: none; background: transparent;
    font-family: Montserrat, sans-serif; font-size: 13px;
    cursor: pointer; outline: none;
  `;

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '-- Select --';
  select.appendChild(defaultOpt);

  units.forEach(unit => {
    const opt = document.createElement('option');
    opt.value = unit;
    opt.textContent = unit;
    if (unit === current) opt.selected = true;
    select.appendChild(opt);
  });

  td.appendChild(select);
}

function applyUnitDropdowns(targetTableId, sourceTableId) {
  document.querySelectorAll(`#${targetTableId} tbody tr`).forEach(tr => {
    const unitCell = tr.cells[5];
    if (unitCell) buildUnitDropdown(unitCell, sourceTableId);
  });
}

function refreshUnitDropdowns(targetTableId, sourceTableId) {
  const units = getUnits(sourceTableId);
  document.querySelectorAll(`#${targetTableId} tbody tr`).forEach(tr => {
    const unitCell = tr.cells[5];
    if (!unitCell) return;
    const select = unitCell.querySelector('select');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select --';
    select.appendChild(defaultOpt);
    units.forEach(unit => {
      const opt = document.createElement('option');
      opt.value = unit;
      opt.textContent = unit;
      if (unit === current) opt.selected = true;
      select.appendChild(opt);
    });
  });
}

function watchUnitSource(sourceTableId, targetTableId) {
  document.querySelectorAll(`#${sourceTableId} tbody td`).forEach(td => {
    td.addEventListener('input', () => refreshUnitDropdowns(targetTableId, sourceTableId));
  });
}

function observeUnitTable(sourceTableId, targetTableId) {
  const tbody = document.querySelector(`#${sourceTableId} tbody`);
  if (!tbody) return;
  new MutationObserver(() => refreshUnitDropdowns(targetTableId, sourceTableId))
    .observe(tbody, { childList: true, subtree: true, characterData: true });
}

// ============================================================
// AUTO CALCULATE UNIT COST
// Col: [2]=PackagePrice [3]=QtyPerPack [4]=ShippingFee [6]=UnitCost
// ============================================================

function calculateUnitCost(tr) {
  const packagePrice = parseFloat(tr.cells[2]?.textContent.replace('₱', '').trim()) || 0;
  const qtyPerPack   = parseFloat(tr.cells[3]?.textContent.trim()) || 0;
  const shippingFee  = parseFloat(tr.cells[4]?.textContent.replace('₱', '').trim()) || 0;
  const unitCostCell = tr.cells[6];
  if (!unitCostCell) return;
  unitCostCell.textContent = qtyPerPack === 0
    ? '₱'
    : '₱' + ((packagePrice + shippingFee) / qtyPerPack).toFixed(2);
}

function makeUnitCostReadonly(tr) {
  const cell = tr.cells[6];
  if (!cell) return;
  cell.contentEditable = 'false';
  cell.style.background = '#f5f5f5';
  cell.style.cursor     = 'not-allowed';
  cell.style.color      = '#555';
}

function attachUnitCostWatcher(tr) {
  [2, 3, 4].forEach(colIndex => {
    const td = tr.cells[colIndex];
    if (td) td.addEventListener('input', () => calculateUnitCost(tr));
  });
}

function applyUnitCostListeners(tableId) {
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
    makeUnitCostReadonly(tr);
    attachUnitCostWatcher(tr);
  });
}

function recalculateAllUnitCosts() {
  ['ingredientTable', 'itemsTable'].forEach(tableId => {
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
      calculateUnitCost(tr);
      makeUnitCostReadonly(tr);
    });
  });
}

// ============================================================
// PRODUCT SECTION — SHARED DROPDOWN + AUTO-FILL
// ============================================================

const PRODUCT_TABLE_CONFIG = {
  productIngTable: {
    sourceTable: 'ingredientTable',
    nameCol:     0,
    unitCol:     5,
    unitCostCol: 6
  },
  productItemsTable: {
    sourceTable: 'itemsTable',
    nameCol:     0,
    unitCol:     5,
    unitCostCol: 6
  }
};

function getSourceData(productTableId) {
  const cfg  = PRODUCT_TABLE_CONFIG[productTableId];
  const data = [];
  document.querySelectorAll(`#${cfg.sourceTable} tbody tr`).forEach(tr => {
    const name     = tr.cells[cfg.nameCol]?.textContent.trim();
    const unitCell = tr.cells[cfg.unitCol];
    const unit     = unitCell?.querySelector('select')
                       ? unitCell.querySelector('select').value
                       : unitCell?.textContent.trim();
    const unitCost = tr.cells[cfg.unitCostCol]?.textContent.replace('₱', '').trim();
    if (name) data.push({ name, unit, unitCost });
  });
  return data;
}

function buildProductDropdown(td, productTableId) {
  const items   = getSourceData(productTableId);
  const current = td.dataset.selected || '';

  td.contentEditable = 'false';
  td.innerHTML = '';

  const select = document.createElement('select');
  select.style.cssText = `
    width: 100%; border: none; background: transparent;
    font-family: Montserrat, sans-serif; font-size: 13px;
    cursor: pointer; outline: none;
  `;

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '-- Select --';
  select.appendChild(defaultOpt);

  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.textContent = item.name;
    if (item.name === current) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', function () {
    td.dataset.selected = this.value;
    autoFillProductRow(td.closest('tr'), this.value, productTableId);
  });

  td.appendChild(select);

  if (current) autoFillProductRow(td.closest('tr'), current, productTableId);
}

function autoFillProductRow(tr, selectedName, productTableId) {
  const item         = getSourceData(productTableId).find(i => i.name === selectedName);
  const unitCell     = tr.cells[2];
  const unitCostCell = tr.cells[3];
  const qtyCell      = tr.cells[1];
  const costCell     = tr.cells[4];

  if (!item || !selectedName) {
    [unitCell, unitCostCell, costCell].forEach(c => { if (c) c.textContent = ''; });
    return;
  }

  if (unitCell)     unitCell.textContent     = item.unit || '';
  if (unitCostCell) unitCostCell.textContent = item.unitCost
                                                 ? '₱' + parseFloat(item.unitCost).toFixed(2)
                                                 : '';

  const qty = parseFloat(qtyCell?.textContent.trim()) || 0;
  const uc  = parseFloat(item.unitCost) || 0;
  if (costCell) costCell.textContent = (qty > 0 && uc > 0) ? '₱' + (qty * uc).toFixed(2) : '';
}

function setupProductQtyCell(td, productTableId) {
  td.contentEditable = 'true';
  td.style.background = '#f0fdf4';
  td.style.cursor     = 'text';

  td.addEventListener('keydown', function (e) {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', '.', 'Home', 'End'];
    if (!/^\d$/.test(e.key) && !allowed.includes(e.key)) e.preventDefault();
  });

  td.addEventListener('input', function () {
    const raw = td.textContent.replace(/[^0-9.]/g, '');
    td.textContent = raw;
    const range = document.createRange();
    const sel   = window.getSelection();
    range.selectNodeContents(td);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    const tr           = td.closest('tr');
    const selectedName = tr.cells[0]?.dataset?.selected || '';
    autoFillProductRow(tr, selectedName, productTableId);
  });
}

function makeReadonlyProductCell(td) {
  td.contentEditable = 'false';
  td.style.background = '#f5f5f5';
  td.style.cursor     = 'not-allowed';
  td.style.color      = '#555';
}

function initProductRow(tr, productTableId) {
  buildProductDropdown(tr.cells[0], productTableId);
  setupProductQtyCell(tr.cells[1], productTableId);
  makeReadonlyProductCell(tr.cells[2]);
  makeReadonlyProductCell(tr.cells[3]);
  makeReadonlyProductCell(tr.cells[4]);
}

function applyProductTable(productTableId) {
  document.querySelectorAll(`#${productTableId} tbody tr`)
    .forEach(tr => initProductRow(tr, productTableId));
}

function addProductRow(productTableId) {
  const tbody = document.querySelector(`#${productTableId} tbody`);
  if (!tbody) return;
  const tr = document.createElement('tr');
  for (let i = 0; i < 5; i++) tr.appendChild(document.createElement('td'));
  tbody.appendChild(tr);
  initProductRow(tr, productTableId);
}

function removeProductRow(productTableId) {
  const table = document.getElementById(productTableId);
  if (table && table.rows.length > 2) table.deleteRow(table.rows.length - 1);
}

function observeSourceTableForProduct(productTableId) {
  const cfg   = PRODUCT_TABLE_CONFIG[productTableId];
  const tbody = document.querySelector(`#${cfg.sourceTable} tbody`);
  if (!tbody) return;
  new MutationObserver(() => {
    document.querySelectorAll(`#${productTableId} tbody tr`).forEach(tr => {
      const selected = tr.cells[0]?.dataset?.selected || '';
      buildProductDropdown(tr.cells[0], productTableId);
      if (selected) {
        const sel = tr.cells[0].querySelector('select');
        if (sel) { sel.value = selected; autoFillProductRow(tr, selected, productTableId); }
      }
    });
  }).observe(tbody, { childList: true, subtree: true, characterData: true });
}

// ============================================================
// LOCK / UNLOCK
// ============================================================

function lockAll() {
  document.querySelectorAll('input').forEach(input => input.disabled = true);
  document.querySelectorAll('#productIngTable select, #productItemsTable select')
    .forEach(s => s.disabled = true);
  document.querySelectorAll('[contenteditable]').forEach(cell => {
    cell.contentEditable = 'false';
    cell.style.background = '';
    cell.style.cursor = 'default';
    cell.style.color  = '';
  });
  document.querySelectorAll('.table-actions button').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.4';
  });
  const img = document.querySelector('.product-image');
  if (img) { img.style.pointerEvents = 'none'; img.style.opacity = '0.7'; }

  document.getElementById('editBtn').style.display = 'inline-block';
  document.getElementById('saveBtn').style.display = 'none';

  // Keep discount rate and contingency rate always interactive
  const discountRate    = document.getElementById('DISCOUNT_RATE');
  const contingencyRate = document.getElementById('contingencyRate');
  if (discountRate)    discountRate.disabled    = false;
  if (contingencyRate) contingencyRate.disabled = false;

  recalculateAllUnitCosts();
}

function unlockAll() {
  document.querySelectorAll('input').forEach(input => input.disabled = false);
  document.querySelectorAll('#productIngTable select, #productItemsTable select')
    .forEach(s => s.disabled = false);
  document.querySelectorAll('[contenteditable]').forEach(cell => {
    cell.contentEditable = 'true';
    cell.style.background = '#f0fdf4';
    cell.style.cursor = 'text';
  });
  document.querySelectorAll('.table-actions button').forEach(btn => {
    btn.disabled = false;
    btn.style.opacity = '1';
  });
  const img = document.querySelector('.product-image');
  if (img) { img.style.pointerEvents = 'auto'; img.style.opacity = '1'; }

  document.getElementById('editBtn').style.display = 'none';
  document.getElementById('saveBtn').style.display = 'inline-block';

  // Apply all features (order matters)
  applyUnitDropdowns('ingredientTable', 'typesOfunit');
  applyUnitDropdowns('itemsTable', 'itemsUnit');
  applyNumericCells('ingredientTable');
  applyNumericCells('itemsTable');
  applyNumericCells('opexTable');
  applyUnitCostListeners('ingredientTable');
  applyUnitCostListeners('itemsTable');
  applyProductTable('productIngTable');
  applyProductTable('productItemsTable');
  recalculateAllUnitCosts();

  // Restore VAT rate state
  const vatCheckbox = document.getElementById('VAT');
  if (vatCheckbox) document.getElementById('VAT_RATE').disabled = !vatCheckbox.checked;
}

function enableEdit() { unlockAll(); }

// ============================================================
// SAVE PRODUCT
// Saves product section data to localStorage under a named key.
// All other sections (ingredients, items, opex) are session-only.
// ============================================================

function saveProduct() {
  const name = document.querySelector('.options').textContent.trim();
  if (!name || name === 'Product Name') {
    showToast('Please enter a product name first.');
    return;
  }

  const key = slugify(name);
  currentProductKey = key;

  const productData = {
    name,
    vat:          document.getElementById('VAT').checked,
    vatRate:      document.getElementById('VAT_RATE').value,
    batch:        document.getElementById('BATCH').value,
    margin:       document.getElementById('MARGIN').value,
    discountRate: document.getElementById('DISCOUNT_RATE').value
  };

  localStorage.setItem(key + '_data', JSON.stringify(productData));
  registerProductKey(key);

  saveProductTable('productIngTable',   key + '_productIng');
  saveProductTable('productItemsTable', key + '_productItems');

  // Save image if changed
  if (preview.src && !preview.src.includes('placehold.co')) {
    localStorage.setItem(key + '_image', preview.src);
  }

  lockAll();
  showToast(`"${name}" saved!`);
}

// ============================================================
// LOAD PRODUCT (from dropdown click)
// Only restores product section data. Other sections unchanged.
// ============================================================

function loadProduct(key) {
  const raw = localStorage.getItem(key + '_data');
  if (!raw) return;
  const d = JSON.parse(raw);

  currentProductKey = key;

  document.querySelector('.options').textContent = d.name || 'Product Name';
  document.getElementById('VAT').checked         = d.vat || false;
  document.getElementById('VAT_RATE').value      = d.vatRate || '';
  document.getElementById('BATCH').value         = d.batch || '';
  document.getElementById('MARGIN').value        = d.margin || '';
  document.getElementById('DISCOUNT_RATE').value = d.discountRate || '20';

  // Restore VAT rate enable state
  document.getElementById('VAT_RATE').disabled = !(d.vat);

  // Restore image
  const img = localStorage.getItem(key + '_image');
  if (img) {
    preview.src = img;
  } else {
    preview.src = 'https://placehold.co/200x200/e8f5e9/1e8a57?text=Click+to+Upload';
  }

  // Restore product tables
  loadProductTable('productIngTable',   key + '_productIng');
  loadProductTable('productItemsTable', key + '_productItems');
  applyProductTable('productIngTable');
  applyProductTable('productItemsTable');

  // Recalculate all summaries
  calculateBatchSummary();
  calculateOrderSummary();
  calculateDiscountSummary();

  lockAll();
}

// ============================================================
// NEW PRODUCT — resets only the product section to defaults
// ============================================================

function newProduct(e) {
  if (e) e.preventDefault();

  currentProductKey = null;

  // Reset product name
  document.querySelector('.options').textContent = 'Product Name';

  // Reset inputs
  document.getElementById('VAT').checked         = false;
  document.getElementById('VAT_RATE').value      = '';
  document.getElementById('VAT_RATE').disabled   = true;
  document.getElementById('BATCH').value         = '';
  document.getElementById('MARGIN').value        = '';
  document.getElementById('DISCOUNT_RATE').value = '20';

  // Reset image
  preview.src = 'https://placehold.co/200x200/e8f5e9/1e8a57?text=Click+to+Upload';

  // Reset product tables to one empty row each
  ['productIngTable', 'productItemsTable'].forEach(tableId => {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    for (let i = 0; i < 5; i++) tr.appendChild(document.createElement('td'));
    tbody.appendChild(tr);
  });

  // Reset summary display
  ['batchIngTotal','batchItemsTotal','batchTotalCost',
   'orderIngTotal','orderItemsTotal','orderTotalCost',
   'orderPriceBeforeVat','orderVat','orderSellingPrice','orderProfit',
   'discountAmount','discountedPrice','discountProfit','discountProfitDiff'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '₱0.00';
  });

  // Unlock so user can immediately edit
  unlockAll();

  // Scroll to product section
  document.getElementById('product')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// SAVE / LOAD TABLE HELPERS
// ============================================================

function saveTable(tableId, storageKey) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = [];
  table.querySelectorAll('tbody tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('td').forEach(td => {
      const select = td.querySelector('select');
      cells.push(select ? select.value : td.textContent.trim().replace('₱', '').trim());
    });
    rows.push(cells);
  });
  localStorage.setItem(storageKey, JSON.stringify(rows));
}

function saveProductTable(tableId, storageKey) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = [];
  table.querySelectorAll('tbody tr').forEach(tr => {
    rows.push({
      selected: tr.cells[0]?.dataset?.selected || '',
      qty:      tr.cells[1]?.textContent.trim() || ''
    });
  });
  localStorage.setItem(storageKey, JSON.stringify(rows));
}

function loadTable(tableId, storageKey) {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;
  const rows      = JSON.parse(saved);
  const table     = document.getElementById(tableId);
  if (!table) return;
  const tbody     = table.querySelector('tbody');
  tbody.innerHTML = '';
  const pesoCols  = PESO_COLS[tableId] || [];
  const numCols   = NUMERIC_COLS[tableId] || [];

  rows.forEach(cells => {
    const tr = document.createElement('tr');
    cells.forEach((text, index) => {
      const td = document.createElement('td');
      td.contentEditable = 'false';
      if (numCols.includes(index)) {
        td.textContent = text
          ? (pesoCols.includes(index) ? '₱' + text : text)
          : (pesoCols.includes(index) ? '₱' : '');
      } else {
        td.textContent = text;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function loadProductTable(tableId, storageKey) {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;
  const rows  = JSON.parse(saved);
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody     = table.querySelector('tbody');
  tbody.innerHTML = '';

  rows.forEach(row => {
    const tr = document.createElement('tr');
    for (let i = 0; i < 5; i++) tr.appendChild(document.createElement('td'));
    tbody.appendChild(tr);
    tr.cells[0].dataset.selected = row.selected || '';
    tr.cells[1].textContent      = row.qty || '';
  });
}

// ============================================================
// ADD / REMOVE ROW HELPERS
// ============================================================

function isEditing() {
  return document.getElementById('saveBtn').style.display !== 'none';
}

function makeRow(colCount) {
  const tr = document.createElement('tr');
  for (let i = 0; i < colCount; i++) {
    const td = document.createElement('td');
    td.contentEditable = isEditing() ? 'true' : 'false';
    if (isEditing()) { td.style.background = '#f0fdf4'; td.style.cursor = 'text'; }
    tr.appendChild(td);
  }
  return tr;
}

function addIngredients() {
  const table = document.getElementById('ingredientTable');
  if (!table) return;
  const tr = makeRow(7);
  table.querySelector('tbody').appendChild(tr);
  buildUnitDropdown(tr.cells[5], 'typesOfunit');
  applyNumericCells('ingredientTable');
  makeUnitCostReadonly(tr);
  attachUnitCostWatcher(tr);
}

function removeIngredients() {
  const table = document.getElementById('ingredientTable');
  if (table && table.rows.length > 2) table.deleteRow(table.rows.length - 1);
}

function addRow() {
  const table = document.getElementById('typesOfunit');
  if (!table) return;
  table.querySelector('tbody').appendChild(makeRow(1));
  table.querySelector('tbody tr:last-child td')
    .addEventListener('input', () => refreshUnitDropdowns('ingredientTable', 'typesOfunit'));
}

function removeRow() {
  const table = document.getElementById('typesOfunit');
  if (table && table.rows.length > 2) table.deleteRow(table.rows.length - 1);
}

function addItems() {
  const table = document.getElementById('itemsTable');
  if (!table) return;
  const tr = makeRow(7);
  table.querySelector('tbody').appendChild(tr);
  buildUnitDropdown(tr.cells[5], 'itemsUnit');
  applyNumericCells('itemsTable');
  makeUnitCostReadonly(tr);
  attachUnitCostWatcher(tr);
}

function removeItems() {
  const table = document.getElementById('itemsTable');
  if (table && table.rows.length > 2) table.deleteRow(table.rows.length - 1);
}

function addItemRow() {
  const table = document.getElementById('itemsUnit');
  if (!table) return;
  table.querySelector('tbody').appendChild(makeRow(1));
  table.querySelector('tbody tr:last-child td')
    .addEventListener('input', () => refreshUnitDropdowns('itemsTable', 'itemsUnit'));
}

function removeItemRow() {
  const table = document.getElementById('itemsUnit');
  if (table && table.rows.length > 2) table.deleteRow(table.rows.length - 1);
}

function addOpex() {
  const table = document.getElementById('opexTable');
  if (!table) return;
  table.querySelector('tbody').appendChild(makeRow(2));
  applyNumericCells('opexTable');
}

function removeOpex() {
  const table = document.getElementById('opexTable');
  if (table && table.rows.length > 2) table.deleteRow(table.rows.length - 1);
}

// ============================================================
// OPEX TOTAL + CONTINGENCY
// ============================================================

function calculateOpexTotal() {
  let total = 0;
  document.querySelectorAll('#opexTable tbody tr').forEach(tr => {
    total += parseFloat(tr.cells[1]?.textContent.replace('₱', '').trim()) || 0;
  });
  const rate        = parseFloat(document.getElementById('contingencyRate').value) || 0;
  const contingency = total * (rate / 100);
  const monthly     = total + contingency;
  document.getElementById('monthlyOpex').value = '₱' + monthly.toFixed(2);
  document.getElementById('contingency').value = '₱' + contingency.toFixed(2);
}

function observeOpexTable() {
  const tbody = document.querySelector('#opexTable tbody');
  if (!tbody) return;
  new MutationObserver(() => calculateOpexTotal())
    .observe(tbody, { childList: true, subtree: true, characterData: true });
}

// ============================================================
// PER BATCH SUMMARY
// ============================================================

function calculateBatchSummary() {
  const batchSize = parseFloat(document.getElementById('BATCH').value) || 1;
  let ingTotal = 0, itemsTotal = 0;

  document.querySelectorAll('#productIngTable tbody tr').forEach(tr => {
    ingTotal += parseFloat(tr.cells[4]?.textContent.replace('₱', '').trim()) || 0;
  });
  document.querySelectorAll('#productItemsTable tbody tr').forEach(tr => {
    itemsTotal += parseFloat(tr.cells[4]?.textContent.replace('₱', '').trim()) || 0;
  });

  const scaledIng   = ingTotal   * batchSize;
  const scaledItems = itemsTotal * batchSize;
  const total       = scaledIng  + scaledItems;

  document.getElementById('batchIngTotal').textContent   = '₱' + scaledIng.toFixed(2);
  document.getElementById('batchItemsTotal').textContent = '₱' + scaledItems.toFixed(2);
  document.getElementById('batchTotalCost').textContent  = '₱' + total.toFixed(2);
}

// ============================================================
// PER ORDER SUMMARY
// ============================================================

function calculateOrderSummary() {
  let ingTotal = 0, itemsTotal = 0;

  document.querySelectorAll('#productIngTable tbody tr').forEach(tr => {
    ingTotal += parseFloat(tr.cells[4]?.textContent.replace('₱', '').trim()) || 0;
  });
  document.querySelectorAll('#productItemsTable tbody tr').forEach(tr => {
    itemsTotal += parseFloat(tr.cells[4]?.textContent.replace('₱', '').trim()) || 0;
  });

  const totalCost      = ingTotal + itemsTotal;
  const margin         = parseFloat(document.getElementById('MARGIN').value) || 0;
  const marginDivisor  = 1 - (margin / 100);
  const priceBeforeVat = marginDivisor > 0 ? totalCost / marginDivisor : totalCost;

  const vatChecked = document.getElementById('VAT').checked;
  const vatRate    = vatChecked ? (parseFloat(document.getElementById('VAT_RATE').value) || 0) : 0;
  const vat        = priceBeforeVat * (vatRate / 100);
  const selling    = priceBeforeVat + vat;
  const profit     = priceBeforeVat - totalCost;

  document.getElementById('orderIngTotal').textContent       = '₱' + ingTotal.toFixed(2);
  document.getElementById('orderItemsTotal').textContent     = '₱' + itemsTotal.toFixed(2);
  document.getElementById('orderTotalCost').textContent      = '₱' + totalCost.toFixed(2);
  document.getElementById('orderPriceBeforeVat').textContent = '₱' + priceBeforeVat.toFixed(2);
  document.getElementById('orderVat').textContent            = '₱' + vat.toFixed(2);
  document.getElementById('orderSellingPrice').textContent   = '₱' + selling.toFixed(2);

  const profitEl = document.getElementById('orderProfit');
  profitEl.textContent = '₱' + profit.toFixed(2);
  profitEl.className   = 'val ' + (profit >= 0 ? 'profit' : 'loss');

  calculateDiscountSummary();
}

// ============================================================
// WITH DISCOUNT SUMMARY
// ============================================================

function calculateDiscountSummary() {
  const sellingPrice   = parseFloat(document.getElementById('orderSellingPrice').textContent.replace('₱', '').trim()) || 0;
  const totalCost      = parseFloat(document.getElementById('orderTotalCost').textContent.replace('₱', '').trim()) || 0;
  const profitPerOrder = parseFloat(document.getElementById('orderProfit').textContent.replace('₱', '').trim()) || 0;
  const discountRate   = parseFloat(document.getElementById('DISCOUNT_RATE').value) || 0;

  const discountAmount  = sellingPrice * (discountRate / 100);
  const discountedPrice = sellingPrice - discountAmount;
  const profitAfterDisc = discountedPrice - totalCost;
  const profitDiff      = profitAfterDisc - profitPerOrder;

  document.getElementById('discountAmount').textContent  = '₱' + discountAmount.toFixed(2);
  document.getElementById('discountedPrice').textContent = '₱' + discountedPrice.toFixed(2);

  const profitEl = document.getElementById('discountProfit');
  profitEl.textContent = '₱' + profitAfterDisc.toFixed(2);
  profitEl.className   = 'val ' + (profitAfterDisc >= 0 ? 'profit' : 'loss');

  const diffEl = document.getElementById('discountProfitDiff');
  diffEl.textContent = '₱' + profitDiff.toFixed(2);
  diffEl.className   = 'val ' + (profitDiff >= 0 ? 'profit' : 'loss');
}

function observeProductTables() {
  ['productIngTable', 'productItemsTable'].forEach(tableId => {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    new MutationObserver(() => {
      calculateBatchSummary();
      calculateOrderSummary();
    }).observe(tbody, { childList: true, subtree: true, characterData: true });
  });
}

// ============================================================
// AVAILABLE PRODUCTS DROPDOWN
// ============================================================

function toggleProductDropdown(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropdown = document.getElementById('productDropdown');
  dropdown.classList.toggle('open');
  if (dropdown.classList.contains('open')) {
    document.getElementById('productSearch').focus();
    renderProductList('');
  }
}

function renderProductList(query) {
  const list     = document.getElementById('productList');
  const empty    = document.getElementById('dropdownEmpty');
  const products = getAllProducts(); // already sorted A-Z
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  list.innerHTML = '';

  if (filtered.length === 0) {
    list.style.display  = 'none';
    empty.style.display = 'block';
    return;
  }

  list.style.display  = '';
  empty.style.display = 'none';

  filtered.forEach(({ key, name }) => {
    const li = document.createElement('li');

    const icon = document.createElement('img');
    icon.src       = 'Image/box.svg';
    icon.className = 'icon-img item-icon';
    icon.alt       = 'box';

    const nameSpan = document.createElement('span');
    nameSpan.className   = 'item-name';
    nameSpan.textContent = name;
    nameSpan.addEventListener('click', () => {
      loadProduct(key);
      closeProductDropdown();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-product';
    deleteBtn.title     = 'Delete product';
    deleteBtn.innerHTML = '<img src="Image/trash-can.svg" class="icon-img" alt="trash-can">';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteModal(key, name);
    });

    li.appendChild(icon);
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  });
}

function filterProducts(query) {
  renderProductList(query);
}

function closeProductDropdown() {
  document.getElementById('productDropdown').classList.remove('open');
  document.getElementById('productSearch').value = '';
}

// Close when clicking outside
document.addEventListener('click', function (e) {
  const wrapper = document.querySelector('.dropdown-wrapper');
  if (wrapper && !wrapper.contains(e.target)) closeProductDropdown();
});

// ============================================================
// DELETE MODAL
// ============================================================

let pendingDeleteKey = null;

function openDeleteModal(key, name) {
  pendingDeleteKey = key;
  document.getElementById('deleteProductName').textContent = name;
  document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() {
  pendingDeleteKey = null;
  document.getElementById('deleteModal').classList.remove('open');
}

function confirmDelete() {
  if (!pendingDeleteKey) return;

  const name = JSON.parse(localStorage.getItem(pendingDeleteKey + '_data') || '{}').name || pendingDeleteKey;

  removeProductKey(pendingDeleteKey);

  // If the deleted product is currently loaded, reset to new product
  if (currentProductKey === pendingDeleteKey) {
    newProduct(null);
  }

  closeDeleteModal();
  renderProductList(document.getElementById('productSearch').value);
  showToast(`"${name}" deleted.`);
}

// Close modal on overlay click
document.getElementById('deleteModal').addEventListener('click', function (e) {
  if (e.target === this) closeDeleteModal();
});

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showToast(msg) {
  const old = document.getElementById('toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed; bottom: 30px; right: 30px;
    background: #1e8a57; color: white;
    padding: 12px 20px; border-radius: 8px;
    font-family: Montserrat, sans-serif;
    font-size: 14px; font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 9999; opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.style.opacity = '1', 10);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}


// ============================================================
// SUMMARY TABLE
// Col indices:
//   0 = Recipe Name (dropdown — pulls from saved products)
//   1 = Selling Price (auto — priceBeforeVat from selected product)
//   2 = Total Cost    (auto — orderTotalCost from selected product)
//   3 = Profit/Order  (auto — orderProfit from selected product)
//   4 = Orders/Month  (manual — numbers only)
//   5 = Revenue/Month (auto — col4 * col1)
//   6 = Profit/Month  (auto — col4 * col3)
//   7 = Extra Orders for Breakeven (auto — monthlyOpex / profitPerOrder)
// ============================================================

function getSummaryProductData(productName) {
  // Find the saved product key by name
  const all = getAllProducts();
  const match = all.find(p => p.name === productName);
  if (!match) return null;
  const raw = localStorage.getItem(match.key + '_data');
  if (!raw) return null;
  return JSON.parse(raw);
}

function getProductCalcValues(productName) {
  // Re-run the order summary math for a given saved product
  // We need to load its productIng + productItems costs
  const all = getAllProducts();
  const match = all.find(p => p.name === productName);
  if (!match) return null;

  const dataRaw = localStorage.getItem(match.key + '_data');
  if (!dataRaw) return null;
  const d = JSON.parse(dataRaw);

  // Load ingredient/items costs from saved product tables
  const ingRaw   = localStorage.getItem(match.key + '_productIng');
  const itemsRaw = localStorage.getItem(match.key + '_productItems');
  const ingRows   = ingRaw   ? JSON.parse(ingRaw)   : [];
  const itemsRows = itemsRaw ? JSON.parse(itemsRaw) : [];

  // We need unit costs — load from ingredientTable / itemsTable (session)
  // Build a lookup: name -> unitCost
  const ingLookup   = {};
  const itemsLookup = {};

  document.querySelectorAll('#ingredientTable tbody tr').forEach(tr => {
    const name = tr.cells[0]?.textContent.trim();
    const uc   = parseFloat(tr.cells[6]?.textContent.replace('₱','').trim()) || 0;
    if (name) ingLookup[name] = uc;
  });
  document.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    const name = tr.cells[0]?.textContent.trim();
    const uc   = parseFloat(tr.cells[6]?.textContent.replace('₱','').trim()) || 0;
    if (name) itemsLookup[name] = uc;
  });

  let ingTotal = 0, itemsTotal = 0;

  ingRows.forEach(row => {
    const name = row.selected || '';
    const qty  = parseFloat(row.qty) || 0;
    const uc   = ingLookup[name] || 0;
    ingTotal += qty * uc;
  });
  itemsRows.forEach(row => {
    const name = row.selected || '';
    const qty  = parseFloat(row.qty) || 0;
    const uc   = itemsLookup[name] || 0;
    itemsTotal += qty * uc;
  });

  const totalCost      = ingTotal + itemsTotal;
  const margin         = parseFloat(d.margin) || 0;
  const marginDivisor  = 1 - (margin / 100);
  const priceBeforeVat = marginDivisor > 0 ? totalCost / marginDivisor : totalCost;
  const vatRate        = d.vat ? (parseFloat(d.vatRate) || 0) : 0;
  const vat            = priceBeforeVat * (vatRate / 100);
  const sellingPrice   = priceBeforeVat + vat;
  const profitPerOrder = priceBeforeVat - totalCost;

  return { priceBeforeVat, totalCost, profitPerOrder, sellingPrice };
}

function buildSummaryDropdown(td) {
  const products = getAllProducts();
  const current  = td.dataset.selected || '';

  td.contentEditable = 'false';
  td.innerHTML = '';

  const select = document.createElement('select');
  select.style.cssText = `
    width: 100%; border: none; background: transparent;
    font-family: Montserrat, sans-serif; font-size: 13px;
    cursor: pointer; outline: none;
  `;

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '-- Select Product --';
  select.appendChild(defaultOpt);

  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    if (p.name === current) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', function () {
    td.dataset.selected = this.value;
    autoFillSummaryRow(td.closest('tr'), this.value);
  });

  td.appendChild(select);

  if (current) autoFillSummaryRow(td.closest('tr'), current);
}

function makeReadonlySummaryCell(td) {
  td.contentEditable = 'false';
  td.style.background = '#f5f5f5';
  td.style.cursor     = 'not-allowed';
  td.style.color      = '#555';
}

function setupSummaryOrdersCell(td) {
  td.contentEditable = 'true';
  td.style.background = '#f0fdf4';
  td.style.cursor     = 'text';

  td.addEventListener('keydown', function (e) {
    const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
    if (!/^\d$/.test(e.key) && !allowed.includes(e.key)) e.preventDefault();
  });

  td.addEventListener('input', function () {
    const raw = td.textContent.replace(/[^0-9]/g, '');
    td.textContent = raw;
    const range = document.createRange();
    const sel   = window.getSelection();
    range.selectNodeContents(td);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    const tr           = td.closest('tr');
    const selectedName = tr.cells[0]?.dataset?.selected || '';
    autoFillSummaryRow(tr, selectedName);
  });
}

function autoFillSummaryRow(tr, productName) {
  const cells = tr.cells;
  if (!productName) {
    // Clear auto cells
    [1,2,3,5,6,7].forEach(i => { if (cells[i]) cells[i].textContent = ''; });
    calculateSummaryTotals();
    return;
  }

  const vals = getProductCalcValues(productName);
  if (!vals) return;

  const ordersPerMonth = parseFloat(cells[4]?.textContent.trim()) || 0;
  const revenueMonth   = ordersPerMonth * vals.priceBeforeVat;
  const profitMonth    = ordersPerMonth * vals.profitPerOrder;

  // Monthly OPEX for breakeven
  const opexVal    = parseFloat(document.getElementById('monthlyOpex')?.value.replace('₱','').trim()) || 0;
  const breakeven  = vals.profitPerOrder > 0 ? Math.ceil(opexVal / vals.profitPerOrder) : '—';

  if (cells[1]) cells[1].textContent = '₱' + vals.priceBeforeVat.toFixed(2);
  if (cells[2]) cells[2].textContent = '₱' + vals.totalCost.toFixed(2);
  if (cells[3]) cells[3].textContent = '₱' + vals.profitPerOrder.toFixed(2);
  if (cells[5]) cells[5].textContent = ordersPerMonth > 0 ? '₱' + revenueMonth.toFixed(2) : '';
  if (cells[6]) cells[6].textContent = ordersPerMonth > 0 ? '₱' + profitMonth.toFixed(2) : '';
  if (cells[7]) cells[7].textContent = ordersPerMonth > 0 ? breakeven : '';

  // Color profit cells
  if (cells[3]) cells[3].style.color = vals.profitPerOrder >= 0 ? 'var(--green)' : 'var(--red)';
  if (cells[6]) cells[6].style.color = profitMonth >= 0 ? 'var(--green)' : 'var(--red)';

  calculateSummaryTotals();
}

function initSummaryRow(tr) {
  buildSummaryDropdown(tr.cells[0]);
  setupSummaryOrdersCell(tr.cells[4]);
  [1,2,3,5,6,7].forEach(i => makeReadonlySummaryCell(tr.cells[i]));
}

function applySummaryTable() {
  document.querySelectorAll('#summaryTable tbody tr')
    .forEach(tr => initSummaryRow(tr));
}

function addSummaryRow() {
  const tbody = document.querySelector('#summaryTable tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  for (let i = 0; i < 8; i++) tr.appendChild(document.createElement('td'));
  tbody.appendChild(tr);
  initSummaryRow(tr);
}

function removeSummaryRow() {
  const table = document.getElementById('summaryTable');
  if (table && table.rows.length > 2) {
    table.deleteRow(table.rows.length - 1);
    calculateSummaryTotals();
  }
}

function calculateSummaryTotals() {
  let grossRevenue = 0;
  let grossProfit  = 0;

  document.querySelectorAll('#summaryTable tbody tr').forEach(tr => {
    grossRevenue += parseFloat(tr.cells[5]?.textContent.replace('₱','').trim()) || 0;
    grossProfit  += parseFloat(tr.cells[6]?.textContent.replace('₱','').trim()) || 0;
  });

  const monthlyOpex = parseFloat(document.getElementById('monthlyOpex')?.value.replace('₱','').trim()) || 0;
  const netProfit   = grossProfit - monthlyOpex;

  const grEl = document.getElementById('grossRevenue');
  const gpEl = document.getElementById('grossProfit');
  const moEl = document.getElementById('summaryMonthlyOpex');
  const npEl = document.getElementById('netProfit');

  if (grEl) grEl.textContent = '₱' + grossRevenue.toFixed(2);
  if (gpEl) { gpEl.textContent = '₱' + grossProfit.toFixed(2); gpEl.style.color = grossProfit >= 0 ? '' : 'var(--red)'; }
  if (moEl) moEl.textContent = '₱' + monthlyOpex.toFixed(2);
  if (npEl) { npEl.textContent = '₱' + netProfit.toFixed(2); npEl.style.color = netProfit >= 0 ? '' : 'var(--red)'; }
}

function refreshSummaryDropdowns() {
  // Rebuild all recipe name dropdowns when product list changes
  document.querySelectorAll('#summaryTable tbody tr').forEach(tr => {
    const selected = tr.cells[0]?.dataset?.selected || '';
    buildSummaryDropdown(tr.cells[0]);
    if (selected) {
      const sel = tr.cells[0].querySelector('select');
      if (sel) { sel.value = selected; autoFillSummaryRow(tr, selected); }
    }
  });
}

// ============================================================
// INIT — always last
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
  // Session-only tables are NOT loaded from localStorage on refresh
  // (ingredients, items, opex, summary are always fresh)

  // Apply features to empty default tables
  applyUnitDropdowns('ingredientTable', 'typesOfunit');
  applyUnitDropdowns('itemsTable', 'itemsUnit');
  applyNumericCells('ingredientTable');
  applyNumericCells('itemsTable');
  applyNumericCells('opexTable');
  applyUnitCostListeners('ingredientTable');
  applyUnitCostListeners('itemsTable');
  applyProductTable('productIngTable');
  applyProductTable('productItemsTable');
  recalculateAllUnitCosts();

  lockAll();

  watchUnitSource('typesOfunit', 'ingredientTable');
  watchUnitSource('itemsUnit',   'itemsTable');
  observeUnitTable('typesOfunit', 'ingredientTable');
  observeUnitTable('itemsUnit',   'itemsTable');
  observeSourceTableForProduct('productIngTable');
  observeSourceTableForProduct('productItemsTable');
  observeOpexTable();
  observeProductTables();

  document.getElementById('contingencyRate').addEventListener('input', calculateOpexTotal);
  document.getElementById('BATCH').addEventListener('input', calculateBatchSummary);
  document.getElementById('MARGIN').addEventListener('input', calculateOrderSummary);
  document.getElementById('VAT_RATE').addEventListener('input', calculateOrderSummary);
  document.getElementById('VAT').addEventListener('change', calculateOrderSummary);
  document.getElementById('DISCOUNT_RATE').addEventListener('input', calculateDiscountSummary);

  calculateOpexTotal();
  calculateBatchSummary();
  calculateOrderSummary();
  calculateDiscountSummary();

  // Summary table
  applySummaryTable();
  calculateSummaryTotals();

  // Refresh summary when OPEX changes (breakeven depends on it)
  document.getElementById('monthlyOpex').addEventListener('change', () => {
    document.querySelectorAll('#summaryTable tbody tr').forEach(tr => {
      const name = tr.cells[0]?.dataset?.selected || '';
      if (name) autoFillSummaryRow(tr, name);
    });
    calculateSummaryTotals();
  });
});