import { remoteISOToDateString } from '../../utils';
import type { DiaryDataItem, DiaryDataSemester } from '../interfaces/diary/diary-data';
import type { DiaryInfo, Semester } from '../interfaces/diary/diary-info';

function mapSemester(dataSemester: DiaryDataSemester): Semester {
  return {
    id: dataSemester.Id,
    classId: dataSemester.IdOddzial,
    unitId: dataSemester.IdJednostkaSprawozdawcza,
    number: dataSemester.NumerOkresu,
    isLast: dataSemester.IsLastOkres,
    startDate: remoteISOToDateString(dataSemester.DataOd),
    endDate: remoteISOToDateString(dataSemester.DataDo),
    level: dataSemester.Poziom,
  };
}

export function mapDiaryInfo(dataItem: DiaryDataItem): DiaryInfo {
  return {
    diaryId: dataItem.IdDziennik,
    studentId: dataItem.IdUczen,
    schoolYear: dataItem.DziennikRokSzkolny,
    isDiary: dataItem.IsDziennik,
    level: dataItem.Poziom,
    name: dataItem.Nazwa,
    studentFirstName: dataItem.UczenImie,
    studentSecondName: dataItem.UczenImie2,
    studentSurname: dataItem.UczenNazwisko,
    studentFullName: dataItem.UczenPelnaNazwa,
    symbol: dataItem.Symbol,
    semesters: dataItem.Okresy.map(mapSemester),
  };
}
