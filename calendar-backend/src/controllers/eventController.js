const Event = require("../models/Event");
const Team = require("../models/Team");

const createEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, allDay, teamId, appliedTeams } = req.body;
    if (!title || !startDate || !endDate)
      return res.status(400).json({ message: "제목, 시작일, 종료일은 필수입니다." });

    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
      if (!team.members.includes(req.user._id))
        return res.status(403).json({ message: "해당 팀의 멤버가 아닙니다." });
    }

    // 원본 팀에 역공개 불가
    let validAppliedTeams = [];
    if (appliedTeams && appliedTeams.length > 0) {
      validAppliedTeams = appliedTeams.filter(
        (id) => id.toString() !== teamId?.toString()
      );
    }

    const event = await Event.create({
      title, description, startDate, endDate, allDay,
      team: teamId || null,
      createdBy: req.user._id,
      sourceTeam: teamId || null,
      isPublic: validAppliedTeams.length > 0,
      appliedTeams: validAppliedTeams,
    });

    if (teamId) {
      const team = await Team.findById(teamId);
      const otherMembers = team.members.filter(
        (m) => m.toString() !== req.user._id.toString()
      );
      await Promise.all(
        otherMembers.map((memberId) =>
          Event.create({
            title, description, startDate, endDate, allDay,
            team: null,
            createdBy: memberId,
            sourceTeam: teamId,
            isPublic: false,
          })
        )
      );
    }

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const { teamId, startDate, endDate } = req.query;
    const filter = teamId
      ? { team: teamId }
      : { createdBy: req.user._id, team: null };
    if (startDate && endDate) {
      filter.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const events = await Event.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email");
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("createdBy", "name email");
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
    if (event.createdBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "일정 작성자만 수정할 수 있습니다." });
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });
    if (event.createdBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "일정 작성자만 삭제할 수 있습니다." });
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
        if (!event || event.createdBy.toString() !== req.user._id.toString()) return;

        // 원본 팀에 역공개 불가
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

module.exports = { createEvent, getEvents, getEvent, updateEvent, deleteEvent, publishEvents };
