import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignmentRule } from "@prisma/client";

// Мокаем синглтон Prisma: resolveAssignee ходит только в assignmentRule.
vi.mock("../prisma", () => ({
  prisma: { assignmentRule: { findUnique: vi.fn() } },
}));

import { prisma } from "../prisma";
import { listExecutors, resolveAssignee } from "../tasks-service";

const findUnique = vi.mocked(prisma.assignmentRule.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveAssignee", () => {
  it("EXECUTOR создаёт задачу себе, к правилам не обращается", async () => {
    const id = await resolveAssignee(
      { id: "u1", role: "EXECUTOR" },
      { clientId: "c", taskType: "SALARY_CALC", primaryExecutorId: "p" }
    );
    expect(id).toBe("u1");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("правило AssignmentRule побеждает primary-исполнителя", async () => {
    const rule: AssignmentRule = {
      id: "r1",
      clientId: "c",
      taskType: "TAX_PAYMENT",
      executorId: "e2",
    };
    findUnique.mockResolvedValue(rule);
    const id = await resolveAssignee(
      { id: "a", role: "ADMIN" },
      { clientId: "c", taskType: "TAX_PAYMENT", primaryExecutorId: "p" }
    );
    expect(id).toBe("e2");
    expect(findUnique).toHaveBeenCalledWith({
      where: { clientId_taskType: { clientId: "c", taskType: "TAX_PAYMENT" } },
    });
  });

  it("без правила — primary-исполнитель клиента", async () => {
    findUnique.mockResolvedValue(null);
    const id = await resolveAssignee(
      { id: "a", role: "ADMIN" },
      { clientId: "c", taskType: "REPORT", primaryExecutorId: "p" }
    );
    expect(id).toBe("p");
  });

  it("CLIENT тоже распределяется через правило", async () => {
    const rule: AssignmentRule = {
      id: "r2",
      clientId: "c",
      taskType: "CLIENT_REQUEST",
      executorId: "e9",
    };
    findUnique.mockResolvedValue(rule);
    const id = await resolveAssignee(
      { id: "c1", role: "CLIENT" },
      { clientId: "c", taskType: "CLIENT_REQUEST", primaryExecutorId: "p" }
    );
    expect(id).toBe("e9");
  });
});

describe("listExecutors", () => {
  it("CLIENT получает пустой список", async () => {
    // prisma.user не замокан — но CLIENT возвращается раньше любого запроса.
    await expect(
      listExecutors({ id: "c1", role: "CLIENT" })
    ).resolves.toEqual([]);
  });
});
