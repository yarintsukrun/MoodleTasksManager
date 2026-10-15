import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './data';
import { AppLayout } from './layout/AppLayout';
import ImportScreen from './screens/import';
import SemesterScreen from './screens/semester';
import SettingsScreen from './screens/settings';
import TasksScreen from './screens/tasks';
import TimetableScreen from './screens/timetable';
import TodayScreen from './screens/today';

export default function App() {
  return (
    <StoreProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/today" replace />} />
            <Route path="today" element={<TodayScreen />} />
            <Route path="timetable" element={<TimetableScreen />} />
            <Route path="tasks" element={<TasksScreen />} />
            <Route path="semester" element={<SemesterScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="import" element={<ImportScreen />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
