import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { PersonalTodo, PersonalTodoAction, PersonalTodoStatus } from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";

type TodoFields = { title: string; description: string; deadline: string };

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function todoView(todo: {
  _id: Types.ObjectId;
  title: string;
  description: string;
  deadline: Date;
  status: PersonalTodoStatus;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  history?: Array<{
    action: PersonalTodoAction;
    actorId: Types.ObjectId;
    title: string;
    description: string;
    deadline: Date;
    createdAt: Date;
  }>;
}) {
  return {
    id: String(todo._id),
    title: todo.title,
    description: todo.description,
    deadline: dateOnly(todo.deadline),
    status: todo.status,
    completedAt: todo.completedAt,
    deletedAt: todo.deletedAt,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    history: (todo.history ?? []).map((event) => ({
      action: event.action,
      actorId: String(event.actorId),
      title: event.title,
      description: event.description,
      deadline: dateOnly(event.deadline),
      createdAt: event.createdAt,
    })),
  };
}

function addHistoryEvent(
  todo: InstanceType<typeof PersonalTodo>,
  action: PersonalTodoAction,
  actorId: Types.ObjectId,
  createdAt: Date,
) {
  todo.history.push({
    action,
    actorId,
    title: todo.title,
    description: todo.description,
    deadline: todo.deadline,
    createdAt,
  });
}

export async function listMyPersonalTodos(req: Request, res: Response, next: NextFunction) {
  try {
    const todos = await PersonalTodo.find({
      ownerId: req.authUser!._id,
      status: PersonalTodoStatus.OPEN,
    })
      .select("-history")
      .sort({ deadline: 1, createdAt: -1, _id: -1 })
      .lean();
    return res.json({ success: true, todos: todos.map((todo) => todoView(todo)) });
  } catch (error) {
    next(error);
  }
}

export async function listMyPersonalTodoHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize } = res.locals.query as { page: number; pageSize: number };
    const filter = { ownerId: req.authUser!._id };
    const [total, todos] = await Promise.all([
      PersonalTodo.countDocuments(filter),
      PersonalTodo.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    if (currentPage !== page) {
      const pageTodos = await PersonalTodo.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean();
      return res.json({
        success: true,
        todos: pageTodos.map((todo) => todoView(todo)),
        pagination: { page: currentPage, pageSize, total, totalPages },
      });
    }
    return res.json({
      success: true,
      todos: todos.map((todo) => todoView(todo)),
      pagination: { page: currentPage, pageSize, total, totalPages },
    });
  } catch (error) {
    next(error);
  }
}

export async function createMyPersonalTodo(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as TodoFields;
    const todo = await PersonalTodo.create({
      ownerId: req.authUser!._id,
      title: input.title,
      description: input.description,
      deadline: utcDate(input.deadline),
      status: PersonalTodoStatus.OPEN,
      history: [{
        action: PersonalTodoAction.CREATED,
        actorId: req.authUser!._id,
        title: input.title,
        description: input.description,
        deadline: utcDate(input.deadline),
        createdAt: new Date(),
      }],
    });
    return res.status(201).json({ success: true, todo: todoView(todo) });
  } catch (error) {
    next(error);
  }
}

export async function updateMyPersonalTodo(req: Request, res: Response, next: NextFunction) {
  try {
    const todo = await PersonalTodo.findById(String(req.params.todoId)).exec();
    if (!todo || String(todo.ownerId) !== String(req.authUser!._id) || todo.status === PersonalTodoStatus.DELETED) {
      throw new ApiError(404, "TODO not found");
    }
    const input = req.body as TodoFields;
    todo.title = input.title;
    todo.description = input.description;
    todo.deadline = utcDate(input.deadline);
    addHistoryEvent(todo, PersonalTodoAction.EDITED, req.authUser!._id, new Date());
    await todo.save();
    return res.json({ success: true, todo: todoView(todo) });
  } catch (error) {
    next(error);
  }
}

export async function completeMyPersonalTodo(req: Request, res: Response, next: NextFunction) {
  try {
    const todo = await PersonalTodo.findById(String(req.params.todoId)).exec();
    if (!todo || String(todo.ownerId) !== String(req.authUser!._id) || todo.status !== PersonalTodoStatus.OPEN) {
      throw new ApiError(404, "Open TODO not found");
    }
    const completedAt = new Date();
    todo.status = PersonalTodoStatus.COMPLETED;
    todo.completedAt = completedAt;
    addHistoryEvent(todo, PersonalTodoAction.COMPLETED, req.authUser!._id, completedAt);
    await todo.save();
    return res.json({ success: true, todo: todoView(todo) });
  } catch (error) {
    next(error);
  }
}

export async function deleteMyPersonalTodo(req: Request, res: Response, next: NextFunction) {
  try {
    const todo = await PersonalTodo.findById(String(req.params.todoId)).exec();
    if (!todo || String(todo.ownerId) !== String(req.authUser!._id) || todo.status === PersonalTodoStatus.DELETED) {
      throw new ApiError(404, "TODO not found");
    }
    const deletedAt = new Date();
    todo.status = PersonalTodoStatus.DELETED;
    todo.deletedAt = deletedAt;
    addHistoryEvent(todo, PersonalTodoAction.DELETED, req.authUser!._id, deletedAt);
    await todo.save();
    return res.json({ success: true, todo: todoView(todo) });
  } catch (error) {
    next(error);
  }
}
