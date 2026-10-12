import type { NextFunction, Request, Response } from "express";
import { Attendance, AttendanceStatus } from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";

const dateKey = (value = new Date()) => value.toISOString().slice(0, 10);
const monthKey = (value = new Date()) => value.toISOString().slice(0, 7);

function view(record: any) {
  const sessions = record.sessions ?? [];
  const openSession =
    sessions.find((session: any) => !session.checkOut) ?? null;
  const totalMinutes = sessions.reduce(
    (sum: number, session: any) => sum + (session.totalMinutes ?? 0),
    0,
  );
  const workType =
    totalMinutes > 480
      ? "OVERTIME"
      : totalMinutes >= 240
        ? "PRESENT_DAY"
        : totalMinutes > 120
          ? "HALF_TIME"
          : "UNDER_TWO_HOURS";
  return {
    id: String(record._id),
    date: record.date,
    sessions,
    checkIn: sessions[0]?.checkIn ?? null,
    checkOut: sessions.at(-1)?.checkOut ?? null,
    openSession,
    status: record.status,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    workType,
  };
}

export async function getAttendance(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const month =
      typeof req.query.month === "string" ? req.query.month : monthKey();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(
      50,
      Math.max(1, Number(req.query.pageSize ?? 10)),
    );
    const filter = { userId: req.authUser!._id, date: { $regex: `^${month}` } };
    const totalRecords = await Attendance.countDocuments(filter);
    const records = await Attendance.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();
    const allMonthViews = (await Attendance.find(filter).lean()).map(view);
    const todayRecord = await Attendance.findOne({
      userId: req.authUser!._id,
      date: dateKey(),
    }).lean();
    const present = allMonthViews.filter((record) =>
      [AttendanceStatus.PRESENT, AttendanceStatus.LATE].includes(record.status),
    ).length;
    const late = allMonthViews.filter(
      (record) => record.status === AttendanceStatus.LATE,
    ).length;
    const leave = allMonthViews.filter(
      (record) => record.status === AttendanceStatus.LEAVE,
    ).length;
    const totalMinutes = allMonthViews.reduce(
      (sum, record) => sum + record.totalMinutes,
      0,
    );
    return res.json({
      success: true,
      attendance: {
        today: todayRecord ? view(todayRecord) : null,
        records: records.map(view),
        pagination: {
          page,
          pageSize,
          totalRecords,
          totalPages: Math.ceil(totalRecords / pageSize),
        },
        summary: {
          present,
          late,
          leave,
          averageMinutes: present ? Math.round(totalMinutes / present) : 0,
          month,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function checkIn(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.body.date ?? dateKey();
    const record = await Attendance.findOneAndUpdate(
      { userId: req.authUser!._id, date, sessions: { $not: { $elemMatch: { checkOut: null } } } },
      {
        $setOnInsert: {
          userId: req.authUser!._id,
          date,
          status: AttendanceStatus.PRESENT,
        },
        $push: {
          sessions: { checkIn: new Date(), checkOut: null, totalMinutes: 0 },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return res.json({ success: true, attendance: view(record) });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return next(new ApiError(409, "You already have an open attendance session"));
    next(error);
  }
}

export async function checkOut(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const date = req.body.date ?? dateKey();
    const record = await Attendance.findOne({
      userId: req.authUser!._id,
      date,
    });
    if (!record)
      return res
        .status(400)
        .json({ success: false, message: "Check in before checking out" });
    const session = record.sessions.at(-1);
    if (!session?.checkIn || session.checkOut)
      return res
        .status(400)
        .json({ success: false, message: "Check in before checking out" });
    session.checkOut = new Date();
    session.totalMinutes = Math.max(
      0,
      Math.round(
        (session.checkOut.getTime() - session.checkIn.getTime()) / 60000,
      ),
    );
    await record.save();
    return res.json({ success: true, attendance: view(record) });
  } catch (error) {
    next(error);
  }
}
