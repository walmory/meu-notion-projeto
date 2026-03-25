import { v4 as uuidv4 } from 'uuid';

const meetingsByWorkspace = new Map();

const normalizeMeeting = (meeting) => ({
  id: meeting.id,
  title: meeting.title || 'Untitled Meeting',
  roomName: meeting.roomName || `notion-meeting-${Date.now()}`,
  date: meeting.date || new Date().toISOString(),
  status: meeting.status || 'upcoming',
  participants: Array.isArray(meeting.participants) ? meeting.participants : []
});

const getWorkspaceMeetings = (workspaceId) => {
  if (!meetingsByWorkspace.has(workspaceId)) {
    meetingsByWorkspace.set(workspaceId, []);
  }
  return meetingsByWorkspace.get(workspaceId);
};

export const getMeetings = async (req, res) => {
  const workspaceId = req.workspace_id;
  const meetings = getWorkspaceMeetings(workspaceId);
  return res.json(meetings);
};

export const createMeeting = async (req, res) => {
  const workspaceId = req.workspace_id;
  const meetings = getWorkspaceMeetings(workspaceId);
  const payload = normalizeMeeting(req.body || {});
  const meeting = { ...payload, id: uuidv4() };
  meetings.unshift(meeting);
  return res.status(201).json(meeting);
};

export const updateMeeting = async (req, res) => {
  const { id } = req.params;
  const workspaceId = req.workspace_id;
  const meetings = getWorkspaceMeetings(workspaceId);
  const index = meetings.findIndex((meeting) => String(meeting.id) === String(id));

  if (index === -1) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  const updated = normalizeMeeting({ ...meetings[index], ...(req.body || {}), id: meetings[index].id });
  meetings[index] = updated;
  return res.json(updated);
};

export const deleteMeeting = async (req, res) => {
  const { id } = req.params;
  const workspaceId = req.workspace_id;
  const meetings = getWorkspaceMeetings(workspaceId);
  const nextMeetings = meetings.filter((meeting) => String(meeting.id) !== String(id));

  if (nextMeetings.length === meetings.length) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  meetingsByWorkspace.set(workspaceId, nextMeetings);
  return res.status(204).send();
};
