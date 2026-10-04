import { PrismaClient } from "@prisma/client";

// Наполнение раздела «Общая база знаний»: 4 раздела + 35 материалов из ТЗ.
// Идемпотентный: повторный запуск не создаёт дублей.
// Запуск: npx tsx prisma/seed-knowledge.ts

const prisma = new PrismaClient();

type SeedArticle = {
  type: "text" | "link";
  title: string;
  tags: string[];
  url?: string;
};

const CATEGORIES: {
  name: string;
  icon: string;
  articles: SeedArticle[];
}[] = [
  {
    name: "Отчётность по трекеру задач",
    icon: "📊",
    articles: [
      { type: "text", title: "Как формировать еженедельный отчёт", tags: ["отчётность"] },
      { type: "text", title: "Метрики и KPI: что отслеживать", tags: ["отчётность", "метрики"] },
      { type: "text", title: "Как читать дашборд трекера", tags: ["дашборд"] },
      { type: "link", title: "Шаблон ежемесячного отчёта", tags: ["шаблон", "отчётность"], url: "https://example.com/templates/monthly-report" },
      { type: "link", title: "Регламент отчётности", tags: ["регламент"], url: "https://example.com/docs/reporting-regulation" },
      { type: "text", title: "Экспорт данных из трекера", tags: ["экспорт"] },
    ],
  },
  {
    name: "Налоги",
    icon: "💰",
    articles: [
      { type: "text", title: "Календарь налоговых платежей", tags: ["календарь", "налоги"] },
      { type: "text", title: "НДС: основные правила", tags: ["ндс"] },
      { type: "text", title: "УСН vs ОСНО: сравнение", tags: ["усн", "осно"] },
      { type: "link", title: "Налоговый кодекс (актуальная редакция)", tags: ["нк", "закон"], url: "https://www.nalog.govn.ru/rn77/taxation/taxes/" },
      { type: "link", title: "Формы налоговых деклараций", tags: ["декларации"], url: "https://www.nalog.govn.ru/rn77/gorod_activity/structures_activity/nsd/" },
      { type: "text", title: "Частые ошибки при сдаче деклараций", tags: ["декларации", "ошибки"] },
      { type: "link", title: "Письма Минфина (подборка)", tags: ["минфин"], url: "https://www.mingob.govn.ru/" },
    ],
  },
  {
    name: "Бухучёт",
    icon: "📒",
    articles: [
      { type: "text", title: "План счетов: шпаргалка", tags: ["план счетов"] },
      { type: "text", title: "Первичные документы: чек-лист", tags: ["первичка", "чек-лист"] },
      { type: "link", title: "Учётная политика компании", tags: ["учётная политика"], url: "https://example.com/docs/accounting-policy" },
      { type: "text", title: "Закрытие периода: пошаговая инструкция", tags: ["закрытие периода"] },
      { type: "link", title: "Шаблоны актов и накладных", tags: ["шаблоны", "первичка"], url: "https://example.com/templates/acts" },
      { type: "text", title: "Инвентаризация: как проводить", tags: ["инвентаризация"] },
      { type: "link", title: "ФСБУ / ПБУ (актуальные стандарты)", tags: ["стандарты"], url: "https://www.minfin.gov.ru/rubrikator/standards/" },
    ],
  },
  {
    name: "Клиенты",
    icon: "📇",
    articles: [
      { type: "text", title: "Как вести клиентов в канбан-доске", tags: ["канбан", "клиенты"] },
      { type: "text", title: "Календарь взаимодействий с клиентами", tags: ["календарь", "клиенты"] },
      { type: "text", title: "Карточка клиента: что заполнять обязательно", tags: ["карточка клиента"] },
      { type: "text", title: "Жизненный цикл клиента в трекере", tags: ["клиенты"] },
      { type: "text", title: "Как назначать задачи по клиенту ответственным", tags: ["задачи"] },
      { type: "link", title: "Шаблон договора с клиентом", tags: ["шаблон", "договор"], url: "https://example.com/templates/contract" },
      { type: "link", title: "Шаблон коммерческого предложения", tags: ["шаблон", "продажи"], url: "https://example.com/templates/kp" },
      { type: "link", title: "Папка с презентациями для клиентов", tags: ["презентации"], url: "https://example.com/presentations" },
      { type: "text", title: "Скрипты общения с клиентами", tags: ["скрипты", "продажи"] },
      { type: "text", title: "Как работать с возражениями клиентов", tags: ["возражения", "продажи"] },
      { type: "text", title: "Регламент реакции на запросы клиентов", tags: ["регламент", "клиенты"] },
      { type: "text", title: "Как закрывать задачи по клиенту", tags: ["задачи"] },
      { type: "link", title: "База контактов клиентов", tags: ["контакты"], url: "https://example.com/clients/contacts" },
      { type: "text", title: "NPS и сбор обратной связи", tags: ["nps", "клиенты"] },
      { type: "text", title: "Работа с проблемными клиентами", tags: ["клиенты"] },
    ],
  },
];

async function main() {
  const author = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!author) throw new Error("Нет пользователя с ролью ADMIN");

  let createdCategories = 0;
  let createdArticles = 0;

  for (let c = 0; c < CATEGORIES.length; c++) {
    const seed = CATEGORIES[c];
    const category = await prisma.category.upsert({
      where: { name: seed.name },
      update: { icon: seed.icon, sortOrder: c + 1 },
      create: { name: seed.name, icon: seed.icon, sortOrder: c + 1 },
    });
    if (!category) throw new Error(`Не создался раздел ${seed.name}`);
    createdCategories += 0;

    for (let i = 0; i < seed.articles.length; i++) {
      const a = seed.articles[i];
      const exists = await prisma.article.findFirst({
        where: { categoryId: category.id, title: a.title },
        select: { id: true },
      });
      if (exists) continue;

      await prisma.article.create({
        data: {
          categoryId: category.id,
          type: a.type,
          title: a.title,
          content: a.type === "text" ? `# ${a.title}\n\nТекст в подготовке.` : null,
          url: a.type === "link" ? (a.url ?? "https://example.com") : null,
          tags: a.tags,
          authorId: author.id,
          sortOrder: i + 1,
        },
      });
      createdArticles += 1;
    }
  }

  const total = await prisma.article.count();
  const cats = await prisma.category.count();
  console.log(
    `База знаний: разделов ${cats}, материалов ${total} (создано: разделов ${createdCategories}, материалов ${createdArticles})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
