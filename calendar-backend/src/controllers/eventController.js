const Event = require("../models/Event");
const Team = require("../models/Team");

// 创建通知
const createNotification = async (event, type, userIds) => {
  const messages = {
    created: `"${event.title}" 일정이 생성되었습니다.`,
    updated: `"${event.title}" 일정이 수정되었습니다.`,
    deleted: `"${event.title}" 일정이 삭제되었습니다.`,
    reminder: `"${event.title}" 일정이 곧 시작됩니다.`,
  };

  const notifications = userIds
    .filter(id => id.toString() !== event.createdBy.toString())
    .map(userId => ({
      userId,
      type,
      message: messages[type] || `${type} notification`,
      isRead: false,
      createdAt: new Date(),
    }));

  if (notifications.length > 0) {
    await Event.findByIdAndUpdate(event._id, {
      $push: { notifications: { $each: notifications } },
    });
  }
};

const createEvent = async (req, res) => {
  try {
    const {
      title, description, startDate, endDate, allDay, teamId,
      category, tags, location, reminder, attendees
    } = req.body;

    if (!title || !startDate || !endDate)
      return res.status(400).json({ message: "제목, 시작일, 종료일은 필수입니다." });

    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });

      const myRole = team.getUserRole(req.user._id);
      if (!myRole) return res.status(403).json({ message: "해당 팀의 멤버가 아닙니다." });

      if (myRole === "guest") {
        return res.status(403).json({ message: "게스트는 일정을 생성할 수 없습니다." });
      }
    }

    // 참여자 처리
    let validAttendees = [];
    if (attendees && attendees.length > 0) {
      validAttendees = attendees.map(a => ({
        userId: a.userId,
        status: "pending",
      }));
    }

    const event = await Event.create({
      title, description, startDate, endDate, allDay,
      team: teamId || null,
      createdBy: req.user._id,
      sourceTeam: teamId || null,
      category: category || "personal",
      tags: tags || [],
      location: location || "",
      reminder: reminder || { enabled: false, minutes: 30 },
      attendees: validAttendees,
    });

    // 팀이 있으면 다른 멤버에게 알림 전송
    if (teamId) {
      const team = await Team.findById(teamId);
      const otherMembers = team.members.filter(
        (m) => m.toString() !== req.user._id.toString()
      );
      await createNotification(event, "created", otherMembers);

      // attendees가 지정된 경우: 해당 attendees(팀원 중)에게만 개인 캘린더 복사본 생성
      // attendees가 없으면 개인 캘린더에 복사본 생성 안 함 (팀 캘린더에서만 확인)
      const attendeeIds = validAttendees.map(a => a.userId.toString());
      const copyTargets = attendeeIds.length > 0
        ? otherMembers.filter(m => attendeeIds.includes(m.toString()))
        : [];

      if (copyTargets.length > 0) {
        await Promise.all(
          copyTargets.map((memberId) =>
            Event.create({
              title, description, startDate, endDate, allDay,
              team: null,
              createdBy: memberId,
              sourceTeam: teamId,
              category: category || "personal",
              tags: tags || [],
              attendees: validAttendees,
            })
          )
        );
      }

      // 생성자 본인이 참여자에 포함된 경우 개인 캘린더에도 복사본 생성
      const creatorIsAttendee = attendeeIds.includes(req.user._id.toString());
      if (creatorIsAttendee) {
        await Event.create({
          title, description, startDate, endDate, allDay,
          team: null,
          createdBy: req.user._id,
          sourceTeam: teamId,
          category: category || "personal",
          tags: tags || [],
          attendees: validAttendees,
        });
      }
    }

    const populated = await Event.findById(event._id)
      .populate("createdBy", "name email")
      .populate("attendees.userId", "name email");
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const { teamId, startDate, endDate, category } = req.query;
    const filter = {};

    // 如果指定团队，只查该团队的日程
    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
      
      // 检查权限
      const myRole = team.getUserRole(req.user._id);
      if (!myRole) return res.status(403).json({ message: "팀 멤버가 아닙니다." });
      
      // 게스트 포함 모든 팀 멤버 팀 일정 조회 가능 (생성/수정/삭제만 제한)
      filter.team = teamId;
    } else {
      const userTeamIds = await getUserTeamIds(req.user._id);
      filter.$or = [
        { createdBy: req.user._id, team: null },
        // 팀 일정 중 나를 참여자로 지정한 일정
        { "attendees.userId": req.user._id, team: { $in: userTeamIds } },
      ];
    }

    if (startDate && endDate) {
      filter.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // 按分类筛选
    if (category) {
      filter.category = category;
    }

    const events = await Event.find(filter)
      .populate("createdBy", "name email")
      .populate("attendees.userId", "name email")
      .sort({ startDate: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取用户所属的所有团队ID
const getUserTeamIds = async (userId) => {
  const teams = await Team.find({ members: userId });
  return teams.map(t => t._id);
};

const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("attendees.userId", "name email");
    if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });

    const isCreator = event.createdBy.toString() === req.user._id.toString();

    if (event.team) {
      const team = await Team.findById(event.team);
      const myRole = team?.getUserRole(req.user._id);
      if (!isCreator && (!myRole || (myRole !== "owner" && myRole !== "admin"))) {
        return res.status(403).json({ message: "수정 권한이 없습니다." });
      }
    } else if (!isCreator) {
      return res.status(403).json({ message: "일정 작성자만 수정할 수 있습니다." });
    }

    // teamId는 스키마 필드가 아니므로 제거, attendees는 별도 처리
    const { attendees: newAttendees, teamId, ...updateFields } = req.body;

    // 참여자 업데이트: 기존 응답 상태 유지, 신규는 pending
    if (Array.isArray(newAttendees)) {
      updateFields.attendees = newAttendees.map(a => {
        const uid = String(a.userId);
        const existing = event.attendees.find(e => e.userId.toString() === uid);
        return existing
          ? { userId: uid, status: existing.status, respondedAt: existing.respondedAt }
          : { userId: uid, status: "pending" };
      });
    }

    const updated = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate("createdBy", "name email")
      .populate("attendees.userId", "name email");

    if (event.team) {
      const team = await Team.findById(event.team);
      const notifyUsers = team.members.filter(m => m.toString() !== req.user._id.toString());
      await createNotification(updated, "updated", notifyUsers);
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });

    // 检查权限
    const isCreator = event.createdBy.toString() === req.user._id.toString();
    
    if (event.team) {
      const team = await Team.findById(event.team);
      const myRole = team?.getUserRole(req.user._id);
      
      // 只有创建者、owner、admin 可以删除
      if (!isCreator && (!myRole || (myRole !== "owner" && myRole !== "admin"))) {
        return res.status(403).json({ message: "삭제 권한이 없습니다." });
      }
    } else if (!isCreator) {
      return res.status(403).json({ message: "일정 작성자만 삭제할 수 있습니다." });
    }

    // 发送删除通知
    if (event.team) {
      const team = await Team.findById(event.team);
      if (team) {
        const notifyUsers = team.members.filter(
          m => m.toString() !== req.user._id.toString()
        );
        await createNotification(event, "deleted", notifyUsers);
      }
    }

    // 팀 이벤트 삭제 시 attendees에게 배포된 개인 복사본도 함께 삭제
    if (event.team) {
      await Event.deleteMany({
        sourceTeam: event.team,
        team: null,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
      });
    }

    await event.deleteOne();
    res.json({ message: "일정이 삭제되었습니다." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== 알림 관리 =====

// 내 알림 조회
const getNotifications = async (req, res) => {
  try {
    const { teamId } = req.query;
    
    let filter = { "notifications.userId": req.user._id };
    
    if (teamId) {
      filter.team = teamId;
    }

    const events = await Event.find(filter)
      .select("title notifications team createdBy")
      .populate("team", "name")
      .sort({ "notifications.createdAt": -1 })
      .limit(50);

    // 提取并整理通知
    const notifications = [];
    events.forEach(event => {
      event.notifications
        .filter(n => n.userId.toString() === req.user._id.toString())
        .forEach(n => {
          notifications.push({
            _id: n._id,
            eventId: event._id,
            eventTitle: event.title,
            teamName: event.team?.name,
            type: n.type,
            message: n.message,
            isRead: n.isRead,
            createdAt: n.createdAt,
          });
        });
    });

    // 按时间排序
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 标记通知已读
const markNotificationRead = async (req, res) => {
  try {
    const { eventId, notificationId } = req.params;

    await Event.updateOne(
      { _id: eventId, "notifications._id": notificationId },
      { $set: { "notifications.$.isRead": true } }
    );

    res.json({ message: "확인 처리되었습니다." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

function mergeSlots(slots) {
  if (!slots.length) return [];
  const sorted = [...slots].sort((a, b) => new Date(a.start) - new Date(b.start));
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur  = sorted[i];
    if (new Date(cur.start) <= new Date(last.end)) {
      if (new Date(cur.end) > new Date(last.end)) last.end = cur.end;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

function calcFreeSlots(allBusySlots, rangeStart, rangeEnd, minMinutes = 30) {
  const combined = allBusySlots.flat().map(s => ({
    start: s.start,
    end:   s.end,
  }));
  const mergedBusy = mergeSlots(combined);

  const free  = [];
  let cursor  = rangeStart;

  for (const busy of mergedBusy) {
    const busyStart = new Date(busy.start);
    const busyEnd   = new Date(busy.end);
    if (busyStart > cursor) {
      const diffMin = (busyStart - cursor) / 60000;
      if (diffMin >= minMinutes) {
        free.push({
          start:       cursor.toISOString(),
          end:         busyStart.toISOString(),
          durationMin: Math.round(diffMin),
        });
      }
    }
    if (busyEnd > cursor) cursor = busyEnd;
  }

  if (cursor < rangeEnd) {
    const diffMin = (rangeEnd - cursor) / 60000;
    if (diffMin >= minMinutes) {
      free.push({
        start:       cursor.toISOString(),
        end:         rangeEnd.toISOString(),
        durationMin: Math.round(diffMin),
      });
    }
  }
  return free;
}
// [rangeStart, rangeEnd] 에서 free 윈도우들을 뺀 나머지(=바쁨) 구간 반환
function invertWindows(rangeStart, rangeEnd, windows) {
  const sorted = windows
    .map(w => ({ start: new Date(w.start), end: new Date(w.end) }))
    .filter(w => w.end > rangeStart && w.start < rangeEnd)
    .sort((a, b) => a.start - b.start);
  const busy = [];
  let cursor = new Date(rangeStart);
  for (const w of sorted) {
    const ws = w.start < rangeStart ? new Date(rangeStart) : w.start;
    const we = w.end > rangeEnd ? new Date(rangeEnd) : w.end;
    if (ws > cursor) busy.push({ start: cursor.toISOString(), end: ws.toISOString() });
    if (we > cursor) cursor = we;
  }
  if (cursor < rangeEnd) busy.push({ start: cursor.toISOString(), end: rangeEnd.toISOString() });
  return busy;
}

const getFreeBusy = async (req, res) => {
  try {
    const { teamId, date, startDate, endDate, userIds } = req.query;

    if (!teamId) return res.status(400).json({ message: "teamId는 필수입니다." });

    const team = await Team.findById(teamId).populate("members", "name email weeklyFreeTime");
    if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });

    const myRole = team.getUserRole(req.user._id);
    if (!myRole) return res.status(403).json({ message: "팀 멤버만 조회할 수 있습니다." });

    let rangeStart, rangeEnd;
    if (date) {
      rangeStart = new Date(`${date}T00:00:00.000+09:00`);
      rangeEnd   = new Date(`${date}T23:59:59.999+09:00`);
    } else if (startDate && endDate) {
      rangeStart = new Date(startDate);
      rangeEnd   = new Date(endDate);
    } else {
      return res.status(400).json({ message: "date 또는 startDate+endDate 가 필요합니다." });
    }

    // 단일 날짜 조회일 때만 개인 주간 여유 시간 반영 (요일 결정 가능)
    const weekday = date ? new Date(`${date}T00:00:00Z`).getUTCDay() : null;

    let targetMembers = team.members;
    if (userIds) {
      const ids = userIds.split(",").map(id => id.trim());
      targetMembers = targetMembers.filter(m => ids.includes(m._id.toString()));
    }

    const toSlot = (ev) => ({
      start: ev.allDay ? rangeStart.toISOString() : ev.startDate.toISOString(),
      end:   ev.allDay ? rangeEnd.toISOString()   : ev.endDate.toISOString(),
    });

    const memberResults = await Promise.all(
      targetMembers.map(async (member) => {
        // 팀 일정: 본인이 참여자로 지정된 팀 원본 (바쁨)
        const teamEvents = await Event.find({
          team: teamId,
          "attendees.userId": member._id,
          startDate: { $lt: rangeEnd },
          endDate:   { $gt: rangeStart },
        }).select("startDate endDate allDay");

        const teamBusy = teamEvents.map(toSlot);

        // 개인 주간 여유 시간: 설정한 시간대 = 여유, 그 밖 = 사용 불가.
        // 미설정 요일은 종일 여유.
        let availableSlots = [{ start: rangeStart.toISOString(), end: rangeEnd.toISOString() }];
        let unavailable = [];
        if (weekday !== null) {
          const dayWindows = (member.weeklyFreeTime || [])
            .filter(s => s.day === weekday && s.start && s.end)
            .map(s => ({
              start: new Date(`${date}T${s.start}:00.000+09:00`),
              end:   new Date(`${date}T${s.end}:00.000+09:00`),
            }));
          if (dayWindows.length > 0) {
            availableSlots = mergeSlots(dayWindows.map(w => ({
              start: w.start.toISOString(),
              end:   w.end.toISOString(),
            })));
            unavailable = invertWindows(rangeStart, rangeEnd, dayWindows);
          }
        }

        return {
          userId:         member._id,
          name:           member.name,
          email:          member.email,
          teamSlots:      mergeSlots(teamBusy),
          availableSlots,
          busySlots:      mergeSlots([...teamBusy, ...unavailable]),
        };
      })
    );

    const freeSlots = calcFreeSlots(
      memberResults.map(m => m.busySlots),
      rangeStart,
      rangeEnd,
      30
    );

    res.json({
      date:      date || null,
      startDate: rangeStart.toISOString(),
      endDate:   rangeEnd.toISOString(),
      members:   memberResults,
      freeSlots,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = {
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getNotifications,
  markNotificationRead,
  getFreeBusy,
};
