import { describe, expect, it } from "vitest";
import { clientsVisibilityWhere, tasksVisibilityWhere } from "../task-scope";

describe("tasksVisibilityWhere", () => {
  it("ADMIN видит все активные задачи", () => {
    expect(tasksVisibilityWhere({ id: "a", role: "ADMIN" })).toEqual({
      archivedAt: null,
    });
  });

  it("ADMIN в архиве видит только архивные", () => {
    expect(
      tasksVisibilityWhere({ id: "a", role: "ADMIN" }, { archived: true })
    ).toEqual({ archivedAt: { not: null } });
  });

  it("EXECUTOR видит назначенные ему или где он исполнитель", () => {
    expect(tasksVisibilityWhere({ id: "u1", role: "EXECUTOR" })).toEqual({
      archivedAt: null,
      OR: [{ assignedToId: "u1" }, { executorId: "u1" }],
    });
  });

  it("EXECUTOR в архиве видит только свои архивные", () => {
    expect(
      tasksVisibilityWhere({ id: "u1", role: "EXECUTOR" }, { archived: true })
    ).toEqual({
      archivedAt: { not: null },
      OR: [{ assignedToId: "u1" }, { executorId: "u1" }],
    });
  });

  it("CLIENT видит только задачи своей компании: свои или SENT_TO_CLIENT", () => {
    expect(tasksVisibilityWhere({ id: "c1", role: "CLIENT" })).toEqual({
      archivedAt: null,
      AND: [
        { client: { clientUserId: "c1" } },
        { OR: [{ createdById: "c1" }, { status: "SENT_TO_CLIENT" }] },
      ],
    });
  });
});

describe("clientsVisibilityWhere", () => {
  it("ADMIN видит всех клиентов", () => {
    expect(clientsVisibilityWhere({ id: "a", role: "ADMIN" })).toEqual({});
  });

  it("CLIENT видит только свою компанию", () => {
    expect(clientsVisibilityWhere({ id: "c1", role: "CLIENT" })).toEqual({
      clientUserId: "c1",
    });
  });

  it("EXECUTOR по умолчанию — primary/secondary/ответственный", () => {
    expect(clientsVisibilityWhere({ id: "u1", role: "EXECUTOR" })).toEqual({
      OR: [
        { primaryExecutorId: "u1" },
        { secondaryExecutorId: "u1" },
        { tasks: { some: { assignedToId: "u1" } } },
      ],
    });
  });

  it("EXECUTOR с includeExecutorTasks — плюс клиенты, где он исполнитель", () => {
    expect(
      clientsVisibilityWhere(
        { id: "u1", role: "EXECUTOR" },
        { includeExecutorTasks: true }
      )
    ).toEqual({
      OR: [
        { primaryExecutorId: "u1" },
        { secondaryExecutorId: "u1" },
        {
          tasks: {
            some: { OR: [{ assignedToId: "u1" }, { executorId: "u1" }] },
          },
        },
      ],
    });
  });
});
