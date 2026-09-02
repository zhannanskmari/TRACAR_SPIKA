import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@spica.ru" },
    update: {},
    create: {
      name: "Ирина Соколова",
      email: "admin@spica.ru",
      passwordHash,
      role: "ADMIN",
    },
  });

  const salaryExecutor = await prisma.user.upsert({
    where: { email: "salary@spica.ru" },
    update: {},
    create: {
      name: "Анна Петрова",
      email: "salary@spica.ru",
      passwordHash,
      role: "EXECUTOR",
      specialization: "SALARY",
    },
  });

  const taxExecutor = await prisma.user.upsert({
    where: { email: "tax@spica.ru" },
    update: {},
    create: {
      name: "Олег Иванов",
      email: "tax@spica.ru",
      passwordHash,
      role: "EXECUTOR",
      specialization: "TAX",
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: "client@alfa.ru" },
    update: {},
    create: {
      name: "Дмитрий Клиентов",
      email: "client@alfa.ru",
      passwordHash,
      role: "CLIENT",
    },
  });

  await prisma.task.deleteMany({});
  await prisma.client.deleteMany({});

  const alfa = await prisma.client.create({
    data: {
      name: "ООО Альфа",
      taxSystem: "USN",
      primaryExecutorId: salaryExecutor.id,
      secondaryExecutorId: taxExecutor.id,
      clientUserId: clientUser.id,
    },
  });

  const beta = await prisma.client.create({
    data: {
      name: "ООО Бета",
      taxSystem: "OSNO",
      primaryExecutorId: taxExecutor.id,
      secondaryExecutorId: salaryExecutor.id,
    },
  });

  const gamma = await prisma.client.create({
    data: {
      name: "ИП Гамма",
      taxSystem: "PATENT",
      primaryExecutorId: salaryExecutor.id,
    },
  });

  const now = new Date();
  const daysFromNow = (d: number) =>
    new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  await prisma.task.createMany({
    data: [
      {
        title: "Расчёт зарплаты за сентябрь",
        clientId: alfa.id,
        taskType: "SALARY_CALC",
        status: "IN_PROGRESS",
        assignedToId: salaryExecutor.id,
        createdById: admin.id,
        deadline: daysFromNow(3),
        salaryCalcDate: daysFromNow(1),
      },
      {
        title: "Выплата зарплаты сотрудникам",
        clientId: alfa.id,
        taskType: "SALARY_PAYMENT",
        status: "NEW",
        assignedToId: salaryExecutor.id,
        createdById: admin.id,
        deadline: daysFromNow(5),
        salaryPaymentDate: daysFromNow(4),
      },
      {
        title: "Уплата УСН-налога за квартал",
        clientId: alfa.id,
        taskType: "TAX_PAYMENT",
        status: "NEW",
        assignedToId: taxExecutor.id,
        createdById: admin.id,
        deadline: daysFromNow(7),
        taxAmount: 42500,
        taxPaymentDate: daysFromNow(7),
      },
      {
        title: "Подготовка и сдача отчётности по НДФЛ",
        clientId: beta.id,
        taskType: "REPORT",
        status: "IN_PROGRESS",
        assignedToId: taxExecutor.id,
        createdById: admin.id,
        deadline: daysFromNow(10),
        isClientNotified: true,
      },
      {
        title: "Ответ на требование ИФНС",
        clientId: beta.id,
        taskType: "IFNS_DEMAND",
        status: "DONE",
        assignedToId: taxExecutor.id,
        createdById: admin.id,
        deadline: daysFromNow(-2),
      },
      {
        title: "Запрос клиента: справка 2-НДФЛ",
        clientId: gamma.id,
        taskType: "CLIENT_REQUEST",
        status: "REWORK",
        assignedToId: salaryExecutor.id,
        createdById: admin.id,
        deadline: daysFromNow(1),
      },
    ],
  });

  console.log("Seed завершён. Тестовые учётки:");
  console.log("  admin@spica.ru  / password123  (руководитель)");
  console.log("  salary@spica.ru / password123  (исполнитель, ЗП)");
  console.log("  tax@spica.ru    / password123  (исполнитель, налоги)");
  console.log("  client@alfa.ru  / password123  (клиент)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
