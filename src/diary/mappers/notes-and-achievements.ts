import { parseNotNullOrEmpty, remoteISOToExtendedISO } from '../../utils';
import type { Note, NoteType } from '../interfaces/notes-and-achievements/note';
import type { NotesAndAchievements } from '../interfaces/notes-and-achievements/notes-and-achievements';
import type {
  NoteData,
  NotesAndAchievementsData,
} from '../interfaces/notes-and-achievements/notes-and-achievements-data';

function mapNoteType(dataType: number): NoteType {
  let type: NoteType = 'unknown';
  if (dataType === 1) type = 'positive';
  else if (dataType === 2) type = 'neutral';
  else if (dataType === 3) type = 'negative';
  return type;
}

function mapNote(data: NoteData): Note {
  return {
    category: {
      name: data.Kategoria,
      type: mapNoteType(data.KategoriaTyp),
    },
    content: data.TrescUwagi,
    dateTime: remoteISOToExtendedISO(data.DataWpisu),
    points: parseNotNullOrEmpty(data.Punkty),
    showPoints: data.PokazPunkty,
    teacher: data.Nauczyciel,
  };
}

export function mapNotesAndAchievements(data: NotesAndAchievementsData): NotesAndAchievements {
  return {
    achievements: data.Osiagniecia,
    notes: data.Uwagi.map(mapNote),
  };
}
