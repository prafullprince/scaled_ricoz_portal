import type { NextFunction, Request, Response } from "express";
import { PersonalTaskPriority, PersonalTaskPriorityKind } from "../../models/task-priority-preference.models.js";
import { TaskPriority } from "../../models/task.models.js";
import { ApiError } from "../../utils/apiError.utils.js";

const builtIns = [
  { key: "BUILTIN:P1", label: "P1 Urgent" },
  { key: "BUILTIN:P2", label: "P2 High" },
  { key: "BUILTIN:P3", label: "P3 Normal" },
];
const builtInPriorities = new Map(builtIns.map((priority) => [priority.key, priority]));
const categoryKey = (label: string) => label.trim().toLocaleLowerCase("en");

export async function getMyWorkPriorities(req: Request, res: Response, next: NextFunction) {
  try {
    const preferences = await PersonalTaskPriority.find({ userId: req.authUser!._id }).select("kind key label enabled").lean();
    const categories = preferences.filter((item) => item.kind === PersonalTaskPriorityKind.CATEGORY);
    const overrides = preferences.filter((item) => item.kind === PersonalTaskPriorityKind.OVERRIDE);
    const builtInCategories = builtIns.map((builtIn) => {
      const saved = categories.find((item) => item.key === builtIn.key);
      return { ...builtIn, label: saved?.label ?? builtIn.label, enabled: saved?.enabled ?? true, builtIn: true };
    });
    const customCategories = categories.filter((item) => !builtInPriorities.has(item.key)).map((item) => ({
      key: item.key.startsWith("CUSTOM:") ? item.key.slice(7) : item.key,
      label: item.label,
      enabled: item.enabled ?? true,
      builtIn: false,
    }));
    const categoryByLabel = new Map(customCategories.map((item) => [categoryKey(item.label), item.key]));
    return res.json({
      success: true,
      categories: [...builtInCategories, ...customCategories],
      overrides: overrides.map((item) => {
        const legacyBuiltIn = item.label.toUpperCase();
        const priorityKey = (builtInPriorities.has(item.label) ? item.label : undefined)
          ?? builtIns.find((builtIn) => builtIn.key.endsWith(`:${legacyBuiltIn}`))?.key
          ?? categoryByLabel.get(categoryKey(item.label))
          ?? item.label;
        return { itemKey: item.key, priorityKey };
      }),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMyWorkPriority(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemKey, priorityKey } = req.body as { itemKey: string; priorityKey: string };
    if (!builtInPriorities.has(priorityKey)) {
      const category = await PersonalTaskPriority.exists({
        userId: req.authUser!._id,
        kind: PersonalTaskPriorityKind.CATEGORY,
        key: { $in: [priorityKey, `CUSTOM:${priorityKey}`] },
        $or: [{ enabled: true }, { enabled: { $exists: false } }],
      });
      if (!category) throw new ApiError(400, "Choose one of your personal priority categories");
    } else {
      const category = await PersonalTaskPriority.findOne({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY, key: priorityKey }).select("enabled").lean();
      if (category?.enabled === false) throw new ApiError(400, "Restore this built-in priority before using it");
    }
    await PersonalTaskPriority.findOneAndUpdate(
      { userId: req.authUser!._id, kind: PersonalTaskPriorityKind.OVERRIDE, key: itemKey },
      { $set: { label: priorityKey } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.json({ success: true, itemKey, priorityKey });
  } catch (error) {
    next(error);
  }
}

export async function resetMyWorkPriority(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemKey } = req.body as { itemKey: string };
    await PersonalTaskPriority.deleteOne({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.OVERRIDE, key: itemKey });
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function createMyWorkPriorityCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { label } = req.body as { label: string };
    const normalized = label.trim();
    if (Object.values(TaskPriority).some((value) => value.toLocaleLowerCase("en") === normalized.toLocaleLowerCase("en"))) {
      const builtIn = builtIns.find((item) => item.key.endsWith(`:${normalized.toUpperCase()}`));
      if (builtIn) {
        await PersonalTaskPriority.findOneAndUpdate(
          { userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY, key: builtIn.key },
          { $set: { enabled: true, label: builtIn.label } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        return res.status(201).json({ success: true, key: builtIn.key, label: builtIn.label });
      }
      throw new ApiError(400, "That name is already reserved for a built-in priority");
    }
    const key = categoryKey(normalized);
    const savedCategories = await PersonalTaskPriority.find({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY }).select("key label enabled").lean();
    const savedKeys = new Set(savedCategories.map((item) => item.key));
    const activeNames = [
      ...savedCategories.filter((item) => item.enabled !== false).map((item) => item.label),
      ...builtIns.filter((item) => !savedKeys.has(item.key)).map((item) => item.label),
    ];
    if (activeNames.some((current) => categoryKey(current) === key)) throw new ApiError(409, "That personal priority category already exists");
    const categoryCount = await PersonalTaskPriority.countDocuments({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY });
    if (categoryCount >= 50) throw new ApiError(400, "You can create up to 50 personal priority categories");
    await PersonalTaskPriority.create({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY, key, label: normalized });
    return res.status(201).json({ success: true, key, label: normalized });
  } catch (error) {
    next(error);
  }
}

export async function updateMyWorkPriorityCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { key, label } = req.body as { key: string; label: string };
    const existing = await PersonalTaskPriority.findOne({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY, key }).lean();
    const defaultBuiltIn = builtInPriorities.get(key);
    if (!existing && !defaultBuiltIn) throw new ApiError(404, "Priority category not found");
    if (existing?.enabled === false) throw new ApiError(409, "Restore this priority before editing it");
    if (Object.values(TaskPriority).some((value) => value.toLocaleLowerCase("en") === label.toLocaleLowerCase("en"))) {
      throw new ApiError(409, "That name is reserved for a built-in priority");
    }
    const savedCategories = await PersonalTaskPriority.find({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY }).select("key label enabled").lean();
    const savedKeys = new Set(savedCategories.map((item) => item.key));
    const activeNames = [
      ...savedCategories.filter((item) => item.enabled !== false && item.key !== key).map((item) => item.label),
      ...builtIns.filter((item) => item.key !== key && !savedKeys.has(item.key)).map((item) => item.label),
    ];
    if (activeNames.some((current) => categoryKey(current) === categoryKey(label))) {
      throw new ApiError(409, "A priority with that name already exists");
    }
    if (!builtIns.some((item) => item.key === key) && key === categoryKey(label) && existing?.label === label) {
      return res.json({ success: true, key, label });
    }
    if (existing && existing.label !== label) {
      await PersonalTaskPriority.updateMany(
        { userId: req.authUser!._id, kind: PersonalTaskPriorityKind.OVERRIDE, label: existing.label },
        { $set: { label: key } },
      );
    }
    await PersonalTaskPriority.findOneAndUpdate(
      { userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY, key },
      { $set: { label, enabled: true }, $setOnInsert: { key, kind: PersonalTaskPriorityKind.CATEGORY, userId: req.authUser!._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return res.json({ success: true, key, label });
  } catch (error) {
    next(error);
  }
}

export async function deleteMyWorkPriorityCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { key } = req.body as { key: string };
    const builtIn = builtInPriorities.has(key);
    const category = await PersonalTaskPriority.findOne({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY, key }).select("label").lean();
    if (!category && !builtIn) throw new ApiError(404, "Priority category not found");
    if (builtIn) {
      const original = builtInPriorities.get(key)!;
      await PersonalTaskPriority.findOneAndUpdate(
        { userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY, key },
        { $set: { label: category?.label ?? original.label, enabled: false } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } else {
      await PersonalTaskPriority.deleteOne({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY, key });
    }
    const oldLabels = key === "BUILTIN:P1" ? ["P1", "URGENT"] : key === "BUILTIN:P2" ? ["P2", "HIGH", "MEDIUM"] : key === "BUILTIN:P3" ? ["P3", "LOW"] : [];
    await PersonalTaskPriority.deleteMany({ userId: req.authUser!._id, kind: PersonalTaskPriorityKind.OVERRIDE, label: { $in: [key, ...oldLabels, ...(category ? [category.label] : [])] } });
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function restoreMyWorkPriorityCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { key } = req.body as { key: string };
    const builtIn = builtInPriorities.get(key);
    if (!builtIn) throw new ApiError(400, "Only built-in priorities can be restored");
    await PersonalTaskPriority.findOneAndUpdate(
      { userId: req.authUser!._id, kind: PersonalTaskPriorityKind.CATEGORY, key },
      { $set: { enabled: true, label: builtIn.label }, $setOnInsert: { key, kind: PersonalTaskPriorityKind.CATEGORY, userId: req.authUser!._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return res.json({ success: true, key, label: builtIn.label });
  } catch (error) {
    next(error);
  }
}
