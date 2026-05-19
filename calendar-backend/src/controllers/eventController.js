const Event = require("../models/Event");
const Team = require("../models/Team");

const createEvent = async (req, res) => {
  const { title, description, startDate, endDate, allDay, teamId } = req.body;
  if (!title || !startDate || !endDate)
    return res.status(400).json({ message: "제목, 시작일, 종료일은 필수입니다." });

  if (teamId) {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "팀을 찾을 수 없습니다." });
    if (!team.members.includes(req.user._id))
      return res.status(403).json({ message: "해당 팀의 멤버가 아닙니다." });
  }

  const event = await Event.create({
    title,
    description,
    startDate,
    endDate,
    allDay,
    team: teamId || null,
    createdBy: req.user._id,
  });

  res.status(201).json(event);
};

const getEvents = async (req, res) => {
  const { teamId } = req.query;
  const filter = teamId ? { team: teamId } : { createdBy: req.user._id, team: null };
  const events = await Event.find(filter).populate("createdBy", "name email");
  res.json(events);
};

const getEvent = async (req, res) => {
  const event = await Event.findById(req.params.id).populate("createdBy", "name email");
  if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });
  res.json(event);
};

const updateEvent = async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });
  if (event.createdBy.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "일정 작성자만 수정할 수 있습니다." });

  const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  res.json(updated);
};

const deleteEvent = async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: "일정을 찾을 수 없습니다." });
  if (event.createdBy.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "일정 작성자만 삭제할 수 있습니다." });

  await event.deleteOne();
  res.json({ message: "일정이 삭제되었습니다." });
};

module.exports = { createEvent, getEvents, getEvent, updateEvent, deleteEvent };
