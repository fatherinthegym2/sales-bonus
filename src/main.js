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
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price, quantity, discount } = purchase;
  const discountMultiplier = 1 - (discount / 100);
  return sale_price * quantity * discountMultiplier;
}

/**
 * Расчёт бонуса по месту в рейтинге прибыли
 * (не меняем сигнатуру — читаем параметры через arguments)
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;

  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1) return 0;
  return profit * 0.05;
}

/**
 * Главная функция анализа продаж
 * (не меняем сигнатуру — читаем параметры через arguments)
 * @returns {{seller_id:string,name:string,revenue:number,profit:number,sales_count:number,top_products:{sku:string,quantity:number}[],bonus:number}[]}
 */
function analyzeSalesData(data, options) {
  // 1) Проверка входных данных
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error('Некорректные входные данные');
  }

  // 2) Проверка опций и зависимостей
  if (!options || typeof options !== 'object') {
    throw new Error('Не переданы опции');
  }
  const { calculateRevenue, calculateBonus } = options;
  if (!calculateRevenue || !calculateBonus ||
      typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
    throw new Error('Отсутствуют необходимые функции в опциях');
  }

  // 3) Промежуточная структура статистики по продавцам
  const sellerStats = data.sellers.map(seller => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {} // словарь: sku -> накопленное количество
  }));

  // 4) Индексы для быстрого доступа
  const sellerIndex = Object.fromEntries(
    sellerStats.map(s => [s.id, s])
  );
  const productIndex = Object.fromEntries(
    data.products.map(p => [p.sku, p])
  );

  // 5) Бизнес-логика: обходим чеки и позиции в них
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return; // на всякий случай

    // обновляем счётчики по чеку
    seller.sales_count += 1;
    // выручка суммируется по total_amount из чека (без скидки, как в задании)
    seller.revenue += record.total_amount;

    // прибыль считаем по позициям
    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) return;

      const cost = product.purchase_price * item.quantity;
      const revenueItem = calculateRevenue(item, product);
      const profitItem = revenueItem - cost;
      seller.profit += profitItem;

      // учёт проданных товаров
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // 6) Сортировка продавцов по прибыли (по убыванию)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // 7) Назначение бонусов и формирование топ-10 товаров
  const totalSellers = sellerStats.length;
  sellerStats.forEach((seller, index) => {
    const rawBonus = calculateBonus(index, totalSellers, seller);
    seller.bonus = +rawBonus.toFixed(2);

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // 8) Финальный отчёт в нужном формате (округление до 2 знаков)
  return sellerStats.map(seller => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2)
  }));
}