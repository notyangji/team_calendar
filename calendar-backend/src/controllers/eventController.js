const Event = require("../models/Event");
const Team = require("../models/Team");
const User = require("../models/User");

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
      title, description, startDate, endDate, allDay, teamId, appliedTeams,
      category, tags, location, reminder, attendees 
    } = req.body;
    
    if (!title || !startDate || !endDate)
      return res.status(400).json({ message: "제목, 시작일, 종료일은 필수입니다." });

    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
      
      // 检查团队成员身份
      const myRole = team.getUserRole(req.user._id);
      if (!myRole) return res.status(403).json({ message: "해당 팀의 멤버가 아닙니다." });
      
      // guest 不能创建日程
      if (myRole === "guest") {
        return res.status(403).json({ message: "게스트는 일정을 생성할 수 없습니다." });
      }
    }

    // 原团队不能逆公开
    let validAppliedTeams = [];
    if (appliedTeams && appliedTeams.length > 0) {
      validAppliedTeams = appliedTeams.filter(
        (id) => id.toString() !== teamId?.toString()
      );
    }

    // 处理参与人
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
      isPublic: validAppliedTeams.length > 0,
      appliedTeams: validAppliedTeams,
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
              isPublic: false,
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
          isPublic: false,
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
        { isPublic: true, appliedTeams: { $elemMatch: { $in: userTeamIds } } },
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

// 获取团队所有日程（含共享的）
const getTeamEvents = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate, category } = req.query;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });

    const myRole = team.getUserRole(req.user._id);
    if (!myRole) return res.status(403).json({ message: "팀 멤버가 아닙니다." });

    const filter = { team: teamId };
    
    if (startDate && endDate) {
      filter.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
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

const publishEvents = async (req, res) => {
  try {
    const { eventIds, teamIds } = req.body;
    if (!eventIds || !teamIds)
      return res.status(400).json({ message: "eventIds와 teamIds는 필수입니다." });

    await Promise.all(
      eventIds.map(async (eventId) => {
        const event = await Event.findById(eventId);
        if (!event) return;

        // 检查权限
        const isCreator = event.createdBy.toString() === req.user._id.toString();
        if (!isCreator) return;

        // 原团队不能逆公开
        const validTeams = teamIds.filter(
          (id) => id.toString() !== event.sourceTeam?.toString()
        );

        await Event.findByIdAndUpdate(eventId, {
          isPublic: true,
          $addToSet: { appliedTeams: { $each: validTeams } },
        });
      })
    );

    res.json({ message: "공개 설정이 완료되었습니다." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== 新增：参与人管理 =====

// 添加参与人
const addAttendees = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ message: "userIds 배열이 필요합니다." });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });

    // 检查权限
    const isCreator = event.createdBy.toString() === req.user._id.toString();
    if (!isCreator) {
      return res.status(403).json({ message: "일정 작성자만 참여자를 추가할 수 있습니다." });
    }

    // 验证用户存在
    const users = await User.find({ _id: { $in: userIds } });
    if (users.length !== userIds.length) {
      return res.status(400).json({ message: "일부 사용자를 찾을 수 없습니다." });
    }

    // 添加参与人
    const newAttendees = userIds
      .filter(uid => !event.attendees.some(a => a.userId.toString() === uid))
      .map(uid => ({
        userId: uid,
        status: "pending",
      }));

    if (newAttendees.length > 0) {
      await Event.findByIdAndUpdate(eventId, {
        $push: { attendees: { $each: newAttendees } },
      });
    }

    const updated = await Event.findById(eventId)
      .populate("createdBy", "name email")
      .populate("attendees.userId", "name email");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 移除参与人
const removeAttendee = async (req, res) => {
  try {
    const { id: eventId, userId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });

    // 检查权限：创建者或被移除者自己
    const isCreator = event.createdBy.toString() === req.user._id.toString();
    const isSelf = userId === req.user._id.toString();
    
    if (!isCreator && !isSelf) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    await Event.findByIdAndUpdate(eventId, {
      $pull: { attendees: { userId } },
    });

    const updated = await Event.findById(eventId)
      .populate("createdBy", "name email")
      .populate("attendees.userId", "name email");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 更新参与状态
const updateAttendeeStatus = async (req, res) => {
  try {
    const { id: eventId, userId } = req.params;
    const { status } = req.body;

    if (!["pending", "accepted", "declined"].includes(status)) {
      return res.status(400).json({ message: "유효하지 않은 상태입니다." });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });

    // 只有被邀请者自己可以更新状态
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ message: "자신의 상태만 변경할 수 있습니다." });
    }

    await Event.findOneAndUpdate(
      { _id: eventId, "attendees.userId": userId },
      { 
        $set: { 
          "attendees.$.status": status,
          "attendees.$.respondedAt": new Date(),
        },
      }
    );

    const updated = await Event.findById(eventId)
      .populate("createdBy", "name email")
      .populate("attendees.userId", "name email");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== 新增：通知管理 =====

// 获取我的通知
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

// 获取分类列表
const getCategories = async (req, res) => {
  res.json(Event.CATEGORIES);
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
const getFreeBusy = async (req, res) => {
  try {
    const { teamId, date, startDate, endDate, userIds } = req.query;

    if (!teamId) return res.status(400).json({ message: "teamId는 필수입니다." });

    const team = await Team.findById(teamId).populate("members", "name email");
    if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });

    const myRole = team.getUserRole(req.user._id);
    if (!myRole) return res.status(403).json({ message: "팀 멤버만 조회할 수 있습니다." });

    let rangeStart, rangeEnd;
    if (date) {
      rangeStart = new Date(`${date}T00:00:00.000Z`);
      rangeEnd   = new Date(`${date}T23:59:59.999Z`);
    } else if (startDate && endDate) {
      rangeStart = new Date(startDate);
      rangeEnd   = new Date(endDate);
    } else {
      return res.status(400).json({ message: "date 또는 startDate+endDate 가 필요합니다." });
    }

    let targetMembers = team.members;
    if (userIds) {
      const ids = userIds.split(",").map(id => id.trim());
      targetMembers = targetMembers.filter(m => ids.includes(m._id.toString()));
    }

    const memberResults = await Promise.all(
      targetMembers.map(async (member) => {
        const events = await Event.find({
          $or: [
            { createdBy: member._id, team: null },
            { "attendees.userId": member._id, team: { $ne: null } },
          ],
          startDate: { $lt: rangeEnd },
          endDate:   { $gt: rangeStart },
        }).select("title startDate endDate allDay");

        const busySlots = events.map(ev => ({
          title: ev.title,
          start: ev.allDay ? rangeStart.toISOString() : ev.startDate.toISOString(),
          end:   ev.allDay ? rangeEnd.toISOString()   : ev.endDate.toISOString(),
        }));

        return {
          userId:    member._id,
          name:      member.name,
          email:     member.email,
          busySlots: mergeSlots(busySlots),
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
  publishEvents,
  getTeamEvents,
  addAttendees,
  removeAttendee,
  updateAttendeeStatus,
  getNotifications,
  markNotificationRead,
  getCategories,
  getFreeBusy,
};
