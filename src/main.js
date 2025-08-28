/**
 * Утилита группировки (пригодится, если захочешь расширить отчёт)
 * @param {Array} array
 * @param {(item:any)=>string} keyFn
 * @returns {Object<string, any[]>}
 */
function groupBy(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/**
 * Расчёт выручки по ОДНОЙ позиции чека с учётом скидки
 * (не меняем сигнатуру — читаем параметры через arguments)
 * @param _product – формальный параметр из стартера
 * @returns {number}
 */
function calculateSimpleRevenue(_product) {
  const [purchase /* {sale_price, quantity, discount} */, product] = arguments;
  const { sale_price, quantity, discount } = purchase;
  const multiplier = 1 - discount / 100;
  return sale_price * quantity * multiplier;
}

/**
 * Расчёт бонуса по месту в рейтинге прибыли
 * (не меняем сигнатуру — читаем параметры через arguments)
 * @returns {number}
 */
function calculateBonusByProfit() {
  const [index, total, seller /* { profit } */] = arguments;

  const isFirst = index === 0;
  const isSecondOrThird = index === 1 || index === 2;
  const isLast = index === total - 1;

  let pct = 0;
  if (isFirst) pct = 15;
  else if (isSecondOrThird) pct = 10;
  else if (isLast) pct = 0;
  else pct = 5;

  return seller.profit * (pct / 100);
}

/**
 * Главная функция анализа продаж
 * (не меняем сигнатуру — читаем параметры через arguments)
 * @returns {{seller_id:string,name:string,revenue:number,profit:number,sales_count:number,top_products:{sku:string,quantity:number}[],bonus:number}[]}
 */
function analyzeSalesData() {
  // --- Проверка входных данных ---
  const [data, options] = arguments;

  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error('Некорректные входные данные');
  }

  // --- Проверка опций/зависимостей ---
  if (!options) throw new Error('Не переданы опции');
  const { calculateRevenue, calculateBonus } = options;
  if (!calculateRevenue || !calculateBonus) {
    throw new Error('Отсутствуют обязательные функции calculateRevenue/calculateBonus');
  }

  // --- Промежуточные структуры для накопления статистики ---
  const sellerStats = data.sellers.map(seller => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,        // суммарная выручка С УЧЁТОМ скидок (накапливаем по позициям)
    profit: 0,         // суммарная прибыль (выручка - себестоимость)
    sales_count: 0,    // количество чеков
    products_sold: {}  // { sku: quantity } — для топ-10
  }));

  // Индексы для быстрого доступа
  const sellerIndex = sellerStats.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const productIndex = data.products.reduce((acc, p) => {
    acc[p.sku] = p;
    return acc;
  }, {});

  // --- Бизнес-логика: двойной цикл по чекам и позициям ---
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return; // защита от несоответствия id

    // один чек — одна продажа
    seller.sales_count += 1;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) return; // неизвестный sku — пропускаем

      // выручка по позиции (с учётом скидки)
      const revenueItem = calculateRevenue(item, product);

      // себестоимость по позиции
      const costItem = product.purchase_price * item.quantity;

      // накопление показателей
      seller.revenue += revenueItem;
      seller.profit += (revenueItem - costItem);

      // учёт проданных штук по sku
      if (!seller.products_sold[item.sku]) seller.products_sold[item.sku] = 0;
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // --- Сортировка продавцов по прибыли (по убыванию) ---
  sellerStats.sort((a, b) => b.profit - a.profit);

  // --- Назначение бонусов и формирование топ-10 товаров ---
  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // --- Финальный отчёт (округление до 2 знаков) ---
  return sellerStats.map(s => ({
    seller_id: s.id,
    name: s.name,
    revenue: +s.revenue.toFixed(2),
    profit: +s.profit.toFixed(2),
    sales_count: s.sales_count,
    top_products: s.top_products,
    bonus: +s.bonus.toFixed(2)
  }));
}